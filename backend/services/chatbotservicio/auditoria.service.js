// services/chatbotservicio/auditoria.js
const sequelize = require("../../db");
const logger = require("../../utils/logger");

async function registrar(usuario, rol, mensaje, sql) {
  try {
    await sequelize.query(
      `
      INSERT INTO auditoria_chat (usuario, rol, mensaje, sql_generado)
      VALUES (:usuario, :rol, :mensaje, :sql)
      `,
      {
        replacements: {
          usuario,
          rol,
          mensaje,
          sql,
        },
      }
    );
  } catch (error) {
    logger.error("Error registrando auditoría:", error);
    // No lanzar: la auditoría no debe frenar el flujo principal
  }
}

module.exports = { registrar };