const {
  Orden,
  Factura,
  DetalleDocumento,
} = require("../../models");

const Sequelize = require("sequelize");
const { sequelize } = require("../../models");
const MetaPreventa = require("../../models/metaPreventa");
const { getDiasHabilesTranscurridos, getDiasLaborablesMes } = require('../../utils/diasFestivos');

// Secciones que tienen metas configurables (solo autoventas)
const SECCIONES_CON_METAS = ["TIENDAS_VIP", "TIENDAS", "MAYORISTA", "RURAL"];

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
    campo: "f.codigo_tipo_negocio",
    filtro: "f.codigo_tipo_negocio = '29'",
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
        AND o.origen_sistema = 'MOBILVENDOR'
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
          WHEN f.codigo_tipo_negocio = '29' THEN 'VIP'
          WHEN f.seller_code = 'U1'      THEN 'QUITO'
        END AS grupo,
        f.seller_code AS codigo,
        DATE_TRUNC('month', CASE WHEN f.codigo_tipo_negocio = '29' THEN f.fecha_creacion ELSE f.fecha_entrega END) AS mes,
        SUM(dd.total) AS total_usd
      FROM facturas f
      JOIN detalle_documento dd
        ON dd.documento_code = f.code
      WHERE
        f.status IN (0,2,3,4,5)
        AND dd.descripcion_categoria = 'BOTELLÓN'
      GROUP BY grupo, f.seller_code, DATE_TRUNC('month', CASE WHEN f.codigo_tipo_negocio = '29' THEN f.fecha_creacion ELSE f.fecha_entrega END)
    ),

    /*  AQUÍ ESTÁ LA DIFERENCIA CLAVE */
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
   DÍAS HÁBILES — importados de utils/diasFestivos.js
   (lunes–sábado, excluyendo festivos nacionales)
====================================================== */

const obtenerGrupoBotellon = async (nombreGrupo, anio, mes, metasConfigMap = {}, rutasPermitidas = null) => {
  const hoyDate = new Date();
  const esMesActual = hoyDate.getFullYear() === anio && hoyDate.getMonth() + 1 === mes;

  const { inicio, fin: finFull } = getRangoFechas(anio, mes);
  // Para el mes actual, cortamos en hoy 00:00:00 para ser consistentes con diasTranscurridos
  const finHoy = `${hoyDate.getFullYear()}-${String(hoyDate.getMonth() + 1).padStart(2, '0')}-${String(hoyDate.getDate()).padStart(2, '0')} 00:00:00`;
  const fin = esMesActual ? finHoy : finFull;

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
      END AS grupo,
      o.seller_code AS codigo,
      SUM(dd.cantidad) AS unidades,
      SUM(dd.total) AS dolares
    FROM ordenes o
    JOIN detalle_documento dd
      ON dd.documento_code = o.code
    WHERE
      o.status IN (2,4,5)
      AND o.origen_sistema = 'MOBILVENDOR'
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
        WHEN f.codigo_tipo_negocio = '29' THEN 'VIP'
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
      AND (
        (f.codigo_tipo_negocio != '29' AND f.fecha_entrega  >= :inicio AND f.fecha_entrega  < :fin)
        OR
        (f.codigo_tipo_negocio  = '29' AND f.fecha_creacion >= :inicio AND f.fecha_creacion < :fin)
      )
    GROUP BY grupo, f.seller_code
  ) t
  WHERE grupo = :grupo
  GROUP BY grupo, codigo
  ORDER BY codigo;
  `;

  // Ventas actuales
  let actual = await sequelize.query(sql, {
    replacements: { inicio, fin, grupo: nombreGrupo },
    type: Sequelize.QueryTypes.SELECT,
  });

  // Ventas del mes anterior
  let anterior = await sequelize.query(sql, {
    replacements: {
      inicio: inicioAnt,
      fin: finAnt,
      grupo: nombreGrupo,
    },
    type: Sequelize.QueryTypes.SELECT,
  });

  // ── Filtrar por rutas permitidas si VENDEDOR ──────────────────
  if (rutasPermitidas) {
    actual   = actual.filter(r => rutasPermitidas.includes((r.codigo || '').toUpperCase()));
    anterior = anterior.filter(r => rutasPermitidas.includes((r.codigo || '').toUpperCase()));
  }

  // Mapeo de ventas del mes anterior por código de ruta
  const mapAnterior = {};
  anterior.forEach(r => mapAnterior[r.codigo] = {
    dolares: Number(r.dolares) || 0,
    unidades: Number(r.unidades) || 0
  });

  const metas = await metaHistoricaBotellon();

  // Total de ventas (actual + mes anterior) con sus respectivas variaciones
  const totalActual = actual.reduce((acc, r) => {
    acc.unidades += Number(r.unidades);
    acc.dolares += Number(r.dolares);
    return acc;
  }, { unidades: 0, dolares: 0 });

  // Calcular el total del mes anterior
  const totalAnterior = {
    unidades: anterior.reduce((acc, r) => acc + (mapAnterior[r.codigo]?.unidades || 0), 0),
    dolares: anterior.reduce((acc, r) => acc + (mapAnterior[r.codigo]?.dolares || 0), 0)
  };

  // Proyección del total (usa real si mes cerrado o diasTrans=0)
  const proyeccionTotalDolares = esMesActual && diasTrans > 0
    ? (totalActual.dolares / diasTrans) * diasMes
    : totalActual.dolares;
  const proyeccionTotalUnidades = esMesActual && diasTrans > 0
    ? Math.round((totalActual.unidades / diasTrans) * diasMes)
    : totalActual.unidades;

  // Variación: proyección vs mes anterior
  const variacionAbs = proyeccionTotalDolares - totalAnterior.dolares;
  const variacionPorc = totalAnterior.dolares > 0 ? (variacionAbs / totalAnterior.dolares) * 100 : 0;

  const variacionAbsUnidades = proyeccionTotalUnidades - totalAnterior.unidades;
  const variacionPorcUnidades =
    totalAnterior.unidades > 0 ? (variacionAbsUnidades / totalAnterior.unidades) * 100 : null;

  return {
    total: {
      unidades: totalActual.unidades,
      dolares: totalActual.dolares,
      mesAnterior: {
        dolares: totalAnterior.dolares,
        variacionAbs:         Number(variacionAbs.toFixed(2)),
        variacionPorc:        Number(variacionPorc.toFixed(2)),
        unidades: totalAnterior.unidades,
        variacionAbsUnidades: Math.round(variacionAbsUnidades),
        variacionPorcUnidades: variacionPorcUnidades !== null ? Number(variacionPorcUnidades.toFixed(2)) : null,
      }
    },
    detalle: actual.map(r => {
      const ant = mapAnterior[r.codigo] || { dolares: 0, unidades: 0 };
      // const variacionAbs = r.dolares - ant.dolares;
      const dolaresActual = Number(r.dolares) || 0;
      const variacionAbs = dolaresActual - ant.dolares;
      const variacionPorc = ant.dolares > 0 ? (variacionAbs / ant.dolares) * 100 : null;

      const proyeccionDolares = diasTrans > 0 ? (r.dolares / diasTrans) * diasMes : 0;

      const proyeccionUnidades = diasTrans > 0 ? (r.unidades / diasTrans) * diasMes : 0;

      const meta       = metas.find(m => m.codigo === r.codigo);
      const metaConfig = metasConfigMap[r.codigo.toUpperCase()];

      const variacionAbsUnidadesDet = Number(r.unidades) - (ant.unidades || 0);
      const variacionPorcUnidadesDet =
        (ant.unidades || 0) > 0 ? (variacionAbsUnidadesDet / ant.unidades) * 100 : null;

      return {
        codigo: r.codigo,
        unidades: Number(r.unidades),
        dolares: Number(r.dolares),
        meta: {
          meta_historica:    meta ? Number(meta.meta_historica_usd).toFixed(2) : "0.00",
          mes_mayor_consumo: meta?.mes_meta_historica || null,
        },
        cupo: metaConfig
          ? {
              cupo_dolares:  Number(metaConfig.meta_dolares),
              cupo_unidades: Number(metaConfig.meta_unidades),
            }
          : null,
        proyeccion: {
          dolares: Number(proyeccionDolares.toFixed(2)),
          unidades: Number(proyeccionUnidades.toFixed(0))
        }, vsMesAnterior: {
          monto_anterior: ant.dolares,
          variacion_abs: Number(variacionAbs.toFixed(2)),
          variacion_porc: variacionPorc !== null ? Number(variacionPorc.toFixed(2)) : null,

          unidades: ant.unidades,
          variacion_abs_unidades: variacionAbsUnidadesDet,
          variacion_porc_unidades: variacionPorcUnidadesDet !== null ? Number(variacionPorcUnidadesDet.toFixed(2)) : null,
        },
      };
    }),
  };
};




/* ======================================================
   TENDENCIA 6 MESES BOTELLÓN (ordenes MV + facturas E/A/V/U1)
====================================================== */
const tendencia6MesesBotellon = async (anioNum, mesNum) => {
  const NOMBRES = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
  let mesInicio = mesNum - 11, anioInicio = anioNum;
  while (mesInicio <= 0) { mesInicio += 12; anioInicio--; }
  const inicio6 = `${anioInicio}-${String(mesInicio).padStart(2,'0')}-01 00:00:00`;
  let mesFin = mesNum + 1, anioFin = anioNum;
  if (mesFin === 13) { mesFin = 1; anioFin++; }
  const fin6 = `${anioFin}-${String(mesFin).padStart(2,'0')}-01 00:00:00`;

  const rows = await sequelize.query(`
    SELECT mes_periodo, SUM(dolares) AS dolares, SUM(unidades) AS unidades
    FROM (
      SELECT DATE_TRUNC('month', o.fecha_creacion) AS mes_periodo,
             SUM(dd.total) AS dolares, SUM(dd.cantidad) AS unidades
      FROM ordenes o
      JOIN detalle_documento dd ON dd.documento_code = o.code
      WHERE o.status IN (2,4,5)
        AND dd.descripcion_categoria = 'BOTELLÓN'
        AND o.fecha_creacion >= :inicio6 AND o.fecha_creacion < :fin6
      GROUP BY DATE_TRUNC('month', o.fecha_creacion)

      UNION ALL

      SELECT DATE_TRUNC('month', f.fecha_entrega) AS mes_periodo,
             SUM(dd.total) AS dolares, SUM(dd.cantidad) AS unidades
      FROM facturas f
      JOIN detalle_documento dd ON dd.documento_code = f.code
      WHERE f.status IN ('0','2','4','5')
        AND dd.descripcion_categoria = 'BOTELLÓN'
        AND f.fecha_entrega >= :inicio6 AND f.fecha_entrega < :fin6
      GROUP BY DATE_TRUNC('month', f.fecha_entrega)
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
    return { label: NOMBRES[d.getMonth()], anio, mes, dolares, unidades, proyeccion };
  });
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

    // ── Filtro por rutas si VENDEDOR ──────────────────────────────
    const rutasPermitidas = req.user?.rol === 'VENDEDOR' && Array.isArray(req.user.rutas_asignadas) && req.user.rutas_asignadas.length > 0
      ? req.user.rutas_asignadas.map(r => r.toUpperCase())
      : null;

    // Cargar metas configuradas para este mes/año (solo secciones TV, T, M, R)
    const metasDB = await MetaPreventa.findAll({
      where: { anio: anioNum, mes: mesNum, seccion: SECCIONES_CON_METAS },
    });
    // Agrupar por seccion → { [seccion]: { [codigo_ruta]: meta } }
    const metasPorSeccion = {};
    metasDB.forEach(m => {
      if (!metasPorSeccion[m.seccion]) metasPorSeccion[m.seccion] = {};
      metasPorSeccion[m.seccion][m.codigo_ruta.toUpperCase()] = m;
    });

    const botellones = {};

    for (const nombre of Object.keys(GRUPOS)) {
      const metasConfigMap = SECCIONES_CON_METAS.includes(nombre)
        ? (metasPorSeccion[nombre] || {})
        : {};

      botellones[nombre] = await obtenerGrupoBotellon(
        nombre,
        anioNum,
        mesNum,
        metasConfigMap,
        rutasPermitidas
      );
    }

    const tendencia6Meses = await tendencia6MesesBotellon(anioNum, mesNum);

    return res.json({
      anio: anioNum,
      mes: mesNum,
      botellones,
      tendencia6Meses,
    });
  } catch (error) {
    console.error("❌ ERROR BOTELLONES:", error);
    res.status(500).json({ message: "Error dashboard botellones" });
  }
};

