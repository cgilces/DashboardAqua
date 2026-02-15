const sequelize = require('../db');  // Conexión a la base de datos
const { DataTypes } = require('sequelize');

// Importar modelos
const Factura = require('./factura');
const DetalleDocumento = require('./detalleDocumento');
const MetaPreventa = require('./metaPreventa');
const Clientes = require('./clientes');
const Orden = require('./orden');
const SincronizacionVenta = require('./SincronizacionVenta');
const DireccionCliente = require('./DireccionCliente');
const ClienteUsuarioVenta = require('./ClienteUsuarioVenta');
const AppUser = require('./appUser');
const HistorialVisitas = require('./historialVisitas');
const Ruta = require('./Ruta');  // Aquí importamos Ruta
const DetalleRuta = require('./DetalleRuta');

// Establecer relaciones

// Relación entre `Factura` y `Clientes`
Factura.belongsTo(Clientes, {
  foreignKey: 'customer_code',
  targetKey: 'codigo_cliente',
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

// Relación entre `Orden` y `Clientes`
Orden.belongsTo(Clientes, {
  foreignKey: 'customer_code',
  targetKey: 'codigo_cliente',
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

// Relación entre `HistorialVisitas` y `Ruta`
HistorialVisitas.belongsTo(Ruta, {  // Asociación con el modelo Ruta
  foreignKey: 'codigo_ruta',  // Clave foránea en HistorialVisitas
  targetKey: 'codigo',  // Clave primaria en Ruta
  as: 'rutaDirecta',  // Alias único para la relación entre HistorialVisitas y Ruta
});

// Relación entre `Ruta` y `DetalleRuta`
Ruta.hasMany(DetalleRuta, {
  foreignKey: 'route_code',
  sourceKey: 'codigo',
  as: 'detalles_rutas',
});

// Relación entre `DetalleRuta` y `Ruta`
DetalleRuta.belongsTo(Ruta, {
  foreignKey: 'route_code',
  targetKey: 'codigo',
  as: 'rutaDetalle',  // Alias único para la relación entre DetalleRuta y Ruta
});

// Relación entre `DetalleRuta` y `Clientes`
DetalleRuta.belongsTo(Clientes, {
  foreignKey: 'customer_code',
  targetKey: 'codigo_cliente',
  as: 'cliente',
});

// Relación entre `HistorialVisitas` y `Clientes`
HistorialVisitas.belongsTo(Clientes, {  // Relación entre HistorialVisitas y Cliente
  foreignKey: 'codigo_cliente',  // Clave foránea en HistorialVisitas
  targetKey: 'codigo_cliente',  // Clave primaria en Cliente
  as: 'cliente',  // Alias para la relación entre HistorialVisitas y Cliente
});

// models/index.js

// Relación entre HistorialVisitas y Orden
HistorialVisitas.belongsTo(Orden, {  // Relación con el modelo Orden
  foreignKey: 'codigo_cliente',  // Clave foránea en HistorialVisitas
  targetKey: 'customer_code',    // La clave primaria de Orden
  as: 'orden',  // Alias que usamos en las consultas `include`
});


// Exportar los modelos para que estén disponibles en otras partes de la aplicación
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
  HistorialVisitas,  // Exportamos HistorialVisitas
  Ruta,  // Exportamos Ruta
  DetalleRuta,  // Exportamos DetalleRuta
  sequelize,  // Exportamos la conexión a la base de datos
};
