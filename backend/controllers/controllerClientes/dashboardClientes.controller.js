const sequelize = require("../../db");
const { ContactoRecuperacion } = require("../../models");

// Crea la tabla si no existe (idempotente, igual que cottsa_extra_mes)
ContactoRecuperacion.sync().catch(err =>
  console.error("⚠️ sync ContactoRecuperacion:", err.message)
);

function validarFechaISO(str) {
  return typeof str === "string" && /^\d{4}-\d{2}-\d{2}$/.test(str);
}

// Construye el WHERE para filtro de prefijos de ruta (codigo_usuario_asignado_cliente).
// Maneja la colisión PV/PVR: cuando se pide PV, excluye PVR explícitamente.
// Devuelve { where: string, replacements: object, etiqueta: string }
function buildPrefijoFilter(columnExpr, prefijosParam) {
  const sinFiltro = !prefijosParam || prefijosParam === '*';
  if (sinFiltro) {
    return { where: 'TRUE', replacements: {}, etiqueta: '*', prefijos: [] };
  }
  const prefijos = String(prefijosParam)
    .split(',').map(s => s.trim().toUpperCase()).filter(Boolean);

  const replacements = {};
  const ors = prefijos.map((p, i) => {
    replacements[`pref${i}`] = `${p}%`;
    // PV es ambiguo: incluye PVR. Si pidieron PV explícitamente, excluir PVR.
    if (p === 'PV') {
      replacements[`exclPVR${i}`] = 'PVR%';
      return `(${columnExpr} LIKE :pref${i} AND ${columnExpr} NOT LIKE :exclPVR${i})`;
    }
    return `${columnExpr} LIKE :pref${i}`;
  });
  return {
    where: ors.join(' OR '),
    replacements,
    etiqueta: prefijos.join(','),
    prefijos,
  };
}

// Mapeo de company_id → nombre (mismo que consolidado)
const COMPANY_NAMES = {
  1: 'GRUPOAQUA S.A.',
  2: 'AQUASUPPLY S.A.',
  3: 'COTTSA S.A.',
  4: 'IIBC S.A.',
  5: 'DISTRINTER S.A.',
};

// ======================================================
// GET /api/dashboard-clientes/resumen
// ======================================================
exports.obtenerResumen = async (req, res) => {
  try {
    const { desde, hasta, buscar, producto, productos, categorias } = req.query;

    const params       = {};
    const facturaWhere = ['f.status IN (0,2,3,4,5)'];

    const hasDates = validarFechaISO(desde) && validarFechaISO(hasta);
    if (hasDates) {
      params.desde = desde;
      params.hasta = hasta;
      facturaWhere.push(`DATE(f.fecha_creacion) BETWEEN :desde AND :hasta`);
    }

    // Lista de productos (CSV de descripciones exactas) y categorías (CSV)
    const productosList = typeof productos === 'string' && productos.trim()
      ? productos.split('|||').map(p => p.trim().toUpperCase()).filter(Boolean)
      : [];
    const categoriasList = typeof categorias === 'string' && categorias.trim()
      ? categorias.split('|||').map(c => c.trim().toUpperCase()).filter(Boolean)
      : [];

    const dateJoin2 = hasDates ? `AND DATE(f2.fecha_creacion) BETWEEN :desde AND :hasta` : '';

    // Filtro antiguo: texto libre LIKE (se mantiene por compatibilidad)
    if (producto && producto.trim()) {
      params.producto = `%${producto.trim().toUpperCase()}%`;
      facturaWhere.push(`f.customer_code IN (
        SELECT DISTINCT f2.customer_code FROM facturas f2
        JOIN detalle_documento dd2 ON dd2.documento_code = f2.code
        WHERE UPPER(dd2.descripcion) LIKE :producto AND f2.status IN (0,2,3,4,5) ${dateJoin2}
      )`);
    }

    // Filtro nuevo: multi-producto + multi-categoría (OR entre ambos grupos)
    if (productosList.length || categoriasList.length) {
      const condiciones = [];
      if (productosList.length) {
        params.productosList = productosList;
        condiciones.push(`UPPER(dd2.descripcion) IN (:productosList)`);
      }
      if (categoriasList.length) {
        params.categoriasList = categoriasList;
        condiciones.push(`UPPER(COALESCE(dd2.descripcion_categoria, dd2.producto_categoria, '')) IN (:categoriasList)`);
      }
      facturaWhere.push(`f.customer_code IN (
        SELECT DISTINCT f2.customer_code FROM facturas f2
        JOIN detalle_documento dd2 ON dd2.documento_code = f2.code
        WHERE f2.status IN (0,2,3,4,5) ${dateJoin2}
          AND (${condiciones.join(' OR ')})
      )`);
    }

    const whereFactura = facturaWhere.length ? `WHERE ${facturaWhere.join(' AND ')}` : '';
    const dateFilter   = hasDates ? `AND DATE(f.fecha_creacion) BETWEEN :desde AND :hasta` : '';

    // Búsqueda: se aplica después del GROUP BY sobre datos enriquecidos
    let havingBuscar = '';
    if (buscar && buscar.trim()) {
      params.buscar = `%${buscar.trim().toUpperCase()}%`;
      havingBuscar = `HAVING (
        UPPER((ARRAY_AGG(COALESCE(nombre_cliente, customer_code) ORDER BY total DESC NULLS LAST))[1]) LIKE :buscar OR
        UPPER(COALESCE(NULLIF(TRIM(MAX(identificacion_cliente)), ''), '')) LIKE :buscar OR
        UPPER(COALESCE(MAX(nombre_comercial_cliente), '')) LIKE :buscar OR
        UPPER(MAX(customer_code)) LIKE :buscar
      )`;
    }

    const sql = `
      WITH
      -- ── Nombres de clientes desde ordenes (fallback cuando no están en clientes)
      nombres_ordenes AS (
        SELECT DISTINCT ON (customer_code) customer_code, customer_nombre
        FROM ordenes
        WHERE customer_nombre IS NOT NULL AND customer_nombre != ''
        ORDER BY customer_code, id_orden DESC
      ),
      -- ── Base: partimos de facturas para capturar TODOS los clientes con ventas
      metricas AS (
        SELECT
          f.customer_code,
          COALESCE(f.company_id, 0)                              AS fcompany_id,
          COALESCE(NULLIF(TRIM(c.identificacion_cliente), ''), f.customer_code) AS group_ruc,
          COALESCE(c.nombre_cliente, no.customer_nombre)         AS nombre_cliente,
          c.nombre_comercial_cliente,
          c.identificacion_cliente,
          c.codigo_usuario_asignado_cliente                      AS seller_code,
          c.tiene_credito_cliente,
          COALESCE(tn.descripcion, 'SIN CLASIFICAR')             AS tipo_negocio,
          f.total,
          f.code                                                  AS factura_code,
          f.fecha_creacion,
          f.customer_address_code
        FROM facturas f
        LEFT JOIN clientes c          ON c.codigo_cliente = f.customer_code
        LEFT JOIN nombres_ordenes no  ON no.customer_code = f.customer_code
        LEFT JOIN tipos_negocio tn    ON tn.codigo = c.codigo_tipo_negocio
        ${whereFactura}
      ),
      -- ── Agrupación por (RUC o customer_code) + company_id de factura
      agrupado AS (
        SELECT
          group_ruc || '::' || fcompany_id::text                                    AS group_key,
          CASE WHEN MAX(identificacion_cliente) IS NOT NULL
               THEN COALESCE(NULLIF(TRIM(MAX(identificacion_cliente)), ''), '')
               ELSE '' END                                                          AS ruc,
          fcompany_id::text                                                         AS company_id,
          (ARRAY_AGG(COALESCE(nombre_cliente, customer_code)
            ORDER BY total DESC NULLS LAST))[1]                                     AS nombre_cliente,
          SUM(total)::numeric                                                       AS total_ventas,
          COUNT(DISTINCT factura_code)::int                                         AS total_facturas,
          MAX(fecha_creacion)::date                                                 AS ultima_compra,
          COUNT(DISTINCT customer_address_code)::int                                AS num_sucursales,
          CASE WHEN BOOL_OR(COALESCE(tiene_credito_cliente, false))
               THEN 'CREDITO' ELSE 'CONTADO' END                                   AS tipo_pago,
          BOOL_OR(COALESCE(tiene_credito_cliente, false))                           AS tiene_credito,
          COALESCE(STRING_AGG(DISTINCT tipo_negocio, ' / '), 'SIN CLASIFICAR')     AS tipo_negocio,
          COALESCE(
            NULLIF(STRING_AGG(DISTINCT NULLIF(TRIM(COALESCE(seller_code, '')), ''), ', '), ''),
            '-'
          )                                                                         AS vendedores
        FROM metricas
        GROUP BY group_ruc, fcompany_id
          ${havingBuscar}
      ),
      -- ── Unidades (join separado para evitar double-count)
      unidades AS (
        SELECT
          COALESCE(NULLIF(TRIM(c.identificacion_cliente), ''), f.customer_code)
            || '::' || COALESCE(f.company_id, 0)::text   AS group_key,
          COALESCE(SUM(dd.cantidad), 0)::bigint           AS total_unidades
        FROM facturas f
        JOIN detalle_documento dd ON dd.documento_code = f.code
        LEFT JOIN clientes c ON c.codigo_cliente = f.customer_code
        WHERE f.status IN (0,2,3,4,5)
          ${dateFilter}
        GROUP BY
          COALESCE(NULLIF(TRIM(c.identificacion_cliente), ''), f.customer_code)
            || '::' || COALESCE(f.company_id, 0)::text
      )
      SELECT
        a.group_key,
        a.ruc,
        a.company_id,
        a.nombre_cliente,
        a.num_sucursales,
        a.total_ventas,
        COALESCE(u.total_unidades, 0)    AS total_unidades,
        a.total_facturas,
        a.ultima_compra,
        CASE
          WHEN a.ultima_compra IS NULL                    THEN 'SIN COMPRAS'
          WHEN CURRENT_DATE - a.ultima_compra <= 30       THEN 'ACTIVO'
          WHEN CURRENT_DATE - a.ultima_compra <= 60       THEN 'RIESGO'
          ELSE 'INACTIVO'
        END                               AS estado_cliente,
        a.tipo_pago,
        a.tiene_credito,
        a.tipo_negocio,
        a.vendedores
      FROM agrupado a
      LEFT JOIN unidades u ON u.group_key = a.group_key
      ORDER BY a.total_ventas DESC NULLS LAST
    `;

    const [rows] = await sequelize.query(sql, { replacements: params });

    // Mapear company_id → nombre
    for (const row of rows) {
      row.descripcion_company = COMPANY_NAMES[Number(row.company_id)] || 'SIN COMPAÑÍA';
    }

    const totalEmpresas     = rows.length;
    const totalVentas       = rows.reduce((a, r) => a + Number(r.total_ventas   || 0), 0);
    const totalFacturas     = rows.reduce((a, r) => a + Number(r.total_facturas  || 0), 0);
    const ticketPromedio    = totalFacturas > 0 ? totalVentas / totalFacturas : 0;
    const clientesCredito   = rows.filter(r => r.tiene_credito).length;
    const clientesActivos   = rows.filter(r => r.estado_cliente === 'ACTIVO').length;
    const clientesInactivos = rows.filter(r => r.estado_cliente === 'INACTIVO').length;
    const clientesRiesgo    = rows.filter(r => r.estado_cliente === 'RIESGO').length;

    return res.json({
      ok: true,
      kpis: {
        totalClientes: totalEmpresas,
        totalVentas,
        totalFacturas,
        clientesCredito,
        ticketPromedio,
        clientesInactivos,
        clientesActivos,
        clientesRiesgo,
      },
      data: rows,
    });

  } catch (error) {
    console.error('❌ obtenerResumen:', error);
    return res.status(500).json({ ok: false, message: 'Error obteniendo resumen' });
  }
};


