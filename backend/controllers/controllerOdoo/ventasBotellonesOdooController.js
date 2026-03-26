// controllers/ventasBotellonOdooController.js
// Muestra ventas de BOTELLÓN (categoria 5)
// para todas las rutas que facturan en Odoo

const Sequelize = require("sequelize");
const { sequelize } = require("../../models");
const { getDiasHabilesTranscurridos, getDiasLaborablesMes } = require('../../utils/diasFestivos');

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




const getFechaFinQuery = async (anioNum, mesNum) => {
  const hoy = new Date();
  const esMesActual = anioNum === hoy.getFullYear() && mesNum === hoy.getMonth() + 1;

  if (esMesActual) {
    const ultimaSync = await obtenerFechaSincronizacion();
    const [yyyy, mm, dd] = String(ultimaSync).substring(0, 10).split('-').map(Number);

    // ✅ Date maneja desbordamiento: día 31+1 → primer día del mes siguiente
    const diaSiguiente = new Date(yyyy, mm - 1, dd + 1);
    const y = diaSiguiente.getFullYear();
    const m = String(diaSiguiente.getMonth() + 1).padStart(2, '0');
    const d = String(diaSiguiente.getDate()).padStart(2, '0');
    return `${y}-${m}-${d} 00:00:00`;
  }

  return getFechaFinMes(anioNum, mesNum);
};


// ================================================================
// QUERY VENTAS BOTELLÓN ODOO POR RUTA
// categoria 5 = Botellón
// status IN (2,4,5) — incluye órdenes Odoo y MobilVendor
// ================================================================
const queryVentasPorRuta = async (inicio, fin) => {
  const placeholders = RUTAS_ODOO.map((_, i) => `:ruta${i}`).join(", ");
  const replacements = {};
  RUTAS_ODOO.forEach((r, i) => { replacements[`ruta${i}`] = r; });
  replacements.inicio = inicio;
  replacements.fin = fin;

  const sql = `
        WITH ventas_base AS (

      /* ===================== ORDENES ===================== */
      SELECT
        o.seller_nombre,
        SUM(dd.cantidad) AS botellones,
        SUM(dd.total)    AS dolares
      FROM ordenes o
      JOIN detalle_documento dd ON dd.documento_code = o.code
      WHERE
        o.type   = 2
        AND o.status IN (2)
        AND dd.codigo_categoria = '5'
        AND o.seller_nombre IN (
          'Carmen Garcia','Estefania Flores','RUTA E1','RUTA E2','RUTA E3','RUTA E4',
          'RUTA E5','RUTA E6','RUTA E7','RUTA E8','RUTA E9','RUTA E10',
          'RUTA EA1','RUTA U2','Tamara Villacres','Distribucion OK/E','Domicilio'
        )
        AND o.fecha_creacion >= :inicio
        AND o.fecha_creacion <  :fin
      GROUP BY o.seller_nombre

      UNION ALL

      /* ===================== FACTURAS ===================== */
      -- facturas no tiene seller_nombre, usamos seller_code
      -- y lo mapeamos al nombre equivalente
      SELECT
        CASE f.seller_code
          WHEN 'CARMEN_GARCIA_CODE'   THEN 'Carmen Garcia'
          -- etc...
        END AS seller_nombre,
        SUM(dd.cantidad) AS botellones,
        SUM(dd.total)    AS dolares
      FROM facturas f
      JOIN detalle_documento dd ON dd.documento_code = f.code
      WHERE
        f.status IN (2)
        AND dd.codigo_categoria = '5'
        AND f.fecha_creacion >= :inicio
        AND f.fecha_creacion <  :fin
      GROUP BY f.seller_code

    )
    SELECT seller_nombre, SUM(botellones) AS botellones, SUM(dolares) AS dolares
    FROM ventas_base
    GROUP BY seller_nombre
    ORDER BY botellones DESC;
  `;

  return await sequelize.query(sql, {
    replacements,
    type: Sequelize.QueryTypes.SELECT,
  });
};

