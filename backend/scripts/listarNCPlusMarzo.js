// Lista TODAS las notas de crédito (out_refund) con productos Plus de marzo 2026 en Odoo.

require("dotenv").config({ path: require("path").resolve(__dirname, "../.env") });
const { object, loginOdoo } = require("../services/odooServicio/odooConexion");

const exec = (params) =>
  new Promise((resolve, reject) => {
    object.methodCall("execute_kw", params, (err, r) => (err ? reject(err) : resolve(r)));
  });

const main = async () => {
  const uid = await loginOdoo();
  const db = process.env.ODOO_DB, key = process.env.ODOO_API_KEY;

  const productos = await exec([
    db, uid, key, "product.product", "search_read",
    [[["name", "ilike", "PLUS ELECTROLYTES"]]],
    { fields: ["id"] }
  ]);
  const productIds = productos.map(p => p.id);

  const lines = await exec([
    db, uid, key, "account.move.line", "search_read",
    [[
      ["product_id", "in", productIds],
      ["move_id.move_type", "=", "out_refund"],
      ["parent_state", "=", "posted"],
      ["move_id.invoice_date", ">=", "2026-03-01"],
      ["move_id.invoice_date", "<",  "2026-04-01"],
      ["display_type", "=", "product"],
    ]],
    { fields: ["move_id", "product_id", "quantity", "price_total"], limit: 0 }
  ]);

  const moveIds = [...new Set(lines.map(l => l.move_id?.[0]))];
  const moves = await exec([
    db, uid, key, "account.move", "search_read",
    [[["id", "in", moveIds]]],
    { fields: ["id", "name", "invoice_date", "partner_id", "amount_total", "reversed_entry_id"] }
  ]);

  console.log(`Total NC con productos Plus en marzo: ${moves.length}\n`);
  console.log("NC name        fecha       partner                              monto");
  console.log("-".repeat(90));

  for (const m of moves.sort((a, b) => (a.invoice_date || '').localeCompare(b.invoice_date || ''))) {
    const ls = lines.filter(l => l.move_id?.[0] === m.id);
    const tot = ls.reduce((a, l) => a + Number(l.price_total || 0), 0);
    const qty = ls.reduce((a, l) => a + Number(l.quantity || 0), 0);
    console.log(
      (m.name || '?').padEnd(15),
      (m.invoice_date || '').padEnd(11),
      (m.partner_id?.[1] || '').padEnd(38).slice(0, 38),
      `$${tot.toFixed(2)} (${qty} uni)`
    );
    ls.forEach(l => console.log(
      `              ↪ [${l.product_id?.[0]}] ${l.product_id?.[1] || ''} qty=${l.quantity} total=$${Number(l.price_total).toFixed(2)}`
    ));
  }

  process.exit(0);
};

main().catch(e => { console.error(e); process.exit(1); });
