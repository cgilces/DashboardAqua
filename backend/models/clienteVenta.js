const { DataTypes } = require('sequelize');
const sequelize = require('../db');

const ClienteVenta = sequelize.define('ClienteVenta', {
  id_cliente: {
    type: DataTypes.INTEGER,
    primaryKey: true,     // 'id_cliente' es la clave primaria
    autoIncrement: true,  // Esto hace que 'id_cliente' sea auto-incremental
  },
  codigo_cliente: {
    type: DataTypes.STRING,
    allowNull: false,     // El código de cliente no debe ser nulo
  },
  nombre_cliente: DataTypes.STRING,
  direccion_entrega: DataTypes.STRING,
  telefono: DataTypes.STRING,
  email: DataTypes.STRING,
  latitud: DataTypes.DECIMAL(12, 8),
  longitud: DataTypes.DECIMAL(12, 8),
  ruta_asignada: DataTypes.STRING,  // Relacionado con ruta_preventas.codigo_ruta
  usuario_asignado: {  // Nueva columna para almacenar el vendedor
    type: DataTypes.STRING(15),  // Tipo de dato VARCHAR(15)
    allowNull: true,  // Puedes hacerla null o no dependiendo del requerimiento
  },
}, {
  tableName: 'clientes_ventas',
  timestamps: false,
 
});

module.exports = ClienteVenta;
