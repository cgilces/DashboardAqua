// models/clienteVenta.js
const { DataTypes } = require('sequelize');
const sequelize = require('../db');

const ClienteVenta = sequelize.define('ClienteVenta', {
  codigo_cliente: {
    type: DataTypes.STRING,
    primaryKey: true,
    allowNull: false,
  },
  nombre_cliente: DataTypes.STRING,
  direccion_entrega: DataTypes.STRING,
  telefono: DataTypes.STRING,
  email: DataTypes.STRING,
  latitud: DataTypes.DECIMAL(12, 8),
  longitud: DataTypes.DECIMAL(12, 8),
  ruta_asignada: DataTypes.STRING,  // Relacionado con ruta_preventas.codigo_ruta
}, {
  tableName: 'clientes_ventas',
  timestamps: false,
});

module.exports = ClienteVenta;
