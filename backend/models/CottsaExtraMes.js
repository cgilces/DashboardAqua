const { DataTypes } = require("sequelize");
const sequelize = require("../db");

const CottsaExtraMes = sequelize.define(
  "CottsaExtraMes",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    anio: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    mes: {
      type: DataTypes.INTEGER,
      allowNull: false,
      validate: { min: 1, max: 12 },
    },
    unidades: {
      type: DataTypes.FLOAT,
      allowNull: false,
      defaultValue: 0,
    },
    dolares: {
      type: DataTypes.FLOAT,
      allowNull: false,
      defaultValue: 0,
    },
    facturas: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    actualizado_por: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
  },
  {
    tableName: "cottsa_extra_mes",
    timestamps: true,
    createdAt: "created_at",
    updatedAt: "updated_at",
    indexes: [
      {
        unique: true,
        fields: ["anio", "mes"],
      },
    ],
  }
);

module.exports = CottsaExtraMes;