// ======================================================
// GET /api/dashboard-clientes/productos/:codigo_cliente
// ======================================================
exports.obtenerProductosCliente = async (req, res) => {
  try {
    const { codigo_cliente } = req.params;
    const { desde, hasta }   = req.query;
    const params = { codigo_cliente };
    let filtroFechas = '';

    if (validarFechaISO(desde) && validarFechaISO(hasta)) {
      params.desde = desde;
      params.hasta  = hasta;
      filtroFechas  = `AND DATE(f.fecha_creacion) BETWEEN :desde AND :hasta`;
    }

    const sql = `
      SELECT
        COALESCE(dd.descripcion, '-')  AS nombre_producto,
        COALESCE(SUM(dd.cantidad), 0)  AS cantidad_total,
        COALESCE(SUM(dd.total),    0)  AS total_producto
      FROM facturas f
      JOIN detalle_documento dd ON f.code = dd.documento_code
      WHERE f.customer_code = :codigo_cliente
        AND f.status IN (0,2,3,4,5)
        ${filtroFechas}
      GROUP BY dd.descripcion
      ORDER BY total_producto DESC NULLS LAST
      LIMIT 10000
    `;

    const [rows] = await sequelize.query(sql, { replacements: params });
    return res.json({ ok: true, codigo_cliente, productos: rows });

  } catch (error) {
    console.error('❌ obtenerProductosCliente:', error);
    return res.status(500).json({ ok: false, message: 'Error obteniendo productos del cliente' });
  }
};


// ======================================================
// GET /api/dashboard-clientes/sucursal-productos/:codigo_cliente/:codigo_sucursal
// ======================================================
exports.obtenerProductosSucursal = async (req, res) => {
  try {
    const { codigo_cliente, codigo_sucursal } = req.params;
    const { desde, hasta } = req.query;
    const hasDates = validarFechaISO(desde) && validarFechaISO(hasta);
    const params = { codigo_cliente, codigo_sucursal };
    if (hasDates) { params.desde = desde; params.hasta = hasta; }

    const dateFilter = hasDates
      ? `AND DATE(f.fecha_creacion) BETWEEN :desde AND :hasta`
      : '';

    const sql = `
      SELECT
        COALESCE(dd.descripcion, '-') AS nombre_producto,
        SUM(dd.cantidad)::bigint       AS total_unidades,
        SUM(dd.total)                  AS total_ventas
      FROM facturas f
      JOIN detalle_documento dd ON dd.documento_code = f.code
      WHERE f.customer_code         = :codigo_cliente
        AND f.customer_address_code = :codigo_sucursal
        AND f.status IN (0,2,3,4,5)
        ${dateFilter}
      GROUP BY dd.descripcion
      ORDER BY total_ventas DESC NULLS LAST
      LIMIT 200
    `;
    const [rows] = await sequelize.query(sql, { replacements: params });
    return res.json({ ok: true, productos: rows });
  } catch (error) {
    console.error('❌ obtenerProductosSucursal:', error);
    return res.status(500).json({ ok: false, message: 'Error obteniendo productos de sucursal' });
  }
};


