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
    allowNull: true,  // Permite que sea nulo
    references: {
      model: 'clientes',
      key: 'codigo_cliente',
    },
  },
  descripcion_direccion_cliente: {
    type: DataTypes.STRING,
    allowNull: true,  // Permite que sea nulo
  },
  codigo_direccion_cliente: {
    type: DataTypes.STRING,
    allowNull: true,  // Permite que sea nulo
  },
  calle1_direccion_cliente: {
    type: DataTypes.STRING,
    allowNull: true,  // Permite que sea nulo
  },
  bloque_direccion_cliente: {
    type: DataTypes.STRING,
    allowNull: true,  // Permite que sea nulo
  },
  calle2_direccion_cliente: {
    type: DataTypes.STRING,
    allowNull: true,  // Permite que sea nulo
  },
  referencia_direccion_cliente: {
    type: DataTypes.STRING,
    allowNull: true,  // Permite que sea nulo
  },
  codigo_postal_direccion_cliente: {
    type: DataTypes.STRING,
    allowNull: true,  // Permite que sea nulo
  },
  telefono_direccion_cliente: {
    type: DataTypes.STRING,
    allowNull: true,  // Permite que sea nulo
  },
  fax_direccion_cliente: {
    type: DataTypes.STRING,
    allowNull: true,  // Permite que sea nulo
  },
  email_direccion_cliente: {
    type: DataTypes.STRING,
    allowNull: true,  // Permite que sea nulo
  },
  latitud_direccion_cliente: {
    type: DataTypes.DECIMAL(15, 8),
    allowNull: true,  // Permite que sea nulo
  },
  longitud_direccion_cliente: {
    type: DataTypes.DECIMAL(15, 8),
    allowNull: true,  // Permite que sea nulo
  },
  fecha_ultima_visita_direccion_cliente: {
    type: DataTypes.DATE,
    allowNull: true,  // Permite que sea nulo
  },
  estado_direccion_cliente: {
    type: DataTypes.INTEGER,
    defaultValue: 1,
    allowNull: true,  // Permite que sea nulo
  },
  estado_ubicacion_direccion_cliente: {
    type: DataTypes.INTEGER,
    defaultValue: 3,
    allowNull: true,  // Permite que sea nulo
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