const Sequelize = require("sequelize");
const { sequelize } = require("../../models");

/**
 * =====================================================
 * CONFIGURACIÓN DE GRUPOS BOTELLONES
 * =====================================================
 */
const GRUPOS = {
  DOMICILIO: {
    campo: "o.route_code",
    filtro: "o.route_code ILIKE 'A%'"
  },
  EMPRESAS: {
    campo: "o.seller_code",
    filtro: "o.seller_code ILIKE 'E%'"
  },
  MAYORISTA: {
    campo: "o.seller_code",
    filtro: "o.seller_code ILIKE 'M%'"
  },
  QUITO: {
    campo: "o.seller_code",
    filtro: "o.seller_code = 'U1'"
  },
  RURAL: {
    campo: "o.seller_code",
    filtro: "o.seller_code ILIKE 'R%'"
  },
  TELEVENTA_VIP: {
    campo: "o.seller_code",
    filtro: "o.seller_code ILIKE '148399%'"
  },
  TIENDAS: {
    campo: "o.seller_code",
    filtro: "o.seller_code ILIKE 'T%' AND o.seller_code NOT ILIKE 'TV%'"
  },
  TIENDAS_VIP: {
    campo: "o.seller_code",
    filtro: "o.seller_code ILIKE 'TV%'"
  },

  VIP: {
    campo: "o.seller_code",
    filtro: "(o.seller_code ILIKE 'V%' OR o.seller_code IN ('10','18','27'))"
  }

};




const META_ANUAL_UNIDADES_BOTELLON = 3400000; // ejemplo
const META_ANUAL_USD_BOTELLON = 5500000; // ejemplo
/**
 * =====================================================
 * RANGO DE FECHAS
 * =====================================================
 */
function getRangoFechas(anio, mes) {
  console.log("Año recibido:", anio);
  console.log("Mes recibido:", mes);

  // Asegúrate de que no se repitan el mismo mes y año innecesariamente.
  if (!anio || !mes) {
    console.log("Error: Año o mes no válidos");
    return { inicio: null, fin: null };
  }

  const inicio = `${anio}-${String(mes).padStart(2, "0")}-01 00:00:00`;
  const mesSig = mes === 12 ? 1 : mes + 1;
  const anioSig = mes === 12 ? anio + 1 : anio;
  const fin = `${anioSig}-${String(mesSig).padStart(2, "0")}-01 00:00:00`;

  console.log("Fecha de inicio:", inicio);
  console.log("Fecha de fin:", fin);

  return { inicio, fin };
}






// const MetasHistoricasDescartablePorCanal = async () => {
//   const sql = `
//     SELECT sub.seller_code, 
//        MAX(sub.total_mes) AS meta_historica,
//        mes_max_consumo.mes AS mes_mayor_consumo
//       FROM (
//           SELECT 
//               o.seller_code,
//               DATE_TRUNC('month', o.fecha_entrega) AS mes,
//               SUM(dd.total) AS total_mes
//           FROM facturas o
//           JOIN detalle_documento dd 
//               ON dd.documento_code = o.code
//           WHERE dd.codigo_categoria = '7'
//               AND o.status IN (2,4,5)
//               AND o.seller_code IN ('A1', 'A2', 'A3', 'A4.1', 'A5', 'A6', 'V1', 'V2', 'V3', 'V4', 'V5', 'V6')
//           GROUP BY o.seller_code, DATE_TRUNC('month', o.fecha_entrega)

//           UNION ALL

