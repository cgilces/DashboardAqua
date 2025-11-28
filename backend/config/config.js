// config/config.js
require("dotenv").config();

module.exports = {
  API_URL: "https://s31.mobilvendor.com/web-service",
  USUARIO: process.env.MV_USUARIO,        // ej: "30"
  CLAVE: process.env.MV_CLAVE,            // ej: "TuClaveSegura"
  CONTEXTO: process.env.MV_CONTEXTO,      // ej: "grupoAqua"
  INTERVALO_REFRESH_MS: 50 * 60 * 1000,   // refrescar cada 50 minutos
};
