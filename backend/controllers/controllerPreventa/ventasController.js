// controllers/ventasController.js
const {
  Orden,
  DetalleDocumento,
  MetaPreventa,        // ← ya importado
} = require("../../models");

const Sequelize = require("sequelize");
const Op = Sequelize.Op;
const { sequelize } = require('../../models');

// ==========================================
//  SOLO RUTAS DE PREVENTA PERMITIDAS
// ==========================================
const RUTAS_PREVENTA_VALIDAS = [
  "PV1","PV2","PV3","PV4","PV5","PV6","PV7","PV8","PV9",
  "PV10","PV11","PV12","PV13","PV14",
  "PREVENTA VIP 1","TELEVENTA 1","TELEVENTA 4",
];

const META_MENSUAL_UNIDADES_PREVENTA = 70000;
const META_MENSUAL_USD_PREVENTA      = 200000;

// =============================================================
// 🧩 FUNCIÓN SEGURA PARA FECHAS PG
// =============================================================
function getRangoFechas(anio, mes) {
  const inicio = new Date(Date.UTC(anio, mes - 1, 1));
  const fin    = new Date(Date.UTC(anio, mes, 1));
  return {
    fInicio: inicio.toISOString().replace("T"," ").substring(0,19),
    fFin:    fin.toISOString().replace("T"," ").substring(0,19),
  };
}

// ======================================================
//  DÍAS HÁBILES TRANSCURRIDOS (L–S)
// ======================================================
const getDiasHabilesTranscurridos = (anio, mes, festivos = []) => {
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
      f.getDate()     === fecha.getDate()  &&
      f.getMonth()    === fecha.getMonth() &&
      f.getFullYear() === fecha.getFullYear()
    );
    if (diaSemana !== 0 && !esFestivo) habiles++;
  }
  return habiles;
};

const festivos = [
  new Date(2025,0,1), new Date(2025,4,1),  new Date(2025,11,25),
  new Date(2026,0,1), new Date(2026,1,16), new Date(2026,1,17),
  new Date(2026,2,29),new Date(2026,2,30), new Date(2026,4,1),
  new Date(2026,7,10),new Date(2026,9,9),  new Date(2026,10,2),
  new Date(2026,10,3),new Date(2026,11,6), new Date(2026,11,8),
  new Date(2026,11,25),
];

const getDiasLaborablesMes = (anio, mes, festivos = []) => {
  const diasEnMes = new Date(anio, mes, 0).getDate();
  let laborables  = 0;
  for (let d = 1; d <= diasEnMes; d++) {
    const fecha     = new Date(anio, mes - 1, d);
    const diaSemana = fecha.getDay();
    const esFestivo = festivos.some(f =>
      f.getDate()     === fecha.getDate()  &&
      f.getMonth()    === fecha.getMonth() &&
      f.getFullYear() === fecha.getFullYear()
    );
    if (diaSemana !== 0 && !esFestivo) laborables++;
  }
  return laborables;
};

// =====================================
// 🔧 META HISTÓRICA POR PREVENTA (USD)
// =====================================
const obtenerMetasHistoricasPreventas = async () => {
  const sql = `
    SELECT sub.seller_code,
       MAX(sub.total_mes) AS meta_historica,
       mes_max_consumo.mes AS mes_mayor_consumo
    FROM (
      SELECT o.seller_code, DATE_TRUNC('month', o.fecha_entrega) AS mes, SUM(dd.total) AS total_mes
      FROM ordenes o JOIN detalle_documento dd ON dd.documento_code = o.code
      WHERE dd.codigo_categoria = '7' AND o.status IN (2,4,5)
        AND (o.seller_code ILIKE 'PV%' OR o.seller_code ILIKE 'PREVENTA%'
          OR o.seller_code ILIKE 'TELEVENTA%' OR o.seller_code ILIKE 'R%')
      GROUP BY o.seller_code, DATE_TRUNC('month', o.fecha_entrega)
    ) AS sub
    LEFT JOIN (
      SELECT sub2.seller_code, sub2.mes, sub2.total_mes,
             RANK() OVER (PARTITION BY sub2.seller_code ORDER BY sub2.total_mes DESC) AS rank
      FROM (
        SELECT o.seller_code, DATE_TRUNC('month', o.fecha_entrega) AS mes, SUM(dd.total) AS total_mes
        FROM ordenes o JOIN detalle_documento dd ON dd.documento_code = o.code
        WHERE dd.codigo_categoria = '7' AND o.status IN (2,4,5)
          AND (o.seller_code ILIKE 'PV%' OR o.seller_code ILIKE 'PREVENTA%'
            OR o.seller_code ILIKE 'TELEVENTA%' OR o.seller_code ILIKE 'R%')
        GROUP BY o.seller_code, DATE_TRUNC('month', o.fecha_entrega)
      ) AS sub2
    ) AS mes_max_consumo
    ON sub.seller_code = mes_max_consumo.seller_code AND mes_max_consumo.rank = 1
    GROUP BY sub.seller_code, mes_max_consumo.mes;
  `;
  const filas = await sequelize.query(sql, { type: Sequelize.QueryTypes.SELECT });
  const mapa  = {};
  filas.forEach(f => { mapa[f.seller_code] = Number(f.meta_historica); });
  return mapa;
};

