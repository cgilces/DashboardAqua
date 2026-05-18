const Sequelize = require("sequelize");
const Op = Sequelize.Op;
const { sequelize } = require('../../models');
const { getDiasHabilesTranscurridos, getDiasLaborablesMes } = require('../../utils/diasFestivos');

// Productos PLUS ELECTROLYTES — separados por sistema (códigos verificados
// directo contra Odoo el 2026-05-14 con name ILIKE 'PLUS ELECTROLYTES').
//
//   MV (facturas)  :
//     1725 LIMON SOBRE 7.7g x6
//     1727 NARANJA SOBRE 7.6g x6
//     1726 SANDIA SOBRE 7.3g x6
//
//   ODOO (ordenes / facturas) — ID interno Odoo:
//     1617 PLUS ELECTROLYTES LIMON SOBRE 7.7g x6
//     1618 PLUS ELECTROLYTES SANDIA SOBRE 7.3g x6
//     1619 PLUS ELECTROLYTES NARANJA SOBRE 7.6g x6
//     4009 CAJA PLUS ELECTROLYTES NARANJA
//     4010 CAJA PLUS ELECTROLYTES LIMON
//     4011 CAJA PLUS ELECTROLYTES SANDIA
//     2440 Caja Plus Electrolytes 6 sobres (Salty Citrus)
//     2441 Caja Plus Electrolytes 6 sobres (Salty Orange)
//     2442 Caja Plus Electrolytes 6 sobres (Salty Watermelon)
const PRODUCTOS_PLUS_MV   = ['1725', '1727', '1726'];
const PRODUCTOS_PLUS_ODOO = ['1617', '1618', '1619', '4009', '4010', '4011', '2440', '2441', '2442'];
const PRODUCTOS_PLUS      = [...PRODUCTOS_PLUS_MV, ...PRODUCTOS_PLUS_ODOO];

const inClause = (codes, alias = 'dd') =>
  `${alias}.codigo_producto IN (${codes.map(p => `'${p}'`).join(',')})`;

const plusInClauseMV   = (alias = 'dd') => inClause(PRODUCTOS_PLUS_MV,   alias);
const plusInClauseOdoo = (alias = 'dd') => inClause(PRODUCTOS_PLUS_ODOO, alias);
const plusInClause     = (alias = 'dd') => inClause(PRODUCTOS_PLUS,      alias);

