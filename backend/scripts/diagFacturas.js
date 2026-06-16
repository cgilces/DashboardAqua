// scripts/diagFacturas.js
// ════════════════════════════════════════════════════════════════════════════
// DIAGNÓSTICO de facturas puntuales: ¿por qué no salen sus promos en el dashboard?
// Para cada código muestra: si existe la cabecera, fecha_creacion vs fecha_entrega,
// status, y CADA línea de detalle con su promo_code / promo_action_code.
//
// Uso (servidor):
//   node scripts/diagFacturas.js                          → usa la lista por defecto
//   node scripts/diagFacturas.js FA001-081-000004732 FA001-081-000004733 ...
// ════════════════════════════════════════════════════════════════════════════
"use strict";
require("dotenv").config();
const sequelize = require("../db");
const { QueryTypes } = require("sequelize");

const DEFAULT = [
  "FA001-081-000004732","FA001-081-000004733","FA001-081-000004734","FA001-081-000004735",
  "FA001-081-000004736","FA001-081-000004737","FA001-081-000004738","FA001-081-000004739",
  "FA001-081-000004740","FA001-081-000004741","FA001-081-000004742","FA001-081-000004743",
  "FA001-081-000004744","FA001-081-000004746",
];
const codes = process.argv.slice(2).length ? process.argv.slice(2) : DEFAULT;

const fmt = (d) => (d ? new Date(d).toISOString().replace("T", " ").slice(0, 19) : "—(null)");

(async () => {
  try {
    console.log(`\n=== DIAGNÓSTICO de ${codes.length} facturas ===\n`);

    // Cabeceras (facturas y órdenes)
    const cab = await sequelize.query(
      `SELECT code, 'FACTURA' AS tipo, fecha_creacion, fecha_entrega, status, seller_code
         FROM facturas WHERE code IN (:codes)
       UNION ALL
       SELECT code, 'ORDEN' AS tipo, fecha_creacion, fecha_entrega, status, seller_code
         FROM ordenes  WHERE code IN (:codes)`,
      { type: QueryTypes.SELECT, replacements: { codes } }
    );
    const cabPorCode = new Map(cab.map((c) => [c.code, c]));

    // Detalle
    const det = await sequelize.query(
      `SELECT documento_code, codigo_producto, descripcion, cantidad, promo_code, promo_action_code
         FROM detalle_documento
        WHERE documento_code IN (:codes)
        ORDER BY documento_code, id_detalle`,
      { type: QueryTypes.SELECT, replacements: { codes } }
    );
    const detPorCode = new Map();
    det.forEach((d) => {
      if (!detPorCode.has(d.documento_code)) detPorCode.set(d.documento_code, []);
      detPorCode.get(d.documento_code).push(d);
    });

    let sinCabecera = 0, sinDetalle = 0, conPromo = 0, sinPromo = 0;

    for (const code of codes) {
      const c = cabPorCode.get(code);
      const lineas = detPorCode.get(code) || [];
      console.log("────────────────────────────────────────────");
      if (!c) {
        console.log(`❌ ${code}: NO existe la cabecera en facturas/ordenes (no se sincronizó).`);
        sinCabecera++;
      } else {
        console.log(`📄 ${code} | ${c.tipo} | status=${c.status} | vendedor=${c.seller_code}`);
        console.log(`     fecha_creacion = ${fmt(c.fecha_creacion)}`);
        console.log(`     fecha_entrega  = ${fmt(c.fecha_entrega)}`);
      }
      if (lineas.length === 0) {
        console.log(`     ⚠️  SIN líneas de detalle sincronizadas.`);
        sinDetalle++;
      } else {
        lineas.forEach((l) => {
          const promo = l.promo_code && String(l.promo_code).trim();
          if (promo) conPromo++; else sinPromo++;
          console.log(`     · ${l.codigo_producto} ${String(l.descripcion || "").slice(0, 35).padEnd(35)} cant=${l.cantidad}  promo_code=${promo ? l.promo_code : "—(NULL)"}  accion=${l.promo_action_code || "—"}`);
        });
      }
    }

    console.log("\n=== RESUMEN ===");
    console.log(`Facturas sin cabecera : ${sinCabecera}`);
    console.log(`Facturas sin detalle  : ${sinDetalle}`);
    console.log(`Líneas CON promo_code : ${conPromo}`);
    console.log(`Líneas SIN promo_code : ${sinPromo}`);
    console.log("\nInterpretación:");
    console.log(" - Si las líneas tienen promo_code pero fecha_creacion cae OTRO día → es tema de FECHA/horario (el dashboard filtra por fecha_creacion).");
    console.log(" - Si las líneas tienen promo_code=NULL → el sync NO guardó el código de promo (hay que corregir el mapeo del sync).");
    console.log(" - Si no hay cabecera/detalle → no se sincronizó ese documento.\n");
    process.exit(0);
  } catch (err) {
    console.error("❌ Error:", err.message);
    process.exit(1);
  }
})();
