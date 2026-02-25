// controllers/ventasController.js
const {
  Orden,
  DetalleDocumento,
  // RutaPreventa,
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
const META_MENSUAL_UNIDADES_PREVENTA = 70000;   // Meta mensual de unidades
const META_MENSUAL_USD_PREVENTA = 200000;  // Meta mensual en USD


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


// ======================================================
//  DÍAS HÁBILES TRANSCURRIDOS (L–S) DEL MES
// ======================================================
const getDiasHabilesTranscurridos = (anio, mes, festivos = []) => {
  const hoy = new Date();
  const hoyLocal = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());
  const ayer = new Date(hoyLocal);
  ayer.setDate(hoyLocal.getDate() - 1);
  // const ayer = new Date(hoy);
  // ayer.setDate(hoy.getDate() - 1);

  let ultimoDia = new Date(anio, mes, 0).getDate();

  // Si es el mes actual, contar solo hasta ayer
  if (
    ayer.getFullYear() === anio &&
    ayer.getMonth() + 1 === mes
  ) {
    ultimoDia = ayer.getDate();
  }

  let habiles = 0;

  for (let d = 1; d <= ultimoDia; d++) {
    const fecha = new Date(anio, mes - 1, d);
    const diaSemana = fecha.getDay(); // 0 domingo

    const esFestivo = festivos.some(f =>
      f.getDate() === fecha.getDate() &&
      f.getMonth() === fecha.getMonth() &&
      f.getFullYear() === fecha.getFullYear()
    );

    // ✅ lunes a sábado
    if (diaSemana !== 0 && !esFestivo) {
      habiles++;
    }
  }

  return habiles;
};

// Festivos (definidos por las fechas)
const festivos = [
  new Date(2025, 0, 1), // 1 de enero
  new Date(2025, 4, 1), // Día del trabajo
  new Date(2025, 11, 25), // 25 de diciembre - Navidad
  new Date(2026, 0, 1), // 1 de enero - Año Nuevo
  new Date(2026, 1, 16), // 16 de febrero - Carnaval
  new Date(2026, 1, 17), // 17 de febrero - Carnaval
  new Date(2026, 2, 29), // 29 de marzo - Semana Santa (Jueves Santo)
  new Date(2026, 2, 30), // 30 de marzo - Semana Santa (Viernes Santo)
  new Date(2026, 4, 1), // 1 de mayo - Día del Trabajo
  new Date(2026, 7, 10), // 10 de agosto - Primer Grito de Independencia
  new Date(2026, 9, 9), // 9 de octubre - Independencia de Guayaquil
  new Date(2026, 10, 2), // 2 de noviembre - Día de los Difuntos
  new Date(2026, 10, 3), // 3 de noviembre - Independencia de Cuenca
  new Date(2026, 11, 6), // 6 de diciembre - Día de la Independencia de Quito
  new Date(2026, 11, 8), // 8 de diciembre - Día de la Inmaculada Concepción
  new Date(2026, 11, 25) // 25 de diciembre - Navidad
];

// ===============================
//  DÍAS LABORABLES DEL MES (L–S)
// ===============================
const getDiasLaborablesMes = (anio, mes, festivos = []) => {
  const diasEnMes = new Date(anio, mes, 0).getDate();
  let laborables = 0;

  for (let d = 1; d <= diasEnMes; d++) {
    const fecha = new Date(anio, mes - 1, d);
    const diaSemana = fecha.getDay(); // 0 = domingo, 6 = sábado

    const esFestivo = festivos.some(f =>
      f.getDate() === fecha.getDate() &&
      f.getMonth() === fecha.getMonth() &&
      f.getFullYear() === fecha.getFullYear()
    );

    // ❌ solo se excluye domingo y feriados
    if (diaSemana !== 0 && !esFestivo) {
      laborables++;
    }
  }

  return laborables;
};


// Llamada a la función pasando festivos
// const diasTranscurridos = getDiasHabilesTranscurridos(2025, 12, festivos);
// console.log("Días hábiles transcurridos:", diasTranscurridos);

