// services/chatbotservicio/preventaDashboard.service.js
// ─────────────────────────────────────────────────────────────────────────────
// Responde preguntas de PREVENTA / DESCARTABLE / RANKING / TOP CLIENTES usando
// EXACTAMENTE las mismas funciones que alimentan el dashboard de preventas.
//
// Motivo: estas cifras se calculan en ventasController.js con lógica multi-fuente
// (ordenes + facturas, varios prefijos de seller_code, status por canal, proyección
// por días hábiles, etc.). Si dejamos que el LLM "reinvente" el SQL, nunca cuadra
// con lo que el usuario ve en pantalla. Aquí reutilizamos las funciones canónicas
// para que el número del chatbot sea idéntico al del dashboard.
// ─────────────────────────────────────────────────────────────────────────────

const {
  calcularKPIsMes,
  calcularVentasDescartableConComparativa,
  agruparDescartablePorCanalResumen,
} = require("../../controllers/controllerPreventa/ventasController");

// ── Formato hispano de números: punto miles, coma decimales ──
const fmtMonto = (n) =>
  Number(n || 0).toLocaleString("es-EC", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtUnid = (n) =>
  Number(n || 0).toLocaleString("es-EC", { maximumFractionDigits: 0 });

const NOMBRES_MES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

// ─────────────────────────────────────────────────────────────────────────────
// DETECCIÓN DE INTENCIÓN
// ─────────────────────────────────────────────────────────────────────────────
// Solo intervenimos cuando la pregunta es claramente sobre los números agregados
// de preventa/descartable del dashboard, NO sobre una factura/cliente puntual.
const RE_PREVENTA   = /\bpreventa[s]?\b/i;
const RE_DESCART    = /\bdescartable[s]?\b/i;
const RE_RANKING    = /\b(ranking|top|mejores?|por\s+(preventa|prevendedor|vendedor|ruta|canal))\b/i;
const RE_TOTAL      = /\b(total|totales|cu[aá]nt[oa]s?|monto|venta[s]?|unidades|cumplimiento|meta[s]?)\b/i;
const RE_TOPCLI     = /\btop\s+(\d+\s+)?clientes?\b|\bmejores?\s+clientes?\b|\bclientes?\s+que\s+m[aá]s\b/i;

/**
 * Decide si esta pregunta debe responderse con los datos del dashboard de preventa.
 * Devuelve null si no aplica, o un objeto { tipo } con el subtipo detectado.
 */
function detectarPreguntaPreventa(pregunta) {
  const t = (pregunta || "").toLowerCase();

  const mencionaPreventa  = RE_PREVENTA.test(t);
  const mencionaDescart   = RE_DESCART.test(t);

  // Descartable POR CANAL (DOMICILIO / MAYORISTA / VIP): SÍ usa funciones reales
  // de descartable (calcularVentasDescartableConComparativa). Tiene prioridad.
  if (mencionaDescart && /\bcanal(es)?\b|\bdomicilio\b|\bmayorista\b|\bvip\b/i.test(t)) {
    return { tipo: "descartable_canal" };
  }

  // ⚠️ CRÍTICO: el TOTAL/RANKING/TOP de DESCARTABLE NO se calcula con datos de
  // preventa (eso daba el bug de responder $208k de preventa a "total de
  // descartable"). Para descartable sin canal, delegamos al agente (categoría 7).
  if (mencionaDescart && !mencionaPreventa) {
    return null;
  }

  // ── A partir de aquí: SOLO preventa ──
  // Top clientes de preventa
  if (RE_TOPCLI.test(t) && mencionaPreventa) {
    return { tipo: "top_clientes" };
  }

  // Ranking por prevendedor / ruta / canal
  if (RE_RANKING.test(t) && mencionaPreventa) {
    return { tipo: "ranking" };
  }

  // Total de preventa del mes / "cuanto es la preventa"
  if (mencionaPreventa) {
    return { tipo: "total" };
  }

  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// PARSEO DE PERÍODO
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Extrae { anio, mes } de la pregunta. Si no se indica, devuelve null para que el
 * llamador aplique el período por defecto (mes actual con fallback al último con datos).
 */
function parsearPeriodo(pregunta) {
  const t = (pregunta || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  const ahora = new Date();

  // Año explícito (2024-2099); si no aparece, año actual
  const mAnio = t.match(/\b(20\d{2})\b/);
  let anio = mAnio ? parseInt(mAnio[1], 10) : ahora.getFullYear();

  // Mes por nombre
  const nombresSinAcento = [
    "enero", "febrero", "marzo", "abril", "mayo", "junio",
    "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
  ];
  for (let i = 0; i < nombresSinAcento.length; i++) {
    if (new RegExp(`\\b${nombresSinAcento[i]}\\b`).test(t)) {
      return { anio, mes: i + 1, explicito: true };
    }
  }

  // "mes pasado" / "mes anterior"
  if (/\bmes\s+(pasado|anterior)\b/.test(t)) {
    let mes = ahora.getMonth(); // getMonth() es 0-based → mes anterior 1-based
    let a = ahora.getFullYear();
    if (mes === 0) { mes = 12; a -= 1; }
    return { anio: a, mes, explicito: true };
  }

  // "este mes" / sin indicación → mes actual (no explícito → permite fallback)
  return { anio, mes: ahora.getMonth() + 1, explicito: false };
}

// ─────────────────────────────────────────────────────────────────────────────
// RESPUESTA
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Calcula y formatea la respuesta de preventa para el período dado.
 * Devuelve { texto, datos, anio, mes } o null si no hay datos en ningún período.
 */
async function responderPreventaDashboard(pregunta, { rol, sellerCode } = {}) {
  const sub = detectarPreguntaPreventa(pregunta);
  if (!sub) return null;

  const periodo = parsearPeriodo(pregunta);

  // Resolver período con fallback: si el mes pedido no tiene datos y NO fue
  // explícito, retroceder hasta 6 meses para encontrar el último con datos.
  let { anio, mes } = periodo;
  let kpis = await calcularKPIsMes(anio, mes);
  if (!periodo.explicito && (!kpis?._raw?.montoTotal || kpis._raw.montoTotal === 0)) {
    for (let i = 0; i < 6; i++) {
      mes -= 1;
      if (mes === 0) { mes = 12; anio -= 1; }
      kpis = await calcularKPIsMes(anio, mes);
      if (kpis?._raw?.montoTotal > 0) break;
    }
  }

  const etiquetaPeriodo = `${NOMBRES_MES[mes - 1]} de ${anio}`;

  // ── Filtro por vendedor (replica el comportamiento del dashboard) ──
  const filtrarVendedor = (lista, campo) =>
    rol === "VENDEDOR" && sellerCode
      ? (lista || []).filter(r => (r[campo] || "").toUpperCase() === sellerCode.toUpperCase())
      : (lista || []);

  // Cada rama produce: texto (chat), datos (PLANOS, aptos para PDF y caché) y titulo (PDF).
  let texto, datos, titulo;

  if (sub.tipo === "ranking") {
    const ranking = filtrarVendedor(kpis.rankingPreventas, "preventa")
      .slice()
      .sort((a, b) => Number(b.monto) - Number(a.monto));
    if (ranking.length === 0)
      return { texto: `No hay ventas de preventa registradas para ${etiquetaPeriodo}.`, datos: [], anio, mes };

    const lineas = ranking.map((r, i) =>
      `${i + 1}. ${r.preventa} — $${fmtMonto(r.monto)} (${fmtUnid(r.unidades)} uds)`
    );
    texto =
      `Ranking de preventa por prevendedor — ${etiquetaPeriodo}:\n\n` +
      lineas.join("\n") +
      `\n\nTotal preventa: $${fmtMonto(kpis.kpisGenerales.montoTotal)} (${fmtUnid(kpis.kpisGenerales.unidadesTotales)} unidades).`;
    // Datos planos para el PDF (sin objetos anidados como vsMesAnterior)
    datos = ranking.map((r, i) => ({
      posicion:    i + 1,
      prevendedor: r.preventa,
      unidades:    Number(r.unidades) || 0,
      monto:       Number(r.monto) || 0,
    }));
    titulo = `Ranking de Preventa — ${etiquetaPeriodo}`;

  } else if (sub.tipo === "top_clientes") {
    const top = filtrarVendedor(kpis.topClientes, "preventa");
    if (top.length === 0)
      return { texto: `No hay clientes con consumo de preventa para ${etiquetaPeriodo}.`, datos: [], anio, mes };

    const topLimitado = top.slice(0, 20);
    const lineas = topLimitado.map((c, i) =>
      `${i + 1}. ${c.cliente || c.codigo} — $${fmtMonto(c.montoActual)} (${fmtUnid(c.unidadesActual)} uds)`
    );
    texto =
      `Top clientes de preventa — ${etiquetaPeriodo}:\n\n` + lineas.join("\n");
    datos = topLimitado.map((c, i) => ({
      posicion:    i + 1,
      cliente:     c.cliente || c.codigo,
      prevendedor: c.preventa,
      unidades:    Number(c.unidadesActual) || 0,
      monto:       Number(c.montoActual) || 0,
    }));
    titulo = `Top Clientes de Preventa — ${etiquetaPeriodo}`;

  } else if (sub.tipo === "descartable_canal") {
    const descart = await calcularVentasDescartableConComparativa(anio, mes);
    const resumen = agruparDescartablePorCanalResumen(descart);
    const canales = Object.values(resumen).filter(c => c.monto > 0 || c.unidades > 0);
    if (canales.length === 0)
      return { texto: `No hay ventas de descartable por canal para ${etiquetaPeriodo}.`, datos: [], anio, mes };

    const lineas = canales.map(c =>
      `• ${c.canal}: $${fmtMonto(c.montoReal)} (${fmtUnid(c.unidades)} uds)`
    );
    const totalCanal = canales.reduce((s, c) => s + Number(c.montoReal || 0), 0);
    texto =
      `Descartable por canal — ${etiquetaPeriodo}:\n\n` +
      lineas.join("\n") +
      `\n\nTotal descartable (canales A/M/V): $${fmtMonto(totalCanal)}.`;
    datos = canales.map(c => ({
      canal:    c.canal,
      unidades: Number(c.unidades) || 0,
      monto:    Number(c.montoReal) || 0,
    }));
    titulo = `Descartable por Canal — ${etiquetaPeriodo}`;

  } else {
    // tipo "total"
    const g = kpis.kpisGenerales;
    if (!g || (!g.montoTotal && !g.unidadesTotales))
      return { texto: `No hay ventas de preventa registradas para ${etiquetaPeriodo}.`, datos: [], anio, mes };

    texto =
      `La preventa de ${etiquetaPeriodo} es de $${fmtMonto(g.montoTotal)} ` +
      `con ${fmtUnid(g.unidadesTotales)} unidades.`;
    if (g.metaMensualDolares > 0) {
      texto += ` Cumplimiento de la meta en dólares: ${fmtMonto(g.cumplimientoUSDMensual)}%.`;
    }
    datos = [{
      periodo: etiquetaPeriodo,
      monto_total: g.montoTotal,
      unidades_totales: g.unidadesTotales,
      cumplimiento_usd_pct: g.cumplimientoUSDMensual,
      cumplimiento_unidades_pct: g.cumplimientoUnidadesMensual,
    }];
    titulo = `Resumen de Preventa — ${etiquetaPeriodo}`;
  }

  return { texto, datos, titulo, anio, mes };
}

module.exports = {
  detectarPreguntaPreventa,
  responderPreventaDashboard,
};
