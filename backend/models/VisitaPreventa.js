// models/historialVisitas.js
const { DataTypes } = require("sequelize");
const sequelize = require("../db");

const HistorialVisitas = sequelize.define(
  "HistorialVisitas",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,  // Auto incremento para la clave primaria
    },

    fecha_visita: {
      type: DataTypes.DATE,
      allowNull: false,
    },

    codigo_usuario: {
      type: DataTypes.STRING,
      allowNull: false,
    },

    codigo_ruta: {
      type: DataTypes.STRING,
      allowNull: false,
    },

    codigo_cliente: {
      type: DataTypes.STRING,
      allowNull: false,
    },

    codigo_direccion_cliente: {
      type: DataTypes.STRING,
      allowNull: true,
    },

    semana: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },

    dia: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },

    accion: {
      type: DataTypes.STRING,
      allowNull: true,
    },

    comentario: {
      type: DataTypes.TEXT,
      allowNull: true,
    },

    monto: {
      type: DataTypes.DECIMAL(18, 2),
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

    estado_proceso: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },

    ruptura_secuencia: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },

    nombre_cliente: {
      type: DataTypes.STRING,
      allowNull: true,
    },

    nombre_empresa_cliente: {
      type: DataTypes.STRING,
      allowNull: true,
    },

    nombre_comercial_cliente: {
      type: DataTypes.STRING,
      allowNull: true,
    },

    tipo_identificacion_cliente: {
      type: DataTypes.STRING,
      allowNull: true,
    },

    numero_identificacion_cliente: {
      type: DataTypes.STRING,
      allowNull: true,
    },

    comentario_cliente: {
      type: DataTypes.TEXT,
      allowNull: true,
    },

    estado_cliente: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },

    nombre_usuario: {
      type: DataTypes.STRING,
      allowNull: true,
    },

    email_usuario: {
      type: DataTypes.STRING,
      allowNull: true,
    },

    email_notificacion_usuario: {
      type: DataTypes.STRING,
      allowNull: true,
    },

    telefono_usuario: {
      type: DataTypes.STRING,
      allowNull: true,
    },

    direccion_usuario: {
      type: DataTypes.STRING,
      allowNull: true,
    },

    marca_dispositivo_usuario: {
      type: DataTypes.STRING,
      allowNull: true,
    },

    modelo_dispositivo_usuario: {
      type: DataTypes.STRING,
      allowNull: true,
    },

    numero_dispositivo_usuario: {
      type: DataTypes.STRING,
      allowNull: true,
    },

    codigo_rol_usuario: {
      type: DataTypes.STRING,
      allowNull: true,
    },
  },
  {
    tableName: "historial_visitas",  // Nombre de la tabla
    timestamps: false,  // No usamos `createdAt` y `updatedAt`
    indexes: [
      {
        unique: true,  // Crear un índice único
        fields: ["codigo_cliente", "codigo_ruta", "fecha_visita"],  // En estos campos
      },
    ],
  }
);

module.exports = HistorialVisitas;