// =====================================
// 🔧 META HISTÓRICA POR PREVENTA (USD)
// =====================================
const obtenerMetasHistoricasPreventas = async () => {
  const sql = `
    SELECT sub.seller_code,
       MAX(sub.total_mes) AS meta_historica,
       mes_max_consumo.mes AS mes_mayor_consumo
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
      LEFT JOIN (
          SELECT sub2.seller_code,
                sub2.mes,
                sub2.total_mes,
                RANK() OVER (PARTITION BY sub2.seller_code ORDER BY sub2.total_mes DESC) AS rank
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
          ) AS sub2
      ) AS mes_max_consumo
      ON sub.seller_code = mes_max_consumo.seller_code
      AND mes_max_consumo.rank = 1
      GROUP BY sub.seller_code, mes_max_consumo.mes;
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
//  TOP 20 CLIENTES CON MAYOR CONSUMO (FACTURAS PREVENTA)
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
    LEFT JOIN clientes c
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
// OBTENER DETALLE DE PRODUCTOS VENDIDOS POR UNA RUTA R
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
  const hoy = new Date();
  const esMesActual =
    hoy.getFullYear() === anioNum && hoy.getMonth() + 1 === mesNum;

  // ===============================
  // 📆 FECHAS
  // ===============================
  const inicio = `${anioNum}-${String(mesNum).padStart(2, "0")}-01 00:00:00`;
  const mesSiguiente = mesNum === 12 ? 1 : mesNum + 1;
  const anioFin = mesNum === 12 ? anioNum + 1 : anioNum;
  const fin = `${anioFin}-${String(mesSiguiente).padStart(2, "0")}-01 00:00:00`;

  const fechaAnt = new Date(anioNum, mesNum - 2, 1);
  const anioPrev = fechaAnt.getFullYear();
  const mesPrev = fechaAnt.getMonth() + 1;
  const inicioPrev = `${anioPrev}-${String(mesPrev).padStart(2, "0")}-01 00:00:00`;
  const finPrev = `${anioNum}-${String(mesNum).padStart(2, "0")}-01 00:00:00`;

  // ===============================
  // 📊 MES ACTUAL (ORDENES + FACTURAS)
  // ===============================
  const sqlActual = `
  SELECT
    x.usuario,
    SUM(x.unidades) AS unidades,
    SUM(x.dolares)  AS dolares,
    SUM(x.cant_ordenes)  AS cant_ordenes,
    SUM(x.cant_facturas) AS cant_facturas
  FROM (
    -- ORDENES
    SELECT
      o.seller_code AS usuario,
      SUM(dd.cantidad) AS unidades,
      SUM(dd.total) AS dolares,
      COUNT(DISTINCT o.code) AS cant_ordenes,
      0::int AS cant_facturas
    FROM ordenes o
    JOIN detalle_documento dd
      ON dd.documento_code = o.code
    WHERE
      dd.codigo_categoria = '7'
      AND o.status IN (2,4,5)
      AND o.seller_code ILIKE 'R%'
      AND o.fecha_creacion >= '${inicio}'
      AND o.fecha_creacion <  '${fin}'
    GROUP BY o.seller_code

    UNION ALL

    -- FACTURAS
    SELECT
      f.seller_code AS usuario,
      SUM(dd.cantidad) AS unidades,
      SUM(dd.total) AS dolares,
      0::int AS cant_ordenes,
      COUNT(DISTINCT f.code) AS cant_facturas
    FROM facturas f
    JOIN detalle_documento dd
      ON dd.documento_code = f.code
    WHERE
      dd.codigo_categoria = '7'
      AND f.status IN (2,4,5)
      AND f.seller_code ILIKE 'R%'
      AND f.fecha_creacion >= '${inicio}'
      AND f.fecha_creacion <  '${fin}'
    GROUP BY f.seller_code
  ) x
  GROUP BY x.usuario
  ORDER BY dolares DESC;
`;

  const actual = await sequelize.query(sqlActual, {
    type: Sequelize.QueryTypes.SELECT,
  });


  // ===============================
  // 📊 MES ANTERIOR (REAL) (ORDENES + FACTURAS)
  // ===============================
  const sqlPrev = `
  SELECT
    x.usuario,
    SUM(x.dolares) AS dolares
  FROM (
    -- ORDENES
    SELECT
      o.seller_code AS usuario,
      SUM(dd.total) AS dolares
    FROM ordenes o
    JOIN detalle_documento dd
      ON dd.documento_code = o.code
    WHERE
      dd.codigo_categoria = '7'
      AND o.status IN (2,4,5)
      AND o.seller_code ILIKE 'R%'
      AND o.fecha_creacion >= '${inicioPrev}'
      AND o.fecha_creacion <  '${finPrev}'
    GROUP BY o.seller_code

    UNION ALL

    -- FACTURAS
    SELECT
      f.seller_code AS usuario,
      SUM(dd.total) AS dolares
    FROM facturas f
    JOIN detalle_documento dd
      ON dd.documento_code = f.code
    WHERE
      dd.codigo_categoria = '7'
      AND f.status IN (2,4,5)
      AND f.seller_code ILIKE 'R%'
      AND f.fecha_creacion >= '${inicioPrev}'
      AND f.fecha_creacion <  '${finPrev}'
    GROUP BY f.seller_code
  ) x
  GROUP BY x.usuario;
`;

  const anterior = await sequelize.query(sqlPrev, {
    type: Sequelize.QueryTypes.SELECT,
  });

  const mapPrev = {};
  anterior.forEach(r => {
    mapPrev[r.usuario] = Number(r.dolares) || 0;
  });





  // ===============================
  // 🧮 CÁLCULOS FINALES
  // ===============================
  const rankingFinal = actual.map(r => {
    const montoActual = Number(r.dolares) || 0;
    const montoAnterior = mapPrev[r.usuario] || 0;

    // ✅ PROYECCIÓN CORRECTA
    const proyeccion = esMesActual && diasTranscurridos > 0
      ? (montoActual / diasTranscurridos) * diasLaborablesMes
      : montoActual;

    const variacionAbs = proyeccion - montoAnterior;
    const variacionPorc =
      montoAnterior > 0 ? (variacionAbs / montoAnterior) * 100 : null;

    return {
      usuario: r.usuario,
      unidades: Number(r.unidades),
      dolares: montoActual,
      meta: metasPorPreventa[r.usuario] || 0,
      proyeccion: Number(proyeccion.toFixed(2)),
      vsMesAnterior: {
        monto_anterior: Number(montoAnterior.toFixed(2)),
        variacion_abs: Number(variacionAbs.toFixed(2)),
        variacion_porc: variacionPorc !== null ? Number(variacionPorc.toFixed(2)) : null,
      },
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




// ======================================================
// 🆕 VENTAS DESCARTABLE POR CANAL (A, V desde FACTURAS + M desde ORDENES)
// ======================================================
const obtenerVentasDescartablePorCanal = async (fechaInicio, fechaFin) => {
  const sql = `
    SELECT
      o.seller_code,
      SUM(dd.cantidad) AS unidades,
      SUM(dd.total) AS dolares,
      'FACTURA' AS origen
    FROM facturas o
    JOIN detalle_documento dd
      ON dd.documento_code = o.code
    WHERE
      (
        o.seller_code ILIKE 'A%'  -- DOMICILIO
        OR o.seller_code ILIKE 'V%' -- VIP
        OR o.seller_code ILIKE 'M%' -- MAYORISTA
      )
      AND dd.codigo_categoria = '7'
      AND o.status IN ('2','4','5')
      AND o.fecha_entrega >= '${fechaInicio}'
      AND o.fecha_entrega <  '${fechaFin}'
    GROUP BY o.seller_code

    UNION ALL

    SELECT
      o.seller_code,
      SUM(dd.cantidad) AS unidades,
      SUM(dd.total) AS dolares,
      'ORDEN' AS origen
    FROM ordenes o
    JOIN detalle_documento dd
      ON dd.documento_code = o.code
    WHERE
      o.seller_code ILIKE 'M%'   -- MAYORISTA
      AND dd.codigo_categoria = '7'
      AND o.status IN ('2','4','5')
      AND o.fecha_entrega >= '${fechaInicio}'
      AND o.fecha_entrega <  '${fechaFin}'
    GROUP BY o.seller_code
    ORDER BY seller_code;
  `;

  return await sequelize.query(sql, {
    type: Sequelize.QueryTypes.SELECT
  });
};


const MetasHistoricasDescartablePorCanal = async () => {
  const sql = `
    SELECT sub.seller_code, 
       MAX(sub.total_mes) AS meta_historica,
       mes_max_consumo.mes AS mes_mayor_consumo
      FROM (
          SELECT 
              o.seller_code,
              DATE_TRUNC('month', o.fecha_entrega) AS mes,
              SUM(dd.total) AS total_mes
          FROM facturas o
          JOIN detalle_documento dd 
              ON dd.documento_code = o.code
          WHERE dd.codigo_categoria = '7'
              AND o.status IN (2,4,5)
              AND o.seller_code IN ('A1', 'A2', 'A3', 'A4.1', 'A5', 'A6', 'V1', 'V2', 'V3', 'V4', 'V5', 'V6')
          GROUP BY o.seller_code, DATE_TRUNC('month', o.fecha_entrega)

          UNION ALL

          SELECT 
              o.seller_code,
              DATE_TRUNC('month', o.fecha_entrega) AS mes,
              SUM(dd.total) AS total_mes
          FROM ordenes o
          JOIN detalle_documento dd 
              ON dd.documento_code = o.code
          WHERE dd.codigo_categoria = '7'
              AND o.status IN (2,4,5)
              AND o.seller_code = 'M6'  -- Solo M6 de las órdenes
          GROUP BY o.seller_code, DATE_TRUNC('month', o.fecha_entrega)
      ) AS sub
      -- Obtener el mes con mayor total
      LEFT JOIN (
          SELECT seller_code, 
                mes,
                total_mes,
                RANK() OVER (PARTITION BY seller_code ORDER BY total_mes DESC) AS rank
          FROM (
              SELECT 
                  o.seller_code,
                  DATE_TRUNC('month', o.fecha_entrega) AS mes,
                  SUM(dd.total) AS total_mes
              FROM facturas o
              JOIN detalle_documento dd 
                  ON dd.documento_code = o.code
              WHERE dd.codigo_categoria = '7'
                  AND o.status IN (2,4,5)
                  AND o.seller_code IN ('A1', 'A2', 'A3', 'A4.1', 'A5', 'A6', 'V1', 'V2', 'V3', 'V4', 'V5', 'V6')
              GROUP BY o.seller_code, DATE_TRUNC('month', o.fecha_entrega)

              UNION ALL

              SELECT 
                  o.seller_code,
                  DATE_TRUNC('month', o.fecha_entrega) AS mes,
                  SUM(dd.total) AS total_mes
              FROM ordenes o
              JOIN detalle_documento dd 
                  ON dd.documento_code = o.code
              WHERE dd.codigo_categoria = '7'
                  AND o.status IN (2,4,5)
                  AND o.seller_code = 'M6'  -- Solo M6 de las órdenes
              GROUP BY o.seller_code, DATE_TRUNC('month', o.fecha_entrega)
          ) AS sub2
      ) AS mes_max_consumo
      ON sub.seller_code = mes_max_consumo.seller_code 
      AND mes_max_consumo.rank = 1
      GROUP BY sub.seller_code, mes_max_consumo.mes;

  `;

  const filas = await sequelize.query(sql, { type: Sequelize.QueryTypes.SELECT });

  const mapa = {};
  filas.forEach(f => mapa[f.seller_code] = {
    meta_historica: Number(f.meta_historica),
    mes_mayor_consumo: f.mes_mayor_consumo
  });

  return mapa;
};



// Obtener los datos del mes anterior
const obtenerVentasDescartablePorCanalMesAnterior = async (fechaInicio, fechaFin) => {
  const sql = `
    SELECT
      o.seller_code,
      SUM(dd.cantidad) AS unidades,
      SUM(dd.total) AS dolares,
      'FACTURA' AS origen
    FROM facturas o
    JOIN detalle_documento dd
      ON dd.documento_code = o.code
    WHERE
      (
        o.seller_code ILIKE 'A%'  -- DOMICILIO
        OR o.seller_code ILIKE 'V%' -- VIP
        OR o.seller_code ILIKE 'M%' -- MAYORISTA
      )
      AND dd.codigo_categoria = '7'
      AND o.status IN ('2','4','5')
      AND o.fecha_entrega >= '${fechaInicio}'
      AND o.fecha_entrega <  '${fechaFin}'
    GROUP BY o.seller_code

    UNION ALL

    SELECT
      o.seller_code,
      SUM(dd.cantidad) AS unidades,
      SUM(dd.total) AS dolares,
      'ORDEN' AS origen
    FROM ordenes o
    JOIN detalle_documento dd
      ON dd.documento_code = o.code
    WHERE
      o.seller_code = 'M6'  -- Solo M6 de las órdenes
      AND dd.codigo_categoria = '7'
      AND o.status IN ('2','4','5')
      AND o.fecha_entrega >= '${fechaInicio}'
      AND o.fecha_entrega <  '${fechaFin}'
    GROUP BY o.seller_code
  `;

  return await sequelize.query(sql, {
    type: Sequelize.QueryTypes.SELECT
  });
};


// Función para obtener metas, proyección y comparación con el mes anterior
const calcularVentasDescartableConComparativa = async (anioNum, mesNum) => {

  // ==========================
  // 📅 MES ACTUAL
  // ==========================
  const fechaInicioMesActual = `${anioNum}-${String(mesNum).padStart(2, "0")}-01 00:00:00`;

  let mesSiguiente = mesNum + 1;
  let anioFin = anioNum;

  if (mesSiguiente === 13) {
    mesSiguiente = 1;
    anioFin++;
  }

  const fechaFinMesActual = `${anioFin}-${String(mesSiguiente).padStart(2, "0")}-01 00:00:00`;

  // Ventas mes actual
  const ventasActuales = await obtenerVentasDescartablePorCanal(
    fechaInicioMesActual,
    fechaFinMesActual
  );

  // ==========================
  // 📅 MES ANTERIOR (CORREGIDO)
  // ==========================
  let mesAnterior = mesNum - 1;
  let anioAnterior = anioNum;

  if (mesAnterior === 0) {
    mesAnterior = 12;
    anioAnterior--;
  }

  const fechaInicioMesAnterior = `${anioAnterior}-${String(mesAnterior).padStart(2, "0")}-01 00:00:00`;
  const fechaFinMesAnterior = `${anioNum}-${String(mesNum).padStart(2, "0")}-01 00:00:00`;

  const ventasMesAnterior = await obtenerVentasDescartablePorCanalMesAnterior(
    fechaInicioMesAnterior,
    fechaFinMesAnterior
  );

  // ==========================
  // 📊 DÍAS LABORALES
  // ==========================
  const festivos = [];
  const diasTranscurridos = getDiasHabilesTranscurridos(anioNum, mesNum, festivos);
  const diasLaborablesMes = getDiasLaborablesMes(anioNum, mesNum, festivos);

  // ==========================
  // 📈 METAS Y PROYECCIÓN
  // ==========================
  const metasPorPreventa = await MetasHistoricasDescartablePorCanal();
  const metasProyectadas = {};

  ventasActuales.forEach((venta) => {
    const preventa = venta.seller_code;

    const metaHistorica = metasPorPreventa[preventa] || 0;

    const montoActual = Number(venta.dolares) || 0;
    const proyeccion = diasTranscurridos > 0
      ? (montoActual / diasTranscurridos) * diasLaborablesMes
      : 0;

    const ventaAnterior = ventasMesAnterior.find(
      v => v.seller_code === preventa
    );

    const montoAnterior = ventaAnterior
      ? Number(ventaAnterior.dolares) || 0
      : 0;

    const variacionAbs = montoActual - montoAnterior;
    const variacionPorc =
      montoAnterior > 0 ? (variacionAbs / montoAnterior) * 100 : null;

    metasProyectadas[preventa] = {
      ...venta,
      meta: metaHistorica,
      proyeccion: Number(proyeccion.toFixed(2)),
      vsMesAnterior: {
        monto_anterior: Number(montoAnterior.toFixed(2)),
        variacion_abs: Number(variacionAbs.toFixed(2)),
        variacion_porc: variacionPorc !== null
          ? Number(variacionPorc.toFixed(2))
          : null
      }
    };
  });

  return metasProyectadas;
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
//  TODOS LOS PRODUCTOS VENDIDOS POR PREVENTA (MES ACTUAL)
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

  console.log("📊 RESULTADOS PREVENTA:", resultadosSQL);

  // =============================
  // 🔥 METAS Y PROYECCIÓN NUEVA
  // =============================
  const metasPorPreventa = await obtenerMetasHistoricasPreventas();
  const metaGlobal = await obtenerMetaHistoricaGlobal();



  const hoy = new Date();
  const mesActual = hoy.getMonth() + 1;
  const anioActual = hoy.getFullYear();


  const esMesCerrado =
    anioNum < anioActual ||
    (anioNum === anioActual && mesNum < mesActual);


  // const hoy = new Date();
  // const esMesActual = hoy.getFullYear() === anioNum && (hoy.getMonth() + 1) === mesNum;
  const diasTranscurridos = getDiasHabilesTranscurridos(anioNum, mesNum, festivos);
  console.log("📅 Días hábiles transcurridos:", diasTranscurridos);

  const diasLaborablesMes = getDiasLaborablesMes(anioNum, mesNum, festivos);


  let rankingPreventasSQL = resultadosSQL.map(r => {
    const preventa = r.preventa;
    const unidades = Number(r.sum_quantity);
    const monto = Number(r.sum_total);

    // Meta histórica de esta ruta
    const metaHistorica = metasPorPreventa[preventa] || 0;

    const proyeccion = esMesCerrado
      ? monto
      : (monto / diasTranscurridos) * diasLaborablesMes;


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
  // Usar la meta mensual fija directamente en lugar de dividir por 12
  const metaMensualUnidades = META_MENSUAL_UNIDADES_PREVENTA; // 70,000 unidades como meta mensual
  const metaMensualDolares = META_MENSUAL_USD_PREVENTA; // 200,000 USD como meta mensual

  // Cálculo del cumplimiento de la meta mensual de unidades
  const cumplimientoUnidadesMensual =
    metaMensualUnidades > 0
      ? (unidadesTotalesSQL / metaMensualUnidades) * 100
      : 0;

  // Cálculo del cumplimiento de la meta mensual en dólares
  const cumplimientoUSDMensual =
    metaMensualDolares > 0
      ? (montoTotalSQL / metaMensualDolares) * 100
      : 0;


  //console.log("🎯 Cumplimiento Mensual Unidades:", cumplimientoUnidadesMensual);
  //console.log("🎯 Cumplimiento Mensual USD:", cumplimientoUSDMensual);


  // ======================================================
  // 🆕 VENTAS DESCARTABLE POR CANAL (DOMICILIO / VIP / MAYORISTA)
  // ======================================================
  const ventasDescartablePorCanal = await obtenerVentasDescartablePorCanal(
    fechaInicioStr,
    fechaFinStr
  );


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
    },

    rankingPreventas: rankingPreventasSQL,
    rankingRutasR,
    topClientes: top20Final,

    ventaPorProducto,  //  AQUI VA EL NUEVO MODULO


    //  NUEVO DATASET
    ventasDescartablePorCanal,

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




// ======================================================
// 🆕 AGRUPAR DESCARTABLE POR CANAL (CARDS DASHBOARD)
// ======================================================
const agruparDescartablePorCanalResumen = (ventasPorPreventa = {}) => {
  const resumen = {
    DOMICILIO: {
      canal: "DOMICILIO",
      unidades: 0,
      monto: 0,
      mesAnterior: 0,
      variacionAbs: 0,
      variacionPorc: 0,
    },
    MAYORISTA: {
      canal: "MAYORISTA",
      unidades: 0,
      monto: 0,
      mesAnterior: 0,
      variacionAbs: 0,
      variacionPorc: 0,
    },
    VIP: {
      canal: "VIP",
      unidades: 0,
      monto: 0,
      mesAnterior: 0,
      variacionAbs: 0,
      variacionPorc: 0,
    },
  };

  Object.values(ventasPorPreventa).forEach((v) => {
    const seller = v.seller_code || "";

    let canal = null;
    if (seller.startsWith("A")) canal = "DOMICILIO";
    else if (seller.startsWith("M")) canal = "MAYORISTA";
    else if (seller.startsWith("V")) canal = "VIP";

    if (!canal) return;

    resumen[canal].unidades += Number(v.unidades || 0);
    resumen[canal].monto += Number(v.dolares || 0);
    resumen[canal].mesAnterior += Number(
      v.vsMesAnterior?.monto_anterior || 0
    );
  });

  Object.keys(resumen).forEach((c) => {
    const r = resumen[c];
    r.variacionAbs = r.monto - r.mesAnterior;
    r.variacionPorc =
      r.mesAnterior > 0 ? (r.variacionAbs / r.mesAnterior) * 100 : null;
  });

  return resumen;
};



// ======================================================
// 🆕 RESUMIR RANKING (TIENDAS / RURAL) PARA CARDS
// ======================================================
const resumirRankingParaCard = (ranking = [], canal) => {
  const resumen = {
    canal,
    unidades: 0,
    monto: 0,
    mesAnterior: 0,
    variacionAbs: 0,
    variacionPorc: 0
  };

  ranking.forEach(r => {
    resumen.unidades += Number(r.unidades || 0);
    resumen.monto += Number(r.proyeccion || r.monto || 0);

    if (r.vsMesAnterior) {
      resumen.mesAnterior += Number(r.vsMesAnterior.monto_anterior || 0);
    }
  });

  resumen.variacionAbs = resumen.monto - resumen.mesAnterior;
  resumen.variacionPorc =
    resumen.mesAnterior > 0
      ? (resumen.variacionAbs / resumen.mesAnterior) * 100
      : null;

  return resumen;
};



// ===================================
//  Endpoint Dashboard Preventas
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
    // 🆕 Agregar los datos de ventas descartables con metas, proyección y vsMesAnterior
    // ======================================================
    const ventasDescartableConComparativa = await calcularVentasDescartableConComparativa(anioNum, mesNum);

    const resumenDescartablePorCanal =
      agruparDescartablePorCanalResumen(ventasDescartableConComparativa);


    // ======================================================
    // 🆕 RESUMEN UNIFICADO POR CANAL (CARDS DASHBOARD)
    // ======================================================
    const resumenVentasPorCanal = {
      TIENDAS: resumirRankingParaCard(
        resumenActual.rankingPreventas,
        "TIENDAS"
      ),

      RURAL: resumirRankingParaCard(
        resumenActual.rankingRutasR,
        "RURAL"
      ),

      ...resumenDescartablePorCanal
    };



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
      precioPromedioTabla,

      // ============================
      // 📊 TABLA (detalle por preventa)
      // ============================
      ventasDescartablePorCanal: ventasDescartableConComparativa,

      // ============================
      // 🧱 CARDS DASHBOARD (UNIFICADAS)
      // ============================
      resumenVentasPorCanal
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
