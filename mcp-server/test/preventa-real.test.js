// test/preventa-real.test.js
// Prueba PREVENTA contra números REALES confirmados por el usuario (cruce
// contra el Excel real de guías de entrega de MobilVendor) — no una
// suposición de cómo "debería" funcionar. Actualizado 2026-09-01 tras el
// fix del filtro de guía condicional por categoría (ver clasificacion.js):
// el número de agosto de $167.834,15 usado antes en este test quedó
// obsoleto por el paso del tiempo (más días de agosto sincronizados desde
// entonces, no por ningún bug) — reemplazado por los números re-validados
// contra el Excel real ese mismo día.
require("dotenv").config();
const { ventasPorGrupo } = require("../src/tools/ventasPorGrupo");
const { topProductos } = require("../src/tools/topProductos");
const { pool } = require("../src/db");

function asegurar(condicion, mensaje) {
  if (!condicion) throw new Error("FALLÓ: " + mensaje);
  console.log("OK:", mensaje);
}

// Tolerancia como % del valor esperado — no exigimos exactitud a centavos:
// - DESCARTABLE usa `waybill_code IS NOT NULL` (sin mirar el status), que
//   validamos en 0.03% de diferencia — tolerancia generosa igual (0.5%)
//   para no ser frágil ante variaciones menores día a día, pero suficiente
//   para detectar una regresión real.
// - BOTELLÓN usa `waybill_status = '3'`, que tiene un margen conocido y
//   aceptado de ~6-7% por backfill retroactivo de waybill (códigos de guía
//   reutilizados con el tiempo — ver TODO.md). Tolerancia más floja (10%)
//   a propósito, pero igual detecta si el fix se rompe del todo (el bug
//   original daba +17% a +30% de más).
function dentroDeTolerancia(obtenido, esperado, pctTolerancia) {
  const diff = Math.abs(obtenido - esperado);
  return diff <= esperado * pctTolerancia;
}

// Confirmados por el usuario 2026-09-01, cruzando el Excel real de guías
// de entrega (MobilVendor) para agosto 2026 completo.
const DESCARTABLE_AGOSTO_REAL = { dolares: 252960.5169, unidades: 84972, tolerancia: 0.005 };
const BOTELLON_285_AGOSTO_REAL = { dolares: 1351.9817, unidades: 759, tolerancia: 0.10 };

async function main() {
  const descartable = await ventasPorGrupo({
    grupo: "PREVENTA",
    fecha_inicio: "2026-08-01",
    fecha_fin: "2026-08-31",
  });

  asegurar(
    descartable.categoria === "DESCARTABLE",
    `sin categoria explícita, PREVENTA usa DESCARTABLE por default (llegó: ${descartable.categoria})`
  );

  asegurar(
    dentroDeTolerancia(descartable.dolares_totales, DESCARTABLE_AGOSTO_REAL.dolares, DESCARTABLE_AGOSTO_REAL.tolerancia),
    `DESCARTABLE agosto ($${descartable.dolares_totales}) dentro de ${DESCARTABLE_AGOSTO_REAL.tolerancia * 100}% del real ($${DESCARTABLE_AGOSTO_REAL.dolares})`
  );

  // Julio: antes (con la clasificación equivocada) daba 0 — con la corrección
  // debe haber ventas reales (no es un hueco de sync, era el bug).
  const julio = await ventasPorGrupo({ grupo: "PREVENTA", fecha_inicio: "2026-07-01", fecha_fin: "2026-07-31" });
  asegurar(julio.dolares_totales > 0, `julio 2026 tiene ventas reales de PREVENTA (${julio.dolares_totales}, antes daba 0 por el bug)`);

  // categoria explícita distinta a DESCARTABLE: ya NO es un error, es una
  // consulta exploratoria válida sobre las mismas rutas — y usa un criterio
  // de guía distinto (waybill_status='3', no "tiene guía").
  const botellon = await ventasPorGrupo({
    grupo: "PREVENTA",
    categoria: "BOTELLÓN",
    fecha_inicio: "2026-08-01",
    fecha_fin: "2026-08-31",
  });
  asegurar(botellon.categoria === "BOTELLÓN", "PREVENTA + categoria=BOTELLÓN ya no lanza error, respeta la categoría pedida");

  const productosBotellon = await topProductos({
    fecha_inicio: "2026-08-01",
    fecha_fin: "2026-08-31",
    grupo: "PREVENTA",
    categoria: "BOTELLÓN",
    limite: 50,
  });
  const p285 = productosBotellon.productos.find((p) => p.codigo === "285");
  asegurar(!!p285, "BOTELLON VERDE PET (código 285) aparece en el ranking de agosto");
  asegurar(
    dentroDeTolerancia(p285.dolares, BOTELLON_285_AGOSTO_REAL.dolares, BOTELLON_285_AGOSTO_REAL.tolerancia),
    `BOTELLON VERDE PET agosto ($${p285.dolares}) dentro de ${BOTELLON_285_AGOSTO_REAL.tolerancia * 100}% del real ($${BOTELLON_285_AGOSTO_REAL.dolares})`
  );

  await pool.end();
  console.log("\nPREVENTA REAL TEST OK");
}

main().catch((err) => {
  console.error("\nPREVENTA REAL TEST FALLÓ:", err);
  process.exit(1);
});