const obtenerMetaHistoricaGlobal = async () => {
  const sql = `
    SELECT MAX(total_mes) AS meta_global FROM (
      SELECT DATE_TRUNC('month', o.fecha_entrega) as mes, SUM(dd.total) AS total_mes
      FROM ordenes o JOIN detalle_documento dd ON dd.documento_code = o.code
      WHERE dd.codigo_categoria = '7' AND o.status IN (2,4,5)
        AND (o.seller_code ILIKE 'PV%' OR o.seller_code ILIKE 'PREVENTA%'
          OR o.seller_code ILIKE 'TELEVENTA%' OR o.seller_code ILIKE 'R%')
      GROUP BY DATE_TRUNC('month', o.fecha_entrega)
    ) AS sub;
  `;
  const [row] = await sequelize.query(sql, { type: Sequelize.QueryTypes.SELECT });
  return row?.meta_global ? Number(row.meta_global) : 0;
};

// ══════════════════════════════════════════════════════════════════
// ✅ NUEVO — OBJETIVO GERENCIA desde tabla meta_preventas
//    Retorna mapa: { "PV1": { meta_dolares: 15000, meta_unidades: 500 }, ... }
//    Filtrado exactamente por mes + año
// ══════════════════════════════════════════════════════════════════
const obtenerObjetivosGerencia = async (anioNum, mesNum) => {
  try {
    const registros = await MetaPreventa.findAll({
      where: { mes: mesNum, anio: anioNum },
      attributes: ["codigo_ruta", "meta_dolares", "meta_unidades"],
      raw: true,
    });

    const mapa = {};
    registros.forEach(m => {
      mapa[m.codigo_ruta.toUpperCase()] = {
        meta_dolares:  Number(m.meta_dolares)  || 0,
        meta_unidades: Number(m.meta_unidades) || 0,
      };
    });

    console.log(`🎯 Objetivos gerencia ${mesNum}/${anioNum}:`, mapa);
    return mapa;
  } catch (err) {
    console.error("❌ Error cargando objetivos gerencia:", err.message);
    return {};   // nunca rompe el dashboard si falla
  }
};

// ======================================================
//  TOP 20 CLIENTES
// ======================================================
const obtenerTop20Clientes = async (anioNum, mesNum) => {
  const fechaInicioStr = `${anioNum}-${String(mesNum).padStart(2,'0')}-01 00:00:00`;
  let mesFin = mesNum + 1, anioFin = anioNum;
  if (mesFin === 13) { mesFin = 1; anioFin++; }
  const fechaFinStr = `${anioFin}-${String(mesFin).padStart(2,"0")}-01 00:00:00`;

  const sql = `
    SELECT f.customer_code AS codigo_cliente, c.nombre_cliente AS cliente,
           f.seller_code AS preventa, f.route_code AS ruta,
           SUM(dd.cantidad) AS unidades_consumidas, SUM(dd.total) AS monto_consumido
    FROM facturas f
    JOIN detalle_documento dd ON dd.documento_code = f.code
    LEFT JOIN clientes c ON c.codigo_cliente = f.customer_code
    WHERE f.type = 1 AND f.status = 2
      AND f.fecha_entrega >= '${fechaInicioStr}' AND f.fecha_entrega < '${fechaFinStr}'
      AND (f.seller_code ILIKE 'PV%' OR f.route_code ILIKE 'PV%'
        OR f.route_code ILIKE 'TELEVENTA%' OR f.route_code ILIKE 'RURAL%')
    GROUP BY f.customer_code, c.nombre_cliente, f.seller_code, f.route_code
    ORDER BY monto_consumido DESC LIMIT 20;
  `;
  return await sequelize.query(sql, { type: Sequelize.QueryTypes.SELECT });
};

const obtenerDetalleRuta = async (req, res) => {
  try {
    const { vendedor, anio, mes } = req.query;
    if (!vendedor || !anio || !mes)
      return res.status(400).json({ error: "Debe enviar vendedor, anio y mes" });
    const detalle = await obtenerDetallePorVendedor(vendedor, parseInt(anio), parseInt(mes));
    res.status(200).json(detalle);
  } catch (error) {
    console.error("❌ Error en obtenerDetalleRuta:", error);
    res.status(500).json({ message: "Error interno" });
  }
};

const obtenerDetallePorVendedor = async (codigoVendedor, anioNum, mesNum) => {
  const { fInicio, fFin } = getRangoFechas(anioNum, mesNum);
  const sql = `
    SELECT dd.codigo_producto, dd.descripcion,
           SUM(dd.cantidad) AS unidades, SUM(dd.total) AS dolares
    FROM ordenes o JOIN detalle_documento dd ON dd.documento_code = o.code
    WHERE o.seller_code = '${codigoVendedor}' AND dd.codigo_categoria = '7'
      AND o.status IN ('2','4','5')
      AND o.fecha_creacion >= '${fInicio}' AND o.fecha_creacion < '${fFin}'
    GROUP BY dd.codigo_producto, dd.descripcion ORDER BY unidades DESC;
  `;
  return await sequelize.query(sql, { type: Sequelize.QueryTypes.SELECT });
};

