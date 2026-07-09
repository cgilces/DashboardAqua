const { DataTypes } = require("sequelize");
const sequelize = require("../db");

// ════════════════════════════════════════════════════════════════════════════
// promo_lineas_venta — Copia AISLADA de las líneas de venta con promoción.
//
// La escribe SOLO la sincronización de MobilVendor (facturas Y órdenes). Odoo
// NUNCA la toca, así que no puede pisar las promos de las facturas —que comparten
// el número fiscal con Odoo y por eso en detalle_documento se sobrescribían
// (art. y promo_code de MobilVendor reemplazados por los de Odoo sin promo).
//
// Snapshot desnormalizado (vendedor, fecha y tipo incluidos) para que el reporte
// y la analítica de promos NO dependan de JOINs a facturas/ordenes, que Odoo
// también reescribe. Fuente de verdad del módulo DashboardPromos.
// ════════════════════════════════════════════════════════════════════════════
const PromoLineaVenta = sequelize.define(
  "PromoLineaVenta",
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },

    documento_code: {
      type: DataTypes.STRING(100),
      allowNull: false,
    },

    // 'FACTURA' | 'ORDEN'
    tipo: {
      type: DataTypes.STRING(10),
      allowNull: false,
    },

    seller_code: {
      type: DataTypes.STRING(50),
      allowNull: true,
    },

    fecha: {
      type: DataTypes.DATE,
      allowNull: true,
    },

    codigo_producto: {
      type: DataTypes.STRING(50),
      allowNull: true,
    },

    descripcion: {
      type: DataTypes.TEXT,
      allowNull: true,
    },

    unidad: {
      type: DataTypes.STRING(50),
      allowNull: true,
    },

    cantidad: {
      type: DataTypes.DECIMAL(18, 2),
      allowNull: true,
    },

    precio: {
      type: DataTypes.DECIMAL(18, 2),
      allowNull: true,
    },

    descuento_linea: {
      type: DataTypes.DECIMAL(18, 2),
      allowNull: true,
    },

    subtotal: {
      type: DataTypes.DECIMAL(18, 2),
      allowNull: true,
    },

    total: {
      type: DataTypes.DECIMAL(18, 2),
      allowNull: true,
    },

    iva: {
      type: DataTypes.DECIMAL(18, 2),
      allowNull: true,
    },

    promo_code: {
      type: DataTypes.STRING(50),
      allowNull: false,
    },

    promo_action_code: {
      type: DataTypes.STRING(50),
      allowNull: true,
    },
  },
  {
    tableName: "promo_lineas_venta",
    timestamps: false,
  }
);

module.exports = PromoLineaVenta;
