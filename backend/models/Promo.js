// models/Promo.js
// Maestro de promociones importado desde MobilVendor (schema "promos").
const { DataTypes } = require("sequelize");
const sequelize = require("../db");

const Promo = sequelize.define(
  "Promo",
  {
    code            : { type: DataTypes.STRING(50), primaryKey: true },
    description     : { type: DataTypes.TEXT,        allowNull: true },
    type            : { type: DataTypes.STRING(50),  allowNull: true },
    status          : { type: DataTypes.STRING(5),   allowNull: true },
    start_date      : { type: DataTypes.DATE,        allowNull: true },
    end_date        : { type: DataTypes.DATE,        allowNull: true },
    priority        : { type: DataTypes.INTEGER,     allowNull: true },
    cyclical        : { type: DataTypes.SMALLINT,    allowNull: true },
    min_sale        : { type: DataTypes.DECIMAL(14, 2), allowNull: true },
    max_sale        : { type: DataTypes.DECIMAL(14, 2), allowNull: true },
    payment_method  : { type: DataTypes.TEXT,        allowNull: true },
    business_types  : { type: DataTypes.JSONB,       allowNull: true },
    customers       : { type: DataTypes.JSONB,       allowNull: true },
    payload         : { type: DataTypes.JSONB,       allowNull: true },
    fecha_creacion      : { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
    fecha_actualizacion : { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
  },
  {
    tableName  : "promos",
    timestamps : false,
  }
);

module.exports = Promo;
