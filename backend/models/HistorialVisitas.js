const { Sequelize, DataTypes } = require("sequelize");
const sequelize = require("../db"); // Ajusta según la ubicación de tu archivo db.js

const HistorialVisitas = sequelize.define(
  "HistorialVisitas", // Nombre del modelo
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    fecha_visita: {
      type: DataTypes.DATE, // Almacena la fecha de la visita en formato fecha
      allowNull: false,
    },
    codigo_usuario: {
      type: DataTypes.STRING(50),
      allowNull: false,
    },
    codigo_ruta: {
      type: DataTypes.STRING(50),
      allowNull: true,  // Permite que sea null
    },
    codigo_cliente: {
      type: DataTypes.STRING(50),
      allowNull: true,  // Permite valores nulos
    },
    codigo_direccion_cliente: {
      type: DataTypes.STRING(50),
      allowNull: true, // Puede ser nulo si no se proporciona la dirección
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
      type: DataTypes.STRING(50),
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
      allowNull: true, // 0 = Pendiente, 1 = Completado
    },
    ruptura_secuencia: {
      type: DataTypes.INTEGER,
      allowNull: true, // 0 = No, 1 = Sí
    },
    nombre_cliente: {
      type: DataTypes.STRING(250),
      allowNull: true,
    },
    nombre_empresa_cliente: {
      type: DataTypes.STRING(250),
      allowNull: true,
    },
    nombre_comercial_cliente: {
      type: DataTypes.STRING(250),
      allowNull: true,
    },
    tipo_identificacion_cliente: {
      type: DataTypes.STRING(10),
      allowNull: true,
    },
    numero_identificacion_cliente: {
      type: DataTypes.STRING(20),
      allowNull: true,
    },
    comentario_cliente: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    estado_cliente: {
      type: DataTypes.INTEGER,
      allowNull: true, // 0 = Inactivo, 1 = Activo
    },
    nombre_usuario: {
      type: DataTypes.STRING(250),
      allowNull: true,
    },
    email_usuario: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    email_notificacion_usuario: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    telefono_usuario: {
      type: DataTypes.STRING(50),
      allowNull: true,
    },
    direccion_usuario: {
      type: DataTypes.STRING(500),
      allowNull: true,
    },
    marca_dispositivo_usuario: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    modelo_dispositivo_usuario: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    numero_dispositivo_usuario: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    codigo_rol_usuario: {
      type: DataTypes.STRING(50),
      allowNull: true,
    },
  },
  {
    tableName: "historial_visitas", // Nombre de la tabla en la base de datos
    timestamps: false, // No utilizar los campos `createdAt` y `updatedAt` en la tabla
  }
);




module.exports = HistorialVisitas;
