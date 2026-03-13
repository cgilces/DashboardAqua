const express = require("express");
const router  = express.Router();

const {
  obtenerDashboardCOTSA,
  obtenerDetalleRutaCOTSA,
} = require("../../controllers/controllerCotxa/cotsaController");

// GET /api/cotsa/dashboard?anio=2026&mes=3
router.get("/dashboard", obtenerDashboardCOTSA);

// GET /api/cotsa/detalle-ruta?ruta=R1&anio=2026&mes=3
router.get("/detalle-ruta", obtenerDetalleRutaCOTSA);

module.exports = router;
