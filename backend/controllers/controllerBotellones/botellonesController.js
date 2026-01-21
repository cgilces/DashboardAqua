const {
  Orden,
  Factura,
  DetalleDocumento,
} = require("../../models");

const Sequelize = require("sequelize");
const { sequelize } = require("../../models");

/* ======================================================
   CONFIGURACIÓN DE GRUPOS BOTELLÓN
====================================================== */
const GRUPOS = {
  DOMICILIO: {
    campo: "o.route_code",
    filtro: "o.route_code ILIKE 'A%'",
  },
  EMPRESAS: {
    campo: "o.seller_code",
    filtro: "o.seller_code ILIKE 'E%'",
  },
  MAYORISTA: {
    campo: "o.seller_code",
    filtro: "o.seller_code ILIKE 'M%'",
  },
  QUITO: {
    campo: "o.seller_code",
    filtro: "o.seller_code = 'U1'",
  },
  RURAL: {
    campo: "o.seller_code",
    filtro: "o.seller_code ILIKE 'R%'",
  },
  TELEVENTA_VIP: {
    campo: "o.seller_code",
    filtro: "o.seller_code ILIKE '148399%'",
  },
  TIENDAS: {
    campo: "o.seller_code",
    filtro: "o.seller_code ILIKE 'T%' AND o.seller_code NOT ILIKE 'TV%'",
  },
  TIENDAS_VIP: {
    campo: "o.seller_code",
    filtro: "o.seller_code ILIKE 'TV%'",
  },
  VIP: {
    campo: "o.seller_code",
    filtro: "(o.seller_code ILIKE 'V%' OR o.seller_code IN ('10','18','27'))",
  },
};

/* ======================================================
   RANGO DE FECHAS
====================================================== */
const getRangoFechas = (anio, mes) => {
  const inicio = `${anio}-${String(mes).padStart(2, "0")}-01 00:00:00`;
  const mesSig = mes === 12 ? 1 : mes + 1;
  const anioSig = mes === 12 ? anio + 1 : anio;
  const fin = `${anioSig}-${String(mesSig).padStart(2, "0")}-01 00:00:00`;
  return { inicio, fin };
};

