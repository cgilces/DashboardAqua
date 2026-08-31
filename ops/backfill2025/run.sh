#!/bin/bash
# ops/backfill2025/run.sh
# Orquestador desatachado del backfill 2025 (diciembre -> enero), mes a mes.
# Diseñado para correr vía `nohup setsid ... &` en el HOST — no depende de
# tmux, SSH, ni de ninguna sesión de Claude Code viva. Espera hasta la hora
# objetivo, luego reconstruye exactamente el patrón manual usado para el
# backfill 2026: dispara el sync, espera a que termine, reconcilia contra
# Odoo (El Rosado, status=2 vs state=posted) y valida que cualquier error
# nuevo siga el patrón ya conocido y diferido. Se detiene (nunca "sigue de
# largo") ante cualquier cosa que no reconoce, y deja todo por escrito en
# TODO.md para que sea consultable sin estar conectado.
set -uo pipefail

REPO=/opt/grupo-aqua/sistemas/DashboardAqua
TODO="$REPO/TODO.md"
LOG="$REPO/ops/backfill2025/backfill2025.log"
TARGET_UTC="2026-09-01T03:00:00Z"  # 22:00 Ecuador (UTC-5), lunes -> 03:00 UTC martes
MAX_INTENTOS_POR_MES=200            # 200*30s = 100 min tope por mes (~4x lo observado en 2026)

log() {
  echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] $1" | tee -a "$LOG"
}

hora_local() {
  TZ='America/Guayaquil' date '+%Y-%m-%d %H:%M %Z'
}

log "Orquestador de backfill 2025 arrancado (PID $$), esperando hasta $TARGET_UTC"

# ── Esperar hasta la hora objetivo (poll cada 5 min, sin un solo setTimeout gigante) ──
while [ "$(date -u +%s)" -lt "$(date -u -d "$TARGET_UTC" +%s)" ]; do
  sleep 300
done

log "Hora objetivo alcanzada — verificación previa antes de arrancar"

# ── Pre-flight: contenedores sanos antes de tocar nada ──
PG_STATUS=$(docker inspect -f '{{.State.Health.Status}}' dashboard_postgres 2>&1)
BE_STATUS=$(docker inspect -f '{{.State.Health.Status}}' dashboard_backend 2>&1)
if [ "$PG_STATUS" != "healthy" ] || [ "$BE_STATUS" != "healthy" ]; then
  log "ABORTA: contenedores no saludables (postgres=$PG_STATUS backend=$BE_STATUS)"
  {
    echo ""
    echo "### 🛑 Backfill 2025 NO ARRANCÓ — contenedores no saludables ($(hora_local))"
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
    echo "### 🛑 Backfill 2025 NO ARRANCÓ — sync ya en curso ($(hora_local))"
    echo ""
    echo "\`/api/sync/status\` ya mostraba una corrida activa al llegar la hora objetivo: \`$ST0\`. No se disparó nada, para no pisarla."
  } >> "$TODO"
  exit 1
fi

log "Pre-flight OK — iniciando backfill 2025"

{
  echo ""
  echo "### 🌙 Backfill 2025 — arrancó automáticamente ($(hora_local))"
  echo ""
  echo "Ejecución programada sin supervisión (lunes 22:00 Ecuador → estimado terminar ~3:00 AM"
  echo "martes). Mismo patrón que 2026: mes a mes, diciembre 2025 hacia atrás hasta enero 2025."
  echo "Reconciliación automática contra El Rosado (110470, \`status=2\` vs Odoo \`state=posted\`)"
  echo "+ verificación de que cualquier error nuevo coincide con el patrón ya conocido"
  echo "(\`estado_ubicacion_direccion_cliente\`, direcciones 277494/284316). Se detiene ante"
  echo "cualquier cosa que no reconoce — nunca sigue de largo con algo no verificado."
} >> "$TODO"

MESES=(
  "Diciembre 2025|2025-12-01|2025-12-31"
  "Noviembre 2025|2025-11-01|2025-11-30"
  "Octubre 2025|2025-10-01|2025-10-31"
  "Septiembre 2025|2025-09-01|2025-09-30"
  "Agosto 2025|2025-08-01|2025-08-31"
  "Julio 2025|2025-07-01|2025-07-31"
  "Junio 2025|2025-06-01|2025-06-30"
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

  # Checkpoint de errores ANTES de disparar este mes (para saber qué es "nuevo" después)
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
        echo "El sync no terminó tras $((MAX_INTENTOS_POR_MES * 30 / 60)) minutos (~4x lo observado en"
        echo "2026). Último estado: \`$ST\`. Puede seguir corriendo o haberse colgado — revisar manualmente."
      } >> "$TODO"
      exit 1
    fi
  done
  log "$NOMBRE: sync terminado -> $ST"

  docker cp "$REPO/ops/backfill2025/reconcile.js" dashboard_backend:/app/ops-tmp/reconcile.js >/dev/null 2>&1 \
    || docker exec dashboard_backend mkdir -p /app/ops-tmp
  docker cp "$REPO/ops/backfill2025/reconcile.js" dashboard_backend:/app/ops-tmp/reconcile.js

  RESULT=$(docker exec dashboard_backend node /app/ops-tmp/reconcile.js "$DESDE" "$HASTA" "$ERRORES_PREVIOS" 2>/dev/null)
  log "$NOMBRE: reconciliación -> $RESULT"

  if [ -z "$RESULT" ]; then
    log "DETENIDO: reconcile.js no devolvió nada para $NOMBRE"
    {
      echo ""
      echo "### 🛑 Backfill 2025 DETENIDO — reconcile.js sin salida en $NOMBRE"
      echo ""
      echo "El script de reconciliación no devolvió resultado (posible error de conexión a"
      echo "Odoo/Postgres). Revisar \`ops/backfill2025/backfill2025.log\` y correr manualmente."
    } >> "$TODO"
    exit 1
  fi

  DETENERSE=$(echo "$RESULT" | node -e "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{try{console.log(JSON.parse(d).detenerse)}catch(e){console.log('true')}})")

  {
    echo "- [x] **$NOMBRE** — corrido $(hora_local) (automático, sin supervisión):"
    echo "  \`\`\`"
    echo "  $RESULT"
    echo "  \`\`\`"
  } >> "$TODO"

  if [ "$DETENERSE" = "true" ]; then
    MOTIVO=$(echo "$RESULT" | node -e "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{try{console.log(JSON.parse(d).motivoDetencion||'ver JSON arriba')}catch(e){console.log('error parseando resultado — ver JSON arriba')}})")
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
