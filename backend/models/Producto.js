// models/producto.js
const { DataTypes } = require('sequelize');
const sequelize = require('../db');

const Producto = sequelize.define('Producto', {

  codigo_producto: {
    type: DataTypes.STRING,
    primaryKey: true,
    allowNull: false,
  },

  nombre_producto: {
    type: DataTypes.STRING,
    allowNull: false,
  },

  nombre_alterno: DataTypes.STRING,

  codigo_barras: DataTypes.STRING,

  codigo_marca: DataTypes.STRING,

  codigo_categoria: DataTypes.STRING,

  codigo_subcategoria: DataTypes.STRING,

  codigo_familia: DataTypes.STRING,

  codigo_unidad_medida: DataTypes.STRING,

  codigo_tipo_inventario: DataTypes.STRING,

  costo: DataTypes.DECIMAL(12, 2),

  ultimo_costo: DataTypes.DECIMAL(12, 2),

  estado: DataTypes.INTEGER, // 1 = Activo, 0 = Inactivo

  tipo_producto: DataTypes.INTEGER,

}, {
  tableName: 'productos',
  timestamps: false,
});

module.exports = Producto;