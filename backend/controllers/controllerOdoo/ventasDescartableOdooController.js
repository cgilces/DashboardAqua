// controllers/ventasDescartableOdooController.js
// Muestra ventas de productos DESCARTABLE (categoria 7)
// para todas las rutas que facturan en Odoo

const Sequelize = require("sequelize");
const { sequelize } = require("../../models");

// ================================================================
// RUTAS QUE FACTURAN EN ODOO
// ================================================================
const RUTAS_ODOO = [
  "Carmen Garcia",
  "Estefania Flores",
  "Tamara Villacres",
  "RUTA E1", "RUTA E2", "RUTA E3", "RUTA E4", "RUTA E5",
  "RUTA E6", "RUTA E7", "RUTA E8", "RUTA E9", "RUTA E10",
  "RUTA EA1",
  "RUTA U2",
  "Distribucion OK/E",
  "Domicilio",
];

// ================================================================
// HELPERS DE FECHA
// ================================================================
function getFechaInicioMes(anio, mes) {
  return `${anio}-${String(mes).padStart(2, "0")}-01 00:00:00`;
}

function getFechaFinMes(anio, mes) {
  let mesFin = mes + 1, anioFin = anio;
  if (mesFin === 13) { mesFin = 1; anioFin++; }
  return `${anioFin}-${String(mesFin).padStart(2, "0")}-01 00:00:00`;
}

const obtenerFechaSincronizacion = async () => {
  const result = await sequelize.query(
    `SELECT hasta_date FROM sincronizaciones_ventas ORDER BY fecha_sync DESC LIMIT 1`,
    { type: Sequelize.QueryTypes.SELECT }
  );
  if (!result || result.length === 0) throw new Error("No hay fecha de sincronización");
  return result[0].hasta_date;
};

const getFechaFinQuery = async (anio, mes) => {
  const hoy = new Date();
  const esMesActual = anio === hoy.getFullYear() && mes === hoy.getMonth() + 1;
  if (esMesActual) {
    const ultimaSync = await obtenerFechaSincronizacion();
    const [yyyy, mm, dd] = String(ultimaSync).substring(0, 10).split("-").map(Number);
    return `${yyyy}-${String(mm).padStart(2, "0")}-${String(dd + 1).padStart(2, "0")} 00:00:00`;
  }
  return getFechaFinMes(anio, mes);
};

// ================================================================
// DÍAS HÁBILES
// ================================================================
const festivos = [
  new Date(2025, 0, 1), new Date(2025, 4, 1), new Date(2025, 11, 25),
  new Date(2026, 0, 1), new Date(2026, 1, 16), new Date(2026, 1, 17),
  new Date(2026, 2, 29), new Date(2026, 2, 30), new Date(2026, 4, 1),
  new Date(2026, 7, 10), new Date(2026, 9, 9), new Date(2026, 10, 2),
  new Date(2026, 10, 3), new Date(2026, 11, 6), new Date(2026, 11, 8),
  new Date(2026, 11, 25),
];

function getDiasHabilesTranscurridos(anio, mes) {
  const hoy = new Date();
  const hoyLocal = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());
  const ayer = new Date(hoyLocal);
  ayer.setDate(hoyLocal.getDate() - 1);

  let ultimoDia = new Date(anio, mes, 0).getDate();
  if (ayer.getFullYear() === anio && ayer.getMonth() + 1 === mes)
    ultimoDia = ayer.getDate();

  let habiles = 0;
  for (let d = 1; d <= ultimoDia; d++) {
    const fecha = new Date(anio, mes - 1, d);
    if (fecha.getDay() === 0) continue;
    const esFestivo = festivos.some(
      f => f.getDate() === d && f.getMonth() === mes - 1 && f.getFullYear() === anio
    );
    if (!esFestivo) habiles++;
  }
  return habiles;
}

function getDiasLaborablesMes(anio, mes) {
  const diasEnMes = new Date(anio, mes, 0).getDate();
  let laborables = 0;
  for (let d = 1; d <= diasEnMes; d++) {
    const fecha = new Date(anio, mes - 1, d);
    if (fecha.getDay() === 0) continue;
    const esFestivo = festivos.some(
      f => f.getDate() === d && f.getMonth() === mes - 1 && f.getFullYear() === anio
    );
    if (!esFestivo) laborables++;
  }
  return laborables;
}

// ================================================================
// QUERY VENTAS DESCARTABLE ODOO POR RUTA
// Usa tabla ordenes (type=2) filtrado por seller_nombre
// Status 2 = sale/done (confirmadas en Odoo)
// ================================================================
const queryVentasPorRuta = async (inicio, fin) => {
  const placeholders = RUTAS_ODOO.map((_, i) => `:ruta${i}`).join(", ");
  const replacements = {};
  RUTAS_ODOO.forEach((r, i) => { replacements[`ruta${i}`] = r; });
  replacements.inicio = inicio;
  replacements.fin    = fin;

  const sql = `
    SELECT
      o.seller_nombre                 AS ruta,
      SUM(dd.cantidad)                AS unidades,
      SUM(dd.subtotal)                AS subtotal,
      SUM(dd.total)                   AS dolares,
      COUNT(DISTINCT o.code)          AS cant_ordenes,
      COUNT(DISTINCT o.customer_code) AS cant_clientes
    FROM ordenes o
    JOIN detalle_documento dd ON dd.documento_code = o.code
    WHERE
      o.type = 2
      AND o.status IN (2, 4, 5)
      AND dd.codigo_categoria = '7'
      AND o.seller_nombre IN (${placeholders})
      AND o.fecha_creacion >= :inicio
      AND o.fecha_creacion <  :fin
    GROUP BY o.seller_nombre
    ORDER BY dolares DESC
  `;

  return await sequelize.query(sql, {
    replacements,
    type: Sequelize.QueryTypes.SELECT,
  });
};

