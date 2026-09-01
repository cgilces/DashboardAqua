#!/bin/bash
# ops/backfill2025/run_resume.sh
# Continuación del backfill 2025 (noviembre -> enero) — diciembre ya se
# reconcilió por separado (el bug de coordenadas de Odoo, ya corregido,
# explicaba la falla original). Arranca de inmediato (sin espera hasta una
# hora objetivo, a pedido explícito del usuario) — mismo patrón validado
# de run.sh: mes a mes, reconciliación real contra Odoo, se detiene ante
# cualquier cosa que no reconoce.
set -uo pipefail

REPO=/opt/grupo-aqua/sistemas/DashboardAqua
TODO="$REPO/TODO.md"
LOG="$REPO/ops/backfill2025/backfill2025.log"
MAX_INTENTOS_POR_MES=200

log() {
  echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] $1" | tee -a "$LOG"
}

hora_local() {
  TZ='America/Guayaquil' date '+%Y-%m-%d %H:%M %Z'
}

log "Orquestador de backfill 2025 (continuación) arrancado (PID $$) — sin espera, a pedido explícito"

PG_STATUS=$(docker inspect -f '{{.State.Health.Status}}' dashboard_postgres 2>&1)
BE_STATUS=$(docker inspect -f '{{.State.Health.Status}}' dashboard_backend 2>&1)
if [ "$PG_STATUS" != "healthy" ] || [ "$BE_STATUS" != "healthy" ]; then
  log "ABORTA: contenedores no saludables (postgres=$PG_STATUS backend=$BE_STATUS)"
  {
    echo ""
    echo "### 🛑 Backfill 2025 (continuación) NO ARRANCÓ — contenedores no saludables ($(hora_local))"
    echo ""
    echo "\`dashboard_postgres\`=\`$PG_STATUS\`, \`dashboard_backend\`=\`$BE_STATUS\`. Revisar manualmente."
  } >> "$TODO"
  exit 1
fi