//           SELECT 
//               o.seller_code,
//               DATE_TRUNC('month', o.fecha_entrega) AS mes,
//               SUM(dd.total) AS total_mes
//           FROM ordenes o
//           JOIN detalle_documento dd 
//               ON dd.documento_code = o.code
//           WHERE dd.codigo_categoria = '7'
//               AND o.status IN (2,4,5)
//               AND o.seller_code = 'M6'  -- Solo M6 de las órdenes
//           GROUP BY o.seller_code, DATE_TRUNC('month', o.fecha_entrega)
//       ) AS sub
//       -- Obtener el mes con mayor total
//       LEFT JOIN (
//           SELECT seller_code, 
//                 mes,
//                 total_mes,
//                 RANK() OVER (PARTITION BY seller_code ORDER BY total_mes DESC) AS rank
//           FROM (
//               SELECT 
//                   o.seller_code,
//                   DATE_TRUNC('month', o.fecha_entrega) AS mes,
//                   SUM(dd.total) AS total_mes
//               FROM facturas o
//               JOIN detalle_documento dd 
//                   ON dd.documento_code = o.code
//               WHERE dd.codigo_categoria = '7'
//                   AND o.status IN (2,4,5)
//                   AND o.seller_code IN ('A1', 'A2', 'A3', 'A4.1', 'A5', 'A6', 'V1', 'V2', 'V3', 'V4', 'V5', 'V6')
//               GROUP BY o.seller_code, DATE_TRUNC('month', o.fecha_entrega)

//               UNION ALL

//               SELECT 
//                   o.seller_code,
//                   DATE_TRUNC('month', o.fecha_entrega) AS mes,
//                   SUM(dd.total) AS total_mes
//               FROM ordenes o
//               JOIN detalle_documento dd 
//                   ON dd.documento_code = o.code
//               WHERE dd.codigo_categoria = '7'
//                   AND o.status IN (2,4,5)
//                   AND o.seller_code = 'M6'  -- Solo M6 de las órdenes
//               GROUP BY o.seller_code, DATE_TRUNC('month', o.fecha_entrega)
//           ) AS sub2
//       ) AS mes_max_consumo
//       ON sub.seller_code = mes_max_consumo.seller_code 
//       AND mes_max_consumo.rank = 1
//       GROUP BY sub.seller_code, mes_max_consumo.mes;

//   `;

//   const filas = await sequelize.query(sql, { type: Sequelize.QueryTypes.SELECT });

//   const mapa = {};
//   filas.forEach(f => mapa[f.seller_code] = {
//     meta_historica: Number(f.meta_historica),
//     mes_mayor_consumo: f.mes_mayor_consumo
//   });

//   return mapa;
// };




// /**
//  * =====================================================
//  * CONSULTA POR GRUPO (ORDENES + FACTURAS)
//  * =====================================================
//  */
async function obtenerGrupoBotellon(nombreGrupo, config, anio, mes) {
  const { inicio, fin } = getRangoFechas(anio, mes);

  const sql = `
  SELECT
    codigo,
    SUM(unidades) AS unidades,
    SUM(dolares) AS dolares
  FROM (
    -- Consulta para "ordenes"
    SELECT
      ${config.campo} AS codigo,
      SUM(dd.cantidad) AS unidades,
      SUM(dd.total) AS dolares
    FROM ordenes o
    JOIN detalle_documento dd ON dd.documento_code = o.code
    WHERE
      o.status IN (2, 4, 5)
      AND dd.descripcion_categoria = 'BOTELLÓN'
      AND ${config.filtro}  -- Filtro específico para "ordenes"
      AND o.fecha_creacion >= :inicio
      AND o.fecha_creacion < :fin
    GROUP BY ${config.campo}

    UNION  

    -- Consulta para "facturas"
    SELECT
      ${config.campo.replaceAll("o.", "f.")} AS codigo,
      SUM(dd.cantidad) AS unidades,
      SUM(dd.total) AS dolares
    FROM facturas f
    JOIN detalle_documento dd ON dd.documento_code = f.code
    WHERE
      f.status = 2
      AND dd.descripcion_categoria = 'BOTELLÓN'
      AND ${config.filtro.replaceAll("o.", "f.")}  -- Filtro específico para "facturas"
      AND f.fecha_creacion >= :inicio
      AND f.fecha_creacion < :fin
    GROUP BY ${config.campo.replaceAll("o.", "f.")}
  ) t
  GROUP BY codigo
  ORDER BY dolares DESC;
`;
  const rows = await sequelize.query(sql, {
    replacements: { inicio, fin },
    type: Sequelize.QueryTypes.SELECT,
  });
  const totalUnidades = rows.reduce((a, b) => a + (Number(b.unidades) || 0), 0);
  const totalDolares = rows.reduce((a, b) => a + (Number(b.dolares) || 0), 0);

  // ==========================
  // 📈 METAS Y PROYECCIÓN
  // ==========================
  const metasPorPreventa = await MetasHistoricasDescartablePorCanal();

  return {
    total: {
      unidades: totalUnidades,
      dolares: Number(totalDolares.toFixed(2)),
    },
    detalle: rows.map((r) => ({
      codigo: r.codigo,
      unidades: Number(r.unidades),
      dolares: Number(r.dolares),
      meta: metasPorPreventa,
      proyeccion: Number(r.dolares),
      vsMesAnterior: Number(r.dolares),
    })),
  };
}

