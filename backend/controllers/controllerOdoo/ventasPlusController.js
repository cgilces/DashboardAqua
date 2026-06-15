// controllers/controllerOdoo/ventasPlusController.js
// Ventas PLUS ELECTROLYTES (MobilVendor + Odoo)
//   MV   : 1725 LIMON, 1727 NARANJA, 1726 SANDIA (sobre 7g x6)
//   ODOO : 4011 CAJA SANDIA, 1618 SANDIA, 1617 LIMON, 1619 NARANJA

const Sequelize = require("sequelize");
const { sequelize } = require("../../models");
const { getDiasHabilesTranscurridos, getDiasLaborablesMes } = require('../../utils/diasFestivos');
const { dedupeProductosVendidos } = require('../../utils/dedupeProductos');

// Productos PLUS separados por sistema (verificados directo en Odoo).
const PRODUCTOS_PLUS_MV   = ['1725', '1727', '1726'];
const PRODUCTOS_PLUS_ODOO = ['1617', '1618', '1619', '4009', '4010', '4011', '2440', '2441', '2442'];
const PRODUCTOS_PLUS      = [...PRODUCTOS_PLUS_MV, ...PRODUCTOS_PLUS_ODOO];

const inClause = (codes, alias = 'dd') =>
  `${alias}.codigo_producto IN (${codes.map(p => `'${p}'`).join(',')})`;

const plusInClauseMV   = (alias = 'dd') => inClause(PRODUCTOS_PLUS_MV,   alias);
const plusInClauseOdoo = (alias = 'dd') => inClause(PRODUCTOS_PLUS_ODOO, alias);
const plusInClauseAll  = (alias = 'dd') => inClause(PRODUCTOS_PLUS,      alias);

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
// QUERY MV — facturas con productos PLUS
// ================================================================
const queryMVPlus = async (inicio, fin) => {
  const [row] = await sequelize.query(
    `SELECT
        COALESCE(SUM(dd.cantidad), 0)   AS unidades,
        COALESCE(SUM(dd.total),    0)   AS dolares,
        COUNT(DISTINCT f.code)          AS cant_facturas,
        COUNT(DISTINCT f.customer_code) AS cant_clientes
      FROM facturas f
      JOIN detalle_documento dd ON f.code = dd.documento_code
      WHERE ${plusInClauseMV('dd')}
        AND f.status = '2'
        AND f.fecha_creacion >= :inicio
        AND f.fecha_creacion <  :fin`,
    { replacements: { inicio, fin }, type: Sequelize.QueryTypes.SELECT }
  );
  return {
    unidades:      Number(row?.unidades      || 0),
    dolares:       Number(row?.dolares       || 0),
    cant_facturas: Number(row?.cant_facturas || 0),
    cant_clientes: Number(row?.cant_clientes || 0),
  };
};

// ================================================================
// QUERY ODOO — sale.order (pedidos confirmados) con productos PLUS
// ================================================================
const queryOdooPlus = async (inicio, fin) => {
  const [row] = await sequelize.query(
    `SELECT
        COALESCE(SUM(dd.cantidad), 0)   AS unidades,
        COALESCE(SUM(dd.total),    0)   AS dolares,
        COUNT(DISTINCT o.code)          AS cant_ordenes,
        COUNT(DISTINCT o.customer_code) AS cant_clientes
      FROM ordenes o
      JOIN detalle_documento dd ON dd.documento_code = o.code
      WHERE ${plusInClauseOdoo('dd')}
        AND o.status IN (2)
        AND o.fecha_creacion >= :inicio
        AND o.fecha_creacion <  :fin`,
    { replacements: { inicio, fin }, type: Sequelize.QueryTypes.SELECT }
  );
  return {
    unidades:     Number(row?.unidades     || 0),
    dolares:      Number(row?.dolares      || 0),
    cant_ordenes: Number(row?.cant_ordenes || 0),
    cant_clientes:Number(row?.cant_clientes|| 0),
  };
};

