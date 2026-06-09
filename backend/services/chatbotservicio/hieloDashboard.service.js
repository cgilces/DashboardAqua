// services/chatbotservicio/hieloDashboard.service.js
// ─────────────────────────────────────────────────────────────────────────────
// Responde preguntas de VENTA DE HIELO usando EXACTAMENTE la metodología del
// dashboard "HIELO — VENTAS EMPRESA" (controllerOdoo/ventasHieloController.js).
//
// El total de hielo NO es "descripcion LIKE '%HIELO%'": se compone de 3 fuentes:
//   MV   = facturas seller_code H%/10/h3, status='2', descripcion_categoria='HIELO'
//          (las del seller '10' = televentas anuladas → se RESTAN)
//   DIST = ordenes campania_id=5, status IN (2), categoría NO botellón (DISTRINTER)
//   GA   = ordenes campania_id=1, status IN (2), descripcion_categoria ILIKE '%HIELO%'
//   TOTAL EMPRESA = MV + DIST + GA
//
// Verificado: marzo 2026 → $169.805,48 / 257.788 uds (idéntico al dashboard).
// ─────────────────────────────────────────────────────────────────────────────

const sequelize = require("../../db");
const Sequelize = require("sequelize");
const Q = Sequelize.QueryTypes.SELECT;

