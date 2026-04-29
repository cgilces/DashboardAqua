// controllers/COTTSAController.js
const { sequelize, MetaPreventa, CottsaExtraMes } = require('../../models');
const Sequelize = require('sequelize');
const { getDiasHabilesTranscurridos, getDiasLaborablesMes } = require('../../utils/diasFestivos');
const { object: odooObject, loginOdoo } = require('../../services/odooServicio/odooConexion');

CottsaExtraMes.sync().catch(err =>
  console.error('⚠️ sync CottsaExtraMes:', err.message)
);

const COTTSA_COMPANY_ID = 3;

// Rutas COTTSA reportadas. Se usa filtro ESTRICTO (igualdad exacta) para
// excluir variantes como 'RUTA 132.1' que operativamente son cajas POS
// distintas y se reportan aparte. El sync (extraerRutaPorSerie) garantiza
// que las facturas/NotCr lleguen ya con uno de estos 3 valores literales,
// o con 'RUTA 132.1' / null cuando corresponde excluirlas del reporte.
const COTTSA_SELLER_CODES = ['RUTA 113', 'RUTA 131', 'RUTA 132'];
const COTTSA_SELLER_FILTER = `f.seller_code IN (${COTTSA_SELLER_CODES.map(c => `'${c}'`).join(', ')})`;

// ================================================================
// HELPERS
// ================================================================
const obtenerObjetivosGerencia = async (anioNum, mesNum) => {
  try {
    const registros = await MetaPreventa.findAll({
      where: { mes: mesNum, anio: anioNum },
      attributes: ['codigo_ruta', 'meta_dolares', 'meta_unidades'],
      raw: true,
    });

    const mapa = {};
    registros.forEach(m => {
      mapa[String(m.codigo_ruta || '').trim().toUpperCase()] = {
        meta_dolares: Number(m.meta_dolares) || 0,
        meta_unidades: Number(m.meta_unidades) || 0,
      };
    });

    return mapa;
  } catch {
    return {};
  }
};

// ================================================================
// FECHAS
// ================================================================
function getFechaInicioMes(anio, mes) {
  return `${anio}-${String(mes).padStart(2, '0')}-01 00:00:00`;
}

function getFechaFinMes(anio, mes) {
  let mesFin = mes + 1;
  let anioFin = anio;

  if (mesFin === 13) {
    mesFin = 1;
    anioFin++;
  }

  return `${anioFin}-${String(mesFin).padStart(2, '0')}-01 00:00:00`;
}

// ================================================================
// VENTAS POR RUTA
// ================================================================
const obtenerVentasCOTTSAPorRuta = async (anioNum, mesNum, fechaFin = null) => {
  const inicio = getFechaInicioMes(anioNum, mesNum);
  const fin = fechaFin || getFechaFinMes(anioNum, mesNum);

  // Filtro estricto: solo entran 'RUTA 113', 'RUTA 131', 'RUTA 132'.
  // Los POS RUTA 132.1 quedan fuera (gerencia los reporta aparte).
  // SOLO Facts: las NotCr/reembolsos se manejan en una fila de "ajustes"
  // aparte para que el desglose muestre valores brutos por ruta.
  const sql = `
    SELECT
      f.seller_code AS vendedor,
      f.seller_code AS ruta,

      SUM(dd.cantidad) AS unidades,
      SUM(dd.subtotal) AS subtotal,
      SUM(dd.total)    AS dolares,

      COUNT(DISTINCT f.code) AS cant_facturas,
      COUNT(DISTINCT f.customer_code) AS cant_clientes

    FROM facturas f
    JOIN detalle_documento dd ON dd.documento_code = f.code

    WHERE f.company_id = ${COTTSA_COMPANY_ID}
      AND ${COTTSA_SELLER_FILTER}
      AND f.fecha_entrega >= '${inicio}'
      AND f.fecha_entrega < '${fin}'
      AND f.status IN (0,2,3,4,5)
      AND f.tipo_documento = '(01) Invoice'

    GROUP BY f.seller_code
    ORDER BY dolares DESC;
  `;

  return sequelize.query(sql, { type: Sequelize.QueryTypes.SELECT });
};

// ================================================================
// VENTAS POS COTTSA (kenny navas — todas las cajas POS agrupadas)
// Suma Facts y resta NotCr de las series POS:
//   POS RUTA 113 / POS RUTA 131 / RUTA 132.1
// Devuelve UNA sola fila con el agregado.
// ================================================================
const COTTSA_POS_SELLER_CODES = ['POS RUTA 113', 'POS RUTA 131', 'RUTA 132.1'];
const COTTSA_POS_FILTER = `f.seller_code IN (${COTTSA_POS_SELLER_CODES.map(c => `'${c}'`).join(', ')})`;

