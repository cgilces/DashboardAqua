const sequelize = require('../db');

// =============================
// IMPORTACIÓN DE MODELOS
// =============================
const Factura = require('./factura');
const DetalleDocumento = require('./detalleDocumento');
const MetaPreventa = require('./metaPreventa');
const Clientes = require('./clientes');
const Orden = require('./orden');
const SincronizacionVenta = require('./SincronizacionVenta');
const DireccionCliente = require('./DireccionCliente');
const ClienteUsuarioVenta = require('./ClienteUsuarioVenta');
const AppUser = require('./AppUser');
const HistorialVisitas = require('./HistorialVisitas');
const Ruta = require('./Ruta');
const DetalleRuta = require('./DetalleRuta');
const TipoNegocio = require('./tipos_negocio');
const TipoDocumentoLatam = require('./TipoDocumentoLatam');
const Producto = require('./Producto'); // importante que coincida el nombre del archivo

// =============================
// RELACIONES
// =============================

// ---------- FACTURA ----------
Factura.belongsTo(Clientes, {
  foreignKey: 'customer_code',
  as: 'cliente_venta',
});

Factura.hasMany(DetalleDocumento, {
  foreignKey: 'documento_code',
  sourceKey: 'code',
});

DetalleDocumento.belongsTo(Factura, {
  foreignKey: 'documento_code',
  targetKey: 'code',
});

// Relación Factura con TipoDocumentoLatam
TipoDocumentoLatam.hasMany(Factura, {
  foreignKey: 'tipo_documento',
  as: 'facturas',
});

Factura.belongsTo(TipoDocumentoLatam, {
  foreignKey: 'tipo_documento',
  as: 'tipo_documento_latam',
});

// ---------- ORDEN ----------
Orden.belongsTo(Clientes, {
  foreignKey: 'customer_code',
  as: 'cliente_venta',
});

Orden.hasMany(DetalleDocumento, {
  foreignKey: 'documento_code',
  sourceKey: 'code',
});

DetalleDocumento.belongsTo(Orden, {
  foreignKey: 'documento_code',
  targetKey: 'code',
});

// ---------- PRODUCTO ----------
// PK en Producto = codigo_producto
// FK en DetalleDocumento = codigo_producto
DetalleDocumento.belongsTo(Producto, {
  foreignKey: 'codigo_producto',
  as: 'producto',
});

Producto.hasMany(DetalleDocumento, {
  foreignKey: 'codigo_producto',
  as: 'detalles',
});

// ---------- RUTAS ----------
HistorialVisitas.belongsTo(Ruta, {
  foreignKey: 'codigo_ruta',
  targetKey: 'codigo',
  as: 'rutaDirecta',
});

Ruta.hasMany(DetalleRuta, {
  foreignKey: 'route_code',
  sourceKey: 'codigo',
  as: 'detalles_rutas',
});

DetalleRuta.belongsTo(Ruta, {
  foreignKey: 'route_code',
  targetKey: 'codigo',
  as: 'rutaDetalle',
});

// ---------- CLIENTES ----------
DetalleRuta.belongsTo(Clientes, {
  foreignKey: 'customer_code',
  targetKey: 'codigo_cliente',
  as: 'cliente',
});

HistorialVisitas.belongsTo(Clientes, {
  foreignKey: 'codigo_cliente',
  targetKey: 'codigo_cliente',
  as: 'cliente',
});

Clientes.belongsTo(TipoNegocio, {
  foreignKey: 'codigo_tipo_negocio',
  targetKey: 'codigo',
  as: 'tipo_negocio',
});

// ---------- HISTORIAL VISITAS Y ORDEN ----------
HistorialVisitas.belongsTo(Orden, {
  foreignKey: 'codigo_cliente',
  targetKey: 'customer_code',
  as: 'orden',
});

// =============================
// EXPORTACIÓN
// =============================
module.exports = {
  Factura,
  DetalleDocumento,
  MetaPreventa,
  Clientes,
  ClienteUsuarioVenta,
  Orden,
  SincronizacionVenta,
  DireccionCliente,
  AppUser,
  HistorialVisitas,
  Ruta,
  DetalleRuta,
  TipoNegocio,
  TipoDocumentoLatam,
  Producto,
  sequelize,
};