// controllers/cotsaController.js
const { sequelize } = require('../../models');
const Sequelize = require('sequelize');
const { getDiasHabilesTranscurridos, getDiasLaborablesMes } = require('../../utils/diasFestivos');

const COTSA_COMPANY_ID = 3;

// ================================================================
// HELPERS DE FECHA
// ================================================================
function getFechaInicioMes(anio, mes) {
  return `${anio}-${String(mes).padStart(2, '0')}-01 00:00:00`;
}

function getFechaFinMes(anio, mes) {
  let mesFin = mes + 1, anioFin = anio;
  if (mesFin === 13) { mesFin = 1; anioFin++; }
  return `${anioFin}-${String(mesFin).padStart(2, '0')}-01 00:00:00`;
}

// ================================================================
// FECHA DE ÚLTIMA SINCRONIZACIÓN
// ================================================================
const obtenerFechaSincronizacion = async () => {
  const result = await sequelize.query(
    'SELECT hasta_date FROM sincronizaciones_ventas ORDER BY fecha_sync DESC LIMIT 1',
    { type: Sequelize.QueryTypes.SELECT }
  );
  if (!result || result.length === 0) throw new Error("No hay fecha de sincronización");
  return result[0].hasta_date;
};



const getFechaFinQuery = async (anioNum, mesNum) => {
  const hoy = new Date();
  const esMesActual = anioNum === hoy.getFullYear() && mesNum === hoy.getMonth() + 1;

  if (esMesActual) {
    const ultimaSync = await obtenerFechaSincronizacion();
    const [yyyy, mm, dd] = String(ultimaSync).substring(0, 10).split('-').map(Number);

    // ✅ Date maneja desbordamiento: día 31+1 → primer día del mes siguiente
    const diaSiguiente = new Date(yyyy, mm - 1, dd + 1);
    const y = diaSiguiente.getFullYear();
    const m = String(diaSiguiente.getMonth() + 1).padStart(2, '0');
    const d = String(diaSiguiente.getDate()).padStart(2, '0');
    return `${y}-${m}-${d} 00:00:00`;
  }

  return getFechaFinMes(anioNum, mesNum);
};

// ================================================================
// QUERY PRINCIPAL — rutas COTSA
// ================================================================
const obtenerVentasCOTSAPorRuta = async (anioNum, mesNum, fechaFin = null) => {
  const inicio = getFechaInicioMes(anioNum, mesNum);
  const fin = fechaFin || getFechaFinMes(anioNum, mesNum);

  const sql = `
    SELECT
      COALESCE(f.route_code, 'SIN RUTA') AS ruta,
      f.seller_code                       AS vendedor,
      SUM(dd.cantidad)                    AS unidades,
      SUM(dd.subtotal)                    AS subtotal,
      SUM(dd.total)                       AS dolares,
      COUNT(DISTINCT f.code)              AS cant_facturas,
      COUNT(DISTINCT f.customer_code)     AS cant_clientes
    FROM facturas f
    JOIN detalle_documento dd ON dd.documento_code = f.code
    WHERE f.company_id = ${COTSA_COMPANY_ID}
      AND f.status IN (2, 4, 5)
      AND f.fecha_creacion >= '${inicio}'
      AND f.fecha_creacion  < '${fin}'
    GROUP BY f.route_code, f.seller_code
    ORDER BY dolares DESC
  `;
  return await sequelize.query(sql, { type: Sequelize.QueryTypes.SELECT });
};

