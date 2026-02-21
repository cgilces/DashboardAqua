const sequelize = require("../../db");
const logger = require("../../utils/logger");

async function ejecutarSQL(sql) {
  const isDev = process.env.NODE_ENV !== "production";

  try {
    if (isDev) console.log("🗄 ejecutarSQL() SQL recibido:", sql);

    // IMPORTANTE: Sequelize devuelve [results, metadata]
    const [results] = await sequelize.query(sql);

    // Normalizar: siempre devolver array
    const filas = Array.isArray(results) ? results : (results ? [results] : []);

    if (isDev) {
      console.log("🗄 ejecutarSQL() tipo results:", typeof results);
      console.log("🗄 ejecutarSQL() esArray(results):", Array.isArray(results));
      console.log("🗄 ejecutarSQL() filas.length:", filas.length);
      console.log("🗄 ejecutarSQL() primer registro:", filas[0]);
    }

    logger.info(`Ejecutando SQL: ${sql}`);

    return filas;
  } catch (error) {
    logger.error("Error ejecutando SQL:");
    logger.error(error.message);
    if (isDev) console.error("❌ ejecutarSQL() error completo:", error);
    throw error;
  }
}

module.exports = { ejecutarSQL };