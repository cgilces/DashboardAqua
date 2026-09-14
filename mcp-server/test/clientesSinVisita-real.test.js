// test/clientesSinVisita-real.test.js
// Regresión de un bug real encontrado el 2026-09-14: filtrar por `ruta` ANTES
// de calcular duplicados de maestro rompía la consolidación para clientes
// cuyos 2 códigos duplicados están en rutas DISTINTAS — el resumen agrupado
// (sin filtro) y el filtro directo a una ruta específica daban números
// distintos para la misma ruta (caso real: TIENDAS_VIP/D1, 155 vs 157).
// Corregido calculando duplicados siempre sobre el universo completo y
// aplicando el filtro de ruta después. Este test verifica que ambos caminos
// SIEMPRE coincidan exacto, contra datos reales, no un caso sintético.
const { clientesSinVisita } = require("../src/tools/clientesSinVisita");

function asegurar(condicion, mensaje) {
  if (!condicion) throw new Error("FALLÓ: " + mensaje);
  console.log("OK:", mensaje);
}

async function main() {
  const params = { grupo: "TIENDAS_VIP", fecha_inicio: "2026-08-01", fecha_fin: "2026-09-14", limite: 50 };

  const resumen = await clientesSinVisita({ ...params, agrupar_por: "ruta" });
  asegurar(resumen.resumen.length > 5, `agrupar_por devuelve varias rutas reales (llegaron ${resumen.resumen.length})`);

  const sumaTotales = resumen.resumen.reduce((s, r) => s + r.total_clientes, 0);
  asegurar(sumaTotales === resumen.universo_total, `suma de total_clientes por ruta (${sumaTotales}) == universo_total (${resumen.universo_total})`);

  const sumaSinVisitar = resumen.resumen.reduce((s, r) => s + r.sin_visitar, 0);
  asegurar(sumaSinVisitar === resumen.sin_visita_total, `suma de sin_visitar por ruta (${sumaSinVisitar}) == sin_visita_total (${resumen.sin_visita_total})`);

  // Las 2 rutas reales que expusieron el bug original (D1 tenía duplicados
  // cruzados con otras rutas, TV1 no) — ambas deben coincidir exacto entre
  // el resumen completo y el filtro directo a esa ruta sola.
  for (const rutaTest of ["D1", "TV1"]) {
    const filaResumen = resumen.resumen.find((r) => r.ruta === rutaTest);
    const filtrado = await clientesSinVisita({ ...params, ruta: rutaTest, agrupar_por: "vendedor" });
    const filaFiltrada = filtrado.resumen[0];

    asegurar(!!filaResumen && !!filaFiltrada, `ruta ${rutaTest} aparece en ambos caminos (resumen y filtro directo)`);
    asegurar(
      filaResumen.total_clientes === filaFiltrada.total_clientes &&
        filaResumen.sin_visitar === filaFiltrada.sin_visitar &&
        filaResumen.visitados === filaFiltrada.visitados,
      `ruta ${rutaTest}: resumen agrupado y filtro directo coinciden EXACTO (total=${filaResumen.total_clientes}, sin_visitar=${filaResumen.sin_visitar})`
    );
  }

  // agrupar_por: "ruta" y "vendedor" deben dar el mismo agrupamiento (mismo
  // dato, ver comentario en clientesSinVisita.js) — verificado con datos reales.
  const porVendedor = await clientesSinVisita({ ...params, agrupar_por: "vendedor" });
  asegurar(
    JSON.stringify(resumen.resumen) === JSON.stringify(porVendedor.resumen),
    "agrupar_por='ruta' y agrupar_por='vendedor' dan el mismo resultado exacto (mismo dato subyacente)"
  );

  console.log("\nCLIENTES SIN VISITA (POR RUTA) REAL TEST OK");
}

main().catch((err) => {
  console.error("CLIENTES SIN VISITA (POR RUTA) REAL TEST FALLÓ:", err);
  process.exit(1);
});
