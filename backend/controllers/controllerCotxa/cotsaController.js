// controllers/cotsaController.js
const { sequelize } = require('../../models');
const Sequelize = require('sequelize');

const COTSA_COMPANY_ID = 3;

// ================================================================
// HELPERS DE FECHA
// ================================================================
function getFechaInicioMes(anio, mes) {
  return `${anio}-${String(mes).padStart(2, '0')}-01 00:00:00`;
}

function getFechaFinMes(anio, mes) {
  let mesFin = mes + 1, anioFin = anio;
  if (mesFin === 13) { mesFin = 1; anioFin++; }
  return `${anioFin}-${String(mesFin).padStart(2, '0')}-01 00:00:00`;
}

// ================================================================
// FECHA DE ÚLTIMA SINCRONIZACIÓN
// ================================================================
const obtenerFechaSincronizacion = async () => {
  const result = await sequelize.query(
    'SELECT hasta_date FROM sincronizaciones_ventas ORDER BY fecha_sync DESC LIMIT 1',
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
    return `${yyyy}-${String(mm).padStart(2, '0')}-${String(dd + 1).padStart(2, '0')} 00:00:00`;
  }
  return getFechaFinMes(anioNum, mesNum);
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

const getDiasHabilesTranscurridos = (anio, mes) => {
  const hoy      = new Date();
  const hoyLocal = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());
  const ayer     = new Date(hoyLocal);
  ayer.setDate(hoyLocal.getDate() - 1);

  let ultimoDia = new Date(anio, mes, 0).getDate();
  if (ayer.getFullYear() === anio && ayer.getMonth() + 1 === mes)
    ultimoDia = ayer.getDate();

  let habiles = 0;
  for (let d = 1; d <= ultimoDia; d++) {
    const fecha     = new Date(anio, mes - 1, d);
    const diaSemana = fecha.getDay();
    const esFestivo = festivos.some(f =>
      f.getDate() === fecha.getDate() &&
      f.getMonth() === fecha.getMonth() &&
      f.getFullYear() === fecha.getFullYear()
    );
    if (diaSemana !== 0 && !esFestivo) habiles++;
  }
  return habiles;
};

const getDiasLaborablesMes = (anio, mes) => {
  const diasEnMes = new Date(anio, mes, 0).getDate();
  let laborables  = 0;
  for (let d = 1; d <= diasEnMes; d++) {
    const fecha     = new Date(anio, mes - 1, d);
    const diaSemana = fecha.getDay();
    const esFestivo = festivos.some(f =>
      f.getDate() === fecha.getDate() &&
      f.getMonth() === fecha.getMonth() &&
      f.getFullYear() === fecha.getFullYear()
    );
    if (diaSemana !== 0 && !esFestivo) laborables++;
  }
  return laborables;
};

// ================================================================
// QUERY PRINCIPAL — rutas COTSA
// ================================================================
const obtenerVentasCOTSAPorRuta = async (anioNum, mesNum, fechaFin = null) => {
  const inicio = getFechaInicioMes(anioNum, mesNum);
  const fin    = fechaFin || getFechaFinMes(anioNum, mesNum);

  const sql = `
    SELECT
      COALESCE(f.route_code, 'SIN RUTA') AS ruta,
      f.seller_code                       AS vendedor,
      SUM(dd.cantidad)                    AS unidades,
      SUM(dd.subtotal)                    AS subtotal,
      SUM(dd.total)                       AS dolares,
      COUNT(DISTINCT f.code)              AS cant_facturas,
      COUNT(DISTINCT f.customer_code)     AS cant_clientes
    FROM facturas f
    JOIN detalle_documento dd ON dd.documento_code = f.code
    WHERE f.company_id = ${COTSA_COMPANY_ID}
      AND f.status IN (2, 4, 5)
      AND f.fecha_creacion >= '${inicio}'
      AND f.fecha_creacion  < '${fin}'
    GROUP BY f.route_code, f.seller_code
    ORDER BY dolares DESC
  `;
  return await sequelize.query(sql, { type: Sequelize.QueryTypes.SELECT });
};

