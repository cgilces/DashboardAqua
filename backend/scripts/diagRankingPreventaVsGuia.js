// scripts/diagRankingPreventaVsGuia.js
// ════════════════════════════════════════════════════════════════════════════
// Diagnóstico: el RANKING PREVENTA del dashboard "no cuadra" con la GUÍA DE
// ENTREGA (status terminado) de MobilVendor.
//
// El ranking actual (calcularKPIsMes en ventasController.js) suma así:
//     o.type = 2  AND  o.status = 5
//     seller_code ILIKE 'PV%'/'PREVENTA%'/'TELEVENTA%'  AND  NOT ILIKE 'PVR%'
//     SUM(dd.total)            ← CON IVA
//     SIN filtro de categoría  ← incluye TODAS las líneas (no solo descartable '7')
//     rango por o.fecha_entrega
//
// Este script imprime, por ruta, VARIOS candidatos de suma para el mismo mes,
// así puedes comparar contra la guía de entrega y decir cuál cuadra:
//   A) total c/IVA  · todas las categorías      (= ranking actual)
//   B) subtotal s/IVA · todas las categorías
//   C) total c/IVA  · solo categoría '7'
//   D) subtotal s/IVA · solo categoría '7'
//   E) total c/IVA  · todas las cat · EXCLUYE anticipo/envío
// Además: desglose por status (para confirmar qué status = "terminado").
//
// Uso (server):  node scripts/diagRankingPreventaVsGuia.js [anio] [mes]
//                node scripts/diagRankingPreventaVsGuia.js 2026 6   (def: 2026-06)
// ════════════════════════════════════════════════════════════════════════════
"use strict";
require("dotenv").config();
const sequelize = require("../db");
const { QueryTypes } = require("sequelize");

const anio = Number(process.argv[2]) || 2026;
const mes  = Number(process.argv[3]) || 6;
const inicio = `${anio}-${String(mes).padStart(2, "0")}-01 00:00:00`;
const fin = mes === 12
  ? `${anio + 1}-01-01 00:00:00`
  : `${anio}-${String(mes + 1).padStart(2, "0")}-01 00:00:00`;

const q = (sql) => sequelize.query(sql, { type: QueryTypes.SELECT, replacements: { inicio, fin } });

// Mismo universo de rutas que el ranking preventa del dashboard.
const SELLER_FILTER = `
  (o.seller_code ILIKE 'PV%' OR o.seller_code ILIKE 'PREVENTA%' OR o.seller_code ILIKE 'TELEVENTA%')
  AND o.seller_code NOT ILIKE 'PVR%'
`;

