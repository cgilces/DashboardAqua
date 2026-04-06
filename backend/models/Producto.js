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

  origen_sistema: {
    type: DataTypes.STRING,
    allowNull: true,
  },

  nombre_producto_completo: {   // nombre largo/técnico
    type: DataTypes.TEXT,
    allowNull: true
  },

  unidad_medida: {
    type: DataTypes.STRING(50),
    allowNull: true
  },

  unidad_medida_compra: {
    type: DataTypes.STRING(50),
    allowNull: true
  },

  activo: {
    type: DataTypes.BOOLEAN,
    allowNull: true,
    defaultValue: true
  },

  descripcion_venta: {
    type: DataTypes.TEXT,
    allowNull: true
  },

  // tipo_producto ya lo tienes pero es INTEGER,
  // en Odoo viene como STRING (storable/consumable/service)
  // cambia a:
  tipo_producto: {
    type: DataTypes.STRING(50),
    allowNull: true
  },

  precio: {                     // list_price — no lo tienes en el modelo
    type: DataTypes.DECIMAL(12, 2),
    allowNull: true
  },

  peso: {
    type: DataTypes.DECIMAL(10, 3),
    allowNull: true,
    defaultValue: 0
  },

  volumen: {
    type: DataTypes.DECIMAL(10, 3),
    allowNull: true,
    defaultValue: 0
  },

}, {
  tableName: 'productos',
  timestamps: false,
});

module.exports = Producto;