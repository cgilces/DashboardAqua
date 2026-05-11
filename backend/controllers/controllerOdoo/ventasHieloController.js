// controllers/ventasHieloController.js
// Muestra ventas de HIELO (categoria 28)
// para todas las rutas que facturan en Odoo

const Sequelize = require("sequelize");
const { sequelize } = require("../../models");
const { getDiasHabilesTranscurridos, getDiasLaborablesMes } = require('../../utils/diasFestivos');

// ================================================================
// RUTAS QUE FACTURAN EN ODOO
// ================================================================
const RUTAS_ODOO = [
  "Carmen Garcia",
  "Estefania Flores",
  "Tamara Villacres",
  "RUTA E1", "RUTA E2", "RUTA E3", "RUTA E4", "RUTA E5",
  "RUTA E6", "RUTA E7", "RUTA E8", "RUTA E9", "RUTA E10",
  "RUTA EA1",
  "RUTA U2",
  "Distribucion OK/E",
  "Domicilio",
];

// ================================================================
// HELPERS DE FECHA
// ================================================================
function getFechaInicioMes(anio, mes) {
  return `${anio}-${String(mes).padStart(2, "0")}-01 00:00:00`;
}

function getFechaFinMes(anio, mes) {
  let mesFin = mes + 1, anioFin = anio;
  if (mesFin === 13) { mesFin = 1; anioFin++; }
  return `${anioFin}-${String(mesFin).padStart(2, "0")}-01 00:00:00`;
}

const getFechaFinQuery = (anio, mes) => getFechaFinMes(anio, mes);


// ================================================================
// QUERY VENTAS HIELO MOBILVENDOR (facturas H*)
// ================================================================
// DESPUÉS
const queryMVHielo = async (inicio, fin) => {
const [row] = await sequelize.query(
  `SELECT
      COALESCE(SUM(
        CASE
          -- Televentas anuladas
          WHEN f.seller_code = '10'
            THEN -dd.cantidad
          ELSE dd.cantidad
        END
      ), 0) AS unidades,

      COALESCE(SUM(
        CASE
          -- Televentas anuladas
          WHEN f.seller_code = '10'
            THEN -dd.total
          ELSE dd.total
        END
      ), 0) AS dolares,

      COUNT(DISTINCT f.code)          AS cant_facturas,
      COUNT(DISTINCT f.customer_code) AS cant_clientes

    FROM facturas f

    LEFT JOIN detalle_documento dd
      ON f.code = dd.documento_code

    WHERE
      (f.seller_code ILIKE 'H%' OR f.seller_code IN ('10', 'h3'))

      AND f.status = '2'

      AND dd.descripcion_categoria = 'HIELO'

      AND f.fecha_creacion >= :inicio
      AND f.fecha_creacion < :fin`,
  {
    replacements: { inicio, fin },
    type: Sequelize.QueryTypes.SELECT
  }
);
  return {
    unidades: Number(row?.unidades || 0),
    dolares: Number(row?.dolares || 0),
    cant_facturas: Number(row?.cant_facturas || 0),
    cant_clientes: Number(row?.cant_clientes || 0),  // ✅ nuevo campo
  };
};

// ================================================================
// QUERY VENTAS HIELO POR RUTA
// categoria 28 = Hielo
// status IN (2,4,5)
// ================================================================
// DESPUÉS
const queryVentasPorRuta = async (inicio, fin) => {
  // DIST vende mayormente PT-DISTRINTER (hielo). Excluimos categoría BOTELLN
  // para que el dashboard de hielo NO contabilice botellones (p.ej. una
  // orden esporádica como S183426 a GADM Guayaquil con 29 botellones).
  const sql = `
    SELECT
      SUM(dd.total)                   AS dolares,
      SUM(dd.cantidad)                AS unidades,
      COUNT(DISTINCT o.code)          AS cant_ordenes,
      COUNT(DISTINCT o.customer_code) AS cant_clientes
    FROM ordenes o
    JOIN detalle_documento dd ON dd.documento_code = o.code
    WHERE o.campania_id = 5
      AND o.status IN (2)
      AND dd.descripcion_categoria NOT ILIKE '%BOTELL%'
      AND o.fecha_creacion >= :inicio
      AND o.fecha_creacion <  :fin
  `;
  const [row] = await sequelize.query(sql, {
    replacements: { inicio, fin },
    type: Sequelize.QueryTypes.SELECT,
  });
  return [{
    ruta: 'DISTRINTER',
    unidades: Number(row?.unidades || 0),
    dolares: Number(row?.dolares || 0),
    cant_ordenes: Number(row?.cant_ordenes || 0),
    cant_clientes: Number(row?.cant_clientes || 0),
    subtotal: 0,
  }];
};

