const {  sincronizarRutasYDetalles,} = require("../../services/syncRouteDetailsService");

/**
 * ======================================
 * 🔄 CONTROLLER: SINCRONIZAR RUTAS
 * ======================================
 */
const sincronizarRutasController = async (req, res) => {
  try {
    console.log("📥 Endpoint /api/sync/sincronizar-rutas llamado");

    const resultado = await sincronizarRutasYDetalles();

    return res.status(200).json({
      ok: true,
      message: "Sincronización de rutas y planificación completada",
      data: resultado,
    });
  } catch (error) {
    console.error("❌ Error en sincronizarRutasController:", error.message);

    return res.status(500).json({
      ok: false,
      message: "Error al sincronizar rutas desde MobilVendor",
      error: error.message,
    });
  }
};

module.exports = {
  sincronizarRutasController,
};