// ================================================================
// ENDPOINT PRINCIPAL
// GET /api/ventas/botellon-odoo?anio=2026&mes=3
// ================================================================
const obtenerVentasBotellonOdoo = async (req, res) => {
  try {
    const { anio, mes } = req.query;
    if (!anio || !mes)
      return res.status(400).json({ error: "Debe enviar ?anio=YYYY&mes=MM" });

    const anioNum = parseInt(anio, 10);
    const mesNum = parseInt(mes, 10);
    if (isNaN(anioNum) || isNaN(mesNum) || mesNum < 1 || mesNum > 12)
      return res.status(400).json({ error: "Parámetros anio/mes inválidos." });

    const hoy = new Date();
    const esMesActual = anioNum === hoy.getFullYear() && mesNum === hoy.getMonth() + 1;

    // ── Fechas mes actual ───────────────────────────────────────
    const inicio = getFechaInicioMes(anioNum, mesNum);
    const fin = await getFechaFinQuery(anioNum, mesNum);

    // ── Fechas mes anterior ─────────────────────────────────────
    let mesPrev = mesNum - 1, anioPrev = anioNum;
    if (mesPrev === 0) { mesPrev = 12; anioPrev--; }
    const inicioPrev = getFechaInicioMes(anioPrev, mesPrev);
    const finPrev = getFechaFinMes(anioPrev, mesPrev);

    // ── Días hábiles ────────────────────────────────────────────
    const diasTranscurridos = getDiasHabilesTranscurridos(anioNum, mesNum);
    const diasLaborablesMes = getDiasLaborablesMes(anioNum, mesNum);

    // ── Queries paralelos ───────────────────────────────────────
    const [ventasActual, ventasAnterior] = await Promise.all([
      queryVentasPorRuta(inicio, fin),
      queryVentasPorRuta(inicioPrev, finPrev),
    ]);

    // ── Mapa mes anterior ───────────────────────────────────────
    const mapAnterior = {};
    ventasAnterior.forEach(r => {
      mapAnterior[r.seller_nombre] = {

        botellones: Number(r.botellones) || 0,
        dolares: Number(r.dolares) || 0,
      };
    });

    // ── Construir respuesta por ruta ────────────────────────────
    const rutas = ventasActual.map(r => {
      const botonesActual = Number(r.botellones) || 0;
      const montoActual = Number(r.dolares) || 0;
      const anterior = mapAnterior[r.seller_nombre] || { botellones: 0, dolares: 0 };

      // Proyección en botellones y dólares
      const proyeccionBotellones = esMesActual && diasTranscurridos > 0
        ? (botonesActual / diasTranscurridos) * diasLaborablesMes
        : botonesActual;

      const proyeccionDolares = esMesActual && diasTranscurridos > 0
        ? (montoActual / diasTranscurridos) * diasLaborablesMes
        : montoActual;

      const variacionAbs = botonesActual - anterior.botellones;
      const variacionPorc = anterior.botellones > 0
        ? (variacionAbs / anterior.botellones) * 100
        : null;

      const variacionDolaresAbs = montoActual - anterior.dolares;
      const variacionDolaresPorc = anterior.dolares > 0
        ? (variacionDolaresAbs / anterior.dolares) * 100
        : null;

      return {
        ruta: r.seller_nombre,   // <-- mapear seller_nombre a ruta
        botellones: botonesActual,
        dolares: Number(montoActual.toFixed(2)),
        subtotal: Number(Number(r.subtotal).toFixed(2)),
        cant_ordenes: Number(r.cant_ordenes),
        cant_clientes: Number(r.cant_clientes),
        proyeccion_botellones: Number(proyeccionBotellones.toFixed(0)),
        proyeccion_dolares: Number(proyeccionDolares.toFixed(2)),
        mes_anterior: {
          botellones: anterior.botellones,
          dolares: Number(anterior.dolares.toFixed(2)),
        },
        variacion_botellones: {
          abs: Number(variacionAbs.toFixed(0)),
          porcentaje: variacionPorc !== null ? Number(variacionPorc.toFixed(2)) : null,
        },
        variacion_dolares: {
          abs: Number(variacionDolaresAbs.toFixed(2)),
          porcentaje: variacionDolaresPorc !== null ? Number(variacionDolaresPorc.toFixed(2)) : null,
        },
      };
    });

    // ── Totales generales ───────────────────────────────────────
    const totales = {
      botellones: rutas.reduce((a, r) => a + r.botellones, 0),
      dolares: Number(rutas.reduce((a, r) => a + r.dolares, 0).toFixed(2)),
      proyeccion_botellones: Number(rutas.reduce((a, r) => a + r.proyeccion_botellones, 0).toFixed(0)),
      proyeccion_dolares: Number(rutas.reduce((a, r) => a + r.proyeccion_dolares, 0).toFixed(2)),
      cant_ordenes: rutas.reduce((a, r) => a + r.cant_ordenes, 0),
      mes_anterior: {
        botellones: rutas.reduce((a, r) => a + r.mes_anterior.botellones, 0),
        dolares: Number(rutas.reduce((a, r) => a + r.mes_anterior.dolares, 0).toFixed(2)),
      },
    };

    const varTotalAbs = totales.botellones - totales.mes_anterior.botellones;
    const varTotalPorc = totales.mes_anterior.botellones > 0
      ? (varTotalAbs / totales.mes_anterior.botellones) * 100
      : null;

    totales.variacion = {
      abs: varTotalAbs,
      porcentaje: varTotalPorc !== null ? Number(varTotalPorc.toFixed(2)) : null,
    };

    return res.status(200).json({
      periodo: { anio: anioNum, mes: mesNum, esMesActual },
      fechas: { inicio, fin, inicioPrev, finPrev },
      dias: { transcurridos: diasTranscurridos, laborables: diasLaborablesMes },
      totales,
      rutas,
    });

  } catch (error) {
    console.error("❌ ERROR ventasBotellonOdoo:", error);
    return res.status(500).json({ message: "Error al obtener ventas botellón Odoo" });
  }
};

module.exports = { obtenerVentasBotellonOdoo };