// routes/visitasRoutes.js
const express = require("express");
const router = express.Router();

const { sincronizarRutasYDetalles } = require("../../services/syncRouteDetailsService");
const { obtenerHistorialDeUsuarios } = require("../../services/syncHistorialVisitasService"); // Asegúrate de que la ruta sea correcta
const { obtenerDashboardVisitas, obtenerClientesNoVisitados, obtenerDashboardPorUsuario } = require("../../controllers/controllerVIsitas/visitasController");

router.get("/dashboard", obtenerDashboardVisitas);
router.get("/dashboard-usuarios", obtenerDashboardPorUsuario);
router.get("/no-visitados", obtenerClientesNoVisitados);

// Ruta para sincronizar rutas y detalles de rutas
router.post("/sincronizarrutasydetalles", async (req, res) => {
     try {
          console.log("🔄 Iniciando sincronización de rutas y detalles...");

          // Llamamos al servicio de sincronización
          const result = await sincronizarRutasYDetalles();

          // Respondemos con el resultado de la sincronización
          return res.json({
               message: "Sincronización completada con éxito",
               data: result,
          });
     } catch (error) {
          console.error("❌ Error sincronizando rutas y detalles:", error);
          return res.status(500).json({
               error: "Error al realizar la sincronización",
          });
     }
});
// Ruta para sincronizar historial de visitas
router.post("/historialvisitas", async (req, res) => {
  try {
    const { start_date, end_date } = req.body.filter;  // Capturamos las fechas desde el cuerpo de la solicitud
    console.log(`Fechas recibidas: start_date = ${start_date}, end_date = ${end_date}`);

    // Llamamos al servicio de sincronización con las fechas correctas
    const result = await obtenerHistorialDeUsuarios(start_date, end_date);

    // Respondemos con el resultado de la sincronización
    return res.json({
      message: "Sincronización completada con éxito",
      data: result,  // Aquí puedes enviar el número de registros o cualquier otra información relevante
    });
  } catch (error) {
    console.error("❌ Error sincronizando historial de visitas:", error);
    return res.status(500).json({
      error: "Error al realizar la sincronización de visitas",
      message: error.message, // Incluir el mensaje del error
    });
  }
});

module.exports = router;