// ================================================================
// QUERY VENTAS HIELO ODOO GA (Grupo Aqua, company_id=1)
// Ordenes (sale.order) de GRUPOAQUA con categoría HIELO.
// Estas ventas NO están cubiertas por MV (seller_code H%) ni por
// DISTRINTER (campania_id=5), por lo que se suman aparte al total.
// ================================================================
const queryGAHielo = async (inicio, fin) => {
  const sql = `
    SELECT
      COALESCE(SUM(dd.total), 0)      AS dolares,
      COALESCE(SUM(dd.cantidad), 0)   AS unidades,
      COUNT(DISTINCT o.code)          AS cant_ordenes,
      COUNT(DISTINCT o.customer_code) AS cant_clientes
    FROM ordenes o
    JOIN detalle_documento dd ON dd.documento_code = o.code
    WHERE o.campania_id = 1
      AND o.status IN (2)
      AND dd.descripcion_categoria ILIKE '%HIELO%'
      AND o.fecha_creacion >= :inicio
      AND o.fecha_creacion <  :fin
  `;
  const [row] = await sequelize.query(sql, {
    replacements: { inicio, fin },
    type: Sequelize.QueryTypes.SELECT,
  });
  return {
    unidades: Number(row?.unidades || 0),
    dolares: Number(row?.dolares || 0),
    cant_ordenes: Number(row?.cant_ordenes || 0),
    cant_clientes: Number(row?.cant_clientes || 0),
  };
};

