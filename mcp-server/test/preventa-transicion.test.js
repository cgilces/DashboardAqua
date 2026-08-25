// test/preventa-transicion.test.js
// filtroPreventa() (src/sql/clasificacion.js) evalúa la regla de transición
// R%/PVR% POR FILA para poder soportar un rango de fechas arbitrario que
// cruce las fronteras de la transición (a diferencia del código original en
// ventasController.js, que decide una sola regla por mes completo).
//
// No hay datos reales en la base para feb-abr 2026 (el sync solo cubre desde
// mediados de julio 2026 en adelante), así que este test NO depende de datos
// de producción: prueba la expresión SQL real generada por filtroPreventa()
// contra filas SINTÉTICAS (un `VALUES` literal, evaluado por el motor real
// de Postgres, no una reimplementación en JS) — cubriendo exactamente las
// fronteras de fecha (2026-03-01, 2026-04-01) y ambos prefijos (R%, PVR%)
// en cada una de las 3 eras.
require("dotenv").config();
const { pool } = require("../src/db");
const { filtroPreventa, PREVENTA_TRANSICION_INICIO, PREVENTA_TRANSICION_FIN } = require("../src/sql/clasificacion");

function asegurar(condicion, mensaje) {
  if (!condicion) throw new Error("FALLÓ: " + mensaje);
  console.log("OK:", mensaje);
}

// Filas sintéticas: 2 por era (una R%, una PVR%) + las fechas EXACTAS de
// frontera (justo antes/después de cada corte) para pescar errores de
// "off by one" en los operadores >=/<.
const FILAS = [
  // --- pre-transición (< 2026-03-01): solo R% (sin PVR%) debe matchear ---
  { fecha: "2026-02-15 00:00:00", seller: "R5",   esperado: true,  era: "pre" },
  { fecha: "2026-02-15 00:00:00", seller: "PVR3", esperado: false, era: "pre" },
  { fecha: "2026-02-28 23:59:59", seller: "R5",   esperado: true,  era: "pre (último instante)" },

  // --- transición [2026-03-01, 2026-04-01): R% Y PVR% deben matchear ---
  { fecha: "2026-03-01 00:00:00", seller: "R5",   esperado: true,  era: "transición (primer instante)" },
  { fecha: "2026-03-01 00:00:00", seller: "PVR3", esperado: true,  era: "transición (primer instante)" },
  { fecha: "2026-03-15 00:00:00", seller: "R5",   esperado: true,  era: "transición" },
  { fecha: "2026-03-15 00:00:00", seller: "PVR3", esperado: true,  era: "transición" },
  { fecha: "2026-03-31 23:59:59", seller: "PVR3", esperado: true,  era: "transición (último instante)" },

  // --- post-transición (>= 2026-04-01): solo PVR% debe matchear ---
  { fecha: "2026-04-01 00:00:00", seller: "R5",   esperado: false, era: "post (primer instante)" },
  { fecha: "2026-04-01 00:00:00", seller: "PVR3", esperado: true,  era: "post (primer instante)" },
  { fecha: "2026-04-15 00:00:00", seller: "PVR3", esperado: true,  era: "post" },
  { fecha: "2026-04-15 00:00:00", seller: "R5",   esperado: false, era: "post" },

  // --- otros prefijos, no deben matchear en ninguna era ---
  { fecha: "2026-03-15 00:00:00", seller: "M3",   esperado: false, era: "transición (prefijo ajeno)" },
];

async function main() {
  console.log(`Fronteras usadas por filtroPreventa: inicio=${PREVENTA_TRANSICION_INICIO}, fin=${PREVENTA_TRANSICION_FIN}`);

  const valuesSql = FILAS.map((_, i) => `($${i * 2 + 1}::timestamp, $${i * 2 + 2}::text)`).join(", ");
  const params = FILAS.flatMap((f) => [f.fecha, f.seller]);

  const sql = `
    SELECT fecha, seller_code, ${filtroPreventa("fecha", "seller_code")} AS matchea
    FROM (VALUES ${valuesSql}) AS t(fecha, seller_code);
  `;
  const { rows } = await pool.query(sql, params);

  asegurar(rows.length === FILAS.length, `la query devolvió ${rows.length} filas (se esperaban ${FILAS.length})`);

  let fallas = 0;
  rows.forEach((r, i) => {
    const esperado = FILAS[i].esperado;
    const ok = r.matchea === esperado;
    if (!ok) fallas++;
    console.log(
      `${ok ? "OK" : "FALLÓ"}: [${FILAS[i].era}] fecha=${FILAS[i].fecha} seller=${FILAS[i].seller} -> matchea=${r.matchea} (esperado ${esperado})`
    );
  });

  if (fallas > 0) throw new Error(`${fallas} caso(s) de la tabla de verdad de PREVENTA fallaron`);

  await pool.end();
  console.log("\nPREVENTA TRANSICIÓN TEST OK — 3 eras + las 4 fronteras exactas verificadas con el motor real de Postgres");
}

main().catch((err) => {
  console.error("\nPREVENTA TRANSICIÓN TEST FALLÓ:", err);
  process.exit(1);
});