const obtenerVentasPOSCOTTSA = async (anioNum, mesNum, fechaFin = null) => {
  const inicio = getFechaInicioMes(anioNum, mesNum);
  const fin = fechaFin || getFechaFinMes(anioNum, mesNum);

  // POS NETO = Facts de cajas POS  −  TODAS las NotCr de COTTSA del período.
  // Sumamos todas las NotCr (sin filtrar seller_code) porque históricamente
  // algunas NotCr POS quedaron tageadas como 'RUTA 113'/'RUTA 131' por bugs
  // del post-update y queremos consolidar todos los reembolsos en Kenny Navas.
  const sql = `
    WITH pos_facts AS (
      SELECT
        COALESCE(SUM(dd.cantidad), 0) AS unidades,
        COALESCE(SUM(dd.subtotal), 0) AS subtotal,
        COALESCE(SUM(dd.total), 0)    AS dolares,
        COUNT(DISTINCT f.code)        AS cant_facturas,
        COUNT(DISTINCT f.customer_code) AS cant_clientes
      FROM facturas f
      JOIN detalle_documento dd ON dd.documento_code = f.code
      WHERE f.company_id = ${COTTSA_COMPANY_ID}
        AND ${COTTSA_POS_FILTER}
        AND f.fecha_entrega >= '${inicio}'
        AND f.fecha_entrega < '${fin}'
        AND f.status IN (0,2,3,4,5)
        AND f.tipo_documento = '(01) Invoice'
    ),
    all_notcr AS (
      SELECT
        COALESCE(SUM(dd.cantidad), 0) AS unidades,
        COALESCE(SUM(dd.subtotal), 0) AS subtotal,
        COALESCE(SUM(dd.total), 0)    AS dolares,
        COUNT(DISTINCT f.code)        AS cant_facturas
      FROM facturas f
      JOIN detalle_documento dd ON dd.documento_code = f.code
      WHERE f.company_id = ${COTTSA_COMPANY_ID}
        AND f.fecha_entrega >= '${inicio}'
        AND f.fecha_entrega < '${fin}'
        AND f.status IN (0,2,3,4,5)
        AND f.tipo_documento = '(04) Credit Note'
    )
    SELECT
      (pos_facts.unidades - all_notcr.unidades)     AS unidades,
      (pos_facts.subtotal - all_notcr.subtotal)     AS subtotal,
      (pos_facts.dolares  - all_notcr.dolares)      AS dolares,
      (pos_facts.cant_facturas + all_notcr.cant_facturas) AS cant_facturas,
      pos_facts.cant_clientes                       AS cant_clientes
    FROM pos_facts, all_notcr;
  `;

  const rows = await sequelize.query(sql, { type: Sequelize.QueryTypes.SELECT });
  return rows[0] || { unidades: 0, subtotal: 0, dolares: 0, cant_facturas: 0, cant_clientes: 0 };
};

// ================================================================
// HUÉRFANOS COTTSA — pos.order de Odoo con account_move=false (reembolsos
// POS sin facturar). Se suman a Kenny Navas como descuento aunque todavía
// no estén en la BD para que el total cuadre con Odoo desde el día 1.
// ================================================================
const obtenerHuerfanosTotalCOTTSA = async (anioNum, mesNum) => {
  if (!process.env.ODOO_DB || !process.env.ODOO_API_KEY || !process.env.ODOO_URL) {
    return { total: 0, cantidad: 0 };
  }

  const inicio = `${anioNum}-${String(mesNum).padStart(2, '0')}-01 00:00:00`;
  let mesFin = mesNum + 1;
  let anioFin = anioNum;
  if (mesFin === 13) { mesFin = 1; anioFin++; }
  const fin = `${anioFin}-${String(mesFin).padStart(2, '0')}-01 00:00:00`;

  try {
    const uid = await loginOdoo();
    const huerfanos = await odooExecuteCOTTSA([
      process.env.ODOO_DB, uid, process.env.ODOO_API_KEY,
      'pos.order', 'search_read',
      [[
        ['company_id', '=', COTTSA_COMPANY_ID],
        ['amount_total', '<', 0],
        ['account_move', '=', false],
        ['date_order', '>=', inicio],
        ['date_order', '<', fin],
      ]],
      { fields: ['amount_total'], limit: 0 },
    ]);
    const total = huerfanos.reduce(
      (sum, o) => sum + Math.abs(Number(o.amount_total) || 0),
      0
    );
    return { total: Number(total.toFixed(2)), cantidad: huerfanos.length };
  } catch (err) {
    console.warn('⚠️ obtenerHuerfanosTotalCOTTSA:', err?.message || err);
    return { total: 0, cantidad: 0 };
  }
};

