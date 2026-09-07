// ops/reconciliacion-total/validar_importacion.js
// Corre DENTRO de dashboard_backend. Dos controles pedidos por el usuario
// después de importar un mes con importar_excel_guias.js:
//   1) Magnitud: total DESCARTABLE (waybill_code IS NOT NULL) vs. el total
//      de órdenes PREVENTA crudas del mes (ya reconciliadas contra Odoo) —
//      deben ser del mismo orden de magnitud, no un número disparatado.
//   2) Spot-check: N documentos al azar del Excel con Estado de Despacho=
//      Terminated — confirmar que en `ordenes`, después de importar, tienen
//      waybill_status='3'.
//
// Uso: node validar_importacion.js <ruta_csv> <desde YYYY-MM-DD> <hasta YYYY-MM-DD exclusivo>
require("dotenv").config();
const fs = require("fs");
const fastcsv = require("fast-csv");
const sequelize = require("/app/db");

const COL_INVOICE = 0;
const COL_ESTADO_DESPACHO = 36;

async function leerTerminated(path) {
  return new Promise((resolve, reject) => {
    const terminados = [];
    let esHeader = true;
    fs.createReadStream(path)
      .pipe(fastcsv.parse({ headers: false }))
      .on("error", reject)
      .on("data", (fila) => {
        if (esHeader) { esHeader = false; return; }
        if (fila[COL_ESTADO_DESPACHO] === "Terminated") terminados.push(fila[COL_INVOICE]);
      })
      .on("end", () => resolve([...new Set(terminados)]));
  });
}

function muestraAleatoria(arr, n) {
  const copia = [...arr];
  const out = [];
  for (let i = 0; i < n && copia.length; i++) {
    const idx = Math.floor(Math.random() * copia.length);
    out.push(copia.splice(idx, 1)[0]);
  }
  return out;
}

async function main() {
  const [, , rutaCsv, desde, hasta] = process.argv;
  if (!rutaCsv || !desde || !hasta) {
    console.error("Uso: node validar_importacion.js <csv> <desde> <hasta-exclusivo>");
    process.exit(1);
  }

  // Control 1: magnitud
  const [crudo] = await sequelize.query(
    `SELECT COUNT(*) AS docs, COALESCE(SUM(dd.total),0) AS dolares
     FROM ordenes o JOIN detalle_documento dd ON dd.documento_code = o.code
     WHERE o.type=2 AND o.status=5
       AND (o.seller_code ILIKE 'PV%' OR o.seller_code ILIKE 'PREVENTA%' OR o.seller_code ILIKE 'TELEVENTA%')
       AND o.fecha_entrega >= :desde AND o.fecha_entrega < :hasta`,
    { replacements: { desde, hasta } }
  );
  const [descartable] = await sequelize.query(
    `SELECT COALESCE(SUM(dd.cantidad),0) AS unidades, COALESCE(SUM(dd.total),0) AS dolares, COUNT(DISTINCT o.code) AS docs
     FROM ordenes o JOIN detalle_documento dd ON dd.documento_code = o.code
     WHERE o.type=2 AND o.status=5
       AND (o.seller_code ILIKE 'PV%' OR o.seller_code ILIKE 'PREVENTA%' OR o.seller_code ILIKE 'TELEVENTA%')
       AND o.waybill_code IS NOT NULL
       AND dd.descripcion_categoria='DESCARTABLE'
       AND o.fecha_entrega >= :desde AND o.fecha_entrega < :hasta`,
    { replacements: { desde, hasta } }
  );
  console.log("=== Control 1: magnitud ===");
  console.log(`Órdenes PREVENTA crudas (todas las categorías): ${crudo[0].docs} docs, $${Number(crudo[0].dolares).toFixed(2)}`);
  console.log(`DESCARTABLE (waybill_code no-nulo): ${descartable[0].docs} docs, ${descartable[0].unidades}u, $${Number(descartable[0].dolares).toFixed(2)}`);

  // Control 2: spot-check
  const terminados = await leerTerminated(rutaCsv);
  const muestra = muestraAleatoria(terminados, 8);
  console.log(`\n=== Control 2: spot-check (${muestra.length} de ${terminados.length} documentos "Terminated" en el Excel) ===`);
  const [rows] = await sequelize.query(
    "SELECT code, waybill_code, waybill_status FROM ordenes WHERE code = ANY($1::text[])",
    { bind: [muestra] }
  );
  const dbMap = new Map(rows.map((r) => [r.code, r]));
  let ok = 0, mal = 0;
  for (const code of muestra) {
    const r = dbMap.get(code);
    const correcto = r && r.waybill_status === "3" && r.waybill_code;
    if (correcto) ok++; else mal++;
    console.log(`  ${code}: ${r ? `waybill_code=${r.waybill_code} waybill_status=${r.waybill_status}` : "SIN MATCH"} ${correcto ? "OK" : "❌ REVISAR"}`);
  }
  console.log(`\nResultado spot-check: ${ok} OK / ${mal} con problema.`);

  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
