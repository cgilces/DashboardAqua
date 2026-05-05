const { DataTypes } = require("sequelize");
const sequelize = require("../db");

// Registro de contactos hechos a clientes inactivos para recuperación
// Cada fila = un intento de contacto. Permite historial, auditoría y métricas
// de recovery rate (cuántos contactados → recuperados).
const ContactoRecuperacion = sequelize.define(
  "ContactoRecuperacion",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    // group_key del dashboard de clientes (formato: "<ruc>::<company_id>")
    group_key: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    ruc: {
      type: DataTypes.STRING(30),
      allowNull: true,
    },
    nombre_cliente: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    contactado_por: {
      type: DataTypes.STRING(100),
      allowNull: false,
    },
    fecha_contacto: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
      allowNull: false,
    },
    // CONTACTADO | NO_CONTESTA | PROMETIO_COMPRAR | NO_INTERESADO | RECUPERADO
    resultado: {
      type: DataTypes.STRING(50),
      allowNull: false,
      defaultValue: "CONTACTADO",
    },
    notas: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    dias_sin_compra_al_contactar: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
  },
  {
    tableName: "contactos_recuperacion",
    timestamps: true,
    createdAt: "created_at",
    updatedAt: "updated_at",
    indexes: [
      { fields: ["group_key"] },
      { fields: ["fecha_contacto"] },
      { fields: ["contactado_por"] },
    ],
  }
);

module.exports = ContactoRecuperacion;
