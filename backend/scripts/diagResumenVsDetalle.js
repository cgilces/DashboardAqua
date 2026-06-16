// scripts/diagResumenVsDetalle.js
// ════════════════════════════════════════════════════════════════════════════
// Verifica que los VALORES del "Resumen" (ranking de promos) cuadren con la
// suma del "Reporte detallado" (línea por línea), para un mes. Ambos usan la
// misma fuente; este script lo confirma y marca cualquier descuadre.
//
// Uso (servidor):  node scripts/diagResumenVsDetalle.js [anio] [mes]
//                  node scripts/diagResumenVsDetalle.js 2026 6   (def: 2026-06)
// ════════════════════════════════════════════════════════════════════════════
"use strict";
require("dotenv").config();
const sequelize = require("../db");
const { QueryTypes } = require("sequelize");

const anio = Number(process.argv[2]) || 2026;
const mes = Number(process.argv[3]) || 6;
const inicio = `${anio}-${String(mes).padStart(2, "0")}-01`;
const fin = mes === 12 ? `${anio + 1}-01-01` : `${anio}-${String(mes + 1).padStart(2, "0")}-01`;

const q = (sql) => sequelize.query(sql, { type: QueryTypes.SELECT, replacements: { inicio, fin } });

// Mismo filtro que el dashboard y el reporte detallado.
const BASE = `
  FROM detalle_documento d
  LEFT JOIN facturas f ON f.code = d.documento_code
  LEFT JOIN ordenes  o ON o.code = d.documento_code
  WHERE d.promo_code IS NOT NULL AND TRIM(d.promo_code) <> ''
    AND COALESCE(f.fecha_creacion, o.fecha_creacion) >= :inicio
    AND COALESCE(f.fecha_creacion, o.fecha_creacion) <  :fin
`;

(async () => {
  try {
    console.log(`\n=== RESUMEN vs DETALLE — ${inicio} → ${fin} (fin exclusivo) ===\n`);

    // RESUMEN (ranking general): por promo
    const resumen = await q(`
      SELECT d.promo_code AS promo,
             COUNT(DISTINCT d.documento_code) AS veces,
             ROUND(SUM(COALESCE(d.cantidad,0))::numeric,2) AS unidades,
             ROUND(SUM(COALESCE(d.total,0))::numeric,2)    AS monto,
             ROUND(SUM(COALESCE(d.descuento_linea,0))::numeric,2) AS descuento
      ${BASE}
      GROUP BY d.promo_code ORDER BY d.promo_code
    `);

    // DETALLE (línea por línea): por promo
    const detalle = await q(`
      SELECT d.promo_code AS promo,
             COUNT(*)                                       AS lineas,
             ROUND(SUM(COALESCE(d.cantidad,0))::numeric,2)  AS cantidad
      ${BASE}
      GROUP BY d.promo_code ORDER BY d.promo_code
    `);
    const detMap = new Map(detalle.map((r) => [r.promo, r]));

    console.log("PROMO".padEnd(16), "RESUMEN.unid", "DETALLE.cant", "  ¿IGUAL?");
    let descuadres = 0;
    for (const r of resumen) {
      const det = detMap.get(r.promo) || { cantidad: 0 };
      const igual = Number(r.unidades) === Number(det.cantidad);
      if (!igual) descuadres++;
      console.log(
        String(r.promo).padEnd(16),
        String(r.unidades).padStart(11),
        String(det.cantidad).padStart(12),
        igual ? "   OK" : "   ❌ DESCUADRE"
      );
    }

    const totR = resumen.reduce((a, r) => a + Number(r.unidades), 0);
    const totD = detalle.reduce((a, r) => a + Number(r.cantidad), 0);
    console.log("\n── TOTALES ──");
    console.log(`Unidades RESUMEN (suma ranking): ${totR.toFixed(2)}`);
    console.log(`Cantidad DETALLE (suma líneas) : ${totD.toFixed(2)}`);
    console.log(`Promos con descuadre: ${descuadres}`);
    console.log(descuadres === 0
      ? "\n✅ Los valores del Resumen cuadran con el detalle (misma fuente)."
      : "\n❌ Hay descuadres — revisar.");
    process.exit(0);
  } catch (err) {
    console.error("❌ Error:", err.message);
    process.exit(1);
  }
})();
