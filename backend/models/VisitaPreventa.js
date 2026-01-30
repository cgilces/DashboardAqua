// models/visitaPreventa.js
const { DataTypes } = require("sequelize");
const sequelize = require("../db");

const VisitaPreventa = sequelize.define(
  "VisitaPreventa",
  {
    id_visita: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },

    fecha_visita: {
      type: DataTypes.DATEONLY,
      allowNull: false,
    },

    hora_visita: {
      type: DataTypes.DATE,
      allowNull: false,
    },

    codigo_cliente: {
      type: DataTypes.STRING,
      allowNull: false,
    },

    seller_code: {
      type: DataTypes.STRING,
      allowNull: false,
    },

    ruta_code: {
      type: DataTypes.STRING,
      allowNull: false,
    },

    hubo_venta: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },

    documento_code: {
      type: DataTypes.STRING,
      allowNull: true,
    },

    es_fuera_ruta: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
  },
  {
    tableName: "visitas_preventas",
    timestamps: false,
  }
);

module.exports = VisitaPreventa;
