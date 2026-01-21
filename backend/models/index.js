const sequelize = require('../db');  // Conexión a la base de datos

// Importar los modelos
const Factura = require('./factura');
const DetalleDocumento = require('./detalleDocumento');
const MetaPreventa = require('./metaPreventa');
const RutaPreventa = require('./rutaPreventa');
const ClienteVenta = require('./clienteVenta');
const Orden = require('./orden');
const SincronizacionVenta = require('./SincronizacionVenta');
const DireccionesCliente = require('./DireccionesCliente');


// Asegúrate de importar tu modelo 'AppUser' (o como lo hayas nombrado)
const AppUser = require('./appUser');  // Ruta correcta para importar el modelo AppUser

// ===========================
// RELACIONES ENTRE MODELOS
// ===========================

// Relaciones de Facturas con otras tablas
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

// Relación de Detalles de Factura
Factura.hasMany(DetalleDocumento, {
  foreignKey: 'documento_code',
  sourceKey: 'code'
});

DetalleDocumento.belongsTo(Factura, {
  foreignKey: 'documento_code',
  targetKey: 'code'
});

// ===========================
// RELACIONES DE ORDENES (PREVENTAS)
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

// Detalles de las Órdenes
Orden.hasMany(DetalleDocumento, {
  foreignKey: 'documento_code',
  sourceKey: 'code'
});

DetalleDocumento.belongsTo(Orden, {
  foreignKey: 'documento_code',
  targetKey: 'code'
});

// ===========================
// RELACIÓN META → RUTA
// ===========================
MetaPreventa.belongsTo(RutaPreventa, {
  foreignKey: 'codigo_ruta',
  targetKey: 'codigo_ruta'
});

// Exportar todos los modelos correctamente
module.exports = {
  Factura,
  DetalleDocumento,
  MetaPreventa,
  RutaPreventa,
  ClienteVenta,
  Orden,
  SincronizacionVenta,
  DireccionesCliente,
  AppUser,  // Asegúrate de exportar AppUser aquí
  sequelize, // Exportar la conexión a la base de datos
};