// ================================================================
// ENDPOINT PRINCIPAL
// ================================================================
const obtenerDashboardCOTSA = async (req, res) => {
  try {
    const { anio, mes } = req.query;
    if (!anio || !mes)
      return res.status(400).json({ error: 'Debe enviar ?anio=YYYY&mes=MM' });

    const anioNum = parseInt(anio, 10);
    const mesNum = parseInt(mes, 10);

    if (isNaN(anioNum) || isNaN(mesNum) || mesNum < 1 || mesNum > 12)
      return res.status(400).json({ error: 'Parámetros anio/mes inválidos.' });

    const hoy = new Date();
    const esMesActual = anioNum === hoy.getFullYear() && mesNum === hoy.getMonth() + 1;
    const esMesCerrado = anioNum < hoy.getFullYear() ||
      (anioNum === hoy.getFullYear() && mesNum < hoy.getMonth() + 1);

    const fechaFinDinamica = await getFechaFinQuery(anioNum, mesNum);
    const diasTranscurridos = getDiasHabilesTranscurridos(anioNum, mesNum);
    const diasLaborables = getDiasLaborablesMes(anioNum, mesNum);

    // Mes anterior
    let mesPrev = mesNum - 1, anioPrev = anioNum;
    if (mesPrev === 0) { mesPrev = 12; anioPrev--; }

    // Ambos en paralelo
    const [ventasActuales, ventasAnteriores] = await Promise.all([
      obtenerVentasCOTSAPorRuta(anioNum, mesNum, fechaFinDinamica),
      obtenerVentasCOTSAPorRuta(anioPrev, mesPrev),
    ]);

    // Mapa mes anterior
    const mapAnterior = {};
    ventasAnteriores.forEach(r => {
      mapAnterior[r.ruta] = Number(r.dolares) || 0;
    });

    // Ranking con proyección y comparativa
    const ranking = ventasActuales.map(r => {
      const montoActual = Number(r.dolares) || 0;
      const montoAnterior = mapAnterior[r.ruta] || 0;
      const proyeccion = esMesCerrado || diasTranscurridos === 0
        ? montoActual
        : (montoActual / diasTranscurridos) * diasLaborables;
      const variacionAbs = proyeccion - montoAnterior;
      const variacionPorc = montoAnterior > 0
        ? (variacionAbs / montoAnterior) * 100
        : null;

      return {
        ruta: r.ruta,
        vendedor: r.vendedor,
        unidades: Number(r.unidades),
        subtotal: Number(r.subtotal),
        dolares: montoActual,
        proyeccion: Number(proyeccion.toFixed(2)),
        cant_facturas: Number(r.cant_facturas),
        cant_clientes: Number(r.cant_clientes),
        vsMesAnterior: {
          dolares_anterior: Number(montoAnterior.toFixed(2)),
          variacion_abs: Number(variacionAbs.toFixed(2)),
          variacion_porc: variacionPorc !== null ? Number(variacionPorc.toFixed(2)) : null,
        },
      };
    });

    // Totales para las cards superiores
    const totales = {
      unidades: ranking.reduce((a, r) => a + r.unidades, 0),
      dolares: ranking.reduce((a, r) => a + r.dolares, 0),
      proyeccion: ranking.reduce((a, r) => a + r.proyeccion, 0),
      cant_facturas: ranking.reduce((a, r) => a + r.cant_facturas, 0),
      cant_clientes: ranking.reduce((a, r) => a + r.cant_clientes, 0),
    };

    return res.status(200).json({ ranking, totales });

  } catch (error) {
    console.error('❌ ERROR DASHBOARD COTSA:', error);
    return res.status(500).json({ message: 'Error al obtener datos COTSA' });
  }
};

// ================================================================
// ENDPOINT DETALLE POR RUTA
// ================================================================
const obtenerDetalleRutaCOTSA = async (req, res) => {
  try {
    const { ruta, anio, mes } = req.query;
    if (!ruta || !anio || !mes)
      return res.status(400).json({ error: 'Debe enviar ruta, anio y mes' });

    const anioNum = parseInt(anio, 10);
    const mesNum = parseInt(mes, 10);
    const inicio = getFechaInicioMes(anioNum, mesNum);
    const fin = getFechaFinMes(anioNum, mesNum);

    const sql = `
      SELECT
        dd.codigo_producto,
        dd.descripcion,
        SUM(dd.cantidad)   AS unidades,
        SUM(dd.subtotal)   AS subtotal,
        SUM(dd.total)      AS dolares,
        CASE WHEN SUM(dd.cantidad) > 0
          THEN SUM(dd.total) / SUM(dd.cantidad)
          ELSE 0
        END                AS precio_promedio
      FROM facturas f
      JOIN detalle_documento dd ON dd.documento_code = f.code
      WHERE f.company_id = ${COTSA_COMPANY_ID}
        AND f.status IN (2, 4, 5)
        AND f.route_code = '${ruta}'
        AND f.fecha_creacion >= '${inicio}'
        AND f.fecha_creacion  < '${fin}'
      GROUP BY dd.codigo_producto, dd.descripcion
      ORDER BY unidades DESC
    `;

    const detalle = await sequelize.query(sql, { type: Sequelize.QueryTypes.SELECT });
    return res.status(200).json(detalle);

  } catch (error) {
    console.error('❌ Error en obtenerDetalleRutaCOTSA:', error);
    return res.status(500).json({ message: 'Error interno' });
  }
};