// ======================================================
// GET /api/dashboard-clientes/empresa/:ruc
// ======================================================
exports.obtenerEmpresaDetalle = async (req, res) => {
  try {
    const { ruc } = req.params;
    if (!ruc || !ruc.trim()) {
      return res.status(400).json({ ok: false, message: 'RUC requerido' });
    }

    const { desde, hasta, company_id } = req.query;
    const hasDates = validarFechaISO(desde) && validarFechaISO(hasta);
    const params   = { ruc: ruc.trim() };
    if (hasDates) { params.desde = desde; params.hasta = hasta; }

    // Filtro por company_id de facturas
    const hasCompany = company_id && company_id !== '0';
    if (hasCompany) params.company_id = Number(company_id);
    const companyFilterFactura = hasCompany ? `AND f.company_id = :company_id` : '';


    const dateFilter = hasDates
      ? `AND DATE(f.fecha_creacion) BETWEEN :desde AND :hasta`
      : '';

    // Buscar nombre del cliente: primero en clientes, luego en ordenes
    const [[checkCliente]] = await sequelize.query(`
      SELECT c.codigo_cliente, c.nombre_cliente
      FROM clientes c
      WHERE c.identificacion_cliente = :ruc OR c.codigo_cliente = :ruc
      LIMIT 1
    `, { replacements: params });

    let nombreEmpresa = checkCliente?.nombre_cliente || null;

    // Fallback: nombre desde ordenes
    if (!nombreEmpresa) {
      const [[checkOrden]] = await sequelize.query(`
        SELECT customer_nombre FROM ordenes
        WHERE customer_code = :ruc AND customer_nombre IS NOT NULL AND customer_nombre != ''
        ORDER BY id_orden DESC LIMIT 1
      `, { replacements: params });
      nombreEmpresa = checkOrden?.customer_nombre || null;
    }

    // Verificar que al menos existen facturas para este código
    if (!checkCliente && !nombreEmpresa) {
      const [[fcheck]] = await sequelize.query(`
        SELECT DISTINCT customer_code FROM facturas
        WHERE customer_code = :ruc AND status IN (0,2,3,4,5)
        LIMIT 1
      `, { replacements: params });
      if (!fcheck) {
        return res.status(404).json({ ok: false, message: 'Empresa no encontrada' });
      }
    }

    // ── Sucursales (direcciones de entrega) ──────────────────────
    // Parte de TODAS las direcciones del cliente en direcciones_clientes (más las que
    // aparezcan en facturas aunque no estén registradas). Las métricas se calculan
    // filtrando por período/compañía vía LEFT JOIN — así las direcciones sin actividad
    // muestran 0 en lugar de desaparecer.
    // Usamos ::text en todos los joins para evitar mismatches de tipo (integer/varchar).
    const sucursalesSQL = `
      WITH codigos_cliente AS (
        SELECT DISTINCT c.codigo_cliente::text AS customer_code
        FROM clientes c
        WHERE c.identificacion_cliente::text = :ruc OR c.codigo_cliente::text = :ruc
        UNION
        SELECT DISTINCT f.customer_code::text
        FROM facturas f
        WHERE f.customer_code::text = :ruc
          AND f.status IN (0,2,3,4,5)
      ),
      dirs_registradas AS (
        SELECT
          dc.codigo_cliente::text            AS customer_code,
          dc.codigo_direccion_cliente::text  AS customer_address_code
        FROM direcciones_clientes dc
        WHERE dc.codigo_cliente::text IN (SELECT customer_code FROM codigos_cliente)
      ),
      dirs_en_facturas AS (
        SELECT DISTINCT
          f.customer_code::text         AS customer_code,
          f.customer_address_code::text AS customer_address_code
        FROM facturas f
        WHERE f.customer_code::text IN (SELECT customer_code FROM codigos_cliente)
          AND f.status IN (0,2,3,4,5)
          ${companyFilterFactura}
          ${dateFilter}
      ),
      sucursales_base AS (
        SELECT customer_code, customer_address_code FROM dirs_registradas
        UNION
        SELECT customer_code, customer_address_code FROM dirs_en_facturas
      ),
      metricas AS (
        SELECT
          f.customer_code::text         AS customer_code,
          f.customer_address_code::text AS customer_address_code,
          SUM(f.total)::numeric             AS total_ventas,
          COUNT(DISTINCT f.code)::int       AS total_facturas,
          MAX(f.fecha_creacion)::date       AS ultima_compra
        FROM facturas f
        WHERE f.customer_code::text IN (SELECT customer_code FROM codigos_cliente)
          AND f.status IN (0,2,3,4,5)
          ${companyFilterFactura}
          ${dateFilter}
        GROUP BY f.customer_code, f.customer_address_code
      ),
      unidades_addr AS (
        SELECT
          f.customer_code::text         AS customer_code,
          f.customer_address_code::text AS customer_address_code,
          SUM(dd.cantidad)::bigint AS total_unidades
        FROM facturas f
        JOIN detalle_documento dd ON dd.documento_code = f.code
        WHERE f.customer_code::text IN (SELECT customer_code FROM codigos_cliente)
          AND f.status IN (0,2,3,4,5)
          ${companyFilterFactura}
          ${dateFilter}
        GROUP BY f.customer_code, f.customer_address_code
      ),
      nombres_dir AS (
        SELECT DISTINCT ON (o.customer_address_code)
          o.customer_address_code::text AS customer_address_code,
          o.customer_nombre
        FROM ordenes o
        WHERE o.customer_address_code IS NOT NULL
          AND o.customer_nombre IS NOT NULL AND o.customer_nombre != ''
          AND o.customer_code::text IN (SELECT customer_code FROM codigos_cliente)
        ORDER BY o.customer_address_code, o.id_orden DESC
      )
      SELECT
        s.customer_code                                                         AS codigo_cliente,
        s.customer_address_code                                                 AS codigo_sucursal,
        CASE
          WHEN TRIM(COALESCE(dc.descripcion_direccion_cliente, '')) NOT IN ('', 'delivery', 'other')
          THEN dc.descripcion_direccion_cliente
          WHEN TRIM(COALESCE(dc.calle1_direccion_cliente, '')) != ''
          THEN dc.calle1_direccion_cliente
          WHEN nd.customer_nombre IS NOT NULL
          THEN nd.customer_nombre
          ELSE COALESCE(s.customer_address_code, '-')
        END                                                                     AS nombre_sucursal,
        COALESCE(NULLIF(TRIM(dc.calle1_direccion_cliente), ''), '')             AS calle1_direccion,
        COALESCE(c.codigo_usuario_asignado_cliente, '-')                        AS seller_code,
        COALESCE(tn.descripcion, 'SIN CLASIFICAR')                              AS tipo_negocio,
        COALESCE(dc.latitud_direccion_cliente::text,  c.latitud_cliente::text,  '')  AS latitud,
        COALESCE(dc.longitud_direccion_cliente::text, c.longitud_cliente::text, '')  AS longitud,
        COALESCE(NULLIF(TRIM(dc.telefono_direccion_cliente), ''), NULLIF(TRIM(c.telefono_cliente), ''), '') AS telefono,
        COALESCE(m.total_ventas, 0)::numeric                                    AS total_ventas,
        COALESCE(m.total_facturas, 0)::int                                      AS total_facturas,
        m.ultima_compra,
        COALESCE(u.total_unidades, 0)::bigint                                   AS total_unidades,
        CASE
          WHEN m.ultima_compra IS NULL                    THEN 'SIN COMPRAS'
          WHEN CURRENT_DATE - m.ultima_compra <= 30       THEN 'ACTIVO'
          WHEN CURRENT_DATE - m.ultima_compra <= 60       THEN 'RIESGO'
          ELSE 'INACTIVO'
        END                                                                     AS estado_cliente
      FROM sucursales_base s
      LEFT JOIN metricas m
             ON m.customer_code         = s.customer_code
            AND m.customer_address_code IS NOT DISTINCT FROM s.customer_address_code
      LEFT JOIN unidades_addr u
             ON u.customer_code         = s.customer_code
            AND u.customer_address_code IS NOT DISTINCT FROM s.customer_address_code
      LEFT JOIN direcciones_clientes dc
             ON dc.codigo_cliente::text           = s.customer_code
            AND dc.codigo_direccion_cliente::text = s.customer_address_code
      LEFT JOIN nombres_dir nd      ON nd.customer_address_code = s.customer_address_code
      LEFT JOIN clientes c          ON c.codigo_cliente::text = s.customer_code
      LEFT JOIN tipos_negocio tn    ON tn.codigo::text = c.codigo_tipo_negocio::text
      ORDER BY COALESCE(m.total_ventas, 0) DESC NULLS LAST
    `;
    const [sucursales] = await sequelize.query(sucursalesSQL, { replacements: params });

    // ── Productos del período ─────────────
    const productosSQL = `
      SELECT
        COALESCE(dd.descripcion, '-') AS nombre_producto,
        SUM(dd.cantidad)::bigint       AS total_unidades,
        SUM(dd.total)                  AS total_ventas
      FROM facturas f
      JOIN detalle_documento dd ON dd.documento_code = f.code
      LEFT JOIN clientes c ON c.codigo_cliente = f.customer_code
      WHERE (c.identificacion_cliente = :ruc OR f.customer_code = :ruc OR c.codigo_cliente = :ruc)
        AND f.status IN (0,2,3,4,5)
        ${companyFilterFactura}
        ${dateFilter}
      GROUP BY dd.descripcion
      ORDER BY total_ventas DESC NULLS LAST
      LIMIT 200
    `;
    const [productos] = await sequelize.query(productosSQL, { replacements: params });

    const nombre = nombreEmpresa || ruc;
    const descripcionCompany = hasCompany
      ? (COMPANY_NAMES[Number(company_id)] || 'SIN COMPAÑÍA')
      : '';
    const totales = {
      unidades: sucursales.reduce((a, s) => a + Number(s.total_unidades || 0), 0),
      ventas:   sucursales.reduce((a, s) => a + Number(s.total_ventas   || 0), 0),
      facturas: sucursales.reduce((a, s) => a + Number(s.total_facturas || 0), 0),
    };

    return res.json({ ok: true, nombre, ruc, descripcion_company: descripcionCompany, totales, sucursales, productos });

  } catch (error) {
    console.error('❌ obtenerEmpresaDetalle:', error);
    return res.status(500).json({ ok: false, message: 'Error obteniendo detalle de empresa' });
  }
};


// ======================================================
// GET /api/dashboard-clientes/catalogo-productos
// Lista productos distintos y categorías para poblar los filtros multi-select
// ======================================================
exports.obtenerCatalogoProductos = async (req, res) => {
  try {
    const { desde, hasta } = req.query;
    const params = {};
    const where  = ['f.status IN (0,2,3,4,5)', `COALESCE(dd.descripcion, '') <> ''`];
    if (validarFechaISO(desde) && validarFechaISO(hasta)) {
      params.desde = desde;
      params.hasta = hasta;
      where.push(`DATE(f.fecha_creacion) BETWEEN :desde AND :hasta`);
    }

    const sql = `
      SELECT
        UPPER(TRIM(dd.descripcion))                                      AS descripcion,
        UPPER(TRIM(COALESCE(dd.descripcion_categoria, dd.producto_categoria, ''))) AS categoria,
        COUNT(*)::int                                                     AS usos
      FROM detalle_documento dd
      JOIN facturas f ON f.code = dd.documento_code
      WHERE ${where.join(' AND ')}
      GROUP BY 1, 2
      ORDER BY usos DESC, descripcion ASC
      LIMIT 5000
    `;
    const [rows] = await sequelize.query(sql, { replacements: params });

    const productos  = rows.map(r => ({
      descripcion: r.descripcion,
      categoria:   r.categoria || 'SIN CATEGORÍA',
      usos:        Number(r.usos || 0),
    }));
    const categorias = [...new Set(productos.map(p => p.categoria))].sort();

    return res.json({ ok: true, productos, categorias });
  } catch (error) {
    console.error('❌ obtenerCatalogoProductos:', error);
    return res.status(500).json({ ok: false, message: 'Error obteniendo catálogo de productos' });
  }
};


