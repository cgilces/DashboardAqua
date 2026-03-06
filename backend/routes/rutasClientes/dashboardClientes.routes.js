const express = require("express");
const router = express.Router();
const ctrl = require("../../controllers/controllerClientes/dashboardClientes.controller");

// GET KPIs + tabla principal (con filtros)
router.get("/resumen", ctrl.obtenerResumen);

// GET detalle de productos por cliente (con filtros)
router.get("/productos/:codigo_cliente", ctrl.obtenerProductosCliente);

module.exports = router;