// ================================================================
// ENDPOINT PRINCIPAL
// ================================================================
const obtenerDashboardCOTTSA = async (req, res) => {
  try {
    const { anio, mes } = req.query;

    if (!anio || !mes) {
      return res.status(400).json({ error: 'Debe enviar anio y mes' });
    }

    const anioNum = parseInt(anio, 10);
    const mesNum = parseInt(mes, 10);

    if (isNaN(anioNum) || isNaN(mesNum) || mesNum < 1 || mesNum > 12) {
      return res.status(400).json({ error: 'Parámetros inválidos' });
    }

    const hoy = new Date();
    const esMesCerrado =
      anioNum < hoy.getFullYear() ||
      (anioNum === hoy.getFullYear() && mesNum < hoy.getMonth() + 1);

    const fechaFin = getFechaFinMes(anioNum, mesNum);

    const diasTranscurridos = getDiasHabilesTranscurridos(anioNum, mesNum);
    const diasLaborables = getDiasLaborablesMes(anioNum, mesNum);

    let mesPrev = mesNum - 1;
    let anioPrev = anioNum;

    if (mesPrev === 0) {
      mesPrev = 12;
      anioPrev--;
    }

    const [ventasActuales, ventasAnteriores, ventasPOS, ventasPOSAnt, huerfanosActuales, huerfanosAnt, objetivos] = await Promise.all([
      obtenerVentasCOTTSAPorRuta(anioNum, mesNum, fechaFin),
      obtenerVentasCOTTSAPorRuta(anioPrev, mesPrev),
      obtenerVentasPOSCOTTSA(anioNum, mesNum, fechaFin),
      obtenerVentasPOSCOTTSA(anioPrev, mesPrev),
      obtenerHuerfanosTotalCOTTSA(anioNum, mesNum),
      obtenerHuerfanosTotalCOTTSA(anioPrev, mesPrev),
      obtenerObjetivosGerencia(anioNum, mesNum),
    ]);

    const mapAnterior = {};

    ventasAnteriores.forEach(r => {
      const key = `${(r.ruta || '').toUpperCase()}|${(r.vendedor || '').toUpperCase()}`;
      mapAnterior[key] = Number(r.dolares) || 0;
    });

    const ranking = ventasActuales.map(r => {
      const actual = Number(r.dolares) || 0;
      const key = `${(r.ruta || '').toUpperCase()}|${(r.vendedor || '').toUpperCase()}`;

      const anterior = mapAnterior[key] || 0;

      const base = Math.max(diasTranscurridos, 1);

      const proyeccion = esMesCerrado
        ? actual
        : (actual / base) * diasLaborables;

      const variacionAbs = proyeccion - anterior;

      const variacionPorc = anterior > 0
        ? (variacionAbs / anterior) * 100
        : null;

      const rutaKey = String(r.ruta || '').toUpperCase();

      const obj = objetivos[rutaKey] || {
        meta_dolares: 0,
        meta_unidades: 0,
      };

      return {
        ruta: r.ruta,
        vendedor: r.vendedor,
        unidades: Number(r.unidades) || 0,
        subtotal: Number(r.subtotal) || 0,
        dolares: actual,
        proyeccion: Number(proyeccion.toFixed(2)),
        cant_facturas: Number(r.cant_facturas) || 0,
        cant_clientes: Number(r.cant_clientes) || 0,

        objetivo_gerencia: obj.meta_dolares,
        objetivo_gerencia_unidades: obj.meta_unidades,

        vsMesAnterior: {
          dolares_anterior: Number(anterior.toFixed(2)),
          variacion_abs: Number(variacionAbs.toFixed(2)),
          variacion_porc: variacionPorc !== null ? Number(variacionPorc.toFixed(2)) : null,
        },
      };
    });

    // Bloque POS — Kenny Navas (NETO consolidado).
    // El query SQL ya entrega Facts POS − todas las NotCr COTTSA (BD).
    // Acá le restamos también los reembolsos huérfanos (pos.order sin
    // factura en Odoo) para que el total cuadre con el reporte Odoo,
    // aunque esos huérfanos no existan todavía como account.move en BD.
    const posDolaresBD = Number(ventasPOS.dolares) || 0;
    const posUnidadesBD = Number(ventasPOS.unidades) || 0;
    const posSubtotalBD = Number(ventasPOS.subtotal) || 0;
    const huerfanosTotal = Number(huerfanosActuales?.total) || 0;
    const huerfanosCant = Number(huerfanosActuales?.cantidad) || 0;

    const posDolares = posDolaresBD - huerfanosTotal;
    const posUnidades = posUnidadesBD; // huérfanos no traen unidades
    const posSubtotal = posSubtotalBD - huerfanosTotal;
    const posCantFacturas = (Number(ventasPOS.cant_facturas) || 0) + huerfanosCant;
    const posCantClientes = Number(ventasPOS.cant_clientes) || 0;

    const huerfanosTotalAnt = Number(huerfanosAnt?.total) || 0;
    const posDolaresAntBD = Number(ventasPOSAnt.dolares) || 0;
    const posDolaresAnt = posDolaresAntBD - huerfanosTotalAnt;
    const posVarAbs = posDolares - posDolaresAnt;
    const posVarPorc = posDolaresAnt !== 0
      ? (posVarAbs / Math.abs(posDolaresAnt)) * 100
      : null;

    const pos = {
      label: 'POS - Kenny Navas',
      unidades: posUnidades,
      subtotal: Number(posSubtotal.toFixed(2)),
      dolares: Number(posDolares.toFixed(2)),
      cant_facturas: posCantFacturas,
      cant_clientes: posCantClientes,
      huerfanos: { total: huerfanosTotal, cantidad: huerfanosCant },
      vsMesAnterior: {
        dolares_anterior: Number(posDolaresAnt.toFixed(2)),
        variacion_abs: Number(posVarAbs.toFixed(2)),
        variacion_porc: posVarPorc !== null ? Number(posVarPorc.toFixed(2)) : null,
      },
    };

    // Totales: ranking (3 rutas preventa, brutos) + POS (NETO con huérfanos).
    // Esto cuadra con Total general de Odoo: 145,997.71 en el ejemplo de marzo.
    const totales = {
      unidades: ranking.reduce((a, r) => a + r.unidades, 0) + posUnidades,
      dolares: ranking.reduce((a, r) => a + r.dolares, 0) + posDolares,
      proyeccion: ranking.reduce((a, r) => a + r.proyeccion, 0) + posDolares,
      cant_facturas: ranking.reduce((a, r) => a + r.cant_facturas, 0) + posCantFacturas,
      cant_clientes: ranking.reduce((a, r) => a + r.cant_clientes, 0) + posCantClientes,
    };

    return res.json({ ranking, pos, totales });

  } catch (error) {
    console.error('❌ DASHBOARD:', error);
    return res.status(500).json({ message: 'Error dashboard' });
  }
};