// ======================================================
// GET /api/dashboard-clientes/alertas-recuperacion?umbral=15
// Clientes con dias_sin_compra >= umbral que antes eran regulares
// (>=2 facturas en últimos 6 meses). Ordenados por valor en riesgo.
// ======================================================
exports.obtenerAlertasRecuperacion = async (req, res) => {
  try {
    const umbralRaw = parseInt(req.query.umbral, 10);
    const umbral    = Number.isFinite(umbralRaw) && umbralRaw > 0 ? umbralRaw : 15;

    // Ventana histórica para calcular promedios y filtrar "ex-clientes regulares"
    const VENTANA_MESES = 6;
    const MIN_FACTURAS_HISTORICAS = 2;

    const sql = `
      WITH
      -- Métricas históricas (últimos N meses) por cliente agrupado
      historico AS (
        SELECT
          COALESCE(NULLIF(TRIM(c.identificacion_cliente), ''), f.customer_code)
            || '::' || COALESCE(f.company_id, 0)::text                      AS group_key,
          MAX(f.fecha_creacion)::date                                       AS ultima_compra,
          MIN(f.fecha_creacion)::date                                       AS primera_compra_ventana,
          SUM(f.total)::numeric                                             AS total_ventas_ventana,
          COUNT(DISTINCT f.code)::int                                       AS total_facturas_ventana,
          MAX(f.company_id)                                                 AS company_id_max
        FROM facturas f
        LEFT JOIN clientes c ON c.codigo_cliente = f.customer_code
        WHERE f.status IN (0,2,3,4,5)
          AND f.fecha_creacion >= CURRENT_DATE - INTERVAL '${VENTANA_MESES} months'
        GROUP BY 1
      ),
      -- Datos de contacto + nombre + vendedor
      datos_cliente AS (
        SELECT
          COALESCE(NULLIF(TRIM(c.identificacion_cliente), ''), c.codigo_cliente)
            || '::' || COALESCE(f_last.company_id, 0)::text                 AS group_key,
          COALESCE(NULLIF(TRIM(c.identificacion_cliente), ''), '')          AS ruc,
          COALESCE(c.nombre_cliente, c.nombre_comercial_cliente, c.codigo_cliente) AS nombre_cliente,
          COALESCE(NULLIF(TRIM(c.telefono_cliente), ''), '')                AS telefono,
          COALESCE(NULLIF(TRIM(c.email_cliente), ''), '')                   AS email,
          COALESCE(c.codigo_usuario_asignado_cliente, '-')                  AS vendedor,
          COALESCE(tn.descripcion, 'SIN CLASIFICAR')                        AS tipo_negocio,
          COALESCE(c.ciudad_cliente, '')                                    AS ciudad,
          BOOL_OR(COALESCE(c.tiene_credito_cliente, false))                 AS tiene_credito
        FROM clientes c
        LEFT JOIN tipos_negocio tn ON tn.codigo = c.codigo_tipo_negocio
        LEFT JOIN LATERAL (
          SELECT company_id FROM facturas
          WHERE customer_code = c.codigo_cliente AND status IN (0,2,3,4,5)
          ORDER BY fecha_creacion DESC LIMIT 1
        ) f_last ON true
        GROUP BY c.codigo_cliente, c.identificacion_cliente, c.nombre_cliente,
                 c.nombre_comercial_cliente, c.telefono_cliente, c.email_cliente,
                 c.codigo_usuario_asignado_cliente, tn.descripcion, c.ciudad_cliente,
                 f_last.company_id
      ),
      -- Último contacto registrado por cliente (para mostrar y para evitar duplicados)
      ultimo_contacto AS (
        SELECT DISTINCT ON (group_key)
          group_key,
          fecha_contacto,
          contactado_por,
          resultado
        FROM contactos_recuperacion
        ORDER BY group_key, fecha_contacto DESC
      )
      SELECT
        h.group_key,
        COALESCE(d.ruc, '')                                                 AS ruc,
        COALESCE(d.nombre_cliente, h.group_key)                             AS nombre_cliente,
        COALESCE(d.telefono, '')                                            AS telefono,
        COALESCE(d.email, '')                                               AS email,
        COALESCE(d.vendedor, '-')                                           AS vendedor,
        COALESCE(d.tipo_negocio, 'SIN CLASIFICAR')                          AS tipo_negocio,
        COALESCE(d.ciudad, '')                                              AS ciudad,
        COALESCE(d.tiene_credito, false)                                    AS tiene_credito,
        h.ultima_compra,
        (CURRENT_DATE - h.ultima_compra)::int                               AS dias_sin_compra,
        h.total_ventas_ventana::numeric                                     AS ventas_${VENTANA_MESES}m,
        h.total_facturas_ventana                                            AS facturas_${VENTANA_MESES}m,
        -- Promedio mensual = ventas históricas / N meses (estable)
        ROUND(h.total_ventas_ventana / ${VENTANA_MESES}, 2)::numeric        AS promedio_mensual,
        -- Valor en riesgo: lo que se "habría vendido" en los días sin compra
        ROUND((h.total_ventas_ventana / ${VENTANA_MESES} / 30.0)
              * (CURRENT_DATE - h.ultima_compra)::int, 2)::numeric          AS valor_en_riesgo,
        uc.fecha_contacto                                                    AS ultimo_contacto_fecha,
        uc.contactado_por                                                    AS ultimo_contacto_por,
        uc.resultado                                                         AS ultimo_contacto_resultado
      FROM historico h
      LEFT JOIN datos_cliente d   ON d.group_key = h.group_key
      LEFT JOIN ultimo_contacto uc ON uc.group_key = h.group_key
      WHERE (CURRENT_DATE - h.ultima_compra) >= :umbral
        AND h.total_facturas_ventana >= ${MIN_FACTURAS_HISTORICAS}
      ORDER BY valor_en_riesgo DESC NULLS LAST
    `;

    const [rows] = await sequelize.query(sql, { replacements: { umbral } });

    // KPIs agregados
    const totalClientes  = rows.length;
    const totalEnRiesgo  = rows.reduce((a, r) => a + Number(r.valor_en_riesgo || 0), 0);
    const totalPromMes   = rows.reduce((a, r) => a + Number(r.promedio_mensual || 0), 0);
    const conTelefono    = rows.filter(r => r.telefono && r.telefono.length > 0).length;

    // Contactos hechos en los últimos 7 días (para "ya gestionados" y recovery rate)
    const [[stats]] = await sequelize.query(`
      SELECT
        COUNT(*)::int                                                  AS contactos_7d,
        COUNT(*) FILTER (WHERE resultado = 'RECUPERADO')::int          AS recuperados_7d,
        COUNT(DISTINCT group_key)::int                                 AS clientes_contactados_7d
      FROM contactos_recuperacion
      WHERE fecha_contacto >= CURRENT_DATE - INTERVAL '7 days'
    `);

    return res.json({
      ok: true,
      umbral,
      ventana_meses: VENTANA_MESES,
      kpis: {
        totalClientes,
        totalEnRiesgo,
        totalPromMes,
        conTelefono,
        contactos7d:           stats?.contactos_7d           || 0,
        recuperados7d:         stats?.recuperados_7d         || 0,
        clientesContactados7d: stats?.clientes_contactados_7d || 0,
      },
      data: rows,
    });
  } catch (error) {
    console.error('❌ obtenerAlertasRecuperacion:', error);
    return res.status(500).json({ ok: false, message: 'Error obteniendo alertas de recuperación' });
  }
};


