// test/preventa-real.test.js
// Prueba PREVENTA contra un cuadro REAL que el usuario pegó del dashboard
// (agosto 2026, ranking por ruta, $167.834,15 de total) — no una suposición
// de cómo "debería" funcionar. Esto reemplaza test/preventa-transicion.test.js
// (borrado): esa lógica (transición R%/PVR%) NUNCA fue la definición de
// PREVENTA — fue un error de implementación, confundido con una función
// distinta (obtenerRankingRutasDescartable, sobre una migración de
// nomenclatura de rutas rurales). La definición real está en
// ventasController.calcularKPIsMes — ver clasificacion.js.
require("dotenv").config();
const { ventasPorGrupo } = require("../src/tools/ventasPorGrupo");
const { pool } = require("../src/db");

function asegurar(condicion, mensaje) {
  if (!condicion) throw new Error("FALLÓ: " + mensaje);
  console.log("OK:", mensaje);
}

function centavos(n) {
  return Math.round(Number(n) * 100);
}

// Cuadro real pegado por el usuario — agosto 2026 (dashboard "Preventa").
const RANKING_REAL_AGOSTO_2026 = {
  "TELEVENTA 1": 26468.15,
  PVM: 19185.12,
  PVM2: 19133.6,
  PV5: 13628.49,
  PV9: 11622.43,
  PV10: 10938.73,
  PV3: 9725.08,
  PV14: 9206.27,
  PV2: 8978.42,
  PV4: 8826.98,
  PV1: 7550.2,
  PV12: 7527.85,
  PV13: 5063.09,
  PV8: 5018.48,
  PV6: 3020.51,
  PVQ1: 1940.75,
};
const TOTAL_REAL = 167834.15;

async function main() {
  const resultado = await ventasPorGrupo({
    grupo: "PREVENTA",
    fecha_inicio: "2026-08-01",
    fecha_fin: "2026-08-31",
  });

  asegurar(
    resultado.categoria === "DESCARTABLE",
    `sin categoria explícita, PREVENTA usa DESCARTABLE por default (llegó: ${resultado.categoria})`
  );

  asegurar(
    centavos(resultado.dolares_totales) === centavos(TOTAL_REAL),
    `total de agosto (${resultado.dolares_totales}) coincide EXACTO con el real (${TOTAL_REAL})`
  );

  const porRuta = {};
  resultado.por_ruta.forEach((r) => (porRuta[r.ruta] = r.dolares));

  let fallas = 0;
  for (const [ruta, dolaresEsperados] of Object.entries(RANKING_REAL_AGOSTO_2026)) {
    const dolaresObtenidos = porRuta[ruta];
    const ok = dolaresObtenidos !== undefined && centavos(dolaresObtenidos) === centavos(dolaresEsperados);
    if (!ok) fallas++;
    console.log(`${ok ? "OK" : "FALLÓ"}: ruta ${ruta} -> $${dolaresObtenidos} (esperado $${dolaresEsperados})`);
  }
  if (fallas > 0) throw new Error(`${fallas} ruta(s) no coinciden con el cuadro real`);

  // Julio: antes (con la clasificación equivocada) daba 0 — con la corrección
  // debe haber ventas reales (no es un hueco de sync, era el bug).
  const julio = await ventasPorGrupo({ grupo: "PREVENTA", fecha_inicio: "2026-07-01", fecha_fin: "2026-07-31" });
  asegurar(julio.dolares_totales > 0, `julio 2026 tiene ventas reales de PREVENTA (${julio.dolares_totales}, antes daba 0 por el bug)`);

  // categoria explícita distinta a DESCARTABLE: ya NO es un error, es una
  // consulta exploratoria válida sobre las mismas rutas.
  const botellon = await ventasPorGrupo({
    grupo: "PREVENTA",
    categoria: "BOTELLÓN",
    fecha_inicio: "2026-08-01",
    fecha_fin: "2026-08-31",
  });
  asegurar(botellon.categoria === "BOTELLÓN", "PREVENTA + categoria=BOTELLÓN ya no lanza error, respeta la categoría pedida");
  console.log(`   (PREVENTA + BOTELLÓN en agosto: $${botellon.dolares_totales} — informativo, no es el KPI oficial)`);

  await pool.end();
  console.log("\nPREVENTA REAL TEST OK");
}

main().catch((err) => {
  console.error("\nPREVENTA REAL TEST FALLÓ:", err);
  process.exit(1);
});
