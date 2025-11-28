// models/orden.js
const { DataTypes } = require('sequelize');
const sequelize = require('../db');

const Orden = sequelize.define('Orden', {
  code: {
    type: DataTypes.STRING,
    primaryKey: true,
    allowNull: false,
  },
  type: DataTypes.INTEGER,  // 2 = Orden
  status: DataTypes.INTEGER,  // 2 = Confirmado
  fecha_creacion: DataTypes.DATE,
  fecha_entrega: DataTypes.DATE,
  customer_code: DataTypes.STRING,  // Relacionado con clientes_ventas.codigo_cliente
  route_code: DataTypes.STRING,  // Relacionado con rutas_preventas.codigo_ruta
  seller_code: DataTypes.STRING,  // Relacionado con rutas_preventas.codigo_ruta
  total: DataTypes.DECIMAL(18, 2),
  subtotal: DataTypes.DECIMAL(18, 2),
  iva: DataTypes.DECIMAL(18, 2),
  discount: DataTypes.DECIMAL(18, 2),
  parent_id: DataTypes.STRING,  // Puede ser NULL
  latitude: DataTypes.DECIMAL(12, 8),
  longitude: DataTypes.DECIMAL(12, 8),
  concept_code: DataTypes.STRING,
  concept_origin: DataTypes.STRING,
  sequence_type: DataTypes.STRING,
  notes: DataTypes.TEXT,
}, {
  tableName: 'ordenes',
  timestamps: false,
});

module.exports = Orden;