/**
 * =====================================================
 * KPIs BOTELLONES (CON TOPE MÁXIMO 100%)
 * =====================================================
 */
// function calcularKPIsBotellones( periodoAnterior = null) {
//   let unidadesTotales = 0;
//   let montoTotal = 0;

//   // ==========================
//   // ACUMULAR TOTALES POR GRUPO
//   // ==========================
//   // for (const [grupo, data] of Object.entries(botellones)) {
//   //   const u = Number(data.total.unidades) || 0;
//   //   const m = Number(data.total.dolares) || 0;

//   //   unidadesTotales += u;
//   //   montoTotal += m;
//   // }

//   // Si no hay datos (unidadesTotales y montoTotal son 0), asignamos KPIs en cero.
//   if (unidadesTotales === 0 && montoTotal === 0) {
//     return {
//       unidadesTotales: 0,
//       montoTotal: 0,
//       cumplimientoUnidadesMensual: 0,
//       cumplimientoUSDMensual: 0,
//       cumplimientoUnidadesAnual: 0,
//       cumplimientoUSDAnual: 0,
//       promedioUSDPorUnidad: 0,
//       periodoAntUnidadesPorc: 0,
//       periodoAntMontoPorc: 0
//     };
//   }

//   // ==========================
//   // METAS
//   // ==========================
//   const metaMensualUnidades = META_ANUAL_UNIDADES_BOTELLON / 12;
//   const metaMensualUSD = META_ANUAL_USD_BOTELLON / 12;

//   // ==========================
//   // FUNCIÓN SEGURA (TOPE 100%)
//   // ==========================
//   const calcPorcentaje = (valor, meta) => {
//     if (meta <= 0) return 0;
//     return Math.min((valor / meta) * 100, 100);
//   };

//   // ==========================
//   // VARIACIÓN DEL PERÍODO ANTERIOR
//   // ==========================
//   let periodoAntUnidadesPorc = 0;
//   let periodoAntMontoPorc = 0;

//   if (periodoAnterior) {
//     periodoAntUnidadesPorc = periodoAnterior.unidadesTotales
//       ? ((unidadesTotales - periodoAnterior.unidadesTotales) / periodoAnterior.unidadesTotales) * 100
//       : 0;

//     periodoAntMontoPorc = periodoAnterior.montoTotal
//       ? ((montoTotal - periodoAnterior.montoTotal) / periodoAnterior.montoTotal) * 100
//       : 0;
//   }

//   // ==========================
//   // RETORNO FINAL KPIs
//   // ==========================
//   return {
//     unidadesTotales,
//     montoTotal: Number(montoTotal.toFixed(2)),

//     metaMensualUnidades,
//     metaMensualUSD,
//     metaAnualUnidades: META_ANUAL_UNIDADES_BOTELLON,
//     metaAnualUSD: META_ANUAL_USD_BOTELLON,

//     cumplimientoUnidadesMensual: calcPorcentaje(unidadesTotales, metaMensualUnidades),
//     cumplimientoUSDMensual: calcPorcentaje(montoTotal, metaMensualUSD),
//     cumplimientoUnidadesAnual: calcPorcentaje(unidadesTotales, META_ANUAL_UNIDADES_BOTELLON),
//     cumplimientoUSDAnual: calcPorcentaje(montoTotal, META_ANUAL_USD_BOTELLON),

//     promedioUSDPorUnidad: unidadesTotales > 0 ? Number((montoTotal / unidadesTotales).toFixed(2)) : 0,

//     periodoAntUnidadesPorc,
//     periodoAntMontoPorc,
//   };
// }

/**
 * =====================================================
 * COMPARATIVA MES ANTERIOR
 * =====================================================
 */
