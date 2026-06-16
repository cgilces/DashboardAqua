// scripts/resyncDia.js
// ════════════════════════════════════════════════════════════════════════════
// Re-sincroniza SOLO las ventas de MobilVendor de un rango (rápido, aislado).
// Útil para refrescar documentos que quedaron con data vieja (p. ej. sin
// promo_code) tras corregir el constraint unique_detalle.
//
// Uso (servidor):
//   node scripts/resyncDia.js                       → 2026-06-01 (un día)
//   node scripts/resyncDia.js 2026-06-01 2026-06-01
//   node scripts/resyncDia.js 2026-06-01 2026-06-30 → todo el mes
// ════════════════════════════════════════════════════════════════════════════
"use strict";
require("dotenv").config();
const { iniciarSesion } = require("../utils/apiCliente");
const { sincronizarVentasRango } = require("../services/sincronizacionService");

const inicio = process.argv[2] || "2026-06-01";
const fin    = process.argv[3] || inicio; // MobilVendor usa rango inclusivo

(async () => {
  try {
    console.log(`🔐 Iniciando sesión MobilVendor...`);
    await iniciarSesion();
    console.log(`🚀 Re-sincronizando ventas ${inicio} → ${fin} ...`);
    const r = await sincronizarVentasRango(inicio, fin);
    console.log("\n✅ LISTO. Resumen:", JSON.stringify({
      facturas: r?.stats?.facturas, ordenes: r?.stats?.ordenes,
      detalles: r?.stats?.details, errores: r?.erroresPorDocumento?.length ?? 0,
    }, null, 2));
    process.exit(0);
  } catch (err) {
    console.error("❌ Error:", err.message);
    process.exit(1);
  }
})();
