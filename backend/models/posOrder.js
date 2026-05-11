const { DataTypes } = require('sequelize');
const sequelize = require('../db');

// =====================================================
// PosOrder — refleja pos.order de Odoo (módulo TPV).
// Se sincroniza junto a pedidos y facturas para tener
// el universo completo de transacciones POS sin depender
// de llamadas en vivo a Odoo.
// =====================================================
const PosOrder = sequelize.define('PosOrder', {
  // Pos.order.name de Odoo (ej. "RUTA 113/7968"). Usable como PK lógico
  // porque es único por company. Sequelize requiere PK; uso odoo_id por ser
  // INTEGER y más estable contra renombres.
  odoo_id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    allowNull: false,
  },

  name: {
    type: DataTypes.STRING,
    allowNull: false,
  },

  pos_reference: {
    type: DataTypes.STRING,
    allowNull: true,
  },

  date_order: {
    type: DataTypes.DATE,
    allowNull: true,
  },

  state: {
    type: DataTypes.STRING(20),
    allowNull: true,
  },

  amount_total: {
    type: DataTypes.DECIMAL(18, 2),
    allowNull: true,
  },

  amount_paid: {
    type: DataTypes.DECIMAL(18, 2),
    allowNull: true,
  },

  amount_tax: {
    type: DataTypes.DECIMAL(18, 2),
    allowNull: true,
  },

  amount_return: {
    type: DataTypes.DECIMAL(18, 2),
    allowNull: true,
  },

  // Cliente del pedido
  partner_id: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },
  partner_name: {
    type: DataTypes.STRING,
    allowNull: true,
  },

  // Cajero/vendedor (res.users)
  user_id: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },
  user_name: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  // Nombre del partner asociado al res.users — esto es lo que el reporte
  // "Análisis del TPV" usa para agrupar (igual al SQL del usuario).
  user_partner_name: {
    type: DataTypes.STRING,
    allowNull: true,
  },

  // Sesión POS y configuración (caja física)
  session_id: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },
  session_name: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  config_id: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },
  config_name: {
    type: DataTypes.STRING,
    allowNull: true,
  },

  // Factura asociada (account.move)
  account_move_id: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },
  account_move_name: {
    type: DataTypes.STRING,
    allowNull: true,
  },

  company_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },

  // Tracking
  fecha_sync: {
    type: DataTypes.DATE,
    allowNull: true,
    defaultValue: DataTypes.NOW,
  },
}, {
  tableName: 'pos_orders',
  timestamps: false,
  indexes: [
    { fields: ['company_id'] },
    { fields: ['date_order'] },
    { fields: ['state'] },
    { fields: ['user_id'] },
    { fields: ['partner_id'] },
  ],
});

module.exports = PosOrder;
