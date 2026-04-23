// controllers/COTTSAController.js
const { sequelize, MetaPreventa, CottsaExtraMes } = require('../../models');
const Sequelize = require('sequelize');
const { getDiasHabilesTranscurridos, getDiasLaborablesMes } = require('../../utils/diasFestivos');

// Crea la tabla si no existe (una sola vez en el arranque)
CottsaExtraMes.sync().catch(err => console.error('⚠️ sync CottsaExtraMes:', err.message));

// ================================================================
// HELPER — objetivos de gerencia (reutiliza tabla MetaPreventa)
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
      mapa[m.codigo_ruta.toUpperCase()] = {
        meta_dolares: Number(m.meta_dolares) || 0,
        meta_unidades: Number(m.meta_unidades) || 0,
      };
    });
    return mapa;
  } catch {
    return {};
  }
};

const COTTSA_COMPANY_ID = 3;

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

const getFechaFinQuery = (anioNum, mesNum) => getFechaFinMes(anioNum, mesNum);

// ================================================================
// QUERY PRINCIPAL — rutas COTTSA
// ================================================================
const obtenerVentasCOTTSAPorRuta = async (anioNum, mesNum, fechaFin = null) => {
  const inicio = getFechaInicioMes(anioNum, mesNum);
  const fin = fechaFin || getFechaFinMes(anioNum, mesNum);

const sql = `
  SELECT
    f.seller_code                       AS vendedor,
    SUM(COALESCE(u.unidades, 0))        AS unidades,
    SUM(f.subtotal)                     AS subtotal,
    SUM(f.total)                        AS dolares,
    COUNT(DISTINCT f.code)              AS cant_facturas,
    COUNT(DISTINCT f.customer_code)     AS cant_clientes
  FROM facturas f

  LEFT JOIN (
    SELECT 
      documento_code,
      SUM(cantidad) AS unidades
    FROM detalle_documento
    GROUP BY documento_code
  ) u ON u.documento_code = f.code

  WHERE f.company_id = ${COTTSA_COMPANY_ID}
    AND f.fecha_entrega >= '${inicio}'
    AND f.fecha_entrega  < '${fin}'
    AND f.reversed_entry_id IS NULL
    AND f.tipo_documento = '(01) Invoice'
    AND f.status = 2

  GROUP BY f.seller_code
  ORDER BY dolares DESC
`;
  return await sequelize.query(sql, { type: Sequelize.QueryTypes.SELECT });
};