// ======================================================
// POST /api/dashboard-clientes/contactos-recuperacion
// Body: { group_key, ruc?, nombre_cliente?, contactado_por,
//         resultado?, notas?, dias_sin_compra_al_contactar? }
// ======================================================
exports.registrarContacto = async (req, res) => {
  try {
    const {
      group_key,
      ruc,
      nombre_cliente,
      contactado_por,
      resultado,
      notas,
      dias_sin_compra_al_contactar,
    } = req.body || {};

    if (!group_key || !contactado_por) {
      return res.status(400).json({
        ok: false,
        message: 'group_key y contactado_por son requeridos',
      });
    }

    const RESULTADOS_VALIDOS = [
      'CONTACTADO',
      'NO_CONTESTA',
      'PROMETIO_COMPRAR',
      'NO_INTERESADO',
      'RECUPERADO',          // KPI de recuperación de inactivos totales
      'CONSUMO_RECUPERADO',  // KPI distinto: cliente que recuperó volumen de consumo
    ];
    const resultadoFinal = RESULTADOS_VALIDOS.includes(resultado) ? resultado : 'CONTACTADO';

    const reg = await ContactoRecuperacion.create({
      group_key,
      ruc: ruc || null,
      nombre_cliente: nombre_cliente || null,
      contactado_por,
      resultado: resultadoFinal,
      notas: notas || null,
      dias_sin_compra_al_contactar:
        Number.isFinite(Number(dias_sin_compra_al_contactar))
          ? Number(dias_sin_compra_al_contactar)
          : null,
    });

    return res.json({ ok: true, contacto: reg });
  } catch (error) {
    console.error('❌ registrarContacto:', error);
    return res.status(500).json({ ok: false, message: 'Error registrando contacto' });
  }
};


// ======================================================
// GET /api/dashboard-clientes/salud-rutas?dias=60&prefijos=R,PVR
// Compara por ruta:
//   - nuevos     (primera factura ≤ dias)
//   - perdidos   (sin compra ≥ dias y eran regulares)
//   - activos    (compra en últimos 30 días)
//   - $ perdido  (suma de promedios mensuales de los perdidos)
//   - $ ganado   (ventas históricas de los nuevos)
//   - net delta  (nuevos − perdidos)
//   - rotación%  (perdidos / activos)
// ======================================================
exports.obtenerSaludRutas = async (req, res) => {
  try {
    const diasRaw = parseInt(req.query.dias, 10);
    const dias    = Number.isFinite(diasRaw) && diasRaw > 0 ? diasRaw : 60;

    const filtro = buildPrefijoFilter('UPPER(c.codigo_usuario_asignado_cliente)', req.query.prefijos);
    const filtroPrefijos = filtro.where;
    const replacements = { dias, ...filtro.replacements };

    const VENTANA_MESES = 6;

    const sql = `
      WITH actividad AS (
        SELECT
          f.customer_code,
          MAX(f.fecha_creacion)::date                                                       AS ultima_compra,
          MIN(f.fecha_creacion)::date                                                       AS primera_compra,
          SUM(CASE WHEN f.fecha_creacion >= CURRENT_DATE - INTERVAL '${VENTANA_MESES} months'
                   THEN f.total ELSE 0 END)::numeric                                         AS ventas_${VENTANA_MESES}m,
          COUNT(DISTINCT CASE WHEN f.fecha_creacion >= CURRENT_DATE - INTERVAL '${VENTANA_MESES} months'
                              THEN f.code END)::int                                          AS facturas_${VENTANA_MESES}m,
          SUM(f.total)::numeric                                                              AS ventas_total,
          COUNT(DISTINCT f.code)::int                                                        AS facturas_total
        FROM facturas f
        WHERE f.status IN (0,2,3,4,5)
        GROUP BY f.customer_code
      ),
      clasificados AS (
        SELECT
          UPPER(c.codigo_usuario_asignado_cliente)                                  AS ruta,
          c.codigo_cliente,
          a.ultima_compra,
          a.primera_compra,
          a.ventas_${VENTANA_MESES}m / ${VENTANA_MESES}.0                           AS promedio_mensual,
          a.ventas_total,
          (CURRENT_DATE - a.ultima_compra)::int                                     AS dias_sin_compra,
          (CURRENT_DATE - a.primera_compra)::int                                    AS dias_antiguedad,
          CASE
            WHEN (CURRENT_DATE - a.primera_compra) <= :dias                                                THEN 'NUEVO'
            WHEN (CURRENT_DATE - a.ultima_compra) >= :dias AND a.facturas_${VENTANA_MESES}m >= 2          THEN 'PERDIDO'
            WHEN (CURRENT_DATE - a.ultima_compra) <= 30                                                    THEN 'ACTIVO'
            ELSE 'OTRO'
          END                                                                       AS clasificacion
        FROM clientes c
        JOIN actividad a ON a.customer_code = c.codigo_cliente
        WHERE c.codigo_usuario_asignado_cliente IS NOT NULL
          AND TRIM(c.codigo_usuario_asignado_cliente) <> ''
          AND (${filtroPrefijos})
      )
      SELECT
        ruta,
        COUNT(*) FILTER (WHERE clasificacion = 'NUEVO')::int                                       AS nuevos,
        COUNT(*) FILTER (WHERE clasificacion = 'PERDIDO')::int                                     AS perdidos,
        COUNT(*) FILTER (WHERE clasificacion = 'ACTIVO')::int                                      AS activos,
        COUNT(*)::int                                                                              AS clientes_totales,
        ROUND(COALESCE(SUM(promedio_mensual) FILTER (WHERE clasificacion = 'PERDIDO'), 0), 2)::numeric  AS valor_perdido_mensual,
        ROUND(COALESCE(SUM(ventas_total) FILTER (WHERE clasificacion = 'NUEVO'), 0), 2)::numeric   AS valor_ganado,
        ROUND(COALESCE(SUM(promedio_mensual) FILTER (WHERE clasificacion = 'ACTIVO'), 0), 2)::numeric   AS valor_activo_mensual,
        (COUNT(*) FILTER (WHERE clasificacion = 'NUEVO')
         - COUNT(*) FILTER (WHERE clasificacion = 'PERDIDO'))::int                                 AS net_delta_clientes,
        CASE WHEN COUNT(*) FILTER (WHERE clasificacion = 'ACTIVO') > 0
             THEN ROUND(COUNT(*) FILTER (WHERE clasificacion = 'PERDIDO')::numeric
                         / COUNT(*) FILTER (WHERE clasificacion = 'ACTIVO')::numeric * 100, 1)
             ELSE 0 END                                                                            AS rotacion_porc
      FROM clasificados
      GROUP BY ruta
      ORDER BY valor_perdido_mensual DESC NULLS LAST, ruta ASC
    `;

    const [rows] = await sequelize.query(sql, { replacements });

    // Totales agregados (resumen general)
    const totales = rows.reduce((acc, r) => ({
      nuevos:                acc.nuevos                + Number(r.nuevos                || 0),
      perdidos:              acc.perdidos              + Number(r.perdidos              || 0),
      activos:               acc.activos               + Number(r.activos               || 0),
      valor_perdido_mensual: acc.valor_perdido_mensual + Number(r.valor_perdido_mensual || 0),
      valor_ganado:          acc.valor_ganado          + Number(r.valor_ganado          || 0),
      valor_activo_mensual:  acc.valor_activo_mensual  + Number(r.valor_activo_mensual  || 0),
    }), {
      nuevos: 0, perdidos: 0, activos: 0,
      valor_perdido_mensual: 0, valor_ganado: 0, valor_activo_mensual: 0,
    });
    totales.net_delta_clientes = totales.nuevos - totales.perdidos;
    totales.rotacion_porc = totales.activos > 0
      ? Number((totales.perdidos / totales.activos * 100).toFixed(1))
      : 0;

    return res.json({
      ok: true,
      dias,
      prefijos: filtro.etiqueta,
      ventana_meses: VENTANA_MESES,
      totales,
      data: rows,
    });
  } catch (error) {
    console.error('❌ obtenerSaludRutas:', error);
    return res.status(500).json({ ok: false, message: 'Error obteniendo salud por ruta' });
  }
};


