const express = require("express");
const router = express.Router();

const { obtenerDetalleRuta } = require("../../controllers/controllerHielo/detalleHieloController");
// const { obtenerProductosVendidosRuta } = require("../../controllers/controllerPreventa/detallePreventaController");


// RUTA OFICIAL
router.get("/detalle-hielo/:ruta/:anio/:mes", obtenerDetalleRuta,);
// router.get("/detalle-hielo/:ruta/:anio/:mes",   obtenerProductosVendidosRuta);



module.exports = router;
