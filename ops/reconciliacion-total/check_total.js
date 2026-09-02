// ops/reconciliacion-total/check_total.js
// Corre DENTRO del contenedor dashboard_backend (docker cp + docker exec).
//
// La reconciliación usada durante los backfills 2025/2026 (ops/backfill2025/
// reconcile.js) SOLO comparaba un cliente (El Rosado, 110470) contra Odoo.
// Un deadlock de Postgres (ver TODO.md, "Fix del deadlock de Postgres") pudo
// haber perdido documentos de OTROS clientes sin que esa reconciliación
// puntual lo detectara. Este script generaliza el mismo principio (conteo
// local vs Odoo, mismo criterio: facturas.status=2 / account.move state=posted,
// tipo_movimiento out_invoice+out_refund) pero SIN filtro de cliente, y
// DÍA POR DÍA (no solo por mes) para no diluir un desfase puntual en un
// promedio mensual.
//
// Uso: node check_total.js <desde YYYY-MM-DD> <hasta YYYY-MM-DD> <etiqueta>
// Salida: una línea JSON por día + un resumen final. Nunca decide nada por
// su cuenta — solo reporta, para revisión humana.
require("dotenv").config();
const sequelize = require("/app/db");
const { object, loginOdoo } = require("/app/services/odooServicio/odooConexion");

function odooCountDia(uid, fecha) {
  return new Promise((resolve, reject) => {
    object.methodCall(
      "execute_kw",
      [
        process.env.ODOO_DB,
        uid,
        process.env.ODOO_API_KEY,
        "account.move",
        "search_count",
        [[
          ["move_type", "in", ["out_invoice", "out_refund"]],
          ["invoice_date", "=", fecha],
          ["state", "=", "posted"],
        ]],
      ],
      (err, res) => (err ? reject(err) : resolve(res))
    );
  });
}

async function localCountDia(fecha) {
  const [rows] = await sequelize.query(
    `SELECT COUNT(*) AS n FROM facturas WHERE status=2 AND fecha_creacion::date = '${fecha}'`
  );
  return parseInt(rows[0].n, 10);
}

function* diasEnRango(desde, hasta) {
  let d = new Date(`${desde}T00:00:00Z`);
  const fin = new Date(`${hasta}T00:00:00Z`);
  while (d <= fin) {
    yield d.toISOString().slice(0, 10);
    d = new Date(d.getTime() + 86400000);
  }
}

async function main() {
  const [, , desde, hasta, etiqueta] = process.argv;
  if (!desde || !hasta) {
    console.error("Uso: node check_total.js <desde> <hasta> <etiqueta>");
    process.exit(1);
  }

  const uid = await loginOdoo();
  const resultados = [];
  let diasConDesfase = 0;

  for (const fecha of diasEnRango(desde, hasta)) {
    const [local, odoo] = await Promise.all([localCountDia(fecha), odooCountDia(uid, fecha)]);
    const ok = local === odoo;
    if (!ok) diasConDesfase++;
    resultados.push({ fecha, local, odoo, ok });
    console.log(JSON.stringify({ fecha, local, odoo, ok }));
  }

  const totalLocal = resultados.reduce((a, r) => a + r.local, 0);
  const totalOdoo = resultados.reduce((a, r) => a + r.odoo, 0);

  console.log(
    JSON.stringify({
      resumen: etiqueta || `${desde}_${hasta}`,
      desde,
      hasta,
      dias: resultados.length,
      diasConDesfase,
      totalLocal,
      totalOdoo,
      exacto: diasConDesfase === 0,
      diasConProblema: resultados.filter((r) => !r.ok),
    })
  );
  process.exit(0);
}

main().catch((e) => {
  console.error(JSON.stringify({ error: e.message, etiqueta: process.argv[4] }));
  process.exit(1);
});
