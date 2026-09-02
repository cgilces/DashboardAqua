// test/seguridad-smoke-test.js
// Confirma que un intento de inyección SQL en `ruta` es rechazado por la
// regex de zod ANTES de tocar la base, y que si por algún motivo llegara a
// la query, los parámetros posicionales de pg lo tratan como texto literal
// (nunca como SQL ejecutable).
require("dotenv").config();
const { z } = require("zod");
const { ventasPorRuta, inputSchema } = require("../src/tools/ventasPorRuta");
const { ventasPorGrupo, totalesGrupo, totalesPreventa, inputSchema: inputSchemaGrupo } = require("../src/tools/ventasPorGrupo");
const { ventasCliente } = require("../src/tools/ventasCliente");
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

  // 5) ventasCliente: `nombre_cliente` es un string libre (no un enum
  //    cerrado como los de arriba) validado solo por largo mínimo — así que
  //    un payload de inyección SÍ pasa zod y llega hasta la query ILIKE.
  //    Ahí es donde el parámetro posicional de pg debe protegerlo de verdad.
  const payloadNombre = "JAVIER'; DROP TABLE clientes; --";
  const resultadoCliente = await ventasCliente({
    nombre_cliente: payloadNombre,
    fecha_inicio: "2026-01-01",
    fecha_fin: "2026-01-31",
  });
  console.log("OK: ventasCliente con nombre_cliente malicioso no lanzó error de sintaxis ->", JSON.stringify(resultadoCliente));
  if (resultadoCliente.encontrado !== false || resultadoCliente.motivo !== "sin_coincidencias_cliente") {
    throw new Error("FALLO: se esperaba sin_coincidencias_cliente (nadie se llama así), llegó algo distinto");
  }
  // El mismo payload también llega, en texto crudo (sin el wrapping %...%
  // de ILIKE), al fallback de sugerencias por similitud (pg_trgm) — debe
  // seguir sin lanzar error de sintaxis y sin generar sugerencias (no se
  // parece a ningún nombre real).
  if (!Array.isArray(resultadoCliente.sugerencias) || resultadoCliente.sugerencias.length !== 0) {
    throw new Error("FALLO: se esperaba sugerencias vacío para un payload de inyección sin parecido real");
  }
  console.log("OK: el fallback de sugerencias (pg_trgm) con el mismo payload no lanzó error de sintaxis y no sugirió nada.");

  const { rows: rowsClientes } = await pool.query("SELECT to_regclass('clientes') AS existe");
  if (!rowsClientes[0].existe) throw new Error("FALLO: la tabla clientes ya no existe (inyección exitosa)");
  console.log("OK: la tabla `clientes` sigue existiendo intacta.");

  // 6) `producto` (nuevo, mismo patrón que nombre_cliente): string libre,
  //    llega a la query ILIKE contra `productos`.
  const payloadProducto = "PACK'; DROP TABLE productos; --";
  // Nombre completo y específico (no solo "...JAVIER") porque desde el fix
  // de búsqueda fuzzy ya existe otro cliente real que también matchea el
  // nombre corto ("...JAVIER-CASA DE RETIROS") y el test necesita resolver
  // a UN solo cliente antes de llegar al payload de `producto`.
  const resultadoProducto = await ventasCliente({
    nombre_cliente: "UNIDAD EDUCATIVA PARTICULAR JAVIER-CASA DE RETIROS",
    fecha_inicio: "2026-01-01",
    fecha_fin: "2026-01-31",
    producto: payloadProducto,
  });
  console.log("OK: ventasCliente con producto malicioso no lanzó error de sintaxis ->", JSON.stringify(resultadoProducto));
  if (resultadoProducto.encontrado !== false || resultadoProducto.motivo !== "sin_coincidencias_producto") {
    throw new Error("FALLO: se esperaba sin_coincidencias_producto, llegó algo distinto");
  }

  const { rows: rowsProductos } = await pool.query("SELECT to_regclass('productos') AS existe");
  if (!rowsProductos[0].existe) throw new Error("FALLO: la tabla productos ya no existe (inyección exitosa)");
  console.log("OK: la tabla `productos` sigue existiendo intacta.");

  // 7) `codigo_cliente` (nuevo, array de texto libre): va a la query como
  //    `= ANY($1::text[])` — un payload de inyección dentro del array debe
  //    tratarse como texto literal (no matchea ningún código real) sin
  //    lanzar error de sintaxis ni afectar la tabla.
  const payloadCodigoCliente = "110470'; DROP TABLE clientes; --";
  const resultadoCodigoCliente = await ventasCliente({
    codigo_cliente: [payloadCodigoCliente],
    fecha_inicio: "2026-01-01",
    fecha_fin: "2026-01-31",
  });
  console.log("OK: ventasCliente con codigo_cliente malicioso no lanzó error de sintaxis ->", JSON.stringify(resultadoCodigoCliente));
  if (resultadoCodigoCliente.encontrado !== false || resultadoCodigoCliente.motivo !== "codigo_cliente_no_encontrado") {
    throw new Error("FALLO: se esperaba codigo_cliente_no_encontrado, llegó algo distinto");
  }

  const { rows: rowsClientes2 } = await pool.query("SELECT to_regclass('clientes') AS existe");
  if (!rowsClientes2[0].existe) throw new Error("FALLO: la tabla clientes ya no existe (inyección exitosa vía codigo_cliente)");
  console.log("OK: la tabla `clientes` sigue existiendo intacta (payload vía codigo_cliente).");

  await pool.end();
  console.log("\nSEGURIDAD SMOKE TEST OK");
}

main().catch((err) => {
  console.error("SEGURIDAD SMOKE TEST FALLÓ:", err);
  process.exit(1);
});