// async function obtenerComparativaMesAnterior(anio, mes, kpisActuales) {
//   let mesPrev = mes - 1;
//   let anioPrev = anio;

//   if (mesPrev === 0) {
//     mesPrev = 12;
//     anioPrev--;
//   }

//   const resultadoPrev = {};

//   for (const [nombre, config] of Object.entries(GRUPOS)) {
//     resultadoPrev[nombre] = await obtenerGrupoBotellon(nombre, config, anioPrev, mesPrev);
//   }

//   const kpisPrev = calcularKPIsBotellones(resultadoPrev);

//   const variacionUnidadesAbs = kpisActuales.unidadesTotales - kpisPrev.unidadesTotales;
//   const variacionUnidadesPorc = kpisPrev.unidadesTotales > 0 ? (variacionUnidadesAbs / kpisPrev.unidadesTotales) * 100 : null;

//   const variacionMontoAbs = kpisActuales.montoTotal - kpisPrev.montoTotal;
//   const variacionMontoPorc = kpisPrev.montoTotal > 0 ? (variacionMontoAbs / kpisPrev.montoTotal) * 100 : null;

//   return {
//     anio: anioPrev,
//     mes: mesPrev,
//     unidades: {
//       anterior: kpisPrev.unidadesTotales,
//       actual: kpisActuales.unidadesTotales,
//       variacionAbs: Number(variacionUnidadesAbs.toFixed(0)),
//       variacionPorc: variacionUnidadesPorc !== null ? Number(variacionUnidadesPorc.toFixed(2)) : null,
//     },
//     monto: {
//       anterior: kpisPrev.montoTotal,
//       actual: kpisActuales.montoTotal,
//       variacionAbs: Number(variacionMontoAbs.toFixed(2)),
//       variacionPorc: variacionMontoPorc !== null ? Number(variacionMontoPorc.toFixed(2)) : null,
//     },
//   };
// }

/**
 * =====================================================
 * DASHBOARD BOTELLONES
 * =====================================================
 */



const calcularKPIsBotellones = async (anioNum, mesNum) => {

  // ===============================
  // FECHAS MES ACTUAL
  // ===============================
  const fechaInicioActual = `${anioNum}-${String(mesNum).padStart(2, "0")}-01 00:00:00`;

  let mesFin = mesNum + 1;
  let anioFin = anioNum;
  if (mesFin === 13) {
    mesFin = 1;
    anioFin++;
  }

  const fechaFinActual = `${anioFin}-${String(mesFin).padStart(2, "0")}-01 00:00:00`;

  // ===============================
  // FECHAS MES ANTERIOR
  // ===============================
  let mesAnterior = mesNum - 1;
  let anioAnterior = anioNum;

  if (mesAnterior === 0) {
    mesAnterior = 12;
    anioAnterior--;
  }

  const fechaInicioAnterior = `${anioAnterior}-${String(mesAnterior).padStart(2, "0")}-01 00:00:00`;
  const fechaFinAnterior = fechaInicioActual;

  // ===============================
  // QUERY MES ACTUAL
  // ===============================
  const [actualSQL] = await sequelize.query(`
    SELECT 
      SUM(dd.cantidad) AS unidades,
      SUM(dd.total) AS monto
    FROM facturas f
    JOIN detalle_documento dd ON f.code = dd.documento_code
    WHERE
      (f.seller_code ILIKE 'H%' OR f.seller_code IN ('10', 'h3'))
      AND f.status IN ('2','4','5')
      AND f.fecha_entrega >= '${fechaInicioActual}'
      AND f.fecha_entrega < '${fechaFinActual}';
  `);

  // ===============================
  // QUERY MES ANTERIOR
  // ===============================
  const [anteriorSQL] = await sequelize.query(`
    SELECT 
      SUM(dd.cantidad) AS unidades,
      SUM(dd.total) AS monto
    FROM facturas f
    JOIN detalle_documento dd ON f.code = dd.documento_code
    WHERE
      (f.seller_code ILIKE 'H%' OR f.seller_code IN ('10', 'h3'))
      AND f.status IN ('2','4','5')
      AND f.fecha_entrega >= '${fechaInicioAnterior}'
      AND f.fecha_entrega < '${fechaFinAnterior}';
  `);

  // ===============================
  // NORMALIZAR VALORES
  // ===============================
  const unidadesActual = Number(actualSQL[0]?.unidades || 0);
  const montoActual = Number(actualSQL[0]?.monto || 0);

  const unidadesAnterior = Number(anteriorSQL[0]?.unidades || 0);
  const montoAnterior = Number(anteriorSQL[0]?.monto || 0);

  // ===============================
  // VARIACIONES
  // ===============================
  const variacionUnidadesAbs = unidadesActual - unidadesAnterior;
  const variacionUnidadesPorc =
    unidadesAnterior > 0
      ? (variacionUnidadesAbs / unidadesAnterior) * 100
      : null;

  const variacionMontoAbs = montoActual - montoAnterior;
  const variacionMontoPorc =
    montoAnterior > 0
      ? (variacionMontoAbs / montoAnterior) * 100
      : null;

  // ===============================
  // METAS
  // ===============================
  const metaMensualUnidades = 200000;
  const metaMensualDolares = 200000;

  const cumplimientoUnidadesMensual =
    (unidadesActual / metaMensualUnidades) * 100;

  const cumplimientoUSDMensual =
    (montoActual / metaMensualDolares) * 100;

  // ===============================
  // RESPUESTA FINAL
  // ===============================
  return {
    kpisGenerales: {
      unidadesTotales: unidadesActual,
      montoTotal: montoActual,
      metaMensualUnidades,
      metaMensualDolares,
      cumplimientoUnidadesMensual,
      cumplimientoUSDMensual
    },
    comparativaMesAnterior: {
      unidades: {
        anterior: unidadesAnterior,
        actual: unidadesActual,
        variacionAbs: variacionUnidadesAbs,
        variacionPorc: variacionUnidadesPorc
      },
      monto: {
        anterior: montoAnterior,
        actual: montoActual,
        variacionAbs: variacionMontoAbs,
        variacionPorc: variacionMontoPorc
      }
    }
  };
};