const obtenerRankingRutasDescartable = async (anioNum, mesNum, metasPorPreventa, diasTranscurridos, diasLaborablesMes) => {
  const hoy        = new Date();
  const esMesActual = hoy.getFullYear() === anioNum && hoy.getMonth() + 1 === mesNum;

  const inicio  = `${anioNum}-${String(mesNum).padStart(2,"0")}-01 00:00:00`;
  const mesSig  = mesNum === 12 ? 1 : mesNum + 1;
  const anioFin = mesNum === 12 ? anioNum + 1 : anioNum;
  const fin     = `${anioFin}-${String(mesSig).padStart(2,"0")}-01 00:00:00`;

  const fechaAnt   = new Date(anioNum, mesNum - 2, 1);
  const anioPrev   = fechaAnt.getFullYear();
  const mesPrev    = fechaAnt.getMonth() + 1;
  const inicioPrev = `${anioPrev}-${String(mesPrev).padStart(2,"0")}-01 00:00:00`;
  const finPrev    = `${anioNum}-${String(mesNum).padStart(2,"0")}-01 00:00:00`;

  const sqlActual = `
    SELECT x.usuario, SUM(x.unidades) AS unidades, SUM(x.dolares) AS dolares,
           SUM(x.cant_ordenes) AS cant_ordenes, SUM(x.cant_facturas) AS cant_facturas
    FROM (
      SELECT o.seller_code AS usuario, SUM(dd.cantidad) AS unidades, SUM(dd.total) AS dolares,
             COUNT(DISTINCT o.code) AS cant_ordenes, 0::int AS cant_facturas
      FROM ordenes o JOIN detalle_documento dd ON dd.documento_code = o.code
      WHERE dd.codigo_categoria='7' AND o.status IN(2,4,5) AND o.seller_code ILIKE 'R%'
        AND o.fecha_creacion>='${inicio}' AND o.fecha_creacion<'${fin}'
      GROUP BY o.seller_code
      UNION ALL
      SELECT f.seller_code AS usuario, SUM(dd.cantidad) AS unidades, SUM(dd.total) AS dolares,
             0::int AS cant_ordenes, COUNT(DISTINCT f.code) AS cant_facturas
      FROM facturas f JOIN detalle_documento dd ON dd.documento_code = f.code
      WHERE dd.codigo_categoria='7' AND f.status IN(2,4,5) AND f.seller_code ILIKE 'R%'
        AND f.fecha_creacion>='${inicio}' AND f.fecha_creacion<'${fin}'
      GROUP BY f.seller_code
    ) x GROUP BY x.usuario ORDER BY dolares DESC;
  `;
  const sqlPrev = `
    SELECT x.usuario, SUM(x.dolares) AS dolares FROM (
      SELECT o.seller_code AS usuario, SUM(dd.total) AS dolares
      FROM ordenes o JOIN detalle_documento dd ON dd.documento_code = o.code
      WHERE dd.codigo_categoria='7' AND o.status IN(2,4,5) AND o.seller_code ILIKE 'R%'
        AND o.fecha_creacion>='${inicioPrev}' AND o.fecha_creacion<'${finPrev}'
      GROUP BY o.seller_code
      UNION ALL
      SELECT f.seller_code AS usuario, SUM(dd.total) AS dolares
      FROM facturas f JOIN detalle_documento dd ON dd.documento_code = f.code
      WHERE dd.codigo_categoria='7' AND f.status IN(2,4,5) AND f.seller_code ILIKE 'R%'
        AND f.fecha_creacion>='${inicioPrev}' AND f.fecha_creacion<'${finPrev}'
      GROUP BY f.seller_code
    ) x GROUP BY x.usuario;
  `;

  const actual   = await sequelize.query(sqlActual, { type: Sequelize.QueryTypes.SELECT });
  const anterior = await sequelize.query(sqlPrev,   { type: Sequelize.QueryTypes.SELECT });
  const mapPrev  = {};
  anterior.forEach(r => { mapPrev[r.usuario] = Number(r.dolares) || 0; });

  return actual.map(r => {
    const montoActual   = Number(r.dolares) || 0;
    const montoAnterior = mapPrev[r.usuario] || 0;
    const proyeccion    = esMesActual && diasTranscurridos > 0
      ? (montoActual / diasTranscurridos) * diasLaborablesMes
      : montoActual;
    const variacionAbs  = proyeccion - montoAnterior;
    const variacionPorc = montoAnterior > 0 ? (variacionAbs / montoAnterior) * 100 : null;
    return {
      usuario: r.usuario, unidades: Number(r.unidades), dolares: montoActual,
      meta: metasPorPreventa[r.usuario] || 0,
      proyeccion: Number(proyeccion.toFixed(2)),
      vsMesAnterior: {
        monto_anterior: Number(montoAnterior.toFixed(2)),
        variacion_abs:  Number(variacionAbs.toFixed(2)),
        variacion_porc: variacionPorc !== null ? Number(variacionPorc.toFixed(2)) : null,
      },
    };
  });
};

const obtenerVentaPorProducto = async (anioNum, mesNum) => {
  const inicio  = `${anioNum}-${String(mesNum).padStart(2,'0')}-01 00:00:00`;
  const finMes  = mesNum === 12 ? 1 : mesNum + 1;
  const finAnio = mesNum === 12 ? anioNum + 1 : anioNum;
  const fin     = `${finAnio}-${String(finMes).padStart(2,'0')}-01 00:00:00`;
  const sql = `
    SELECT dd.descripcion AS producto, SUM(dd.cantidad) AS unidades, SUM(dd.total) AS dolares
    FROM ordenes o JOIN detalle_documento dd ON dd.documento_code = o.code
    WHERE dd.codigo_categoria='7' AND o.status IN('2','4','5')
      AND (o.seller_code ILIKE 'PV%' OR o.seller_code ILIKE 'R%' OR o.seller_code ILIKE 'TELEVENTA%')
      AND o.fecha_entrega>='${inicio}' AND o.fecha_entrega<'${fin}'
    GROUP BY dd.descripcion ORDER BY unidades DESC;
  `;
  return await sequelize.query(sql, { type: Sequelize.QueryTypes.SELECT });
};

