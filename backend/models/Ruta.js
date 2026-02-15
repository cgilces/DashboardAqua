const { DataTypes } = require('sequelize');
const sequelize = require('../db');

const Ruta = sequelize.define('Ruta', {
  codigo: {
    type: DataTypes.STRING,
    primaryKey: true,  // Esto asegura que la columna 'codigo' sea clave primaria
    allowNull: false,
    unique: true, // Aquí estamos asegurando que 'codigo' sea único
  },
  descripcion: DataTypes.STRING,
  tipo: DataTypes.INTEGER,
  estado: DataTypes.INTEGER,
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
}, {
  tableName: 'rutas',  // Nombre de la tabla en la base de datos
  timestamps: false,   // Si no deseas que Sequelize gestione automáticamente los campos de fecha
  indexes: [
    {
      unique: true,
      fields: ['codigo'] // Este índice asegura que 'codigo' sea único
    }
  ]
});

Ruta.associate = (models) => {
  // Relación uno a muchos con DetalleRuta
  Ruta.hasMany(models.DetalleRuta, {
    foreignKey: 'codigo_ruta',  // Relaciona 'codigo_ruta' con 'codigo'
    as: 'detalles_rutas',       // Alias de la relación
  });
};

module.exports = Ruta;