// ================================================================
// ENDPOINT DETALLE POR RUTA / VENDEDOR
// ================================================================
const obtenerDetalleRutaCOTTSA = async (req, res) => {
  try {
    const { ruta, vendedor, anio, mes } = req.query;

    if ((!ruta && !vendedor) || !anio || !mes)
      return res.status(400).json({ error: 'Debe enviar (ruta o vendedor), anio y mes' });

    const anioNum = parseInt(anio, 10);
    const mesNum = parseInt(mes, 10);

    const inicio = getFechaInicioMes(anioNum, mesNum);
    const fin = getFechaFinMes(anioNum, mesNum);

    const inicioAnio = `${anioNum}-01-01 00:00:00`;
    const finAnio = `${anioNum + 1}-01-01 00:00:00`;

    // Igualdad estricta — el seller_code llega exacto desde la tabla principal
    // ('RUTA 113' / 'RUTA 131' / 'RUTA 132'). Sanitizamos comillas para
    // evitar inyección SQL.
    const filtro = vendedor
      ? `f.seller_code = '${String(vendedor).replace(/'/g, "''")}'`
      : `f.route_code = '${String(ruta).replace(/'/g, "''")}'`;

    // ============================
    //  PRODUCTOS (CORREGIDO)
    // ============================
    const productosSql = `
      SELECT
        dd.codigo_producto,
        dd.descripcion,

        SUM(
          CASE 
            WHEN f.tipo_documento = '(01) Invoice' THEN dd.cantidad
            WHEN f.tipo_documento = '(04) Credit Note' THEN -dd.cantidad
            ELSE 0
          END
        ) AS unidades,

        SUM(
          CASE 
            WHEN f.tipo_documento = '(01) Invoice' THEN dd.subtotal
            WHEN f.tipo_documento = '(04) Credit Note' THEN -dd.subtotal
            ELSE 0
          END
        ) AS subtotal,

        SUM(
          CASE 
            WHEN f.tipo_documento = '(01) Invoice' THEN dd.total
            WHEN f.tipo_documento = '(04) Credit Note' THEN -dd.total
            ELSE 0
          END
        ) AS dolares

      FROM facturas f
      JOIN detalle_documento dd ON dd.documento_code = f.code

      WHERE f.company_id = ${COTTSA_COMPANY_ID}
        AND ${COTTSA_SELLER_FILTER}
        AND f.status IN (0,2)
        AND f.tipo_documento IN ('(01) Invoice','(04) Credit Note')
        AND ${filtro}
        AND f.fecha_entrega >= '${inicio}'
        AND f.fecha_entrega <  '${fin}'

      GROUP BY dd.codigo_producto, dd.descripcion
      ORDER BY unidades DESC;
    `;

    // ============================
    //  CLIENTES (SIN CAMBIOS LÓGICOS)
    // ============================
    const clientesSql = `
      SELECT
        COUNT(DISTINCT f.customer_code) AS total_clientes,
        COUNT(DISTINCT CASE
          WHEN f.fecha_entrega >= '${inicio}'
           AND f.fecha_entrega < '${fin}'
          THEN f.customer_code END) AS con_consumo
      FROM facturas f
      WHERE f.company_id = ${COTTSA_COMPANY_ID}
        AND ${COTTSA_SELLER_FILTER}
        AND f.status IN (0,2)
        AND ${filtro}
        AND f.fecha_entrega >= '${inicioAnio}'
        AND f.fecha_entrega < '${finAnio}';
    `;

    const [productos, clientesData] = await Promise.all([
      sequelize.query(productosSql, { type: Sequelize.QueryTypes.SELECT }),
      sequelize.query(clientesSql, { type: Sequelize.QueryTypes.SELECT }),
    ]);

    const totalClientes = Number(clientesData[0]?.total_clientes || 0);
    const conConsumo = Number(clientesData[0]?.con_consumo || 0);

    return res.status(200).json({
      productos,
      resumen: {
        totalClientes,
        conConsumo,
        sinConsumo: totalClientes - conConsumo,
      },
    });

  } catch (error) {
    console.error('❌ Error en obtenerDetalleRutaCOTTSA:', error);
    return res.status(500).json({ message: 'Error interno' });
  }
};

