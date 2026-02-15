const { DataTypes } = require("sequelize");
const sequelize = require("../db");

// Asegúrate de que este import esté correcto
const Factura = sequelize.define("Factura", {
  code: {
    type: DataTypes.STRING,
    primaryKey: true,
    allowNull: false,
  },
  type: DataTypes.INTEGER, // 1 = Factura
  status: DataTypes.INTEGER, // 2 = Confirmado, etc.
  fecha_creacion: DataTypes.DATE,
  fecha_autorizacion: DataTypes.DATE,
  fecha_entrega: DataTypes.DATE,
  customer_code: DataTypes.STRING,
  customer_address_code : DataTypes.STRING,
  route_code: DataTypes.STRING, // Relacionado con ruta_preventas.codigo_ruta
  seller_code: DataTypes.STRING,
  total: DataTypes.DECIMAL(18, 2),
  subtotal: DataTypes.DECIMAL(18, 2),
  iva: DataTypes.DECIMAL(18, 2),
  discount: DataTypes.DECIMAL(18, 2),
  parent_id: DataTypes.STRING, // Puede ser null en facturas
  auth_code: DataTypes.STRING, // Código de autorización SRI
  access_key: DataTypes.STRING, // Clave de acceso SRI
  latitude: DataTypes.DECIMAL(12, 8),
  longitude: DataTypes.DECIMAL(12, 8),
  notes: DataTypes.TEXT,
  customer_address_code: {
    type: DataTypes.STRING(255),
    allowNull: true, // Puedes hacerla opcional, dependiendo de tu necesidad
  },
}, {
  tableName: "facturas",
  timestamps: false,
});

module.exports = Factura;
