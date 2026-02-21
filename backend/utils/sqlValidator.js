function validarSQL(sql) {
  console.log("🔎 Validando SQL...");

  if (!sql) return false;

  const prohibidas = ["INSERT", "UPDATE", "DELETE", "DROP", "ALTER", "TRUNCATE"];

  for (let palabra of prohibidas) {
    if (sql.toUpperCase().includes(palabra)) {
      console.log("❌ Contiene palabra prohibida:", palabra);
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