// ================================================================
// ENDPOINT PRINCIPAL
// GET /api/ventas/hielo?anio=2026&mes=3
// ================================================================
const obtenerVentasHielo = async (req, res) => {
  try {
    const { anio, mes } = req.query;
    if (!anio || !mes)
      return res.status(400).json({ error: "Debe enviar ?anio=YYYY&mes=MM" });

    const anioNum = parseInt(anio, 10);
    const mesNum = parseInt(mes, 10);
    if (isNaN(anioNum) || isNaN(mesNum) || mesNum < 1 || mesNum > 12)
      return res.status(400).json({ error: "Parámetros anio/mes inválidos." });

    const hoy = new Date();
    const esMesActual = anioNum === hoy.getFullYear() && mesNum === hoy.getMonth() + 1;

    // ── Fechas mes actual ───────────────────────────────────────
    const inicio = getFechaInicioMes(anioNum, mesNum);
    const fin = await getFechaFinQuery(anioNum, mesNum);

    // ── Fechas mes anterior ─────────────────────────────────────
    let mesPrev = mesNum - 1, anioPrev = anioNum;
    if (mesPrev === 0) { mesPrev = 12; anioPrev--; }
    const inicioPrev = getFechaInicioMes(anioPrev, mesPrev);
    const finPrev = getFechaFinMes(anioPrev, mesPrev);

    // ── Días hábiles ────────────────────────────────────────────
    const diasTranscurridos = getDiasHabilesTranscurridos(anioNum, mesNum);
    const diasLaborablesMes = getDiasLaborablesMes(anioNum, mesNum);

    // ── Queries paralelos ───────────────────────────────────────
    const placeholders = RUTAS_ODOO.map((_, i) => `:ruta${i}`).join(', ');
    const rutaBindings = {};
    RUTAS_ODOO.forEach((r, i) => { rutaBindings[`ruta${i}`] = r; });

    const [ventasActual, ventasAnterior, mvActual, mvAnterior, gaActual, gaAnterior, conteosExtra] = await Promise.all([
      queryVentasPorRuta(inicio, fin),
      queryVentasPorRuta(inicioPrev, finPrev),
      queryMVHielo(inicio, fin),
      queryMVHielo(inicioPrev, finPrev),
      queryGAHielo(inicio, fin),
      queryGAHielo(inicioPrev, finPrev),
      sequelize.query(`
        SELECT COUNT(DISTINCT customer_code) AS cant_clientes
        FROM (
          SELECT f.customer_code FROM facturas f
          JOIN detalle_documento dd ON dd.documento_code = f.code
          WHERE (f.seller_code ILIKE 'H%' OR f.seller_code = 'h3')
            AND f.status IN ('2')
            AND dd.descripcion_categoria = 'HIELO'
            AND f.fecha_creacion >= :inicio AND f.fecha_creacion < :fin
          UNION
          SELECT o.customer_code FROM ordenes o
          JOIN detalle_documento dd ON dd.documento_code = o.code
          WHERE o.campania_id = 5
            AND o.status IN (2)
            AND dd.descripcion_categoria NOT ILIKE '%BOTELL%'
            AND o.fecha_creacion >= :inicio AND o.fecha_creacion < :fin
          UNION
          SELECT o.customer_code FROM ordenes o
          JOIN detalle_documento dd ON dd.documento_code = o.code
          WHERE o.campania_id = 1
            AND o.status IN (2)
            AND dd.descripcion_categoria ILIKE '%HIELO%'
            AND o.fecha_creacion >= :inicio AND o.fecha_creacion < :fin
        ) combined
      `, { replacements: { inicio, fin }, type: Sequelize.QueryTypes.SELECT }),
    ]);

    // ── Mapa mes anterior ───────────────────────────────────────
    const mapAnterior = {};
    ventasAnterior.forEach(r => {
      mapAnterior[r.ruta] = {
        unidades: Number(r.unidades) || 0,
        dolares: Number(r.dolares) || 0,
      };
    });

    // ── Construir respuesta por ruta ────────────────────────────
    const rutas = ventasActual.map(r => {
      const unidadesActual = Number(r.unidades) || 0;
      const montoActual = Number(r.dolares) || 0;
      const anterior = mapAnterior[r.ruta] || { unidades: 0, dolares: 0 };

      // Proyección en unidades y dólares
      const proyeccionUnidades = esMesActual && diasTranscurridos > 0
        ? (unidadesActual / diasTranscurridos) * diasLaborablesMes
        : unidadesActual;

      const proyeccionDolares = esMesActual && diasTranscurridos > 0
        ? (montoActual / diasTranscurridos) * diasLaborablesMes
        : montoActual;

      const variacionAbs = unidadesActual - anterior.unidades;
      const variacionPorc = anterior.unidades > 0
        ? (variacionAbs / anterior.unidades) * 100
        : null;

      const variacionDolaresAbs = montoActual - anterior.dolares;
      const variacionDolaresPorc = anterior.dolares > 0
        ? (variacionDolaresAbs / anterior.dolares) * 100
        : null;

      return {
        ruta: r.ruta,
        unidades: unidadesActual,
        dolares: Number(montoActual.toFixed(2)),
        subtotal: Number(Number(r.subtotal).toFixed(2)),
        cant_ordenes: Number(r.cant_ordenes),
        cant_clientes: Number(r.cant_clientes),
        proyeccion_unidades: Number(proyeccionUnidades.toFixed(0)),
        proyeccion_dolares: Number(proyeccionDolares.toFixed(2)),
        mes_anterior: {
          unidades: anterior.unidades,
          dolares: Number(anterior.dolares.toFixed(2)),
        },
        variacion_unidades: {
          abs: Number(variacionAbs.toFixed(0)),
          porcentaje: variacionPorc !== null ? Number(variacionPorc.toFixed(2)) : null,
        },
        variacion_dolares: {
          abs: Number(variacionDolaresAbs.toFixed(2)),
          porcentaje: variacionDolaresPorc !== null ? Number(variacionDolaresPorc.toFixed(2)) : null,
        },
      };
    });

    // ── Totales generales (Odoo + MobilVendor combinados) ───────
    const odooDolares = rutas.reduce((a, r) => a + r.dolares, 0);
    const odooUnidades = rutas.reduce((a, r) => a + r.unidades, 0);
    const odooAntDolares = rutas.reduce((a, r) => a + r.mes_anterior.dolares, 0);
    const odooAntUnidades = rutas.reduce((a, r) => a + r.mes_anterior.unidades, 0);

    const totalDolares = odooDolares + mvActual.dolares + gaActual.dolares;
    const totalUnidades = odooUnidades + mvActual.unidades + gaActual.unidades;
    const totalAntDolares = odooAntDolares + mvAnterior.dolares + gaAnterior.dolares;
    const totalAntUnidades = odooAntUnidades + mvAnterior.unidades + gaAnterior.unidades;

    // Proyección combinada sobre dólares totales
    const proyeccionDolares = esMesActual && diasTranscurridos > 0
      ? (totalDolares / diasTranscurridos) * diasLaborablesMes
      : totalDolares;

    const proyeccionUnidades = esMesActual && diasTranscurridos > 0
      ? (totalUnidades / diasTranscurridos) * diasLaborablesMes
      : totalUnidades;

    // Variación: proyección vs mes anterior (no real vs mes anterior)
    const varDolaresAbs = proyeccionDolares - totalAntDolares;
    const varDolaresPorc = totalAntDolares > 0
      ? (varDolaresAbs / totalAntDolares) * 100
      : null;

    const totales = {
      unidades: totalUnidades,
      dolares: Number(totalDolares.toFixed(2)),
      proyeccion_unidades: Number(proyeccionUnidades.toFixed(0)),
      proyeccion_dolares: Number(proyeccionDolares.toFixed(2)),
      cant_ordenes: rutas.reduce((a, r) => a + r.cant_ordenes, 0) + gaActual.cant_ordenes,
      cant_facturas: mvActual.cant_facturas,
      cant_clientes: Number(conteosExtra[0]?.cant_clientes || 0),
      mes_anterior: {
        unidades: totalAntUnidades,
        dolares: Number(totalAntDolares.toFixed(2)),
      },
      variacion: {
        abs: Number(varDolaresAbs.toFixed(2)),
        porcentaje: varDolaresPorc !== null ? Number(varDolaresPorc.toFixed(2)) : null,
      },
    };

    return res.status(200).json({
      periodo: { anio: anioNum, mes: mesNum, esMesActual },
      fechas: { inicio, fin, inicioPrev, finPrev },
      dias: { transcurridos: diasTranscurridos, laborables: diasLaborablesMes },
      totales,
      rutas,
    });

  } catch (error) {
    console.error("❌ ERROR ventasHielo:", error);
    return res.status(500).json({ message: "Error al obtener ventas hielo" });
  }
};