// ================================================================
// ENDPOINT CLIENTES COTSA (todos los clientes del canal)
// ================================================================
const obtenerClientesCOTSA = async (req, res) => {
  try {
    const { anio, mes } = req.query;
    if (!anio || !mes)
      return res.status(400).json({ error: 'Debe enviar ?anio=YYYY&mes=MM' });

    const anioNum = parseInt(anio, 10);
    const mesNum  = parseInt(mes, 10);
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

    // 1. Todos los clientes COTSA activos en el año
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
      WHERE f.company_id = ${COTSA_COMPANY_ID}
        AND f.status IN (2, 4, 5)
        AND f.fecha_creacion >= '${inicioAnio}'
        AND f.fecha_creacion  < '${finAnio}'
      ORDER BY f.customer_code
    `;

    // 2. Consumo actual + anterior + cantidad por cliente
    const consumoSQL = `
      SELECT
        f.customer_code,
        SUM(CASE WHEN f.fecha_creacion >= '${inicio}' AND f.fecha_creacion < '${fin}'
            THEN dd.total    ELSE 0 END) AS consumo_actual,
        SUM(CASE WHEN f.fecha_creacion >= '${antInicio}' AND f.fecha_creacion < '${antFin}'
            THEN dd.total    ELSE 0 END) AS consumo_anterior,
        SUM(CASE WHEN f.fecha_creacion >= '${inicio}' AND f.fecha_creacion < '${fin}'
            THEN dd.cantidad ELSE 0 END) AS cantidad_actual
      FROM facturas f
      JOIN detalle_documento dd ON dd.documento_code = f.code
      WHERE f.company_id = ${COTSA_COMPANY_ID}
        AND f.status IN (2, 4, 5)
      GROUP BY f.customer_code
    `;

    // 3. Máximo consumo mensual del año por cliente
    const maxConsumoSQL = `
      WITH consumo_mensual AS (
        SELECT
          f.customer_code,
          DATE_TRUNC('month', f.fecha_creacion) AS mes,
          SUM(dd.total) AS consumo_mes
        FROM facturas f
        JOIN detalle_documento dd ON dd.documento_code = f.code
        WHERE f.company_id = ${COTSA_COMPANY_ID}
          AND f.status IN (2, 4, 5)
          AND f.fecha_creacion >= '${inicioAnio}'
          AND f.fecha_creacion  < '${finAnio}'
        GROUP BY f.customer_code, DATE_TRUNC('month', f.fecha_creacion)
      )
      SELECT DISTINCT ON (customer_code)
        customer_code, mes, consumo_mes
      FROM consumo_mensual
      ORDER BY customer_code, consumo_mes DESC
    `;

    // 4. Última factura COTSA por cliente
    const ultimaFacturaSQL = `
      SELECT
        customer_code,
        MAX(COALESCE(fecha_autorizacion, fecha_entrega, fecha_creacion)) AS ultima_factura
      FROM facturas
      WHERE company_id = ${COTSA_COMPANY_ID}
      GROUP BY customer_code
    `;

    const [clientes, consumoData, maxConsumoData, ultimasFacturas] = await Promise.all([
      sequelize.query(clientesSQL,      { type: Sequelize.QueryTypes.SELECT }),
      sequelize.query(consumoSQL,       { type: Sequelize.QueryTypes.SELECT }),
      sequelize.query(maxConsumoSQL,    { type: Sequelize.QueryTypes.SELECT }),
      sequelize.query(ultimaFacturaSQL, { type: Sequelize.QueryTypes.SELECT }),
    ]);

    const mapConsumo    = new Map(consumoData.map(r    => [r.customer_code, r]));
    const mapMaxConsumo = new Map(maxConsumoData.map(r  => [r.customer_code, r]));
    const mapUltimaFact = new Map(ultimasFacturas.map(r => [r.customer_code, r.ultima_factura]));

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
      const ultFact = mapUltimaFact.get(c.customer_code) || null;

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
        ultima_factura:         fmtFecha(ultFact),
        ultima_visita:          fmtFecha(ultFact),
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
      FROM facturas f
      JOIN detalle_documento dd ON dd.documento_code = f.code
      WHERE f.company_id = ${COTSA_COMPANY_ID}
        AND f.status IN (2,4,5)
        AND f.fecha_creacion >= '${inicio}' AND f.fecha_creacion < '${fin}'
      GROUP BY dd.descripcion
      ORDER BY unidades_vendidas DESC
    `, { type: Sequelize.QueryTypes.SELECT });

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
    console.error('❌ ERROR CLIENTES COTSA:', error);
    return res.status(500).json({ message: 'Error al obtener clientes COTSA' });
  }
};

module.exports = { obtenerDashboardCOTSA, obtenerDetalleRutaCOTSA, obtenerClientesCOTSA };