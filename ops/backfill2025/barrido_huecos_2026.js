// ops/backfill2025/barrido_huecos_2026.js
// Barrido de todo enero-agosto 2026 buscando días con conteo de documentos
// anormalmente bajo — misma metodología que resumenDiario.posible_hueco_sync
// (mcp-server/src/tools/resumenDiario.js): compara cada día contra el
// promedio del mismo día de la semana en las 4 semanas anteriores, marca si
// cae por debajo del 50% de ese promedio. Corre contra mcp_server (rol
// mcp_readonly, ya tiene SELECT sobre ordenes/facturas).
//
// A diferencia de resumenDiario (que solo cuenta documentos con status=2 y
// grupo válido, para el desglose por grupo), acá se usa un conteo MÁS
// AMPLIO (ordenes+facturas sin filtrar status/grupo) — el objetivo es
// detectar huecos de SYNC, no de clasificación de negocio, así que conviene
// no depender de la misma lógica que podría enmascarar un hueco parcial.
// Corre dentro de dashboard_backend (cwd /app), reusa su conexión Sequelize.
const sequelize = require("/app/db");
const pool = { query: (sql, params) => sequelize.query(sql, { bind: params, type: sequelize.QueryTypes.SELECT }).then((rows) => ({ rows })) };

const UMBRAL_HUECO_SYNC = 0.5;
const SEMANAS_BASELINE = 4;
const DIAS_SEMANA = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];

function sumarDias(fechaStr, dias) {
  const d = new Date(`${fechaStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}

async function conteoDia(fecha) {
  const { rows } = await pool.query(
    `SELECT
       (SELECT COUNT(*) FROM ordenes  WHERE fecha_creacion >= $1 AND fecha_creacion < $2) +
       (SELECT COUNT(*) FROM facturas WHERE fecha_creacion >= $1 AND fecha_creacion < $2) AS n`,
    [`${fecha} 00:00:00`, `${sumarDias(fecha, 1)} 00:00:00`]
  );
  return Number(rows[0]?.n) || 0;
}

async function main() {
  const DESDE = "2026-01-01";
  const HASTA = "2026-08-30"; // hasta ayer real (hoy 08-31 aun incompleto)

  const dias = [];
  let cursor = DESDE;
  while (cursor <= HASTA) {
    dias.push(cursor);
    cursor = sumarDias(cursor, 1);
  }

  // Precalcular todos los conteos diarios una sola vez (se reutilizan como
  // baseline de días futuros dentro del mismo barrido).
  const conteoPorFecha = {};
  for (const f of dias) {
    conteoPorFecha[f] = await conteoDia(f);
  }

  const sospechosos = [];
  for (const f of dias) {
    const fechasBaseline = Array.from({ length: SEMANAS_BASELINE }, (_, i) => sumarDias(f, -7 * (i + 1)));
    const conteosBaseline = fechasBaseline
      .filter((bf) => conteoPorFecha[bf] !== undefined)
      .map((bf) => conteoPorFecha[bf]);
    if (conteosBaseline.length === 0) continue; // sin historial previo suficiente (ej. primeras semanas del rango)

    const promedioBaseline = conteosBaseline.reduce((a, b) => a + b, 0) / conteosBaseline.length;
    const conteo = conteoPorFecha[f];
    const posibleHueco = promedioBaseline > 0 && conteo < promedioBaseline * UMBRAL_HUECO_SYNC;

    if (posibleHueco) {
      const diaSemana = DIAS_SEMANA[new Date(`${f}T00:00:00Z`).getUTCDay()];
      sospechosos.push({
        fecha: f,
        dia_semana: diaSemana,
        conteo,
        promedio_baseline_4sem: Number(promedioBaseline.toFixed(1)),
        pct_del_baseline: Number(((conteo / promedioBaseline) * 100).toFixed(1)),
      });
    }
  }

  console.log(JSON.stringify({ rango: { desde: DESDE, hasta: HASTA }, dias_analizados: dias.length, sospechosos }, null, 2));
  await sequelize.close();
}

main().catch((e) => {
  console.error("ERROR:", e.message);
  process.exit(1);
});