/* ======================================================
   CLIENTES VIP BOTELLÓN
   GET /api/botellones/clientes-vip?anio=YYYY&mes=MM
====================================================== */
const obtenerClientesVipBotellon = async (req, res) => {
  try {
    const { anio, mes } = req.query;
    if (!anio || !mes) return res.status(400).json({ error: 'anio y mes requeridos' });

    const anioNum = parseInt(anio, 10);
    const mesNum  = parseInt(mes,  10);
    if (isNaN(anioNum) || isNaN(mesNum))
      return res.status(400).json({ error: 'Parámetros inválidos' });

    const { inicio, fin }       = getRangoFechas(anioNum, mesNum);
    const { inicio: iniAnt, fin: finAnt } = getRangoFechas(
      mesNum === 1 ? anioNum - 1 : anioNum,
      mesNum === 1 ? 12 : mesNum - 1
    );

    const iniYear = `${anioNum}-01-01 00:00:00`;
    const finYear = `${anioNum + 1}-01-01 00:00:00`;

    const clientes = await sequelize.query(`
      SELECT
        base.customer_code                                         AS codigo_cliente,
        COALESCE(c.nombre_cliente, base.customer_code)             AS nombre_cliente,
        COALESCE(dc.calle1_direccion_cliente, c.direccion_cliente, '')        AS direccion_entrega,
        COALESCE(tn.descripcion, '')                                          AS tipo_negocio,
        COALESCE(dc.telefono_direccion_cliente, c.telefono_cliente, '')       AS telefono,
        COALESCE(dc.latitud_direccion_cliente::text,  c.latitud_cliente::text,  '')  AS latitud,
        COALESCE(dc.longitud_direccion_cliente::text, c.longitud_cliente::text, '')  AS longitud,
        COALESCE(act.cantidad_actual,  0)                          AS cantidad_actual,
        COALESCE(act.consumo_actual,   0)                          AS consumo_actual,
        COALESCE(ant.consumo_anterior, 0)                          AS consumo_anterior,
        COALESCE(mx.max_consumo,       0)                          AS max_consumo,
        ult.ultima_factura
      FROM (
        -- Todos los clientes VIP que compraron BOTELLÓN en el año seleccionado
        SELECT DISTINCT f0.customer_code
        FROM facturas f0
        JOIN detalle_documento dd0 ON dd0.documento_code = f0.code
        WHERE f0.codigo_tipo_negocio = '29'
          AND dd0.descripcion_categoria = 'BOTELLÓN'
          AND f0.status IN (2,4,5)
          AND f0.fecha_creacion >= :iniYear
          AND f0.fecha_creacion <  :finYear
      ) base
      LEFT JOIN clientes c ON c.codigo_cliente = base.customer_code
      LEFT JOIN tipos_negocio tn ON tn.codigo = c.codigo_tipo_negocio
      LEFT JOIN LATERAL (
        SELECT calle1_direccion_cliente,
               telefono_direccion_cliente,
               latitud_direccion_cliente,
               longitud_direccion_cliente
        FROM direcciones_clientes
        WHERE codigo_cliente = base.customer_code
        ORDER BY
          (latitud_direccion_cliente  IS NOT NULL AND longitud_direccion_cliente IS NOT NULL) DESC,
          (telefono_direccion_cliente IS NOT NULL) DESC
        LIMIT 1
      ) dc ON true
      LEFT JOIN LATERAL (
        SELECT SUM(dd2.cantidad) AS cantidad_actual,
               SUM(dd2.total)   AS consumo_actual
        FROM facturas f2
        JOIN detalle_documento dd2 ON dd2.documento_code = f2.code
        WHERE f2.customer_code = base.customer_code
          AND f2.codigo_tipo_negocio = '29'
          AND dd2.descripcion_categoria = 'BOTELLÓN'
          AND f2.status IN (2,4,5)
          AND f2.fecha_creacion >= :inicio
          AND f2.fecha_creacion <  :fin
      ) act ON true
      LEFT JOIN LATERAL (
        SELECT SUM(dd3.total) AS consumo_anterior
        FROM facturas f3
        JOIN detalle_documento dd3 ON dd3.documento_code = f3.code
        WHERE f3.customer_code = base.customer_code
          AND f3.codigo_tipo_negocio = '29'
          AND dd3.descripcion_categoria = 'BOTELLÓN'
          AND f3.status IN (2,4,5)
          AND f3.fecha_creacion >= :iniAnt
          AND f3.fecha_creacion <  :finAnt
      ) ant ON true
      LEFT JOIN LATERAL (
        SELECT MAX(dd4.total) AS max_consumo
        FROM facturas f4
        JOIN detalle_documento dd4 ON dd4.documento_code = f4.code
        WHERE f4.customer_code = base.customer_code
          AND f4.codigo_tipo_negocio = '29'
          AND dd4.descripcion_categoria = 'BOTELLÓN'
          AND f4.status IN (2,4,5)
      ) mx ON true
      LEFT JOIN LATERAL (
        SELECT MAX(f5.fecha_creacion)::date AS ultima_factura
        FROM facturas f5
        JOIN detalle_documento dd5 ON dd5.documento_code = f5.code
        WHERE f5.customer_code = base.customer_code
          AND f5.codigo_tipo_negocio = '29'
          AND dd5.descripcion_categoria = 'BOTELLÓN'
          AND f5.status IN (2,4,5)
      ) ult ON true
      ORDER BY consumo_actual DESC NULLS LAST
    `, {
      replacements: { iniYear, finYear, inicio, fin, iniAnt, finAnt },
      type: Sequelize.QueryTypes.SELECT,
    });

    const totalClientes      = clientes.length;
    const clientesConConsumo = clientes.filter(c => Number(c.consumo_actual) > 0).length;
    const clientesSinConsumo = totalClientes - clientesConConsumo;

    const productosVendidos = await sequelize.query(`
      SELECT dd.descripcion AS producto,
             SUM(dd.cantidad) AS unidades_vendidas,
             SUM(dd.total)    AS monto_usd
      FROM facturas f
      JOIN detalle_documento dd ON dd.documento_code = f.code
      WHERE f.codigo_tipo_negocio = '29'
        AND f.status IN (0,2,3,4,5)
        AND dd.descripcion_categoria = 'BOTELLÓN'
        AND f.fecha_entrega >= :inicio AND f.fecha_entrega < :fin
      GROUP BY dd.descripcion
      ORDER BY unidades_vendidas DESC
    `, { replacements: { inicio, fin }, type: Sequelize.QueryTypes.SELECT });

    return res.json({
      clientes,
      resumen: { totalClientes, clientesConConsumo, clientesSinConsumo },
      productosVendidos,
    });
  } catch (error) {
    console.error('❌ ERROR CLIENTES VIP BOTELLÓN:', error);
    return res.status(500).json({ message: 'Error al obtener clientes VIP', detail: error.message });
  }
};

/* ======================================================
   RUTAS ODOO EMPRESA (constante compartida)
====================================================== */
const RUTAS_ODOO_EMPRESAS = [
  'Carmen Garcia', 'Estefania Flores', 'Tamara Villacres',
  'RUTA E1', 'RUTA E2', 'RUTA E3', 'RUTA E4', 'RUTA E5',
  'RUTA E6', 'RUTA E7', 'RUTA E8', 'RUTA E9', 'RUTA E10',
  'RUTA EA1', 'Distribucion OK/E',
];

/* Helper: totales consolidados Empresa (facturas E% + ordenes Odoo) */
const queryTotalesEmpresas = async (inicio, fin) => {
  const rutasRepl = {};
  RUTAS_ODOO_EMPRESAS.forEach((r, i) => { rutasRepl[`re${i}`] = r; });
  const rutasPH = RUTAS_ODOO_EMPRESAS.map((_, i) => `:re${i}`).join(', ');

  const rows = await sequelize.query(`
    SELECT COALESCE(SUM(sub.unidades), 0) AS unidades,
           COALESCE(SUM(sub.dolares),  0) AS dolares
    FROM (
      -- MobilVendor: facturas EMPRESA
      SELECT COALESCE(SUM(dd.cantidad), 0) AS unidades, COALESCE(SUM(dd.total), 0) AS dolares
      FROM facturas f
      JOIN detalle_documento dd ON dd.documento_code = f.code
      WHERE f.seller_code ILIKE 'E%' AND f.status IN (0,2,3,4,5)
        AND dd.descripcion_categoria = 'BOTELLÓN'
        AND f.fecha_entrega >= :inicio AND f.fecha_entrega < :fin
      UNION ALL
      -- Odoo: ordenes EMPRESA
      SELECT COALESCE(SUM(dd.cantidad), 0), COALESCE(SUM(dd.total), 0)
      FROM ordenes o
      JOIN detalle_documento dd ON dd.documento_code = o.code
      WHERE o.seller_nombre IN (${rutasPH})
        AND o.type = 2 AND o.status IN (2,4,5)
        AND dd.descripcion_categoria = 'BOTELLÓN'
        AND o.fecha_creacion >= :inicio AND o.fecha_creacion < :fin
    ) sub
  `, {
    replacements: { inicio, fin, ...rutasRepl },
    type: Sequelize.QueryTypes.SELECT,
  });

  return {
    unidades: Number(rows[0]?.unidades || 0),
    dolares:  Number(rows[0]?.dolares  || 0),
  };
};

