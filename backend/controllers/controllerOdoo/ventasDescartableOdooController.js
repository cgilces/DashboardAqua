// controllers/ventasDescartableOdooController.js
// Muestra ventas de productos DESCARTABLE (categoria 7)
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
// QUERY VENTAS DESCARTABLE ODOO POR RUTA
// Usa tabla ordenes (type=2) filtrado por seller_nombre
// Status 2 = sale/done (confirmadas en Odoo)
// ================================================================
const queryVentasPorRuta = async (inicio, fin) => {
  const placeholders = RUTAS_ODOO.map((_, i) => `:ruta${i}`).join(", ");
  const replacements = {};
  RUTAS_ODOO.forEach((r, i) => { replacements[`ruta${i}`] = r; });
  replacements.inicio = inicio;
  replacements.fin    = fin;

  const sql = `
    SELECT
      o.seller_nombre                 AS ruta,
      SUM(dd.cantidad)                AS unidades,
      SUM(dd.subtotal)                AS subtotal,
      SUM(dd.total)                   AS dolares,
      COUNT(DISTINCT o.code)          AS cant_ordenes,
      COUNT(DISTINCT o.customer_code) AS cant_clientes
    FROM ordenes o
    JOIN detalle_documento dd ON dd.documento_code = o.code
    WHERE
      o.type = 2
      AND o.status IN (2, 4, 5)
      AND dd.codigo_categoria = '7'
      AND o.seller_nombre IN (${placeholders})
      AND o.fecha_creacion >= :inicio
      AND o.fecha_creacion <  :fin
    GROUP BY o.seller_nombre
    ORDER BY dolares DESC
  `;

  return await sequelize.query(sql, {
    replacements,
    type: Sequelize.QueryTypes.SELECT,
  });
};