const obtenerVentasDescartablePorCanal = async (fechaInicio, fechaFin) => {
  const sql = `
    SELECT o.seller_code, SUM(dd.cantidad) AS unidades, SUM(dd.total) AS dolares, 'FACTURA' AS origen
    FROM facturas o JOIN detalle_documento dd ON dd.documento_code = o.code
    WHERE (o.seller_code ILIKE 'A%' OR o.seller_code ILIKE 'V%' OR o.seller_code ILIKE 'M%')
      AND dd.codigo_categoria='7' AND o.status IN('2','4','5')
      AND o.fecha_entrega>='${fechaInicio}' AND o.fecha_entrega<'${fechaFin}'
    GROUP BY o.seller_code
    UNION ALL
    SELECT o.seller_code, SUM(dd.cantidad) AS unidades, SUM(dd.total) AS dolares, 'ORDEN' AS origen
    FROM ordenes o JOIN detalle_documento dd ON dd.documento_code = o.code
    WHERE o.seller_code ILIKE 'M%' AND dd.codigo_categoria='7' AND o.status IN('2','4','5')
      AND o.fecha_entrega>='${fechaInicio}' AND o.fecha_entrega<'${fechaFin}'
    GROUP BY o.seller_code ORDER BY seller_code;
  `;
  return await sequelize.query(sql, { type: Sequelize.QueryTypes.SELECT });
};

const MetasHistoricasDescartablePorCanal = async () => {
  const sql = `
    SELECT sub.seller_code, MAX(sub.total_mes) AS meta_historica, mes_max_consumo.mes AS mes_mayor_consumo
    FROM (
      SELECT o.seller_code, DATE_TRUNC('month', o.fecha_entrega) AS mes, SUM(dd.total) AS total_mes
      FROM facturas o JOIN detalle_documento dd ON dd.documento_code = o.code
      WHERE dd.codigo_categoria='7' AND o.status IN(2,4,5)
        AND o.seller_code IN('A1','A2','A3','A4.1','A5','A6','V1','V2','V3','V4','V5','V6')
      GROUP BY o.seller_code, DATE_TRUNC('month', o.fecha_entrega)
      UNION ALL
      SELECT o.seller_code, DATE_TRUNC('month', o.fecha_entrega) AS mes, SUM(dd.total) AS total_mes
      FROM ordenes o JOIN detalle_documento dd ON dd.documento_code = o.code
      WHERE dd.codigo_categoria='7' AND o.status IN(2,4,5) AND o.seller_code='M6'
      GROUP BY o.seller_code, DATE_TRUNC('month', o.fecha_entrega)
    ) AS sub
    LEFT JOIN (
      SELECT seller_code, mes, total_mes,
             RANK() OVER (PARTITION BY seller_code ORDER BY total_mes DESC) AS rank
      FROM (
        SELECT o.seller_code, DATE_TRUNC('month', o.fecha_entrega) AS mes, SUM(dd.total) AS total_mes
        FROM facturas o JOIN detalle_documento dd ON dd.documento_code = o.code
        WHERE dd.codigo_categoria='7' AND o.status IN(2,4,5)
          AND o.seller_code IN('A1','A2','A3','A4.1','A5','A6','V1','V2','V3','V4','V5','V6')
        GROUP BY o.seller_code, DATE_TRUNC('month', o.fecha_entrega)
        UNION ALL
        SELECT o.seller_code, DATE_TRUNC('month', o.fecha_entrega) AS mes, SUM(dd.total) AS total_mes
        FROM ordenes o JOIN detalle_documento dd ON dd.documento_code = o.code
        WHERE dd.codigo_categoria='7' AND o.status IN(2,4,5) AND o.seller_code='M6'
        GROUP BY o.seller_code, DATE_TRUNC('month', o.fecha_entrega)
      ) AS sub2
    ) AS mes_max_consumo
    ON sub.seller_code = mes_max_consumo.seller_code AND mes_max_consumo.rank = 1
    GROUP BY sub.seller_code, mes_max_consumo.mes;
  `;
  const filas = await sequelize.query(sql, { type: Sequelize.QueryTypes.SELECT });
  const mapa  = {};
  filas.forEach(f => { mapa[f.seller_code] = { meta_historica: Number(f.meta_historica), mes_mayor_consumo: f.mes_mayor_consumo }; });
  return mapa;
};

const obtenerVentasDescartablePorCanalMesAnterior = async (fechaInicio, fechaFin) => {
  const sql = `
    SELECT o.seller_code, SUM(dd.cantidad) AS unidades, SUM(dd.total) AS dolares, 'FACTURA' AS origen
    FROM facturas o JOIN detalle_documento dd ON dd.documento_code = o.code
    WHERE (o.seller_code ILIKE 'A%' OR o.seller_code ILIKE 'V%' OR o.seller_code ILIKE 'M%')
      AND dd.codigo_categoria='7' AND o.status IN('2','4','5')
      AND o.fecha_entrega>='${fechaInicio}' AND o.fecha_entrega<'${fechaFin}'
    GROUP BY o.seller_code
    UNION ALL
    SELECT o.seller_code, SUM(dd.cantidad) AS unidades, SUM(dd.total) AS dolares, 'ORDEN' AS origen
    FROM ordenes o JOIN detalle_documento dd ON dd.documento_code = o.code
    WHERE o.seller_code='M6' AND dd.codigo_categoria='7' AND o.status IN('2','4','5')
      AND o.fecha_entrega>='${fechaInicio}' AND o.fecha_entrega<'${fechaFin}'
    GROUP BY o.seller_code
  `;
  return await sequelize.query(sql, { type: Sequelize.QueryTypes.SELECT });
};

