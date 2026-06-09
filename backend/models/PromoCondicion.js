// models/PromoCondicion.js
// Condiciones de una promoción (schema "promo_conditions"). N por promo.
const { DataTypes } = require("sequelize");
const sequelize = require("../db");

const PromoCondicion = sequelize.define(
  "PromoCondicion",
  {
    id                 : { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    promo_code         : { type: DataTypes.STRING(50),  allowNull: false },
    condition          : { type: DataTypes.TEXT,        allowNull: true },
    amount_condition   : { type: DataTypes.TEXT,        allowNull: true },
    amount1            : { type: DataTypes.DECIMAL(14, 2), allowNull: true },
    amount2            : { type: DataTypes.DECIMAL(14, 2), allowNull: true },
    quantity_condition : { type: DataTypes.TEXT,        allowNull: true },
    quantity1          : { type: DataTypes.DECIMAL(14, 2), allowNull: true },
    quantity2          : { type: DataTypes.DECIMAL(14, 2), allowNull: true },
    object             : { type: DataTypes.TEXT,        allowNull: true },
    code               : { type: DataTypes.TEXT,        allowNull: true },
    list               : { type: DataTypes.TEXT,        allowNull: true },
    unit_code          : { type: DataTypes.STRING(50),  allowNull: true },
    payload            : { type: DataTypes.JSONB,       allowNull: true },
  },
  {
    tableName  : "promo_conditions",
    timestamps : false,
  }
);

module.exports = PromoCondicion;
