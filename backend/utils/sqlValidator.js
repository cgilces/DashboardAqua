// Tablas del sistema PostgreSQL que nunca deben ser consultadas
const TABLAS_SISTEMA = [
  "pg_catalog", "pg_tables", "pg_stat", "pg_user", "pg_shadow",
  "pg_auth", "pg_roles", "information_schema", "pg_class",
  "pg_namespace", "pg_attribute", "pg_proc", "pg_trigger",
  "pg_index", "pg_constraint", "pg_depend",
];

function validarSQL(sql) {
  console.log("🔎 Validando SQL...");

  if (!sql) return false;

  const prohibidas = [
    "INSERT", "UPDATE", "DELETE", "DROP", "ALTER", "TRUNCATE",
    "EXEC", "EXECUTE", "GRANT", "REVOKE", "CREATE", "MERGE",
    "CALL", "LOAD", "COPY", "BEGIN", "COMMIT", "ROLLBACK",
    "UNION",   // evita combinar resultados con tablas no autorizadas
  ];

  const sqlUpper = sql.toUpperCase();

  for (const palabra of prohibidas) {
    const regex = new RegExp(`\\b${palabra}\\b`);
    if (regex.test(sqlUpper)) {
      console.log("❌ Contiene palabra prohibida:", palabra);
      return false;
    }
  }

  // Bloquear acceso a tablas del sistema de PostgreSQL
  const sqlLower = sql.toLowerCase();
  for (const tabla of TABLAS_SISTEMA) {
    if (sqlLower.includes(tabla)) {
      console.log("❌ Acceso a tabla de sistema bloqueado:", tabla);
      return false;
    }
  }

  if (!sql.trim().toUpperCase().startsWith("SELECT")) {
    console.log("❌ No es SELECT");
    return false;
  }

  console.log("✅ SQL válido");
  return true;
}

function aplicarLimite(sql, limite = 200) {
  console.log("📏 Aplicando límite...");

  sql = sql.trim().replace(/;$/, "");

  if (/LIMIT\s+\d+/i.test(sql)) {
    console.log("ℹ Ya tiene LIMIT");
    return sql;
  }

  const finalSQL = `${sql} LIMIT ${limite}`;
  console.log("📜 SQL con límite:", finalSQL);

  return finalSQL;
}

module.exports = { validarSQL, aplicarLimite };