/* ======================================================
   EMPRESAS CONSOLIDADO
   GET /api/botellones/empresas-consolidado?anio=YYYY&mes=MM
====================================================== */
const obtenerEmpresasConsolidado = async (req, res) => {
  try {
    const { anio, mes } = req.query;
    if (!anio || !mes) return res.status(400).json({ error: 'anio y mes requeridos' });

    const anioNum = parseInt(anio, 10);
    const mesNum  = parseInt(mes,  10);
    if (isNaN(anioNum) || isNaN(mesNum))
      return res.status(400).json({ error: 'Parámetros inválidos' });

    const hoyEmp = new Date();
    const esMesActualEmp = hoyEmp.getFullYear() === anioNum && hoyEmp.getMonth() + 1 === mesNum;

    const { inicio, fin: finFull } = getRangoFechas(anioNum, mesNum);
    const finHoyEmp = `${hoyEmp.getFullYear()}-${String(hoyEmp.getMonth() + 1).padStart(2, '0')}-${String(hoyEmp.getDate()).padStart(2, '0')} 00:00:00`;
    const fin = esMesActualEmp ? finHoyEmp : finFull;

    const { inicio: inicioAnt, fin: finAnt } = getRangoFechas(
      mesNum === 1 ? anioNum - 1 : anioNum,
      mesNum === 1 ? 12 : mesNum - 1
    );

    const diasTrans = getDiasHabilesTranscurridos(anioNum, mesNum);
    const diasMes   = getDiasLaborablesMes(anioNum, mesNum);

    const [actual, anterior] = await Promise.all([
      queryTotalesEmpresas(inicio, fin),
      queryTotalesEmpresas(inicioAnt, finAnt),
    ]);

    const proyDolares  = esMesActualEmp && diasTrans > 0
      ? (actual.dolares  / diasTrans) * diasMes
      : actual.dolares;
    const proyUnidades = esMesActualEmp && diasTrans > 0
      ? Math.round((actual.unidades / diasTrans) * diasMes)
      : actual.unidades;

    // Variación: proyección vs mes anterior
    const variacionAbs  = proyDolares  - anterior.dolares;
    const variacionPorc = anterior.dolares > 0 ? (variacionAbs / anterior.dolares) * 100 : 0;
    const varAbsUnid    = proyUnidades  - anterior.unidades;
    const varPorcUnid   = anterior.unidades > 0 ? (varAbsUnid / anterior.unidades) * 100 : 0;

    return res.json({
      total: {
        unidades: actual.unidades,
        dolares:  actual.dolares,
        mesAnterior: {
          dolares:              anterior.dolares,
          variacionAbs:         Number(variacionAbs.toFixed(2)),
          variacionPorc:        Number(variacionPorc.toFixed(2)),
          unidades:             anterior.unidades,
          variacionAbsUnidades: Math.round(varAbsUnid),
          variacionPorcUnidades: Number(varPorcUnid.toFixed(2)),
        },
      },
      detalle: [{
        proyeccion: {
          dolares:  Number(proyDolares.toFixed(2)),
          unidades: Number(proyUnidades.toFixed(0)),
        },
      }],
    });
  } catch (error) {
    console.error('❌ ERROR EMPRESAS CONSOLIDADO:', error);
    return res.status(500).json({ message: 'Error empresas consolidado', detail: error.message });
  }
};

/* ======================================================
   CLIENTES DOMICILIO BOTELLÓN
   GET /api/botellones/clientes-domicilio?anio=YYYY&mes=MM
====================================================== */
const obtenerClientesDomicilioBotellon = async (req, res) => {
  try {
    const { anio, mes } = req.query;
    if (!anio || !mes) return res.status(400).json({ error: 'anio y mes requeridos' });

    const anioNum = parseInt(anio, 10);
    const mesNum  = parseInt(mes,  10);
    if (isNaN(anioNum) || isNaN(mesNum))
      return res.status(400).json({ error: 'Parámetros inválidos' });

    const { inicio, fin }       = getRangoFechas(anioNum, mesNum);
    const { inicio: iniAnt, fin: finAnt } = getRangoFechas(
      mesNum === 1 ? anioNum - 1 : anioNum,
      mesNum === 1 ? 12 : mesNum - 1
    );

    const iniYear = `${anioNum}-01-01 00:00:00`;
    const finYear = `${anioNum + 1}-01-01 00:00:00`;

    const clientes = await sequelize.query(`
      SELECT
        base.customer_code                                                        AS codigo_cliente,
        COALESCE(c.nombre_cliente, base.customer_code)                            AS nombre_cliente,
        COALESCE(dc.calle1_direccion_cliente, c.direccion_cliente, '')            AS direccion_entrega,
        COALESCE(tn.descripcion, '')                                              AS tipo_negocio,
        COALESCE(dc.telefono_direccion_cliente, c.telefono_cliente, '')           AS telefono,
        COALESCE(dc.latitud_direccion_cliente::text,  c.latitud_cliente::text,  '') AS latitud,
        COALESCE(dc.longitud_direccion_cliente::text, c.longitud_cliente::text, '') AS longitud,
        COALESCE(act.cantidad_actual,  0)                                         AS cantidad_actual,
        COALESCE(act.consumo_actual,   0)                                         AS consumo_actual,
        COALESCE(ant.consumo_anterior, 0)                                         AS consumo_anterior,
        COALESCE(mx.max_consumo,       0)                                         AS max_consumo,
        ult.ultima_factura
      FROM (
        -- Todos los clientes Domicilio que compraron BOTELLÓN en el año seleccionado
        SELECT DISTINCT f0.customer_code
        FROM facturas f0
        JOIN detalle_documento dd0 ON dd0.documento_code = f0.code
        WHERE f0.seller_code ILIKE 'A%'
          AND dd0.descripcion_categoria = 'BOTELLÓN'
          AND f0.status IN (2,4,5)
          AND (
            (f0.codigo_tipo_negocio != '29' AND f0.fecha_entrega  >= :iniYear AND f0.fecha_entrega  < :finYear)
            OR
            (f0.codigo_tipo_negocio  = '29' AND f0.fecha_creacion >= :iniYear AND f0.fecha_creacion < :finYear)
          )
      ) base
      LEFT JOIN clientes c ON c.codigo_cliente = base.customer_code
      LEFT JOIN tipos_negocio tn ON tn.codigo = c.codigo_tipo_negocio
      LEFT JOIN LATERAL (
        SELECT calle1_direccion_cliente,
               telefono_direccion_cliente,
               latitud_direccion_cliente,
               longitud_direccion_cliente
        FROM direcciones_clientes
        WHERE codigo_cliente = base.customer_code
        ORDER BY
          (latitud_direccion_cliente  IS NOT NULL AND longitud_direccion_cliente IS NOT NULL) DESC,
          (telefono_direccion_cliente IS NOT NULL) DESC
        LIMIT 1
      ) dc ON true
      LEFT JOIN LATERAL (
        SELECT SUM(dd2.cantidad) AS cantidad_actual,
               SUM(dd2.total)   AS consumo_actual
        FROM facturas f2
        JOIN detalle_documento dd2 ON dd2.documento_code = f2.code
        WHERE f2.customer_code = base.customer_code
          AND f2.seller_code ILIKE 'A%'
          AND dd2.descripcion_categoria = 'BOTELLÓN'
          AND f2.status IN (2,4,5)
          AND (
            (f2.codigo_tipo_negocio != '29' AND f2.fecha_entrega  >= :inicio AND f2.fecha_entrega  < :fin)
            OR
            (f2.codigo_tipo_negocio  = '29' AND f2.fecha_creacion >= :inicio AND f2.fecha_creacion < :fin)
          )
      ) act ON true
      LEFT JOIN LATERAL (
        SELECT SUM(dd3.total) AS consumo_anterior
        FROM facturas f3
        JOIN detalle_documento dd3 ON dd3.documento_code = f3.code
        WHERE f3.customer_code = base.customer_code
          AND f3.seller_code ILIKE 'A%'
          AND dd3.descripcion_categoria = 'BOTELLÓN'
          AND f3.status IN (2,4,5)
          AND (
            (f3.codigo_tipo_negocio != '29' AND f3.fecha_entrega  >= :iniAnt AND f3.fecha_entrega  < :finAnt)
            OR
            (f3.codigo_tipo_negocio  = '29' AND f3.fecha_creacion >= :iniAnt AND f3.fecha_creacion < :finAnt)
          )
      ) ant ON true
      LEFT JOIN LATERAL (
        SELECT MAX(dd4.total) AS max_consumo
        FROM facturas f4
        JOIN detalle_documento dd4 ON dd4.documento_code = f4.code
        WHERE f4.customer_code = base.customer_code
          AND f4.seller_code ILIKE 'A%'
          AND dd4.descripcion_categoria = 'BOTELLÓN'
          AND f4.status IN (2,4,5)
      ) mx ON true
      LEFT JOIN LATERAL (
        SELECT MAX(f5.fecha_creacion)::date AS ultima_factura
        FROM facturas f5
        JOIN detalle_documento dd5 ON dd5.documento_code = f5.code
        WHERE f5.customer_code = base.customer_code
          AND f5.seller_code ILIKE 'A%'
          AND dd5.descripcion_categoria = 'BOTELLÓN'
          AND f5.status IN (2,4,5)
      ) ult ON true
      ORDER BY consumo_actual DESC NULLS LAST
    `, {
      replacements: { iniYear, finYear, inicio, fin, iniAnt, finAnt },
      type: Sequelize.QueryTypes.SELECT,
    });

    const totalClientes      = clientes.length;
    const clientesConConsumo = clientes.filter(c => Number(c.consumo_actual) > 0).length;
    const clientesSinConsumo = totalClientes - clientesConConsumo;

    const productosVendidos = await sequelize.query(`
      SELECT dd.descripcion AS producto,
             SUM(dd.cantidad) AS unidades_vendidas,
             SUM(dd.total)    AS monto_usd
      FROM facturas f
      JOIN detalle_documento dd ON dd.documento_code = f.code
      WHERE f.seller_code ILIKE 'A%'
        AND f.status IN (2,4,5)
        AND dd.descripcion_categoria = 'BOTELLÓN'
        AND (
          (f.codigo_tipo_negocio != '29' AND f.fecha_entrega  >= :inicio AND f.fecha_entrega  < :fin)
          OR
          (f.codigo_tipo_negocio  = '29' AND f.fecha_creacion >= :inicio AND f.fecha_creacion < :fin)
        )
      GROUP BY dd.descripcion
      ORDER BY unidades_vendidas DESC
    `, { replacements: { inicio, fin }, type: Sequelize.QueryTypes.SELECT });

    return res.json({
      clientes,
      resumen: { totalClientes, clientesConConsumo, clientesSinConsumo },
      productosVendidos,
    });
  } catch (error) {
    console.error('❌ ERROR CLIENTES DOMICILIO BOTELLÓN:', error);
    return res.status(500).json({ message: 'Error al obtener clientes Domicilio', detail: error.message });
  }
};

