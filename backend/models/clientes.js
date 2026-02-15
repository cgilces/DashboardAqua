// models/clientes.js
const { DataTypes } = require('sequelize');
const sequelize = require('../db');

const Cliente = sequelize.define('Cliente', {
  id_cliente: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  codigo_cliente: {
    type: DataTypes.STRING(255),
    allowNull: false,
    unique: true,
  },
  tipo_identificacion_cliente: {
    type: DataTypes.STRING(50),
    allowNull: true,
  },
  identificacion_cliente: {
    type: DataTypes.STRING(20),
    allowNull: false,
  },
  nombre_cliente: {
    type: DataTypes.STRING(255),
    allowNull: true,
  },
  nombre_comercial_cliente: {
    type: DataTypes.STRING(255),
    allowNull: true,
  },
  contacto_cliente: {
    type: DataTypes.STRING(255),
    allowNull: true,
  },
  codigo_moneda_cliente: {
    type: DataTypes.STRING(3),
    defaultValue: 'USD',
  },
  codigo_lista_precio_cliente: {
    type: DataTypes.STRING(50),
    allowNull: true,
  },
  metodo_pago_cliente: {
    type: DataTypes.STRING(50),
    allowNull: true,
  },
  codigo_grupo_cliente: {
    type: DataTypes.STRING(50),
    allowNull: true,
  },
  descuento_cliente: {
    type: DataTypes.DECIMAL(10, 2),
    defaultValue: 0.00,
  },
  objetivo_venta_cliente: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: true,
  },
  saldo_cliente: {
    type: DataTypes.DECIMAL(10, 2),
    defaultValue: 0.00,
  },
  tiene_credito_cliente: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
  },
  tiene_documentos_cliente: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
  },
  estado_cliente: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
  },
  estado_proceso_cliente: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
  },
  nacionalidad_cliente: {
    type: DataTypes.STRING(50),
    allowNull: true,
  },
  codigo_usuario_asignado_cliente: {
    type: DataTypes.STRING(50),
    allowNull: true,
  },
  fecha_creacion_cliente: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
  },
  fecha_actualizacion_cliente: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
  },
}, {
  tableName: 'clientes',
  timestamps: false,  // Si no necesitas campos de fecha de creación/actualización automáticos
});

module.exports = Cliente;
