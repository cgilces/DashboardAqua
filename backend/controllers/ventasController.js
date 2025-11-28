// controllers/ventasController.js
const {
  Orden,
  DetalleDocumento,
  RutaPreventa,
  ClienteVenta,
  MetaPreventa,
} = require("../models");

const Sequelize = require("sequelize");
const Op = Sequelize.Op;
const { sequelize } = require('../models');


// ==========================================
// 🔥 SOLO RUTAS DE PREVENTA PERMITIDAS
// ==========================================
const RUTAS_PREVENTA_VALIDAS = [
  "PV1", "PV2", "PV3", "PV4", "PV5", "PV6", "PV7", "PV8", "PV9",
  "PV10", "PV11", "PV12", "PV13", "PV14",
  "PREVENTA VIP 1",
  "TELEVENTA 1", "TELEVENTA 4",
];

// ==========================================
// 🧮 METAS ANUALES GLOBALES (PLACEHOLDER)
//    te confirme las metas oficiales.
// ==========================================
const META_ANUAL_UNIDADES_PREVENTA = 700000;   //  ajustar valor real
const META_ANUAL_USD_PREVENTA = 2000000;  //  ajustar valor real

// ======================================================
// 🔥 TOP 20 CLIENTES CON MAYOR CONSUMO (FACTURAS PREVENTA)
// ======================================================
const obtenerTop20Clientes = async (anioNum, mesNum) => {
  const fechaInicioStr = `${anioNum}-${String(mesNum).padStart(2, '0')}-01 00:00:00`;
  const fechaFinStr = `${anioNum}-${String(mesNum + 1).padStart(2, '0')}-01 00:00:00`;

  const sql = `
    SELECT
      f.customer_code AS codigo_cliente,
      c.nombre_cliente AS cliente,
      f.seller_code AS preventa,
      f.route_code AS ruta,
      SUM(dd.cantidad) AS unidades_consumidas,
      SUM(dd.total) AS monto_consumido
    FROM facturas f
    JOIN detalle_documento dd
        ON dd.documento_code = f.code
    LEFT JOIN clientes_ventas c
        ON c.codigo_cliente = f.customer_code
    WHERE 
      f.type = 1
      AND f.status = 2
      AND f.fecha_entrega >= '${fechaInicioStr}'
      AND f.fecha_entrega <  '${fechaFinStr}'
      AND (
          f.seller_code ILIKE 'PV%'
          OR f.route_code ILIKE 'PV%'
          OR f.route_code ILIKE 'TELEVENTA%'
          OR f.route_code ILIKE 'RURAL%'
      )
    GROUP BY 
      f.customer_code,
      c.nombre_cliente,
      f.seller_code,
      f.route_code
    ORDER BY monto_consumido DESC
    LIMIT 20;
  `;

  return await sequelize.query(sql, {
    type: Sequelize.QueryTypes.SELECT
  });
};


const obtenerRankingRutasDescartable = async (anioNum, mesNum) => {
  const fechaInicioStr = `${anioNum}-${String(mesNum).padStart(2, "0")}-01 00:00:00`;
  const fechaFinStr = `${anioNum}-${String(mesNum + 1).padStart(2, "0")}-01 00:00:00`;

  console.log("fecha rankinInicio:", fechaInicioStr);
  console.log("fecha rankinFin:", fechaFinStr)


  const sql = `
    SELECT 
      o.seller_code AS usuario,
      SUM(dd.cantidad) AS sum_cantidad
    FROM ordenes o
    JOIN detalle_documento dd 
        ON dd.documento_code = o.code
    WHERE 
        dd.codigo_categoria = '7'
        AND o.status IN ('2','4','5')
        AND o.seller_code ILIKE 'R%'      -- SOLO R
        AND o.fecha_creacion >= '${fechaInicioStr}'
        AND o.fecha_creacion <  '${fechaFinStr}'
    GROUP BY 
        o.seller_code
    ORDER BY 
        sum_cantidad DESC;
  `;

  return await sequelize.query(sql, {
    type: Sequelize.QueryTypes.SELECT,
  });
};


