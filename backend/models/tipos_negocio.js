// models/tipos_negocio.js
const { DataTypes } = require("sequelize");
const sequelize = require("../db");

const TipoNegocio = sequelize.define(
  "TipoNegocio",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },

    codigo: {
      type: DataTypes.STRING(50),
      allowNull: false,
      unique: true,
    },

    descripcion: {
      type: DataTypes.STRING(150),
      allowNull: false,
    },

    color: {
      type: DataTypes.STRING(20),
    },

    estado: {
      type: DataTypes.INTEGER,
      defaultValue: 1,
    },

    fecha_creacion: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
    },

    fecha_actualizacion: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
    },
  },
  {
    tableName: "tipos_negocio",
    timestamps: false,
  }
);

module.exports = TipoNegocio;
