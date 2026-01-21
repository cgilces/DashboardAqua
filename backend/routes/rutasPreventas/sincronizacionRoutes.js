const express = require("express");
const {
  sincronizarVentas,
  getLastSync
} = require("../../controllers/controllerPreventa/sincronizacionController");

const syncState = require("../../controllers/controllerPreventa/syncState");

const router = express.Router();

// Última sincronización
router.get("/last-sync", getLastSync);

// Iniciar sincronización
router.get("/sincronizar", sincronizarVentas);

// 🔥 ESTADO DE SINCRONIZACIÓN (FALTABA)
router.get("/status", (req, res) => {
  res.json({
    running: syncState.running,
    startDate: syncState.startDate,
    endDate: syncState.endDate,
    page: syncState.page,
    total: syncState.total,
    percent: syncState.total
      ? Math.round((syncState.page / syncState.total) * 100)
      : 0,
    error: syncState.error,
    startedAt: syncState.startedAt,
    finishedAt: syncState.finishedAt
  });
});

module.exports = router;
