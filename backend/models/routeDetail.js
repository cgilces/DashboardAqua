const { DataTypes } = require("sequelize");
const sequelize = require("../db");

const RouteDetail = sequelize.define(
  "RouteDetail",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    codigo_ruta: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    codigo_cliente: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    descripcion: DataTypes.STRING,
    codigo_direccion: DataTypes.STRING,
    semana: DataTypes.INTEGER,
    dia: DataTypes.INTEGER,
    secuencia: DataTypes.INTEGER,
    created_at: DataTypes.DATE,
    updated_at: DataTypes.DATE,
  },
  {
    tableName: "route_details",
    timestamps: false,
  }
);

module.exports = RouteDetail;
