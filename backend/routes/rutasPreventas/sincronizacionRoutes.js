const express = require("express");
const {  sincronizarVentas, getLastSync, sincronizarDireccionesCtrl} = require("../../controllers/controllerPreventa/sincronizacionController");
const {  sincronizarRutasController} = require("../../controllers/controllerSincronizaciones/sincronizacionRutasController");

const syncState = require("../../controllers/controllerPreventa/syncState");

const router = express.Router();


router.get("/last-sync", getLastSync); // Última sincronización
router.get("/sincronizar", sincronizarVentas); // Iniciar sincronización invoice(Ordenes-facturas-Detalles)
router.post("/sincronizar-rutas", sincronizarRutasController); //  Sincronizar rutas y planificación (route_details)
router.get("/sincronizar-direcciones", sincronizarDireccionesCtrl); // Sincronizar direcciones (customer_addresses)
router.get("/status", (req, res) => {
  res.json({
    running   : syncState.running,
    startDate : syncState.startDate,
    endDate   : syncState.endDate,
    percent   : syncState.percent ?? 0,
    error     : syncState.error,
    startedAt : syncState.startedAt,
    finishedAt: syncState.finishedAt,
  });
});







module.exports = router;
