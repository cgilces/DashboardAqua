// Runner que ejecuta automáticamente los archivos SQL de backend/sql/
// al arrancar el servidor. Diseñado para ser idempotente: cada archivo
// debe usar CREATE TABLE/INDEX IF NOT EXISTS, ALTER TABLE ... IF EXISTS,
// etc., para que sea seguro re-ejecutar en cada deploy.
//
// Uso: en server.js (después de la conexión sequelize):
//   const runStartupSql = require("./utils/runStartupSql");
//   runStartupSql();
//
// Convenciones:
// - Los archivos se ejecutan en orden alfabético del nombre de archivo.
//   Conviene usar prefijo numérico si hay dependencias: 001_xxx.sql, 002_yyy.sql
// - Cada archivo puede tener múltiples statements separados por ';'
// - Líneas que empiecen con '--' son comentarios (se mantienen pero ignorados)
// - Errores de un archivo NO detienen los demás (se loggea y se continúa)

const fs = require("fs");
const path = require("path");
const sequelize = require("../db");

async function runStartupSql() {
  const sqlDir = path.join(__dirname, "..", "sql");
  if (!fs.existsSync(sqlDir)) return;

  const archivos = fs.readdirSync(sqlDir)
    .filter(f => f.endsWith(".sql"))
    .sort(); // orden alfabético/numérico

  if (archivos.length === 0) {
    console.log("📦 [SQL Startup] Sin archivos para ejecutar");
    return;
  }

  console.log(`📦 [SQL Startup] Ejecutando ${archivos.length} archivo(s)...`);

  for (const archivo of archivos) {
    const ruta = path.join(sqlDir, archivo);
    const contenido = fs.readFileSync(ruta, "utf8");

    // Dividir en statements (separados por ';') y limpiar comentarios + vacíos
    const statements = contenido
      .split(";")
      .map(s => s.trim())
      .filter(s => s.length > 0)
      .filter(s => !s.split("\n").every(line => line.trim().startsWith("--")));

    let exitos = 0, errores = 0;
    for (const stmt of statements) {
      try {
        await sequelize.query(stmt);
        exitos++;
      } catch (err) {
        errores++;
        // Solo log warning si el error NO es "ya existe" (esperado en re-ejecuciones)
        const msg = err.message || "";
        const esIdempotente = /already exists|ya existe|duplicate/i.test(msg);
        if (!esIdempotente) {
          console.error(`   ⚠ ${archivo}: ${msg.slice(0, 200)}`);
        }
      }
    }

    if (errores === 0) {
      console.log(`   ✅ ${archivo} (${exitos} statement${exitos !== 1 ? 's' : ''})`);
    } else {
      console.log(`   ⚠ ${archivo}: ${exitos} ok, ${errores} con warning (probable idempotencia)`);
    }
  }

  console.log("📦 [SQL Startup] Listo");
}

module.exports = runStartupSql;
