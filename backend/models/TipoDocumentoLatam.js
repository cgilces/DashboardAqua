// models/tipo_documento_latam.js
const { DataTypes } = require('sequelize');
const sequelize = require('../db');  // Asegúrate de tener la conexión a la base de datos

const TipoDocumentoLatam = sequelize.define('TipoDocumentoLatam', {

  secuencia: {
    type: DataTypes.STRING,
    allowNull: true,
  },

  id_pais: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },

  usuario_creacion: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },

  usuario_actualizacion: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },

  nombre: {
    type: DataTypes.STRING,
    allowNull: false,
  },

  prefijo_codigo_documento: {
    type: DataTypes.STRING(10),
    allowNull: true,
  },

  codigo: {
    type: DataTypes.STRING(10),
    allowNull: true,
  },

  nombre_reporte: {
    type: DataTypes.STRING,
    allowNull: true,
  },

  tipo_interno: {
    type: DataTypes.STRING(50),
    allowNull: true,
  },

  activo: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
  },

  fecha_creacion: {
    type: DataTypes.DATE,
    allowNull: true,
  },

  fecha_actualizacion: {
    type: DataTypes.DATE,
    allowNull: true,
  },

  verificar_formato_ecuador: {
    type: DataTypes.BOOLEAN,
    allowNull: true,
  },

}, {
  tableName: 'tipo_documento_latam',  // Nombre de la tabla en la base de datos
  timestamps: false,  // Desactivar los campos createdAt/updatedAt
});

module.exports = TipoDocumentoLatam;