// ================================================================
// ENDPOINT CLIENTES COTTSA (todos los clientes del canal)
// ================================================================
const obtenerClientesCOTTSA = async (req, res) => {
  try {
    const { anio, mes } = req.query;
    if (!anio || !mes)
      return res.status(400).json({ error: 'Debe enviar ?anio=YYYY&mes=MM' });

    const anioNum = parseInt(anio, 10);
    const mesNum = parseInt(mes, 10);
    if (isNaN(anioNum) || isNaN(mesNum) || mesNum < 1 || mesNum > 12)
      return res.status(400).json({ error: 'Parámetros inválidos' });

    const inicio = getFechaInicioMes(anioNum, mesNum);
    const fin = getFechaFinMes(anioNum, mesNum);

    let mesPrev = mesNum - 1, anioPrev = anioNum;
    if (mesPrev === 0) { mesPrev = 12; anioPrev--; }
    const antInicio = getFechaInicioMes(anioPrev, mesPrev);
    const antFin = getFechaFinMes(anioPrev, mesPrev);

    const inicioAnio = `${anioNum}-01-01 00:00:00`;
    const finAnio = `${anioNum + 1}-01-01 00:00:00`;

    // 1. Todos los clientes COTTSA activos en el año
    const clientesSQL = `
      SELECT DISTINCT ON (f.customer_code)
        f.customer_code,
        c.nombre_cliente,
        c.codigo_tipo_negocio,
        tn.descripcion                                               AS tipo_negocio,
        COALESCE(best_dc.calle1_direccion_cliente, c.direccion_cliente)   AS direccion_cliente,
        COALESCE(best_dc.telefono_direccion_cliente, c.telefono_cliente)  AS telefono_cliente,
        COALESCE(best_dc.latitud_direccion_cliente,  c.latitud_cliente::NUMERIC)  AS latitud_direccion_cliente,
        COALESCE(best_dc.longitud_direccion_cliente, c.longitud_cliente::NUMERIC) AS longitud_direccion_cliente
      FROM facturas f
      LEFT JOIN clientes c         ON c.codigo_cliente = f.customer_code
      LEFT JOIN tipos_negocio tn   ON tn.codigo = c.codigo_tipo_negocio
      LEFT JOIN LATERAL (
        SELECT calle1_direccion_cliente,
               telefono_direccion_cliente,
               latitud_direccion_cliente,
               longitud_direccion_cliente
        FROM direcciones_clientes
        WHERE codigo_cliente = f.customer_code
        ORDER BY
          (latitud_direccion_cliente  IS NOT NULL AND longitud_direccion_cliente IS NOT NULL) DESC,
          (telefono_direccion_cliente IS NOT NULL) DESC
        LIMIT 1
      ) best_dc ON true
      WHERE f.company_id = ${COTTSA_COMPANY_ID}
        AND ${COTTSA_SELLER_FILTER}
        AND f.status IN (0,2,3,4,5)
        AND f.fecha_entrega >= '${inicioAnio}'
        AND f.fecha_entrega  < '${finAnio}'
      ORDER BY f.customer_code
    `;



    // 2. Consumo actual + anterior + cantidad por cliente
    const consumoSQL = `
  SELECT
    f.customer_code,

    SUM(
      CASE 
        WHEN f.fecha_entrega >= '${inicio}' AND f.fecha_entrega < '${fin}'
          THEN dd.total
        ELSE 0
      END
    ) AS consumo_actual,

    SUM(
      CASE 
        WHEN f.fecha_entrega >= '${antInicio}' AND f.fecha_entrega < '${antFin}'
          THEN dd.total
        ELSE 0
      END
    ) AS consumo_anterior,

    SUM(
      CASE 
        WHEN f.fecha_entrega >= '${inicio}' AND f.fecha_entrega < '${fin}'
          THEN dd.cantidad
        ELSE 0
      END
    ) AS cantidad_actual

  FROM facturas f
  JOIN detalle_documento dd
    ON dd.documento_code = f.code

  WHERE f.company_id = ${COTTSA_COMPANY_ID}
    AND ${COTTSA_SELLER_FILTER}
    AND f.status IN (0,2,3,4,5)
    AND f.fecha_entrega >= '${inicioAnio}'
    AND f.fecha_entrega < '${finAnio}'

  GROUP BY f.customer_code
`;

    // 3. Máximo consumo mensual del año por cliente
    const maxConsumoSQL = `
  WITH consumo_mensual AS (
    SELECT
      f.customer_code,
      DATE_TRUNC('month', f.fecha_entrega) AS mes,
      SUM(dd.total) AS consumo_mes
    FROM facturas f
    JOIN detalle_documento dd
      ON dd.documento_code = f.code

    WHERE f.company_id = ${COTTSA_COMPANY_ID}
      AND ${COTTSA_SELLER_FILTER}
      AND f.status IN (0,2,3,4,5)
      AND f.fecha_entrega >= '${inicioAnio}'
      AND f.fecha_entrega < '${finAnio}'

    GROUP BY
      f.customer_code,
      DATE_TRUNC('month', f.fecha_entrega)
  )
  SELECT DISTINCT ON (customer_code)
    customer_code,
    mes,
    consumo_mes
  FROM consumo_mensual
  ORDER BY customer_code, consumo_mes DESC
`;

    // 4. Última factura COTTSA por cliente
    const ultimaFacturaSQL = `
  SELECT
    f.customer_code,
    MAX(COALESCE(f.fecha_autorizacion, f.fecha_entrega, f.fecha_creacion)) AS ultima_factura
  FROM facturas f

  WHERE f.company_id = ${COTTSA_COMPANY_ID}
    AND ${COTTSA_SELLER_FILTER}
    AND f.status IN (0,2,3,4,5)

  GROUP BY f.customer_code
`;


    const [clientes, consumoData, maxConsumoData, ultimasFacturas] = await Promise.all([
      sequelize.query(clientesSQL, { type: Sequelize.QueryTypes.SELECT }),
      sequelize.query(consumoSQL, { type: Sequelize.QueryTypes.SELECT }),
      sequelize.query(maxConsumoSQL, { type: Sequelize.QueryTypes.SELECT }),
      sequelize.query(ultimaFacturaSQL, { type: Sequelize.QueryTypes.SELECT }),
    ]);

    const mapConsumo = new Map(consumoData.map(r => [r.customer_code, r]));
    const mapMaxConsumo = new Map(maxConsumoData.map(r => [r.customer_code, r]));
    const mapUltimaFact = new Map(ultimasFacturas.map(r => [r.customer_code, r.ultima_factura]));

    const fmtFecha = (f) => {
      if (!f) return null;
      const d = new Date(f);
      if (isNaN(d.getTime())) return null;
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    };

    const nombreMes = (fecha) => {
      if (!fecha) return null;
      const meses = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
      return meses[new Date(fecha).getMonth()];
    };

    const resultado = clientes.map(c => {
      const consumo = mapConsumo.get(c.customer_code) || {};
      const maxC = mapMaxConsumo.get(c.customer_code) || {};
      const ultFact = mapUltimaFact.get(c.customer_code) || null;

      const consumoActual = Number(consumo.consumo_actual) || 0;
      const consumoAnterior = Number(consumo.consumo_anterior) || 0;
      const varAbs = consumoActual - consumoAnterior;
      const varPorc = consumoAnterior > 0
        ? (varAbs / consumoAnterior) * 100
        : consumoActual > 0 ? 100 : 0;

      return {
        codigo_cliente: c.customer_code,
        nombre_cliente: c.nombre_cliente,
        direccion_entrega: c.direccion_cliente,
        tipo_negocio: c.tipo_negocio || 'SIN CLASIFICAR',
        telefono_cliente: c.telefono_cliente || '—',
        latitud_cliente: c.latitud_direccion_cliente || '—',
        longitud_cliente: c.longitud_direccion_cliente || '—',
        cantidad_productos: Number(consumo.cantidad_actual) || 0,
        consumo_actual: Number(consumoActual.toFixed(2)),
        max_consumo: Number(maxC.consumo_mes || 0).toFixed(2),
        mes_max_consumo_nombre: nombreMes(maxC.mes),
        ultima_factura: fmtFecha(ultFact),
        ultima_visita: fmtFecha(ultFact),
        vsMesAnterior: {
          monto_anterior: consumoAnterior.toFixed(2),
          variacion_abs: varAbs.toFixed(2),
          variacion_porc: `${varPorc.toFixed(2)}%`,
        },
        tuvo_consumo: consumoActual > 0 ? 'Sí' : 'No',
      };
    });

    const conConsumo = resultado.filter(r => r.tuvo_consumo === 'Sí').length;

    const productosVendidos = await sequelize.query(`
  SELECT 
    dd.descripcion AS producto,

    SUM(
      CASE 
        WHEN f.tipo_documento = '(01) Invoice' THEN dd.cantidad
        WHEN f.tipo_documento = '(04) Credit Note' THEN -dd.cantidad
        ELSE 0
      END
    ) AS unidades_vendidas,

    SUM(
      CASE 
        WHEN f.tipo_documento = '(01) Invoice' THEN dd.total
        WHEN f.tipo_documento = '(04) Credit Note' THEN -dd.total
        ELSE 0
      END
    ) AS monto_usd

  FROM facturas f
  JOIN detalle_documento dd
    ON dd.documento_code = f.code

  WHERE f.company_id = ${COTTSA_COMPANY_ID}
    AND ${COTTSA_SELLER_FILTER}
    AND f.status IN (0,2,3,4,5)
    AND f.tipo_documento IN ('(01) Invoice','(04) Credit Note')
    AND f.fecha_entrega >= '${inicio}'
    AND f.fecha_entrega <  '${fin}'

  GROUP BY dd.descripcion
  ORDER BY unidades_vendidas DESC
`, { type: Sequelize.QueryTypes.SELECT });

    return res.json({
      clientes: resultado,
      resumen: {
        totalClientes: resultado.length,
        clientesConConsumo: conConsumo,
        clientesSinConsumo: resultado.length - conConsumo,
      },
      productosVendidos,
    });

  } catch (error) {
    console.error('❌ ERROR CLIENTES COTTSA:', error);
    return res.status(500).json({ message: 'Error al obtener clientes COTTSA' });
  }
};

