// models/PromoAccion.js
// Acciones / beneficios de una promoción (schema "promo_actions"). N por promo.
const { DataTypes } = require("sequelize");
const sequelize = require("../db");

const PromoAccion = sequelize.define(
  "PromoAccion",
  {
    id            : { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    promo_code    : { type: DataTypes.STRING(50),  allowNull: false },
    action        : { type: DataTypes.TEXT,        allowNull: true },
    discount      : { type: DataTypes.DECIMAL(14, 4), allowNull: true },
    discount_type : { type: DataTypes.STRING(50),  allowNull: true },
    price_value   : { type: DataTypes.DECIMAL(14, 4), allowNull: true },
    gift          : { type: DataTypes.TEXT,        allowNull: true },
    gift_base     : { type: DataTypes.TEXT,        allowNull: true },
    stepped       : { type: DataTypes.SMALLINT,    allowNull: true },
    articles      : { type: DataTypes.JSONB,       allowNull: true },
    brands        : { type: DataTypes.JSONB,       allowNull: true },
    categories    : { type: DataTypes.JSONB,       allowNull: true },
    families      : { type: DataTypes.JSONB,       allowNull: true },
    payload       : { type: DataTypes.JSONB,       allowNull: true },
  },
  {
    tableName  : "promo_actions",
    timestamps : false,
  }
);

module.exports = PromoAccion;
