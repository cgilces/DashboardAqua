// scripts/probeUsersInPromos.js
// Diagnóstico: ¿las líneas de venta (getInvoices) traen referencia a promoción?
// Vuelca las keys de una cabecera y una línea de detalle reales.
//
// Uso:  node scripts/probeUsersInPromos.js
"use strict";

require("dotenv").config();

const axios = require("axios");
const { API_URL } = require("../config/config");
const { iniciarSesion, obtenerSesionActual } = require("../utils/apiCliente");

(async () => {
  try {
    console.log("🔐 Sesión MobilVendor...");
    await iniciarSesion();
    const session_id = await obtenerSesionActual();
    if (!session_id) throw new Error("No hay sesión activa.");
    console.log(`   OK: ${session_id}\n`);

    const { data } = await axios.post(
      API_URL,
      {
        session_id,
        action: "getInvoices",
        filter: {
          process_status: "0,1,2,3,4,5",
          type          : "1,2",
          status        : "0,1,2,5,10",
          start_date    : "2026-05-01",
          end_date      : "2026-06-08",
          limit         : 20,
          page          : 1,
        },
      },
      { headers: { "Content-Type": "application/json" }, timeout: 120_000 }
    );

    const headers = data.invoices || data.headers || [];
    const details = data.details  || [];
    console.log(`Cabeceras: ${headers.length} | Detalles: ${details.length} | pages=${data.pages}`);

    if (headers.length) {
      console.log(`\n── CABECERA keys ──\n${Object.keys(headers[0]).join(", ")}`);
      // ¿hay algún campo con "promo" en la cabecera?
      const promoH = Object.keys(headers[0]).filter(k => /promo/i.test(k));
      console.log(`   campos con 'promo' en cabecera: ${promoH.join(", ") || "(ninguno)"}`);
    }

    if (details.length) {
      console.log(`\n── DETALLE keys ──\n${Object.keys(details[0]).join(", ")}`);
      const promoD = Object.keys(details[0]).filter(k => /promo|discount|gift|free|regalo|descuent/i.test(k));
      console.log(`   campos relevantes en detalle: ${promoD.join(", ") || "(ninguno)"}`);
      console.log(`\n   detalle[0]:\n${JSON.stringify(details[0], null, 2)}`);
      // buscar alguna línea que tenga promo_code no vacío
      const conPromo = details.find(d => {
        const v = d.promo_code ?? d.promo ?? d.promotion_code;
        return v !== undefined && v !== null && String(v).trim() !== "" && String(v).trim() !== "0";
      });
      if (conPromo) {
        console.log(`\n   ✓ Línea con promo encontrada:\n${JSON.stringify(conPromo, null, 2)}`);
      } else {
        console.log(`\n   (ninguna de las ${details.length} líneas tiene promo_code/promo poblado)`);
      }
    }

    console.log("\n✅ Diagnóstico terminado.");
    process.exit(0);
  } catch (err) {
    console.error("\n❌ Falló el diagnóstico:", err.message);
    if (err.response?.data) console.error(JSON.stringify(err.response.data).slice(0, 400));
    process.exit(1);
  }
})();
