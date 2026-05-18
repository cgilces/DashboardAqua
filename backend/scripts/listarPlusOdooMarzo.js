// Lista los pedidos sale.order de PLUS ELECTROLYTES de marzo 2026
// con su nombre (S-XXXX) para poder compararlos uno a uno contra
// la tabla 'ordenes' local.

require("dotenv").config({ path: require("path").resolve(__dirname, "../.env") });
const { object, loginOdoo } = require("../services/odooServicio/odooConexion");

const exec = (params) =>
  new Promise((resolve, reject) => {
    object.methodCall("execute_kw", params, (err, r) => (err ? reject(err) : resolve(r)));
  });

const main = async () => {
  const uid = await loginOdoo();
  const db = process.env.ODOO_DB;
  const key = process.env.ODOO_API_KEY;

  const productos = await exec([
    db, uid, key,
    "product.product", "search_read",
    [[["name", "ilike", "PLUS ELECTROLYTES"]]],
    { fields: ["id", "default_code", "name"] }
  ]);
  const productIds = productos.map(p => p.id);

  // Pedidos de marzo con líneas Plus
  const lines = await exec([
    db, uid, key,
    "sale.order.line", "search_read",
    [[
      ["product_id", "in", productIds],
      ["order_id.state", "in", ["sale", "done"]],
      ["order_id.date_order", ">=", "2026-03-01 00:00:00"],
      ["order_id.date_order", "<",  "2026-04-01 00:00:00"],
    ]],
    { fields: ["order_id", "product_id", "product_uom_qty", "price_total"], limit: 0 }
  ]);

  // Agrupar por orden
  const byOrder = {};
  for (const l of lines) {
    const oname = l.order_id?.[1];
    const oid = l.order_id?.[0];
    if (!byOrder[oname]) byOrder[oname] = { oid, lineas: [], total: 0, qty: 0 };
    byOrder[oname].lineas.push({
      pid: l.product_id?.[0],
      pname: l.product_id?.[1],
      qty: l.product_uom_qty,
      total: l.price_total,
    });
    byOrder[oname].total += Number(l.price_total || 0);
    byOrder[oname].qty   += Number(l.product_uom_qty || 0);
  }

  console.log(`Total pedidos Plus marzo: ${Object.keys(byOrder).length}\n`);
  console.log("orden_name              total      uni  productos_plus");
  console.log("-".repeat(80));

  const rows = Object.entries(byOrder)
    .sort((a, b) => b[1].total - a[1].total);

  for (const [name, info] of rows) {
    const pids = info.lineas.map(l => l.pid).join(",");
    console.log(
      name.padEnd(22),
      `$${info.total.toFixed(2)}`.padStart(10),
      String(info.qty).padStart(5),
      ` [${pids}]`
    );
  }

  console.log(`\nIDs Odoo de productos Plus que aparecen en marzo:`);
  const uniqPids = [...new Set(lines.map(l => l.product_id?.[0]))].sort((a, b) => a - b);
  console.log(uniqPids.join(", "));

  process.exit(0);
};

main().catch(e => { console.error(e); process.exit(1); });
