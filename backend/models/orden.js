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
  // 🔥 NUEVOS CAMPOS CLAVE
  // =========================
  codigo_subcanal: {
    type: DataTypes.STRING(50),
    allowNull: true,
  },

  codigo_tipo_negocio: {
    type: DataTypes.STRING(50),
    allowNull: true,
  },

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
    allowNull: true,
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

  // =========================
  // CLIENTE DESNORMALIZADO
  // =========================
  customer_nombre: {
    type: DataTypes.STRING,
    allowNull: true
  },

  seller_nombre: {
    type: DataTypes.STRING,
    allowNull: true
  },

  equipo_ventas_id: {
    type: DataTypes.INTEGER,
    allowNull: true
  },

  equipo_ventas_nombre: {
    type: DataTypes.STRING,
    allowNull: true
  },

  // =========================
  // RENTABILIDAD
  // =========================
  margen: {
    type: DataTypes.DECIMAL(12, 2),
    allowNull: true,
    defaultValue: 0
  },

  margen_porcentaje: {
    type: DataTypes.DECIMAL(6, 2),
    allowNull: true,
    defaultValue: 0
  },

  // =========================
  // PAGO
  // =========================
  payment_term_id: {
    type: DataTypes.INTEGER,
    allowNull: true
  },

  payment_term_nombre: {
    type: DataTypes.STRING,
    allowNull: true
  },

  // =========================
  // LOGÍSTICA DESNORMALIZADA
  // =========================
  almacen_nombre: {
    type: DataTypes.STRING,
    allowNull: true
  },

  transportista_nombre: {
    type: DataTypes.STRING,
    allowNull: true
  },

  peso_total: {
    type: DataTypes.DECIMAL(10, 3),
    allowNull: true,
    defaultValue: 0
  },

  // =========================
  // TRAZABILIDAD
  // =========================
  source_document: {
    type: DataTypes.STRING,
    allowNull: true
  },

  etiquetas: {
    type: DataTypes.TEXT,
    allowNull: true
  },

  customer_address_code: {
    type: DataTypes.STRING, //  corregido (antes INTEGER)
    allowNull: true
  },

  mobilvendor_id: {
    type: DataTypes.STRING(255),
    allowNull: true
  },

}, {
  tableName: 'ordenes',
  timestamps: false,
});

module.exports = Orden;