const money = (n) => "$" + Number(n || 0).toLocaleString("es-EC", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const pad   = (s, n) => String(s).padEnd(n);
const padL  = (s, n) => String(s).padStart(n);

(async () => {
  try {
    console.log(`\n=== RANKING PREVENTA — candidatos de suma — ${inicio} → ${fin} (fin exclusivo) ===`);
    console.log(`Filtro rutas: PV%/PREVENTA%/TELEVENTA% (excl. PVR%) · type=2 · status=5 · por fecha_entrega\n`);

    // ── Candidatos A..E por ruta (status=5, fecha_entrega) ───────────────────
    const candidatos = await q(`
      SELECT
        o.seller_code AS ruta,
        SUM(dd.cantidad)                                              AS unidades,
        SUM(dd.total)                                                 AS a_total_ivat_todas,
        SUM(dd.subtotal)                                              AS b_subtotal_todas,
        SUM(CASE WHEN dd.codigo_categoria = '7' THEN dd.total    ELSE 0 END) AS c_total_cat7,
        SUM(CASE WHEN dd.codigo_categoria = '7' THEN dd.subtotal ELSE 0 END) AS d_subtotal_cat7,
        SUM(CASE WHEN COALESCE(dd.es_anticipo,false)=false AND COALESCE(dd.es_envio,false)=false
                 THEN dd.total ELSE 0 END)                            AS e_total_sin_anticipo_envio,
        COUNT(DISTINCT o.code)                                        AS docs
      FROM ordenes o
      JOIN detalle_documento dd ON dd.documento_code = o.code
      WHERE o.type = 2 AND o.status = 5
        AND ${SELLER_FILTER}
        AND o.fecha_entrega >= :inicio AND o.fecha_entrega < :fin
      GROUP BY o.seller_code
      ORDER BY o.seller_code
    `);

    console.log("RUTA".padEnd(14) +
      padL("A total c/IVA", 16) + padL("B subtot s/IVA", 16) +
      padL("C total cat7", 16) + padL("D subt cat7", 16) +
      padL("E sin ant/env", 16) + padL("docs", 7));
    console.log("-".repeat(14 + 16 * 5 + 7));

    const tot = { a: 0, b: 0, c: 0, d: 0, e: 0, u: 0, docs: 0 };
    for (const r of candidatos) {
      tot.a += Number(r.a_total_ivat_todas); tot.b += Number(r.b_subtotal_todas);
      tot.c += Number(r.c_total_cat7);       tot.d += Number(r.d_subtotal_cat7);
      tot.e += Number(r.e_total_sin_anticipo_envio);
      tot.u += Number(r.unidades);           tot.docs += Number(r.docs);
      console.log(
        pad(r.ruta, 14) +
        padL(money(r.a_total_ivat_todas), 16) +
        padL(money(r.b_subtotal_todas), 16) +
        padL(money(r.c_total_cat7), 16) +
        padL(money(r.d_subtotal_cat7), 16) +
        padL(money(r.e_total_sin_anticipo_envio), 16) +
        padL(r.docs, 7)
      );
    }
    console.log("-".repeat(14 + 16 * 5 + 7));
    console.log(
      pad("TOTAL", 14) +
      padL(money(tot.a), 16) + padL(money(tot.b), 16) +
      padL(money(tot.c), 16) + padL(money(tot.d), 16) +
      padL(money(tot.e), 16) + padL(tot.docs, 7)
    );
    console.log(`\nA = ranking ACTUAL del dashboard (debería = $ que ves hoy en pantalla).`);
    console.log(`Unidades totales (status=5): ${tot.u.toLocaleString("es-EC")}\n`);

    // ── Desglose por status (¿cuál status = "terminado"?) ────────────────────
    const porStatus = await q(`
      SELECT o.status,
             COUNT(DISTINCT o.code) AS docs,
             SUM(dd.cantidad)       AS unidades,
             SUM(dd.total)          AS total_ivat,
             SUM(dd.subtotal)       AS subtotal
      FROM ordenes o
      JOIN detalle_documento dd ON dd.documento_code = o.code
      WHERE o.type = 2
        AND ${SELLER_FILTER}
        AND o.fecha_entrega >= :inicio AND o.fecha_entrega < :fin
      GROUP BY o.status
      ORDER BY o.status
    `);
    console.log(`=== DESGLOSE POR STATUS (type=2, rutas preventa, por fecha_entrega) ===`);
    console.log("status".padEnd(8) + padL("docs", 8) + padL("unidades", 12) + padL("total c/IVA", 16) + padL("subtotal", 16));
    console.log("-".repeat(60));
    for (const r of porStatus) {
      console.log(
        pad(r.status, 8) + padL(r.docs, 8) + padL(Number(r.unidades).toLocaleString("es-EC"), 12) +
        padL(money(r.total_ivat), 16) + padL(money(r.subtotal), 16)
      );
    }

    console.log(`\n👉 Compara la columna que cuadre con tu GUÍA DE ENTREGA (status terminado) y avísame`);
    console.log(`   cuál (A/B/C/D/E) y qué status corresponde a "terminado". Con eso ajusto el query.\n`);
    process.exit(0);
  } catch (err) {
    console.error("❌ Error:", err.message);
    process.exit(1);
  }
})();