const calcularKPIsMes = async (anioNum, mesNum) => {
  console.log("\n==============================================");
  console.log(`📆 CALCULANDO KPI MES ${anioNum}-${mesNum}`);
  console.log("==============================================");

  const fechaInicioStr = `${anioNum}-${String(mesNum).padStart(2, '0')}-01 00:00:00`;
  const fechaFinStr = `${anioNum}-${String(mesNum + 1).padStart(2, '0')}-01 00:00:00`;

  // ============================
  // KPI SQL REAL POR PREVENTA
  // ============================
  const resultadosSQL = await Orden.findAll({
    attributes: [
      [sequelize.col('Orden.seller_code'), 'preventa'],
      [sequelize.fn('SUM', sequelize.col('DetalleDocumentos.cantidad')), 'sum_quantity'],
      [sequelize.fn('SUM', sequelize.col('DetalleDocumentos.total')), 'sum_total'],
    ],
    where: {
      type: 2,
      status: 5,
      [Op.or]: [
        { seller_code: { [Op.iLike]: 'PV%' } },         // PREVENTA normal
        { seller_code: { [Op.iLike]: 'PREVENTA%' } },   // PREVENTA VIP
        { seller_code: { [Op.iLike]: 'TELEVENTA%' } }   // TELEVENTA
      ],
      fecha_entrega: {
        [Op.gte]: sequelize.literal(`'${fechaInicioStr}'`),
        [Op.lt]: sequelize.literal(`'${fechaFinStr}'`)
      }
    },
    include: [
      {
        model: DetalleDocumento,
        required: true,
        attributes: []
      }
    ],
    group: ['Orden.seller_code'],
    order: [
      [
        sequelize.literal(`
        CASE
          WHEN "Orden"."seller_code" ILIKE 'PREVENTA VIP%' THEN 1
          WHEN "Orden"."seller_code" ILIKE 'PV%' THEN 2
          WHEN "Orden"."seller_code" ILIKE 'TELEVENTA%' THEN 3
          ELSE 4
        END
      `),
        'ASC'
      ],
      ['seller_code', 'ASC']  // Luego ordena dentro de cada grupo
    ],
    raw: true
  });


  const rankingPreventasSQL = resultadosSQL.map(r => ({
    preventa: r.preventa,
    unidades: Number(r.sum_quantity),
    monto: Number(r.sum_total)
  }));

  const unidadesTotalesSQL = resultadosSQL.reduce((a, b) => a + Number(b.sum_quantity), 0);
  const montoTotalSQL = resultadosSQL.reduce((a, b) => a + Number(b.sum_total), 0);

  // ============================================
  // 🔥 TOP 20 MES ACTUAL
  // ============================================
  const topActual = await obtenerTop20Clientes(anioNum, mesNum);

  // ============================================
  // 🔥 TOP 20 ANTERIOR
  // ============================================
  let topAnterior = [];
  try {
    const fechaAnterior = new Date(anioNum, mesNum - 1, 1);
    fechaAnterior.setMonth(fechaAnterior.getMonth() - 1);

    const anioPrev = fechaAnterior.getFullYear();
    const mesPrev = fechaAnterior.getMonth() + 1;

    topAnterior = await obtenerTop20Clientes(anioPrev, mesPrev);
  } catch {
    topAnterior = [];
  }

  // ============================================
  // 🔥 UNIFICACIÓN TOP20
  // ============================================
  const top20Final = topActual.map(cli => {
    const anterior = topAnterior.find(c => c.codigo_cliente === cli.codigo_cliente) || {
      monto_consumido: 0,
      unidades_consumidas: 0
    };

    const variacionAbs = cli.monto_consumido - anterior.monto_consumido;
    const variacionPorc =
      anterior.monto_consumido > 0
        ? (variacionAbs / anterior.monto_consumido) * 100
        : null;

    return {
      codigo: cli.codigo_cliente,
      cliente: cli.cliente,
      preventa: cli.preventa,
      montoActual: Number(cli.monto_consumido),
      montoAnterior: Number(anterior.monto_consumido),
      variacionMontoAbs: variacionAbs,
      variacionMontoPorc: variacionPorc ? Number(variacionPorc.toFixed(2)) : null,
      unidadesActual: Number(cli.unidades_consumidas),
      unidadesAnterior: Number(anterior.unidades_consumidas)
    };
  });

  console.log("🔥 TOP 20 FINAL:", top20Final);

  // ======================================================
  // 🔥 AQUI AGREGA EL RANKING DE RUTAS R DESCARTABLE
  // ======================================================
  const rankingRutasR = await obtenerRankingRutasDescartable(anioNum, mesNum);
  console.log("🔥 Ranking Rutas R:", rankingRutasR);

  // ============================================
  // RETORNO FINAL
  // ============================================
  // return {
  //   kpisGenerales: {
  //     unidadesTotales: unidadesTotalesSQL,
  //     montoTotal: montoTotalSQL,
  //     metaMensualUnidades: 0,
  //     metaMensualDolares: 0,
  //     cumplimientoUnidadesMensual: 0,
  //     cumplimientoUSDMensual: 0,
  //     metaAnualUnidades: META_ANUAL_UNIDADES_PREVENTA,
  //     metaAnualDolares: META_ANUAL_USD_PREVENTA,
  //     cumplimientoUnidadesAnual: unidadesTotalesSQL / META_ANUAL_UNIDADES_PREVENTA * 100,
  //     cumplimientoUSDAnual: montoTotalSQL / META_ANUAL_USD_PREVENTA * 100
  //   },

  //   rankingPreventas: rankingPreventasSQL,

  //   topClientes: top20Final,

  //   rankingRutasR,   // 👈 NUEVA DATA ENVIADA AL FRONT

  //   clientesDetalle: {},
  //   resumenGeneral: {
  //     ordenesGeneradas: rankingPreventasSQL.length,
  //     ordenesEntregadas: rankingPreventasSQL.length,
  //     clientesEnRuta: 0,
  //     clientesSinConsumo: 0
  //   },

  //   _raw: {
  //     unidadesTotales: unidadesTotalesSQL,
  //     montoTotal: montoTotalSQL
  //   }
  // };


  // ======================================================
  // 🔥 CALCULAR METAS MENSUALES Y CUMPLIMIENTO
  // ======================================================
  const metaMensualUnidades = META_ANUAL_UNIDADES_PREVENTA / 12;
  const metaMensualDolares = META_ANUAL_USD_PREVENTA / 12;

  const cumplimientoUnidadesMensual =
    metaMensualUnidades > 0
      ? (unidadesTotalesSQL / metaMensualUnidades) * 100
      : 0;

  const cumplimientoUSDMensual =
    metaMensualDolares > 0
      ? (montoTotalSQL / metaMensualDolares) * 100
      : 0;


  // ======================================================
  // RETORNO FINAL
  // ======================================================
  return {
    kpisGenerales: {
      unidadesTotales: unidadesTotalesSQL,
      montoTotal: montoTotalSQL,

      metaMensualUnidades,
      metaMensualDolares,

      cumplimientoUnidadesMensual,
      cumplimientoUSDMensual,

      metaAnualUnidades: META_ANUAL_UNIDADES_PREVENTA,
      metaAnualDolares: META_ANUAL_USD_PREVENTA,

      cumplimientoUnidadesAnual:
        (unidadesTotalesSQL / META_ANUAL_UNIDADES_PREVENTA) * 100,
      cumplimientoUSDAnual:
        (montoTotalSQL / META_ANUAL_USD_PREVENTA) * 100
    },

    rankingPreventas: rankingPreventasSQL,
    topClientes: top20Final,
    rankingRutasR,
    clientesDetalle: {},
    resumenGeneral: {
      ordenesGeneradas: rankingPreventasSQL.length,
      ordenesEntregadas: rankingPreventasSQL.length,
      clientesEnRuta: 0,
      clientesSinConsumo: 0
    },

    _raw: {
      unidadesTotales: unidadesTotalesSQL,
      montoTotal: montoTotalSQL
    }
  };

};