/* ======================================================
   META HISTÓRICA BOTELLÓN (USD + MES)
====================================================== */
const metaHistoricaBotellon = async () => {
  const [rows] = await sequelize.query(`
   WITH ventas_base AS (

  /* ===================== ORDENES ===================== */
  SELECT
    CASE
      WHEN o.seller_code ILIKE 'M%'  THEN 'MAYORISTA'
      WHEN o.seller_code ILIKE 'TV%' THEN 'TIENDAS_VIP'
      WHEN o.seller_code ILIKE 'T%'  AND o.seller_code NOT ILIKE 'TV%' THEN 'TIENDAS'
      WHEN o.seller_code ILIKE 'R%'  THEN 'RURAL'
      WHEN o.seller_code = '148399'  THEN 'TELEVENTA_VIP'
    END AS grupo,
    o.seller_code AS codigo,
    DATE_TRUNC('month', o.fecha_creacion) AS mes,
    SUM(dd.total) AS total_usd
  FROM ordenes o
  JOIN detalle_documento dd
    ON dd.documento_code = o.code
  WHERE
    o.status IN (2,4,5)
    AND dd.descripcion_categoria = 'BOTELLÓN'
    AND (
      o.seller_code ILIKE 'M%'
      OR o.seller_code ILIKE 'TV%'
      OR (o.seller_code ILIKE 'T%' AND o.seller_code NOT ILIKE 'TV%')
      OR o.seller_code ILIKE 'R%'
      OR o.seller_code = '148399'
    )
  GROUP BY grupo, o.seller_code, DATE_TRUNC('month', o.fecha_creacion)

  UNION ALL

  /* ===================== FACTURAS ===================== */
  SELECT
    CASE
      WHEN f.seller_code ILIKE 'M%'  THEN 'MAYORISTA'
      WHEN f.seller_code ILIKE 'A%'  THEN 'DOMICILIO'
      WHEN f.seller_code ILIKE 'E%'  THEN 'EMPRESAS'
      WHEN f.seller_code ILIKE 'R%'  THEN 'RURAL'
      WHEN f.seller_code ILIKE 'TV%' THEN 'TIENDAS_VIP'
      WHEN f.seller_code ILIKE 'T%'  AND f.seller_code NOT ILIKE 'TV%' THEN 'TIENDAS'
      WHEN f.seller_code ILIKE 'V%'  THEN 'VIP'
      WHEN f.seller_code IN ('10','18','27') THEN 'VIP'
      WHEN f.seller_code = 'U1'      THEN 'QUITO'
    END AS grupo,
    f.seller_code AS codigo,
    DATE_TRUNC('month', f.fecha_entrega) AS mes,
    SUM(dd.total) AS total_usd
  FROM facturas f
  JOIN detalle_documento dd
    ON dd.documento_code = f.code
  WHERE
    f.status IN (2,4,5)
    AND dd.descripcion_categoria = 'BOTELLÓN'
  GROUP BY grupo, f.seller_code, DATE_TRUNC('month', f.fecha_entrega)
),

/* 🔥 AQUÍ ESTÁ LA DIFERENCIA CLAVE */
ventas_mensuales AS (
  SELECT
    grupo,
    codigo,
    mes,
    SUM(total_usd) AS total_usd
  FROM ventas_base
  GROUP BY grupo, codigo, mes
),

ranking AS (
  SELECT
    grupo,
    codigo,
    mes,
    total_usd,
    ROW_NUMBER() OVER (
      PARTITION BY grupo, codigo
      ORDER BY total_usd DESC
    ) AS rn
  FROM ventas_mensuales
)

SELECT
  grupo,
  codigo,
  total_usd AS meta_historica_usd,
  mes AS mes_meta_historica
FROM ranking
WHERE rn = 1
ORDER BY grupo, codigo;

  `);

  return rows;
};

/* ======================================================
   DÍAS HÁBILES (L–S)
====================================================== */
const getDiasHabilesTranscurridos = (anio, mes) => {
  const hoy = new Date();
  const ultimoDia =
    hoy.getFullYear() === anio && hoy.getMonth() + 1 === mes
      ? hoy.getDate() - 1
      : new Date(anio, mes, 0).getDate();

  let habiles = 0;

  for (let d = 1; d <= ultimoDia; d++) {
    const fecha = new Date(anio, mes - 1, d);
    if (fecha.getDay() !== 0) habiles++;
  }
  return habiles;
};

const getDiasLaborablesMes = (anio, mes) => {
  const diasMes = new Date(anio, mes, 0).getDate();
  let total = 0;

  for (let d = 1; d <= diasMes; d++) {
    const fecha = new Date(anio, mes - 1, d);
    if (fecha.getDay() !== 0) total++;
  }
  return total;
};

