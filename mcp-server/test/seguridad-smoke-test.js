// test/seguridad-smoke-test.js
// Confirma que un intento de inyección SQL en `ruta` es rechazado por la
// regex de zod ANTES de tocar la base, y que si por algún motivo llegara a
// la query, los parámetros posicionales de pg lo tratan como texto literal
// (nunca como SQL ejecutable).
require("dotenv").config();
const { z } = require("zod");
const { ventasPorRuta, inputSchema } = require("../src/tools/ventasPorRuta");
const { ventasPorGrupo, totalesGrupo, totalesPreventa, inputSchema: inputSchemaGrupo } = require("../src/tools/ventasPorGrupo");
const { pool } = require("../src/db");

async function main() {
  const payload = "T2'; DROP TABLE ordenes; --";

  // 1) La regex de zod debe rechazar el payload antes de llegar a la query.
  const schema = z.object(inputSchema);
  const parseo = schema.safeParse({ ruta: payload, fecha_inicio: "2026-01-01", fecha_fin: "2026-01-31" });
  if (parseo.success) throw new Error("FALLO: zod aceptó un payload de inyección");
  console.log("OK: zod rechazó el payload de inyección en `ruta` ->", parseo.error.issues[0].message);

  // 2) Aunque alguien se salte la validación de zod, pg debe tratarlo como
  //    texto literal (parámetro posicional), no como SQL. No debe lanzar
  //    error de sintaxis ni afectar la tabla.
  const resultado = await ventasPorRuta({ ruta: payload, fecha_inicio: "2026-01-01", fecha_fin: "2026-01-31" });
  console.log("OK: la query no lanzó error de sintaxis, se ejecutó como texto literal ->", JSON.stringify(resultado));

  const { rows } = await pool.query("SELECT to_regclass('ordenes') AS existe");
  if (!rows[0].existe) throw new Error("FALLO: la tabla ordenes ya no existe (inyección exitosa)");
  console.log("OK: la tabla `ordenes` sigue existiendo intacta.");

  // 3) Nuevos parámetros de ventasPorGrupo (categoria, grupo=PREVENTA):
  //    ambos son enums cerrados de zod — un payload de inyección ni siquiera
  //    matchea un valor válido del enum, se rechaza antes de la query.
  const payloadCategoria = "DESCARTABLE'; DROP TABLE detalle_documento; --";
  const schemaGrupo = z.object(inputSchemaGrupo);
  const parseoCategoria = schemaGrupo.safeParse({
    grupo: "MAYORISTA",
    categoria: payloadCategoria,
    fecha_inicio: "2026-01-01",
    fecha_fin: "2026-01-31",
  });
  if (parseoCategoria.success) throw new Error("FALLO: zod aceptó un payload de inyección en `categoria`");
  console.log("OK: zod rechazó el payload de inyección en `categoria` ->", parseoCategoria.error.issues[0].message);

  // 4) Aunque alguien se salte zod y llame la función interna directo con el
  //    payload como `categoria` (bypaseando el enum), pg debe seguir
  //    tratándolo como texto literal — se usa como parámetro posicional
  //    ($4/$3) en ambas queries (la genérica y la de PREVENTA).
  const resultadoCategoria = await totalesGrupo("MAYORISTA", "2026-01-01 00:00:00", "2026-01-31 00:00:00", payloadCategoria);
  console.log("OK: totalesGrupo con categoria maliciosa no lanzó error de sintaxis ->", JSON.stringify(resultadoCategoria.totales));

  const resultadoPreventa = await totalesPreventa("2026-01-01 00:00:00", "2026-01-31 00:00:00", payloadCategoria);
  console.log("OK: totalesPreventa con categoria maliciosa no lanzó error de sintaxis ->", JSON.stringify(resultadoPreventa.totales));

  const { rows: rowsDD } = await pool.query("SELECT to_regclass('detalle_documento') AS existe");
  if (!rowsDD[0].existe) throw new Error("FALLO: la tabla detalle_documento ya no existe (inyección exitosa)");
  console.log("OK: la tabla `detalle_documento` sigue existiendo intacta.");

  await pool.end();
  console.log("\nSEGURIDAD SMOKE TEST OK");
}

main().catch((err) => {
  console.error("SEGURIDAD SMOKE TEST FALLÓ:", err);
  process.exit(1);
});
