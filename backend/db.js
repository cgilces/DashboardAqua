const { Sequelize } = require("sequelize");

const sequelize = new Sequelize(
  process.env.DB_NAME || "ventas_mv",   // Nombre de la base de datos
  process.env.DB_USER || "postgres",    // Usuario de la base de datos
  process.env.DB_PASS || "Aqua1992.",   // Contraseña de la base de datos
  {
    host: process.env.DB_HOST || "localhost",
    dialect: "postgres",
    logging: false,  // Opcional: para desactivar los logs de Sequelize
  }
);

module.exports = sequelize;
