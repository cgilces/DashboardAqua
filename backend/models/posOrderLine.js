const { DataTypes } = require('sequelize');
const sequelize = require('../db');

// =====================================================
// PosOrderLine — refleja pos.order.line de Odoo.
// Una fila por línea de cada pedido POS. Equivalente a
// detalle_documento, pero específico al universo TPV.
// =====================================================
const PosOrderLine = sequelize.define('PosOrderLine', {
  odoo_id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    allowNull: false,
  },

  // FK a PosOrder.odoo_id
  order_odoo_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },

  // Producto
  product_id: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },
  product_name: {
    type: DataTypes.STRING,
    allowNull: true,
  },

  // Cantidades y precios (replican report.pos.order)
  qty: {
    type: DataTypes.DECIMAL(18, 4),
    allowNull: true,
  },

  price_unit: {
    type: DataTypes.DECIMAL(18, 4),
    allowNull: true,
  },

  price_subtotal: {
    type: DataTypes.DECIMAL(18, 2),
    allowNull: true,
  },

  price_subtotal_incl: {
    type: DataTypes.DECIMAL(18, 2),
    allowNull: true,
  },

  discount: {
    type: DataTypes.DECIMAL(18, 2),
    allowNull: true,
  },

  // Tracking
  fecha_sync: {
    type: DataTypes.DATE,
    allowNull: true,
    defaultValue: DataTypes.NOW,
  },
}, {
  tableName: 'pos_order_lines',
  timestamps: false,
  indexes: [
    { fields: ['order_odoo_id'] },
    { fields: ['product_id'] },
  ],
});

module.exports = PosOrderLine;
