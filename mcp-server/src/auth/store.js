// src/auth/store.js
// Persistencia del estado de OAuth en Postgres (esquema mcp_oauth, rol de
// mismo nombre — ver oauthDb.js). Todo parametrizado ($1, $2, ...).
const crypto = require("crypto");
const { pool } = require("./oauthDb");

// ── Clientes registrados (Dynamic Client Registration) ──────────────────
// El propio SDK genera client_id/client_secret; acá solo persistimos y
// devolvemos lo mismo, como pide la interfaz OAuthRegisteredClientsStore.
async function getClient(clientId) {
  const { rows } = await pool.query("SELECT data FROM mcp_oauth.clients WHERE client_id = $1", [clientId]);
  return rows[0]?.data;
}

async function registerClient(client) {
  await pool.query(
    "INSERT INTO mcp_oauth.clients (client_id, data) VALUES ($1, $2)",
    [client.client_id, client]
  );
  return client;
}

// ── Refresh tokens ────────────────────────────────────────────────────────
// Nunca se guarda el token en texto plano — solo su hash. Rotación en cada
// uso: al refrescar, el token viejo se revoca y se emite uno nuevo, para que
// un token filtrado deje de servir en cuanto se usa una vez el legítimo.
const REFRESH_TOKEN_TTL_SEGUNDOS = 30 * 24 * 60 * 60; // 30 días

function hashToken(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

async function emitirRefreshToken({ clientId, email }) {
  const token = crypto.randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + REFRESH_TOKEN_TTL_SEGUNDOS * 1000);
  await pool.query(
    "INSERT INTO mcp_oauth.refresh_tokens (token_hash, client_id, email, expires_at) VALUES ($1, $2, $3, $4)",
    [hashToken(token), clientId, email, expiresAt]
  );
  return token;
}

// Valida el refresh token y lo ROTA atómicamente: revoca el viejo y emite
// uno nuevo en la misma transacción, para que no queden dos válidos a la vez.
async function rotarRefreshToken(tokenRecibido) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const { rows } = await client.query(
      `SELECT client_id, email, expires_at, revoked_at
       FROM mcp_oauth.refresh_tokens WHERE token_hash = $1 FOR UPDATE`,
      [hashToken(tokenRecibido)]
    );
    const registro = rows[0];
    if (!registro || registro.revoked_at || registro.expires_at < new Date()) {
      await client.query("ROLLBACK");
      return null;
    }

    await client.query(
      "UPDATE mcp_oauth.refresh_tokens SET revoked_at = now() WHERE token_hash = $1",
      [hashToken(tokenRecibido)]
    );

    const nuevoToken = crypto.randomBytes(32).toString("base64url");
    const expiresAt = new Date(Date.now() + REFRESH_TOKEN_TTL_SEGUNDOS * 1000);
    await client.query(
      "INSERT INTO mcp_oauth.refresh_tokens (token_hash, client_id, email, expires_at) VALUES ($1, $2, $3, $4)",
      [hashToken(nuevoToken), registro.client_id, registro.email, expiresAt]
    );

    await client.query("COMMIT");
    return { token: nuevoToken, clientId: registro.client_id, email: registro.email };
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

// ── Log de intentos de login (auditoría; incluye los rechazados por dominio) ──
async function registrarIntentoLogin({ email, hd, allowed, reason }) {
  await pool.query(
    "INSERT INTO mcp_oauth.login_events (email, hd, allowed, reason) VALUES ($1, $2, $3, $4)",
    [email || null, hd || null, allowed, reason || null]
  );
}

module.exports = {
  getClient,
  registerClient,
  emitirRefreshToken,
  rotarRefreshToken,
  registrarIntentoLogin,
};
