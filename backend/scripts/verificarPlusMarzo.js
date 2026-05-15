// Script de verificación: trae directo de Odoo los totales de PLUS ELECTROLYTES
// para marzo 2026 y los compara con lo que daría el dashboard.
//
// Uso:
//   node backend/scripts/verificarPlusMarzo.js
//   node backend/scripts/verificarPlusMarzo.js 2026 03         (anio mes)

require("dotenv").config({ path: require("path").resolve(__dirname, "../.env") });
const { object, loginOdoo } = require("../services/odooServicio/odooConexion");

const ANIO = parseInt(process.argv[2] || "2026", 10);
const MES  = parseInt(process.argv[3] || "3",   10);

const fmt2 = (n) => Number(n).toFixed(2);

const start = `${ANIO}-${String(MES).padStart(2, "0")}-01`;
const finMes = new Date(ANIO, MES, 1);
const end   = `${finMes.getFullYear()}-${String(finMes.getMonth() + 1).padStart(2, "0")}-01`;

const PLUS_CODES = ["1725", "1727", "1726", "4011", "1618", "1617", "1619"];
// patrón de respaldo por nombre (por si el default_code en Odoo no coincide)
const PLUS_NAME_PATTERN = "PLUS ELECTROLYTES";

const exec = (params) =>
  new Promise((resolve, reject) => {
    object.methodCall("execute_kw", params, (err, r) => (err ? reject(err) : resolve(r)));
  });

