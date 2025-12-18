// controllers/ventasController.js
const {
  Orden,
  DetalleDocumento,
  RutaPreventa,
  ClienteVenta,
  MetaPreventa,
} = require("../../models");

const Sequelize = require("sequelize");
const Op = Sequelize.Op;
const { sequelize } = require('../../models');


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



// =============================================================
// 🧩 FUNCIÓN SEGURA PARA FECHAS PG (EVITA MESES 13)
// =============================================================
function getRangoFechas(anio, mes) {
  const inicio = new Date(Date.UTC(anio, mes - 1, 1));
  const fin = new Date(Date.UTC(anio, mes, 1));

  const fInicio = inicio.toISOString().replace("T", " ").substring(0, 19);
  const fFin = fin.toISOString().replace("T", " ").substring(0, 19);

  return { fInicio, fFin };
}


// ===============================
// 🔧 DÍAS LABORABLES DEL MES (L–S)
// ===============================
const getDiasLaborablesMes = (anio, mes) => {
  const diasEnMes = new Date(anio, mes, 0).getDate();
  let laborables = 0;

  for (let d = 1; d <= diasEnMes; d++) {
    const fecha = new Date(anio, mes - 1, d);
    const dia = fecha.getDay(); // 0 domingo
    if (dia !== 0) laborables++;
  }
  return laborables;
};




// ======================================================
// 🔧 DÍAS HÁBILES TRANSCURRIDOS (L–S) DEL MES
// ======================================================
function getDiasHabilesTranscurridos(anio, mes) {
  const hoy = new Date();
  let limite = new Date(anio, mes, 0).getDate();

  // Si es mes actual → hasta hoy
  if (hoy.getFullYear() === anio && (hoy.getMonth() + 1) === mes) {
    // limite = hoy.getDate();
    const diaLocal = new Date().getDate();
    limite = diaLocal;

  }

  let habiles = 0;

  for (let d = 1; d <= limite; d++) {
    const fecha = new Date(anio, mes - 1, d);
    const dia = fecha.getDay(); // 0 domingo
    if (dia !== 0) habiles++; // L–S
  }

  return habiles;
}


// =====================================
// 🔧 META HISTÓRICA POR PREVENTA (USD)
// =====================================
const obtenerMetasHistoricasPreventas = async () => {
  const sql = `
    SELECT seller_code, 
           MAX(total_mes) AS meta_historica
    FROM (
      SELECT 
        o.seller_code,
        DATE_TRUNC('month', o.fecha_entrega) AS mes,
        SUM(dd.total) AS total_mes
      FROM ordenes o
      JOIN detalle_documento dd 
        ON dd.documento_code = o.code
      WHERE dd.codigo_categoria = '7'
        AND o.status IN (2,4,5)
        AND (
          o.seller_code ILIKE 'PV%' OR
          o.seller_code ILIKE 'PREVENTA%' OR
          o.seller_code ILIKE 'TELEVENTA%' OR
          o.seller_code ILIKE 'R%'
        )
      GROUP BY o.seller_code, DATE_TRUNC('month', o.fecha_entrega)
    ) AS sub
    GROUP BY seller_code;
  `;
  const filas = await sequelize.query(sql, { type: Sequelize.QueryTypes.SELECT });

  const mapa = {};
  filas.forEach(f => mapa[f.seller_code] = Number(f.meta_historica));
  return mapa;
};

// ========================================
// 🔧 META HISTÓRICA GLOBAL (USD – DESCART)
// ========================================
const obtenerMetaHistoricaGlobal = async () => {
  const sql = `
    SELECT MAX(total_mes) AS meta_global
    FROM (
      SELECT 
        DATE_TRUNC('month', o.fecha_entrega) as mes,
        SUM(dd.total) AS total_mes
      FROM ordenes o
      JOIN detalle_documento dd 
        ON dd.documento_code = o.code
      WHERE dd.codigo_categoria = '7'
        AND o.status IN (2,4,5)
        AND (
          o.seller_code ILIKE 'PV%' OR
          o.seller_code ILIKE 'PREVENTA%' OR
          o.seller_code ILIKE 'TELEVENTA%' OR
          o.seller_code ILIKE 'R%'
        )
      GROUP BY DATE_TRUNC('month', o.fecha_entrega)
    ) AS sub;
  `;
  const [row] = await sequelize.query(sql, { type: Sequelize.QueryTypes.SELECT });
  return row?.meta_global ? Number(row.meta_global) : 0;
};




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
  const { fInicio, fFin } = getRangoFechas(anioNum, mesNum);

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
        AND o.fecha_creacion >= '${fInicio}'
        AND o.fecha_creacion < '${fFin}'
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