// ================================================================
// ENDPOINT PRINCIPAL — Totales agregados Plus (MV+Odoo)
// GET /api/odoo/plus?anio=2026&mes=3
// ================================================================
const obtenerVentasPlus = async (req, res) => {
  try {
    const { anio, mes } = req.query;
    if (!anio || !mes) return res.status(400).json({ error: "Debe enviar ?anio=YYYY&mes=MM" });

    const anioNum = parseInt(anio, 10);
    const mesNum  = parseInt(mes,  10);
    if (isNaN(anioNum) || isNaN(mesNum) || mesNum < 1 || mesNum > 12)
      return res.status(400).json({ error: "Parámetros anio/mes inválidos." });

    const hoy = new Date();
    const esMesActual = anioNum === hoy.getFullYear() && mesNum === hoy.getMonth() + 1;

    const inicio = getFechaInicioMes(anioNum, mesNum);
    const fin    = await getFechaFinQuery(anioNum, mesNum);

    let mesPrev = mesNum - 1, anioPrev = anioNum;
    if (mesPrev === 0) { mesPrev = 12; anioPrev--; }
    const inicioPrev = getFechaInicioMes(anioPrev, mesPrev);
    const finPrev    = getFechaFinMes(anioPrev, mesPrev);

    const diasTranscurridos = getDiasHabilesTranscurridos(anioNum, mesNum);
    const diasLaborablesMes = getDiasLaborablesMes(anioNum, mesNum);

    const [mvActual, mvAnterior, odooActual, odooAnterior, conteosExtra] = await Promise.all([
      queryMVPlus(inicio, fin),
      queryMVPlus(inicioPrev, finPrev),
      queryOdooPlus(inicio, fin),
      queryOdooPlus(inicioPrev, finPrev),
      sequelize.query(`
        SELECT COUNT(DISTINCT customer_code) AS cant_clientes
        FROM (
          SELECT f.customer_code FROM facturas f
          JOIN detalle_documento dd ON dd.documento_code = f.code
          WHERE ${plusInClauseMV('dd')}
            AND f.status = '2'
            AND f.fecha_creacion >= :inicio AND f.fecha_creacion < :fin
          UNION
          SELECT o.customer_code FROM ordenes o
          JOIN detalle_documento dd ON dd.documento_code = o.code
          WHERE ${plusInClauseOdoo('dd')}
            AND o.status IN (2)
            AND o.fecha_creacion >= :inicio AND o.fecha_creacion < :fin
        ) combined
      `, { replacements: { inicio, fin }, type: Sequelize.QueryTypes.SELECT }),
    ]);

    // Total bruto = MV facturas + sale.order Odoo (sin restar NC; las
    // notas de crédito impactan el mes de la NC, no el de la venta original).
    const totalDolares     = mvActual.dolares     + odooActual.dolares;
    const totalUnidades    = mvActual.unidades    + odooActual.unidades;
    const totalAntDolares  = mvAnterior.dolares   + odooAnterior.dolares;
    const totalAntUnidades = mvAnterior.unidades  + odooAnterior.unidades;

    const proyeccionDolares = esMesActual && diasTranscurridos > 0
      ? (totalDolares / diasTranscurridos) * diasLaborablesMes
      : totalDolares;

    const proyeccionUnidades = esMesActual && diasTranscurridos > 0
      ? (totalUnidades / diasTranscurridos) * diasLaborablesMes
      : totalUnidades;

    const varDolaresAbs  = proyeccionDolares - totalAntDolares;
    const varDolaresPorc = totalAntDolares > 0
      ? (varDolaresAbs / totalAntDolares) * 100 : null;

    const totales = {
      unidades:            totalUnidades,
      dolares:             Number(totalDolares.toFixed(2)),
      proyeccion_unidades: Number(proyeccionUnidades.toFixed(0)),
      proyeccion_dolares:  Number(proyeccionDolares.toFixed(2)),
      cant_ordenes:        odooActual.cant_ordenes,
      cant_facturas:       mvActual.cant_facturas,
      cant_clientes:       Number(conteosExtra[0]?.cant_clientes || 0),
      mes_anterior: {
        unidades: totalAntUnidades,
        dolares:  Number(totalAntDolares.toFixed(2)),
      },
      variacion: {
        abs:        Number(varDolaresAbs.toFixed(2)),
        porcentaje: varDolaresPorc !== null ? Number(varDolaresPorc.toFixed(2)) : null,
      },
    };

    return res.status(200).json({
      periodo: { anio: anioNum, mes: mesNum, esMesActual },
      fechas:  { inicio, fin, inicioPrev, finPrev },
      dias:    { transcurridos: diasTranscurridos, laborables: diasLaborablesMes },
      totales,
      rutas: [], // no aplica para Plus, se deja por compatibilidad
    });

  } catch (error) {
    console.error("ERROR ventasPlus:", error);
    return res.status(500).json({ message: "Error al obtener ventas plus" });
  }
};

