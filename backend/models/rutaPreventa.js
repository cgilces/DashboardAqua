// models/rutaPreventa.js
const { DataTypes } = require('sequelize');
const sequelize = require('../db');

const RutaPreventa = sequelize.define('RutaPreventa', {
  codigo_ruta: {
    type: DataTypes.STRING,
    primaryKey: true,
    allowNull: false,
  },
  descripcion: DataTypes.STRING,
  tipo: DataTypes.STRING,  // Puede ser 'PREVENTA', 'TELEVENTA', 'VIP'
}, {
  tableName: 'rutas_preventas',
  timestamps: false,
});

module.exports = RutaPreventa;
