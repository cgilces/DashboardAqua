const { Sequelize } = require("sequelize");

// Configuración de la conexión con la base de datos
const sequelize = new Sequelize(
  process.env.DB_NAME || "ventas_mv",  // Nombre de la base de datos
  process.env.DB_USER || "postgres",   // Usuario de la base de datos
  process.env.DB_PASS || "Aqua1992.",  // Contraseña de la base de datos
  {
    host: process.env.DB_HOST || "localhost",  // Host de la base de datos
    dialect: "postgres",  // Tipo de base de datos
    logging: false,  // Desactivar logs de Sequelize
  }
);

// Verificar la conexión con la base de datos
sequelize.authenticate()
  .then(() => {
    console.log('Conexión a la base de datos establecida correctamente.');
  })
  .catch((error) => {
    console.error('No se pudo conectar a la base de datos:', error);
  });

module.exports = sequelize;  // Exportar el objeto sequelize