const obtenerRankingRutasDescartable = async (
  anioNum,
  mesNum,
  metasPorPreventa,
  diasTranscurridos,
  diasLaborablesMes
) => {
  // MES ACTUAL
  const inicio = `${anioNum}-${String(mesNum).padStart(2, "0")}-01 00:00:00`;
  const mesSiguiente = mesNum === 12 ? 1 : mesNum + 1;
  const anioFin = mesNum === 12 ? anioNum + 1 : anioNum;
  const fin = `${anioFin}-${String(mesSiguiente).padStart(2, "0")}-01 00:00:00`;

  // MES ANTERIOR
  const fechaAnt = new Date(anioNum, mesNum - 2, 1);
  const anioPrev = fechaAnt.getFullYear();
  const mesPrev = fechaAnt.getMonth() + 1;
  const inicioPrev = `${anioPrev}-${String(mesPrev).padStart(2, "0")}-01 00:00:00`;
  const finPrev = `${anioNum}-${String(mesNum).padStart(2, "0")}-01 00:00:00`;

  // MES ACTUAL
  const sqlActual = `
    SELECT 
      o.seller_code AS usuario,
      SUM(dd.cantidad) AS unidades,
      SUM(dd.total) AS dolares
    FROM ordenes o
    JOIN detalle_documento dd ON dd.documento_code = o.code
    WHERE 
      dd.codigo_categoria = '7'
      AND o.status IN ('2','4','5')
      AND o.seller_code ILIKE 'R%'
      AND o.fecha_creacion >= '${inicio}'
      AND o.fecha_creacion <  '${fin}'
    GROUP BY o.seller_code
    ORDER BY dolares DESC;
  `;
  const actual = await sequelize.query(sqlActual, { type: Sequelize.QueryTypes.SELECT });

  // MES ANTERIOR
  const sqlPrev = `
    SELECT 
      o.seller_code AS usuario,
      SUM(dd.total) AS dolares
    FROM ordenes o
    JOIN detalle_documento dd ON dd.documento_code = o.code
    WHERE 
      dd.codigo_categoria = '7'
      AND o.status IN ('2','4','5')
      AND o.seller_code ILIKE 'R%'
      AND o.fecha_creacion >= '${inicioPrev}'
      AND o.fecha_creacion <  '${finPrev}'
    GROUP BY o.seller_code;
  `;
  const anterior = await sequelize.query(sqlPrev, { type: Sequelize.QueryTypes.SELECT });

  // Convertimos el anterior en mapa
  const mapPrev = {};
  anterior.forEach(r => {
    mapPrev[r.usuario] = Number(r.dolares) || 0;
  });

  // COMBINAR RESULTADOS
  const rankingFinal = actual.map(r => {
  const montoActual = Number(r.dolares);  // Monto del mes actual
  const montoAnterior = mapPrev[r.usuario] || 0;  // Monto del mes anterior

  // Proyección del mes actual: (ventas / días transcurridos) * días laborables
  const proyeccion = (montoActual / diasTranscurridos) * diasLaborablesMes;

  // Proyección del mes anterior: (ventas mes anterior / días transcurridos mes anterior) * días laborables mes actual
  const proyeccionAnterior = (montoAnterior / diasTranscurridos) * diasLaborablesMes;

  // Cálculo de la proyección faltante
  const proyeccionFaltantePorcentaje = ((proyeccion - montoActual) / proyeccion) * 100;

  // Variación con respecto al mes anterior (comparando la proyección actual con la proyección anterior)
  const variacionAbs = proyeccion - proyeccionAnterior;  // Diferencia absoluta de la proyección
  const variacionPorc = proyeccionAnterior > 0 ? ((variacionAbs / proyeccionAnterior) * 100) : null;

  return {
    usuario: r.usuario,
    unidades: Number(r.unidades),
    dolares: montoActual,
    meta: metasPorPreventa[r.usuario] || 0,  // Meta histórica
    proyeccion: Number(proyeccion.toFixed(2)),  // Proyección para este mes
    proyeccionFaltantePorcentaje: Number(proyeccionFaltantePorcentaje.toFixed(2)),
    vsMesAnterior: {
      monto_anterior: proyeccionAnterior,  // Proyección del mes anterior
      variacion_abs: Number(variacionAbs.toFixed(2)),  // Variación absoluta
      variacion_porc: variacionPorc !== null ? Number(variacionPorc.toFixed(2)) : null  // Variación porcentual
    }
  };
});

 


  return rankingFinal;
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





//Crear la función SQL que obtiene precios promedio por preventa
const obtenerPrecioPromedioPorPreventa = async (anioNum, mesNum) => {
  const inicio = `${anioNum}-${String(mesNum).padStart(2, "0")}-01 00:00:00`;
  const mesSig = mesNum === 12 ? 1 : mesNum + 1;
  const anioSig = mesNum === 12 ? anioNum + 1 : anioNum;
  const fin = `${anioSig}-${String(mesSig).padStart(2, "0")}-01 00:00:00`;

  const sql = `
    SELECT
      o.seller_code AS preventa,
      dd.codigo_producto,
      dd.descripcion,
      SUM(dd.cantidad) AS unidades,
      SUM(dd.total) AS monto,
      CASE
        WHEN SUM(dd.cantidad) > 0 THEN SUM(dd.total) / SUM(dd.cantidad)
        ELSE 0
      END AS precio_promedio
    FROM ordenes o
    JOIN detalle_documento dd ON dd.documento_code = o.code
    WHERE
       o.status IN ('2','4','5')
       AND dd.codigo_categoria = '7'
       AND (
          o.seller_code ILIKE 'PV%'
          OR o.seller_code ILIKE 'PREVENTA%'
          OR o.seller_code ILIKE 'TELEVENTA%'
          OR o.seller_code ILIKE 'R%'
       )
       AND o.fecha_entrega >= '${inicio}'
       AND o.fecha_entrega <  '${fin}'
    GROUP BY o.seller_code, dd.codigo_producto, dd.descripcion
    ORDER BY o.seller_code;
  `;

  return await sequelize.query(sql, { type: Sequelize.QueryTypes.SELECT });
};



//Función para obtener los datos del mes anterior
const obtenerPrecioPromedioMesAnterior = async (anioNum, mesNum) => {
  const fecha = new Date(anioNum, mesNum - 2, 1);
  const anioPrev = fecha.getFullYear();
  const mesPrev = fecha.getMonth() + 1;

  return await obtenerPrecioPromedioPorPreventa(anioPrev, mesPrev);
};





// ===========================
// 🧩 CLASIFICAR PRESENTACIÓN
// ===========================
function clasificarPresentacion(descripcion = "") {
  const text = descripcion.toUpperCase();

  if (text.includes("300ML")) return "300ML";
  if (text.includes("500ML")) return "500ML";
  if (text.includes("625ML")) return "625ML";
  if (text.includes("1.5") || text.includes("1.5L")) return "1.5L";
  if (text.includes("1L SPORT")) return "1L SPORT";
  if (text.includes("1L")) return "1L";
  if (text.includes("GALON") || text.includes("GALÓN")) return "GALON";
  if (text.includes("6L")) return "6L";

  return "OTROS";
}


// =================================================
// ORGANIZAR TABLA DE PRECIOS PROMEDIO (FINAL)
// =================================================

function procesarTablaPrecioPromedio(actual, anterior, productosVendidos) {
  const mapAnterior = {};

  // Crear mapa del mes anterior: preventa + categoría → precio promedio
  anterior.forEach(row => {
    const categoria = clasificarPresentacion(row.descripcion);
    const key = `${row.preventa}_${categoria}`;
    mapAnterior[key] = Number(row.precio_promedio) || 0;
  });

  const respuesta = {};

  actual.forEach(row => {
    const categoria = clasificarPresentacion(row.descripcion);
    if (categoria === "OTROS") return;

    // ❗ FILTRO IMPORTANTE → SOLO productos que sí se vendieron este mes
    if (!productosVendidos[row.preventa]?.has(categoria)) return;

    const key = `${row.preventa}_${categoria}`;

    const precioActual = Number(row.precio_promedio) || 0;
    const precioAnterior = mapAnterior[key] || 0;

    let variacion = null;
    if (precioAnterior > 0) {
      variacion = ((precioActual - precioAnterior) / precioAnterior) * 100;
    }

    if (!respuesta[row.preventa]) respuesta[row.preventa] = {};

    respuesta[row.preventa][categoria] = {
      precio: Number(precioActual.toFixed(2)),
      vsAnterior: variacion !== null ? Number(variacion.toFixed(2)) : null
    };
  });

  return respuesta;
}
// ======================================================
// 🔍 TODOS LOS PRODUCTOS VENDIDOS POR PREVENTA (MES ACTUAL)
// ======================================================
async function obtenerProductosVendidosMes(anio, mes) {
  const inicio = `${anio}-${String(mes).padStart(2, "0")}-01 00:00:00`;
  const mesSig = mes === 12 ? 1 : mes + 1;
  const anioSig = mes === 12 ? anio + 1 : anio;
  const fin = `${anioSig}-${String(mesSig).padStart(2, "0")}-01 00:00:00`;

  const sql = `
    SELECT 
      o.seller_code AS preventa,
      dd.descripcion
    FROM ordenes o
    JOIN detalle_documento dd ON dd.documento_code = o.code
    WHERE 
      dd.codigo_categoria = '7'
      AND o.status IN ('2','4','5')
      AND o.fecha_creacion >= '${inicio}'
      AND o.fecha_creacion < '${fin}'
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
  //console.log("\n==============================================");
  //console.log(`📆 CALCULANDO KPI MES ${anioNum}-${mesNum}`);
  //console.log("==============================================");

  const fechaInicioStr = `${anioNum}-${String(mesNum).padStart(2, '0')}-01 00:00:00`;
  let mesFin = mesNum + 1;
  let anioFin = anioNum;

  if (mesFin === 13) {
    mesFin = 1;
    anioFin++;
  }

  const fechaFinStr = `${anioFin}-${String(mesFin).padStart(2, "0")}-01 00:00:00`;

  //console.log("⏳ RANGO FECHAS KPI:");
  //console.log("➡️ Inicio:", fechaInicioStr);
  //console.log("➡️ Fin:", fechaFinStr);

  // ============================
  // KPI SQL REAL POR PREVENTA
  // ============================
  //console.log("🔍 Consultando ranking PREVENTA...");

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

  ////console.log("📊 RESULTADOS PREVENTA:", resultadosSQL);


  // =============================
  // 🔥 METAS Y PROYECCIÓN NUEVA
  // =============================
  const metasPorPreventa = await obtenerMetasHistoricasPreventas();
  const metaGlobal = await obtenerMetaHistoricaGlobal();

  const hoy = new Date();
  const esMesActual = hoy.getFullYear() === anioNum && (hoy.getMonth() + 1) === mesNum;
  const diasTranscurridos = getDiasHabilesTranscurridos(anioNum, mesNum);

  const diasLaborablesMes = getDiasLaborablesMes(anioNum, mesNum);

  let rankingPreventasSQL = resultadosSQL.map(r => {
    const preventa = r.preventa;
    const unidades = Number(r.sum_quantity);
    const monto = Number(r.sum_total);

    // Meta histórica de esta ruta
    const metaHistorica = metasPorPreventa[preventa] || 0;

    // Proyección del mes: (ventas / días transcurridos) * días laborables
    const proyeccion = (monto / diasTranscurridos) * diasLaborablesMes;

    return {
      preventa,
      unidades,
      monto,
      meta: metaHistorica,
      proyeccion: Number(proyeccion.toFixed(2))
    };
  });

  // ORDENAR por quién vende más USD
  rankingPreventasSQL.sort((a, b) => b.monto - a.monto);

  // TOTALES
  const unidadesTotalesSQL = rankingPreventasSQL.reduce((a, b) => a + b.unidades, 0);
  const montoTotalSQL = rankingPreventasSQL.reduce((a, b) => a + b.monto, 0);


  // ============================================
  // 🔥 TOP 20 MES ACTUAL
  // ============================================
  // //console.log("🔍 Consultando TOP 20 Clientes...");
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

    // //console.log(`📆 Comparando vs Mes Anterior: ${anioPrev}-${mesPrev}`);

    topAnterior = await obtenerTop20Clientes(anioPrev, mesPrev);
  } catch {
    topAnterior = [];
    //console.log("⚠️ No hay TOP anterior.");
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

  // //console.log("🔥 TOP 20 FINAL:", top20Final);

  // ======================================================
  // 🔥 RANKING RUTAS R DESCARTABLE
  // ======================================================
  //console.log("🔍 Consultando Ranking Rutas R...");
  // const rankingRutasR = await obtenerRankingRutasDescartable(anioNum, mesNum);

  const rankingRutasR = await obtenerRankingRutasDescartable(
    anioNum,
    mesNum,
    metasPorPreventa,
    diasTranscurridos,
    diasLaborablesMes
  );

  //console.log("📌 Ranking R:", rankingRutasR);

  // ======================================================
  // 🔥 NUEVA CONSULTA: VENTA POR PRODUCTO (PV + R + TELEVENTA)
  // ======================================================
  // //console.log("📦 Consultando Venta por Producto General...");

  const ventaPorProducto = await obtenerVentaPorProducto(anioNum, mesNum);

  // //console.log("📊 Venta por Producto:", ventaPorProducto);

  // ======================================================
  // 🔥 METAS MENSUALES Y CUMPLIMIENTO
  // ======================================================
  const metaMensualUnidades = META_ANUAL_UNIDADES_PREVENTA / 12;
  // const metaMensualDolares = META_ANUAL_USD_PREVENTA / 12;
  const metaMensualDolares = metaGlobal;


  const cumplimientoUnidadesMensual =
    metaMensualUnidades > 0
      ? (unidadesTotalesSQL / metaMensualUnidades) * 100
      : 0;

  const cumplimientoUSDMensual =
    metaMensualDolares > 0
      ? (montoTotalSQL / metaMensualDolares) * 100
      : 0;

  //console.log("🎯 Cumplimiento Mensual Unidades:", cumplimientoUnidadesMensual);
  //console.log("🎯 Cumplimiento Mensual USD:", cumplimientoUSDMensual);

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

    if (!anio || !mes) {
      return res.status(400).json({
        error: "Debe enviar ?anio=YYYY&mes=MM",
      });
    }

    const anioNum = parseInt(anio, 10);
    const mesNum = parseInt(mes, 10);

    // =====================
    // MES ACTUAL
    // =====================
    const resumenActual = await calcularKPIsMes(anioNum, mesNum);

    // TOP 20 CLIENTES
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

    } catch (err) {
      console.error("❌ Error comparativa general:", err);
    }

    // ======================================================
    // 🆕 vsMesAnterior por preventa
    // ======================================================
    try {
      const rankingActual = resumenActual.rankingPreventas || [];
      const rankingPrevio = resumenPrev?.rankingPreventas || [];

      const rankingPrevMap = {};
      rankingPrevio.forEach(r => {
        rankingPrevMap[r.preventa] = { monto: Number(r.monto) || 0 };
      });

      resumenActual.rankingPreventas = rankingActual.map(r => {
        // Usar la proyección del mes actual
        const proyeccionActual = Number(r.proyeccion) || 0;

        // Usar el valor de la proyección y no el histórico para la variación con el mes anterior
        const prev = rankingPrevMap[r.preventa] || { monto: 0 };
        const montoAnterior = prev.monto;

        // Aquí debes comparar la proyección con el monto del mes anterior
        const variacionAbs = proyeccionActual - montoAnterior;  // diferencia entre la proyección y el mes anterior
        const variacionPorc =
          montoAnterior > 0 ? (variacionAbs / montoAnterior) * 100 : null;

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







      // console.log("✅ rankingPreventas calculado (USD):", resumenActual.rankingPreventas);

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

      // console.log("📌 variación unidades KPIs:", variacionUnidadesMesAnterior);
      // console.log("📌 variación monto KPIs:", variacionMontoMesAnterior);

      resumenActual.kpisGenerales = {
        ...resumenActual.kpisGenerales,
        periodoAntUnidadesPorc: variacionUnidadesMesAnterior,
        periodoAntMontoPorc: variacionMontoMesAnterior,
      };
    }

    const { _raw, clientesDetalle, topClientes, ...publicResumen } = resumenActual;

    console.log("📤 Enviando respuesta final del dashboard");

    // 🔥 ================================================
    // 🔥 NUEVO: COSTO PROMEDIO POR PREVENTA
    // 🔥 ================================================
    const productosVendidos = await obtenerProductosVendidosMes(anioNum, mesNum);

    const preciosActual = await obtenerPrecioPromedioPorPreventa(anioNum, mesNum);
    const preciosAnterior = await obtenerPrecioPromedioMesAnterior(anioNum, mesNum);

    const precioPromedioTabla = procesarTablaPrecioPromedio(
      preciosActual,
      preciosAnterior,
      productosVendidos
    );

    // console.log(" tabla costo promedio:", precioPromedioTabla);

    // ================================================
    // RESPUESTA FINAL
    // ================================================
    return res.status(200).json({
      ...publicResumen,
      comparativaMesAnterior,
      topClientes: resumenActual.topClientes,
      precioPromedioTabla
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
