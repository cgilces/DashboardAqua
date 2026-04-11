const { DataTypes } = require("sequelize");
const sequelize = require("../db");

const Subcanal = sequelize.define(
  "Subcanal",
  {
    id_subcanal: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },

    codigo_subcanal: {
      type: DataTypes.STRING(50),
      allowNull: false,
      unique: true,
    },

    descripcion_subcanal: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },

    // =========================
    // RELACIÓN (OPCIONAL FUTURO)
    // =========================
    codigo_tipo_negocio: {
      type: DataTypes.STRING(50),
      allowNull: true,
    },

    // =========================
    // CONTROL
    // =========================
    estado: {
      type: DataTypes.INTEGER,
      defaultValue: 1,
    },

    // =========================
    // AUDITORÍA
    // =========================
    fecha_creacion: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
    },

    fecha_actualizacion: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
    },
  },
  {
    tableName: "subcanales",
    timestamps: false,
  }
);

module.exports = Subcanal;