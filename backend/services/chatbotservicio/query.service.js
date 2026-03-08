// services/chatbotservicio/ejecutarSQL.js
const sequelize = require("../../db");
const logger = require("../../utils/logger");

const LIMITE_SEGURIDAD = 5000; // máximo de filas si el SQL no trae LIMIT propio

async function ejecutarSQL(sql, limite = LIMITE_SEGURIDAD) {
  const isDev = process.env.NODE_ENV !== "production";

  try {
    if (isDev) console.log("🗄 ejecutarSQL() SQL recibido:", sql);

    // Inyectar LIMIT de seguridad solo si el SQL no trae uno propio
    const sqlFinal = /\bLIMIT\b/i.test(sql)
      ? sql
      : `${sql} LIMIT ${limite}`;

    if (isDev && sqlFinal !== sql) {
      console.log(`🗄 ejecutarSQL() LIMIT ${limite} inyectado automáticamente`);
    }

    // QueryTypes.SELECT devuelve array plano de objetos sin el par [results, metadata]
    // Esto evita el comportamiento inconsistente de sequelize.query() según versión/driver
    const filas = await sequelize.query(sqlFinal, {
      type: sequelize.QueryTypes.SELECT,
    });

    const resultado = Array.isArray(filas) ? filas : [];

    if (isDev) {
      console.log("🗄 ejecutarSQL() filas recibidas:", resultado.length);
      console.log("🗄 ejecutarSQL() primer registro:", resultado[0]);
    }

    logger.info(`SQL ejecutado (${resultado.length} filas): ${sqlFinal}`);

    return resultado;

  } catch (error) {
    logger.error("Error ejecutando SQL:", error.message);
    if (isDev) console.error("❌ ejecutarSQL() error completo:", error);
    throw error;
  }
}

module.exports = { ejecutarSQL };