// ================================================================
// ENDPOINT DIAGNÓSTICO — comparar header total vs detalle total
// GET /api/COTTSA/diagnostico?anio=YYYY&mes=MM
// ================================================================
const diagnosticoCOTTSA = async (req, res) => {
  try {
    const { anio, mes } = req.query;
    const anioNum = parseInt(anio, 10);
    const mesNum = parseInt(mes, 10);

    const inicio = getFechaInicioMes(anioNum, mesNum);
    const fin = getFechaFinMes(anioNum, mesNum);

    const [porStatus, headerVsDetalle, porCompany] = await Promise.all([

      // ① Facturas por status (COTTSA)
      sequelize.query(`
        SELECT status,
               COUNT(*) AS cant,
               SUM(total) AS total_header
        FROM facturas
        WHERE company_id = ${COTTSA_COMPANY_ID}
          AND fecha_entrega >= '${inicio}'
          AND fecha_entrega < '${fin}'
        GROUP BY status
        ORDER BY status
      `, { type: Sequelize.QueryTypes.SELECT }),

      // ② Header vs Detalle (consistencia real)
      sequelize.query(`
        SELECT
          COUNT(DISTINCT f.code) AS facturas_con_detalle,
          SUM(f.total)           AS total_header,
          SUM(dd.total)          AS total_detalle,
          SUM(dd.cantidad)       AS unidades_detalle
        FROM facturas f
        JOIN detalle_documento dd 
          ON dd.documento_code = f.code
        WHERE f.company_id = ${COTTSA_COMPANY_ID}
          AND f.status IN (0,2,3,4,5)
          AND f.fecha_entrega >= '${inicio}'
          AND f.fecha_entrega < '${fin}'
      `, { type: Sequelize.QueryTypes.SELECT }),

      // ③ Distribución por empresa y estado (CORREGIDO)
      sequelize.query(`
        SELECT 
          company_id,
          status,
          COUNT(*) AS cant,
          SUM(total) AS total_header
        FROM facturas
        WHERE company_id = ${COTTSA_COMPANY_ID}
          AND fecha_entrega >= '${inicio}'
          AND fecha_entrega < '${fin}'
          AND status IN (0,2,3,4,5)
        GROUP BY company_id, status
        ORDER BY company_id, status
      `, { type: Sequelize.QueryTypes.SELECT }),

    ]);

    return res.json({
      periodo: `${anioNum}-${String(mesNum).padStart(2, '0')}`,
      porStatus,
      headerVsDetalle,
      porCompany
    });

  } catch (error) {
    console.error('❌ ERROR DIAGNÓSTICO COTTSA:', error);
    return res.status(500).json({ message: 'Error diagnóstico' });
  }
};

// ================================================================
// COTTSA — Datos externos (manualmente ingresados desde otro sistema)
// GET  /api/COTTSA/extra?anio=YYYY&mes=MM   → devuelve el registro (o 0s)
// PUT  /api/COTTSA/extra                    → upsert (anio, mes, unidades, dolares, facturas)
// ================================================================
const obtenerCottsaExtra = async (req, res) => {
  try {
    const anio = parseInt(req.query.anio, 10);
    const mes = parseInt(req.query.mes, 10);
    if (isNaN(anio) || isNaN(mes) || mes < 1 || mes > 12)
      return res.status(400).json({ error: 'Parámetros inválidos' });

    const reg = await CottsaExtraMes.findOne({ where: { anio, mes }, raw: true });
    return res.json({
      anio,
      mes,
      unidades: reg ? Number(reg.unidades) : 0,
      dolares: reg ? Number(reg.dolares) : 0,
      facturas: reg ? Number(reg.facturas) : 0,
      actualizado_por: reg ? reg.actualizado_por : null,
      updated_at: reg ? reg.updated_at : null,
    });
  } catch (err) {
    console.error('❌ obtenerCottsaExtra:', err);
    return res.status(500).json({ error: 'Error al obtener datos externos COTTSA' });
  }
};

const guardarCottsaExtra = async (req, res) => {
  try {
    const anio = parseInt(req.body.anio, 10);
    const mes = parseInt(req.body.mes, 10);
    const unidades = Number(req.body.unidades) || 0;
    const dolares = Number(req.body.dolares) || 0;
    const facturas = parseInt(req.body.facturas, 10) || 0;
    const actualizado_por = (req.user?.username || req.user?.email || null);

    if (isNaN(anio) || isNaN(mes) || mes < 1 || mes > 12)
      return res.status(400).json({ error: 'Parámetros inválidos' });
    if (unidades < 0 || dolares < 0 || facturas < 0)
      return res.status(400).json({ error: 'Los valores no pueden ser negativos' });

    const [reg, creado] = await CottsaExtraMes.findOrCreate({
      where: { anio, mes },
      defaults: { anio, mes, unidades, dolares, facturas, actualizado_por },
    });

    if (!creado) {
      reg.unidades = unidades;
      reg.dolares = dolares;
      reg.facturas = facturas;
      reg.actualizado_por = actualizado_por;
      await reg.save();
    }

    return res.json({
      anio,
      mes,
      unidades: Number(reg.unidades),
      dolares: Number(reg.dolares),
      facturas: Number(reg.facturas),
      actualizado_por: reg.actualizado_por,
      updated_at: reg.updated_at,
    });
  } catch (err) {
    console.error('❌ guardarCottsaExtra:', err);
    return res.status(500).json({ error: 'Error al guardar datos externos COTTSA' });
  }
};

