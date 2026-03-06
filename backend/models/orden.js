const { DataTypes } = require('sequelize');
const sequelize = require('../db');

const Orden = sequelize.define('Orden', {
  code: {
    type: DataTypes.STRING,
    primaryKey: true,
    allowNull: false,
  },

  type: DataTypes.INTEGER,
  status: DataTypes.INTEGER,

  // =========================
  // ESTADOS
  // =========================
  estado_odoo: {
    type: DataTypes.STRING,
    allowNull: true
  },

  estado_facturacion: {
    type: DataTypes.STRING,
    allowNull: true
  },

  estado_entrega: {
    type: DataTypes.STRING,
    allowNull: true
  },

  // =========================
  // FECHAS
  // =========================
  fecha_creacion: DataTypes.DATE,
  fecha_entrega: DataTypes.DATE,
  fecha_validez: DataTypes.DATE,
  fecha_compromiso: DataTypes.DATE,

  // =========================
  // CLIENTE / COMERCIAL
  // =========================
  customer_code: DataTypes.STRING,
  route_code: DataTypes.STRING,
  seller_code: DataTypes.STRING,

  equipo_ventas: {
    type: DataTypes.STRING,
    allowNull: true
  },

  campania_id: {
    type: DataTypes.INTEGER,
    allowNull: true
  },

  medio_id: {
    type: DataTypes.INTEGER,
    allowNull: true
  },


  descripcion_company: {
    type: DataTypes.STRING(60),
    allowNull: true, // Puedes cambiarlo a `false` si es obligatorio
  },

  fuente_id: {
    type: DataTypes.INTEGER,
    allowNull: true
  },

  // =========================
  // MONETARIO
  // =========================
  moneda: {
    type: DataTypes.STRING,
    allowNull: true
  },

  tasa_cambio: {
    type: DataTypes.DECIMAL(18, 6),
    allowNull: true
  },

  total: DataTypes.DECIMAL(18, 2),
  subtotal: DataTypes.DECIMAL(18, 2),
  iva: DataTypes.DECIMAL(18, 2),
  discount: DataTypes.DECIMAL(18, 2),

  monto_no_pagado: {
    type: DataTypes.DECIMAL(18, 2),
    allowNull: true
  },

  costo_envio: {
    type: DataTypes.DECIMAL(18, 2),
    allowNull: true
  },

  // =========================
  // LOGÍSTICA
  // =========================
  almacen_id: {
    type: DataTypes.INTEGER,
    allowNull: true
  },

  transportista_id: {
    type: DataTypes.INTEGER,
    allowNull: true
  },

  politica_entrega: {
    type: DataTypes.STRING,
    allowNull: true
  },

  origen_sistema: {
    type: DataTypes.STRING,
    allowNull: true
  },


  // =========================
  // OTROS
  // =========================
  parent_id: DataTypes.STRING,
  latitude: DataTypes.DECIMAL(12, 8),
  longitude: DataTypes.DECIMAL(12, 8),
  concept_code: DataTypes.STRING,
  concept_origin: DataTypes.STRING,
  sequence_type: DataTypes.STRING,
  notes: DataTypes.TEXT,

}, {
  tableName: 'ordenes',
  timestamps: false,
});

module.exports = Orden;