// ================================================================
// ENDPOINT PRINCIPAL
// ================================================================
const obtenerDashboardCOTSA = async (req, res) => {
  try {
    const { anio, mes } = req.query;
    if (!anio || !mes)
      return res.status(400).json({ error: 'Debe enviar ?anio=YYYY&mes=MM' });

    const anioNum = parseInt(anio, 10);
    const mesNum  = parseInt(mes,  10);

    if (isNaN(anioNum) || isNaN(mesNum) || mesNum < 1 || mesNum > 12)
      return res.status(400).json({ error: 'Parámetros anio/mes inválidos.' });

    const hoy          = new Date();
    const esMesActual  = anioNum === hoy.getFullYear() && mesNum === hoy.getMonth() + 1;
    const esMesCerrado = anioNum < hoy.getFullYear() ||
      (anioNum === hoy.getFullYear() && mesNum < hoy.getMonth() + 1);

    const fechaFinDinamica  = await getFechaFinQuery(anioNum, mesNum);
    const diasTranscurridos = getDiasHabilesTranscurridos(anioNum, mesNum);
    const diasLaborables    = getDiasLaborablesMes(anioNum, mesNum);

    // Mes anterior
    let mesPrev = mesNum - 1, anioPrev = anioNum;
    if (mesPrev === 0) { mesPrev = 12; anioPrev--; }

    // Ambos en paralelo
    const [ventasActuales, ventasAnteriores] = await Promise.all([
      obtenerVentasCOTSAPorRuta(anioNum, mesNum, fechaFinDinamica),
      obtenerVentasCOTSAPorRuta(anioPrev, mesPrev),
    ]);

    // Mapa mes anterior
    const mapAnterior = {};
    ventasAnteriores.forEach(r => {
      mapAnterior[r.ruta] = Number(r.dolares) || 0;
    });

    // Ranking con proyección y comparativa
    const ranking = ventasActuales.map(r => {
      const montoActual   = Number(r.dolares) || 0;
      const montoAnterior = mapAnterior[r.ruta] || 0;
      const proyeccion    = esMesCerrado || diasTranscurridos === 0
        ? montoActual
        : (montoActual / diasTranscurridos) * diasLaborables;
      const variacionAbs  = proyeccion - montoAnterior;
      const variacionPorc = montoAnterior > 0
        ? (variacionAbs / montoAnterior) * 100
        : null;

      return {
        ruta         : r.ruta,
        vendedor     : r.vendedor,
        unidades     : Number(r.unidades),
        subtotal     : Number(r.subtotal),
        dolares      : montoActual,
        proyeccion   : Number(proyeccion.toFixed(2)),
        cant_facturas: Number(r.cant_facturas),
        cant_clientes: Number(r.cant_clientes),
        vsMesAnterior: {
          dolares_anterior: Number(montoAnterior.toFixed(2)),
          variacion_abs   : Number(variacionAbs.toFixed(2)),
          variacion_porc  : variacionPorc !== null ? Number(variacionPorc.toFixed(2)) : null,
        },
      };
    });

    // Totales para las cards superiores
    const totales = {
      unidades     : ranking.reduce((a, r) => a + r.unidades, 0),
      dolares      : ranking.reduce((a, r) => a + r.dolares,  0),
      proyeccion   : ranking.reduce((a, r) => a + r.proyeccion, 0),
      cant_facturas: ranking.reduce((a, r) => a + r.cant_facturas, 0),
      cant_clientes: ranking.reduce((a, r) => a + r.cant_clientes, 0),
    };

    return res.status(200).json({ ranking, totales });

  } catch (error) {
    console.error('❌ ERROR DASHBOARD COTSA:', error);
    return res.status(500).json({ message: 'Error al obtener datos COTSA' });
  }
};

// ================================================================
// ENDPOINT DETALLE POR RUTA
// ================================================================
const obtenerDetalleRutaCOTSA = async (req, res) => {
  try {
    const { ruta, anio, mes } = req.query;
    if (!ruta || !anio || !mes)
      return res.status(400).json({ error: 'Debe enviar ruta, anio y mes' });

    const anioNum = parseInt(anio, 10);
    const mesNum  = parseInt(mes,  10);
    const inicio  = getFechaInicioMes(anioNum, mesNum);
    const fin     = getFechaFinMes(anioNum, mesNum);

    const sql = `
      SELECT
        dd.codigo_producto,
        dd.descripcion,
        SUM(dd.cantidad)   AS unidades,
        SUM(dd.subtotal)   AS subtotal,
        SUM(dd.total)      AS dolares,
        CASE WHEN SUM(dd.cantidad) > 0
          THEN SUM(dd.total) / SUM(dd.cantidad)
          ELSE 0
        END                AS precio_promedio
      FROM facturas f
      JOIN detalle_documento dd ON dd.documento_code = f.code
      WHERE f.company_id = ${COTSA_COMPANY_ID}
        AND f.status IN (2, 4, 5)
        AND f.route_code = '${ruta}'
        AND f.fecha_creacion >= '${inicio}'
        AND f.fecha_creacion  < '${fin}'
      GROUP BY dd.codigo_producto, dd.descripcion
      ORDER BY unidades DESC
    `;

    const detalle = await sequelize.query(sql, { type: Sequelize.QueryTypes.SELECT });
    return res.status(200).json(detalle);

  } catch (error) {
    console.error('❌ Error en obtenerDetalleRutaCOTSA:', error);
    return res.status(500).json({ message: 'Error interno' });
  }
};

module.exports = { obtenerDashboardCOTSA, obtenerDetalleRutaCOTSA };