// ================================================================
// ENDPOINT CLIENTES HIELO — MobilVendor (facturas H*) + Odoo (cat 28)
// Separado por dirección de entrega (customer_address_code)
// GET /api/odoo/hielo-clientes?anio=YYYY&mes=MM
// ================================================================
const obtenerClientesHieloOdoo = async (req, res) => {
  try {
    const { anio, mes } = req.query;
    if (!anio || !mes)
      return res.status(400).json({ error: 'Debe enviar ?anio=YYYY&mes=MM' });

    const anioNum = parseInt(anio, 10);
    const mesNum = parseInt(mes, 10);
    if (isNaN(anioNum) || isNaN(mesNum) || mesNum < 1 || mesNum > 12)
      return res.status(400).json({ error: 'Parámetros inválidos' });

    const inicio = getFechaInicioMes(anioNum, mesNum);
    const fin = await getFechaFinQuery(anioNum, mesNum);

    let mesPrev = mesNum - 1, anioPrev = anioNum;
    if (mesPrev === 0) { mesPrev = 12; anioPrev--; }
    const antInicio = getFechaInicioMes(anioPrev, mesPrev);
    const antFin = getFechaFinMes(anioPrev, mesPrev);

    const inicioAnio = `${anioNum}-01-01 00:00:00`;
    const finAnio = `${anioNum + 1}-01-01 00:00:00`;

    const R = { inicio, fin, antInicio, antFin, inicioAnio, finAnio };

    // ── Filtros base reutilizables ─────────────────────────────────────────────
    // Replican EXACTAMENTE las tres fuentes de la tabla principal (HIELO — VENTAS EMPRESA):
    //   ① MobilVendor: facturas H% / 10 / h3, status='2' + categoría HIELO
    //      (sin categoría entraban $160.77 de botellones de televentas anuladas)
    //   ② Distrinter:  ordenes campania_id=5, status=2 (sin filtro de categoría)
    //   ③ Grupo Aqua: ordenes campania_id=1, status=2 + categoría HIELO
    //      (GA vende otros productos también — sin este filtro entraría todo)
    // Nota: para clientesSQL/ultimaSQL el bloque MV excluye seller_code='10'
    // (televentas anuladas) porque no representan compras reales del cliente.
    const mvWhere = `(seller_code ILIKE 'H%' OR seller_code IN ('10', 'h3')) AND status IN ('2')`;
    // Para conteos de existencia (clientes, última fecha) — sólo compras reales.
    const mvWhereReal = `(seller_code ILIKE 'H%' OR seller_code = 'h3') AND status IN ('2')`;

    // NOTA: customer_address_code es VARCHAR en facturas e INTEGER en ordenes → cast a TEXT.

    // ── 1. Un row por (customer_code, customer_address_code) del año ──────────
    const clientesSQL = `
  SELECT DISTINCT ON (src.customer_code, src.customer_address_code)
    src.customer_code,
    src.customer_address_code,
    c.nombre_cliente,
    c.identificacion_cliente,
    c.tipo_identificacion_cliente,
    tn.descripcion                                              AS tipo_negocio,
    COALESCE(dc.calle1_direccion_cliente, c.direccion_cliente) AS direccion_entrega,
    dc.descripcion_direccion_cliente                           AS descripcion_direccion_cliente,
    COALESCE(dc.telefono_direccion_cliente, c.telefono_cliente) AS telefono_cliente,
    dc.latitud_direccion_cliente                               AS latitud_cliente,
    dc.longitud_direccion_cliente                              AS longitud_cliente
  FROM (
    -- ① MobilVendor filtrado por categoría HIELO; excluye televentas anuladas.
    SELECT DISTINCT f.customer_code, f.customer_address_code::TEXT AS customer_address_code
    FROM facturas f
    JOIN detalle_documento dd ON dd.documento_code = f.code
    WHERE ${mvWhereReal}
      AND dd.descripcion_categoria = 'HIELO'
      AND f.fecha_creacion >= :inicioAnio AND f.fecha_creacion < :finAnio

    UNION

    -- ② Distrinter excluye botellones (dashboard sólo hielo)
    SELECT DISTINCT o.customer_code, o.customer_address_code::TEXT AS customer_address_code
    FROM ordenes o
    JOIN detalle_documento dd ON dd.documento_code = o.code
    WHERE o.campania_id = 5
      AND o.status IN (2)
      AND dd.descripcion_categoria NOT ILIKE '%BOTELL%'
      AND o.fecha_creacion >= :inicioAnio AND o.fecha_creacion < :finAnio

    UNION

    -- ③ Grupo Aqua (campania_id=1) filtrado por categoría HIELO
    SELECT o.customer_code, o.customer_address_code::TEXT AS customer_address_code
    FROM ordenes o
    JOIN detalle_documento dd ON dd.documento_code = o.code
    WHERE o.campania_id = 1
      AND o.status IN (2)
      AND dd.descripcion_categoria ILIKE '%HIELO%'
      AND o.fecha_creacion >= :inicioAnio AND o.fecha_creacion < :finAnio

  ) src
  LEFT JOIN clientes c              ON c.codigo_cliente = src.customer_code
  LEFT JOIN tipos_negocio tn        ON tn.codigo = c.codigo_tipo_negocio
  LEFT JOIN direcciones_clientes dc ON dc.codigo_direccion_cliente::TEXT = src.customer_address_code
  ORDER BY src.customer_code, src.customer_address_code, c.nombre_cliente
`;

    // ── 2. Consumo por (cliente, dirección) ───────────────────────────────────
    // MV niega televentas anuladas (seller_code='10') igual que el principal.
    const consumoSQL = `
  SELECT customer_code, customer_address_code,
    SUM(CASE WHEN fecha >= :inicio    AND fecha < :fin    THEN total    ELSE 0 END) AS consumo_actual,
    SUM(CASE WHEN fecha >= :antInicio AND fecha < :antFin THEN total    ELSE 0 END) AS consumo_anterior,
    SUM(CASE WHEN fecha >= :inicio    AND fecha < :fin    THEN cantidad ELSE 0 END) AS cantidad_actual
  FROM (
    SELECT f.customer_code, f.customer_address_code::TEXT AS customer_address_code,
           f.fecha_creacion AS fecha,
           (CASE WHEN f.seller_code = '10' THEN -dd.total    ELSE dd.total    END) AS total,
           (CASE WHEN f.seller_code = '10' THEN -dd.cantidad ELSE dd.cantidad END) AS cantidad
    FROM facturas f
    JOIN detalle_documento dd ON dd.documento_code = f.code
    WHERE ${mvWhere}
      AND dd.descripcion_categoria = 'HIELO'

    UNION ALL

    -- ② Distrinter excluye botellones (dashboard sólo hielo)
    SELECT o.customer_code, o.customer_address_code::TEXT AS customer_address_code,
           o.fecha_creacion AS fecha, dd.total, dd.cantidad
    FROM ordenes o
    JOIN detalle_documento dd ON dd.documento_code = o.code
    WHERE o.campania_id = 5
      AND o.status IN (2)
      AND dd.descripcion_categoria NOT ILIKE '%BOTELL%'

    UNION ALL

    -- ③ Grupo Aqua (campania_id=1) filtrado por categoría HIELO
    SELECT o.customer_code, o.customer_address_code::TEXT AS customer_address_code,
           o.fecha_creacion AS fecha, dd.total, dd.cantidad
    FROM ordenes o
    JOIN detalle_documento dd ON dd.documento_code = o.code
    WHERE o.campania_id = 1
      AND o.status IN (2)
      AND dd.descripcion_categoria ILIKE '%HIELO%'

  ) comb
  GROUP BY customer_code, customer_address_code
`;

    // ── 3. Máximo consumo mensual del año ─────────────────────────────────────
    const maxConsumoSQL = `
  WITH cm AS (
    SELECT customer_code, customer_address_code,
           DATE_TRUNC('month', fecha) AS mes, SUM(total) AS consumo_mes
    FROM (
      SELECT f.customer_code, f.customer_address_code::TEXT AS customer_address_code,
             f.fecha_creacion AS fecha,
             (CASE WHEN f.seller_code = '10' THEN -dd.total ELSE dd.total END) AS total
      FROM facturas f
      JOIN detalle_documento dd ON dd.documento_code = f.code
      WHERE ${mvWhere}
        AND dd.descripcion_categoria = 'HIELO'
        AND f.fecha_creacion >= :inicioAnio AND f.fecha_creacion < :finAnio

      UNION ALL

      -- ② Distrinter excluye botellones (dashboard sólo hielo)
      SELECT o.customer_code, o.customer_address_code::TEXT AS customer_address_code,
             o.fecha_creacion AS fecha, dd.total
      FROM ordenes o
      JOIN detalle_documento dd ON dd.documento_code = o.code
      WHERE o.campania_id = 5
        AND o.status IN (2)
        AND dd.descripcion_categoria NOT ILIKE '%BOTELL%'
        AND o.fecha_creacion >= :inicioAnio AND o.fecha_creacion < :finAnio

      UNION ALL

      -- ③ Grupo Aqua (campania_id=1) filtrado por categoría HIELO
      SELECT o.customer_code, o.customer_address_code::TEXT AS customer_address_code,
             o.fecha_creacion AS fecha, dd.total
      FROM ordenes o
      JOIN detalle_documento dd ON dd.documento_code = o.code
      WHERE o.campania_id = 1
        AND o.status IN (2)
        AND dd.descripcion_categoria ILIKE '%HIELO%'
        AND o.fecha_creacion >= :inicioAnio AND o.fecha_creacion < :finAnio

    ) comb
    GROUP BY customer_code, customer_address_code, DATE_TRUNC('month', fecha)
  )
  SELECT DISTINCT ON (customer_code, customer_address_code)
    customer_code, customer_address_code, mes, consumo_mes
  FROM cm
  ORDER BY customer_code, customer_address_code, consumo_mes DESC
`;

    // ── 4. Última fecha por (cliente, dirección) ──────────────────────────────
    // MV: sólo HIELO real (excluye televentas anuladas) — la "última factura"
    // representa una compra real, no una venta cancelada.
    const ultimaSQL = `
  SELECT customer_code, customer_address_code, MAX(fecha) AS ultima_factura
  FROM (
    SELECT f.customer_code, f.customer_address_code::TEXT AS customer_address_code,
           f.fecha_creacion AS fecha
    FROM facturas f
    JOIN detalle_documento dd ON dd.documento_code = f.code
    WHERE ${mvWhereReal}
      AND dd.descripcion_categoria = 'HIELO'

    UNION ALL

    -- ② Distrinter excluye botellones (dashboard sólo hielo)
    SELECT o.customer_code, o.customer_address_code::TEXT AS customer_address_code,
           o.fecha_creacion AS fecha
    FROM ordenes o
    JOIN detalle_documento dd ON dd.documento_code = o.code
    WHERE o.campania_id = 5
      AND o.status IN (2)
      AND dd.descripcion_categoria NOT ILIKE '%BOTELL%'

    UNION ALL

    -- ③ Grupo Aqua (campania_id=1) filtrado por categoría HIELO
    SELECT o.customer_code, o.customer_address_code::TEXT AS customer_address_code,
           o.fecha_creacion AS fecha
    FROM ordenes o
    JOIN detalle_documento dd ON dd.documento_code = o.code
    WHERE o.campania_id = 1
      AND o.status IN (2)
      AND dd.descripcion_categoria ILIKE '%HIELO%'

  ) comb
  GROUP BY customer_code, customer_address_code
`;



    // 5. Productos vendidos (solo del mes consultado) — replica EXACTAMENTE las
    //    tres fuentes de la tabla principal para que el total cuadre:
    //    MV filtra HIELO + niega televentas anuladas; DIST sin filtro de
    //    categoría (= principal); GA con filtro HIELO.
    const productosSQL = `
      SELECT descripcion AS producto,
             SUM(cantidad) AS unidades_vendidas,
             SUM(total)    AS monto_usd
      FROM (
        -- ① MobilVendor: HIELO + televentas anuladas en negativo
        SELECT dd.descripcion,
               (CASE WHEN f.seller_code = '10' THEN -dd.cantidad ELSE dd.cantidad END) AS cantidad,
               (CASE WHEN f.seller_code = '10' THEN -dd.total    ELSE dd.total    END) AS total
        FROM facturas f
        JOIN detalle_documento dd ON dd.documento_code = f.code
        WHERE (f.seller_code ILIKE 'H%' OR f.seller_code IN ('10', 'h3'))
          AND f.status IN ('2')
          AND dd.descripcion_categoria = 'HIELO'
          AND f.fecha_creacion >= :inicio AND f.fecha_creacion < :fin

        UNION ALL

        -- ② Distrinter: ordenes campania_id=5 con status=2, excluyendo botellones
        SELECT dd.descripcion, dd.cantidad, dd.total
        FROM ordenes o
        JOIN detalle_documento dd ON dd.documento_code = o.code
        WHERE o.campania_id = 5
          AND o.status IN (2)
          AND dd.descripcion_categoria NOT ILIKE '%BOTELL%'
          AND o.fecha_creacion >= :inicio AND o.fecha_creacion < :fin

        UNION ALL

        -- ③ Grupo Aqua: ordenes campania_id=1 con status=2 filtrado por HIELO
        SELECT dd.descripcion, dd.cantidad, dd.total
        FROM ordenes o
        JOIN detalle_documento dd ON dd.documento_code = o.code
        WHERE o.campania_id = 1
          AND o.status IN (2)
          AND dd.descripcion_categoria ILIKE '%HIELO%'
          AND o.fecha_creacion >= :inicio AND o.fecha_creacion < :fin
      ) comb
      GROUP BY descripcion
      ORDER BY unidades_vendidas DESC
    `;



    const [clientes, consumoData, maxConsumoData, ultimaData, productosVendidosRaw] = await Promise.all([
      sequelize.query(clientesSQL, { replacements: R, type: Sequelize.QueryTypes.SELECT }),
      sequelize.query(consumoSQL, { replacements: R, type: Sequelize.QueryTypes.SELECT }),
      sequelize.query(maxConsumoSQL, { replacements: R, type: Sequelize.QueryTypes.SELECT }),
      sequelize.query(ultimaSQL, { replacements: R, type: Sequelize.QueryTypes.SELECT }),
      sequelize.query(productosSQL, { replacements: R, type: Sequelize.QueryTypes.SELECT }),
    ]);

    // Agrupar productos por nombre limpio (sin código entre corchetes al inicio)
    function limpiarNombreProducto(nombre) {
      // Quita [código] al inicio, espacios extra
      return nombre ? nombre.replace(/^\[[^\]]+\]\s*/, '').trim() : '';
    }
    const productosMap = new Map();
    for (const prod of productosVendidosRaw) {
      const nombreLimpio = limpiarNombreProducto(prod.producto);
      if (!productosMap.has(nombreLimpio)) {
        productosMap.set(nombreLimpio, { producto: nombreLimpio, unidades_vendidas: 0, monto_usd: 0 });
      }
      const p = productosMap.get(nombreLimpio);
      p.unidades_vendidas += Number(prod.unidades_vendidas) || 0;
      p.monto_usd += Number(prod.monto_usd) || 0;
    }
    // Convertir a array y ordenar igual
    const productosVendidos = Array.from(productosMap.values()).sort((a, b) => b.unidades_vendidas - a.unidades_vendidas);

    const clave = (r) => `${r.customer_code}__${r.customer_address_code ?? ''}`;

    const mapConsumo = new Map(consumoData.map(r => [clave(r), r]));
    const mapMaxConsumo = new Map(maxConsumoData.map(r => [clave(r), r]));
    const mapUltima = new Map(ultimaData.map(r => [clave(r), r.ultima_factura]));

    const fmtFecha = (f) => {
      if (!f) return null;
      const d = new Date(f);
      if (isNaN(d.getTime())) return null;
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    };
    const nombreMes = (fecha) => {
      if (!fecha) return null;
      const M = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
      return M[new Date(fecha).getMonth()];
    };

    const resultado = clientes.map(c => {
      const k = clave(c);
      const consumo = mapConsumo.get(k) || {};
      const maxC = mapMaxConsumo.get(k) || {};
      const ultFecha = mapUltima.get(k) || null;

      const consumoActual = Number(consumo.consumo_actual) || 0;
      const consumoAnterior = Number(consumo.consumo_anterior) || 0;
      const varAbs = consumoActual - consumoAnterior;
      const varPorc = consumoAnterior > 0
        ? (varAbs / consumoAnterior) * 100
        : consumoActual > 0 ? 100 : 0;

      return {
        codigo_cliente: c.customer_code,
        codigo_direccion: c.customer_address_code || null,
        nombre_cliente: c.nombre_cliente,
        identificacion_cliente: c.identificacion_cliente || null,
        tipo_identificacion_cliente: c.tipo_identificacion_cliente || null,
        direccion_entrega: c.direccion_entrega,
        descripcion_direccion_cliente: c.descripcion_direccion_cliente,
        tipo_negocio: c.tipo_negocio || 'SIN CLASIFICAR',
        telefono_cliente: c.telefono_cliente || '—',
        latitud_cliente: c.latitud_cliente || '—',
        longitud_cliente: c.longitud_cliente || '—',
        cantidad_productos: Number(consumo.cantidad_actual) || 0,
        consumo_actual: consumoActual.toFixed(2),
        max_consumo: Number(maxC.consumo_mes || 0).toFixed(2),
        mes_max_consumo_nombre: nombreMes(maxC.mes),
        ultima_factura: fmtFecha(ultFecha),
        ultima_visita: fmtFecha(ultFecha),
        vsMesAnterior: {
          monto_anterior: consumoAnterior.toFixed(2),
          variacion_abs: varAbs.toFixed(2),
          variacion_porc: `${varPorc.toFixed(2)}%`,
        },
        tuvo_consumo: consumoActual > 0 ? 'Sí' : 'No',
      };
    });

    const conConsumo = resultado.filter(r => r.tuvo_consumo === 'Sí').length;
    const clientesUnicos = new Set(resultado.map(r => r.codigo_cliente)).size;

    return res.json({
      clientes: resultado,
      resumen: {
        totalClientes: clientesUnicos,
        totalDirecciones: resultado.length,
        clientesConConsumo: conConsumo,
        clientesSinConsumo: resultado.length - conConsumo,
      },
      productosVendidos,
    });

  } catch (error) {
    console.error('❌ ERROR CLIENTES HIELO (MV+ODOO):', error);
    return res.status(500).json({ message: 'Error al obtener clientes hielo', detalle: error.message });
  }
};

