// test/ventasPorCondicionPago-real.test.js
// Prueba de regresión con datos reales para ventasPorCondicionPago — ver
// clasificacion.js (CONDICION_PAGO_FACTURA/CONDICION_PAGO_CLIENTE) para la
// investigación completa. Cubre 3 cosas que no se pueden validar solo con
// `node --check`:
//
//  1. Consistencia: dolares_totales debe coincidir EXACTO con lo que ya
//     reporta ventasPorGrupo (fuente ya validada contra Excel real) — esta
//     tool solo agrega la dimensión de condición de pago encima, nunca debe
//     cambiar el total.
//  2. El hallazgo real que motivó esta tool: canales MobilVendor puros (VIP,
//     TELEVENTA_VIP) SÍ tienen mezcla real de CONTADO y CREDITO — la vieja
//     asunción "contado=MobilVendor" los hubiera escondido.
//  3. Regresión del bug encontrado y corregido antes de mergear: las notas
//     de crédito (`out_refund`, exclusivas de ODOO) tienen su propia
//     `fecha_vencimiento` NO confiable — sin el fix, VIP julio 2026 daba
//     CONTADO con dólares NEGATIVOS (-$93,703.16, un total absurdo). Este
//     test asegura que ningún renglón de por_condicion quede negativo (más
//     allá de una desviación chica y explicable por notas de crédito
//     normales, no una acumulación sistemática de refunds mal clasificados).
//  4. Regresión del fix de etiquetado (2026-09-16, reportado por el usuario
//     tras verificar la tool en vivo): las notas de crédito usan el mismo
//     fallback de cliente que las órdenes, pero deben reportarse bajo su
//     propia fuente `NOTA_CREDITO` — no mezcladas bajo `METODO_PAGO_CLIENTE`
//     (que antes hacía ilegible un renglón negativo en un canal facturado
//     por `facturas`, como VIP, dando la falsa impresión de que había
//     órdenes reales negativas).
require("dotenv").config();
const { ventasPorCondicionPago } = require("../src/tools/ventasPorCondicionPago");
const { totalesGrupo: totalesGrupoOriginal, totalesPreventa: totalesPreventaOriginal } = require("../src/tools/ventasPorGrupo");
const { pool } = require("../src/db");

function asegurar(condicion, mensaje) {
  if (!condicion) throw new Error("FALLÓ: " + mensaje);
  console.log("OK:", mensaje);
}

const INICIO = "2026-07-01";
const FIN = "2026-07-31";
const INICIO_TS = "2026-07-01 00:00:00";
const FIN_TS = "2026-08-01 00:00:00";

function sumaPorCondicion(por_condicion) {
  return por_condicion.reduce((acc, r) => acc + r.dolares, 0);
}