/* ======================================================
   CLIENTES EMPRESAS BOTELLÓN (consolidado MobilVendor + Odoo)
   GET /api/botellones/clientes-empresas?anio=YYYY&mes=MM
====================================================== */
const obtenerClientesEmpresasBotellon = async (req, res) => {
  try {
    const { anio, mes } = req.query;
    if (!anio || !mes) return res.status(400).json({ error: 'anio y mes requeridos' });

    const anioNum = parseInt(anio, 10);
    const mesNum  = parseInt(mes,  10);
    if (isNaN(anioNum) || isNaN(mesNum))
      return res.status(400).json({ error: 'Parámetros inválidos' });

    const { inicio, fin }             = getRangoFechas(anioNum, mesNum);
    const { inicio: iniAnt, fin: finAnt } = getRangoFechas(
      mesNum === 1 ? anioNum - 1 : anioNum,
      mesNum === 1 ? 12 : mesNum - 1
    );
    const iniYear = `${anioNum}-01-01 00:00:00`;
    const finYear = `${anioNum + 1}-01-01 00:00:00`;

    // Placeholders para rutas Odoo
    const rutasRepl = {};
    RUTAS_ODOO_EMPRESAS.forEach((r, i) => { rutasRepl[`re${i}`] = r; });
    const rutasPH = RUTAS_ODOO_EMPRESAS.map((_, i) => `:re${i}`).join(', ');

    const clientes = await sequelize.query(`
      SELECT
        base.customer_code                                                          AS codigo_cliente,
        COALESCE(c.nombre_cliente, base.customer_code)                              AS nombre_cliente,
        COALESCE(dc.calle1_direccion_cliente, c.direccion_cliente, '')              AS direccion_entrega,
        COALESCE(tn.descripcion, '')                                                AS tipo_negocio,
        COALESCE(dc.telefono_direccion_cliente, c.telefono_cliente, '')             AS telefono,
        COALESCE(dc.latitud_direccion_cliente::text,  c.latitud_cliente::text,  '') AS latitud,
        COALESCE(dc.longitud_direccion_cliente::text, c.longitud_cliente::text, '') AS longitud,
        COALESCE(act.cantidad_actual,  0)                                           AS cantidad_actual,
        COALESCE(act.consumo_actual,   0)                                           AS consumo_actual,
        COALESCE(ant.consumo_anterior, 0)                                           AS consumo_anterior,
        COALESCE(mx.max_consumo,       0)                                           AS max_consumo,
        ult.ultima_factura
      FROM (
        SELECT DISTINCT src.customer_code FROM (
          -- MobilVendor facturas E%
          SELECT f0.customer_code FROM facturas f0
          JOIN detalle_documento dd0 ON dd0.documento_code = f0.code
          WHERE f0.seller_code ILIKE 'E%' AND f0.status IN (2,4,5)
            AND dd0.descripcion_categoria = 'BOTELLÓN'
            AND f0.fecha_creacion >= :iniYear AND f0.fecha_creacion < :finYear
          UNION
          -- Odoo ordenes empresa
          SELECT o0.customer_code FROM ordenes o0
          JOIN detalle_documento dd0 ON dd0.documento_code = o0.code
          WHERE o0.seller_nombre IN (${rutasPH})
            AND o0.type = 2 AND o0.status IN (2,4,5)
            AND dd0.descripcion_categoria = 'BOTELLÓN'
            AND o0.fecha_creacion >= :iniYear AND o0.fecha_creacion < :finYear
        ) src
      ) base
      LEFT JOIN clientes c ON c.codigo_cliente = base.customer_code
      LEFT JOIN tipos_negocio tn ON tn.codigo = c.codigo_tipo_negocio
      LEFT JOIN LATERAL (
        SELECT calle1_direccion_cliente, telefono_direccion_cliente,
               latitud_direccion_cliente, longitud_direccion_cliente
        FROM direcciones_clientes
        WHERE codigo_cliente = base.customer_code
        ORDER BY
          (latitud_direccion_cliente  IS NOT NULL AND longitud_direccion_cliente IS NOT NULL) DESC,
          (telefono_direccion_cliente IS NOT NULL) DESC
        LIMIT 1
      ) dc ON true
      LEFT JOIN LATERAL (
        SELECT COALESCE(SUM(sub.cantidad), 0) AS cantidad_actual,
               COALESCE(SUM(sub.total),   0) AS consumo_actual
        FROM (
          SELECT dd2.cantidad, dd2.total FROM facturas f2
          JOIN detalle_documento dd2 ON dd2.documento_code = f2.code
          WHERE f2.customer_code = base.customer_code AND f2.seller_code ILIKE 'E%'
            AND dd2.descripcion_categoria = 'BOTELLÓN' AND f2.status IN (2,4,5)
            AND f2.fecha_creacion >= :inicio AND f2.fecha_creacion < :fin
          UNION ALL
          SELECT dd2.cantidad, dd2.total FROM ordenes o2
          JOIN detalle_documento dd2 ON dd2.documento_code = o2.code
          WHERE o2.customer_code = base.customer_code
            AND o2.seller_nombre IN (${rutasPH})
            AND o2.type = 2 AND o2.status IN (2,4,5)
            AND dd2.descripcion_categoria = 'BOTELLÓN'
            AND o2.fecha_creacion >= :inicio AND o2.fecha_creacion < :fin
        ) sub
      ) act ON true
      LEFT JOIN LATERAL (
        SELECT COALESCE(SUM(sub.total), 0) AS consumo_anterior
        FROM (
          SELECT dd3.total FROM facturas f3
          JOIN detalle_documento dd3 ON dd3.documento_code = f3.code
          WHERE f3.customer_code = base.customer_code AND f3.seller_code ILIKE 'E%'
            AND dd3.descripcion_categoria = 'BOTELLÓN' AND f3.status IN (2,4,5)
            AND f3.fecha_creacion >= :iniAnt AND f3.fecha_creacion < :finAnt
          UNION ALL
          SELECT dd3.total FROM ordenes o3
          JOIN detalle_documento dd3 ON dd3.documento_code = o3.code
          WHERE o3.customer_code = base.customer_code
            AND o3.seller_nombre IN (${rutasPH})
            AND o3.type = 2 AND o3.status IN (2,4,5)
            AND dd3.descripcion_categoria = 'BOTELLÓN'
            AND o3.fecha_creacion >= :iniAnt AND o3.fecha_creacion < :finAnt
        ) sub
      ) ant ON true
      LEFT JOIN LATERAL (
        SELECT COALESCE(MAX(sub.total), 0) AS max_consumo
        FROM (
          SELECT dd4.total FROM facturas f4
          JOIN detalle_documento dd4 ON dd4.documento_code = f4.code
          WHERE f4.customer_code = base.customer_code AND f4.seller_code ILIKE 'E%'
            AND dd4.descripcion_categoria = 'BOTELLÓN' AND f4.status IN (2,4,5)
          UNION ALL
          SELECT dd4.total FROM ordenes o4
          JOIN detalle_documento dd4 ON dd4.documento_code = o4.code
          WHERE o4.customer_code = base.customer_code
            AND o4.seller_nombre IN (${rutasPH})
            AND o4.type = 2 AND o4.status IN (2,4,5)
            AND dd4.descripcion_categoria = 'BOTELLÓN'
        ) sub
      ) mx ON true
      LEFT JOIN LATERAL (
        SELECT GREATEST(
          (SELECT MAX(f5.fecha_creacion)::date FROM facturas f5
           JOIN detalle_documento dd5 ON dd5.documento_code = f5.code
           WHERE f5.customer_code = base.customer_code AND f5.seller_code ILIKE 'E%'
             AND dd5.descripcion_categoria = 'BOTELLÓN' AND f5.status IN (2,4,5)),
          (SELECT MAX(o5.fecha_creacion)::date FROM ordenes o5
           JOIN detalle_documento dd5 ON dd5.documento_code = o5.code
           WHERE o5.customer_code = base.customer_code
             AND o5.seller_nombre IN (${rutasPH})
             AND o5.type = 2 AND o5.status IN (2,4,5)
             AND dd5.descripcion_categoria = 'BOTELLÓN')
        ) AS ultima_factura
      ) ult ON true
      ORDER BY consumo_actual DESC NULLS LAST
    `, {
      replacements: { iniYear, finYear, inicio, fin, iniAnt, finAnt, ...rutasRepl },
      type: Sequelize.QueryTypes.SELECT,
    });

    const totalClientes      = clientes.length;
    const clientesConConsumo = clientes.filter(c => Number(c.consumo_actual) > 0).length;
    const clientesSinConsumo = totalClientes - clientesConConsumo;

    // Productos vendidos consolidados (facturas E% + ordenes Odoo)
    const productosVendidos = await sequelize.query(`
      SELECT
        sub.descripcion  AS producto,
        SUM(sub.cantidad) AS unidades_vendidas,
        SUM(sub.total)    AS monto_usd
      FROM (
        SELECT dd.descripcion, dd.cantidad, dd.total
        FROM facturas f
        JOIN detalle_documento dd ON dd.documento_code = f.code
        WHERE f.seller_code ILIKE 'E%' AND f.status IN (0,2,3,4,5)
          AND dd.descripcion_categoria = 'BOTELLÓN'
          AND f.fecha_entrega >= :inicio AND f.fecha_entrega < :fin
        UNION ALL
        SELECT dd.descripcion, dd.cantidad, dd.total
        FROM ordenes o
        JOIN detalle_documento dd ON dd.documento_code = o.code
        WHERE o.seller_nombre IN (${rutasPH})
          AND o.type = 2 AND o.status IN (2,4,5)
          AND dd.descripcion_categoria = 'BOTELLÓN'
          AND o.fecha_creacion >= :inicio AND o.fecha_creacion < :fin
      ) sub
      GROUP BY sub.descripcion
      ORDER BY unidades_vendidas DESC
    `, {
      replacements: { inicio, fin, ...rutasRepl },
      type: Sequelize.QueryTypes.SELECT,
    });

    return res.json({
      clientes,
      resumen: { totalClientes, clientesConConsumo, clientesSinConsumo },
      productosVendidos: productosVendidos.map(p => ({
        producto: p.producto,
        unidades: Number(p.unidades_vendidas || 0),
        monto:    Number(p.monto_usd || 0),
      })),
    });
  } catch (error) {
    console.error('❌ ERROR CLIENTES EMPRESAS BOTELLÓN:', error);
    return res.status(500).json({ message: 'Error al obtener clientes Empresas', detail: error.message });
  }
};

