// test/manual-test.js
// Prueba manual contra la base real (rol mcp_readonly). No es un test
// automatizado de CI — es la verificación de "paso 1" antes de conectar
// OAuth/Docker/NPM: confirma que cada tool devuelve datos coherentes.
require("dotenv").config();
const { ventasPorRuta } = require("../src/tools/ventasPorRuta");
const { ventasPorGrupo } = require("../src/tools/ventasPorGrupo");
const { resumenDiario } = require("../src/tools/resumenDiario");
const { topProductos } = require("../src/tools/topProductos");
const { clientesInactivos } = require("../src/tools/clientesInactivos");
const { proyeccionMensual } = require("../src/tools/proyeccionMensual");
const { pool } = require("../src/db");

function imprimir(titulo, obj) {
  console.log(`\n=== ${titulo} ===`);
  console.log(JSON.stringify(obj, null, 2));
}

async function main() {
  // Rango amplio y reciente para tener probabilidad alta de datos reales
  // (hoy - 60 días es un rango donde ya sabemos que hay ventas sincronizadas).
  const hoy = new Date().toISOString().slice(0, 10);
  const hace60 = new Date(Date.now() - 60 * 86400000).toISOString().slice(0, 10);
  const ayer = new Date(Date.now() - 86400000).toISOString().slice(0, 10);

  // 1) Elegimos una ruta real con ventas en ese rango, en vez de adivinar un código.
  const { rows: rutaRows } = await pool.query(
    `SELECT seller_code, COUNT(*) AS n FROM ordenes
     WHERE seller_code IS NOT NULL AND seller_code <> '' AND fecha_creacion >= $1
     GROUP BY seller_code ORDER BY n DESC LIMIT 1`,
    [`${hace60} 00:00:00`]
  );
  const rutaEjemplo = rutaRows[0]?.seller_code;
  console.log(`Ruta de ejemplo detectada: ${rutaEjemplo}`);

  if (rutaEjemplo) {
    imprimir(
      "ventasPorRuta",
      await ventasPorRuta({ ruta: rutaEjemplo, fecha_inicio: hace60, fecha_fin: hoy })
    );
    imprimir("clientesInactivos", await clientesInactivos({ ruta: rutaEjemplo }));
  } else {
    console.log("No se encontró ninguna ruta de ejemplo — se omiten ventasPorRuta/clientesInactivos.");
  }

  imprimir(
    "ventasPorGrupo (MAYORISTA)",
    await ventasPorGrupo({ grupo: "MAYORISTA", fecha_inicio: hace60, fecha_fin: hoy })
  );

  imprimir("resumenDiario (ayer)", await resumenDiario({ fecha: ayer }));

  imprimir(
    "topProductos",
    await topProductos({ fecha_inicio: hace60, fecha_fin: hoy, limite: 5 })
  );

  imprimir(
    "ventasPorGrupo (MAYORISTA + categoria=DESCARTABLE)",
    await ventasPorGrupo({ grupo: "MAYORISTA", categoria: "DESCARTABLE", fecha_inicio: hace60, fecha_fin: hoy })
  );

  imprimir(
    "ventasPorGrupo (PREVENTA, sin categoría)",
    await ventasPorGrupo({ grupo: "PREVENTA", fecha_inicio: hace60, fecha_fin: hoy })
  );

  imprimir(
    "ventasPorGrupo (PREVENTA + categoria=DESCARTABLE)",
    await ventasPorGrupo({ grupo: "PREVENTA", categoria: "DESCARTABLE", fecha_inicio: hace60, fecha_fin: hoy })
  );

  imprimir("proyeccionMensual (mes actual, empresa completa)", await proyeccionMensual({}));

  imprimir(
    "proyeccionMensual (mes actual, grupo=PREVENTA, categoria=DESCARTABLE)",
    await proyeccionMensual({ grupo: "PREVENTA", categoria: "DESCARTABLE" })
  );

  await pool.end();
}

main().catch((err) => {
  console.error("ERROR en manual-test:", err);
  process.exit(1);
});