const calcularKPIsMes = async (anioNum, mesNum) => {

  const hoyDate = new Date();
  const esMesActual = hoyDate.getFullYear() === anioNum && hoyDate.getMonth() + 1 === mesNum;

  const fechaInicioActual = `${anioNum}-${String(mesNum).padStart(2, "0")}-01 00:00:00`;

  let mesFin = mesNum + 1;
  let anioFin = anioNum;
  if (mesFin === 13) { mesFin = 1; anioFin++; }

  const fechaFinMes = `${anioFin}-${String(mesFin).padStart(2, "0")}-01 00:00:00`;
  const fechaFinHoy = `${hoyDate.getFullYear()}-${String(hoyDate.getMonth() + 1).padStart(2, '0')}-${String(hoyDate.getDate()).padStart(2, '0')} 00:00:00`;
  const fechaFinActual = esMesActual ? fechaFinHoy : fechaFinMes;

  let mesAnterior = mesNum - 1;
  let anioAnterior = anioNum;
  if (mesAnterior === 0) { mesAnterior = 12; anioAnterior--; }

  const fechaInicioAnterior = `${anioAnterior}-${String(mesAnterior).padStart(2, "0")}-01 00:00:00`;
  const fechaFinAnterior = fechaInicioActual;

  const diasTranscurridos = getDiasHabilesTranscurridos(anioNum, mesNum);
  const diasLaborablesMes = getDiasLaborablesMes(anioNum, mesNum);

  // ── MV MES ACTUAL (solo productos MobilVendor) ──────────────────
  const [actualSQL] = await sequelize.query(`
    SELECT
      COALESCE(SUM(dd.cantidad), 0) AS unidades,
      COALESCE(SUM(dd.total),    0) AS monto
    FROM facturas f
    JOIN detalle_documento dd ON f.code = dd.documento_code
    WHERE
      ${plusInClauseMV('dd')}
      AND f.status = '2'
      AND f.fecha_creacion >= '${fechaInicioActual}'
      AND f.fecha_creacion <  '${fechaFinActual}';
  `);

  const [anteriorSQL] = await sequelize.query(`
    SELECT
      COALESCE(SUM(dd.cantidad), 0) AS unidades,
      COALESCE(SUM(dd.total),    0) AS monto
    FROM facturas f
    JOIN detalle_documento dd ON f.code = dd.documento_code
    WHERE
      ${plusInClauseMV('dd')}
      AND f.status = '2'
      AND f.fecha_creacion >= '${fechaInicioAnterior}'
      AND f.fecha_creacion <  '${fechaFinAnterior}';
  `);

  const unidadesActual = Number(actualSQL[0]?.unidades || 0);
  const montoActual    = Number(actualSQL[0]?.monto    || 0);
  const unidadesAnterior = Number(anteriorSQL[0]?.unidades || 0);
  const montoAnterior    = Number(anteriorSQL[0]?.monto    || 0);

  const proyeccionMonto    = esMesActual && diasTranscurridos > 0
    ? (montoActual / diasTranscurridos) * diasLaborablesMes
    : montoActual;
  const proyeccionUnidades = esMesActual && diasTranscurridos > 0
    ? Math.round((unidadesActual / diasTranscurridos) * diasLaborablesMes)
    : unidadesActual;

  const variacionUnidadesAbs  = proyeccionUnidades - unidadesAnterior;
  const variacionUnidadesPorc = unidadesAnterior > 0
    ? (variacionUnidadesAbs / unidadesAnterior) * 100 : null;
  const variacionMontoAbs  = proyeccionMonto - montoAnterior;
  const variacionMontoPorc = montoAnterior > 0
    ? (variacionMontoAbs / montoAnterior) * 100 : null;

  const metaMensualUnidades = 5000;
  const metaMensualDolares  = 5000;

  const cumplimientoUnidadesMensual = (unidadesActual / metaMensualUnidades) * 100;
  const cumplimientoUSDMensual      = (montoActual    / metaMensualDolares)  * 100;

  return {
    kpisGenerales: {
      unidadesTotales: unidadesActual,
      montoTotal:      montoActual,
      proyeccionMonto:    Number(proyeccionMonto.toFixed(2)),
      proyeccionUnidades,
      metaMensualUnidades,
      metaMensualDolares,
      cumplimientoUnidadesMensual,
      cumplimientoUSDMensual
    },
    comparativaMesAnterior: {
      unidades: {
        anterior:     unidadesAnterior,
        actual:       unidadesActual,
        proyeccion:   proyeccionUnidades,
        variacionAbs: variacionUnidadesAbs,
        variacionPorc: variacionUnidadesPorc
      },
      monto: {
        anterior:     montoAnterior,
        actual:       montoActual,
        proyeccion:   Number(proyeccionMonto.toFixed(2)),
        variacionAbs: Number(variacionMontoAbs.toFixed(2)),
        variacionPorc: variacionMontoPorc
      }
    }
  };
};

