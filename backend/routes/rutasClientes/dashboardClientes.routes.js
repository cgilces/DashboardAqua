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

// ── Recuperación de clientes inactivos ────────────────────────
// GET clientes a recuperar (ordenados por valor en riesgo)
router.get("/alertas-recuperacion", ctrl.obtenerAlertasRecuperacion);

// POST registrar un contacto hecho a un cliente
router.post("/contactos-recuperacion", ctrl.registrarContacto);

// GET historial de contactos de un cliente
router.get("/contactos-recuperacion/historial/:group_key", ctrl.obtenerHistorialContactos);

// GET salud por ruta (nuevos vs perdidos)
router.get("/salud-rutas", ctrl.obtenerSaludRutas);

// GET clientes con coordenadas para el mapa
router.get("/clientes-mapa", ctrl.obtenerClientesMapa);

module.exports = router;