// ================================================================
// ENDPOINT REEMBOLSOS HUÉRFANOS (POS sin facturar en Odoo)
// GET /api/COTTSA/reembolsos-huerfanos?anio=YYYY&mes=MM
//
// Lee directo de Odoo los pos.order de COTTSA con monto negativo
// (reembolsos) que quedaron en estado 'paid' SIN account_move.
// Esos no llegan al sync porque no existen como nota de crédito fiscal.
// El frontend usa esto para mostrar un banner de alerta en la tabla.
// ================================================================
const odooExecuteCOTTSA = (params) =>
  new Promise((resolve, reject) => {
    odooObject.methodCall('execute_kw', params, (err, result) => {
      if (err) return reject(err);
      resolve(result);
    });
  });

const obtenerReembolsosHuerfanos = async (req, res) => {
  try {
    const { anio, mes } = req.query;

    if (!anio || !mes) {
      return res.status(400).json({ error: 'Debe enviar anio y mes' });
    }

    const anioNum = parseInt(anio, 10);
    const mesNum = parseInt(mes, 10);

    if (isNaN(anioNum) || isNaN(mesNum) || mesNum < 1 || mesNum > 12) {
      return res.status(400).json({ error: 'Parámetros inválidos' });
    }

    // Rango del mes (formato Odoo: 'YYYY-MM-DD HH:MM:SS')
    const inicio = `${anioNum}-${String(mesNum).padStart(2, '0')}-01 00:00:00`;
    let mesFin = mesNum + 1;
    let anioFin = anioNum;
    if (mesFin === 13) { mesFin = 1; anioFin++; }
    const fin = `${anioFin}-${String(mesFin).padStart(2, '0')}-01 00:00:00`;

    // Si no hay credenciales Odoo configuradas, devolvemos vacío (no romper UI)
    if (!process.env.ODOO_DB || !process.env.ODOO_API_KEY || !process.env.ODOO_URL) {
      return res.json({ cantidad: 0, total: 0, reembolsos: [], advertencia: 'Odoo no configurado' });
    }

    const uid = await loginOdoo();

    const huerfanos = await odooExecuteCOTTSA([
      process.env.ODOO_DB, uid, process.env.ODOO_API_KEY,
      'pos.order', 'search_read',
      [[
        ['company_id', '=', COTTSA_COMPANY_ID],
        ['amount_total', '<', 0],
        ['account_move', '=', false],
        ['date_order', '>=', inicio],
        ['date_order', '<', fin],
      ]],
      {
        fields: ['id', 'name', 'pos_reference', 'state', 'amount_total', 'partner_id', 'date_order'],
        limit: 0,
        order: 'date_order desc',
      },
    ]);

    const total = huerfanos.reduce(
      (sum, o) => sum + Math.abs(Number(o.amount_total) || 0),
      0
    );

    const reembolsos = huerfanos.map(o => {
      const rutaMatch = String(o.name || '').match(/RUTA\s*\d+(\.\d+)?/i);
      return {
        id: o.id,
        name: o.name,
        pos_reference: o.pos_reference,
        cliente: Array.isArray(o.partner_id) ? o.partner_id[1] : '—',
        monto: Number((Math.abs(Number(o.amount_total) || 0)).toFixed(2)),
        fecha: o.date_order,
        ruta: rutaMatch ? rutaMatch[0].toUpperCase().replace(/\s+/g, ' ') : '—',
        estado: o.state,
      };
    });

    return res.json({
      cantidad: reembolsos.length,
      total: Number(total.toFixed(2)),
      reembolsos,
    });
  } catch (err) {
    console.error('❌ obtenerReembolsosHuerfanos:', err);
    return res.status(500).json({
      error: 'Error al consultar reembolsos huérfanos en Odoo',
      detalle: err?.message || String(err),
    });
  }
};