// ======================================================
// GET /api/dashboard-clientes/clientes-mapa?dias=15&prefijos=*&estado=todos
// Devuelve clientes con coordenadas válidas + estado para visualizar en mapa.
// estado: 'todos' | 'inactivo' | 'riesgo' | 'activo' | 'perdido' | 'nuevo'
// ======================================================
exports.obtenerClientesMapa = async (req, res) => {
  try {
    const diasRaw = parseInt(req.query.dias, 10);
    const dias    = Number.isFinite(diasRaw) && diasRaw > 0 ? diasRaw : 15;

    const filtro = buildPrefijoFilter('UPPER(c.codigo_usuario_asignado_cliente)', req.query.prefijos);
    const filtroPrefijos = filtro.where;

    const estadoFiltro = (req.query.estado || 'todos').toString().toUpperCase();

    const replacements = { dias, ...filtro.replacements };

    const VENTANA_MESES = 6;

    // Las coordenadas reales de Aqua están mayormente en direcciones_clientes
    // (por sucursal). Estrategia: tomar la dirección de la última factura del
    // cliente y usar SUS coords; si no, fallback a clientes.latitud_cliente.
    const sql = `
      WITH actividad AS (
        SELECT
          f.customer_code,
          MAX(f.fecha_creacion)::date                                                       AS ultima_compra,
          MIN(f.fecha_creacion)::date                                                       AS primera_compra,
          SUM(CASE WHEN f.fecha_creacion >= CURRENT_DATE - INTERVAL '${VENTANA_MESES} months'
                   THEN f.total ELSE 0 END)::numeric                                         AS ventas_${VENTANA_MESES}m,
          COUNT(DISTINCT CASE WHEN f.fecha_creacion >= CURRENT_DATE - INTERVAL '${VENTANA_MESES} months'
                              THEN f.code END)::int                                          AS facturas_${VENTANA_MESES}m,
          MAX(f.company_id)                                                                  AS company_id
        FROM facturas f
        WHERE f.status IN (0,2,3,4,5)
        GROUP BY f.customer_code
      ),
      ultima_dir AS (
        -- Última dirección usada en factura (más reciente) por cliente
        SELECT DISTINCT ON (f.customer_code)
          f.customer_code,
          f.customer_address_code
        FROM facturas f
        WHERE f.status IN (0,2,3,4,5)
        ORDER BY f.customer_code, f.fecha_creacion DESC
      ),
      coords AS (
        -- Coordenadas: cascada con fallbacks. Las columnas en clientes son VARCHAR
        -- (numéricas serializadas como string), en direcciones_clientes son numeric.
        -- Por eso casteamos todo a text para usar NULLIF de blanco y '0' uniformemente.
        SELECT
          c.codigo_cliente,
          COALESCE(
            NULLIF(NULLIF(dc_last.latitud_direccion_cliente::text, ''), '0')::float,
            NULLIF(NULLIF(dc_any.latitud_direccion_cliente::text,  ''), '0')::float,
            NULLIF(NULLIF(c.latitud_cliente::text,                 ''), '0')::float
          )                                                                          AS lat,
          COALESCE(
            NULLIF(NULLIF(dc_last.longitud_direccion_cliente::text, ''), '0')::float,
            NULLIF(NULLIF(dc_any.longitud_direccion_cliente::text,  ''), '0')::float,
            NULLIF(NULLIF(c.longitud_cliente::text,                 ''), '0')::float
          )                                                                          AS lng
        FROM clientes c
        LEFT JOIN ultima_dir ud
               ON ud.customer_code = c.codigo_cliente
        LEFT JOIN direcciones_clientes dc_last
               ON dc_last.codigo_cliente::text           = c.codigo_cliente::text
              AND dc_last.codigo_direccion_cliente::text = ud.customer_address_code::text
        LEFT JOIN LATERAL (
          SELECT latitud_direccion_cliente, longitud_direccion_cliente
          FROM direcciones_clientes
          WHERE codigo_cliente::text = c.codigo_cliente::text
            AND latitud_direccion_cliente IS NOT NULL
            AND latitud_direccion_cliente <> 0
          LIMIT 1
        ) dc_any ON true
      )
      SELECT
        COALESCE(NULLIF(TRIM(c.identificacion_cliente), ''), c.codigo_cliente)
          || '::' || COALESCE(a.company_id, 0)::text                              AS group_key,
        c.codigo_cliente,
        COALESCE(NULLIF(TRIM(c.identificacion_cliente), ''), '')                  AS ruc,
        COALESCE(c.nombre_cliente, c.nombre_comercial_cliente, c.codigo_cliente)  AS nombre_cliente,
        UPPER(c.codigo_usuario_asignado_cliente)                                  AS ruta,
        COALESCE(NULLIF(TRIM(c.telefono_cliente), ''), '')                        AS telefono,
        COALESCE(NULLIF(TRIM(c.email_cliente), ''), '')                           AS email,
        COALESCE(c.ciudad_cliente, '')                                            AS ciudad,
        COALESCE(tn.descripcion, 'SIN CLASIFICAR')                                AS tipo_negocio,
        co.lat,
        co.lng,
        a.ultima_compra,
        (CURRENT_DATE - a.ultima_compra)::int                                     AS dias_sin_compra,
        a.primera_compra,
        ROUND(COALESCE(a.ventas_${VENTANA_MESES}m, 0) / ${VENTANA_MESES}.0, 2)::numeric  AS promedio_mensual,
        ROUND((COALESCE(a.ventas_${VENTANA_MESES}m, 0) / ${VENTANA_MESES}.0 / 30.0)
              * (CURRENT_DATE - a.ultima_compra)::int, 2)::numeric                 AS valor_en_riesgo,
        COALESCE(a.facturas_${VENTANA_MESES}m, 0)                                 AS facturas_6m,
        CASE
          WHEN a.ultima_compra IS NULL                                                                   THEN 'SIN_COMPRAS'
          WHEN (CURRENT_DATE - a.primera_compra) <= :dias                                                THEN 'NUEVO'
          WHEN (CURRENT_DATE - a.ultima_compra) >= :dias AND a.facturas_${VENTANA_MESES}m >= 2          THEN 'PERDIDO'
          WHEN (CURRENT_DATE - a.ultima_compra) <= 30                                                    THEN 'ACTIVO'
          WHEN (CURRENT_DATE - a.ultima_compra) <= 60                                                    THEN 'RIESGO'
          ELSE 'INACTIVO'
        END                                                                       AS estado
      FROM clientes c
      LEFT JOIN actividad a       ON a.customer_code = c.codigo_cliente
      LEFT JOIN tipos_negocio tn  ON tn.codigo = c.codigo_tipo_negocio
      JOIN coords co              ON co.codigo_cliente = c.codigo_cliente
      WHERE co.lat IS NOT NULL
        AND co.lng IS NOT NULL
        AND (${filtroPrefijos})
    `;

    const [rows] = await sequelize.query(sql, { replacements });

    // Filtrar por estado si se especifica
    const filtrados = estadoFiltro && estadoFiltro !== 'TODOS'
      ? rows.filter(r => r.estado === estadoFiltro)
      : rows;

    // KPIs por estado
    const conteo = filtrados.reduce((acc, r) => {
      acc[r.estado] = (acc[r.estado] || 0) + 1;
      return acc;
    }, {});

    return res.json({
      ok: true,
      dias,
      prefijos: filtro.etiqueta,
      estado: estadoFiltro,
      total: filtrados.length,
      conteo,
      data: filtrados,
    });
  } catch (error) {
    console.error('❌ obtenerClientesMapa:', error);
    return res.status(500).json({ ok: false, message: 'Error obteniendo clientes para el mapa' });
  }
};


