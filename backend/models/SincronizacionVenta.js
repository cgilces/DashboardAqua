// models/sincronizacionVenta.js
const { DataTypes } = require("sequelize");
const sequelize = require("../db");

const SincronizacionVenta = sequelize.define(
  "SincronizacionVenta",
  {
    id_sync: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    fecha_sync: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
    },
    desde_date: {
      type: DataTypes.DATE,
    },
    hasta_date: {
      type: DataTypes.DATE,
    },
    total_registros: {
      type: DataTypes.INTEGER,
    },
    estado: {
      type: DataTypes.STRING,
    },
    mensaje: {
      type: DataTypes.TEXT,
    }
  },
  {
    tableName: "sincronizaciones_ventas",   // ⬅⬅⬅ ESTA ES LA CLAVE
    timestamps: false,                      // La tabla no tiene createdAt/updatedAt
  }
);

module.exports = SincronizacionVenta;
