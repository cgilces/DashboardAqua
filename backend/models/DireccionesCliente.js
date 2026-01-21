const { DataTypes } = require('sequelize');
const sequelize = require('../db');

// Definir el modelo para las direcciones de los clientes
const DireccionesCliente = sequelize.define('DireccionesCliente', {
  id_direccion: {
    type: DataTypes.INTEGER,
    primaryKey: true,     // 'id_direccion' es la clave primaria
    autoIncrement: true,  // Esto hace que 'id_direccion' sea auto-incremental
  },
  customer_code: {
    type: DataTypes.STRING,
    allowNull: false,     // El código de cliente no debe ser nulo
    references: {
      model: 'clientes_ventas',  // Relaciona con el modelo 'clientes_ventas'
      key: 'codigo_cliente',    // Relaciona con la columna 'codigo_cliente' de 'clientes_ventas'
    }
  },
  direccion_1: {
    type: DataTypes.STRING(250),
    allowNull: false,  // Dirección principal, no puede ser nula
  },
  direccion_2: {
    type: DataTypes.STRING(250),
    allowNull: true,  // Dirección adicional (opcional)
  },
  ciudad: {
    type: DataTypes.STRING(100),
    allowNull: true,
  },
  provincia: {
    type: DataTypes.STRING(100),
    allowNull: true,
  },
  pais: {
    type: DataTypes.STRING(100),
    allowNull: true,
  },
  codigo_postal: {
    type: DataTypes.STRING(20),
    allowNull: true,
  },
  telefono: {
    type: DataTypes.STRING(50),
    allowNull: true,
  },
  email: {
    type: DataTypes.STRING(100),
    allowNull: true,
  },
  latitud: {
    type: DataTypes.DECIMAL(12, 8),
    allowNull: true,
  },
  longitud: {
    type: DataTypes.DECIMAL(12, 8),
    allowNull: true,
  },
  tipo_direccion: {
    type: DataTypes.STRING(50),
    allowNull: true,  // Ejemplo: "facturación", "entrega", "principal", etc.
  }
}, {
  tableName: 'direcciones_clientes',  // Nombre de la tabla en la base de datos
  timestamps: false,  // Si no deseas campos como createdAt y updatedAt
});

module.exports = DireccionesCliente;