// ======================================================
// GET /api/dashboard-clientes/declive-consumo?umbral=30&ventana=14&prefijos=*
// MÓDULO 2 — Detector de caída de consumo activo
// Compara baseline (últimos 90d) vs ventana reciente (14/21/28d) y devuelve
// clientes cuya caída en unidades supera el umbral. Excluye clientes ya
// gestionados como RECUPERADO/NO_INTERESADO/CONSUMO_RECUPERADO.
// ======================================================
exports.obtenerDeclieveConsumo = async (req, res) => {
  try {
    const umbralRaw = parseInt(req.query.umbral, 10);
    const umbral    = Number.isFinite(umbralRaw) && umbralRaw > 0 ? umbralRaw : 30;

    const ventanaRaw = parseInt(req.query.ventana, 10);
    // Solo permitir 14, 21 o 28 (lo del brief). Default 14.
    const ventana = [14, 21, 28].includes(ventanaRaw) ? ventanaRaw : 14;

    const filtro = buildPrefijoFilter('UPPER(c.codigo_usuario_asignado_cliente)', req.query.prefijos);
    const filtroPrefijos = filtro.where;

    const replacements = { umbral, ventana, ...filtro.replacements };

    const sql = `
      WITH baseline AS (
        -- Histórico 90 días por cliente. Filtro de calidad: ≥4 semanas con compras
        SELECT
          f.customer_code,
          SUM(dd.cantidad)::numeric                                    AS unidades_90d,
          SUM(f.total)::numeric                                        AS ventas_90d,
          COUNT(DISTINCT f.code)::int                                  AS facturas_90d,
          COUNT(DISTINCT DATE_TRUNC('week', f.fecha_creacion))::int    AS semanas_con_compra,
          MIN(f.fecha_creacion)::date                                  AS primera_compra_90d,
          MAX(f.company_id)                                            AS company_id
        FROM facturas f
        JOIN detalle_documento dd ON dd.documento_code = f.code
        WHERE f.status IN (0,2,3,4,5)
          AND f.fecha_creacion >= CURRENT_DATE - INTERVAL '90 days'
        GROUP BY f.customer_code
        HAVING COUNT(DISTINCT DATE_TRUNC('week', f.fecha_creacion)) >= 4
      ),
      reciente AS (
        -- Ventana reciente: ≥2 pedidos para evitar ruido por vacaciones
        SELECT
          f.customer_code,
          SUM(dd.cantidad)::numeric                                    AS unidades_reciente,
          SUM(f.total)::numeric                                        AS ventas_reciente,
          COUNT(DISTINCT f.code)::int                                  AS facturas_reciente,
          MAX(f.fecha_creacion)::date                                  AS ultima_compra,
          COUNT(DISTINCT DATE_TRUNC('week', f.fecha_creacion))::int    AS semanas_consecutivas_recientes
        FROM facturas f
        JOIN detalle_documento dd ON dd.documento_code = f.code
        WHERE f.status IN (0,2,3,4,5)
          AND f.fecha_creacion >= CURRENT_DATE - (:ventana || ' days')::interval
        GROUP BY f.customer_code
        HAVING COUNT(DISTINCT f.code) >= 2
      ),
      ultimo_contacto AS (
        SELECT DISTINCT ON (group_key)
          group_key, fecha_contacto, contactado_por, resultado
        FROM contactos_recuperacion
        ORDER BY group_key, fecha_contacto DESC
      ),
      calculado AS (
        SELECT
          c.codigo_cliente,
          COALESCE(NULLIF(TRIM(c.identificacion_cliente), ''), c.codigo_cliente)
            || '::' || COALESCE(b.company_id, 0)::text                 AS group_key,
          COALESCE(NULLIF(TRIM(c.identificacion_cliente), ''), '')     AS ruc,
          COALESCE(c.nombre_cliente, c.nombre_comercial_cliente, c.codigo_cliente) AS nombre_cliente,
          UPPER(c.codigo_usuario_asignado_cliente)                     AS vendedor,
          COALESCE(NULLIF(TRIM(c.telefono_cliente), ''), '')           AS telefono,
          COALESCE(NULLIF(TRIM(c.email_cliente), ''), '')              AS email,
          COALESCE(c.ciudad_cliente, '')                               AS ciudad,
          COALESCE(tn.descripcion, 'SIN CLASIFICAR')                   AS tipo_negocio,
          COALESCE(sub.descripcion_subcanal, '')                       AS canal_subcanal,
          b.unidades_90d,
          r.unidades_reciente,
          b.ventas_90d,
          r.ventas_reciente,
          b.facturas_90d,
          r.facturas_reciente,
          r.ultima_compra,
          (CURRENT_DATE - r.ultima_compra)::int                        AS dias_sin_compra,
          b.semanas_con_compra                                          AS baseline_semanas,
          -- Promedios semanales (casts a numeric porque ROUND no acepta double precision)
          ROUND((b.unidades_90d / (90.0/7))::numeric, 2)                AS baseline_semanal_unidades,
          ROUND((r.unidades_reciente / (:ventana::numeric/7))::numeric, 2) AS reciente_semanal_unidades,
          -- Precio promedio histórico (lo que típicamente paga ese cliente por unidad)
          CASE WHEN b.unidades_90d > 0
               THEN ROUND((b.ventas_90d / b.unidades_90d)::numeric, 2)
               ELSE 0::numeric END                                      AS precio_promedio,
          -- Caída %
          CASE WHEN b.unidades_90d > 0 THEN
            ROUND(
              (((b.unidades_90d / (90.0/7)) - (r.unidades_reciente / (:ventana::numeric/7)))
              / (b.unidades_90d / (90.0/7))
              * 100)::numeric, 1)
          ELSE 0::numeric END                                           AS caida_porc,
          -- Volumen $ en riesgo: (baseline_sem - reciente_sem) × precio × semanas_ventana
          CASE WHEN b.unidades_90d > 0 THEN
            GREATEST(0::numeric, ROUND(
              (((b.unidades_90d / (90.0/7)) - (r.unidades_reciente / (:ventana::numeric/7)))
              * (b.ventas_90d / NULLIF(b.unidades_90d, 0))
              * (:ventana::numeric/7))::numeric
            , 2))
          ELSE 0::numeric END                                           AS volumen_riesgo,
          uc.fecha_contacto                                             AS ultimo_contacto_fecha,
          uc.contactado_por                                             AS ultimo_contacto_por,
          uc.resultado                                                  AS ultimo_contacto_resultado
        FROM clientes c
        JOIN baseline b      ON b.customer_code = c.codigo_cliente
        JOIN reciente r      ON r.customer_code = c.codigo_cliente
        LEFT JOIN tipos_negocio tn ON tn.codigo = c.codigo_tipo_negocio
        LEFT JOIN subcanales sub   ON sub.codigo_subcanal = c.codigo_subcanal
        LEFT JOIN ultimo_contacto uc
               ON uc.group_key = COALESCE(NULLIF(TRIM(c.identificacion_cliente), ''), c.codigo_cliente)
                                  || '::' || COALESCE(b.company_id, 0)::text
        WHERE (${filtroPrefijos})
      )
      SELECT *
      FROM calculado
      WHERE caida_porc >= :umbral
        AND (
          ultimo_contacto_resultado IS NULL
          OR ultimo_contacto_resultado NOT IN ('RECUPERADO', 'NO_INTERESADO', 'CONSUMO_RECUPERADO')
        )
      ORDER BY volumen_riesgo DESC NULLS LAST
    `;

    const [rows] = await sequelize.query(sql, { replacements });

    // KPIs
    const totalClientes = rows.length;
    const totalRiesgo   = rows.reduce((a, r) => a + Number(r.volumen_riesgo || 0), 0);
    const caidaPromedio = totalClientes > 0
      ? rows.reduce((a, r) => a + Number(r.caida_porc || 0), 0) / totalClientes
      : 0;

    // Contactos hechos en últimos 7 días con resultado CONSUMO_RECUPERADO
    const [[stats]] = await sequelize.query(`
      SELECT
        COUNT(*) FILTER (WHERE resultado = 'CONSUMO_RECUPERADO')::int  AS recuperados_7d,
        COUNT(DISTINCT group_key) FILTER (
          WHERE fecha_contacto >= CURRENT_DATE - INTERVAL '7 days'
        )::int                                                          AS clientes_contactados_7d
      FROM contactos_recuperacion
      WHERE fecha_contacto >= CURRENT_DATE - INTERVAL '7 days'
    `);

    return res.json({
      ok: true,
      umbral,
      ventana,
      prefijos: filtro.etiqueta,
      kpis: {
        totalClientes,
        totalRiesgo:           Number(totalRiesgo.toFixed(2)),
        caidaPromedio:         Number(caidaPromedio.toFixed(1)),
        recuperados7d:         stats?.recuperados_7d         || 0,
        clientesContactados7d: stats?.clientes_contactados_7d || 0,
      },
      data: rows,
    });
  } catch (error) {
    console.error('❌ obtenerDeclieveConsumo:', error);
    return res.status(500).json({ ok: false, message: 'Error obteniendo declive de consumo' });
  }
};