// ================================================================
// ENDPOINT PRINCIPAL
// GET /api/descartable-odoo?anio=2026&mes=3
// ================================================================
const obtenerVentasDescartableOdoo = async (req, res) => {
  try {
    const { anio, mes } = req.query;
    if (!anio || !mes)
      return res.status(400).json({ error: "Debe enviar ?anio=YYYY&mes=MM" });

    const anioNum = parseInt(anio, 10);
    const mesNum  = parseInt(mes,  10);
    if (isNaN(anioNum) || isNaN(mesNum) || mesNum < 1 || mesNum > 12)
      return res.status(400).json({ error: "Parámetros anio/mes inválidos." });

    const hoy         = new Date();
    const esMesActual = anioNum === hoy.getFullYear() && mesNum === hoy.getMonth() + 1;

    // ── Fechas mes actual ───────────────────────────────────────
    const inicio = getFechaInicioMes(anioNum, mesNum);
    const fin    = await getFechaFinQuery(anioNum, mesNum);

    // ── Fechas mes anterior ─────────────────────────────────────
    let mesPrev = mesNum - 1, anioPrev = anioNum;
    if (mesPrev === 0) { mesPrev = 12; anioPrev--; }
    const inicioPrev = getFechaInicioMes(anioPrev, mesPrev);
    const finPrev    = getFechaFinMes(anioPrev, mesPrev);

    // ── Días hábiles ────────────────────────────────────────────
    const diasTranscurridos = getDiasHabilesTranscurridos(anioNum, mesNum);
    const diasLaborablesMes = getDiasLaborablesMes(anioNum, mesNum);

    // ── Queries ─────────────────────────────────────────────────
    const [ventasActual, ventasAnterior] = await Promise.all([
      queryVentasPorRuta(inicio, fin),
      queryVentasPorRuta(inicioPrev, finPrev),
    ]);

    // ── Mapa mes anterior ───────────────────────────────────────
    const mapAnterior = {};
    ventasAnterior.forEach(r => {
      mapAnterior[r.ruta] = {
        unidades : Number(r.unidades) || 0,
        dolares  : Number(r.dolares)  || 0,
      };
    });

    // ── Construir respuesta por ruta ────────────────────────────
    const rutas = ventasActual.map(r => {
      const montoActual   = Number(r.dolares)   || 0;
      const unidadesActual= Number(r.unidades)  || 0;
      const anterior      = mapAnterior[r.ruta] || { unidades: 0, dolares: 0 };

      const proyeccion = esMesActual && diasTranscurridos > 0
        ? (montoActual / diasTranscurridos) * diasLaborablesMes
        : montoActual;

      const variacionAbs  = montoActual - anterior.dolares;
      const variacionPorc = anterior.dolares > 0
        ? (variacionAbs / anterior.dolares) * 100
        : null;

      return {
        ruta          : r.ruta,
        unidades      : unidadesActual,
        dolares       : Number(montoActual.toFixed(2)),
        subtotal      : Number(Number(r.subtotal).toFixed(2)),
        cant_ordenes  : Number(r.cant_ordenes),
        cant_clientes : Number(r.cant_clientes),
        proyeccion    : Number(proyeccion.toFixed(2)),
        mes_anterior  : {
          unidades    : anterior.unidades,
          dolares     : Number(anterior.dolares.toFixed(2)),
        },
        variacion     : {
          abs         : Number(variacionAbs.toFixed(2)),
          porcentaje  : variacionPorc !== null ? Number(variacionPorc.toFixed(2)) : null,
        },
      };
    });

    // ── Totales generales ───────────────────────────────────────
    // mes_anterior: suma TODAS las rutas del mes anterior (no solo las que tienen ventas actuales)
    const totalMesAnterior = ventasAnterior.reduce((a, r) => a + (Number(r.dolares) || 0), 0);

    const totales = {
      unidades     : rutas.reduce((a, r) => a + r.unidades,     0),
      dolares      : Number(rutas.reduce((a, r) => a + r.dolares,      0).toFixed(2)),
      proyeccion   : Number(rutas.reduce((a, r) => a + r.proyeccion,   0).toFixed(2)),
      cant_ordenes : rutas.reduce((a, r) => a + r.cant_ordenes, 0),
      mes_anterior : {
        dolares    : Number(totalMesAnterior.toFixed(2)),
      },
    };
    totales.variacion = {
      abs       : Number((totales.dolares - totales.mes_anterior.dolares).toFixed(2)),
      porcentaje: totales.mes_anterior.dolares > 0
        ? Number(((totales.dolares - totales.mes_anterior.dolares) / totales.mes_anterior.dolares * 100).toFixed(2))
        : null,
    };

    return res.status(200).json({
      periodo: { anio: anioNum, mes: mesNum, esMesActual },
      fechas : { inicio, fin, inicioPrev, finPrev },
      dias   : { transcurridos: diasTranscurridos, laborables: diasLaborablesMes },
      totales,
      rutas,
    });

  } catch (error) {
    console.error("❌ ERROR ventasDescartableOdoo:", error);
    return res.status(500).json({ message: "Error al obtener ventas descartable Odoo" });
  }
};