// ================================================================
// ENDPOINT PRINCIPAL
// ================================================================
const obtenerDashboardCOTTSA = async (req, res) => {
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

    // Todos en paralelo
    const [ventasActuales, ventasAnteriores, objetivos] = await Promise.all([
      obtenerVentasCOTTSAPorRuta(anioNum, mesNum, fechaFinDinamica),
      obtenerVentasCOTTSAPorRuta(anioPrev, mesPrev),
      obtenerObjetivosGerencia(anioNum, mesNum),
    ]);

    // Mapa mes anterior
    const mapAnterior = {};
    ventasAnteriores.forEach(r => {
      mapAnterior[r.ruta] = Number(r.dolares) || 0;
    });

    // Ranking con proyección, comparativa y objetivo de gerencia
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
      const vendedorKey = (r.vendedor || '').toUpperCase();
      const obj = objetivos[vendedorKey] || { meta_dolares: 0, meta_unidades: 0 };

      return {
        ruta: r.ruta,
        vendedor: r.vendedor,
        unidades: Number(r.unidades),
        subtotal: Number(r.subtotal),
        dolares: montoActual,
        proyeccion: Number(proyeccion.toFixed(2)),
        cant_facturas: Number(r.cant_facturas),
        cant_clientes: Number(r.cant_clientes),
        objetivo_gerencia: obj.meta_dolares,
        objetivo_gerencia_unidades: obj.meta_unidades,
        vsMesAnterior: {
          dolares_anterior: Number(montoAnterior.toFixed(2)),
          variacion_abs: Number(variacionAbs.toFixed(2)),
          variacion_porc: variacionPorc !== null ? Number(variacionPorc.toFixed(2)) : null,
        },
      };
    });

    // Totales para las cards superiores
    // mesAnterior: suma TODAS las rutas del mes anterior (no solo las que tienen ventas actuales)
    const totalMesAnterior = ventasAnteriores.reduce((a, r) => a + (Number(r.dolares) || 0), 0);

    // Objetivo de gerencia para el canal completo (clave 'COTTSA')
    const objCanal = objetivos['COTTSA'] || { meta_dolares: 0, meta_unidades: 0 };

    const totales = {
      unidades: ranking.reduce((a, r) => a + r.unidades, 0),
      dolares: ranking.reduce((a, r) => a + r.dolares, 0),
      proyeccion: ranking.reduce((a, r) => a + r.proyeccion, 0),
      cant_facturas: ranking.reduce((a, r) => a + r.cant_facturas, 0),
      cant_clientes: ranking.reduce((a, r) => a + r.cant_clientes, 0),
      mesAnterior: Number(totalMesAnterior.toFixed(2)),
      objetivo_gerencia: objCanal.meta_dolares,
      objetivo_gerencia_unidades: objCanal.meta_unidades,
    };

    return res.status(200).json({ ranking, totales });

  } catch (error) {
    console.error('❌ ERROR DASHBOARD COTTSA:', error);
    return res.status(500).json({ message: 'Error al obtener datos COTTSA' });
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

    const filtro = vendedor
      ? `f.seller_code = '${vendedor}'`
      : `f.route_code  = '${ruta}'`;

    const productosSql = `
      SELECT
        dd.codigo_producto,
        dd.descripcion,
        SUM(dd.cantidad) AS unidades,
        SUM(dd.subtotal) AS subtotal,
        SUM(dd.total)    AS dolares
      FROM facturas f
      JOIN detalle_documento dd ON dd.documento_code = f.code
      WHERE f.company_id = ${COTTSA_COMPANY_ID}
        AND f.status IN (0,2,3,4,5)
        AND ${filtro}
        AND f.fecha_creacion >= '${inicio}'
        AND f.fecha_creacion  < '${fin}'
      GROUP BY dd.codigo_producto, dd.descripcion
      ORDER BY unidades DESC
    `;

    const clientesSql = `
      SELECT
        COUNT(DISTINCT f.customer_code) AS total_clientes,
        COUNT(DISTINCT CASE
          WHEN f.fecha_creacion >= '${inicio}' AND f.fecha_creacion < '${fin}'
          THEN f.customer_code END) AS con_consumo
      FROM facturas f
      WHERE f.company_id = ${COTTSA_COMPANY_ID}
        AND f.status IN (0,2,3,4,5)
        AND ${filtro}
        AND f.fecha_creacion >= '${inicioAnio}'
        AND f.fecha_creacion  < '${finAnio}'
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
    const fin = await getFechaFinQuery(anioNum, mesNum);

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
        AND f.status IN (0,2,3,4,5)
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
      WHERE f.company_id = ${COTTSA_COMPANY_ID}
        AND f.status IN (0,2,3,4,5)
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
        WHERE f.company_id = ${COTTSA_COMPANY_ID}
          AND f.status IN (0,2,3,4,5)
          AND f.fecha_creacion >= '${inicioAnio}'
          AND f.fecha_creacion  < '${finAnio}'
        GROUP BY f.customer_code, DATE_TRUNC('month', f.fecha_creacion)
      )
      SELECT DISTINCT ON (customer_code)
        customer_code, mes, consumo_mes
      FROM consumo_mensual
      ORDER BY customer_code, consumo_mes DESC
    `;

    // 4. Última factura COTTSA por cliente
    const ultimaFacturaSQL = `
      SELECT
        customer_code,
        MAX(COALESCE(fecha_autorizacion, fecha_entrega, fecha_creacion)) AS ultima_factura
      FROM facturas
      WHERE company_id = ${COTTSA_COMPANY_ID}
      GROUP BY customer_code
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
        consumo_actual: consumoActual.toFixed(2),
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
      SELECT dd.descripcion AS producto,
             SUM(dd.cantidad) AS unidades_vendidas,
             SUM(dd.total)    AS monto_usd
      FROM facturas f
      JOIN detalle_documento dd ON dd.documento_code = f.code
      WHERE f.company_id = ${COTTSA_COMPANY_ID}
        AND f.status IN (0,2,3,4,5)
        AND f.fecha_creacion >= '${inicio}' AND f.fecha_creacion < '${fin}'
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
      // ① Cuántas facturas hay por cada status (company_id=3)
      sequelize.query(`
        SELECT status, COUNT(*) AS cant, SUM(total) AS total_header
        FROM facturas
        WHERE company_id = ${COTTSA_COMPANY_ID}
          AND fecha_creacion >= '${inicio}'
          AND fecha_creacion  < '${fin}'
        GROUP BY status
        ORDER BY status
      `, { type: Sequelize.QueryTypes.SELECT }),

      // ② Header total vs Detalle total para status IN (2,4,5)
      sequelize.query(`
        SELECT
          COUNT(DISTINCT f.code)          AS facturas_con_detalle,
          SUM(f.total)                    AS total_header,
          SUM(dd.total)                   AS total_detalle,
          SUM(dd.cantidad)                AS unidades_detalle
        FROM facturas f
        JOIN detalle_documento dd ON dd.documento_code = f.code
        WHERE f.company_id = ${COTTSA_COMPANY_ID}
          AND f.status IN (0,2,3,4,5)
          AND f.fecha_creacion >= '${inicio}'
          AND f.fecha_creacion  < '${fin}'
      `, { type: Sequelize.QueryTypes.SELECT }),

      // ③ Distribución de TODAS las facturas del mes por company_id (sin filtro de empresa)
      sequelize.query(`
        SELECT company_id, status, COUNT(*) AS cant, SUM(total) AS total_header
        FROM facturas
        WHERE fecha_creacion >= '${inicio}'
          AND fecha_creacion  < '${fin}'
          AND status IN (2, 4, 5)
        GROUP BY company_id, status
        ORDER BY company_id, status
      `, { type: Sequelize.QueryTypes.SELECT }),
    ]);

    return res.json({ periodo: `${anioNum}-${String(mesNum).padStart(2, '0')}`, porStatus, headerVsDetalle, porCompany });
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

module.exports = {
  obtenerDashboardCOTTSA,
  obtenerDetalleRutaCOTTSA,
  obtenerClientesCOTTSA,
  diagnosticoCOTTSA,
  obtenerCottsaExtra,
  guardarCottsaExtra,
};