// ================================================================
// ENDPOINT PRINCIPAL
// GET /api/descartable-odoo?anio=2026&mes=3
// ================================================================
const obtenerVentasDescartableOdoo = async (req, res) => {
  try {
    const { anio, mes } = req.query;
    if (!anio || !mes)
      return res.status(400).json({ error: "Debe enviar ?anio=YYYY&mes=MM" });

    const anioNum = parseInt(anio, 10);
    const mesNum  = parseInt(mes,  10);
    if (isNaN(anioNum) || isNaN(mesNum) || mesNum < 1 || mesNum > 12)
      return res.status(400).json({ error: "Parámetros anio/mes inválidos." });

    const hoy         = new Date();
    const esMesActual = anioNum === hoy.getFullYear() && mesNum === hoy.getMonth() + 1;

    // ── Fechas mes actual ───────────────────────────────────────
    const inicio = getFechaInicioMes(anioNum, mesNum);
    const fin    = await getFechaFinQuery(anioNum, mesNum);

    // ── Fechas mes anterior ─────────────────────────────────────
    let mesPrev = mesNum - 1, anioPrev = anioNum;
    if (mesPrev === 0) { mesPrev = 12; anioPrev--; }
    const inicioPrev = getFechaInicioMes(anioPrev, mesPrev);
    const finPrev    = getFechaFinMes(anioPrev, mesPrev);

    // ── Días hábiles ────────────────────────────────────────────
    const diasTranscurridos = getDiasHabilesTranscurridos(anioNum, mesNum);
    const diasLaborablesMes = getDiasLaborablesMes(anioNum, mesNum);

    // ── Queries ─────────────────────────────────────────────────
    const [ventasActual, ventasAnterior] = await Promise.all([
      queryVentasPorRuta(inicio, fin),
      queryVentasPorRuta(inicioPrev, finPrev),
    ]);

    // ── Mapa mes anterior ───────────────────────────────────────
    const mapAnterior = {};
    ventasAnterior.forEach(r => {
      mapAnterior[r.ruta] = {
        unidades : Number(r.unidades) || 0,
        dolares  : Number(r.dolares)  || 0,
      };
    });

    // ── Construir respuesta por ruta ────────────────────────────
    const rutas = ventasActual.map(r => {
      const montoActual   = Number(r.dolares)   || 0;
      const unidadesActual= Number(r.unidades)  || 0;
      const anterior      = mapAnterior[r.ruta] || { unidades: 0, dolares: 0 };

      const proyeccion = esMesActual && diasTranscurridos > 0
        ? (montoActual / diasTranscurridos) * diasLaborablesMes
        : montoActual;

      const variacionAbs  = montoActual - anterior.dolares;
      const variacionPorc = anterior.dolares > 0
        ? (variacionAbs / anterior.dolares) * 100
        : null;

      return {
        ruta          : r.ruta,
        unidades      : unidadesActual,
        dolares       : Number(montoActual.toFixed(2)),
        subtotal      : Number(Number(r.subtotal).toFixed(2)),
        cant_ordenes  : Number(r.cant_ordenes),
        cant_clientes : Number(r.cant_clientes),
        proyeccion    : Number(proyeccion.toFixed(2)),
        mes_anterior  : {
          unidades    : anterior.unidades,
          dolares     : Number(anterior.dolares.toFixed(2)),
        },
        variacion     : {
          abs         : Number(variacionAbs.toFixed(2)),
          porcentaje  : variacionPorc !== null ? Number(variacionPorc.toFixed(2)) : null,
        },
      };
    });

    // ── Totales generales ───────────────────────────────────────
    const totales = {
      unidades     : rutas.reduce((a, r) => a + r.unidades,     0),
      dolares      : Number(rutas.reduce((a, r) => a + r.dolares,      0).toFixed(2)),
      proyeccion   : Number(rutas.reduce((a, r) => a + r.proyeccion,   0).toFixed(2)),
      cant_ordenes : rutas.reduce((a, r) => a + r.cant_ordenes, 0),
      mes_anterior : {
        dolares    : Number(rutas.reduce((a, r) => a + r.mes_anterior.dolares, 0).toFixed(2)),
      },
    };
    totales.variacion = {
      abs       : Number((totales.dolares - totales.mes_anterior.dolares).toFixed(2)),
      porcentaje: totales.mes_anterior.dolares > 0
        ? Number(((totales.dolares - totales.mes_anterior.dolares) / totales.mes_anterior.dolares * 100).toFixed(2))
        : null,
    };

    return res.status(200).json({
      periodo: { anio: anioNum, mes: mesNum, esMesActual },
      fechas : { inicio, fin, inicioPrev, finPrev },
      dias   : { transcurridos: diasTranscurridos, laborables: diasLaborablesMes },
      totales,
      rutas,
    });

  } catch (error) {
    console.error("❌ ERROR ventasDescartableOdoo:", error);
    return res.status(500).json({ message: "Error al obtener ventas descartable Odoo" });
  }
};

module.exports = { obtenerVentasDescartableOdoo };