/* ======================================================
   VIP — SUBCANALES (tipos_negocio con totales)
   GET /api/botellones/vip-subcanales?anio=YYYY&mes=MM
====================================================== */
const obtenerVipSubcanales = async (req, res) => {
  try {
    const { anio, mes } = req.query;
    if (!anio || !mes) return res.status(400).json({ error: 'anio y mes requeridos' });
    const anioNum = parseInt(anio, 10);
    const mesNum  = parseInt(mes,  10);
    if (isNaN(anioNum) || isNaN(mesNum))
      return res.status(400).json({ error: 'Parámetros inválidos' });

    const { inicio, fin }             = getRangoFechas(anioNum, mesNum);
    const { inicio: iniAnt, fin: finAnt } = getRangoFechas(
      mesNum === 1 ? anioNum - 1 : anioNum,
      mesNum === 1 ? 12 : mesNum - 1
    );
    const iniYear = `${anioNum}-01-01 00:00:00`;
    const finYear = `${anioNum + 1}-01-01 00:00:00`;

    /*
     * Clientes VIP identificados directamente por f.codigo_tipo_negocio y f.codigo_subcanal
     * en la tabla facturas (campos nuevos sincronizados desde Odoo, igual que en ordenes).
     * Agrupamos por canal (tipos_negocio) → subcanal (subcanales) usando los campos de la factura.
     */
    const subcanales = await sequelize.query(`
      SELECT
        COALESCE(tn.descripcion, 'Sin Canal')                                   AS canal,
        COALESCE(sc.descripcion_subcanal, 'Sin Clasificar')                     AS subcanal,
        COUNT(DISTINCT base.customer_code)                                       AS total_clientes,
        COUNT(DISTINCT CASE WHEN COALESCE(act.consumo_actual, 0) > 0
              THEN base.customer_code END)                                       AS clientes_con_consumo,
        COALESCE(SUM(act.cantidad_actual), 0)                                   AS unidades_actual,
        COALESCE(SUM(act.consumo_actual),  0)                                   AS monto_actual,
        COALESCE(SUM(ant.consumo_anterior),0)                                   AS monto_anterior
      FROM (
        -- Universo VIP: customer_code de facturas con codigo_tipo_negocio '29' + BOTELLÓN en el año
        -- El canal/subcanal viene de los campos codigo_tipo_negocio y codigo_subcanal de la factura
        SELECT DISTINCT f0.customer_code, f0.codigo_tipo_negocio, f0.codigo_subcanal
        FROM facturas f0
        JOIN detalle_documento dd0 ON dd0.documento_code = f0.code
        WHERE f0.codigo_tipo_negocio = '29'
          AND dd0.descripcion_categoria = 'BOTELLÓN'
          AND f0.status IN (2,4,5)
          AND f0.fecha_creacion >= :iniYear
          AND f0.fecha_creacion <  :finYear
      ) base
      -- Canal y subcanal desde los campos directos de la factura
      LEFT JOIN subcanales sc ON sc.codigo_subcanal = base.codigo_subcanal
      LEFT JOIN tipos_negocio tn ON tn.codigo = sc.codigo_tipo_negocio
      -- Métricas del mes actual por customer_code + tipo_negocio VIP + BOTELLÓN
      LEFT JOIN LATERAL (
        SELECT SUM(dd2.cantidad) AS cantidad_actual,
               SUM(dd2.total)   AS consumo_actual
        FROM facturas f2
        JOIN detalle_documento dd2 ON dd2.documento_code = f2.code
        WHERE f2.customer_code = base.customer_code
          AND f2.codigo_tipo_negocio = '29'
          AND dd2.descripcion_categoria = 'BOTELLÓN'
          AND f2.status IN (2,4,5)
          AND f2.fecha_creacion >= :inicio
          AND f2.fecha_creacion <  :fin
      ) act ON true
      -- Métricas del mes anterior
      LEFT JOIN LATERAL (
        SELECT SUM(dd3.total) AS consumo_anterior
        FROM facturas f3
        JOIN detalle_documento dd3 ON dd3.documento_code = f3.code
        WHERE f3.customer_code = base.customer_code
          AND f3.codigo_tipo_negocio = '29'
          AND dd3.descripcion_categoria = 'BOTELLÓN'
          AND f3.status IN (2,4,5)
          AND f3.fecha_creacion >= :iniAnt
          AND f3.fecha_creacion <  :finAnt
      ) ant ON true
      GROUP BY COALESCE(tn.descripcion, 'Sin Canal'), COALESCE(sc.descripcion_subcanal, 'Sin Clasificar')
      ORDER BY canal, monto_actual DESC NULLS LAST
    `, {
      replacements: { iniYear, finYear, inicio, fin, iniAnt, finAnt },
      type: Sequelize.QueryTypes.SELECT,
    });

    const productosVendidos = await sequelize.query(`
      SELECT dd.descripcion AS producto,
             SUM(dd.cantidad) AS unidades_vendidas,
             SUM(dd.total)    AS monto_usd
      FROM facturas f
      JOIN detalle_documento dd ON dd.documento_code = f.code
      WHERE f.codigo_tipo_negocio = '29'
        AND f.status IN (2,4,5)
        AND dd.descripcion_categoria = 'BOTELLÓN'
        AND f.fecha_creacion >= :inicio AND f.fecha_creacion < :fin
      GROUP BY dd.descripcion
      ORDER BY unidades_vendidas DESC
    `, { replacements: { inicio, fin }, type: Sequelize.QueryTypes.SELECT });

    return res.json({ subcanales, productosVendidos });
  } catch (error) {
    console.error('❌ ERROR VIP SUBCANALES:', error);
    return res.status(500).json({ message: 'Error al obtener subcanales VIP', detail: error.message });
  }
};

/* ======================================================
   VIP — CLIENTES POR TIPO DE NEGOCIO
   GET /api/botellones/vip-clientes-tipo?tipo=X&anio=YYYY&mes=MM
====================================================== */
const obtenerVipClientesPorTipo = async (req, res) => {
  try {
    const { tipo, anio, mes } = req.query;
    if (!anio || !mes) return res.status(400).json({ error: 'anio y mes requeridos' });
    const anioNum = parseInt(anio, 10);
    const mesNum  = parseInt(mes,  10);
    if (isNaN(anioNum) || isNaN(mesNum))
      return res.status(400).json({ error: 'Parámetros inválidos' });

    const { inicio, fin }             = getRangoFechas(anioNum, mesNum);
    const { inicio: iniAnt, fin: finAnt } = getRangoFechas(
      mesNum === 1 ? anioNum - 1 : anioNum,
      mesNum === 1 ? 12 : mesNum - 1
    );
    const iniYear = `${anioNum}-01-01 00:00:00`;
    const finYear = `${anioNum + 1}-01-01 00:00:00`;

    const clientes = await sequelize.query(`
      SELECT
        base.customer_code                                                        AS codigo_cliente,
        COALESCE(c.nombre_cliente, base.customer_code)                           AS nombre_cliente,
        COALESCE(sc.descripcion_subcanal, 'Sin Clasificar')                      AS tipo_negocio,
        COALESCE(tn.descripcion, 'Sin Canal')                                    AS canal,
        COALESCE(dc.telefono_direccion_cliente, c.telefono_cliente, '')          AS telefono,
        COALESCE(act.cantidad_actual,  0)                                        AS cantidad_actual,
        COALESCE(act.consumo_actual,   0)                                        AS consumo_actual,
        COALESCE(ant.consumo_anterior, 0)                                        AS consumo_anterior,
        COALESCE(mx.max_consumo,       0)                                        AS max_consumo,
        ult.ultima_factura,
        COALESCE(nsuc.total_sucursales, 1)                                       AS total_sucursales
      FROM (
        -- Universo VIP: customer_code con código_subcanal y tipo_negocio desde la factura
        SELECT DISTINCT f0.customer_code, f0.codigo_tipo_negocio, f0.codigo_subcanal
        FROM facturas f0
        JOIN detalle_documento dd0 ON dd0.documento_code = f0.code
        WHERE f0.codigo_tipo_negocio = '29'
          AND dd0.descripcion_categoria = 'BOTELLÓN'
          AND f0.status IN (2,4,5)
          AND f0.fecha_creacion >= :iniYear
          AND f0.fecha_creacion <  :finYear
      ) base
      -- Nombre e info del cliente
      LEFT JOIN clientes c ON c.codigo_cliente = base.customer_code
      -- Canal y subcanal desde campos directos de la factura
      LEFT JOIN subcanales sc ON sc.codigo_subcanal = base.codigo_subcanal
      LEFT JOIN tipos_negocio tn ON tn.codigo = sc.codigo_tipo_negocio
      LEFT JOIN LATERAL (
        SELECT telefono_direccion_cliente
        FROM direcciones_clientes
        WHERE codigo_cliente = base.customer_code
        ORDER BY (telefono_direccion_cliente IS NOT NULL) DESC
        LIMIT 1
      ) dc ON true
      -- Sucursales del cliente — por customer_code
      LEFT JOIN LATERAL (
        SELECT COUNT(DISTINCT f0b.customer_address_code) AS total_sucursales
        FROM facturas f0b
        JOIN detalle_documento dd0b ON dd0b.documento_code = f0b.code
        WHERE f0b.customer_code = base.customer_code
          AND dd0b.descripcion_categoria = 'BOTELLÓN'
          AND f0b.status IN (2,4,5)
      ) nsuc ON true
      -- Consumo mes actual — por customer_code, sin filtrar seller
      LEFT JOIN LATERAL (
        SELECT SUM(dd2.cantidad) AS cantidad_actual,
               SUM(dd2.total)   AS consumo_actual
        FROM facturas f2
        JOIN detalle_documento dd2 ON dd2.documento_code = f2.code
        WHERE f2.customer_code = base.customer_code
          AND dd2.descripcion_categoria = 'BOTELLÓN'
          AND f2.status IN (2,4,5)
          AND f2.fecha_creacion >= :inicio
          AND f2.fecha_creacion <  :fin
      ) act ON true
      -- Consumo mes anterior — por customer_code, sin filtrar seller
      LEFT JOIN LATERAL (
        SELECT SUM(dd3.total) AS consumo_anterior
        FROM facturas f3
        JOIN detalle_documento dd3 ON dd3.documento_code = f3.code
        WHERE f3.customer_code = base.customer_code
          AND dd3.descripcion_categoria = 'BOTELLÓN'
          AND f3.status IN (2,4,5)
          AND f3.fecha_creacion >= :iniAnt
          AND f3.fecha_creacion <  :finAnt
      ) ant ON true
      -- Máximo histórico — por customer_code
      LEFT JOIN LATERAL (
        SELECT MAX(dd4.total) AS max_consumo
        FROM facturas f4
        JOIN detalle_documento dd4 ON dd4.documento_code = f4.code
        WHERE f4.customer_code = base.customer_code
          AND dd4.descripcion_categoria = 'BOTELLÓN'
          AND f4.status IN (2,4,5)
      ) mx ON true
      -- Última factura — por customer_code
      LEFT JOIN LATERAL (
        SELECT MAX(f5.fecha_creacion)::date AS ultima_factura
        FROM facturas f5
        JOIN detalle_documento dd5 ON dd5.documento_code = f5.code
        WHERE f5.customer_code = base.customer_code
          AND dd5.descripcion_categoria = 'BOTELLÓN'
          AND f5.status IN (2,4,5)
      ) ult ON true
      WHERE COALESCE(sc.descripcion_subcanal, 'Sin Clasificar') = :tipo
      ORDER BY consumo_actual DESC NULLS LAST
    `, {
      replacements: { iniYear, finYear, inicio, fin, iniAnt, finAnt, tipo: tipo || '' },
      type: Sequelize.QueryTypes.SELECT,
    });

    return res.json({ clientes });
  } catch (error) {
    console.error('❌ ERROR VIP CLIENTES POR TIPO:', error);
    return res.status(500).json({ message: 'Error al obtener clientes VIP por tipo', detail: error.message });
  }
};

