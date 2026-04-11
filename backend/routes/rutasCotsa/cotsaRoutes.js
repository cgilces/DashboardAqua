const express = require("express");
const router  = express.Router();

const {
  obtenerDashboardCOTTSA,
  obtenerDetalleRutaCOTTSA,
  obtenerClientesCOTTSA,
  diagnosticoCOTTSA,
} = require("../../controllers/controllerCotxa/cotsaController");

// GET /api/COTTSA/dashboard?anio=2026&mes=3
router.get("/dashboard", obtenerDashboardCOTTSA);

// GET /api/COTTSA/detalle-ruta?ruta=R1&anio=2026&mes=3
router.get("/detalle-ruta", obtenerDetalleRutaCOTTSA);

// GET /api/COTTSA/clientes?anio=2026&mes=3
router.get("/clientes", obtenerClientesCOTTSA);

// GET /api/COTTSA/diagnostico?anio=2026&mes=2
router.get("/diagnostico", diagnosticoCOTTSA);

module.exports = router;
