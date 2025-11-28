const { DataTypes } = require("sequelize");
const sequelize = require("../db");

const MetaPreventa = sequelize.define(
  "MetaPreventa",
  {
    id_meta: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },

    codigo_ruta: {
      type: DataTypes.STRING(50),
      allowNull: false,
    },

    anio: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },

    mes: {
      type: DataTypes.INTEGER,
      allowNull: false,
      validate: {
        min: 1,
        max: 12,
      },
    },

    meta_unidades: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },

    meta_dolares: {
      type: DataTypes.FLOAT,
      allowNull: false,
      defaultValue: 0,
    },
  },
  {
    tableName: "metas_preventas",
    timestamps: false,
    indexes: [
      {
        unique: true,
        fields: ["codigo_ruta", "anio", "mes"], // evita duplicados por mes/año
      },
    ],
  }
);

module.exports = MetaPreventa;