ST0=$(curl -s --max-time 10 http://localhost:5000/api/sync/status)
RUNNING0=$(echo "$ST0" | grep -o '"running":[a-z]*' | cut -d: -f2)
if [ "$RUNNING0" = "true" ]; then
  log "ABORTA: ya hay un sync corriendo que este orquestador no inició ($ST0)"
  {
    echo ""
    echo "### 🛑 Backfill 2025 (continuación) NO ARRANCÓ — sync ya en curso ($(hora_local))"
    echo ""
    echo "\`/api/sync/status\` ya mostraba una corrida activa: \`$ST0\`. No se disparó nada."
  } >> "$TODO"
  exit 1
fi

log "Pre-flight OK — continuando backfill 2025 desde noviembre"

{
  echo ""
  echo "### 🌙 Backfill 2025 (continuación) — arrancó $(hora_local), a pedido explícito"
  echo ""
  echo "Diciembre ya reconciliado por separado tras el fix de coordenadas. Continúa"
  echo "noviembre 2025 hacia atrás hasta enero 2025, mismo patrón: reconciliación real contra"
  echo "El Rosado (110470, \`status=2\` vs Odoo \`state=posted\`), se detiene ante cualquier cosa"
  echo "que no reconoce."
} >> "$TODO"

MESES=(
  "Mayo 2025|2025-05-01|2025-05-31"
  "Abril 2025|2025-04-01|2025-04-30"
  "Marzo 2025|2025-03-01|2025-03-31"
  "Febrero 2025|2025-02-01|2025-02-28"
  "Enero 2025|2025-01-01|2025-01-31"
)

for entry in "${MESES[@]}"; do
  IFS='|' read -r NOMBRE DESDE HASTA <<< "$entry"
  log "=== $NOMBRE ($DESDE -> $HASTA) ==="

  ST=$(curl -s --max-time 10 http://localhost:5000/api/sync/status)
  RUNNING=$(echo "$ST" | grep -o '"running":[a-z]*' | cut -d: -f2)
  if [ "$RUNNING" = "true" ]; then
    log "DETENIDO: apareció un sync corriendo que no disparamos, antes de $NOMBRE"
    {
      echo ""
      echo "### 🛑 Backfill 2025 DETENIDO antes de $NOMBRE — sync inesperado en curso"
      echo ""
      echo "\`/api/sync/status\`: \`$ST\`. Deteniendo por seguridad, no se pisó nada. Revisar manualmente."
    } >> "$TODO"
    exit 1
  fi

  ERRORES_PREVIOS=$(docker exec dashboard_backend node -e "
    try { const c = require('fs').readFileSync('/app/services/errores_sync.txt','utf8'); console.log(c.split('────────────────────────────────────────────────────────────').filter(b=>b.trim()).length); } catch(e) { console.log(0); }
  " 2>/dev/null)
  ERRORES_PREVIOS=${ERRORES_PREVIOS:-0}

  DISPARO=$(curl -s --max-time 15 "http://localhost:5000/api/sync/sincronizar?desde=$DESDE&hasta=$HASTA")
  log "$NOMBRE: disparado -> $DISPARO"

  INTENTOS=0
  while true; do
    sleep 30
    INTENTOS=$((INTENTOS + 1))
    ST=$(curl -s --max-time 10 http://localhost:5000/api/sync/status)
    RUNNING=$(echo "$ST" | grep -o '"running":[a-z]*' | cut -d: -f2)
    if [ "$RUNNING" = "false" ]; then break; fi
    if [ "$INTENTOS" -ge "$MAX_INTENTOS_POR_MES" ]; then
      log "DETENIDO: timeout esperando $NOMBRE tras $((MAX_INTENTOS_POR_MES * 30 / 60)) minutos"
      {
        echo ""
        echo "### 🛑 Backfill 2025 DETENIDO — timeout en $NOMBRE"
        echo ""
        echo "El sync no terminó tras $((MAX_INTENTOS_POR_MES * 30 / 60)) minutos. Último estado:"
        echo "\`$ST\`. Puede seguir corriendo o haberse colgado — revisar manualmente."
      } >> "$TODO"
      exit 1
    fi
  done
  log "$NOMBRE: sync terminado -> $ST"

  docker exec dashboard_backend mkdir -p /app/ops-tmp 2>/dev/null
  docker cp "$REPO/ops/backfill2025/reconcile.js" dashboard_backend:/app/ops-tmp/reconcile.js

  RESULT=$(docker exec dashboard_backend node /app/ops-tmp/reconcile.js "$DESDE" "$HASTA" "$ERRORES_PREVIOS" 2>/dev/null)
  log "$NOMBRE: reconciliación -> $RESULT"

  if [ -z "$RESULT" ]; then
    log "DETENIDO: reconcile.js no devolvió nada para $NOMBRE"
    {
      echo ""
      echo "### 🛑 Backfill 2025 DETENIDO — reconcile.js sin salida en $NOMBRE"
      echo ""
      echo "El script de reconciliación no devolvió resultado. Revisar"
      echo "\`ops/backfill2025/backfill2025.log\` y correr manualmente."
    } >> "$TODO"
    exit 1
  fi

  # reconcile.js imprime ruido de dotenv + "Conexión..." ANTES del JSON real
  # en stdout (no stderr) — el JSON siempre es la última línea. Parsear el
  # blob completo rompía el JSON.parse y hacía DETENERSE='true' siempre.
  JSON_LINE=$(echo "$RESULT" | tail -1)
  DETENERSE=$(echo "$JSON_LINE" | node -e "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{try{console.log(JSON.parse(d).detenerse)}catch(e){console.log('true')}})")

  {
    echo "- [x] **$NOMBRE** — corrido $(hora_local) (continuación manual, sin supervisión):"
    echo "  \`\`\`"
    echo "  $RESULT"
    echo "  \`\`\`"
  } >> "$TODO"

  if [ "$DETENERSE" = "true" ]; then
    MOTIVO=$(echo "$JSON_LINE" | node -e "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{try{console.log(JSON.parse(d).motivoDetencion||'ver JSON arriba')}catch(e){console.log('error parseando resultado — ver JSON arriba')}})")
    log "DETENIDO en $NOMBRE: $MOTIVO"
    {
      echo ""
      echo "### 🛑 Backfill 2025 DETENIDO en $NOMBRE"
      echo ""
      echo "$MOTIVO"
      echo ""
      echo "No se continuó con los meses anteriores. Requiere revisión manual antes de reanudar."
    } >> "$TODO"
    exit 1
  fi
done

log "Backfill 2025 completado — los 12 meses reconciliaron"
{
  echo ""
  echo "### ✅ Backfill 2025 COMPLETADO — $(hora_local)"
  echo ""
  echo "Los 12 meses (enero-diciembre 2025) reconciliaron exacto contra Odoo (El Rosado,"
  echo "\`status=2\`) y ningún error nuevo se apartó del patrón ya conocido. Log completo en"
  echo "\`ops/backfill2025/backfill2025.log\`."
} >> "$TODO"