// ===================================
// 📊 Endpoint Dashboard Preventas
// ===================================
const obtenerDatosDashboard = async (req, res) => {
  try {
    const { anio, mes } = req.query;
    // console.log("\n📥 Query recibida en /api/ventas/dashboard:", req.query);
    if (!anio || !mes) {
      return res.status(400).json({
        error: "Debe enviar ?anio=YYYY&mes=MM",
      });
    }

    const anioNum = parseInt(anio, 10);
    const mesNum = parseInt(mes, 10);
    // console.log(`🚀 Procesando dashboard para ${anioNum}-${mesNum}`);

    // =====================
    // MES ACTUAL
    // =====================
    const resumenActual = await calcularKPIsMes(anioNum, mesNum);

    // 🆕 TOP 20 CLIENTES CON MAYOR CONSUMO
    const top20Clientes = await obtenerTop20Clientes(anioNum, mesNum);

    // =========================================
    // 🔄 COMPARATIVA MES ANTERIOR (GENERAL)
    // =========================================
    let comparativaMesAnterior = null;
    let resumenPrev = null;

    try {
      const fecha = new Date(anioNum, mesNum - 1, 1);
      fecha.setMonth(fecha.getMonth() - 1);

      const anioPrev = fecha.getFullYear();
      const mesPrev = fecha.getMonth() + 1;

      console.log(`📊 Calculando comparativa con ${anioPrev}-${mesPrev}`);

      resumenPrev = await calcularKPIsMes(anioPrev, mesPrev);

      const uAct = resumenActual._raw.unidadesTotales;
      const uPrev = resumenPrev._raw.unidadesTotales;
      const mAct = resumenActual._raw.montoTotal;
      const mPrev = resumenPrev._raw.montoTotal;

      comparativaMesAnterior = {
        anio: anioPrev,
        mes: mesPrev,

        unidades: {
          anterior: uPrev,
          actual: uAct,
          variacionAbs: uAct - uPrev,
          variacionPorcentaje:
            uPrev > 0 ? ((uAct - uPrev) / uPrev) * 100 : null,
        },

        monto: {
          anterior: mPrev,
          actual: mAct,
          variacionAbs: mAct - mPrev,
          variacionPorcentaje:
            mPrev > 0 ? ((mAct - mPrev) / mPrev) * 100 : null,
        },
      };

      console.log("📌 Comparativa general generada:", comparativaMesAnterior);
    } catch (err) {
      console.error("❌ Error comparativa general:", err);
    }

    // ==========================================================
    // 🧾 TOP 10 CLIENTES ENRIQUECIDO (MES ACTUAL vs MES ANTERIOR)
    // ==========================================================
    let topClientesDetallado = [];

    try {
      const clientesActual = resumenActual.clientesDetalle || {};
      const clientesPrev = resumenPrev?.clientesDetalle || {};

      const topActual = Object.values(clientesActual)
        .sort((a, b) => b.monto - a.monto)
        .slice(0, 10);

      topClientesDetallado = topActual.map((cliActual) => {
        const codigo = cliActual.codigo;
        const cliPrev = clientesPrev[codigo] || {
          monto: 0,
          unidades: 0,
          ordenes: 0,
        };

        const variacionMontoAbs = cliActual.monto - cliPrev.monto;
        const variacionMontoPorc =
          cliPrev.monto > 0 ? (variacionMontoAbs / cliPrev.monto) * 100 : null;

        const variacionUnidadesAbs = cliActual.unidades - cliPrev.unidades;
        const variacionUnidadesPorc =
          cliPrev.unidades > 0
            ? (variacionUnidadesAbs / cliPrev.unidades) * 100
            : null;

        return {
          codigo,
          cliente: cliActual.cliente,

          montoActual: cliActual.monto,
          unidadesActual: cliActual.unidades,
          ordenesActual: cliActual.ordenes,

          montoAnterior: cliPrev.monto,
          unidadesAnterior: cliPrev.unidades,
          ordenesAnterior: cliPrev.ordenes,

          variacionMontoAbs,
          variacionMontoPorc,
          variacionUnidadesAbs,
          variacionUnidadesPorc,

          historial: [
            {
              etiqueta: "Mes anterior",
              monto: cliPrev.monto,
              unidades: cliPrev.unidades,
            },
            {
              etiqueta: "Mes actual",
              monto: cliActual.monto,
              unidades: cliActual.unidades,
            },
          ],
        };
      });

      // console.log("📊 TOP 10 CLIENTES DETALLADO:", topClientesDetallado);
    } catch (errCli) {
      console.error("❌ Error generando topClientesDetallado:", errCli);
    }

    // ======================================================
    // 🆕 NUEVA COLUMNA "vsMesAnterior" PARA CADA PREVENTA
    // ======================================================
    try {
      const rankingActual = resumenActual.rankingPreventas || [];
      const rankingPrevio = resumenPrev?.rankingPreventas || [];

      const rankingPrevMap = {};
      rankingPrevio.forEach(r => {
        rankingPrevMap[r.preventa] = {
          unidades: r.unidades,
          monto: r.monto
        };
      });

      resumenActual.rankingPreventas = rankingActual.map(r => {
        const prev = rankingPrevMap[r.preventa] || { unidades: 0, monto: 0 };

        const variacionAbs = r.unidades - prev.unidades;
        const variacionPorc =
          prev.unidades > 0 ? (variacionAbs / prev.unidades) * 100 : 0;

        return {
          ...r,
          vsMesAnterior: {
            unidades_anterior: prev.unidades,
            variacion_abs: variacionAbs,
            variacion_porc: Number(variacionPorc.toFixed(2))
          }
        };
      });
    } catch (e) {
      console.error("❌ Error generando vsMesAnterior:", e);
    }

    // ======================================================
    // 🆕 PERIODOS ANTERIORES EN KPIS GENERALES
    // Para las tarjetas:
    //  - "Periodo Ant +25%" en unidades
    //  - "Periodo Ant +12%" en USD
    // ======================================================
    if (comparativaMesAnterior && resumenActual.kpisGenerales) {
      const variacionUnidadesMesAnterior =
        comparativaMesAnterior.unidades?.variacionPorcentaje ?? null;
      const variacionMontoMesAnterior =
        comparativaMesAnterior.monto?.variacionPorcentaje ?? null;

      resumenActual.kpisGenerales = {
        ...resumenActual.kpisGenerales,
        periodoAntUnidadesPorc: variacionUnidadesMesAnterior,
        periodoAntMontoPorc: variacionMontoMesAnterior,
      };
    }

    const { _raw, clientesDetalle, topClientes, ...publicResumen } =
      resumenActual;

    return res.status(200).json({
      ...publicResumen,
      comparativaMesAnterior,
      topClientes: resumenActual.topClientes,

    });

  } catch (error) {
    console.error("❌ ERROR EN DASHBOARD:", error);
    return res.status(500).json({
      message: "Error al obtener los datos del dashboard",
    });
  }
};


module.exports = {
  obtenerDatosDashboard,
};
