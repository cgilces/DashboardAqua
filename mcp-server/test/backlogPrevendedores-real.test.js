// test/backlogPrevendedores-real.test.js
// Prueba de regresión con datos reales para backlogPrevendedores — ver
// backlogPrevendedores.js para la investigación completa (por qué no existe
// vínculo orden→factura, por qué se usa status, y el caveat del cron).
// Valida contra 2 rutas D reales (T5, T6) de un día reciente (2026-09-15,
// confirmado con volumen real antes de escribir el test) comparando contra
// SQL directo — no contra un número fijo hardcodeado, que se volvería
// obsoleto apenas cambien los datos.
require("dotenv").config();
const { backlogPrevendedores } = require("../src/tools/backlogPrevendedores");
const { pool } = require("../src/db");

function asegurar(condicion, mensaje) {
  if (!condicion) throw new Error("FALLÓ: " + mensaje);
  console.log("OK:", mensaje);
}

const DIA_INICIO = "2026-09-15";
const DIA_FIN = "2026-09-15";
const DIA_INICIO_TS = "2026-09-15 00:00:00";
const DIA_FIN_EXCLUSIVO_TS = "2026-09-16 00:00:00"; // fecha_fin es inclusiva en el input, exclusiva en SQL

async function totalRealSQL(sellerCode) {
  const { rows } = await pool.query(
    `SELECT count(*) AS total, COALESCE(sum(total), 0) AS dolares
     FROM ordenes
     WHERE type = 2 AND origen_sistema = 'MOBILVENDOR' AND seller_code = $1
       AND fecha_creacion >= $2 AND fecha_creacion < $3
       AND customer_code NOT IN ('8', '9')`,
    [sellerCode, DIA_INICIO_TS, DIA_FIN_EXCLUSIVO_TS]
  );
  return { total: Number(rows[0].total), dolares: Number(rows[0].dolares) };
}

async function main() {
  // 1) T5 y T6 individuales, comparados contra SQL directo.
  for (const rutaReal of ["T5", "T6"]) {
    const real = await totalRealSQL(rutaReal);
    const resultado = await backlogPrevendedores({ ruta: rutaReal, fecha_inicio: DIA_INICIO, fecha_fin: DIA_FIN });
    asegurar(
      resultado.total_ordenes === real.total,
      `${rutaReal} 2026-09-15: total_ordenes (${resultado.total_ordenes}) == SQL directo (${real.total})`
    );
    asegurar(
      Math.abs(resultado.dolares_totales - real.dolares) < 0.01,
      `${rutaReal} 2026-09-15: dolares_totales (${resultado.dolares_totales}) == SQL directo (${real.dolares})`
    );
    // pendientes + avanzadas debe sumar exacto al total.
    asegurar(
      resultado.pendientes.cantidad + resultado.avanzadas.cantidad === resultado.total_ordenes,
      `${rutaReal}: pendientes (${resultado.pendientes.cantidad}) + avanzadas (${resultado.avanzadas.cantidad}) == total_ordenes`
    );
    // por_status debe sumar exacto al total.
    const sumaPorStatus = resultado.por_status.reduce((a, s) => a + s.cantidad, 0);
    asegurar(sumaPorStatus === resultado.total_ordenes, `${rutaReal}: suma de por_status (${sumaPorStatus}) == total_ordenes`);
    // cruce_factura_cliente debe sumar exacto al total.
    const sumaCruce =
      resultado.cruce_factura_cliente.con_factura_posterior.cantidad +
      resultado.cruce_factura_cliente.sin_factura_posterior.cantidad;
    asegurar(sumaCruce === resultado.total_ordenes, `${rutaReal}: suma de cruce_factura_cliente (${sumaCruce}) == total_ordenes`);
  }

  // 2) Array [T5, T6]: por_ruta debe coincidir EXACTO con las llamadas
  //    individuales, y el consolidado debe sumar ambas.
  const individualT5 = await backlogPrevendedores({ ruta: "T5", fecha_inicio: DIA_INICIO, fecha_fin: DIA_FIN });
  const individualT6 = await backlogPrevendedores({ ruta: "T6", fecha_inicio: DIA_INICIO, fecha_fin: DIA_FIN });
  const consolidado = await backlogPrevendedores({ ruta: ["T5", "T6"], fecha_inicio: DIA_INICIO, fecha_fin: DIA_FIN });

  asegurar(
    consolidado.total_ordenes === individualT5.total_ordenes + individualT6.total_ordenes,
    `array [T5,T6]: total_ordenes consolidado (${consolidado.total_ordenes}) == suma de individuales (${individualT5.total_ordenes + individualT6.total_ordenes})`
  );

  const filaT5 = consolidado.por_ruta.find((r) => r.ruta === "T5");
  const filaT6 = consolidado.por_ruta.find((r) => r.ruta === "T6");
  asegurar(!!filaT5 && !!filaT6, "por_ruta trae ambas rutas (T5, T6)");
  asegurar(
    filaT5.total_ordenes === individualT5.total_ordenes && filaT5.pendientes.cantidad === individualT5.pendientes.cantidad,
    `por_ruta[T5] coincide EXACTO con la llamada individual (total=${filaT5.total_ordenes}, pendientes=${filaT5.pendientes.cantidad})`
  );
  asegurar(
    filaT6.total_ordenes === individualT6.total_ordenes && filaT6.pendientes.cantidad === individualT6.pendientes.cantidad,
    `por_ruta[T6] coincide EXACTO con la llamada individual (total=${filaT6.total_ordenes}, pendientes=${filaT6.pendientes.cantidad})`
  );

  // 3) Advertencia de status desactualizado: NO debe aparecer para un rango
  //    reciente (2026-09-15 está dentro de los últimos 10 días del cron
  //    respecto a "hoy" en este entorno), SÍ debe aparecer para un rango
  //    viejo.
  asegurar(
    individualT5.advertencia_status_desactualizado === null,
    "sin advertencia_status_desactualizado para un rango reciente (2026-09-15)"
  );
  const rangoViejo = await backlogPrevendedores({ ruta: "T5", fecha_inicio: "2025-09-01", fecha_fin: "2025-09-02" });
  asegurar(
    typeof rangoViejo.advertencia_status_desactualizado === "string" && rangoViejo.advertencia_status_desactualizado.length > 0,
    "SÍ aparece advertencia_status_desactualizado para un rango viejo (2025-09-01)"
  );

  // 4) Ninguna orden puede tener dolares negativos en pendientes/avanzadas
  //    (serían un bug de agregación, ordenes no tiene notas de crédito).
  asegurar(consolidado.pendientes.dolares >= 0 && consolidado.avanzadas.dolares >= 0, "pendientes/avanzadas no quedan negativos");

  await pool.end();
  console.log("\nBACKLOG PREVENDEDORES REAL TEST OK");
}

main().catch((err) => {
  console.error("\nBACKLOG PREVENDEDORES REAL TEST FALLÓ:", err);
  process.exit(1);
});
