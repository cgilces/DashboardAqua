const { DataTypes } = require("sequelize");
const sequelize = require("../db");

const DetalleDocumento = sequelize.define(
  "DetalleDocumento",
  {
    id_detalle: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true
    },

    documento_code: {
      type: DataTypes.STRING,
      allowNull: false
    },

    codigo_producto: {
      type: DataTypes.STRING,
      allowNull: true
    },

    descripcion: {
      type: DataTypes.TEXT,
      allowNull: true
    },

    // =========================
    // CANTIDADES
    // =========================
    cantidad: {
      type: DataTypes.DECIMAL(18, 2),
      allowNull: true
    },

    cantidad_entregada: {
      type: DataTypes.DECIMAL(18, 2),
      allowNull: true
    },

    cantidad_facturada: {
      type: DataTypes.DECIMAL(18, 2),
      allowNull: true
    },

    cantidad_pendiente_entregar: {
      type: DataTypes.DECIMAL(18, 2),
      allowNull: true
    },

    cantidad_pendiente_facturar: {
      type: DataTypes.DECIMAL(18, 2),
      allowNull: true
    },

    // =========================
    // PRECIOS
    // =========================
    precio: {
      type: DataTypes.DECIMAL(18, 2),
      allowNull: true
    },

    descuento_linea: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true
    },

    subtotal: {
      type: DataTypes.DECIMAL(18, 2),
      allowNull: true
    },

    total: {
      type: DataTypes.DECIMAL(18, 2),
      allowNull: true
    },

    iva: {
      type: DataTypes.DECIMAL(18, 2),
      allowNull: true
    },

    precio_con_impuesto: {
      type: DataTypes.DECIMAL(18, 2),
      allowNull: true
    },

    precio_sin_impuesto: {
      type: DataTypes.DECIMAL(18, 2),
      allowNull: true
    },

    impuesto_linea: {
      type: DataTypes.DECIMAL(18, 2),
      allowNull: true
    },

    // =========================
    // CLASIFICACIÓN
    // =========================
    unit_alias: {
      type: DataTypes.STRING,
      allowNull: true
    },

    barcode: {
      type: DataTypes.STRING,
      allowNull: true
    },

    codigo_categoria: {
      type: DataTypes.STRING,
      allowNull: true
    },

    descripcion_categoria: {
      type: DataTypes.STRING,
      allowNull: true
    },

    // =========================
    // ESTADOS
    // =========================
    estado_facturacion_linea: {
      type: DataTypes.STRING,
      allowNull: true
    },

    estado_odoo_linea: {
      type: DataTypes.STRING,
      allowNull: true
    },

    // =========================
    // FLAGS
    // =========================
    es_anticipo: {
      type: DataTypes.BOOLEAN,
      allowNull: true,
      defaultValue: false
    },

    es_envio: {
      type: DataTypes.BOOLEAN,
      allowNull: true,
      defaultValue: false
    },
    // =========================
    // DESNORMALIZADOS (evitan JOINs en dashboard)
    // =========================
    producto_nombre: {
      type: DataTypes.STRING,
      allowNull: true
    },

    producto_categoria: {
      type: DataTypes.STRING,
      allowNull: true
    },

    producto_codigo_interno: {
      type: DataTypes.STRING,
      allowNull: true
    },

    // =========================
    // MARGEN
    // =========================
    margen_linea: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: true,
      defaultValue: 0
    },

    margen_porcentaje_linea: {
      type: DataTypes.DECIMAL(6, 2),
      allowNull: true,
      defaultValue: 0
    },

    // =========================
    // OTROS
    // =========================
    unidad_medida: {
      type: DataTypes.STRING(50),
      allowNull: true
    },

    secuencia: {
      type: DataTypes.INTEGER,
      allowNull: true,
      defaultValue: 0
    },

  },
  {
    tableName: "detalle_documento",
    timestamps: false,
  }
);

module.exports = DetalleDocumento;