const calcularVentasDescartableConComparativa = async (anioNum, mesNum) => {
  const fechaInicioMesActual = `${anioNum}-${String(mesNum).padStart(2,"0")}-01 00:00:00`;
  let mesSiguiente = mesNum + 1, anioFin = anioNum;
  if (mesSiguiente === 13) { mesSiguiente = 1; anioFin++; }
  const fechaFinMesActual = `${anioFin}-${String(mesSiguiente).padStart(2,"0")}-01 00:00:00`;
  const ventasActuales = await obtenerVentasDescartablePorCanal(fechaInicioMesActual, fechaFinMesActual);

  let mesAnterior = mesNum - 1, anioAnterior = anioNum;
  if (mesAnterior === 0) { mesAnterior = 12; anioAnterior--; }
  const fechaInicioMesAnterior = `${anioAnterior}-${String(mesAnterior).padStart(2,"0")}-01 00:00:00`;
  const fechaFinMesAnterior    = `${anioNum}-${String(mesNum).padStart(2,"0")}-01 00:00:00`;
  const ventasMesAnterior      = await obtenerVentasDescartablePorCanalMesAnterior(fechaInicioMesAnterior, fechaFinMesAnterior);

  const festivos2          = [];
  const diasTranscurridos  = getDiasHabilesTranscurridos(anioNum, mesNum, festivos2);
  const diasLaborablesMes  = getDiasLaborablesMes(anioNum, mesNum, festivos2);
  const metasPorPreventa   = await MetasHistoricasDescartablePorCanal();
  const metasProyectadas   = {};

  ventasActuales.forEach(venta => {
    const preventa      = venta.seller_code;
    const metaHistorica = metasPorPreventa[preventa] || 0;
    const montoActual   = Number(venta.dolares) || 0;
    const proyeccion    = diasTranscurridos > 0 ? (montoActual / diasTranscurridos) * diasLaborablesMes : 0;
    const ventaAnterior = ventasMesAnterior.find(v => v.seller_code === preventa);
    const montoAnterior = ventaAnterior ? Number(ventaAnterior.dolares) || 0 : 0;
    const variacionAbs  = montoActual - montoAnterior;
    const variacionPorc = montoAnterior > 0 ? (variacionAbs / montoAnterior) * 100 : null;
    metasProyectadas[preventa] = {
      ...venta, meta: metaHistorica,
      proyeccion: Number(proyeccion.toFixed(2)),
      vsMesAnterior: {
        monto_anterior: Number(montoAnterior.toFixed(2)),
        variacion_abs:  Number(variacionAbs.toFixed(2)),
        variacion_porc: variacionPorc !== null ? Number(variacionPorc.toFixed(2)) : null,
      },
    };
  });
  return metasProyectadas;
};

const obtenerPrecioPromedioPorPreventa = async (anioNum, mesNum) => {
  const inicio  = `${anioNum}-${String(mesNum).padStart(2,"0")}-01 00:00:00`;
  const mesSig  = mesNum === 12 ? 1 : mesNum + 1;
  const anioSig = mesNum === 12 ? anioNum + 1 : anioNum;
  const fin     = `${anioSig}-${String(mesSig).padStart(2,"0")}-01 00:00:00`;
  const sql = `
    SELECT o.seller_code AS preventa, dd.codigo_producto, dd.descripcion,
           SUM(dd.cantidad) AS unidades, SUM(dd.total) AS monto,
           CASE WHEN SUM(dd.cantidad)>0 THEN SUM(dd.total)/SUM(dd.cantidad) ELSE 0 END AS precio_promedio
    FROM ordenes o JOIN detalle_documento dd ON dd.documento_code = o.code
    WHERE o.status IN('2','4','5') AND dd.codigo_categoria='7'
      AND (o.seller_code ILIKE 'PV%' OR o.seller_code ILIKE 'PREVENTA%'
        OR o.seller_code ILIKE 'TELEVENTA%' OR o.seller_code ILIKE 'R%')
      AND o.fecha_entrega>='${inicio}' AND o.fecha_entrega<'${fin}'
    GROUP BY o.seller_code, dd.codigo_producto, dd.descripcion ORDER BY o.seller_code;
  `;
  return await sequelize.query(sql, { type: Sequelize.QueryTypes.SELECT });
};

const obtenerPrecioPromedioMesAnterior = async (anioNum, mesNum) => {
  const fecha    = new Date(anioNum, mesNum - 2, 1);
  const anioPrev = fecha.getFullYear();
  const mesPrev  = fecha.getMonth() + 1;
  return await obtenerPrecioPromedioPorPreventa(anioPrev, mesPrev);
};

function clasificarPresentacion(descripcion = "") {
  const text = descripcion.toUpperCase();
  if (text.includes("300ML"))                        return "300ML";
  if (text.includes("500ML"))                        return "500ML";
  if (text.includes("625ML"))                        return "625ML";
  if (text.includes("1.5") || text.includes("1.5L")) return "1.5L";
  if (text.includes("1L SPORT"))                     return "1L SPORT";
  if (text.includes("1L"))                           return "1L";
  if (text.includes("GALON") || text.includes("GALÓN")) return "GALON";
  if (text.includes("6L"))                           return "6L";
  return "OTROS";
}

