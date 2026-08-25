// test/diasFestivos-sync.test.js
// mcp-server necesita su propia copia de backend/utils/diasFestivos.js (es un
// proyecto Node separado, sin acceso a los módulos del backend) — pero eso
// crea una fuente de verdad duplicada: si alguien actualiza los feriados en
// el backend (ej. feriados 2027) y se olvida de esta copia, la proyección
// mensual del MCP empieza a dar un número distinto al del dashboard sin que
// nadie lo note. Este test compara el contenido BYTE A BYTE de ambos
// archivos y falla explícito si se desincronizan.
const fs = require("fs");
const path = require("path");
const assert = require("assert");

const COPIA = path.join(__dirname, "..", "src", "util", "diasFestivos.js");
const ORIGINAL = path.join(__dirname, "..", "..", "backend", "utils", "diasFestivos.js");

function main() {
  const contenidoCopia = fs.readFileSync(COPIA, "utf8");
  const contenidoOriginal = fs.readFileSync(ORIGINAL, "utf8");

  assert.strictEqual(
    contenidoCopia,
    contenidoOriginal,
    `\nmcp-server/src/util/diasFestivos.js está DESINCRONIZADO de backend/utils/diasFestivos.js.\n` +
      `Copiá de nuevo: cp ${ORIGINAL} ${COPIA}\n` +
      `(la proyección mensual del MCP server usa esta copia — si difiere del backend,\n` +
      `puede dar un número de proyección distinto al que muestra el dashboard).`
  );

  console.log("OK: mcp-server/src/util/diasFestivos.js está sincronizado byte a byte con backend/utils/diasFestivos.js");
}

main();
