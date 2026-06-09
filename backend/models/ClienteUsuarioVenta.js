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
    codigo_direccion_cliente: {
      type: DataTypes.TEXT,
      allowNull: false
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
        // Debe coincidir con la constraint uq_cliente_seller_direccion del SQL:
        // un cliente puede ser atendido por el mismo vendedor en direcciones
        // distintas, por eso la unicidad incluye la dirección.
        name: 'uq_cliente_seller_direccion',
        unique: true,
        fields: ['codigo_cliente', 'seller_code', 'codigo_direccion_cliente'],
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