// ================================================================
// ENDPOINT CLIENTES PLUS — MV (facturas) + Odoo (ordenes) por dirección
// GET /api/odoo/plus-clientes?anio=YYYY&mes=MM
// ================================================================
const obtenerClientesPlusOdoo = async (req, res) => {
  try {
    const { anio, mes } = req.query;
    if (!anio || !mes) return res.status(400).json({ error: 'Debe enviar ?anio=YYYY&mes=MM' });

    const anioNum = parseInt(anio, 10);
    const mesNum  = parseInt(mes,  10);
    if (isNaN(anioNum) || isNaN(mesNum) || mesNum < 1 || mesNum > 12)
      return res.status(400).json({ error: 'Parámetros inválidos' });

    const inicio = getFechaInicioMes(anioNum, mesNum);
    const fin    = await getFechaFinQuery(anioNum, mesNum);

    let mesPrev = mesNum - 1, anioPrev = anioNum;
    if (mesPrev === 0) { mesPrev = 12; anioPrev--; }
    const antInicio = getFechaInicioMes(anioPrev, mesPrev);
    const antFin    = getFechaFinMes(anioPrev, mesPrev);

    const inicioAnio = `${anioNum}-01-01 00:00:00`;
    const finAnio    = `${anioNum + 1}-01-01 00:00:00`;

    const R = { inicio, fin, antInicio, antFin, inicioAnio, finAnio };

    // ── 1. Direcciones distintas del año ──────────────────────────
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
        SELECT DISTINCT f.customer_code, f.customer_address_code::TEXT AS customer_address_code
        FROM facturas f
        JOIN detalle_documento dd ON dd.documento_code = f.code
        WHERE ${plusInClauseMV('dd')}
          AND f.status = '2'
          AND f.fecha_creacion >= :inicioAnio AND f.fecha_creacion < :finAnio

        UNION

        SELECT DISTINCT o.customer_code, o.customer_address_code::TEXT AS customer_address_code
        FROM ordenes o
        JOIN detalle_documento dd ON dd.documento_code = o.code
        WHERE ${plusInClauseOdoo('dd')}
          AND o.status IN (2)
          AND o.fecha_creacion >= :inicioAnio AND o.fecha_creacion < :finAnio
      ) src
      LEFT JOIN clientes c              ON c.codigo_cliente = src.customer_code
      LEFT JOIN tipos_negocio tn        ON tn.codigo = c.codigo_tipo_negocio
      LEFT JOIN direcciones_clientes dc ON dc.codigo_direccion_cliente::TEXT = src.customer_address_code
      ORDER BY src.customer_code, src.customer_address_code, c.nombre_cliente
    `;

    // ── 2. Consumo actual y anterior por dirección ────────────────
    const consumoSQL = `
      SELECT customer_code, customer_address_code,
        SUM(CASE WHEN fecha >= :inicio    AND fecha < :fin    THEN total    ELSE 0 END) AS consumo_actual,
        SUM(CASE WHEN fecha >= :antInicio AND fecha < :antFin THEN total    ELSE 0 END) AS consumo_anterior,
        SUM(CASE WHEN fecha >= :inicio    AND fecha < :fin    THEN cantidad ELSE 0 END) AS cantidad_actual
      FROM (
        SELECT f.customer_code, f.customer_address_code::TEXT AS customer_address_code,
               f.fecha_creacion AS fecha, dd.total, dd.cantidad
        FROM facturas f
        JOIN detalle_documento dd ON dd.documento_code = f.code
        WHERE ${plusInClauseMV('dd')}
          AND f.status = '2'

        UNION ALL

        SELECT o.customer_code, o.customer_address_code::TEXT AS customer_address_code,
               o.fecha_creacion AS fecha, dd.total, dd.cantidad
        FROM ordenes o
        JOIN detalle_documento dd ON dd.documento_code = o.code
        WHERE ${plusInClauseOdoo('dd')}
          AND o.status IN (2)
      ) comb
      GROUP BY customer_code, customer_address_code
    `;

    // ── 3. Máximo consumo mensual del año ─────────────────────────
    const maxConsumoSQL = `
      WITH cm AS (
        SELECT customer_code, customer_address_code,
               DATE_TRUNC('month', fecha) AS mes, SUM(total) AS consumo_mes
        FROM (
          SELECT f.customer_code, f.customer_address_code::TEXT AS customer_address_code,
                 f.fecha_creacion AS fecha, dd.total
          FROM facturas f
          JOIN detalle_documento dd ON dd.documento_code = f.code
          WHERE ${plusInClauseMV('dd')}
            AND f.status = '2'
            AND f.fecha_creacion >= :inicioAnio AND f.fecha_creacion < :finAnio

          UNION ALL

          SELECT o.customer_code, o.customer_address_code::TEXT AS customer_address_code,
                 o.fecha_creacion AS fecha, dd.total
          FROM ordenes o
          JOIN detalle_documento dd ON dd.documento_code = o.code
          WHERE ${plusInClauseOdoo('dd')}
            AND o.status IN (2)
            AND o.fecha_creacion >= :inicioAnio AND o.fecha_creacion < :finAnio
        ) comb
        GROUP BY customer_code, customer_address_code, DATE_TRUNC('month', fecha)
      )
      SELECT DISTINCT ON (customer_code, customer_address_code)
        customer_code, customer_address_code, mes, consumo_mes
      FROM cm
      ORDER BY customer_code, customer_address_code, consumo_mes DESC
    `;

    // ── 4. Última fecha por dirección ─────────────────────────────
    const ultimaSQL = `
      SELECT customer_code, customer_address_code, MAX(fecha) AS ultima_factura
      FROM (
        SELECT f.customer_code, f.customer_address_code::TEXT AS customer_address_code,
               f.fecha_creacion AS fecha
        FROM facturas f
        JOIN detalle_documento dd ON dd.documento_code = f.code
        WHERE ${plusInClauseMV('dd')}
          AND f.status = '2'

        UNION ALL

        SELECT o.customer_code, o.customer_address_code::TEXT AS customer_address_code,
               o.fecha_creacion AS fecha
        FROM ordenes o
        JOIN detalle_documento dd ON dd.documento_code = o.code
        WHERE ${plusInClauseOdoo('dd')}
          AND o.status IN (2)
      ) comb
      GROUP BY customer_code, customer_address_code
    `;

    // ── 5. Productos vendidos del mes ─────────────────────────────
    const productosSQL = `
      SELECT descripcion AS producto,
             SUM(cantidad) AS unidades_vendidas,
             SUM(total)    AS monto_usd
      FROM (
        SELECT dd.descripcion, dd.cantidad, dd.total
        FROM facturas f
        JOIN detalle_documento dd ON dd.documento_code = f.code
        WHERE ${plusInClauseMV('dd')}
          AND f.status = '2'
          AND f.fecha_creacion >= :inicio AND f.fecha_creacion < :fin

        UNION ALL

        SELECT dd.descripcion, dd.cantidad, dd.total
        FROM ordenes o
        JOIN detalle_documento dd ON dd.documento_code = o.code
        WHERE ${plusInClauseOdoo('dd')}
          AND o.status IN (2)
          AND o.fecha_creacion >= :inicio AND o.fecha_creacion < :fin
      ) comb
      GROUP BY descripcion
      ORDER BY unidades_vendidas DESC
    `;

    const [clientes, consumoData, maxConsumoData, ultimaData, productosVendidosRaw] = await Promise.all([
      sequelize.query(clientesSQL,    { replacements: R, type: Sequelize.QueryTypes.SELECT }),
      sequelize.query(consumoSQL,     { replacements: R, type: Sequelize.QueryTypes.SELECT }),
      sequelize.query(maxConsumoSQL,  { replacements: R, type: Sequelize.QueryTypes.SELECT }),
      sequelize.query(ultimaSQL,      { replacements: R, type: Sequelize.QueryTypes.SELECT }),
      sequelize.query(productosSQL,   { replacements: R, type: Sequelize.QueryTypes.SELECT }),
    ]);

    function limpiarNombreProducto(nombre) {
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
      p.monto_usd         += Number(prod.monto_usd)         || 0;
    }
    const productosVendidos = Array.from(productosMap.values()).sort((a, b) => b.unidades_vendidas - a.unidades_vendidas);

    const clave = (r) => `${r.customer_code}__${r.customer_address_code ?? ''}`;

    const mapConsumo    = new Map(consumoData.map(r => [clave(r), r]));
    const mapMaxConsumo = new Map(maxConsumoData.map(r => [clave(r), r]));
    const mapUltima     = new Map(ultimaData.map(r => [clave(r), r.ultima_factura]));

    const fmtFecha = (f) => {
      if (!f) return null;
      const d = new Date(f);
      if (isNaN(d.getTime())) return null;
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    };
    const nombreMes = (fecha) => {
      if (!fecha) return null;
      const M = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
      return M[new Date(fecha).getMonth()];
    };

    const resultado = clientes.map(c => {
      const k = clave(c);
      const consumo = mapConsumo.get(k) || {};
      const maxC    = mapMaxConsumo.get(k) || {};
      const ultFecha = mapUltima.get(k) || null;

      const consumoActual   = Number(consumo.consumo_actual)   || 0;
      const consumoAnterior = Number(consumo.consumo_anterior) || 0;
      const varAbs  = consumoActual - consumoAnterior;
      const varPorc = consumoAnterior > 0
        ? (varAbs / consumoAnterior) * 100
        : consumoActual > 0 ? 100 : 0;

      return {
        codigo_cliente:                c.customer_code,
        codigo_direccion:              c.customer_address_code || null,
        nombre_cliente:                c.nombre_cliente,
        identificacion_cliente:        c.identificacion_cliente || null,
        tipo_identificacion_cliente:   c.tipo_identificacion_cliente || null,
        direccion_entrega:             c.direccion_entrega,
        descripcion_direccion_cliente: c.descripcion_direccion_cliente,
        tipo_negocio:                  c.tipo_negocio || 'SIN CLASIFICAR',
        telefono_cliente:              c.telefono_cliente || '—',
        latitud_cliente:               c.latitud_cliente  || '—',
        longitud_cliente:              c.longitud_cliente || '—',
        cantidad_productos:            Number(consumo.cantidad_actual) || 0,
        consumo_actual:                consumoActual.toFixed(2),
        max_consumo:                   Number(maxC.consumo_mes || 0).toFixed(2),
        mes_max_consumo_nombre:        nombreMes(maxC.mes),
        ultima_factura:                fmtFecha(ultFecha),
        ultima_visita:                 fmtFecha(ultFecha),
        vsMesAnterior: {
          monto_anterior: consumoAnterior.toFixed(2),
          variacion_abs:  varAbs.toFixed(2),
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
        totalClientes:      clientesUnicos,
        totalDirecciones:   resultado.length,
        clientesConConsumo: conConsumo,
        clientesSinConsumo: resultado.length - conConsumo,
      },
      productosVendidos,
    });

  } catch (error) {
    console.error('ERROR CLIENTES PLUS (MV+ODOO):', error);
    return res.status(500).json({ message: 'Error al obtener clientes plus', detalle: error.message });
  }
};

// ================================================================
// ENDPOINT PRODUCTOS POR DIRECCIÓN — PLUS
// GET /api/odoo/plus-productos-direccion?anio=YYYY&mes=MM&customerCode=X&addressCode=Y
// ================================================================
const obtenerProductosClientePlus = async (req, res) => {
  try {
    const { anio, mes, customerCode, addressCode } = req.query;
    if (!anio || !mes || !customerCode)
      return res.status(400).json({ ok: false, error: 'Faltan parámetros' });

    const anioNum = parseInt(anio, 10);
    const mesNum  = parseInt(mes,  10);
    if (isNaN(anioNum) || isNaN(mesNum))
      return res.status(400).json({ ok: false, error: 'Parámetros inválidos' });

    const inicio = getFechaInicioMes(anioNum, mesNum);
    const fin    = getFechaFinQuery(anioNum, mesNum);

    const addrFilterMV    = addressCode ? `AND f.customer_address_code::TEXT = :addressCode` : '';
    const addrFilterOrden = addressCode ? `AND o.customer_address_code::TEXT = :addressCode` : '';

    const sql = `
      SELECT descripcion AS producto,
             SUM(cantidad) AS unidades_vendidas,
             SUM(total)    AS monto_usd
      FROM (
        SELECT dd.descripcion, dd.cantidad, dd.total
        FROM facturas f
        JOIN detalle_documento dd ON dd.documento_code = f.code
        WHERE ${plusInClauseMV('dd')}
          AND f.status = '2'
          AND f.customer_code = :customerCode
          ${addrFilterMV}
          AND f.fecha_creacion >= :inicio AND f.fecha_creacion < :fin

        UNION ALL

        SELECT dd.descripcion, dd.cantidad, dd.total
        FROM ordenes o
        JOIN detalle_documento dd ON dd.documento_code = o.code
        WHERE ${plusInClauseOdoo('dd')}
          AND o.status IN (2)
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

    const productosRaw = await sequelize.query(sql, {
      replacements,
      type: Sequelize.QueryTypes.SELECT,
    });

    return res.json({ ok: true, productos: dedupeProductosVendidos(productosRaw) });
  } catch (error) {
    console.error('ERROR productos cliente plus:', error);
    return res.status(500).json({ ok: false, error: error.message });
  }
};

module.exports = {
  obtenerVentasPlus,
  obtenerClientesPlusOdoo,
  obtenerProductosClientePlus,
};