const fmtMonto = (n) =>
  Number(n || 0).toLocaleString("es-EC", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtUnid = (n) =>
  Number(n || 0).toLocaleString("es-EC", { maximumFractionDigits: 0 });

const NOMBRES_MES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

// ── Detección: pregunta sobre el total/ventas de hielo (no una factura puntual) ──
const RE_HIELO = /\bhielo\b/i;
const RE_TOTAL = /\b(total|totales|cu[aá]nt[oa]s?|monto|venta[s]?|vendi[oó]|facturaci[oó]n|unidades|ingreso[s]?)\b/i;

function detectarPreguntaHielo(pregunta) {
  const t = (pregunta || "").toLowerCase();
  if (!RE_HIELO.test(t)) return false;
  // Evitar capturar desgloses muy específicos que el agente maneja mejor
  // (por cliente / por producto puntual). El interceptor da el TOTAL EMPRESA y por usuario/ruta.
  if (/\bpor\s+cliente\b|\bde[l]?\s+cliente\b/i.test(t)) return false;
  return RE_TOTAL.test(t) || /\bde\s+hielo\b/i.test(t);
}

// ── Parseo de período (mes nombre + año / "mes pasado" / por defecto mes actual) ──
function parsearPeriodo(pregunta) {
  const t = (pregunta || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  const ahora = new Date();
  const mAnio = t.match(/\b(20\d{2})\b/);
  const anio = mAnio ? parseInt(mAnio[1], 10) : ahora.getFullYear();

  for (let i = 0; i < NOMBRES_MES.length; i++) {
    if (new RegExp(`\\b${NOMBRES_MES[i]}\\b`).test(t)) return { anio, mes: i + 1, explicito: true };
  }
  if (/\bmes\s+(pasado|anterior)\b/.test(t)) {
    let mes = ahora.getMonth(); // 0-based → mes anterior 1-based
    let a = ahora.getFullYear();
    if (mes === 0) { mes = 12; a -= 1; }
    return { anio: a, mes, explicito: true };
  }
  return { anio, mes: ahora.getMonth() + 1, explicito: false };
}

const RUTAS_ODOO = [
  "Carmen Garcia", "Estefania Flores", "Tamara Villacres",
  "RUTA E1", "RUTA E2", "RUTA E3", "RUTA E4", "RUTA E5",
  "RUTA E6", "RUTA E7", "RUTA E8", "RUTA E9", "RUTA E10",
  "RUTA EA1", "RUTA U2", "Distribucion OK/E", "Domicilio",
];

function rangoMes(anio, mes) {
  const ini = `${anio}-${String(mes).padStart(2, "0")}-01 00:00:00`;
  let mf = mes + 1, af = anio;
  if (mf === 13) { mf = 1; af++; }
  const fin = `${af}-${String(mf).padStart(2, "0")}-01 00:00:00`;
  return { ini, fin };
}

// ── Calcula el total EMPRESA de hielo (MV + DIST + GA) para un mes ──
async function calcularHieloEmpresaMes(anio, mes) {
  const { ini, fin } = rangoMes(anio, mes);

  const mv = (await sequelize.query(
    `SELECT COALESCE(SUM(CASE WHEN f.seller_code='10' THEN -dd.total ELSE dd.total END),0) AS dolares,
            COALESCE(SUM(CASE WHEN f.seller_code='10' THEN -dd.cantidad ELSE dd.cantidad END),0) AS unidades,
            COUNT(DISTINCT f.code) AS facturas, COUNT(DISTINCT f.customer_code) AS clientes
     FROM facturas f LEFT JOIN detalle_documento dd ON f.code=dd.documento_code
     WHERE (f.seller_code ILIKE 'H%' OR f.seller_code IN ('10','h3'))
       AND f.status='2' AND dd.descripcion_categoria='HIELO'
       AND f.fecha_creacion>='${ini}' AND f.fecha_creacion<'${fin}'`, { type: Q }))[0];

  // DISTRINTER (campania 5): SOLO hielo. Se EXCLUYE botellón (NOT ILIKE '%BOTELL%')
  // porque el jefe confirmó que el dashboard de hielo debe contener únicamente hielo
  // (los ~29 botellones de DISTRINTER no cuentan aquí).
  const dist = (await sequelize.query(
    `SELECT COALESCE(SUM(dd.total),0) AS dolares, COALESCE(SUM(dd.cantidad),0) AS unidades,
            COUNT(DISTINCT o.code) AS ordenes, COUNT(DISTINCT o.customer_code) AS clientes
     FROM ordenes o JOIN detalle_documento dd ON dd.documento_code=o.code
     WHERE o.campania_id=5 AND o.status IN (2) AND dd.descripcion_categoria NOT ILIKE '%BOTELL%'
       AND o.fecha_creacion>='${ini}' AND o.fecha_creacion<'${fin}'`, { type: Q }))[0];

  const ga = (await sequelize.query(
    `SELECT COALESCE(SUM(dd.total),0) AS dolares, COALESCE(SUM(dd.cantidad),0) AS unidades,
            COUNT(DISTINCT o.code) AS ordenes, COUNT(DISTINCT o.customer_code) AS clientes
     FROM ordenes o JOIN detalle_documento dd ON dd.documento_code=o.code
     WHERE o.campania_id=1 AND o.status IN (2) AND dd.descripcion_categoria ILIKE '%HIELO%'
       AND o.fecha_creacion>='${ini}' AND o.fecha_creacion<'${fin}'`, { type: Q }))[0];

  const n = (x) => Number(x || 0);
  const dolares = n(mv.dolares) + n(dist.dolares) + n(ga.dolares);
  const unidades = n(mv.unidades) + n(dist.unidades) + n(ga.unidades);

  return {
    dolares, unidades,
    fuentes: {
      MV:           { dolares: n(mv.dolares),   unidades: n(mv.unidades) },
      DISTRINTER:   { dolares: n(dist.dolares), unidades: n(dist.unidades) },
      ODOO_GA:      { dolares: n(ga.dolares),   unidades: n(ga.unidades) },
    },
  };
}

// ── Ventas de hielo por usuario/ruta MV (para "hielo por ruta/vendedor") ──
async function hieloPorUsuario(anio, mes) {
  const { ini, fin } = rangoMes(anio, mes);
  const rows = await sequelize.query(
    `SELECT f.seller_code AS usuario,
            COALESCE(SUM(dd.cantidad),0) AS unidades,
            COALESCE(SUM(dd.total),0) AS dolares
     FROM facturas f LEFT JOIN detalle_documento dd ON f.code=dd.documento_code
     WHERE (f.seller_code ILIKE 'H%' OR f.seller_code IN ('10','h3'))
       AND f.status='2' AND dd.descripcion_categoria='HIELO'
       AND f.fecha_creacion>='${ini}' AND f.fecha_creacion<'${fin}'
     GROUP BY f.seller_code ORDER BY f.seller_code`, { type: Q });
  return rows.map(r => ({ usuario: r.usuario, unidades: Number(r.unidades) || 0, dolares: Number(r.dolares) || 0 }));
}

// ─────────────────────────────────────────────────────────────────────────────
// RESPUESTA
// Devuelve { texto, datos, titulo, anio, mes } o null si no aplica.
// Solo para ADMIN (el total EMPRESA no se filtra por vendedor individual).
// ─────────────────────────────────────────────────────────────────────────────
async function responderHieloDashboard(pregunta, { rol } = {}) {
  if (!detectarPreguntaHielo(pregunta)) return null;
  if (rol === "VENDEDOR") return null; // que lo maneje el agente con su filtro

  const t = (pregunta || "").toLowerCase();
  const { anio, mes } = parsearPeriodo(pregunta);
  const etiqueta = `${NOMBRES_MES[mes - 1]} de ${anio}`;

  // ¿Pidió desglose por ruta / vendedor / usuario?
  const porRuta = /\bpor\s+(ruta|vendedor|usuario|seller)\b/i.test(t);

  if (porRuta) {
    const filas = await hieloPorUsuario(anio, mes);
    if (filas.length === 0) return { texto: `No hay ventas de hielo registradas para ${etiqueta}.`, datos: [], anio, mes };
    const filasOrden = filas.slice().sort((a, b) => b.dolares - a.dolares);
    const lineas = filasOrden.map((r, i) => `${i + 1}. ${r.usuario} — $${fmtMonto(r.dolares)} (${fmtUnid(r.unidades)} uds)`);
    const totMV = filasOrden.reduce((s, r) => s + r.dolares, 0);
    const texto =
      `Ventas de hielo por vendedor (MobilVendor) — ${etiqueta}:\n\n` + lineas.join("\n") +
      `\n\nSubtotal MobilVendor: $${fmtMonto(totMV)}.`;
    return {
      texto,
      datos: filasOrden.map((r, i) => ({ posicion: i + 1, vendedor: r.usuario, unidades: r.unidades, dolares: r.dolares })),
      titulo: `Ventas de Hielo por Vendedor — ${etiqueta}`,
      anio, mes,
    };
  }

  // Total EMPRESA
  const r = await calcularHieloEmpresaMes(anio, mes);
  if (!r.dolares && !r.unidades) return { texto: `No hay ventas de hielo registradas para ${etiqueta}.`, datos: [], anio, mes };

  const texto =
    `La venta total de hielo (empresa) en ${etiqueta} fue de **$${fmtMonto(r.dolares)}** ` +
    `con **${fmtUnid(r.unidades)} unidades**.\n\n` +
    `Desglose por fuente:\n` +
    `• MobilVendor: $${fmtMonto(r.fuentes.MV.dolares)} (${fmtUnid(r.fuentes.MV.unidades)} uds)\n` +
    `• DISTRINTER: $${fmtMonto(r.fuentes.DISTRINTER.dolares)} (${fmtUnid(r.fuentes.DISTRINTER.unidades)} uds)\n` +
    `• Odoo GA: $${fmtMonto(r.fuentes.ODOO_GA.dolares)} (${fmtUnid(r.fuentes.ODOO_GA.unidades)} uds)`;

  const datos = [
    { fuente: "MobilVendor", unidades: r.fuentes.MV.unidades,         dolares: r.fuentes.MV.dolares },
    { fuente: "DISTRINTER",  unidades: r.fuentes.DISTRINTER.unidades, dolares: r.fuentes.DISTRINTER.dolares },
    { fuente: "Odoo GA",     unidades: r.fuentes.ODOO_GA.unidades,    dolares: r.fuentes.ODOO_GA.dolares },
    { fuente: "TOTAL",       unidades: r.unidades,                    dolares: r.dolares },
  ];

  return { texto, datos, titulo: `Venta de Hielo (Empresa) — ${etiqueta}`, anio, mes };
}

module.exports = {
  detectarPreguntaHielo,
  responderHieloDashboard,
  calcularHieloEmpresaMes,
};
