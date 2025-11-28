const { DataTypes } = require("sequelize");
const sequelize = require("../db");

const DetalleDocumento = sequelize.define(
  "DetalleDocumento",
  {
    id_detalle: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true
    },

    documento_code: {
      type: DataTypes.STRING,
      allowNull: false
    },

    codigo_producto: {
      type: DataTypes.STRING,
      allowNull: false
    },

    descripcion: DataTypes.TEXT,
    cantidad: DataTypes.FLOAT,
    precio: DataTypes.FLOAT,
    subtotal: DataTypes.FLOAT,
    total: DataTypes.FLOAT,
    iva: DataTypes.FLOAT,
    unit_alias: DataTypes.STRING,
    barcode: DataTypes.STRING,

    // 🟩 NUEVOS CAMPOS (Categoría)
    codigo_categoria: {
      type: DataTypes.STRING,
      allowNull: true
    },

    descripcion_categoria: {
      type: DataTypes.STRING,
      allowNull: true
    }
  },
  {
    tableName: "detalle_documento",
    timestamps: false,
  }
);

module.exports = DetalleDocumento;