async function main() {
  // 1) Consistencia de $ totales contra ventasPorGrupo, para todos los
  //    grupos que mezclan ordenes+facturas y para PREVENTA (solo ordenes).
  for (const grupo of ["MAYORISTA", "TIENDAS", "TIENDAS_VIP", "RURAL", "EMPRESAS", "VIP", "QUITO", "TELEVENTA_VIP"]) {
    const original = await totalesGrupoOriginal(grupo, INICIO_TS, FIN_TS, undefined);
    const nuevo = await ventasPorCondicionPago({ grupo, fecha_inicio: INICIO, fecha_fin: FIN });
    const dolaresOriginal = Number(original.totales.dolares.toFixed(2));
    asegurar(
      Math.abs(nuevo.dolares_totales - dolaresOriginal) < 0.01,
      `${grupo} julio: dolares_totales de ventasPorCondicionPago (${nuevo.dolares_totales}) == ventasPorGrupo (${dolaresOriginal})`
    );
    // El desglose por_condicion debe sumar exacto al total (sin fugas ni
    // doble conteo entre condicion_pago).
    asegurar(
      Math.abs(sumaPorCondicion(nuevo.por_condicion) - nuevo.dolares_totales) < 0.01,
      `${grupo}: suma de por_condicion (${sumaPorCondicion(nuevo.por_condicion).toFixed(2)}) == dolares_totales (${nuevo.dolares_totales})`
    );
    // El desglose por_condicion_y_fuente también debe sumar exacto (mismo
    // total, una dimensión más).
    const sumaFuente = nuevo.por_condicion_y_fuente.reduce((acc, r) => acc + r.dolares, 0);
    asegurar(
      Math.abs(sumaFuente - nuevo.dolares_totales) < 0.01,
      `${grupo}: suma de por_condicion_y_fuente (${sumaFuente.toFixed(2)}) == dolares_totales (${nuevo.dolares_totales})`
    );
  }

  const preventaOriginal = await totalesPreventaOriginal(INICIO_TS, FIN_TS, undefined);
  const preventaNuevo = await ventasPorCondicionPago({ grupo: "PREVENTA", fecha_inicio: INICIO, fecha_fin: FIN });
  asegurar(
    Math.abs(preventaNuevo.dolares_totales - Number(preventaOriginal.totales.dolares.toFixed(2))) < 0.01,
    `PREVENTA julio: dolares_totales de ventasPorCondicionPago (${preventaNuevo.dolares_totales}) == ventasPorGrupo (${preventaOriginal.totales.dolares.toFixed(2)})`
  );
  // PREVENTA nunca tiene facturas propias -> condición siempre viene del
  // fallback de cliente, nunca de la señal transaccional.
  asegurar(
    preventaNuevo.por_condicion_y_fuente.every((r) => r.fuente_condicion === "METODO_PAGO_CLIENTE"),
    "PREVENTA: toda fila de por_condicion_y_fuente usa fuente METODO_PAGO_CLIENTE (nunca TRANSACCIONAL, no genera facturas propias)"
  );

  // 2) El hallazgo real que motivó esta tool: VIP y TELEVENTA_VIP (canales
  //    MobilVendor puros por seller_code/tipo_negocio) SÍ tienen mezcla real
  //    de CONTADO y CREDITO — confirmado contra datos reales antes de
  //    construir la tool (VIP: 136 contado vs 54 crédito; TELEVENTA_VIP:
  //    146 vs 51). La vieja asunción "contado=MobilVendor" los hubiera
  //    reportado 100% contado.
  const vip = await ventasPorCondicionPago({ grupo: "VIP", fecha_inicio: INICIO, fecha_fin: FIN });
  const condicionesVip = new Set(vip.por_condicion.map((r) => r.condicion_pago));
  asegurar(
    condicionesVip.has("CONTADO") && condicionesVip.has("CREDITO"),
    `VIP julio tiene mezcla real de CONTADO y CREDITO (llegaron: ${[...condicionesVip].join(", ")}) — refuta la vieja asunción origen_sistema=proxy`
  );

  // 3) Regresión del bug de out_refund: ningún renglón de por_condicion debe
  //    quedar con dólares negativos por acumulación de notas de crédito mal
  //    atribuidas (antes del fix, VIP/CONTADO julio daba -$93,703.16).
  for (const r of vip.por_condicion) {
    asegurar(r.dolares >= 0, `VIP julio: ${r.condicion_pago} no queda negativo (${r.dolares}) — antes del fix de out_refund daba negativo`);
  }

  // 4) Fix de etiquetado: VIP julio 2026 debe traer un renglón NOTA_CREDITO
  //    propio (no mezclado bajo METODO_PAGO_CLIENTE) — negativo por
  //    definición (out_refund siempre resta), eso es correcto contablemente,
  //    no un bug. Ninguna fila jamás debe usar 'NOTA_CREDITO' salvo que
  //    venga de `facturas` out_refund — como `ordenes` siempre usa la
  //    constante FUENTE_CONDICION_PAGO_CLIENTE ('METODO_PAGO_CLIENTE'), la
  //    sola presencia de NOTA_CREDITO ya prueba que esa fila vino de
  //    facturas, nunca de una orden real.
  const notaCredito = vip.por_condicion_y_fuente.find((r) => r.fuente_condicion === "NOTA_CREDITO");
  asegurar(!!notaCredito, "VIP julio: existe un renglón con fuente_condicion=NOTA_CREDITO, separado de METODO_PAGO_CLIENTE");
  asegurar(notaCredito.dolares <= 0, `VIP julio: el renglón NOTA_CREDITO es <= 0 (${notaCredito.dolares}) — correcto contablemente, las notas de crédito restan venta`);

  // Toda fila de por_condicion_y_fuente debe traer una fuente reconocida —
  // el requisito explícito de poder rastrear de dónde salió cada condición.
  const fuentesValidas = new Set(["TRANSACCIONAL", "METODO_PAGO_CLIENTE", "NOTA_CREDITO"]);
  const condicionesValidas = new Set(["CONTADO", "CREDITO", "SIN_DATO"]);
  for (const grupoProbado of [vip, preventaNuevo]) {
    for (const r of grupoProbado.por_condicion_y_fuente) {
      asegurar(fuentesValidas.has(r.fuente_condicion), `fuente_condicion reconocida: ${r.fuente_condicion}`);
      asegurar(condicionesValidas.has(r.condicion_pago), `condicion_pago reconocida: ${r.condicion_pago}`);
    }
  }
  console.log("OK: toda fila de por_condicion_y_fuente trae una fuente_condicion/condicion_pago reconocida (trazabilidad del requisito).");

  await pool.end();
  console.log("\nVENTAS POR CONDICION PAGO REAL TEST OK");
}

main().catch((err) => {
  console.error("\nVENTAS POR CONDICION PAGO REAL TEST FALLÓ:", err);
  process.exit(1);
});
