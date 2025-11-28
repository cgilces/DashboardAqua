// models/index.js
const sequelize = require('../db');

const Factura = require('./factura');
const DetalleDocumento = require('./detalleDocumento');
const MetaPreventa = require('./metaPreventa');
const RutaPreventa = require('./rutaPreventa');
const ClienteVenta = require('./clienteVenta');
const Orden = require('./orden');
const SincronizacionVenta = require('./SincronizacionVenta');

// ===========================
// RELACIONES FACTURAS
// ===========================
Factura.belongsTo(RutaPreventa, {
  foreignKey: 'route_code',
  targetKey: 'codigo_ruta',
  as: 'ruta_preventa'
});

Factura.belongsTo(ClienteVenta, {
  foreignKey: 'customer_code',
  targetKey: 'codigo_cliente',
  as: 'cliente_venta'
});

// Detalles de Facturas
Factura.hasMany(DetalleDocumento, {
  foreignKey: 'documento_code',
  sourceKey: 'code'
});

DetalleDocumento.belongsTo(Factura, {
  foreignKey: 'documento_code',
  targetKey: 'code'
});

// ===========================
// RELACIONES ORDENES (PREVENTAS)
// ===========================
Orden.belongsTo(RutaPreventa, {
  foreignKey: 'route_code',
  targetKey: 'codigo_ruta',
  as: 'ruta_preventa'
});

Orden.belongsTo(ClienteVenta, {
  foreignKey: 'customer_code',
  targetKey: 'codigo_cliente',
  as: 'cliente_venta'
});

// 🔥 Detalles de Órdenes (para sumar cantidades y USD)
Orden.hasMany(DetalleDocumento, {
  foreignKey: 'documento_code',
  sourceKey: 'code'
});

DetalleDocumento.belongsTo(Orden, {
  foreignKey: 'documento_code',
  targetKey: 'code'
});

// ===========================
// META → RUTA
// ===========================
MetaPreventa.belongsTo(RutaPreventa, {
  foreignKey: 'codigo_ruta',
  targetKey: 'codigo_ruta'
});




module.exports = {
  Factura,
  DetalleDocumento,
  MetaPreventa,
  RutaPreventa,
  ClienteVenta,
  Orden,
  SincronizacionVenta,
  sequelize,
};