/* ======================================================
   VIP — DETALLE POR SUCURSAL (customer_address_code)
   GET /api/botellones/vip-cliente-detalle?clienteCode=X&anio=YYYY&mes=MM
====================================================== */
const obtenerVipDetalleCliente = async (req, res) => {
  try {
    const { clienteCode, anio, mes } = req.query;
    if (!clienteCode || !anio || !mes)
      return res.status(400).json({ error: 'clienteCode, anio y mes requeridos' });
    const anioNum = parseInt(anio, 10);
    const mesNum  = parseInt(mes,  10);
    if (isNaN(anioNum) || isNaN(mesNum))
      return res.status(400).json({ error: 'Parámetros inválidos' });

    const { inicio, fin }             = getRangoFechas(anioNum, mesNum);
    const { inicio: iniAnt, fin: finAnt } = getRangoFechas(
      mesNum === 1 ? anioNum - 1 : anioNum,
      mesNum === 1 ? 12 : mesNum - 1
    );

    const clienteInfo = await sequelize.query(`
      SELECT c.nombre_cliente,
             COALESCE(tn.descripcion, 'Sin Clasificar') AS tipo_negocio,
             c.telefono_cliente AS telefono
      FROM clientes c
      LEFT JOIN tipos_negocio tn ON tn.codigo = c.codigo_tipo_negocio
      WHERE c.codigo_cliente = :clienteCode
    `, { replacements: { clienteCode }, type: Sequelize.QueryTypes.SELECT });

    const sucursales = await sequelize.query(`
      SELECT
        CASE
          WHEN LOWER(TRIM(COALESCE(dc.descripcion_direccion_cliente,''))) = ANY(ARRAY['delivery','invoice','contact','private','other',''])
          THEN COALESCE(dc.calle1_direccion_cliente, base.customer_address_code::text)
          ELSE COALESCE(NULLIF(TRIM(dc.descripcion_direccion_cliente),''), dc.calle1_direccion_cliente, base.customer_address_code::text)
        END AS nombre_sucursal,
        COALESCE(dc.calle1_direccion_cliente, '')                                                               AS direccion,
        COALESCE(dc.codigo_direccion_cliente,   base.customer_address_code::text)                               AS codigo_sucursal,
        COALESCE(dc.telefono_direccion_cliente, '')                              AS telefono,
        COALESCE(dc.latitud_direccion_cliente::text,  '')                        AS latitud,
        COALESCE(dc.longitud_direccion_cliente::text, '')                        AS longitud,
        base.customer_address_code,
        COALESCE(act.cantidad_actual,  0)                                        AS cantidad_actual,
        COALESCE(act.consumo_actual,   0)                                        AS consumo_actual,
        COALESCE(ant.consumo_anterior, 0)                                        AS consumo_anterior,
        ult.ultima_factura
      FROM (
        SELECT DISTINCT f0.customer_address_code
        FROM facturas f0
        JOIN detalle_documento dd0 ON dd0.documento_code = f0.code
        WHERE f0.customer_code = :clienteCode
          AND f0.codigo_tipo_negocio = '29'
          AND dd0.descripcion_categoria = 'BOTELLÓN'
          AND f0.status IN (2,4,5)
      ) base
      LEFT JOIN direcciones_clientes dc
             ON dc.codigo_cliente           = :clienteCode
            AND dc.codigo_direccion_cliente = base.customer_address_code
      LEFT JOIN LATERAL (
        SELECT SUM(dd2.cantidad) AS cantidad_actual,
               SUM(dd2.total)   AS consumo_actual
        FROM facturas f2
        JOIN detalle_documento dd2 ON dd2.documento_code = f2.code
        WHERE f2.customer_code         = :clienteCode
          AND f2.customer_address_code = base.customer_address_code
          AND f2.codigo_tipo_negocio = '29'
          AND dd2.descripcion_categoria = 'BOTELLÓN'
          AND f2.status IN (2,4,5)
          AND f2.fecha_creacion >= :inicio
          AND f2.fecha_creacion <  :fin
      ) act ON true
      LEFT JOIN LATERAL (
        SELECT SUM(dd3.total) AS consumo_anterior
        FROM facturas f3
        JOIN detalle_documento dd3 ON dd3.documento_code = f3.code
        WHERE f3.customer_code         = :clienteCode
          AND f3.customer_address_code = base.customer_address_code
          AND f3.codigo_tipo_negocio = '29'
          AND dd3.descripcion_categoria = 'BOTELLÓN'
          AND f3.status IN (2,4,5)
          AND f3.fecha_creacion >= :iniAnt
          AND f3.fecha_creacion <  :finAnt
      ) ant ON true
      LEFT JOIN LATERAL (
        SELECT MAX(f5.fecha_creacion)::date AS ultima_factura
        FROM facturas f5
        JOIN detalle_documento dd5 ON dd5.documento_code = f5.code
        WHERE f5.customer_code         = :clienteCode
          AND f5.customer_address_code = base.customer_address_code
          AND f5.codigo_tipo_negocio = '29'
          AND dd5.descripcion_categoria = 'BOTELLÓN'
          AND f5.status IN (2,4,5)
      ) ult ON true
      ORDER BY consumo_actual DESC NULLS LAST
    `, {
      replacements: { clienteCode, inicio, fin, iniAnt, finAnt },
      type: Sequelize.QueryTypes.SELECT,
    });

    return res.json({
      cliente: clienteInfo[0] || { nombre_cliente: clienteCode, tipo_negocio: '—', telefono: '' },
      sucursales,
    });
  } catch (error) {
    console.error('❌ ERROR VIP DETALLE CLIENTE:', error);
    return res.status(500).json({ message: 'Error al obtener detalle cliente VIP', detail: error.message });
  }
};

