// scripts/probePromoGift.js
// ════════════════════════════════════════════════════════════════════════════
// DIAGNÓSTICO (solo lectura): ¿cómo se graba el "+1 gratis" de una promo 5+1
// en las líneas de venta (detalle_documento)?
//
// Objetivo: saber si la unidad regalada es...
//   (A) una LÍNEA APARTE con total/precio = 0, o
//   (B) la MISMA LÍNEA con un descuento_linea = valor del regalo.
//
// No modifica nada. Solo hace SELECT y vuelca muestras.
//
// Uso:
//   cd backend
//   node scripts/probePromoGift.js              # auto-detecta una promo candidata
//   node scripts/probePromoGift.js DESC5MAS1     # fuerza un promo_code específico
// ════════════════════════════════════════════════════════════════════════════
"use strict";

require("dotenv").config();
const { QueryTypes } = require("sequelize");
const sequelize = require("../db");

const promoArg = (process.argv[2] || "").trim();

const q = (sql, replacements = {}) =>
  sequelize.query(sql, { type: QueryTypes.SELECT, replacements });

(async () => {
  try {
    // 1) Resumen por promo: cómo se ven sus líneas (lleno de pistas A vs B)
    console.log("\n══════════ RESUMEN POR PROMO (top 25 por nº de líneas) ══════════");
    const resumen = await q(`
      SELECT
        d.promo_code                                              AS promo,
        COUNT(*)                                                  AS lineas,
        SUM(CASE WHEN COALESCE(d.total,0)   = 0 THEN 1 ELSE 0 END) AS lineas_total0,
        SUM(CASE WHEN COALESCE(d.precio,0)  = 0 THEN 1 ELSE 0 END) AS lineas_precio0,
        SUM(CASE WHEN COALESCE(d.descuento_linea,0) > 0 THEN 1 ELSE 0 END) AS lineas_con_desc,
        ROUND(SUM(COALESCE(d.cantidad,0)), 2)                     AS cant_total,
        ROUND(SUM(CASE WHEN COALESCE(d.total,0) = 0 THEN COALESCE(d.cantidad,0) ELSE 0 END), 2) AS cant_en_lineas_total0,
        COUNT(DISTINCT d.promo_action_code)                       AS action_codes_distintos
      FROM detalle_documento d
      WHERE d.promo_code IS NOT NULL AND TRIM(d.promo_code) <> ''
      GROUP BY d.promo_code
      ORDER BY lineas DESC
      LIMIT 25
    `);
    console.table(resumen);

    // 2) Elegir promo objetivo: la pasada por arg, o la que más líneas a $0 tenga
    //    (mejor candidata a un esquema "regalo = línea aparte"). Si ninguna tiene
    //    líneas a $0, caemos a la de más líneas con descuento.
    let target = promoArg;
    if (!target) {
      const conRegalo = resumen.find((r) => Number(r.cant_en_lineas_total0) > 0);
      const conDesc = resumen.find((r) => Number(r.lineas_con_desc) > 0);
      target = (conRegalo || conDesc || resumen[0] || {}).promo;
    }
    if (!target) {
      console.log("\n⚠️  No hay líneas con promo en la BD. ¿Ya sincronizaste un período con promos?");
      process.exit(0);
    }
    console.log(`\n══════════ PROMO OBJETIVO: ${target} ══════════`);

    // 3) Definición / acción de la promo (gift, discount_type) — confirma si es 5+1
    const acciones = await q(
      `SELECT action, discount, discount_type, price_value, gift, gift_base
         FROM promo_actions WHERE promo_code = :p`,
      { p: target }
    );
    console.log("\n── promo_actions ──");
    console.log(JSON.stringify(acciones, null, 2));

    const condiciones = await q(
      `SELECT condition, quantity_condition, quantity1, quantity2
         FROM promo_conditions WHERE promo_code = :p`,
      { p: target }
    );
    console.log("\n── promo_conditions ──");
    console.log(JSON.stringify(condiciones, null, 2));

    // 4) Buscar un documento que tenga ESA promo y volcar TODAS sus líneas de esa
    //    promo (incluidas las $0). Así se ve si el regalo es línea aparte o no.
    const docs = await q(
      `SELECT d.documento_code,
              COUNT(*) AS lineas,
              SUM(CASE WHEN COALESCE(d.total,0)=0 THEN 1 ELSE 0 END) AS lineas_total0
         FROM detalle_documento d
        WHERE d.promo_code = :p
        GROUP BY d.documento_code
        ORDER BY lineas_total0 DESC, lineas DESC
        LIMIT 3`,
      { p: target }
    );
    console.log(`\n── 3 documentos de ejemplo con la promo ${target} ──`);
    console.table(docs);

    for (const doc of docs) {
      console.log(`\n──────── LÍNEAS del documento ${doc.documento_code} (promo ${target}) ────────`);
      const lineas = await q(
        `SELECT id_detalle, codigo_producto, LEFT(descripcion, 38) AS descripcion,
                cantidad, precio, subtotal, descuento_linea, total,
                promo_code, promo_action_code, unit_alias, unidad_medida
           FROM detalle_documento
          WHERE documento_code = :doc
          ORDER BY id_detalle`,
        { doc: doc.documento_code }
      );
      console.table(lineas);
    }

    console.log("\n✅ Diagnóstico terminado. Pégame TODO lo de arriba.");
    process.exit(0);
  } catch (err) {
    console.error("\n❌ Falló el diagnóstico:", err.message);
    process.exit(1);
  }
})();