/* ======================================================
   CONSULTA POR GRUPO BOTELLÓN
====================================================== */
// const obtenerGrupoBotellon = async (config, anio, mes) => {
const obtenerGrupoBotellon = async (nombreGrupo, anio, mes) => {

  const { inicio, fin } = getRangoFechas(anio, mes);

  const { inicio: inicioAnt, fin: finAnt } = getRangoFechas(
    mes === 1 ? anio - 1 : anio,
    mes === 1 ? 12 : mes - 1
  );

  const diasTrans = getDiasHabilesTranscurridos(anio, mes);
  const diasMes = getDiasLaborablesMes(anio, mes);



  const sql = `
SELECT
  grupo,
  codigo,
  SUM(unidades) AS unidades,
  SUM(dolares)  AS dolares
FROM (

  /* ===================== ORDENES ===================== */
  SELECT
    CASE
      WHEN o.seller_code ILIKE 'M%'  THEN 'MAYORISTA'
      WHEN o.seller_code ILIKE 'TV%' THEN 'TIENDAS_VIP'
      WHEN o.seller_code ILIKE 'T%'  AND o.seller_code NOT ILIKE 'TV%' THEN 'TIENDAS'
      WHEN o.seller_code ILIKE 'R%'  THEN 'RURAL'
      WHEN o.seller_code = '148399'  THEN 'TELEVENTA_VIP'
      -- ⚠️ VIP EXCLUIDO A PROPÓSITO (solo facturas)
    END AS grupo,
    o.seller_code AS codigo,
    SUM(dd.cantidad) AS unidades,
    SUM(dd.total) AS dolares
  FROM ordenes o
  JOIN detalle_documento dd
    ON dd.documento_code = o.code
  WHERE
    o.status IN (2,4,5)
    AND dd.descripcion_categoria = 'BOTELLÓN'
    AND (
      o.seller_code ILIKE 'M%'
      OR o.seller_code ILIKE 'TV%'
      OR (o.seller_code ILIKE 'T%' AND o.seller_code NOT ILIKE 'TV%')
      OR o.seller_code ILIKE 'R%'
      OR o.seller_code = '148399'
    )
    AND o.fecha_creacion >= :inicio
    AND o.fecha_creacion <  :fin
  GROUP BY grupo, o.seller_code

  UNION ALL

  /* ===================== FACTURAS ===================== */
  SELECT
    CASE
      WHEN f.seller_code ILIKE 'M%'  THEN 'MAYORISTA'
      WHEN f.seller_code ILIKE 'A%'  THEN 'DOMICILIO'
      WHEN f.seller_code ILIKE 'E%'  THEN 'EMPRESAS'
      WHEN f.seller_code ILIKE 'R%'  THEN 'RURAL'
      WHEN f.seller_code ILIKE 'TV%' THEN 'TIENDAS_VIP'
      WHEN f.seller_code ILIKE 'T%'  AND f.seller_code NOT ILIKE 'TV%' THEN 'TIENDAS'
      WHEN f.seller_code ILIKE 'V%'  THEN 'VIP'
      WHEN f.seller_code IN ('10','18','27') THEN 'VIP'
      WHEN f.seller_code = 'U1'      THEN 'QUITO'
      ELSE 'OTROS'
    END AS grupo,
    f.seller_code AS codigo,
    SUM(dd.cantidad) AS unidades,
    SUM(dd.total) AS dolares
  FROM facturas f
  JOIN detalle_documento dd
    ON dd.documento_code = f.code
  WHERE
    f.status IN (2,4,5)
    AND dd.descripcion_categoria = 'BOTELLÓN'
    AND f.fecha_entrega >= :inicio
    AND f.fecha_entrega <  :fin
  GROUP BY grupo, f.seller_code

) t
WHERE grupo = :grupo
GROUP BY grupo, codigo
ORDER BY codigo;

`;





  // const sql =
  //   `
  //     SELECT
  //     codigo,
  //     SUM(unidades) AS unidades,
  //     SUM(dolares)  AS dolares
  //   FROM (

  //     SELECT
  //       o.seller_code AS codigo,
  //       SUM(dd.cantidad) AS unidades,
  //       SUM(dd.total) AS dolares
  //     FROM ordenes o
  //     JOIN detalle_documento dd
  //       ON dd.documento_code = o.code
  //     WHERE
  //       o.status IN (2,4,5)
  //       AND dd.descripcion_categoria = 'BOTELLÓN'
  //       AND o.seller_code ILIKE 'M%'
  //       AND o.fecha_creacion >= DATE '2025-12-01'
  //       AND o.fecha_creacion <  DATE '2026-01-01'
  //     GROUP BY o.seller_code

  //     UNION ALL

  //     SELECT
  //       f.seller_code AS codigo,
  //       SUM(dd.cantidad) AS unidades,
  //       SUM(dd.total) AS dolares
  //     FROM facturas f
  //     JOIN detalle_documento dd
  //       ON dd.documento_code = f.code
  //     WHERE
  //       f.status IN (2,4,5)
  //       AND dd.descripcion_categoria = 'BOTELLÓN'
  //       AND (
  //         f.seller_code ILIKE 'A%'                      -- DOMICILIO
  //         OR f.seller_code ILIKE 'E%'                   -- EMPRESAS
  //         OR f.seller_code ILIKE 'R%'                   -- RURAL
  //         OR (f.seller_code ILIKE 'T%' AND f.seller_code NOT ILIKE 'TV%') -- TIENDAS
  //         OR f.seller_code ILIKE 'TV%'                  -- TIENDAS VIP
  //         OR f.seller_code ILIKE 'V%'                   -- VIP
  //         OR f.seller_code IN ('10','18','27')          -- VIP especiales
  //         OR f.seller_code = 'U1'                       -- QUITO
  //         OR f.seller_code = '148399'                   -- TELEVENTA VIP
  //       )
  //       AND f.fecha_entrega >= DATE '2025-12-01'
  //       AND f.fecha_entrega <  DATE '2026-01-01'
  //     GROUP BY f.seller_code

  //   ) t
  //   GROUP BY codigo
  //   ORDER BY codigo;   
  // `;

  const actual = await sequelize.query(sql, {
    replacements: { inicio, fin, grupo: nombreGrupo },
    type: Sequelize.QueryTypes.SELECT,
  });

  const anterior = await sequelize.query(sql, {
    replacements: {
      inicio: inicioAnt,
      fin: finAnt,
      grupo: nombreGrupo,
    },
    type: Sequelize.QueryTypes.SELECT,
  });


  const mapAnterior = {};
  anterior.forEach(r => mapAnterior[r.codigo] = Number(r.dolares) || 0);

  const metas = await metaHistoricaBotellon();

  return {
    total: {
      unidades: actual.reduce((a, r) => a + Number(r.unidades), 0),
      dolares: actual.reduce((a, r) => a + Number(r.dolares), 0),
    },
    detalle: actual.map(r => {
      const ant = mapAnterior[r.codigo] || 0;
      const variacionAbs = r.dolares - ant;
      const variacionPorc = ant > 0 ? (variacionAbs / ant) * 100 : null;

      const proyeccion =
        diasTrans > 0 ? (r.dolares / diasTrans) * diasMes : 0;

      const meta = metas.find(m => m.codigo === r.codigo);

      return {
        codigo: r.codigo,
        unidades: Number(r.unidades),
        dolares: Number(r.dolares),
        meta: {
          meta_historica: meta
            ? Number(meta.meta_historica_usd).toFixed(2)
            : "0.00",
          mes_mayor_consumo: meta?.mes_meta_historica || null,
        },

        proyeccion: Number(proyeccion.toFixed(2)),
        vsMesAnterior: {
          monto_anterior: ant,
          variacion_abs: Number(variacionAbs.toFixed(2)),
          variacion_porc: variacionPorc !== null ? Number(variacionPorc.toFixed(2)) : null,
        },
      };
    }),
  };
};

/* ======================================================
   CONTROLLER EXPRESS
====================================================== */
const obtenerDashboardBotellones = async (req, res) => {
  try {
    const { anio, mes } = req.query;

    if (!anio || !mes) {
      return res.status(400).json({ error: "anio y mes requeridos" });
    }

    const anioNum = Number(anio);
    const mesNum = Number(mes);

    const botellones = {};

    for (const nombre of Object.keys(GRUPOS)) {

      botellones[nombre] = await obtenerGrupoBotellon(
        nombre,
        anioNum,
        mesNum
      );
    }

    return res.json({
      anio: anioNum,
      mes: mesNum,
      botellones,
    });
  } catch (error) {
    console.error("❌ ERROR BOTELLONES:", error);
    res.status(500).json({ message: "Error dashboard botellones" });
  }
};

module.exports = {
  obtenerDashboardBotellones,
};