const main = async () => {
  console.log("=".repeat(70));
  console.log(`VERIFICACIÓN PLUS ELECTROLYTES — ${start} a ${end} (no inclusivo)`);
  console.log("=".repeat(70));

  const uid = await loginOdoo();
  console.log(`Login OK — uid=${uid}, db=${process.env.ODOO_DB}\n`);

  // 1) Buscar IDs de productos Plus en Odoo
  const productos = await exec([
    process.env.ODOO_DB, uid, process.env.ODOO_API_KEY,
    "product.product", "search_read",
    [["|",
      ["default_code", "in", PLUS_CODES],
      ["name", "ilike", PLUS_NAME_PATTERN]]],
    { fields: ["id", "default_code", "name"] }
  ]);

  console.log(`Productos PLUS encontrados en Odoo: ${productos.length}`);
  productos.forEach(p => console.log(`   [${p.id}] code=${p.default_code || "-"}  ${p.name}`));
  console.log();

  if (!productos.length) {
    console.log("⚠️ No se encontraron productos Plus en Odoo. Abortando.");
    return;
  }

  const productIds = productos.map(p => p.id);

  // 2) Líneas de sale.order (pedidos) — state=sale/done — en el rango
  console.log("──────────── 1. SALE.ORDER (pedidos) ────────────");
  const saleLines = await exec([
    process.env.ODOO_DB, uid, process.env.ODOO_API_KEY,
    "sale.order.line", "search_read",
    [[
      ["product_id", "in", productIds],
      ["order_id.state", "in", ["sale", "done"]],
      ["order_id.date_order", ">=", `${start} 00:00:00`],
      ["order_id.date_order", "<",  `${end} 00:00:00`],
    ]],
    {
      fields: [
        "id", "order_id", "product_id", "product_uom_qty",
        "price_subtotal", "price_total", "qty_invoiced", "qty_delivered",
      ],
      limit: 0,
    }
  ]);

  const saleTotal = saleLines.reduce((acc, l) => {
    acc.cantidad += Number(l.product_uom_qty || 0);
    acc.subtotal += Number(l.price_subtotal || 0);
    acc.total    += Number(l.price_total    || 0);
    return acc;
  }, { cantidad: 0, subtotal: 0, total: 0 });

  const saleOrders = new Set(saleLines.map(l => l.order_id?.[0]).filter(Boolean));

  console.log(`  Pedidos (distinct order_id) : ${saleOrders.size}`);
  console.log(`  Líneas                       : ${saleLines.length}`);
  console.log(`  Unidades (product_uom_qty)   : ${fmt2(saleTotal.cantidad)}`);
  console.log(`  Subtotal (sin IVA)           : $${fmt2(saleTotal.subtotal)}`);
  console.log(`  Total (con IVA, price_total) : $${fmt2(saleTotal.total)}`);
  console.log();

  // Desglose por producto
  console.log("  Desglose por producto:");
  const byProd = {};
  for (const l of saleLines) {
    const pid = l.product_id?.[0];
    const pname = l.product_id?.[1] || `id=${pid}`;
    if (!byProd[pid]) byProd[pid] = { name: pname, qty: 0, subtotal: 0 };
    byProd[pid].qty      += Number(l.product_uom_qty || 0);
    byProd[pid].subtotal += Number(l.price_subtotal || 0);
  }
  for (const [pid, v] of Object.entries(byProd)) {
    console.log(`    [${pid}] ${v.name.padEnd(55)}  qty=${fmt2(v.qty).padStart(10)}  $${fmt2(v.subtotal).padStart(10)}`);
  }
  console.log();

  // 3) Líneas de account.move (facturas) — state=posted, out_invoice/out_refund
  console.log("──────────── 2. ACCOUNT.MOVE (facturas) ────────────");
  const moveLines = await exec([
    process.env.ODOO_DB, uid, process.env.ODOO_API_KEY,
    "account.move.line", "search_read",
    [[
      ["product_id", "in", productIds],
      ["parent_state", "=", "posted"],
      ["move_id.move_type", "in", ["out_invoice", "out_refund"]],
      ["move_id.invoice_date", ">=", start],
      ["move_id.invoice_date", "<",  end],
      ["display_type", "=", "product"],
    ]],
    {
      fields: [
        "id", "move_id", "product_id", "quantity",
        "price_subtotal", "price_total",
      ],
      limit: 0,
    }
  ]);

  // Identificar refunds para mostrar signo
  const moveIds = [...new Set(moveLines.map(l => l.move_id?.[0]).filter(Boolean))];
  const moves = moveIds.length ? await exec([
    process.env.ODOO_DB, uid, process.env.ODOO_API_KEY,
    "account.move", "search_read",
    [[["id", "in", moveIds]]],
    { fields: ["id", "name", "move_type", "invoice_date", "amount_total"] }
  ]) : [];

  const moveTypeMap = Object.fromEntries(moves.map(m => [m.id, m.move_type]));

  const invTotal = moveLines.reduce((acc, l) => {
    const mt = moveTypeMap[l.move_id?.[0]];
    const sign = mt === "out_refund" ? -1 : 1;
    acc.cantidad += sign * Number(l.quantity || 0);
    acc.subtotal += sign * Number(l.price_subtotal || 0);
    acc.total    += sign * Number(l.price_total    || 0);
    if (mt === "out_invoice") acc.facturas++;
    if (mt === "out_refund")  acc.notCr++;
    return acc;
  }, { cantidad: 0, subtotal: 0, total: 0, facturas: 0, notCr: 0 });

  console.log(`  Facturas distintas (out_invoice) : ${moves.filter(m => m.move_type === "out_invoice").length}`);
  console.log(`  Notas de crédito (out_refund)    : ${moves.filter(m => m.move_type === "out_refund").length}`);
  console.log(`  Líneas (producto)                : ${moveLines.length}`);
  console.log(`  Unidades netas (qty fact - NC)   : ${fmt2(invTotal.cantidad)}`);
  console.log(`  Subtotal neto (sin IVA)          : $${fmt2(invTotal.subtotal)}`);
  console.log(`  Total neto (con IVA)             : $${fmt2(invTotal.total)}`);
  console.log();

  console.log("  Desglose por producto (account.move):");
  const byProdMove = {};
  for (const l of moveLines) {
    const pid = l.product_id?.[0];
    const pname = l.product_id?.[1] || `id=${pid}`;
    const mt = moveTypeMap[l.move_id?.[0]];
    const sign = mt === "out_refund" ? -1 : 1;
    if (!byProdMove[pid]) byProdMove[pid] = { name: pname, qty: 0, subtotal: 0 };
    byProdMove[pid].qty      += sign * Number(l.quantity || 0);
    byProdMove[pid].subtotal += sign * Number(l.price_subtotal || 0);
  }
  for (const [pid, v] of Object.entries(byProdMove)) {
    console.log(`    [${pid}] ${v.name.padEnd(55)}  qty=${fmt2(v.qty).padStart(10)}  $${fmt2(v.subtotal).padStart(10)}`);
  }
  console.log();

  // 4) Resumen
  console.log("=".repeat(70));
  console.log("RESUMEN (lo que debería mostrar el dashboard)");
  console.log("=".repeat(70));
  console.log(`Si el dashboard suma facturas Odoo (account.move):`);
  console.log(`   Unidades : ${fmt2(invTotal.cantidad)}`);
  console.log(`   Dólares  : $${fmt2(invTotal.total)} (con IVA)  /  $${fmt2(invTotal.subtotal)} (sin IVA)`);
  console.log();
  console.log(`Si el dashboard suma pedidos Odoo (sale.order):`);
  console.log(`   Unidades : ${fmt2(saleTotal.cantidad)}`);
  console.log(`   Dólares  : $${fmt2(saleTotal.total)} (con IVA)  /  $${fmt2(saleTotal.subtotal)} (sin IVA)`);
  console.log();
  console.log("⚠️ Si el dashboard suma ORDENES + FACTURAS, está duplicando.");
  console.log("   En Odoo cada venta tiene su sale.order Y su account.move.");
  console.log();

  process.exit(0);
};

main().catch(err => {
  console.error("ERROR:", err);
  process.exit(1);
});