// ================================================================
// TENDENCIA 6 MESES (MV facturas + Odoo ordenes — productos PLUS)
// ================================================================
const tendencia6MesesPlus = async (anioNum, mesNum) => {
  const NOMBRES_MESES = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];

  let mesInicio = mesNum - 11, anioInicio = anioNum;
  while (mesInicio <= 0) { mesInicio += 12; anioInicio--; }

  const inicio6 = `${anioInicio}-${String(mesInicio).padStart(2,'0')}-01 00:00:00`;
  let mesFin = mesNum + 1, anioFin = anioNum;
  if (mesFin === 13) { mesFin = 1; anioFin++; }
  const fin6 = `${anioFin}-${String(mesFin).padStart(2,'0')}-01 00:00:00`;

  const rows = await sequelize.query(`
    SELECT mes_periodo, SUM(dolares) AS dolares, SUM(unidades) AS unidades
    FROM (
      -- MV: solo productos MobilVendor (facturas MobilVendor)
      SELECT DATE_TRUNC('month', f.fecha_creacion) AS mes_periodo,
             SUM(dd.total) AS dolares, SUM(dd.cantidad) AS unidades
      FROM facturas f
      JOIN detalle_documento dd ON dd.documento_code = f.code
      WHERE ${plusInClauseMV('dd')}
        AND f.status = '2'
        AND f.fecha_creacion >= :inicio6 AND f.fecha_creacion < :fin6
      GROUP BY DATE_TRUNC('month', f.fecha_creacion)

      UNION ALL

      -- Odoo: sale.order (pedidos confirmados, bruto sin restar NC)
      SELECT DATE_TRUNC('month', o.fecha_creacion) AS mes_periodo,
             SUM(dd.total) AS dolares, SUM(dd.cantidad) AS unidades
      FROM ordenes o
      JOIN detalle_documento dd ON dd.documento_code = o.code
      WHERE ${plusInClauseOdoo('dd')}
        AND o.status IN (2)
        AND o.fecha_creacion >= :inicio6 AND o.fecha_creacion < :fin6
      GROUP BY DATE_TRUNC('month', o.fecha_creacion)
    ) combinado
    GROUP BY mes_periodo
    ORDER BY mes_periodo
  `, { replacements: { inicio6, fin6 }, type: Sequelize.QueryTypes.SELECT });

  const hoy = new Date();
  return rows.map(r => {
    const d        = new Date(r.mes_periodo);
    const mes      = d.getMonth() + 1;
    const anio     = d.getFullYear();
    const dolares  = Number(Number(r.dolares  || 0).toFixed(2));
    const unidades = Number(r.unidades || 0);
    const esCurrent = anio === hoy.getFullYear() && mes === hoy.getMonth() + 1;
    const diasT = esCurrent ? getDiasHabilesTranscurridos(anio, mes) : 0;
    const diasL = esCurrent ? getDiasLaborablesMes(anio, mes) : 0;
    const proyeccion = esCurrent && diasT > 0
      ? Number(((dolares / diasT) * diasL).toFixed(2))
      : dolares;
    return { label: NOMBRES_MESES[d.getMonth()], anio, mes, dolares, unidades, proyeccion };
  });
};

const dashboardVentasPlus = async (req, res) => {
  try {
    const { anio, mes } = req.query;
    if (!anio || !mes) {
      return res.status(400).json({ error: "Debe enviar los parámetros ?anio=YYYY&mes=MM" });
    }

    const anioNum = parseInt(anio, 10);
    const mesNum  = parseInt(mes, 10);

    const [resumenActual, tendencia6Meses] = await Promise.all([
      calcularKPIsMes(anioNum, mesNum),
      tendencia6MesesPlus(anioNum, mesNum),
    ]);

    return res.status(200).json({
      kpisGenerales: { resumenActual },
      tendencia6Meses,
    });

  } catch (error) {
    console.error("Error al obtener los KPIs de Plus:", error);
    return res.status(500).json({ message: "Error al obtener los KPIs de Plus" });
  }
};

module.exports = dashboardVentasPlus;
module.exports.PRODUCTOS_PLUS      = PRODUCTOS_PLUS;
module.exports.PRODUCTOS_PLUS_MV   = PRODUCTOS_PLUS_MV;
module.exports.PRODUCTOS_PLUS_ODOO = PRODUCTOS_PLUS_ODOO;
module.exports.plusInClause        = plusInClause;
module.exports.plusInClauseMV      = plusInClauseMV;
module.exports.plusInClauseOdoo    = plusInClauseOdoo;
