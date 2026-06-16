// scripts/diagPromosFecha.js
// ════════════════════════════════════════════════════════════════════════════
// DIAGNÓSTICO: ¿por qué faltan promociones en /dashboard/promociones para una
// fecha? Compara qué promos salen según el campo de fecha que usa el reporte
// (fecha_creacion) vs fecha_entrega, y detecta líneas con promo sin promo_code
// o documentos huérfanos (detalle sin cabecera).
//
// Uso (en el servidor):
//   node scripts/diagPromosFecha.js                 → 2026-06-01 (un día)
//   node scripts/diagPromosFecha.js 2026-06-01 2026-06-02
//   (inicio inclusive, fin EXCLUSIVO)
// ════════════════════════════════════════════════════════════════════════════
"use strict";
require("dotenv").config();
const sequelize = require("../db");
const { QueryTypes } = require("sequelize");

const ini = process.argv[2] || "2026-06-01";
const fin = process.argv[3] || (() => {
  const d = new Date(`${ini}T00:00:00`);
  d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
})();

const q = (sql) => sequelize.query(sql, { type: QueryTypes.SELECT, replacements: { ini, fin } });

const promosPorCampo = (campoFecha) => `
  SELECT d.promo_code AS promo,
         COUNT(*)                AS lineas,
         COUNT(DISTINCT d.documento_code) AS docs,
         ROUND(SUM(COALESCE(d.cantidad,0))::numeric, 2) AS cantidad
  FROM detalle_documento d
  LEFT JOIN facturas f ON f.code = d.documento_code
  LEFT JOIN ordenes  o ON o.code = d.documento_code
  WHERE d.promo_code IS NOT NULL AND TRIM(d.promo_code) <> ''
    AND COALESCE(f.${campoFecha}, o.${campoFecha}) >= :ini
    AND COALESCE(f.${campoFecha}, o.${campoFecha}) <  :fin
  GROUP BY d.promo_code
  ORDER BY d.promo_code
`;

(async () => {
  try {
    console.log(`\n=== DIAGNÓSTICO PROMOS  ${ini}  →  ${fin} (fin exclusivo) ===\n`);

    const porCreacion = await q(promosPorCampo("fecha_creacion"));
    const porEntrega  = await q(promosPorCampo("fecha_entrega"));

    const setCre = new Set(porCreacion.map((r) => r.promo));
    const setEnt = new Set(porEntrega.map((r) => r.promo));

    console.log(`▶ Promos según FECHA_CREACION (lo que usa el dashboard): ${porCreacion.length}`);
    porCreacion.forEach((r) => console.log(`   ${r.promo}  | líneas=${r.lineas} docs=${r.docs} cant=${r.cantidad}`));

    console.log(`\n▶ Promos según FECHA_ENTREGA: ${porEntrega.length}`);
    porEntrega.forEach((r) => console.log(`   ${r.promo}  | líneas=${r.lineas} docs=${r.docs} cant=${r.cantidad}`));

    const soloEntrega = porEntrega.filter((r) => !setCre.has(r.promo));
    const soloCreacion = porCreacion.filter((r) => !setEnt.has(r.promo));
    console.log(`\n▶ Promos que SALEN por fecha_entrega pero NO por fecha_creacion (posibles faltantes): ${soloEntrega.length}`);
    soloEntrega.forEach((r) => console.log(`   ⚠️  ${r.promo}  | líneas=${r.lineas} cant=${r.cantidad}`));
    console.log(`\n▶ Promos que salen por fecha_creacion pero NO por fecha_entrega: ${soloCreacion.length}`);
    soloCreacion.forEach((r) => console.log(`   ${r.promo}  | líneas=${r.lineas} cant=${r.cantidad}`));

    // Líneas en el día (por fecha_creacion) con vs sin promo_code
    const [tot] = await q(`
      SELECT
        COUNT(*) FILTER (WHERE d.promo_code IS NOT NULL AND TRIM(d.promo_code)<>'') AS con_promo,
        COUNT(*) FILTER (WHERE d.promo_code IS NULL OR TRIM(d.promo_code)='')        AS sin_promo,
        COUNT(*) AS total
      FROM detalle_documento d
      LEFT JOIN facturas f ON f.code = d.documento_code
      LEFT JOIN ordenes  o ON o.code = d.documento_code
      WHERE COALESCE(f.fecha_creacion, o.fecha_creacion) >= :ini
        AND COALESCE(f.fecha_creacion, o.fecha_creacion) <  :fin
    `);
    console.log(`\n▶ Líneas de detalle ese día (por fecha_creacion): total=${tot.total} | con promo=${tot.con_promo} | sin promo=${tot.sin_promo}`);

    // Detalle con promo pero SIN cabecera (huérfano → el reporte lo excluye porque la fecha queda NULL)
    const [huerf] = await q(`
      SELECT COUNT(*) AS lineas
      FROM detalle_documento d
      LEFT JOIN facturas f ON f.code = d.documento_code
      LEFT JOIN ordenes  o ON o.code = d.documento_code
      WHERE d.promo_code IS NOT NULL AND TRIM(d.promo_code) <> ''
        AND f.code IS NULL AND o.code IS NULL
    `);
    console.log(`\n▶ Líneas con promo SIN cabecera (factura/orden) en TODA la BD: ${huerf.lineas}  (estas nunca salen en el reporte)`);

    console.log("\n=== FIN DIAGNÓSTICO ===\n");
    process.exit(0);
  } catch (err) {
    console.error("❌ Error en diagnóstico:", err.message);
    process.exit(1);
  }
})();
