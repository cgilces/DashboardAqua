const express = require("express");
const router = express.Router();

const { obtenerDetalleRuta } = require("../../controllers/controllerPreventa/detallePreventaController");

// RUTA OFICIAL
router.get("/detalle-ruta/:ruta/:anio/:mes", obtenerDetalleRuta);

module.exports = router;
