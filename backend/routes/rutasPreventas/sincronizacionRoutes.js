const express = require("express");
const { sincronizarVentas, getLastSync } = require("../../controllers/controllerPreventa/sincronizacionController");

const router = express.Router();

// Ruta para obtener la última fecha de sincronización
router.get("/last-sync", getLastSync);

// Ruta para sincronizar ventas
// GET /api/sync/sincronizar?anio=2025&mes=1
// GET /api/sync/sincronizar?desde=2025-01-01&hasta=2025-01-31
router.get("/sincronizar", sincronizarVentas);

module.exports = router;