// ================================================================
// ENDPOINT POS DETALLE — todo lo que cae bajo "Kenny Navas"
// GET /api/COTTSA/pos-detalle?anio=YYYY&mes=MM
//
// Lee directo de Odoo TODOS los pos.order de COTTSA del período
// (Facts, NotCr, facturados y huérfanos) para mostrar en un modal
// el detalle completo del bloque POS - Kenny Navas.
// ================================================================
const obtenerPOSDetalleCOTTSA = async (req, res) => {
  try {
    const { anio, mes } = req.query;

    if (!anio || !mes) {
      return res.status(400).json({ error: 'Debe enviar anio y mes' });
    }

    const anioNum = parseInt(anio, 10);
    const mesNum = parseInt(mes, 10);

    if (isNaN(anioNum) || isNaN(mesNum) || mesNum < 1 || mesNum > 12) {
      return res.status(400).json({ error: 'Parámetros inválidos' });
    }

    if (!process.env.ODOO_DB || !process.env.ODOO_API_KEY || !process.env.ODOO_URL) {
      return res.json({
        items: [],
        totales: { facts: 0, notcr: 0, huerfanos: 0, neto: 0,
                   cantidad_total: 0, cantidad_facturados: 0, cantidad_huerfanos: 0 },
      });
    }

    const inicio = `${anioNum}-${String(mesNum).padStart(2, '0')}-01 00:00:00`;
    let mesFin = mesNum + 1;
    let anioFin = anioNum;
    if (mesFin === 13) { mesFin = 1; anioFin++; }
    const fin = `${anioFin}-${String(mesFin).padStart(2, '0')}-01 00:00:00`;

    // 1) Buscar en BD los facturas que cuentan en "Kenny Navas":
    //    - Facts del bucket POS (POS RUTA 113 / POS RUTA 131 / RUTA 132.1)
    //    - TODAS las NotCr de COTTSA (sin filtrar seller_code, captura las
    //      que pueden estar mal etiquetadas como 'RUTA 113'/'RUTA 131')
    const inicioBD = `${anioNum}-${String(mesNum).padStart(2, '0')}-01 00:00:00`;
    const finBD = fin; // mismo formato YYYY-MM-DD HH:MM:SS

    const docsBD = await sequelize.query(`
      SELECT f.odoo_id, f.code, f.total, f.seller_code, f.tipo_documento, f.customer_code
      FROM facturas f
      WHERE f.company_id = ${COTTSA_COMPANY_ID}
        AND f.fecha_entrega >= '${inicioBD}'
        AND f.fecha_entrega < '${finBD}'
        AND f.status IN (0,2,3,4,5)
        AND (
          (f.tipo_documento = '(01) Invoice' AND ${COTTSA_POS_FILTER})
          OR f.tipo_documento = '(04) Credit Note'
        )
    `, { type: Sequelize.QueryTypes.SELECT });

    const odooIdsKennyNavas = docsBD.map(d => d.odoo_id).filter(Boolean);

    const uid = await loginOdoo();

    // 2) Traer las pos.order que tienen account_move enlazado a esos docs.
    let posOrdersFacturados = [];
    if (odooIdsKennyNavas.length) {
      posOrdersFacturados = await odooExecuteCOTTSA([
        process.env.ODOO_DB, uid, process.env.ODOO_API_KEY,
        'pos.order', 'search_read',
        [[
          ['company_id', '=', COTTSA_COMPANY_ID],
          ['account_move', 'in', odooIdsKennyNavas],
        ]],
        {
          fields: [
            'id', 'name', 'pos_reference', 'date_order',
            'amount_total', 'partner_id', 'account_move',
            'session_id', 'state',
          ],
          limit: 0,
          order: 'date_order desc',
        },
      ]);
    }

    // 3) Traer huérfanos (pos.order con account_move=false en el período).
    const posOrdersHuerfanos = await odooExecuteCOTTSA([
      process.env.ODOO_DB, uid, process.env.ODOO_API_KEY,
      'pos.order', 'search_read',
      [[
        ['company_id', '=', COTTSA_COMPANY_ID],
        ['amount_total', '<', 0],
        ['account_move', '=', false],
        ['date_order', '>=', inicio],
        ['date_order', '<', fin],
      ]],
      {
        fields: [
          'id', 'name', 'pos_reference', 'date_order',
          'amount_total', 'partner_id', 'account_move',
          'session_id', 'state',
        ],
        limit: 0,
        order: 'date_order desc',
      },
    ]);

    // 4) Combinar y deduplicar por id
    const seen = new Set();
    const posOrders = [...posOrdersFacturados, ...posOrdersHuerfanos]
      .filter(o => {
        if (seen.has(o.id)) return false;
        seen.add(o.id);
        return true;
      })
      .sort((a, b) => String(b.date_order || '').localeCompare(String(a.date_order || '')));

    let totalFacts = 0;
    let totalNotCr = 0;
    let totalHuerfanos = 0;
    let cantFacturados = 0;
    let cantHuerfanos = 0;

    const items = posOrders.map(o => {
      const monto = Number(o.amount_total) || 0;
      const docName = Array.isArray(o.account_move) ? o.account_move[1] : null;
      const docId = Array.isArray(o.account_move) ? o.account_move[0] : null;
      const cliente = Array.isArray(o.partner_id) ? o.partner_id[1] : '—';
      const facturado = Boolean(docId);
      const sesion = Array.isArray(o.session_id) ? o.session_id[1] : null;

      // Identificar el tipo: si monto < 0 es reembolso (NotCr esperada),
      // si >= 0 es venta (Fact esperada)
      let tipo;
      if (monto < 0) {
        if (facturado) {
          totalNotCr += Math.abs(monto);
          cantFacturados++;
          tipo = 'NotCr';
        } else {
          totalHuerfanos += Math.abs(monto);
          cantHuerfanos++;
          tipo = 'NotCr (huérfano)';
        }
      } else {
        totalFacts += monto;
        if (facturado) cantFacturados++;
        tipo = 'Fact';
      }

      // Extraer ruta del nombre del POS (ej. "RUTA 131/7340 REEMBOLSO" → "RUTA 131")
      const rutaMatch = String(o.name || '').match(/RUTA\s*\d+(\.\d+)?/i);
      const ruta = rutaMatch ? rutaMatch[0].toUpperCase().replace(/\s+/g, ' ') : '—';

      return {
        id: o.id,
        caja: o.name,                    // "RUTA 131/7340 REEMBOLSO"
        pos_reference: o.pos_reference,  // "POS/32960"
        sesion,                           // "POS/32960" (también del session_id)
        ruta,                             // "RUTA 131"
        date_order: o.date_order,
        cliente,
        monto: Number(monto.toFixed(2)),
        documento: docName,               // "NotCr 001-027-000000930" o null
        tipo,                             // 'Fact' | 'NotCr' | 'NotCr (huérfano)'
        facturado,
        es_reembolso: monto < 0,
      };
    });

    const neto = totalFacts - totalNotCr - totalHuerfanos;

    return res.json({
      items,
      totales: {
        facts: Number(totalFacts.toFixed(2)),
        notcr: Number(totalNotCr.toFixed(2)),
        huerfanos: Number(totalHuerfanos.toFixed(2)),
        neto: Number(neto.toFixed(2)),
        cantidad_total: items.length,
        cantidad_facturados: cantFacturados,
        cantidad_huerfanos: cantHuerfanos,
      },
    });
  } catch (err) {
    console.error('❌ obtenerPOSDetalleCOTTSA:', err);
    return res.status(500).json({
      error: 'Error al consultar detalle POS',
      detalle: err?.message || String(err),
    });
  }
};

module.exports = {
  obtenerDashboardCOTTSA,
  obtenerDetalleRutaCOTTSA,
  obtenerClientesCOTTSA,
  diagnosticoCOTTSA,
  obtenerCottsaExtra,
  guardarCottsaExtra,
  obtenerReembolsosHuerfanos,
  obtenerPOSDetalleCOTTSA,
};