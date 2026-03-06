const { DataTypes } = require("sequelize");
const sequelize = require("../db");

const Cliente = sequelize.define(
  "Cliente",
  {
    id_cliente: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },

    codigo_cliente: {
      type: DataTypes.STRING(255),
      allowNull: true,  // Permite que sea nulo
      unique: true,
    },
    company_id: { // Aquí se agrega la columna company_id
      type: DataTypes.STRING(20),
      allowNull: true, // Puedes cambiarlo a `false` si es obligatorio
    },

    descripcion_company: {
      type: DataTypes.STRING(100),
      allowNull: true, // Puedes cambiarlo a `false` si es obligatorio
    },

    tipo_identificacion_cliente: {
      type: DataTypes.STRING(50),
      allowNull: true,  // Permitir nulos
    },

    identificacion_cliente: {
      type: DataTypes.STRING(30),
      allowNull: true,  // Permite que sea nulo
    },

    nombre_cliente: {
      type: DataTypes.STRING(255),
      allowNull: true,  // Permite que sea nulo
    },

    nombre_comercial_cliente: {
      type: DataTypes.STRING(255),
      allowNull: true,  // Permite que sea nulo
    },

    codigo_tipo_negocio: {
      type: DataTypes.STRING(50),
      allowNull: true,
    },

    contacto_cliente: {
      type: DataTypes.STRING(255),
      allowNull: true,  // Permite que sea nulo
    },

    codigo_moneda_cliente: {
      type: DataTypes.STRING(3),
      defaultValue: "USD",
    },

    codigo_lista_precio_cliente: {
      type: DataTypes.STRING(50),
      allowNull: true,  // Permite que sea nulo
    },

    metodo_pago_cliente: {
      type: DataTypes.STRING(50),
      allowNull: true,  // Permite que sea nulo
    },

    codigo_grupo_cliente: {
      type: DataTypes.STRING(50),
      allowNull: true,  // Permite que sea nulo
    },

    descuento_cliente: {
      type: DataTypes.DECIMAL(10, 2),
      defaultValue: 0.0,
    },

    objetivo_venta_cliente: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true,  // Permite que sea nulo
    },

    saldo_cliente: {
      type: DataTypes.DECIMAL(10, 2),
      defaultValue: 0.0,
    },

    tiene_credito_cliente: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },

    tiene_documentos_cliente: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
    },

    estado_cliente: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
    },

    estado_proceso_cliente: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
    },

    nacionalidad_cliente: {
      type: DataTypes.STRING(50),
      allowNull: true,  // Permite que sea nulo
    },

    codigo_usuario_asignado_cliente: {
      type: DataTypes.STRING(50),
      allowNull: true,  // Permite que sea nulo
    },

    fecha_creacion_cliente: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
    },

    fecha_actualizacion_cliente: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
    },
  },
  {
    tableName: "clientes",
    timestamps: false,
  }
);

module.exports = Cliente;