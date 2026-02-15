const { DataTypes } = require('sequelize');
const sequelize = require('../db');

const DireccionCliente = sequelize.define('DireccionCliente', {
  id_direccion_cliente: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  codigo_cliente: {
    type: DataTypes.STRING,
    allowNull: false,
    references: {
      model: 'clientes',
      key: 'codigo_cliente',
    },
  },
  descripcion_direccion_cliente: DataTypes.STRING,
  codigo_direccion_cliente: DataTypes.STRING,
  calle1_direccion_cliente: DataTypes.STRING,
  bloque_direccion_cliente: DataTypes.STRING,
  calle2_direccion_cliente: DataTypes.STRING,
  referencia_direccion_cliente: DataTypes.STRING,
  codigo_postal_direccion_cliente: DataTypes.STRING,
  telefono_direccion_cliente: DataTypes.STRING,
  fax_direccion_cliente: DataTypes.STRING,
  email_direccion_cliente: DataTypes.STRING,
  latitud_direccion_cliente: DataTypes.DECIMAL(15, 8),
  longitud_direccion_cliente: DataTypes.DECIMAL(15, 8),
  fecha_ultima_visita_direccion_cliente: DataTypes.DATE,
  estado_direccion_cliente: {
    type: DataTypes.INTEGER,
    defaultValue: 1,
  },
  estado_ubicacion_direccion_cliente: {
    type: DataTypes.INTEGER,
    defaultValue: 3,
  },
  fecha_creacion_direccion_cliente: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
  },
  fecha_actualizacion_direccion_cliente: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
  },
}, {
  tableName: 'direcciones_clientes',
  timestamps: false,
});

module.exports = DireccionCliente;