// ================================================================
// ENDPOINT CLIENTES DESCARTABLE ODOO (todos los clientes del canal)
// GET /api/odoo/clientes?anio=YYYY&mes=MM
// ================================================================
const obtenerClientesDescartableOdoo = async (req, res) => {
  try {
    const { anio, mes } = req.query;
    if (!anio || !mes)
      return res.status(400).json({ error: 'Debe enviar ?anio=YYYY&mes=MM' });

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

    const placeholders = RUTAS_ODOO.map((_, i) => `:ruta${i}`).join(', ');
    const rutaBindings = {};
    RUTAS_ODOO.forEach((r, i) => { rutaBindings[`ruta${i}`] = r; });

    // 1. Todos los clientes activos en el año con info de contacto
    const clientesSQL = `
      SELECT DISTINCT ON (o.customer_code)
        o.customer_code,
        c.nombre_cliente,
        c.codigo_tipo_negocio,
        tn.descripcion                                                AS tipo_negocio,
        COALESCE(best_dc.calle1_direccion_cliente, c.direccion_cliente)   AS direccion_cliente,
        COALESCE(best_dc.telefono_direccion_cliente, c.telefono_cliente)  AS telefono_cliente,
        COALESCE(best_dc.latitud_direccion_cliente,  c.latitud_cliente::NUMERIC)  AS latitud_direccion_cliente,
        COALESCE(best_dc.longitud_direccion_cliente, c.longitud_cliente::NUMERIC) AS longitud_direccion_cliente
      FROM ordenes o
      LEFT JOIN clientes c         ON c.codigo_cliente = o.customer_code
      LEFT JOIN tipos_negocio tn   ON tn.codigo = c.codigo_tipo_negocio
      LEFT JOIN LATERAL (
        SELECT calle1_direccion_cliente,
               telefono_direccion_cliente,
               latitud_direccion_cliente,
               longitud_direccion_cliente
        FROM direcciones_clientes
        WHERE codigo_cliente = o.customer_code
        ORDER BY
          (latitud_direccion_cliente  IS NOT NULL AND longitud_direccion_cliente IS NOT NULL) DESC,
          (telefono_direccion_cliente IS NOT NULL) DESC
        LIMIT 1
      ) best_dc ON true
      WHERE o.type = 2
        AND o.status IN (2, 4, 5)
        AND o.seller_nombre IN (${placeholders})
        AND o.fecha_creacion >= :inicioAnio
        AND o.fecha_creacion  < :finAnio
      ORDER BY o.customer_code
    `;

    // 2. Consumo actual + anterior + cantidad por cliente
    const consumoSQL = `
      SELECT
        o.customer_code,
        SUM(CASE WHEN o.fecha_creacion >= :inicio AND o.fecha_creacion < :fin
            THEN dd.total    ELSE 0 END) AS consumo_actual,
        SUM(CASE WHEN o.fecha_creacion >= :antInicio AND o.fecha_creacion < :antFin
            THEN dd.total    ELSE 0 END) AS consumo_anterior,
        SUM(CASE WHEN o.fecha_creacion >= :inicio AND o.fecha_creacion < :fin
            THEN dd.cantidad ELSE 0 END) AS cantidad_actual
      FROM ordenes o
      JOIN detalle_documento dd ON dd.documento_code = o.code
      WHERE o.type = 2
        AND o.status IN (2, 4, 5)
        AND dd.codigo_categoria = '7'
        AND o.seller_nombre IN (${placeholders})
      GROUP BY o.customer_code
    `;

    // 3. Máximo consumo mensual del año
    const maxConsumoSQL = `
      WITH consumo_mensual AS (
        SELECT
          o.customer_code,
          DATE_TRUNC('month', o.fecha_creacion) AS mes,
          SUM(dd.total) AS consumo_mes
        FROM ordenes o
        JOIN detalle_documento dd ON dd.documento_code = o.code
        WHERE o.type = 2
          AND o.status IN (2, 4, 5)
          AND dd.codigo_categoria = '7'
          AND o.seller_nombre IN (${placeholders})
          AND o.fecha_creacion >= :inicioAnio
          AND o.fecha_creacion  < :finAnio
        GROUP BY o.customer_code, DATE_TRUNC('month', o.fecha_creacion)
      )
      SELECT DISTINCT ON (customer_code)
        customer_code, mes, consumo_mes
      FROM consumo_mensual
      ORDER BY customer_code, consumo_mes DESC
    `;

    // 4. Última orden por cliente
    const ultimaOrdenSQL = `
      SELECT
        customer_code,
        MAX(COALESCE(fecha_entrega, fecha_creacion)) AS ultima_factura
      FROM ordenes
      WHERE type = 2
        AND status IN (2, 4, 5)
        AND seller_nombre IN (${placeholders})
      GROUP BY customer_code
    `;

    const baseReplacements = {
      ...rutaBindings,
      inicio, fin, antInicio, antFin, inicioAnio, finAnio,
    };

    const [clientes, consumoData, maxConsumoData, ultimasOrdenes] = await Promise.all([
      sequelize.query(clientesSQL,   { replacements: baseReplacements, type: Sequelize.QueryTypes.SELECT }),
      sequelize.query(consumoSQL,    { replacements: baseReplacements, type: Sequelize.QueryTypes.SELECT }),
      sequelize.query(maxConsumoSQL, { replacements: baseReplacements, type: Sequelize.QueryTypes.SELECT }),
      sequelize.query(ultimaOrdenSQL,{ replacements: baseReplacements, type: Sequelize.QueryTypes.SELECT }),
    ]);

    const mapConsumo    = new Map(consumoData.map(r    => [r.customer_code, r]));
    const mapMaxConsumo = new Map(maxConsumoData.map(r  => [r.customer_code, r]));
    const mapUltimaOrden= new Map(ultimasOrdenes.map(r  => [r.customer_code, r.ultima_factura]));

    const fmtFecha = (f) => {
      if (!f) return null;
      const d = new Date(f);
      if (isNaN(d.getTime())) return null;
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    };

    const nombreMes = (fecha) => {
      if (!fecha) return null;
      const meses = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
      return meses[new Date(fecha).getMonth()];
    };

    const resultado = clientes.map(c => {
      const consumo = mapConsumo.get(c.customer_code)    || {};
      const maxC    = mapMaxConsumo.get(c.customer_code) || {};
      const ultOrden= mapUltimaOrden.get(c.customer_code) || null;

      const consumoActual   = Number(consumo.consumo_actual)   || 0;
      const consumoAnterior = Number(consumo.consumo_anterior) || 0;
      const varAbs  = consumoActual - consumoAnterior;
      const varPorc = consumoAnterior > 0
        ? (varAbs / consumoAnterior) * 100
        : consumoActual > 0 ? 100 : 0;

      return {
        codigo_cliente:         c.customer_code,
        nombre_cliente:         c.nombre_cliente,
        direccion_entrega:      c.direccion_cliente,
        tipo_negocio:           c.tipo_negocio || 'SIN CLASIFICAR',
        telefono_cliente:       c.telefono_cliente || '—',
        latitud_cliente:        c.latitud_direccion_cliente  || '—',
        longitud_cliente:       c.longitud_direccion_cliente || '—',
        cantidad_productos:     Number(consumo.cantidad_actual) || 0,
        consumo_actual:         consumoActual.toFixed(2),
        max_consumo:            Number(maxC.consumo_mes || 0).toFixed(2),
        mes_max_consumo_nombre: nombreMes(maxC.mes),
        ultima_factura:         fmtFecha(ultOrden),
        ultima_visita:          fmtFecha(ultOrden),
        vsMesAnterior: {
          monto_anterior:  consumoAnterior.toFixed(2),
          variacion_abs:   varAbs.toFixed(2),
          variacion_porc:  `${varPorc.toFixed(2)}%`,
        },
        tuvo_consumo: consumoActual > 0 ? 'Sí' : 'No',
      };
    });

    const conConsumo = resultado.filter(r => r.tuvo_consumo === 'Sí').length;

    const productosVendidos = await sequelize.query(`
      SELECT dd.descripcion AS producto,
             SUM(dd.cantidad) AS unidades_vendidas,
             SUM(dd.total)    AS monto_usd
      FROM ordenes o
      JOIN detalle_documento dd ON dd.documento_code = o.code
      WHERE o.type = 2
        AND o.status IN (2,4,5)
        AND dd.codigo_categoria = '7'
        AND o.seller_nombre IN (${placeholders})
        AND o.fecha_creacion >= :inicio AND o.fecha_creacion < :fin
      GROUP BY dd.descripcion
      ORDER BY unidades_vendidas DESC
    `, { replacements: { ...rutaBindings, inicio, fin }, type: Sequelize.QueryTypes.SELECT });

    return res.json({
      clientes: resultado,
      resumen: {
        totalClientes:      resultado.length,
        clientesConConsumo: conConsumo,
        clientesSinConsumo: resultado.length - conConsumo,
      },
      productosVendidos,
    });

  } catch (error) {
    console.error('❌ ERROR CLIENTES DESCARTABLE ODOO:', error);
    return res.status(500).json({ message: 'Error al obtener clientes descartable Odoo' });
  }
};

module.exports = { obtenerVentasDescartableOdoo, obtenerClientesDescartableOdoo };
