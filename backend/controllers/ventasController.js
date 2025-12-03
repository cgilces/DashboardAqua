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
  let mesFin = mesNum + 1;
  let anioFin = anioNum;

  if (mesFin === 13) {
    mesFin = 1;
    anioFin++;
  }

  const fechaFinStr = `${anioFin}-${String(mesFin).padStart(2, "0")}-01 00:00:00`;


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


const obtenerDetalleRuta = async (req, res) => {
  try {
    const { vendedor, anio, mes } = req.query;

    if (!vendedor || !anio || !mes) {
      return res.status(400).json({ error: "Debe enviar vendedor, anio y mes" });
    }

    const detalle = await obtenerDetallePorVendedor(
      vendedor,
      parseInt(anio),
      parseInt(mes)
    );

    res.status(200).json(detalle);

  } catch (error) {
    console.error("❌ Error en obtenerDetalleRuta:", error);
    res.status(500).json({ message: "Error interno" });
  }
};


// ======================================================
// 🔍 OBTENER DETALLE DE PRODUCTOS VENDIDOS POR UNA RUTA R
// ======================================================
const obtenerDetallePorVendedor = async (codigoVendedor, anioNum, mesNum) => {
  const inicio = `${anioNum}-${String(mesNum).padStart(2, "0")}-01 00:00:00`;
  const fin = `${anioNum}-${String(mesNum + 1).padStart(2, "0")}-01 00:00:00`;

  const sql = `
    SELECT 
        dd.codigo_producto,
        dd.descripcion,
        SUM(dd.cantidad) AS unidades,
        SUM(dd.total) AS dolares
    FROM ordenes o
    JOIN detalle_documento dd 
        ON dd.documento_code = o.code
    WHERE 
        o.seller_code = '${codigoVendedor}'
        AND dd.codigo_categoria = '7'
        AND o.status IN ('2','4','5')
        AND o.fecha_creacion >= '${inicio}'
        AND o.fecha_creacion < '${fin}'
    GROUP BY 
        dd.codigo_producto,
        dd.descripcion
    ORDER BY 
        unidades DESC;
  `;

  return await sequelize.query(sql, {
    type: Sequelize.QueryTypes.SELECT
  });
};

const obtenerRankingRutasDescartable = async (anioNum, mesNum) => {
  const fechaInicioStr = `${anioNum}-${String(mesNum).padStart(2, "0")}-01 00:00:00`;
  let mesFin = mesNum + 1;
  let anioFin = anioNum;

  if (mesFin === 13) {
    mesFin = 1;
    anioFin++;
  }

  const fechaFinStr = `${anioFin}-${String(mesFin).padStart(2, "0")}-01 00:00:00`;

  console.log("fecha rankinInicio:", fechaInicioStr);
  console.log("fecha rankinFin:", fechaFinStr)


  const sql = `
 SELECT 
      o.seller_code AS usuario,
      SUM(dd.cantidad) AS unidades,
      SUM(dd.total) AS dolares
    FROM ordenes o
    JOIN detalle_documento dd 
        ON dd.documento_code = o.code
    WHERE 
        dd.codigo_categoria = '7'
        AND o.status IN ('2','4','5')
        AND o.seller_code ILIKE 'R%'      
      AND o.fecha_creacion >= '${fechaInicioStr}'
      AND o.fecha_creacion <  '${fechaFinStr}'
    GROUP BY 
        o.seller_code
    ORDER BY 
        unidades DESC;
  `;


  return await sequelize.query(sql, {
    type: Sequelize.QueryTypes.SELECT,
  });
};


const obtenerVentaPorProducto = async (anioNum, mesNum) => {

  const inicio = `${anioNum}-${String(mesNum).padStart(2, '0')}-01 00:00:00`;
  const finMes = mesNum === 12 ? 1 : mesNum + 1;
  const finAnio = mesNum === 12 ? anioNum + 1 : anioNum;
  const fin = `${finAnio}-${String(finMes).padStart(2, '0')}-01 00:00:00`;

  const sql = `
    SELECT 
      dd.descripcion AS producto,
      SUM(dd.cantidad) AS unidades,
      SUM(dd.total) AS dolares
    FROM ordenes o
    JOIN detalle_documento dd 
        ON dd.documento_code = o.code
    WHERE 
      dd.codigo_categoria = '7'
      AND o.status IN ('2','4','5')
      AND (
        o.seller_code ILIKE 'PV%' OR 
        o.seller_code ILIKE 'R%' OR
        o.seller_code ILIKE 'TELEVENTA%'
      )
      AND o.fecha_entrega >= '${inicio}'
      AND o.fecha_entrega < '${fin}'
    GROUP BY dd.descripcion
    ORDER BY unidades DESC;
  `;

  return await sequelize.query(sql, { type: Sequelize.QueryTypes.SELECT });
};


