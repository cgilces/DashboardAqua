// routes/sincronizacionRoutes.js
const express = require("express");
const { sincronizarVentas } = require("../controllers/sincronizacionController");

const router = express.Router();

// GET /api/sync/sincronizar?anio=2025&mes=1
// GET /api/sync/sincronizar?desde=2025-01-01&hasta=2025-01-31
router.get("/sincronizar", sincronizarVentas);

module.exports = router;
