const { DataTypes } = require('sequelize');
const sequelize = require('../db');

const ClienteUsuarioVenta = sequelize.define(
  'ClienteUsuarioVenta',
  {
    id_relacion: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },

    codigo_cliente: {
      type: DataTypes.STRING(50),
      allowNull: false,
    },

    seller_code: {
      type: DataTypes.STRING(50),
      allowNull: false,
    },

    ruta_code: {
      type: DataTypes.STRING(50),
      allowNull: true,
    },

    tipo_atencion: {
      type: DataTypes.STRING(20), // PREVENTA / TELEVENTA / VIP
      allowNull: true,
    },

    ultima_atencion: {
      type: DataTypes.DATE,
      allowNull: true,
    },
  },
  {
    tableName: 'clientes_usuarios_ventas',
    timestamps: false,
    indexes: [
      {
        unique: true,
        fields: ['codigo_cliente', 'seller_code'],
      },
      {
        fields: ['codigo_cliente'],
      },
      {
        fields: ['seller_code'],
      },
      {
        fields: ['ruta_code'],
      },
    ],
  }
);

module.exports = ClienteUsuarioVenta;