/* ======================================================
   EMPRESAS — SUBCANALES (tipos_negocio con totales)
   GET /api/botellones/empresas-subcanales?anio=YYYY&mes=MM
====================================================== */
const obtenerEmpresasSubcanales = async (req, res) => {
  try {
    const { anio, mes } = req.query;
    if (!anio || !mes) return res.status(400).json({ error: 'anio y mes requeridos' });
    const anioNum = parseInt(anio, 10);
    const mesNum  = parseInt(mes,  10);
    if (isNaN(anioNum) || isNaN(mesNum))
      return res.status(400).json({ error: 'Parámetros inválidos' });

    const { inicio, fin }             = getRangoFechas(anioNum, mesNum);
    const { inicio: iniAnt, fin: finAnt } = getRangoFechas(
      mesNum === 1 ? anioNum - 1 : anioNum,
      mesNum === 1 ? 12 : mesNum - 1
    );
    const iniYear = `${anioNum}-01-01 00:00:00`;
    const finYear = `${anioNum + 1}-01-01 00:00:00`;

    const rutasRepl = {};
    RUTAS_ODOO_EMPRESAS.forEach((r, i) => { rutasRepl[`re${i}`] = r; });
    const rutasPH = RUTAS_ODOO_EMPRESAS.map((_, i) => `:re${i}`).join(', ');

    const subcanales = await sequelize.query(`
      SELECT
        COALESCE(tn.descripcion, 'EMPRESA')                                     AS tipo_negocio,
        COUNT(DISTINCT base.customer_code)                                       AS total_clientes,
        COUNT(DISTINCT CASE WHEN COALESCE(act.consumo_actual, 0) > 0
              THEN base.customer_code END)                                       AS clientes_con_consumo,
        COALESCE(SUM(act.cantidad_actual), 0)                                   AS unidades_actual,
        COALESCE(SUM(act.consumo_actual),  0)                                   AS monto_actual,
        COALESCE(SUM(ant.consumo_anterior),0)                                   AS monto_anterior
      FROM (
        SELECT DISTINCT src.customer_code FROM (
          SELECT f0.customer_code FROM facturas f0
          JOIN detalle_documento dd0 ON dd0.documento_code = f0.code
          WHERE f0.seller_code ILIKE 'E%' AND f0.status IN (2,4,5)
            AND dd0.descripcion_categoria = 'BOTELLÓN'
            AND f0.fecha_creacion >= :iniYear AND f0.fecha_creacion < :finYear
          UNION
          SELECT o0.customer_code FROM ordenes o0
          JOIN detalle_documento dd0 ON dd0.documento_code = o0.code
          WHERE o0.seller_nombre IN (${rutasPH})
            AND o0.type = 2 AND o0.status IN (2,4,5)
            AND dd0.descripcion_categoria = 'BOTELLÓN'
            AND o0.fecha_creacion >= :iniYear AND o0.fecha_creacion < :finYear
        ) src
      ) base
      LEFT JOIN clientes c ON c.codigo_cliente = base.customer_code
      LEFT JOIN tipos_negocio tn ON tn.codigo = c.codigo_tipo_negocio
      LEFT JOIN LATERAL (
        SELECT COALESCE(SUM(sub.cantidad), 0) AS cantidad_actual,
               COALESCE(SUM(sub.total),   0) AS consumo_actual
        FROM (
          SELECT dd2.cantidad, dd2.total FROM facturas f2
          JOIN detalle_documento dd2 ON dd2.documento_code = f2.code
          WHERE f2.customer_code = base.customer_code AND f2.seller_code ILIKE 'E%'
            AND dd2.descripcion_categoria = 'BOTELLÓN' AND f2.status IN (2,4,5)
            AND f2.fecha_creacion >= :inicio AND f2.fecha_creacion < :fin
          UNION ALL
          SELECT dd2.cantidad, dd2.total FROM ordenes o2
          JOIN detalle_documento dd2 ON dd2.documento_code = o2.code
          WHERE o2.customer_code = base.customer_code
            AND o2.seller_nombre IN (${rutasPH})
            AND o2.type = 2 AND o2.status IN (2,4,5)
            AND dd2.descripcion_categoria = 'BOTELLÓN'
            AND o2.fecha_creacion >= :inicio AND o2.fecha_creacion < :fin
        ) sub
      ) act ON true
      LEFT JOIN LATERAL (
        SELECT COALESCE(SUM(sub.total), 0) AS consumo_anterior
        FROM (
          SELECT dd3.total FROM facturas f3
          JOIN detalle_documento dd3 ON dd3.documento_code = f3.code
          WHERE f3.customer_code = base.customer_code AND f3.seller_code ILIKE 'E%'
            AND dd3.descripcion_categoria = 'BOTELLÓN' AND f3.status IN (2,4,5)
            AND f3.fecha_creacion >= :iniAnt AND f3.fecha_creacion < :finAnt
          UNION ALL
          SELECT dd3.total FROM ordenes o3
          JOIN detalle_documento dd3 ON dd3.documento_code = o3.code
          WHERE o3.customer_code = base.customer_code
            AND o3.seller_nombre IN (${rutasPH})
            AND o3.type = 2 AND o3.status IN (2,4,5)
            AND dd3.descripcion_categoria = 'BOTELLÓN'
            AND o3.fecha_creacion >= :iniAnt AND o3.fecha_creacion < :finAnt
        ) sub
      ) ant ON true
      GROUP BY COALESCE(tn.descripcion, 'EMPRESA')
      ORDER BY monto_actual DESC NULLS LAST
    `, {
      replacements: { iniYear, finYear, inicio, fin, iniAnt, finAnt, ...rutasRepl },
      type: Sequelize.QueryTypes.SELECT,
    });

    const productosVendidos = await sequelize.query(`
      SELECT sub.descripcion AS producto,
             SUM(sub.cantidad) AS unidades_vendidas,
             SUM(sub.total)    AS monto_usd
      FROM (
        SELECT dd.descripcion, dd.cantidad, dd.total
        FROM facturas f
        JOIN detalle_documento dd ON dd.documento_code = f.code
        WHERE f.seller_code ILIKE 'E%' AND f.status IN (0,2,3,4,5)
          AND dd.descripcion_categoria = 'BOTELLÓN'
          AND f.fecha_entrega >= :inicio AND f.fecha_entrega < :fin
        UNION ALL
        SELECT dd.descripcion, dd.cantidad, dd.total
        FROM ordenes o
        JOIN detalle_documento dd ON dd.documento_code = o.code
        WHERE o.seller_nombre IN (${rutasPH})
          AND o.type = 2 AND o.status IN (2,4,5)
          AND dd.descripcion_categoria = 'BOTELLÓN'
          AND o.fecha_creacion >= :inicio AND o.fecha_creacion < :fin
      ) sub
      GROUP BY sub.descripcion
      ORDER BY unidades_vendidas DESC
    `, { replacements: { inicio, fin, ...rutasRepl }, type: Sequelize.QueryTypes.SELECT });

    return res.json({ subcanales, productosVendidos });
  } catch (error) {
    console.error('❌ ERROR EMPRESAS SUBCANALES:', error);
    return res.status(500).json({ message: 'Error al obtener subcanales Empresas', detail: error.message });
  }
};

/* ======================================================
   EMPRESAS — CLIENTES POR TIPO DE NEGOCIO
   GET /api/botellones/empresas-clientes-tipo?tipo=X&anio=YYYY&mes=MM
====================================================== */
const obtenerEmpresasClientesPorTipo = async (req, res) => {
  try {
    const { tipo, anio, mes } = req.query;
    if (!anio || !mes) return res.status(400).json({ error: 'anio y mes requeridos' });
    const anioNum = parseInt(anio, 10);
    const mesNum  = parseInt(mes,  10);
    if (isNaN(anioNum) || isNaN(mesNum))
      return res.status(400).json({ error: 'Parámetros inválidos' });

    const { inicio, fin }             = getRangoFechas(anioNum, mesNum);
    const { inicio: iniAnt, fin: finAnt } = getRangoFechas(
      mesNum === 1 ? anioNum - 1 : anioNum,
      mesNum === 1 ? 12 : mesNum - 1
    );
    const iniYear = `${anioNum}-01-01 00:00:00`;
    const finYear = `${anioNum + 1}-01-01 00:00:00`;

    const rutasRepl = {};
    RUTAS_ODOO_EMPRESAS.forEach((r, i) => { rutasRepl[`re${i}`] = r; });
    const rutasPH = RUTAS_ODOO_EMPRESAS.map((_, i) => `:re${i}`).join(', ');

    const clientes = await sequelize.query(`
      SELECT
        base.customer_code                                                          AS codigo_cliente,
        COALESCE(c.nombre_cliente, base.customer_code)                             AS nombre_cliente,
        COALESCE(tn.descripcion, 'EMPRESA')                                        AS tipo_negocio,
        COALESCE(dc.telefono_direccion_cliente, c.telefono_cliente, '')            AS telefono,
        COALESCE(act.cantidad_actual,  0)                                          AS cantidad_actual,
        COALESCE(act.consumo_actual,   0)                                          AS consumo_actual,
        COALESCE(ant.consumo_anterior, 0)                                          AS consumo_anterior,
        COALESCE(mx.max_consumo,       0)                                          AS max_consumo,
        ult.ultima_factura,
        COALESCE(nsuc.total_sucursales, 1)                                         AS total_sucursales
      FROM (
        SELECT DISTINCT src.customer_code FROM (
          SELECT f0.customer_code FROM facturas f0
          JOIN detalle_documento dd0 ON dd0.documento_code = f0.code
          WHERE f0.seller_code ILIKE 'E%' AND f0.status IN (2,4,5)
            AND dd0.descripcion_categoria = 'BOTELLÓN'
            AND f0.fecha_creacion >= :iniYear AND f0.fecha_creacion < :finYear
          UNION
          SELECT o0.customer_code FROM ordenes o0
          JOIN detalle_documento dd0 ON dd0.documento_code = o0.code
          WHERE o0.seller_nombre IN (${rutasPH})
            AND o0.type = 2 AND o0.status IN (2,4,5)
            AND dd0.descripcion_categoria = 'BOTELLÓN'
            AND o0.fecha_creacion >= :iniYear AND o0.fecha_creacion < :finYear
        ) src
      ) base
      LEFT JOIN clientes c ON c.codigo_cliente = base.customer_code
      LEFT JOIN tipos_negocio tn ON tn.codigo = c.codigo_tipo_negocio
      LEFT JOIN LATERAL (
        SELECT telefono_direccion_cliente
        FROM direcciones_clientes
        WHERE codigo_cliente = base.customer_code
        ORDER BY (telefono_direccion_cliente IS NOT NULL) DESC
        LIMIT 1
      ) dc ON true
      LEFT JOIN LATERAL (
        SELECT COUNT(DISTINCT suc_code) AS total_sucursales
        FROM (
          SELECT f0b.customer_address_code::text AS suc_code
          FROM facturas f0b
          JOIN detalle_documento dd0b ON dd0b.documento_code = f0b.code
          WHERE f0b.customer_code = base.customer_code
            AND f0b.seller_code ILIKE 'E%'
            AND dd0b.descripcion_categoria = 'BOTELLÓN'
            AND f0b.status IN (2,4,5)
          UNION
          SELECT o0b.customer_address_code::text AS suc_code
          FROM ordenes o0b
          JOIN detalle_documento dd0b ON dd0b.documento_code = o0b.code
          WHERE o0b.customer_code = base.customer_code
            AND o0b.seller_nombre IN (${rutasPH})
            AND o0b.type = 2 AND o0b.status IN (2,4,5)
            AND dd0b.descripcion_categoria = 'BOTELLÓN'
        ) suc_all
        WHERE suc_code IS NOT NULL
      ) nsuc ON true
      LEFT JOIN LATERAL (
        SELECT COALESCE(SUM(sub.cantidad), 0) AS cantidad_actual,
               COALESCE(SUM(sub.total),   0) AS consumo_actual
        FROM (
          SELECT dd2.cantidad, dd2.total FROM facturas f2
          JOIN detalle_documento dd2 ON dd2.documento_code = f2.code
          WHERE f2.customer_code = base.customer_code AND f2.seller_code ILIKE 'E%'
            AND dd2.descripcion_categoria = 'BOTELLÓN' AND f2.status IN (2,4,5)
            AND f2.fecha_creacion >= :inicio AND f2.fecha_creacion < :fin
          UNION ALL
          SELECT dd2.cantidad, dd2.total FROM ordenes o2
          JOIN detalle_documento dd2 ON dd2.documento_code = o2.code
          WHERE o2.customer_code = base.customer_code
            AND o2.seller_nombre IN (${rutasPH})
            AND o2.type = 2 AND o2.status IN (2,4,5)
            AND dd2.descripcion_categoria = 'BOTELLÓN'
            AND o2.fecha_creacion >= :inicio AND o2.fecha_creacion < :fin
        ) sub
      ) act ON true
      LEFT JOIN LATERAL (
        SELECT COALESCE(SUM(sub.total), 0) AS consumo_anterior
        FROM (
          SELECT dd3.total FROM facturas f3
          JOIN detalle_documento dd3 ON dd3.documento_code = f3.code
          WHERE f3.customer_code = base.customer_code AND f3.seller_code ILIKE 'E%'
            AND dd3.descripcion_categoria = 'BOTELLÓN' AND f3.status IN (2,4,5)
            AND f3.fecha_creacion >= :iniAnt AND f3.fecha_creacion < :finAnt
          UNION ALL
          SELECT dd3.total FROM ordenes o3
          JOIN detalle_documento dd3 ON dd3.documento_code = o3.code
          WHERE o3.customer_code = base.customer_code
            AND o3.seller_nombre IN (${rutasPH})
            AND o3.type = 2 AND o3.status IN (2,4,5)
            AND dd3.descripcion_categoria = 'BOTELLÓN'
            AND o3.fecha_creacion >= :iniAnt AND o3.fecha_creacion < :finAnt
        ) sub
      ) ant ON true
      LEFT JOIN LATERAL (
        SELECT COALESCE(MAX(sub.total), 0) AS max_consumo
        FROM (
          SELECT dd4.total FROM facturas f4
          JOIN detalle_documento dd4 ON dd4.documento_code = f4.code
          WHERE f4.customer_code = base.customer_code AND f4.seller_code ILIKE 'E%'
            AND dd4.descripcion_categoria = 'BOTELLÓN' AND f4.status IN (2,4,5)
          UNION ALL
          SELECT dd4.total FROM ordenes o4
          JOIN detalle_documento dd4 ON dd4.documento_code = o4.code
          WHERE o4.customer_code = base.customer_code
            AND o4.seller_nombre IN (${rutasPH})
            AND o4.type = 2 AND o4.status IN (2,4,5)
            AND dd4.descripcion_categoria = 'BOTELLÓN'
        ) sub
      ) mx ON true
      LEFT JOIN LATERAL (
        SELECT GREATEST(
          (SELECT MAX(f5.fecha_creacion)::date FROM facturas f5
           JOIN detalle_documento dd5 ON dd5.documento_code = f5.code
           WHERE f5.customer_code = base.customer_code AND f5.seller_code ILIKE 'E%'
             AND dd5.descripcion_categoria = 'BOTELLÓN' AND f5.status IN (2,4,5)),
          (SELECT MAX(o5.fecha_creacion)::date FROM ordenes o5
           JOIN detalle_documento dd5 ON dd5.documento_code = o5.code
           WHERE o5.customer_code = base.customer_code
             AND o5.seller_nombre IN (${rutasPH})
             AND o5.type = 2 AND o5.status IN (2,4,5)
             AND dd5.descripcion_categoria = 'BOTELLÓN')
        ) AS ultima_factura
      ) ult ON true
      WHERE COALESCE(tn.descripcion, 'EMPRESA') = :tipo
      ORDER BY consumo_actual DESC NULLS LAST
    `, {
      replacements: { iniYear, finYear, inicio, fin, iniAnt, finAnt, tipo: tipo || '', ...rutasRepl },
      type: Sequelize.QueryTypes.SELECT,
    });

    return res.json({ clientes });
  } catch (error) {
    console.error('❌ ERROR EMPRESAS CLIENTES POR TIPO:', error);
    return res.status(500).json({ message: 'Error al obtener clientes Empresas por tipo', detail: error.message });
  }
};

