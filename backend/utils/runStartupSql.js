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

// ─────────────────────────────────────────────────────────────────────────────
// SPLITTER DE STATEMENTS SQL — consciente de:
//   • comentarios de línea  -- ...
//   • comentarios de bloque  /* ... */
//   • strings con comillas simples  '...'  (con escape '')
//   • dollar-quoting  $$ ... $$  y  $tag$ ... $tag$  (cuerpos de funciones plpgsql,
//     bloques DO, triggers). Sin esto, partir por ';' rompe los CREATE FUNCTION /
//     DO $$ ... END $$ del esquema.
// Divide solo en los ';' de nivel superior.
// ─────────────────────────────────────────────────────────────────────────────
function splitSqlStatements(sql) {
  const statements = [];
  let buf = "";
  let i = 0;
  const n = sql.length;

  while (i < n) {
    const ch = sql[i];
    const next = sql[i + 1];

    // Comentario de línea
    if (ch === "-" && next === "-") {
      const nl = sql.indexOf("\n", i);
      const end = nl === -1 ? n : nl;
      buf += sql.slice(i, end);
      i = end;
      continue;
    }
    // Comentario de bloque
    if (ch === "/" && next === "*") {
      const close = sql.indexOf("*/", i + 2);
      const end = close === -1 ? n : close + 2;
      buf += sql.slice(i, end);
      i = end;
      continue;
    }
    // String con comillas simples
    if (ch === "'") {
      let j = i + 1;
      while (j < n) {
        if (sql[j] === "'" && sql[j + 1] === "'") { j += 2; continue; } // '' escape
        if (sql[j] === "'") { j += 1; break; }
        j += 1;
      }
      buf += sql.slice(i, j);
      i = j;
      continue;
    }
    // Dollar-quoting: $$ ... $$ o $tag$ ... $tag$
    if (ch === "$") {
      const m = sql.slice(i).match(/^\$[A-Za-z0-9_]*\$/);
      if (m) {
        const tag = m[0];
        const close = sql.indexOf(tag, i + tag.length);
        const end = close === -1 ? n : close + tag.length;
        buf += sql.slice(i, end);
        i = end;
        continue;
      }
    }
    // Fin de statement
    if (ch === ";") {
      statements.push(buf.trim());
      buf = "";
      i += 1;
      continue;
    }
    buf += ch;
    i += 1;
  }
  if (buf.trim()) statements.push(buf.trim());

  // Descartar vacíos y los que son solo comentarios
  return statements
    .filter(s => s.length > 0)
    .filter(s => !s.split("\n").every(line => {
      const t = line.trim();
      return t === "" || t.startsWith("--");
    }));
}

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

    const statements = splitSqlStatements(contenido);

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
