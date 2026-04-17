const express = require("express");
const router = express.Router();
const ctrl = require("../../controllers/controllerClientes/dashboardClientes.controller");

// GET KPIs + tabla principal (con filtros)
router.get("/resumen", ctrl.obtenerResumen);

// GET catálogo de productos y categorías (para filtros multi-select)
router.get("/catalogo-productos", ctrl.obtenerCatalogoProductos);

// GET detalle consolidado de empresa por RUC
router.get("/empresa/:ruc", ctrl.obtenerEmpresaDetalle);

// GET productos de una sucursal (customer_address_code) específica
router.get("/sucursal-productos/:codigo_cliente/:codigo_sucursal", ctrl.obtenerProductosSucursal);

// GET detalle de productos por cliente (con filtros)
router.get("/productos/:codigo_cliente", ctrl.obtenerProductosCliente);

module.exports = router;