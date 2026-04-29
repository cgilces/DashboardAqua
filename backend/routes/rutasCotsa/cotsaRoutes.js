const express = require("express");
const router  = express.Router();

const {
  obtenerDashboardCOTTSA,
  obtenerDetalleRutaCOTTSA,
  obtenerClientesCOTTSA,
  diagnosticoCOTTSA,
  obtenerCottsaExtra,
  guardarCottsaExtra,
  obtenerReembolsosHuerfanos,
  obtenerPOSDetalleCOTTSA,
} = require("../../controllers/controllerCotxa/cotsaController");

// GET /api/COTTSA/dashboard?anio=2026&mes=3
router.get("/dashboard", obtenerDashboardCOTTSA);

// GET /api/COTTSA/detalle-ruta?ruta=R1&anio=2026&mes=3
router.get("/detalle-ruta", obtenerDetalleRutaCOTTSA);

// GET /api/COTTSA/clientes?anio=2026&mes=3
router.get("/clientes", obtenerClientesCOTTSA);

// GET /api/COTTSA/diagnostico?anio=2026&mes=2
router.get("/diagnostico", diagnosticoCOTTSA);

// GET/PUT /api/COTTSA/extra — datos externos manuales por año+mes
router.get("/extra", obtenerCottsaExtra);
router.put("/extra", guardarCottsaExtra);

// GET /api/COTTSA/reembolsos-huerfanos?anio=2026&mes=3
//   Lista los pos.order de Odoo con state=paid + account_move=false (reembolsos
//   POS sin facturar). Devuelve vacío si todo está cuadrado.
router.get("/reembolsos-huerfanos", obtenerReembolsosHuerfanos);

// GET /api/COTTSA/pos-detalle?anio=2026&mes=3
//   Detalle completo de "POS - Kenny Navas": Facts, NotCr facturadas y
//   reembolsos huérfanos del período. Para mostrar en modal al hacer click.
router.get("/pos-detalle", obtenerPOSDetalleCOTTSA);

module.exports = router;
