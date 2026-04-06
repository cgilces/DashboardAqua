const express = require("express");
const router = express.Router();

const { obtenerDetalleRuta } = require("../../controllers/controllerBotellones/detalleBotellonController");

// RUTA OFICIAL
router.get("/detalle-botellones/:ruta/:anio/:mes", obtenerDetalleRuta,);



module.exports = router;
