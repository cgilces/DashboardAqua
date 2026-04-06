const sequelize = require("../../db");

// ================================
// VALIDAR FECHA YYYY-MM-DD
// ================================
function validarFechaISO(str) {
  return typeof str === "string" && /^\d{4}-\d{2}-\d{2}$/.test(str);
}


// ======================================================
// GET /api/dashboard-clientes/resumen
// ======================================================
exports.obtenerResumen = async (req, res) => {

  try {

    const { desde, hasta, buscar, soloCredito } = req.query;

    // PAGINACION
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 200;
    const offset = (page - 1) * limit;

    const where = [];
    const params = {};

    // =====================================
    // FILTRO FECHAS
    // =====================================

    if (validarFechaISO(desde) && validarFechaISO(hasta)) {

      params.desde = desde;
      params.hasta = hasta;

      where.push(`
        codigo_cliente IN (
          SELECT DISTINCT customer_code
          FROM facturas
          WHERE DATE(fecha_creacion) BETWEEN :desde AND :hasta
        )
      `);

    }

    // =====================================
    // BUSCAR CLIENTE
    // =====================================

    if (buscar && buscar.trim()) {

      params.buscar = `%${buscar.trim().toUpperCase()}%`;

      where.push(`
        (
          UPPER(codigo_cliente) LIKE :buscar OR
          UPPER(nombre_cliente) LIKE :buscar OR
          UPPER(identificacion_cliente) LIKE :buscar OR
          UPPER(nombre_comercial_cliente) LIKE :buscar OR
          UPPER(direccion) LIKE :buscar
        )
      `);

    }

    // =====================================
    // SOLO CLIENTES CON CREDITO
    // =====================================

    if (soloCredito === "1") {
      where.push(`tiene_credito_cliente = true`);
    }

    const whereSQL = where.length ? `WHERE ${where.join(" AND ")}` : "";


    // =====================================
    // TOTAL REGISTROS (para paginación real)
    // =====================================
    const countSQL = `
  SELECT COUNT(*)::int AS total
  FROM vw_clientes_analisis
  ${whereSQL}
`;

    const [[countRow]] = await sequelize.query(countSQL, {
      replacements: params
    });

    const totalClientesDB = Number(countRow.total || 0);
    const totalPages = Math.ceil(totalClientesDB / limit);

    // =====================================
    // CONSULTA PRINCIPAL
    // =====================================

    const sql = `
      SELECT
        codigo_cliente,
        nombre_cliente,
        identificacion_cliente,
        nombre_comercial_cliente,
        direccion,
        seller_code,

        total_unidades,
        total_ventas,
        total_facturas,

        tipo_negocio,
        tipo_pago,
        tiene_credito_cliente,

        primera_compra,
        ultima_compra,

        dias_sin_comprar,
        estado_cliente

      FROM vw_clientes_analisis
      ${whereSQL}

      ORDER BY total_ventas DESC NULLS LAST
       LIMIT :limit
      OFFSET :offset
    `;

    const [rows] = await sequelize.query(sql, {
      replacements: {
        ...params,
        limit,
        offset
      }
    });

    // =====================================
    // KPIs
    // =====================================

    const totalClientes = totalClientesDB;
    const totalVentas = rows.reduce(
      (a, r) => a + Number(r.total_ventas || 0),
      0
    );

    const totalFacturas = rows.reduce(
      (a, r) => a + Number(r.total_facturas || 0),
      0
    );

    const clientesCredito = rows.filter(
      r => r.tiene_credito_cliente
    ).length;

    const ticketPromedio =
      totalFacturas > 0
        ? totalVentas / totalFacturas
        : 0;

    const clientesInactivos = rows.filter(
      r => r.estado_cliente === "INACTIVO"
    ).length;


    // =====================================
    // AGREGAR RANKING
    // =====================================

    const data = rows.map((r, idx) => ({
      ...r,
      ranking: offset + idx + 1
    }));

    // =====================================
    // RESPUESTA
    // =====================================

    return res.json({

      ok: true,
      pagination: {
        page,
        limit,
        total: totalClientesDB,
        totalPages
      },

      kpis: {
        totalClientes,
        totalVentas,
        totalFacturas,
        clientesCredito,
        ticketPromedio,
        clientesInactivos
      },

      data

    });

  } catch (error) {

    console.error("❌ obtenerResumen:", error);

    return res.status(500).json({
      ok: false,
      message: "Error obteniendo resumen"
    });

  }

};


// ======================================================
// GET PRODUCTOS POR CLIENTE
// ======================================================
exports.obtenerProductosCliente = async (req, res) => {

  try {

    const { codigo_cliente } = req.params;
    const { desde, hasta } = req.query;

    const params = { codigo_cliente };
    let filtroFechas = "";

    if (validarFechaISO(desde) && validarFechaISO(hasta)) {

      params.desde = desde;
      params.hasta = hasta;

      filtroFechas = `
        AND DATE(f.fecha_creacion)
        BETWEEN :desde AND :hasta
      `;
    }

    const sql = `

      SELECT
        COALESCE(p.nombre_producto,'-') AS nombre_producto,
        COALESCE(SUM(dd.cantidad),0)    AS cantidad_total,
        COALESCE(SUM(dd.total),0)       AS total_producto

      FROM facturas f

      LEFT JOIN detalle_documento dd
        ON f.code = dd.documento_code

      LEFT JOIN productos p
        ON dd.codigo_producto = p.codigo_producto

      WHERE f.customer_code = :codigo_cliente
      ${filtroFechas}

      GROUP BY p.nombre_producto

      ORDER BY total_producto DESC NULLS LAST
      LIMIT 10000

    `;

    const [rows] = await sequelize.query(sql, {
      replacements: params
    });

    return res.json({
      ok: true,
      codigo_cliente,
      productos: rows
    });

  } catch (error) {

    console.error("❌ obtenerProductosCliente:", error);

    return res.status(500).json({
      ok: false,
      message: "Error obteniendo productos del cliente"
    });

  }

};