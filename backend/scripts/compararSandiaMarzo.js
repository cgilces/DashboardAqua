// Compara cantidad de SANDIA (product_id=1618) por pedido — Odoo vs lista local.

require("dotenv").config({ path: require("path").resolve(__dirname, "../.env") });
const { object, loginOdoo } = require("../services/odooServicio/odooConexion");

const exec = (params) =>
  new Promise((resolve, reject) => {
    object.methodCall("execute_kw", params, (err, r) => (err ? reject(err) : resolve(r)));
  });

// Cantidades vistas en local (sumando líneas con codigo_producto=1618)
const local = {
  S183375: 24, S183395: 3,  S183396: 1, S184202: 2,
  S184648: 312, S184869: 5, S185065: 4, S185209: 1,
  S185577: 3,  S185858: 0,  S187464: 3, S188380: 1,
  S188982: 6,  S188987: 6,
};

const main = async () => {
  const uid = await loginOdoo();
  const db = process.env.ODOO_DB, key = process.env.ODOO_API_KEY;

  const lines = await exec([
    db, uid, key,
    "sale.order.line", "search_read",
    [[
      ["product_id", "=", 1618],
      ["order_id.state", "in", ["sale", "done"]],
      ["order_id.date_order", ">=", "2026-03-01 00:00:00"],
      ["order_id.date_order", "<",  "2026-04-01 00:00:00"],
    ]],
    { fields: ["order_id", "product_id", "name", "product_uom_qty", "price_total"], limit: 0 }
  ]);

  // Agrupar por orden
  const odoo = {};
  for (const l of lines) {
    const name = l.order_id?.[1];
    if (!odoo[name]) odoo[name] = { qty: 0, lineas: [] };
    odoo[name].qty += Number(l.product_uom_qty || 0);
    odoo[name].lineas.push({
      desc: l.name,
      qty: Number(l.product_uom_qty),
      total: Number(l.price_total),
    });
  }

  console.log("pedido      odoo  local  diff");
  console.log("-".repeat(50));

  const todas = new Set([...Object.keys(odoo), ...Object.keys(local)]);
  let totalOdoo = 0, totalLocal = 0;
  for (const code of [...todas].sort()) {
    const o = odoo[code]?.qty ?? 0;
    const l = local[code] ?? 0;
    totalOdoo += o; totalLocal += l;
    const flag = o !== l ? "  ⚠" : "";
    console.log(code.padEnd(10), String(o).padStart(5), String(l).padStart(5), String(o - l).padStart(5), flag);
    if (o !== l) {
      odoo[code]?.lineas.forEach(L =>
        console.log(`              ↪ "${L.desc}" qty=${L.qty} total=$${L.total.toFixed(2)}`));
    }
  }
  console.log("-".repeat(50));
  console.log("TOTAL    ", String(totalOdoo).padStart(5), String(totalLocal).padStart(5), String(totalOdoo - totalLocal).padStart(5));

  process.exit(0);
};

main().catch(e => { console.error(e); process.exit(1); });