function procesarTablaPrecioPromedio(actual, anterior, productosVendidos) {
  const mapAnterior = {};
  anterior.forEach(row => {
    const categoria = clasificarPresentacion(row.descripcion);
    mapAnterior[`${row.preventa}_${categoria}`] = Number(row.precio_promedio) || 0;
  });
  const respuesta = {};
  actual.forEach(row => {
    const categoria = clasificarPresentacion(row.descripcion);
    if (categoria === "OTROS") return;
    if (!productosVendidos[row.preventa]?.has(categoria)) return;
    const precioActual   = Number(row.precio_promedio) || 0;
    const precioAnterior = mapAnterior[`${row.preventa}_${categoria}`] || 0;
    const variacion      = precioAnterior > 0 ? ((precioActual - precioAnterior) / precioAnterior) * 100 : null;
    if (!respuesta[row.preventa]) respuesta[row.preventa] = {};
    respuesta[row.preventa][categoria] = {
      precio:     Number(precioActual.toFixed(2)),
      vsAnterior: variacion !== null ? Number(variacion.toFixed(2)) : null,
    };
  });
  return respuesta;
}

async function obtenerProductosVendidosMes(anio, mes) {
  const inicio  = `${anio}-${String(mes).padStart(2,"0")}-01 00:00:00`;
  const mesSig  = mes === 12 ? 1 : mes + 1;
  const anioSig = mes === 12 ? anio + 1 : anio;
  const fin     = `${anioSig}-${String(mesSig).padStart(2,"0")}-01 00:00:00`;
  const sql = `
    SELECT o.seller_code AS preventa, dd.descripcion
    FROM ordenes o JOIN detalle_documento dd ON dd.documento_code = o.code
    WHERE dd.codigo_categoria='7' AND o.status IN('2','4','5')
      AND o.fecha_creacion>='${inicio}' AND o.fecha_creacion<'${fin}'
  `;
  const rows = await sequelize.query(sql, { type: Sequelize.QueryTypes.SELECT });
  const mapa = {};
  rows.forEach(item => {
    const categoria = clasificarPresentacion(item.descripcion);
    if (categoria === "OTROS") return;
    if (!mapa[item.preventa]) mapa[item.preventa] = new Set();
    mapa[item.preventa].add(categoria);
  });
  return mapa;
}

const calcularKPIsMes = async (anioNum, mesNum) => {
  const fechaInicioStr = `${anioNum}-${String(mesNum).padStart(2,'0')}-01 00:00:00`;
  let mesFin = mesNum + 1, anioFin = anioNum;
  if (mesFin === 13) { mesFin = 1; anioFin++; }
  const fechaFinStr = `${anioFin}-${String(mesFin).padStart(2,"0")}-01 00:00:00`;

  const resultadosSQL = await Orden.findAll({
    attributes: [
      [sequelize.col('Orden.seller_code'), 'preventa'],
      [sequelize.fn('SUM', sequelize.col('DetalleDocumentos.cantidad')), 'sum_quantity'],
      [sequelize.fn('SUM', sequelize.col('DetalleDocumentos.total')),    'sum_total'],
    ],
    where: {
      type: 2, status: 5,
      [Op.or]: [
        { seller_code: { [Op.iLike]: 'PV%' } },
        { seller_code: { [Op.iLike]: 'PREVENTA%' } },
        { seller_code: { [Op.iLike]: 'TELEVENTA%' } },
      ],
      fecha_entrega: {
        [Op.gte]: sequelize.literal(`'${fechaInicioStr}'`),
        [Op.lt]:  sequelize.literal(`'${fechaFinStr}'`),
      },
    },
    include: [{ model: DetalleDocumento, required: true, attributes: [] }],
    group: ['Orden.seller_code'],
    order: [[
      sequelize.literal(`
        CASE WHEN "Orden"."seller_code" ILIKE 'PREVENTA VIP%' THEN 1
             WHEN "Orden"."seller_code" ILIKE 'PV%' THEN 2
             WHEN "Orden"."seller_code" ILIKE 'TELEVENTA%' THEN 3
             ELSE 4 END
      `), 'ASC',
    ], ['seller_code', 'ASC']],
    raw: true,
  });

  const metasPorPreventa  = await obtenerMetasHistoricasPreventas();
  const metaGlobal        = await obtenerMetaHistoricaGlobal();
  const hoy               = new Date();
  const esMesCerrado      = anioNum < hoy.getFullYear() || (anioNum === hoy.getFullYear() && mesNum < hoy.getMonth() + 1);
  const diasTranscurridos = getDiasHabilesTranscurridos(anioNum, mesNum, festivos);
  const diasLaborablesMes = getDiasLaborablesMes(anioNum, mesNum, festivos);

  let rankingPreventasSQL = resultadosSQL.map(r => {
    const preventa      = r.preventa;
    const unidades      = Number(r.sum_quantity);
    const monto         = Number(r.sum_total);
    const metaHistorica = metasPorPreventa[preventa] || 0;
    const proyeccion    = esMesCerrado ? monto : (monto / diasTranscurridos) * diasLaborablesMes;
    return { preventa, unidades, monto, meta: metaHistorica, proyeccion: Number(proyeccion.toFixed(2)) };
  });
  rankingPreventasSQL.sort((a, b) => b.monto - a.monto);

  const unidadesTotalesSQL = rankingPreventasSQL.reduce((a, b) => a + b.unidades, 0);
  const montoTotalSQL      = rankingPreventasSQL.reduce((a, b) => a + b.monto,    0);

  const topActual = await obtenerTop20Clientes(anioNum, mesNum);
  let topAnterior = [];
  try {
    const fechaAnterior = new Date(anioNum, mesNum - 1, 1);
    fechaAnterior.setMonth(fechaAnterior.getMonth() - 1);
    topAnterior = await obtenerTop20Clientes(fechaAnterior.getFullYear(), fechaAnterior.getMonth() + 1);
  } catch { topAnterior = []; }

  const top20Final = topActual.map(cli => {
    const anterior      = topAnterior.find(c => c.codigo_cliente === cli.codigo_cliente) || { monto_consumido: 0, unidades_consumidas: 0 };
    const variacionAbs  = cli.monto_consumido - anterior.monto_consumido;
    const variacionPorc = anterior.monto_consumido > 0 ? (variacionAbs / anterior.monto_consumido) * 100 : null;
    return {
      codigo: cli.codigo_cliente, cliente: cli.cliente, preventa: cli.preventa,
      montoActual: Number(cli.monto_consumido), montoAnterior: Number(anterior.monto_consumido),
      variacionMontoAbs: variacionAbs,
      variacionMontoPorc: variacionPorc ? Number(variacionPorc.toFixed(2)) : null,
      unidadesActual: Number(cli.unidades_consumidas), unidadesAnterior: Number(anterior.unidades_consumidas),
    };
  });

  const rankingRutasR    = await obtenerRankingRutasDescartable(anioNum, mesNum, metasPorPreventa, diasTranscurridos, diasLaborablesMes);
  const ventaPorProducto = await obtenerVentaPorProducto(anioNum, mesNum);

  const metaMensualUnidades        = META_MENSUAL_UNIDADES_PREVENTA;
  const metaMensualDolares         = META_MENSUAL_USD_PREVENTA;
  const cumplimientoUnidadesMensual = metaMensualUnidades > 0 ? (unidadesTotalesSQL / metaMensualUnidades) * 100 : 0;
  const cumplimientoUSDMensual      = metaMensualDolares  > 0 ? (montoTotalSQL      / metaMensualDolares)  * 100 : 0;

  const ventasDescartablePorCanal = await obtenerVentasDescartablePorCanal(fechaInicioStr, fechaFinStr);

  return {
    kpisGenerales: {
      unidadesTotales: unidadesTotalesSQL, montoTotal: montoTotalSQL,
      metaMensualUnidades, metaMensualDolares,
      cumplimientoUnidadesMensual, cumplimientoUSDMensual,
    },
    rankingPreventas: rankingPreventasSQL,
    rankingRutasR,
    topClientes: top20Final,
    ventaPorProducto,
    ventasDescartablePorCanal,
    clientesDetalle: {},
    resumenGeneral: { ordenesGeneradas: rankingPreventasSQL.length, ordenesEntregadas: rankingPreventasSQL.length, clientesEnRuta: 0, clientesSinConsumo: 0 },
    _raw: { unidadesTotales: unidadesTotalesSQL, montoTotal: montoTotalSQL },
  };
};

