const sequelize = require('../db');  // Conexión a la base de datos

// ===========================
// IMPORTAR MODELOS
// ===========================
const Factura = require('./factura');
const DetalleDocumento = require('./detalleDocumento');
const MetaPreventa = require('./metaPreventa');
const RutaPreventa = require('./rutaPreventa');
const ClienteVenta = require('./clienteVenta');
const Orden = require('./orden');
const SincronizacionVenta = require('./SincronizacionVenta');
const DireccionesCliente = require('./DireccionesCliente');
const ClienteUsuarioVenta = require('./ClienteUsuarioVenta'); //  NUEVO

// Usuario de la app
const AppUser = require('./appUser');

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

Factura.hasMany(DetalleDocumento, {
  foreignKey: 'documento_code',
  sourceKey: 'code'
});

DetalleDocumento.belongsTo(Factura, {
  foreignKey: 'documento_code',
  targetKey: 'code'
});

// ===========================
// RELACIONES ÓRDENES
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

// ===========================
// 🔥 NUEVAS RELACIONES
// CLIENTE ↔ USUARIO (N a N)
// ===========================
ClienteUsuarioVenta.belongsTo(ClienteVenta, {
  foreignKey: 'codigo_cliente',
  targetKey: 'codigo_cliente',
  as: 'cliente'
});

ClienteVenta.hasMany(ClienteUsuarioVenta, {
  foreignKey: 'codigo_cliente',
  sourceKey: 'codigo_cliente',
  as: 'usuarios'
});

// (Opcional futuro)
// ClienteUsuarioVenta.belongsTo(AppUser, {
//   foreignKey: 'seller_code',
//   targetKey: 'codigo_usuario',
//   as: 'usuario'
// });

// ===========================
// EXPORTS
// ===========================
module.exports = {
  Factura,
  DetalleDocumento,
  MetaPreventa,
  RutaPreventa,
  ClienteVenta,
  ClienteUsuarioVenta, //  EXPORTADO
  Orden,
  SincronizacionVenta,
  DireccionesCliente,
  AppUser,
  sequelize,
};
