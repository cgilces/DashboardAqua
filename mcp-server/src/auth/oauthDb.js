// src/auth/oauthDb.js
// Pool de Postgres separado para el ESTADO de OAuth (clientes registrados,
// refresh tokens, log de intentos de login). Rol `mcp_oauth`, con permisos
// acotados SOLO al esquema `mcp_oauth` — no tiene ningún acceso a las tablas
// de ventas (esas las sigue leyendo exclusivamente el rol `mcp_readonly` de
// ../db.js). Dos roles, dos superficies de riesgo separadas.
require("dotenv").config();
const { Pool } = require("pg");

const pool = new Pool({
  host: process.env.MCP_OAUTH_DB_HOST || process.env.MCP_DB_HOST,
  port: Number(process.env.MCP_OAUTH_DB_PORT || process.env.MCP_DB_PORT) || 5432,
  database: process.env.MCP_OAUTH_DB_NAME || process.env.MCP_DB_NAME,
  user: process.env.MCP_OAUTH_DB_USER,
  password: process.env.MCP_OAUTH_DB_PASS,
});

module.exports = { pool };