const agruparDescartablePorCanalResumen = (ventasPorPreventa = {}) => {
  const resumen = {
    DOMICILIO: { canal:"DOMICILIO", unidades:0, monto:0, mesAnterior:0, variacionAbs:0, variacionPorc:0 },
    MAYORISTA: { canal:"MAYORISTA", unidades:0, monto:0, mesAnterior:0, variacionAbs:0, variacionPorc:0 },
    VIP:       { canal:"VIP",       unidades:0, monto:0, mesAnterior:0, variacionAbs:0, variacionPorc:0 },
  };
  Object.values(ventasPorPreventa).forEach(v => {
    const seller = v.seller_code || "";
    let canal = null;
    if      (seller.startsWith("A")) canal = "DOMICILIO";
    else if (seller.startsWith("M")) canal = "MAYORISTA";
    else if (seller.startsWith("V")) canal = "VIP";
    if (!canal) return;
    resumen[canal].unidades    += Number(v.unidades || 0);
    resumen[canal].monto       += Number(v.dolares  || 0);
    resumen[canal].mesAnterior += Number(v.vsMesAnterior?.monto_anterior || 0);
  });
  Object.keys(resumen).forEach(c => {
    const r = resumen[c];
    r.variacionAbs  = r.monto - r.mesAnterior;
    r.variacionPorc = r.mesAnterior > 0 ? (r.variacionAbs / r.mesAnterior) * 100 : null;
  });
  return resumen;
};

const resumirRankingParaCard = (ranking = [], canal) => {
  const resumen = { canal, unidades:0, monto:0, mesAnterior:0, variacionAbs:0, variacionPorc:0 };
  ranking.forEach(r => {
    resumen.unidades   += Number(r.unidades || 0);
    resumen.monto      += Number(r.proyeccion || r.monto || 0);
    if (r.vsMesAnterior) resumen.mesAnterior += Number(r.vsMesAnterior.monto_anterior || 0);
  });
  resumen.variacionAbs  = resumen.monto - resumen.mesAnterior;
  resumen.variacionPorc = resumen.mesAnterior > 0 ? (resumen.variacionAbs / resumen.mesAnterior) * 100 : null;
  return resumen;
};