const calcularKPIsMes = async (anioNum, mesNum) => {
  console.log("\n==============================================");
  console.log(`📆 CALCULANDO KPI MES ${anioNum}-${mesNum}`);
  console.log("==============================================");

  const fechaInicioStr = `${anioNum}-${String(mesNum).padStart(2, '0')}-01 00:00:00`;
  let mesFin = mesNum + 1;
  let anioFin = anioNum;

  if (mesFin === 13) {
    mesFin = 1;
    anioFin++;
  }

  const fechaFinStr = `${anioFin}-${String(mesFin).padStart(2, "0")}-01 00:00:00`;

  console.log("⏳ RANGO FECHAS KPI:");
  console.log("➡️ Inicio:", fechaInicioStr);
  console.log("➡️ Fin:", fechaFinStr);

  // ============================
  // KPI SQL REAL POR PREVENTA
  // ============================
  console.log("🔍 Consultando ranking PREVENTA...");

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
        { seller_code: { [Op.iLike]: 'PV%' } },
        { seller_code: { [Op.iLike]: 'PREVENTA%' } },
        { seller_code: { [Op.iLike]: 'TELEVENTA%' } }
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
      ['seller_code', 'ASC']
    ],
    raw: true
  });

  console.log("📊 RESULTADOS PREVENTA:", resultadosSQL);

  const rankingPreventasSQL = resultadosSQL.map(r => ({
    preventa: r.preventa,
    unidades: Number(r.sum_quantity),
    monto: Number(r.sum_total)
  }));

  const unidadesTotalesSQL = resultadosSQL.reduce((a, b) => a + Number(b.sum_quantity), 0);
  const montoTotalSQL = resultadosSQL.reduce((a, b) => a + Number(b.sum_total), 0);

  console.log("📌 Unidades Totales Preventa:", unidadesTotalesSQL);
  console.log("📌 Monto Total Preventa:", montoTotalSQL);

  // ============================================
  // 🔥 TOP 20 MES ACTUAL
  // ============================================
  console.log("🔍 Consultando TOP 20 Clientes...");
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

    console.log(`📆 Comparando vs Mes Anterior: ${anioPrev}-${mesPrev}`);

    topAnterior = await obtenerTop20Clientes(anioPrev, mesPrev);
  } catch {
    topAnterior = [];
    console.log("⚠️ No hay TOP anterior.");
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
  // 🔥 RANKING RUTAS R DESCARTABLE
  // ======================================================
  console.log("🔍 Consultando Ranking Rutas R...");
  const rankingRutasR = await obtenerRankingRutasDescartable(anioNum, mesNum);
  console.log("📌 Ranking R:", rankingRutasR);

  // ======================================================
  // 🔥 NUEVA CONSULTA: VENTA POR PRODUCTO (PV + R + TELEVENTA)
  // ======================================================
  console.log("📦 Consultando Venta por Producto General...");

  const ventaPorProducto = await obtenerVentaPorProducto(anioNum, mesNum);

  console.log("📊 Venta por Producto:", ventaPorProducto);

  // ======================================================
  // 🔥 METAS MENSUALES Y CUMPLIMIENTO
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

  console.log("🎯 Cumplimiento Mensual Unidades:", cumplimientoUnidadesMensual);
  console.log("🎯 Cumplimiento Mensual USD:", cumplimientoUSDMensual);

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
    rankingRutasR,
    topClientes: top20Final,

    ventaPorProducto,  // 👈 AQUI VA EL NUEVO MODULO

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
      console.log("==============================================");
      console.log("🔄 INICIANDO GENERACIÓN VS MES ANTERIOR (USD)");
      console.log("==============================================");

      const rankingActual = resumenActual.rankingPreventas || [];
      const rankingPrevio = resumenPrev?.rankingPreventas || [];

      console.log("📊 rankingActual (mes actual):", rankingActual);
      console.log("📊 rankingPrevio (mes anterior):", rankingPrevio);

      // ======================================================
      // 🗺️ MAPA MES ANTERIOR → SOLO DÓLARES
      // ======================================================
      const rankingPrevMap = {};

      rankingPrevio.forEach(r => {
        rankingPrevMap[r.preventa] = {
          monto: Number(r.monto) || 0
        };
      });

      console.log("🧩 rankingPrevMap generado:", rankingPrevMap);

      // ======================================================
      // 🧮 CALCULAR VARIACIÓN EN DÓLARES
      // ======================================================
      resumenActual.rankingPreventas = rankingActual.map(r => {
        const montoActual = Number(r.monto) || 0;

        const prev = rankingPrevMap[r.preventa] || { monto: 0 };
        const montoAnterior = Number(prev.monto) || 0;

        const variacionAbs = montoActual - montoAnterior;

        const variacionPorc =
          montoAnterior > 0 ? (variacionAbs / montoAnterior) * 100 : null;

        console.log(
          `🔍 PREVENTA ${r.preventa}: actual $${montoActual}, anterior $${montoAnterior}, abs ${variacionAbs}, % ${variacionPorc}`
        );

        return {
          ...r,
          vsMesAnterior: {
            monto_anterior: montoAnterior,
            variacion_abs: Number(variacionAbs.toFixed(2)),
            variacion_porc:
              variacionPorc !== null ? Number(variacionPorc.toFixed(2)) : null
          }
        };
      });

      console.log("✅ rankingPreventas calculado (USD):", resumenActual.rankingPreventas);

    } catch (e) {
      console.error("❌ Error generando vsMesAnterior (USD):", e);
    }

    // ======================================================
    // 🆕 PERIODOS ANTERIORES EN KPIS GENERALES
    // Ahora los KPI también usan dólares correctamente
    // ======================================================
    if (comparativaMesAnterior && resumenActual.kpisGenerales) {
      const variacionUnidadesMesAnterior =
        comparativaMesAnterior.unidades?.variacionPorcentaje ?? null;

      const variacionMontoMesAnterior =
        comparativaMesAnterior.monto?.variacionPorcentaje ?? null;

      console.log("📌 variación unidades KPIs:", variacionUnidadesMesAnterior);
      console.log("📌 variación monto KPIs:", variacionMontoMesAnterior);

      resumenActual.kpisGenerales = {
        ...resumenActual.kpisGenerales,
        periodoAntUnidadesPorc: variacionUnidadesMesAnterior,
        periodoAntMontoPorc: variacionMontoMesAnterior,
      };
    }

    const { _raw, clientesDetalle, topClientes, ...publicResumen } = resumenActual;

    console.log("📤 Enviando respuesta final del dashboard");

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
  obtenerDetalleRuta
};
