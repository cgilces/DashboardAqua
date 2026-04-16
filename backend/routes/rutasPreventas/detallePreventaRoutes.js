const express = require("express");
const router = express.Router();

const {
  obtenerDetalleRuta,
  obtenerProductosVendidosRuta,
  obtenerClientesCanalDescartable,
} = require("../../controllers/controllerPreventa/detallePreventaController");

const { obtenerClientesCanal, obtenerProductosSucursal } = require("../../controllers/controllerPreventa/detalleCanalController");


// RUTA OFICIAL
router.get("/detalle-ruta/:ruta/:anio/:mes", obtenerDetalleRuta);
router.get("/detalle-ruta-descartableporcanal/:ruta/:anio/:mes/:canal", obtenerProductosVendidosRuta);
router.get("/clientes-canal-descartable/:canal/:anio/:mes", obtenerClientesCanalDescartable);
router.get("/detalle-canal/:canal/:anio/:mes", obtenerClientesCanal);
router.get("/productos-sucursal/:canal/:anio/:mes", obtenerProductosSucursal);


module.exports = router;