// ======================================================
// GET /api/dashboard-clientes/clientes-nuevos?desde=2026-01-01&hasta=2026-05-05&canal=
// MÓDULO 1 — Dashboard de clientes nuevos por canal
// "Cliente nuevo" = primera factura confirmada dentro del rango de fechas.
// (fecha_creacion_cliente no es confiable: se reescribe en cada sync de Odoo).
// Canal = tipos_negocio.descripcion (proxy mientras se limpia codigo_subcanal).
// ======================================================
exports.obtenerClientesNuevos = async (req, res) => {
  try {
    const { desde, hasta } = req.query;
    if (!validarFechaISO(desde) || !validarFechaISO(hasta)) {
      return res.status(400).json({ ok: false, message: 'desde y hasta requeridos (YYYY-MM-DD)' });
    }
    // Filtro opcional de canal (CSV de descripciones de tipo_negocio)
    const canalFilter = typeof req.query.canal === 'string' && req.query.canal.trim()
      ? req.query.canal.split('|||').map(s => s.trim().toUpperCase()).filter(Boolean)
      : [];

    const replacements = { desde, hasta };
    let canalWhere = '';
    if (canalFilter.length) {
      replacements.canalFilter = canalFilter;
      canalWhere = `AND UPPER(canal) IN (:canalFilter)`;
    }

    const sql = `
      WITH primera_factura AS (
        -- Primera factura confirmada por cliente
        SELECT
          f.customer_code,
          MIN(f.fecha_creacion)::date AS primera_fecha
        FROM facturas f
        WHERE f.status IN (0,2,3,4,5)
        GROUP BY f.customer_code
      ),
      nuevos AS (
        -- Clientes cuya primera factura cae en el rango
        SELECT
          c.codigo_cliente,
          COALESCE(NULLIF(TRIM(c.identificacion_cliente), ''), c.codigo_cliente) AS ruc,
          COALESCE(c.nombre_cliente, c.nombre_comercial_cliente, c.codigo_cliente) AS nombre_cliente,
          UPPER(c.codigo_usuario_asignado_cliente) AS vendedor,
          COALESCE(NULLIF(TRIM(c.telefono_cliente), ''), '') AS telefono,
          COALESCE(NULLIF(TRIM(c.email_cliente), ''), '') AS email,
          COALESCE(c.ciudad_cliente, '') AS ciudad,
          COALESCE(UPPER(tn.descripcion), 'SIN CLASIFICAR') AS canal,
          pf.primera_fecha AS fecha_creacion
        FROM clientes c
        JOIN primera_factura pf ON pf.customer_code = c.codigo_cliente
        LEFT JOIN tipos_negocio tn ON tn.codigo = c.codigo_tipo_negocio
        WHERE pf.primera_fecha BETWEEN :desde::date AND :hasta::date
      ),
      actividad_periodo AS (
        -- Pedidos y facturación de los nuevos en el mismo periodo
        SELECT
          n.codigo_cliente,
          COUNT(DISTINCT f.code)::int AS pedidos_periodo,
          COALESCE(SUM(f.total), 0)::numeric AS facturado_periodo,
          MAX(f.fecha_creacion)::date AS ultima_compra_periodo
        FROM nuevos n
        LEFT JOIN facturas f
               ON f.customer_code = n.codigo_cliente
              AND f.status IN (0,2,3,4,5)
              AND f.fecha_creacion::date BETWEEN :desde::date AND :hasta::date
        GROUP BY n.codigo_cliente
      )
      SELECT
        n.codigo_cliente,
        n.ruc,
        n.nombre_cliente,
        n.vendedor,
        n.telefono,
        n.email,
        n.ciudad,
        n.canal,
        n.fecha_creacion,
        ap.pedidos_periodo,
        ap.facturado_periodo,
        ap.ultima_compra_periodo,
        CASE
          WHEN ap.pedidos_periodo >= 2 THEN 'ACTIVO'
          WHEN ap.pedidos_periodo = 1   THEN 'SIN_RECOMPRA'
          ELSE 'SIN_ACTIVIDAD'
        END AS estado
      FROM nuevos n
      JOIN actividad_periodo ap ON ap.codigo_cliente = n.codigo_cliente
      WHERE 1=1 ${canalWhere}
      ORDER BY ap.facturado_periodo DESC NULLS LAST
    `;

    const [rows] = await sequelize.query(sql, { replacements });

    // Agregaciones por canal
    const porCanal = {};
    for (const r of rows) {
      const canal = r.canal || 'SIN CLASIFICAR';
      if (!porCanal[canal]) {
        porCanal[canal] = {
          canal,
          total_nuevos: 0,
          facturado: 0,
          activos: 0,         // 2+ compras
          sin_recompra: 0,    // 1 compra
          sin_actividad: 0,   // 0 compras
        };
      }
      const c = porCanal[canal];
      c.total_nuevos += 1;
      c.facturado += Number(r.facturado_periodo || 0);
      if (r.estado === 'ACTIVO') c.activos += 1;
      else if (r.estado === 'SIN_RECOMPRA') c.sin_recompra += 1;
      else c.sin_actividad += 1;
    }
    // Calcular porcentajes
    const canales = Object.values(porCanal).map(c => ({
      ...c,
      facturado: Number(c.facturado.toFixed(2)),
      pct_retencion_temprana: c.total_nuevos > 0
        ? Number((c.activos / c.total_nuevos * 100).toFixed(1))
        : 0,
      pct_sin_recompra: c.total_nuevos > 0
        ? Number((c.sin_recompra / c.total_nuevos * 100).toFixed(1))
        : 0,
      pct_sin_actividad: c.total_nuevos > 0
        ? Number((c.sin_actividad / c.total_nuevos * 100).toFixed(1))
        : 0,
    })).sort((a, b) => b.total_nuevos - a.total_nuevos);

    // Totales
    const totales = canales.reduce((acc, c) => ({
      total_nuevos: acc.total_nuevos + c.total_nuevos,
      facturado: acc.facturado + c.facturado,
      activos: acc.activos + c.activos,
      sin_recompra: acc.sin_recompra + c.sin_recompra,
      sin_actividad: acc.sin_actividad + c.sin_actividad,
    }), { total_nuevos: 0, facturado: 0, activos: 0, sin_recompra: 0, sin_actividad: 0 });
    totales.facturado = Number(totales.facturado.toFixed(2));
    totales.pct_retencion_temprana = totales.total_nuevos > 0
      ? Number((totales.activos / totales.total_nuevos * 100).toFixed(1)) : 0;
    totales.pct_sin_recompra = totales.total_nuevos > 0
      ? Number((totales.sin_recompra / totales.total_nuevos * 100).toFixed(1)) : 0;
    totales.pct_sin_actividad = totales.total_nuevos > 0
      ? Number((totales.sin_actividad / totales.total_nuevos * 100).toFixed(1)) : 0;

    return res.json({
      ok: true,
      desde, hasta,
      canalFilter,
      totales,
      canales,
      data: rows,
    });
  } catch (error) {
    console.error('❌ obtenerClientesNuevos:', error);
    return res.status(500).json({ ok: false, message: 'Error obteniendo clientes nuevos' });
  }
};


// ======================================================
// GET /api/dashboard-clientes/recovery-rate?desde=&hasta=
// Reportería: contactos × resultados × vendedor (auditoría / efectividad)
// ======================================================
exports.obtenerRecoveryRate = async (req, res) => {
  try {
    const { desde, hasta } = req.query;
    const replacements = {};
    let dateWhere = '';
    if (validarFechaISO(desde) && validarFechaISO(hasta)) {
      dateWhere = `WHERE fecha_contacto::date BETWEEN :desde::date AND :hasta::date`;
      replacements.desde = desde;
      replacements.hasta = hasta;
    } else {
      // Default últimos 30 días
      dateWhere = `WHERE fecha_contacto >= CURRENT_DATE - INTERVAL '30 days'`;
    }

    const sql = `
      SELECT
        contactado_por                                                         AS vendedor,
        COUNT(*)::int                                                          AS contactos_total,
        COUNT(DISTINCT group_key)::int                                         AS clientes_unicos,
        COUNT(*) FILTER (WHERE resultado = 'CONTACTADO')::int                  AS contactados,
        COUNT(*) FILTER (WHERE resultado = 'NO_CONTESTA')::int                 AS no_contesta,
        COUNT(*) FILTER (WHERE resultado = 'PROMETIO_COMPRAR')::int            AS prometio,
        COUNT(*) FILTER (WHERE resultado = 'NO_INTERESADO')::int               AS no_interesado,
        COUNT(*) FILTER (WHERE resultado = 'RECUPERADO')::int                  AS recuperados,
        COUNT(*) FILTER (WHERE resultado = 'CONSUMO_RECUPERADO')::int          AS consumo_recuperado
      FROM contactos_recuperacion
      ${dateWhere}
      GROUP BY contactado_por
      ORDER BY contactos_total DESC
    `;
    const [rows] = await sequelize.query(sql, { replacements });

    // Calcular recovery rate por vendedor: (recuperados+consumo_recuperado) / contactos_total
    const conRate = rows.map(r => {
      const total = Number(r.contactos_total) || 0;
      const recup = Number(r.recuperados) + Number(r.consumo_recuperado);
      return {
        ...r,
        recovery_rate: total > 0 ? Number((recup / total * 100).toFixed(1)) : 0,
      };
    });

    // Totales
    const totales = conRate.reduce((acc, r) => ({
      contactos_total:    acc.contactos_total    + Number(r.contactos_total),
      clientes_unicos:    acc.clientes_unicos    + Number(r.clientes_unicos),
      contactados:        acc.contactados        + Number(r.contactados),
      no_contesta:        acc.no_contesta        + Number(r.no_contesta),
      prometio:           acc.prometio           + Number(r.prometio),
      no_interesado:      acc.no_interesado      + Number(r.no_interesado),
      recuperados:        acc.recuperados        + Number(r.recuperados),
      consumo_recuperado: acc.consumo_recuperado + Number(r.consumo_recuperado),
    }), {
      contactos_total: 0, clientes_unicos: 0, contactados: 0, no_contesta: 0,
      prometio: 0, no_interesado: 0, recuperados: 0, consumo_recuperado: 0,
    });
    totales.recovery_rate = totales.contactos_total > 0
      ? Number(((totales.recuperados + totales.consumo_recuperado) / totales.contactos_total * 100).toFixed(1))
      : 0;

    return res.json({ ok: true, totales, vendedores: conRate });
  } catch (error) {
    console.error('❌ obtenerRecoveryRate:', error);
    return res.status(500).json({ ok: false, message: 'Error obteniendo recovery rate' });
  }
};


// ======================================================
// GET /api/dashboard-clientes/contactos-recuperacion/historial/:group_key
// ======================================================
exports.obtenerHistorialContactos = async (req, res) => {
  try {
    const { group_key } = req.params;
    if (!group_key) {
      return res.status(400).json({ ok: false, message: 'group_key requerido' });
    }

    const contactos = await ContactoRecuperacion.findAll({
      where: { group_key },
      order: [['fecha_contacto', 'DESC']],
      limit: 100,
    });

    return res.json({ ok: true, contactos });
  } catch (error) {
    console.error('❌ obtenerHistorialContactos:', error);
    return res.status(500).json({ ok: false, message: 'Error obteniendo historial' });
  }
};