async function obtenerDashboardBotellones(req, res) {
  try {
    const { anio, mes } = req.query;

    // ==========================
    // VALIDACIONES
    // ==========================
    if (!anio || !mes) {
      return res.status(400).json({
        error: "Debe enviar ?anio=YYYY&mes=MM",
      });
    }

    const anioNum = Number(anio);
    const mesNum = Number(mes);

    if (isNaN(anioNum) || isNaN(mesNum)) {
      return res.status(400).json({
        error: "Parámetros anio y mes deben ser numéricos",
      });
    }

    // // ==========================
    // // OBTENER DATOS POR GRUPO
    // // ==========================
    const botellones = {};

    for (const [nombre, config] of Object.entries(GRUPOS)) {
      botellones[nombre] = await obtenerGrupoBotellon(nombre, config, anioNum, mesNum);
    }
    // console.log("Botellones obtenidos:", botellones);
    // // ==========================
    // KPIs MES ACTUAL
    // ==========================
    const kpisBotellones = calcularKPIsBotellones(anioNum, mesNum);
    // ==========================
    // COMPARATIVA MES ANTERIOR
    // ==========================
    let comparativaMesAnterior = null;

    // try {
    //   comparativaMesAnterior = await obtenerComparativaMesAnterior(
    //     anioNum,
    //     mesNum,
    //     kpisBotellones
    //   );
    // } catch (err) {
    //   console.warn("⚠️ No se pudo calcular comparativa mes anterior");
    //   comparativaMesAnterior = null;
    // }

    // ==========================
    // RESPUESTA FINAL
    // ==========================
    return res.status(200).json({
      anio: anioNum,
      mes: mesNum,
      kpisBotellones,          // 🔥 KPIs con metas y cumplimiento
      comparativaMesAnterior,  // 🔄 Comparativa vs mes anterior
      botellones,              // 📦 Detalle por grupo
    });
  } catch (error) {
    console.error("❌ ERROR BOTELLONES:", error);
    return res.status(500).json({
      message: "Error al obtener dashboard de botellones",
    });
  }
}

module.exports = {
  obtenerDashboardBotellones,
};
