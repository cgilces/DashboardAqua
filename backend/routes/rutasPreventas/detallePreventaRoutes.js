const express = require("express");
const router = express.Router();

const { obtenerDetalleRuta } = require("../../controllers/controllerPreventa/detallePreventaController");
const { obtenerProductosVendidosRuta } = require("../../controllers/controllerPreventa/detallePreventaController");


// RUTA OFICIAL
router.get("/detalle-ruta/:ruta/:anio/:mes", obtenerDetalleRuta);
router.get("/detalle-ruta-descartableporcanal/:ruta/:anio/:mes",   obtenerProductosVendidosRuta);



module.exports = router;
