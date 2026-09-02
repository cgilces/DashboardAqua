// src/auth/accessToken.js
// Access tokens propios: JWT firmado, vida corta. El mecanismo de sesión
// larga es el refresh token (store.js), no este token — si se filtra un
// access_token, deja de servir solo en minutos, nunca "para siempre".
const crypto = require("crypto");
const jwt = require("jsonwebtoken");

const ACCESS_TOKEN_TTL_SEGUNDOS = 60 * 60; // 1 hora

function firmarAccessToken({ clientId, email }) {
  const secret = process.env.MCP_JWT_SECRET;
  if (!secret) throw new Error("MCP_JWT_SECRET no configurado");
  // `jti` random: sin esto, dos tokens firmados con el mismo payload dentro
  // del mismo segundo (ej. al refrescar) salen BYTE-IDÉNTICOS con HS256 —
  // indistinguibles entre sí para trazabilidad/logs.
  const token = jwt.sign({ clientId, email, scope: "ventas:read", jti: crypto.randomBytes(12).toString("hex") }, secret, {
    expiresIn: ACCESS_TOKEN_TTL_SEGUNDOS,
    issuer: "aqua-mcp-server",
  });
  return { token, expiresIn: ACCESS_TOKEN_TTL_SEGUNDOS };
}

// Devuelve el AuthInfo que espera el SDK (server/auth/types.js), o lanza si
// el token es inválido/expiró — jwt.verify ya valida `exp` por firma.
function verificarAccessToken(token) {
  const secret = process.env.MCP_JWT_SECRET;
  if (!secret) throw new Error("MCP_JWT_SECRET no configurado");
  const payload = jwt.verify(token, secret, { issuer: "aqua-mcp-server" });
  return {
    token,
    clientId: payload.clientId,
    scopes: [payload.scope],
    expiresAt: payload.exp,
    extra: { email: payload.email },
  };
}

module.exports = { firmarAccessToken, verificarAccessToken, ACCESS_TOKEN_TTL_SEGUNDOS };