/* ======================================================
   EMPRESAS — DETALLE POR SUCURSAL (customer_address_code)
   GET /api/botellones/empresas-cliente-detalle?clienteCode=X&anio=YYYY&mes=MM
====================================================== */
const obtenerEmpresasDetalleCliente = async (req, res) => {
  try {
    const { clienteCode, anio, mes } = req.query;
    if (!clienteCode || !anio || !mes)
      return res.status(400).json({ error: 'clienteCode, anio y mes requeridos' });
    const anioNum = parseInt(anio, 10);
    const mesNum  = parseInt(mes,  10);
    if (isNaN(anioNum) || isNaN(mesNum))
      return res.status(400).json({ error: 'Parámetros inválidos' });

    const { inicio, fin }             = getRangoFechas(anioNum, mesNum);
    const { inicio: iniAnt, fin: finAnt } = getRangoFechas(
      mesNum === 1 ? anioNum - 1 : anioNum,
      mesNum === 1 ? 12 : mesNum - 1
    );

    const rutasRepl = {};
    RUTAS_ODOO_EMPRESAS.forEach((r, i) => { rutasRepl[`re${i}`] = r; });
    const rutasPH = RUTAS_ODOO_EMPRESAS.map((_, i) => `:re${i}`).join(', ');

    const clienteInfo = await sequelize.query(`
      SELECT c.nombre_cliente,
             COALESCE(tn.descripcion, 'Sin Clasificar') AS tipo_negocio,
             c.telefono_cliente AS telefono
      FROM clientes c
      LEFT JOIN tipos_negocio tn ON tn.codigo = c.codigo_tipo_negocio
      WHERE c.codigo_cliente = :clienteCode
    `, { replacements: { clienteCode }, type: Sequelize.QueryTypes.SELECT });

    const sucursales = await sequelize.query(`
      SELECT
        CASE
          WHEN LOWER(TRIM(COALESCE(dc.descripcion_direccion_cliente,''))) = ANY(ARRAY['delivery','invoice','contact','private','other',''])
          THEN COALESCE(dc.calle1_direccion_cliente, base.customer_address_code::text)
          ELSE COALESCE(NULLIF(TRIM(dc.descripcion_direccion_cliente),''), dc.calle1_direccion_cliente, base.customer_address_code::text)
        END AS nombre_sucursal,
        COALESCE(dc.calle1_direccion_cliente, '')                                AS direccion,
        COALESCE(dc.codigo_direccion_cliente, base.customer_address_code::text)  AS codigo_sucursal,
        COALESCE(dc.telefono_direccion_cliente, '')                              AS telefono,
        COALESCE(dc.latitud_direccion_cliente::text,  '')                        AS latitud,
        COALESCE(dc.longitud_direccion_cliente::text, '')                        AS longitud,
        base.customer_address_code,
        COALESCE(act.cantidad_actual,  0)                                        AS cantidad_actual,
        COALESCE(act.consumo_actual,   0)                                        AS consumo_actual,
        COALESCE(ant.consumo_anterior, 0)                                        AS consumo_anterior,
        ult.ultima_factura
      FROM (
        SELECT DISTINCT suc_code AS customer_address_code
        FROM (
          SELECT f0.customer_address_code::text AS suc_code
          FROM facturas f0
          JOIN detalle_documento dd0 ON dd0.documento_code = f0.code
          WHERE f0.customer_code = :clienteCode
            AND f0.seller_code ILIKE 'E%'
            AND dd0.descripcion_categoria = 'BOTELLÓN'
            AND f0.status IN (2,4,5)
          UNION
          SELECT o0.customer_address_code::text AS suc_code
          FROM ordenes o0
          JOIN detalle_documento dd0 ON dd0.documento_code = o0.code
          WHERE o0.customer_code = :clienteCode
            AND o0.seller_nombre IN (${rutasPH})
            AND o0.type = 2 AND o0.status IN (2,4,5)
            AND dd0.descripcion_categoria = 'BOTELLÓN'
        ) suc_src
        WHERE suc_code IS NOT NULL
      ) base
      LEFT JOIN direcciones_clientes dc
             ON dc.codigo_cliente           = :clienteCode
            AND dc.codigo_direccion_cliente = base.customer_address_code
      LEFT JOIN LATERAL (
        SELECT COALESCE(SUM(sub.cantidad), 0) AS cantidad_actual,
               COALESCE(SUM(sub.total),   0) AS consumo_actual
        FROM (
          SELECT dd2.cantidad, dd2.total FROM facturas f2
          JOIN detalle_documento dd2 ON dd2.documento_code = f2.code
          WHERE f2.customer_code = :clienteCode
            AND f2.customer_address_code = base.customer_address_code
            AND f2.seller_code ILIKE 'E%'
            AND dd2.descripcion_categoria = 'BOTELLÓN' AND f2.status IN (2,4,5)
            AND f2.fecha_creacion >= :inicio AND f2.fecha_creacion < :fin
          UNION ALL
          SELECT dd2.cantidad, dd2.total FROM ordenes o2
          JOIN detalle_documento dd2 ON dd2.documento_code = o2.code
          WHERE o2.customer_code = :clienteCode
            AND o2.customer_address_code::text = base.customer_address_code
            AND o2.seller_nombre IN (${rutasPH})
            AND o2.type = 2 AND o2.status IN (2,4,5)
            AND dd2.descripcion_categoria = 'BOTELLÓN'
            AND o2.fecha_creacion >= :inicio AND o2.fecha_creacion < :fin
        ) sub
      ) act ON true
      LEFT JOIN LATERAL (
        SELECT COALESCE(SUM(sub.total), 0) AS consumo_anterior
        FROM (
          SELECT dd3.total FROM facturas f3
          JOIN detalle_documento dd3 ON dd3.documento_code = f3.code
          WHERE f3.customer_code = :clienteCode
            AND f3.customer_address_code = base.customer_address_code
            AND f3.seller_code ILIKE 'E%'
            AND dd3.descripcion_categoria = 'BOTELLÓN' AND f3.status IN (2,4,5)
            AND f3.fecha_creacion >= :iniAnt AND f3.fecha_creacion < :finAnt
          UNION ALL
          SELECT dd3.total FROM ordenes o3
          JOIN detalle_documento dd3 ON dd3.documento_code = o3.code
          WHERE o3.customer_code = :clienteCode
            AND o3.customer_address_code::text = base.customer_address_code
            AND o3.seller_nombre IN (${rutasPH})
            AND o3.type = 2 AND o3.status IN (2,4,5)
            AND dd3.descripcion_categoria = 'BOTELLÓN'
            AND o3.fecha_creacion >= :iniAnt AND o3.fecha_creacion < :finAnt
        ) sub
      ) ant ON true
      LEFT JOIN LATERAL (
        SELECT MAX(f5.fecha_creacion)::date AS ultima_factura
        FROM facturas f5
        JOIN detalle_documento dd5 ON dd5.documento_code = f5.code
        WHERE f5.customer_code = :clienteCode
          AND f5.customer_address_code = base.customer_address_code
          AND f5.seller_code ILIKE 'E%'
          AND dd5.descripcion_categoria = 'BOTELLÓN'
          AND f5.status IN (2,4,5)
      ) ult ON true
      ORDER BY consumo_actual DESC NULLS LAST
    `, {
      replacements: { clienteCode, inicio, fin, iniAnt, finAnt, ...rutasRepl },
      type: Sequelize.QueryTypes.SELECT,
    });

    return res.json({
      cliente: clienteInfo[0] || { nombre_cliente: clienteCode, tipo_negocio: '—', telefono: '' },
      sucursales,
    });
  } catch (error) {
    console.error('❌ ERROR EMPRESAS DETALLE CLIENTE:', error);
    return res.status(500).json({ message: 'Error al obtener detalle cliente Empresas', detail: error.message });
  }
};

module.exports = {
  obtenerDashboardBotellones,
  obtenerClientesVipBotellon,
  obtenerClientesDomicilioBotellon,
  obtenerEmpresasConsolidado,
  obtenerClientesEmpresasBotellon,
  obtenerVipSubcanales,
  obtenerVipClientesPorTipo,
  obtenerVipDetalleCliente,
  obtenerEmpresasSubcanales,
  obtenerEmpresasClientesPorTipo,
  obtenerEmpresasDetalleCliente,
};

