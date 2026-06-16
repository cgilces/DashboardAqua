// scripts/probeRawPromo.js
// ════════════════════════════════════════════════════════════════════════════
// Pide a MobilVendor (getInvoices) las facturas indicadas y vuelca el JSON CRUDO
// de sus líneas de detalle, para ver con qué campo viene la promoción (o si viene
// como descuento) — y así corregir el mapeo del sync (promo_code llegaba NULL).
//
// Uso (servidor):  node scripts/probeRawPromo.js [YYYY-MM-DD]   (def: 2026-06-01)
// ════════════════════════════════════════════════════════════════════════════
"use strict";
require("dotenv").config();
const axios = require("axios");
const { API_URL } = require("../config/config");
const { iniciarSesion, obtenerSesionActual } = require("../utils/apiCliente");

const dia = process.argv[2] || "2026-06-01";
const TARGETS = [
  "FA001-081-000004732","FA001-081-000004733","FA001-081-000004738","FA001-081-000004743",
];
const norm = (s) => String(s || "").toUpperCase().replace(/\s+/g, "");
const targetSet = new Set(TARGETS.map(norm));

(async () => {
  try {
    await iniciarSesion();
    const session_id = await obtenerSesionActual();
    console.log(`🔐 Sesión: ${session_id}\n📅 Día: ${dia}\n`);

    const hallados = [];
    let page = 1, totalPages = 1;
    const headersByCode = new Map();

    while (page <= totalPages && hallados.length < 12) {
      const { data } = await axios.post(API_URL, {
        session_id,
        action: "getInvoices",
        filter: {
          process_status: "0,1,2,3,4,5",
          type: "1,2",
          status: "0,1,2,5,10",
          start_date: dia,
          end_date: dia,
          limit: 1000,
          page,
        },
      }, { headers: { "Content-Type": "application/json" }, timeout: 120000 });

      totalPages = data.pages || totalPages;
      (data.invoices || data.headers || []).forEach((h) => headersByCode.set(norm(h.code), h));
      const details = data.details || [];
      for (const d of details) {
        const code = d.invoice_code || d.document_code || d.code;
        if (targetSet.has(norm(code))) hallados.push(d);
      }
      console.log(`página ${page}/${totalPages} — detalles acumulados de las target: ${hallados.length}`);
      page++;
    }

    console.log(`\n=== LÍNEAS CRUDAS (primeras ${Math.min(hallados.length, 6)}) ===`);
    hallados.slice(0, 6).forEach((d, i) => {
      console.log(`\n── línea ${i + 1} (doc ${d.invoice_code || d.document_code || d.code}) ──`);
      console.log(JSON.stringify(d, null, 2));
    });

    // Cabecera cruda de una de las target (por si la promo va a nivel cabecera)
    const hdr = headersByCode.get(norm(TARGETS[0]));
    if (hdr) {
      console.log(`\n=== CABECERA CRUDA de ${TARGETS[0]} ===`);
      console.log(JSON.stringify(hdr, null, 2));
    } else {
      console.log(`\n(no se encontró la cabecera ${TARGETS[0]} en la respuesta de ese día)`);
    }

    // Resumen de qué claves traen las líneas (para detectar el campo de promo)
    if (hallados.length) {
      console.log(`\n=== CLAVES presentes en las líneas ===`);
      console.log(Object.keys(hallados[0]).join(", "));
    }
    process.exit(0);
  } catch (err) {
    console.error("❌ Error:", err.response?.data || err.message);
    process.exit(1);
  }
})();
