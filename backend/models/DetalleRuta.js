const { DataTypes } = require('sequelize');
const sequelize = require('../db');

const DetalleRuta = sequelize.define('DetalleRuta', {
  codigo: {
    type: DataTypes.STRING,
    primaryKey: true,
    allowNull: false,
  },
  codigo_ruta: {
    type: DataTypes.STRING,
    references: {
      model: 'rutas', // Nombre de la tabla a la que hace referencia
      key: 'codigo',  // Columna de la tabla de referencia
    },
  },
  codigo_cliente: DataTypes.STRING,  // Relacionado con clientes.codigo_cliente
  codigo_direccion_cliente: DataTypes.STRING,  // Relacionado con clientes.direccion
  semana: DataTypes.INTEGER,
  dia: DataTypes.INTEGER,
  secuencia: DataTypes.INTEGER,
  estado: DataTypes.INTEGER,
  datos: DataTypes.JSONB,  // Datos adicionales como JSON
  creado_por: DataTypes.INTEGER,
  actualizado_por: DataTypes.INTEGER,
  creado_por_id: DataTypes.STRING,
  actualizado_por_id: DataTypes.STRING,
  fecha_creacion: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
  },
  fecha_actualizacion: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
  },
  ruta_codigo_lookup: DataTypes.STRING,  // Descripción de la ruta
  cliente_codigo_lookup: DataTypes.STRING,  // Nombre del cliente
  direccion_codigo_lookup: DataTypes.STRING,  // Código de dirección del cliente
}, {
  tableName: 'detalles_rutas',  // Nombre de la tabla en la base de datos
  timestamps: false,    // Si no deseas que Sequelize gestione automáticamente los campos de fecha
});

DetalleRuta.associate = (models) => {
  // Relación muchos a uno con Ruta
  DetalleRuta.belongsTo(models.Ruta, {
    foreignKey: 'codigo_ruta',  // Relaciona 'codigo_ruta' con 'codigo'
    as: 'ruta',                 // Alias de la relación
  });

  // Relación muchos a uno con Cliente (si es necesario)
  DetalleRuta.belongsTo(models.Clientes, {
    foreignKey: 'codigo_cliente', // Relaciona 'codigo_cliente' con 'codigo_cliente'
    as: 'cliente',               // Alias de la relación
  });
};

module.exports = DetalleRuta;
