// services/chatbotservicio/auditoria.js
const sequelize = require("../../db");
const logger = require("../../utils/logger");

async function registrar(usuario, rol, mensaje, sql, filas = null, ms = null) {
  try {
    await sequelize.query(
      `
      INSERT INTO auditoria_chat (usuario, rol, mensaje, sql_generado, filas_resultado, tiempo_ms)
      VALUES (:usuario, :rol, :mensaje, :sql, :filas, :ms)
      `,
      {
        replacements: {
          usuario,
          rol,
          mensaje,
          sql,
          filas,
          ms,
        },
      }
    );
  } catch (error) {
    logger.error("Error registrando auditoría:", error);
    // No lanzar: la auditoría no debe frenar el flujo principal
  }
}

module.exports = { registrar };