const express = require("express");
const router = express.Router();
const ctrl = require("../../controllers/controllerClientes/dashboardClientes.controller");
const { verificarToken } = require("../../middleware/auth.middleware");

// Todas las rutas del dashboard de clientes requieren autenticación
router.use(verificarToken);

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

// GET clientes en declive de consumo (Módulo 2)
router.get("/declive-consumo", ctrl.obtenerDeclieveConsumo);

// GET clientes nuevos por canal (Módulo 1)
router.get("/clientes-nuevos", ctrl.obtenerClientesNuevos);

// GET recovery rate por vendedor
router.get("/recovery-rate", ctrl.obtenerRecoveryRate);

// GET drill-down de una ruta específica (nuevos/perdidos/activos)
router.get("/ruta-detalle", ctrl.obtenerDetalleRuta);

// GET cohorte de retención (clientes nuevos por mes y % retención)
router.get("/cohorte-retencion", ctrl.obtenerCohorteRetencion);

// GET tendencia histórica de inactivos vs activos
router.get("/tendencia-inactivos", ctrl.obtenerTendenciaInactivos);

// GET productos recientes de un cliente (para WhatsApp inteligente)
router.get("/productos-recientes/:codigo_cliente", ctrl.obtenerProductosRecientes);

module.exports = router;