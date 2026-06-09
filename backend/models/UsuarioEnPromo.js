// models/UsuarioEnPromo.js
// Asignación de promoción a un vendedor/prendedor con su inventario y consumo
// (schema "users_in_promos"). Es la base de la analítica "por prendedor".
const { DataTypes } = require("sequelize");
const sequelize = require("../db");

const UsuarioEnPromo = sequelize.define(
  "UsuarioEnPromo",
  {
    id                    : { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    promo_code            : { type: DataTypes.STRING(50), allowNull: false },
    user_code             : { type: DataTypes.STRING(50), allowNull: false },
    status                : { type: DataTypes.STRING(5),  allowNull: true },
    inventory             : { type: DataTypes.DECIMAL(14, 2), allowNull: true },
    inventory_amount      : { type: DataTypes.DECIMAL(14, 2), allowNull: true },
    inventory_used        : { type: DataTypes.DECIMAL(14, 2), allowNull: true },
    inventory_amount_used : { type: DataTypes.DECIMAL(14, 2), allowNull: true },
    payload               : { type: DataTypes.JSONB,      allowNull: true },
    fecha_actualizacion   : { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
  },
  {
    tableName  : "users_in_promos",
    timestamps : false,
    indexes    : [{ unique: true, fields: ["promo_code", "user_code"] }],
  }
);

module.exports = UsuarioEnPromo;