// ================================================================
// ENDPOINT PRODUCTOS POR DIRECCIÓN — HIELO
// GET /api/odoo/hielo-productos-direccion?anio=YYYY&mes=MM&customerCode=X&addressCode=Y
// ================================================================
const obtenerProductosClienteHielo = async (req, res) => {
  try {
    const { anio, mes } = req.query;
    const { customerCode, addressCode } = req.query;

    if (!anio || !mes || !customerCode)
      return res.status(400).json({ ok: false, error: 'Faltan parámetros' });

    const anioNum = parseInt(anio, 10);
    const mesNum = parseInt(mes, 10);
    if (isNaN(anioNum) || isNaN(mesNum))
      return res.status(400).json({ ok: false, error: 'Parámetros inválidos' });

    const inicio = getFechaInicioMes(anioNum, mesNum);
    const fin = getFechaFinQuery(anioNum, mesNum);

    // MV: filtra HIELO y niega televentas anuladas (igual que el principal).
    const mvWhere = `(f.seller_code ILIKE 'H%' OR f.seller_code IN ('10', 'h3')) AND f.status IN ('2') AND dd.descripcion_categoria = 'HIELO'`;
    // DIST: excluye botellones (dashboard de hielo).
    const distWhere = `o.campania_id = 5 AND o.status IN (2) AND dd.descripcion_categoria NOT ILIKE '%BOTELL%'`;
    // Grupo Aqua requiere filtro de categoría HIELO porque vende otros productos.
    const gaWhere = `o.campania_id = 1 AND o.status IN (2) AND dd.descripcion_categoria ILIKE '%HIELO%'`;

    const addrFilterMV = addressCode ? `AND f.customer_address_code::TEXT = :addressCode` : '';
    const addrFilterOrden = addressCode ? `AND o.customer_address_code::TEXT = :addressCode` : '';

    const sql = `
      SELECT descripcion AS producto,
             SUM(cantidad) AS unidades_vendidas,
             SUM(total)    AS monto_usd
      FROM (
        SELECT dd.descripcion,
               (CASE WHEN f.seller_code = '10' THEN -dd.cantidad ELSE dd.cantidad END) AS cantidad,
               (CASE WHEN f.seller_code = '10' THEN -dd.total    ELSE dd.total    END) AS total
        FROM facturas f
        JOIN detalle_documento dd ON dd.documento_code = f.code
        WHERE ${mvWhere}
          AND f.customer_code = :customerCode
          ${addrFilterMV}
          AND f.fecha_creacion >= :inicio AND f.fecha_creacion < :fin

        UNION ALL

        SELECT dd.descripcion, dd.cantidad, dd.total
        FROM ordenes o
        JOIN detalle_documento dd ON dd.documento_code = o.code
        WHERE ${distWhere}
          AND o.customer_code = :customerCode
          ${addrFilterOrden}
          AND o.fecha_creacion >= :inicio AND o.fecha_creacion < :fin

        UNION ALL

        -- ③ Grupo Aqua (campania_id=1) filtrado por categoría HIELO
        SELECT dd.descripcion, dd.cantidad, dd.total
        FROM ordenes o
        JOIN detalle_documento dd ON dd.documento_code = o.code
        WHERE ${gaWhere}
          AND o.customer_code = :customerCode
          ${addrFilterOrden}
          AND o.fecha_creacion >= :inicio AND o.fecha_creacion < :fin
      ) comb
      GROUP BY descripcion
      ORDER BY unidades_vendidas DESC
    `;

    const replacements = {
      customerCode,
      addressCode: addressCode || null,
      inicio,
      fin,
    };

    const productos = await sequelize.query(sql, {
      replacements,
      type: Sequelize.QueryTypes.SELECT,
    });

    return res.json({ ok: true, productos });
  } catch (error) {
    console.error('❌ ERROR productos cliente hielo:', error);
    return res.status(500).json({ ok: false, error: error.message });
  }
};

module.exports = { 
  obtenerVentasHielo, 
  obtenerClientesHieloOdoo, 
  obtenerProductosClienteHielo 
};
