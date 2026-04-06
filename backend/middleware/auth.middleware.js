const jwt = require("jsonwebtoken");
const config = require("../config/index"); // Mejor que "../db"
const logger = require("../utils/logger");

function verificarToken(req, res, next) {
  const isDev = process.env.NODE_ENV !== "production";

  try {
    if (isDev) console.log("----- VERIFICANDO TOKEN -----");

    const authHeader = req.headers.authorization;

    if (isDev) console.log("Authorization Header:", authHeader);

    if (!authHeader) {
      if (isDev) console.log("❌ No se encontró header Authorization");

      return res.status(401).json({
        error: "No autorizado",
        message: "Token no proporcionado"
      });
    }

    if (!authHeader.startsWith("Bearer ")) {
      if (isDev) console.log("❌ Formato inválido, no es Bearer");

      return res.status(401).json({
        error: "Formato inválido",
        message: "El token debe ser tipo Bearer"
      });
    }

    const token = authHeader.split(" ")[1];

    if (!token) {
      if (isDev) console.log("❌ Token vacío");

      return res.status(401).json({
        error: "Token vacío"
      });
    }

    if (isDev) console.log("Token recibido (parcial):", token.substring(0, 15) + "...");

    const decoded = jwt.verify(token, config.JWT_SECRET, {
      algorithms: ["HS256"]
    });

    if (isDev) console.log("✅ Token decodificado:", decoded);

    req.user = decoded;

    next();

  } catch (error) {

    if (isDev) console.log("❌ Error verificando token:", error.message);

    logger.warn({
      tipo: "JWT_ERROR",
      mensaje: error.message
    });

    if (error.name === "TokenExpiredError") {
      return res.status(401).json({
        error: "Token expirado"
      });
    }

    return res.status(401).json({
      error: "Token inválido"
    });
  }
}

// Middleware opcional: no bloquea si no hay token, solo popula req.user si hay uno válido
function verificarTokenOpcional(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith("Bearer ")) {
      const token = authHeader.split(" ")[1];
      if (token) {
        try {
          const decoded = jwt.verify(token, config.JWT_SECRET, { algorithms: ["HS256"] });
          req.user = decoded;
        } catch (_) {
          // token inválido o expirado — se ignora, req.user permanece undefined
        }
      }
    }
  } catch (_) {}
  next();
}

module.exports = { verificarToken, verificarTokenOpcional };