// scripts/syncPromos.js
// Prueba aislada de la sincronización de promociones (sin tocar ventas).
// Uso:  node scripts/syncPromos.js
//
// Requiere que el backend ya se haya arrancado al menos una vez (para que
// el bootstrap haya creado las tablas promos / promo_conditions /
// promo_actions / users_in_promos vía 000_schema.sql).
"use strict";

require("dotenv").config();

const { iniciarSesion } = require("../utils/apiCliente");
const { sincronizarPromociones } = require("../services/sincronizacionService");

(async () => {
  try {
    console.log("🔐 Iniciando sesión con MobilVendor...");
    await iniciarSesion();

    const resultado = await sincronizarPromociones();

    console.log("\n📊 RESULTADO:", JSON.stringify(resultado, null, 2));
    process.exit(0);
  } catch (err) {
    console.error("\n❌ Falló la prueba de promociones:", err.message);
    console.error(err.stack);
    process.exit(1);
  }
})();
