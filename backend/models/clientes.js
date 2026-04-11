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
      allowNull: true,
      unique: true,
    },

    company_id: {
      type: DataTypes.STRING(20),
      allowNull: true,
    },

    descripcion_company: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },

    tipo_identificacion_cliente: {
      type: DataTypes.STRING(50),
      allowNull: true,
    },

    identificacion_cliente: {
      type: DataTypes.STRING(30),
      allowNull: true,
    },

    nombre_cliente: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },

    nombre_comercial_cliente: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },

    // 🔥 CLAVE PARA RELACIONES
    codigo_tipo_negocio: {
      type: DataTypes.STRING(50),
      allowNull: true,
    },

    // 🔥 NUEVO (TE FALTABA)
    codigo_subcanal: {
      type: DataTypes.STRING(50),
      allowNull: true,
    },

    contacto_cliente: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },

    codigo_moneda_cliente: {
      type: DataTypes.STRING(3),
      defaultValue: "USD",
    },

    codigo_lista_precio_cliente: {
      type: DataTypes.STRING(50),
      allowNull: true,
    },

    metodo_pago_cliente: {
      type: DataTypes.STRING(50),
      allowNull: true,
    },

    condicion_pago_cliente: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },

    codigo_grupo_cliente: {
      type: DataTypes.STRING(50),
      allowNull: true,
    },

    descuento_cliente: {
      type: DataTypes.DECIMAL(10, 2),
      defaultValue: 0.0,
    },

    objetivo_venta_cliente: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true,
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
      allowNull: true,
    },

    codigo_usuario_asignado_cliente: {
      type: DataTypes.STRING(50),
      allowNull: true,
    },

    // =========================
    // CONTACTO
    // =========================
    email_cliente: {
      type: DataTypes.STRING(500),
      allowNull: true,
    },

    telefono_cliente: {
      type: DataTypes.STRING(50),
      allowNull: true,
    },

    // =========================
    // UBICACIÓN
    // =========================
    direccion_cliente: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },

    ciudad_cliente: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },

    pais_cliente: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },

    industria_cliente: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },

    // =========================
    // GEOLOCALIZACIÓN (MEJORADO)
    // =========================
    latitud_cliente: {
      type: DataTypes.DECIMAL(12, 8), // 🔥 mejor que string
      allowNull: true,
    },

    longitud_cliente: {
      type: DataTypes.DECIMAL(12, 8),
      allowNull: true,
    },

    // =========================
    // VÍNCULO MOBILVENDOR
    // =========================
    mobilvendor_id_cliente: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },

    // =========================
    // FECHAS
    // =========================
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