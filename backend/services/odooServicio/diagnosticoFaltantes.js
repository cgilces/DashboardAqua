// Diagnóstico: busca en Odoo los 2 NotCr que no aparecen en la BD
// Uso: node backend/services/odooServicio/diagnosticoFaltantes.js
const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "../../.env") });

if (!process.env.ODOO_URL || !process.env.ODOO_DB || !process.env.ODOO_USER || !process.env.ODOO_API_KEY) {
  console.error("❌ Faltan variables en .env (ODOO_URL, ODOO_DB, ODOO_USER, ODOO_API_KEY).");
  console.error("   Revisado:", path.resolve(__dirname, "../../.env"));
  process.exit(1);
}

const { object, loginOdoo } = require("./odooConexion");

const odooExecute = (params) =>
  new Promise((resolve, reject) => {
    object.methodCall("execute_kw", params, (err, result) => {
      if (err) return reject(err);
      resolve(result);
    });
  });

const NOMBRES_FALTANTES = [
  "NotCr 001-027-000000928",
  "NotCr 001-027-000000926",
];

(async () => {
  try {
    const uid = await loginOdoo();
    console.log("🔐 UID:", uid);

    // 1) Buscar por name en account.move SIN filtro de fecha ni move_type
    console.log("\n── Buscando por name en account.move ──────────────");
    const docs = await odooExecute([
      process.env.ODOO_DB, uid, process.env.ODOO_API_KEY,
      "account.move", "search_read",
      [[["name", "in", NOMBRES_FALTANTES]]],
      {
        fields: [
          "id", "name", "move_type", "state",
          "payment_state", "invoice_date", "date",
          "create_date", "write_date",
          "partner_id", "invoice_user_id", "team_id",
          "company_id", "amount_total", "amount_residual",
          "reversed_entry_id", "invoice_origin",
          "l10n_ec_authorization_number",
        ],
      },
    ]);

    if (!docs.length) {
      console.log("❌ Odoo NO encontró ningún documento con esos nombres.");
      console.log("   → No existen como tal en Odoo, o están en otra BD/empresa.");
    } else {
      console.log(`✅ Encontrados ${docs.length}:\n`);
      docs.forEach(d => {
        console.log(`   • ${d.name}`);
        console.log(`     id              : ${d.id}`);
        console.log(`     move_type       : ${d.move_type}`);
        console.log(`     state           : ${d.state}`);
        console.log(`     payment_state   : ${d.payment_state}`);
        console.log(`     invoice_date    : ${d.invoice_date}`);
        console.log(`     date            : ${d.date}`);
        console.log(`     create_date     : ${d.create_date}`);
        console.log(`     write_date      : ${d.write_date}`);
        console.log(`     company_id      : ${JSON.stringify(d.company_id)}`);
        console.log(`     partner_id      : ${JSON.stringify(d.partner_id)}`);
        console.log(`     invoice_user_id : ${JSON.stringify(d.invoice_user_id)}`);
        console.log(`     team_id         : ${JSON.stringify(d.team_id)}`);
        console.log(`     amount_total    : ${d.amount_total}`);
        console.log(`     reversed_entry  : ${JSON.stringify(d.reversed_entry_id)}`);
        console.log(`     invoice_origin  : ${d.invoice_origin}`);
        console.log(`     auth_number     : ${d.l10n_ec_authorization_number}`);
        console.log("");
      });
    }

    // 2) Probar el filtro EXACTO que usa el sync
    console.log("── Probando filtro del sync (out_refund + invoice_date marzo) ──");
    const docsConFiltro = await odooExecute([
      process.env.ODOO_DB, uid, process.env.ODOO_API_KEY,
      "account.move", "search_read",
      [[
        ["move_type", "in", ["out_invoice", "out_refund"]],
        ["invoice_date", ">=", "2026-03-01"],
        ["invoice_date", "<=", "2026-04-01"],
        ["name", "in", NOMBRES_FALTANTES],
      ]],
      { fields: ["id", "name", "state", "invoice_date"] },
    ]);

    console.log(`   El filtro del sync devuelve ${docsConFiltro.length} de los 2 buscados:`);
    docsConFiltro.forEach(d => console.log(`   • ${d.name} (${d.state}, ${d.invoice_date})`));

    if (docsConFiltro.length < 2 && docs.length === 2) {
      console.log("\n⚠️  Los documentos EXISTEN en Odoo pero el filtro del sync los excluye.");
      console.log("   Compara los campos arriba con el rango del sync para identificar la causa.");
    }

    // 3) Buscar por nombre PARCIAL (puede tener un formato distinto)
    console.log("\n── Búsqueda parcial por número (ilike '000000928' / '000000926') ──");
    const docsParciales = await odooExecute([
      process.env.ODOO_DB, uid, process.env.ODOO_API_KEY,
      "account.move", "search_read",
      [[
        "|", "|", "|",
        ["name", "ilike", "000000928"],
        ["name", "ilike", "000000926"],
        ["ref", "ilike", "000000928"],
        ["ref", "ilike", "000000926"],
      ]],
      {
        fields: ["id", "name", "ref", "move_type", "state", "company_id", "invoice_date", "amount_total", "partner_id"],
        limit: 30,
      },
    ]);
    console.log(`   ${docsParciales.length} resultados:`);
    docsParciales.forEach(d => {
      console.log(`   • [${d.id}] name="${d.name}" ref="${d.ref}" type=${d.move_type} state=${d.state} co=${JSON.stringify(d.company_id)} fecha=${d.invoice_date} total=${d.amount_total}`);
    });

    // 3b) Verificación: ¿esta conexión puede ver una NotCr COTTSA que SÍ está en la BD?
    console.log("\n── Verificación: buscar NotCr 001-027-000000927 (esta SÍ está en BD) ──");
    const verifyConocida = await odooExecute([
      process.env.ODOO_DB, uid, process.env.ODOO_API_KEY,
      "account.move", "search_read",
      [[["name", "=", "NotCr 001-027-000000927"]]],
      { fields: ["id", "name", "move_type", "state", "company_id", "invoice_date", "amount_total"] },
    ]);
    if (!verifyConocida.length) {
      console.log("   ❌ Esta conexión NO encuentra la NotCr 001-027-000000927.");
      console.log("   → Tu .env actual apunta a un Odoo distinto al que sincronizó esos datos.");
    } else {
      const v = verifyConocida[0];
      console.log(`   ✅ Encontrada: id=${v.id} type=${v.move_type} state=${v.state} co=${JSON.stringify(v.company_id)} fecha=${v.invoice_date} total=${v.amount_total}`);
    }

    // 3c) Búsqueda dirigida: solo NotCr / out_refund con esos números, sin límite ni company filter
    console.log("\n── Búsqueda dirigida: out_refund con 928/926 (sin company filter) ──");
    const refundsParciales = await odooExecute([
      process.env.ODOO_DB, uid, process.env.ODOO_API_KEY,
      "account.move", "search_read",
      [[
        ["move_type", "=", "out_refund"],
        "|",
        ["name", "ilike", "000000928"],
        ["name", "ilike", "000000926"],
      ]],
      {
        fields: ["id", "name", "ref", "move_type", "state", "company_id", "invoice_date", "amount_total"],
        limit: 0,
      },
    ]);
    console.log(`   ${refundsParciales.length} NotCr encontradas:`);
    refundsParciales.forEach(d => {
      console.log(`   • [${d.id}] name="${d.name}" type=${d.move_type} state=${d.state} co=${JSON.stringify(d.company_id)} fecha=${d.invoice_date} total=${d.amount_total}`);
    });

    // 3d) Búsqueda por MONTO + FECHA + COMPAÑÍA 3
    console.log("\n── Búsqueda por monto/fecha/compañía 3 (out_refund $485.99 19/03 y $539.99 07/03) ──");
    const porMonto = await odooExecute([
      process.env.ODOO_DB, uid, process.env.ODOO_API_KEY,
      "account.move", "search_read",
      [[
        ["company_id", "=", 3],
        ["move_type", "=", "out_refund"],
        ["invoice_date", ">=", "2026-03-01"],
        ["invoice_date", "<=", "2026-04-01"],
        "|",
        ["amount_total", "=", 485.99],
        ["amount_total", "=", 539.99],
      ]],
      {
        fields: ["id", "name", "state", "company_id", "invoice_date", "amount_total", "partner_id", "invoice_origin"],
        limit: 0,
      },
    ]);
    console.log(`   ${porMonto.length} resultados:`);
    porMonto.forEach(d => {
      console.log(`   • [${d.id}] name="${d.name}" state=${d.state} fecha=${d.invoice_date} total=${d.amount_total} partner=${JSON.stringify(d.partner_id)} origin=${d.invoice_origin}`);
    });

    // 4) Buscar las POS orders por la referencia POS/XXXXX (no por nombre)
    console.log("\n── Buscando pos.order por pos_reference (POS/32934 y POS/32902) ──");
    const posOrders = await odooExecute([
      process.env.ODOO_DB, uid, process.env.ODOO_API_KEY,
      "pos.order", "search_read",
      [[
        "|",
        ["pos_reference", "ilike", "32934"],
        ["pos_reference", "ilike", "32902"],
      ]],
      {
        fields: ["id", "name", "pos_reference", "state", "amount_total", "partner_id", "session_id", "account_move", "date_order"],
        limit: 0,
      },
    ]);
    if (!posOrders.length) {
      console.log("   ❌ No se encontraron pos.order con esas referencias.");
      console.log("   → Probablemente el módulo pos.order no es accesible vía XML-RPC para tu user, o las referencias son distintas.");
    } else {
      posOrders.forEach(p => {
        console.log(`   • ${p.name} → state=${p.state} total=${p.amount_total} account_move=${JSON.stringify(p.account_move)} session=${JSON.stringify(p.session_id)} date=${p.date_order} is_invoiced=${p.is_invoiced}`);
      });

      // 5) Si tienen account_move, leerlo
      const accountMoveIds = posOrders.map(p => Array.isArray(p.account_move) ? p.account_move[0] : null).filter(Boolean);
      if (accountMoveIds.length) {
        console.log("\n── Leyendo account.move enlazados al pos.order ──");
        const moves = await odooExecute([
          process.env.ODOO_DB, uid, process.env.ODOO_API_KEY,
          "account.move", "read", [accountMoveIds],
          { fields: ["id", "name", "ref", "move_type", "state", "company_id", "invoice_date", "amount_total"] },
        ]);
        moves.forEach(m => {
          console.log(`   • [${m.id}] name="${m.name}" ref="${m.ref}" type=${m.move_type} state=${m.state} fecha=${m.invoice_date} total=${m.amount_total}`);
        });
      }
    }

    process.exit(0);
  } catch (err) {
    console.error("💥 Error:", err.message);
    process.exit(1);
  }
})();
