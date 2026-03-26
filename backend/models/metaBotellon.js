const { DataTypes } = require("sequelize");
const sequelize = require("../db");

const MetaBotellon = sequelize.define(
  "MetaBotellon",
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
    seccion: {
      type: DataTypes.STRING(30),
      allowNull: false,
      // Valores válidos: TELEVENTA_VIP, TIENDAS, MAYORISTA, RURAL
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
    tableName: "metas_botellones",
    timestamps: false,
    indexes: [
      {
        unique: true,
        fields: ["codigo_ruta", "seccion", "anio", "mes"],
      },
    ],
  }
);

module.exports = MetaBotellon;