// ===================================
//  ✅ Endpoint Principal — Dashboard
// ===================================
const obtenerDatosDashboard = async (req, res) => {
  try {
    const { anio, mes } = req.query;
    if (!anio || !mes)
      return res.status(400).json({ error: "Debe enviar ?anio=YYYY&mes=MM" });

    const anioNum = parseInt(anio, 10);
    const mesNum  = parseInt(mes,  10);

    const resumenActual = await calcularKPIsMes(anioNum, mesNum);
    const top20Clientes = await obtenerTop20Clientes(anioNum, mesNum);

    // ══════════════════════════════════════════════════════
    // ✅ CARGAR OBJETIVOS DE GERENCIA (tabla meta_preventas)
    //    Filtra exactamente por mes y año recibidos
    // ══════════════════════════════════════════════════════
    const objetivosGerencia = await obtenerObjetivosGerencia(anioNum, mesNum);

    let comparativaMesAnterior = null;
    let resumenPrev            = null;

    try {
      const fecha    = new Date(anioNum, mesNum - 1, 1);
      fecha.setMonth(fecha.getMonth() - 1);
      const anioPrev = fecha.getFullYear();
      const mesPrev  = fecha.getMonth() + 1;
      resumenPrev    = await calcularKPIsMes(anioPrev, mesPrev);

      const uAct = resumenActual._raw.unidadesTotales;
      const uPrev = resumenPrev._raw.unidadesTotales;
      const mAct  = resumenActual._raw.montoTotal;
      const mPrev = resumenPrev._raw.montoTotal;

      comparativaMesAnterior = {
        anio: anioPrev, mes: mesPrev,
        unidades: { anterior: uPrev, actual: uAct, variacionAbs: uAct - uPrev, variacionPorcentaje: uPrev > 0 ? ((uAct - uPrev) / uPrev) * 100 : null },
        monto:    { anterior: mPrev, actual: mAct, variacionAbs: mAct - mPrev, variacionPorcentaje: mPrev > 0 ? ((mAct - mPrev) / mPrev) * 100 : null },
      };
    } catch (err) { console.error("❌ Error comparativa general:", err); }

    // ══════════════════════════════════════════════════════
    // vsMesAnterior + inyectar objetivo_gerencia por ruta
    // ══════════════════════════════════════════════════════
    try {
      const rankingActual  = resumenActual.rankingPreventas || [];
      const rankingPrevMap = {};
      (resumenPrev?.rankingPreventas || []).forEach(r => {
        rankingPrevMap[r.preventa] = { monto: Number(r.monto) || 0 };
      });

      resumenActual.rankingPreventas = rankingActual.map(r => {
        const proyeccionActual = Number(r.proyeccion) || 0;
        const montoAnterior    = rankingPrevMap[r.preventa]?.monto || 0;
        const variacionAbs     = proyeccionActual - montoAnterior;
        const variacionPorc    = montoAnterior > 0 ? (variacionAbs / montoAnterior) * 100 : null;

        // ✅ lookup objetivo gerencia: normalizar ruta a mayúsculas para coincidir
        const rutaKey     = (r.preventa || "").toUpperCase();
        const objGerencia = objetivosGerencia[rutaKey] || { meta_dolares: 0, meta_unidades: 0 };

        return {
          ...r,
          // ✅ campos nuevos inyectados aquí directamente en cada preventa
          objetivo_gerencia:          objGerencia.meta_dolares,
          objetivo_gerencia_unidades: objGerencia.meta_unidades,
          vsMesAnterior: {
            monto_anterior: montoAnterior,
            variacion_abs:  Number(variacionAbs.toFixed(2)),
            variacion_porc: variacionPorc !== null ? Number(variacionPorc.toFixed(2)) : null,
          },
        };
      });
    } catch (e) { console.error("❌ Error generando vsMesAnterior:", e); }

    const ventasDescartableConComparativa = await calcularVentasDescartableConComparativa(anioNum, mesNum);
    const resumenDescartablePorCanal      = agruparDescartablePorCanalResumen(ventasDescartableConComparativa);

    const resumenVentasPorCanal = {
      TIENDAS: resumirRankingParaCard(resumenActual.rankingPreventas, "TIENDAS"),
      RURAL:   resumirRankingParaCard(resumenActual.rankingRutasR,    "RURAL"),
      ...resumenDescartablePorCanal,
    };

    if (comparativaMesAnterior && resumenActual.kpisGenerales) {
      resumenActual.kpisGenerales = {
        ...resumenActual.kpisGenerales,
        periodoAntUnidadesPorc: comparativaMesAnterior.unidades?.variacionPorcentaje ?? null,
        periodoAntMontoPorc:    comparativaMesAnterior.monto?.variacionPorcentaje    ?? null,
      };
    }

    const { _raw, clientesDetalle, topClientes: _tc, ...publicResumen } = resumenActual;

    const productosVendidos   = await obtenerProductosVendidosMes(anioNum, mesNum);
    const preciosActual       = await obtenerPrecioPromedioPorPreventa(anioNum, mesNum);
    const preciosAnterior     = await obtenerPrecioPromedioMesAnterior(anioNum, mesNum);
    const precioPromedioTabla = procesarTablaPrecioPromedio(preciosActual, preciosAnterior, productosVendidos);

    return res.status(200).json({
      ...publicResumen,
      comparativaMesAnterior,
      topClientes:    resumenActual.topClientes,
      precioPromedioTabla,
      ventasDescartablePorCanal: ventasDescartableConComparativa,
      resumenVentasPorCanal,
    });

  } catch (error) {
    console.error("❌ ERROR EN DASHBOARD:", error);
    return res.status(500).json({ message: "Error al obtener los datos del dashboard" });
  }
};

module.exports = { obtenerDatosDashboard, obtenerDetalleRuta };