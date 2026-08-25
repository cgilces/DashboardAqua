// src/db.js
// Pool de Postgres con el rol de SOLO LECTURA `mcp_readonly` (GRANT SELECT
// únicamente sobre ordenes, facturas, detalle_documento, clientes, productos).
// Todas las queries del proyecto van parametrizadas ($1, $2, ...) — nunca
// concatenación de valores dentro del texto SQL.
require("dotenv").config();
const { Pool } = require("pg");

const pool = new Pool({
  host: process.env.MCP_DB_HOST,
  port: Number(process.env.MCP_DB_PORT) || 5432,
  database: process.env.MCP_DB_NAME,
  user: process.env.MCP_DB_USER,
  password: process.env.MCP_DB_PASS,
});

module.exports = { pool };
