// controllers/detallePreventaController.js
const { Orden, RutaPreventa } = require("../models");
const db = require("../db");
const Sequelize = require("sequelize");
const Op = Sequelize.Op;

// ========================================================
// 🚀 CONTROLADOR PRINCIPAL
// ========================================================
const obtenerDetalleRuta = async (req, res) => {
  try {
    const { ruta, anio, mes } = req.params;

    if (!ruta || !anio || !mes) {
      return res.status(400).json({ error: "Debe enviar /ruta/anio/mes" });
    }

    const anioNum = parseInt(anio);
    const mesNum = parseInt(mes);

    const fechaInicioStr = `${anioNum}-${String(mesNum).padStart(2, "0")}-01 00:00:00`;
    const fechaFinStr = `${anioNum}-${String(mesNum + 1).padStart(2, "0")}-01 00:00:00`;

    // ============================================================
    // 1) CATÁLOGO
    // ============================================================
    const rutaInfo = await RutaPreventa.findOne({
      where: { codigo_ruta: ruta.trim().toUpperCase() },
    });

    let catalogo = [];
    if (rutaInfo?.productos_catalogo) {
      catalogo = JSON.parse(rutaInfo.productos_catalogo);
    }

    // ============================================================
    // 2) PRODUCTOS VENDIDOS
    // ============================================================
    const productosVendidosSQL = `
      SELECT
          dd.descripcion AS producto,
          SUM(dd.cantidad) AS unidades_vendidas,
          SUM(dd.total) AS monto_usd
      FROM ordenes o
      JOIN detalle_documento dd
          ON dd.documento_code = o.code
      WHERE 
          o.type = 2
          AND o.status = 5
          AND o.seller_code = :ruta
          AND o.fecha_entrega >= :inicio
          AND o.fecha_entrega <  :fin
      GROUP BY dd.descripcion
      ORDER BY unidades_vendidas DESC;
    `;

    const productosVendidos = await db.query(productosVendidosSQL, {
      replacements: { ruta: ruta.toUpperCase(), inicio: fechaInicioStr, fin: fechaFinStr },
      type: db.QueryTypes.SELECT,
    });

    // ============================================================
    // 3) CLIENTES ASIGNADOS A LA RUTA
    // ============================================================
    const clientesRutaSQL = `
      SELECT codigo_cliente, nombre_cliente, direccion_entrega
      FROM clientes_ventas
      WHERE ruta_asignada ILIKE :ruta;
    `;

    const clientesRuta = await db.query(clientesRutaSQL, {
      replacements: { ruta: ruta.toUpperCase() },
      type: db.QueryTypes.SELECT,
    });

    // ============================================================
    // 4) CLIENTES CON CONSUMO EN EL MES
    // ============================================================
    const clientesConConsumoSQL = `
      SELECT DISTINCT customer_code
      FROM ordenes
      WHERE 
          seller_code = :ruta
          AND type = 2
          AND status = 5
          AND fecha_entrega >= :inicio
          AND fecha_entrega < :fin;
    `;

    const clientesConConsumoRows = await db.query(clientesConConsumoSQL, {
      replacements: { ruta: ruta.toUpperCase(), inicio: fechaInicioStr, fin: fechaFinStr },
      type: db.QueryTypes.SELECT,
    });

    const clientesConConsumo = new Set(clientesConConsumoRows.map(c => c.customer_code));

    const listaClientesSinConsumo = clientesRuta.filter(
      cli => !clientesConConsumo.has(cli.codigo_cliente)
    );

    // ============================================================
    // 5) CONSULTAR ÚLTIMA VISITA GLOBAL
    // ============================================================
    const ultimaVisitaSQL = `
                    SELECT
                        customer_code,
                        MAX(fecha_entrega) AS ultima_visita
                    FROM (
                        SELECT customer_code, fecha_entrega FROM ordenes
                        UNION ALL
                        SELECT customer_code, fecha_entrega FROM facturas
                    ) x
                    GROUP BY customer_code;
                  `;



    const ultimasVisitas = await db.query(ultimaVisitaSQL, {
      type: db.QueryTypes.SELECT,
    });

    const mapUltimaVisita = new Map(
      ultimasVisitas.map(v => [v.customer_code, v.ultima_visita])
    );

    // ============================================================
    // 6) CONSULTAR ÚLTIMA FACTURA GLOBAL
    // ============================================================
    const ultimaFacturaSQL = `
      SELECT 
          customer_code,
          MAX(
              COALESCE(
                  fecha_autorizacion,
                  fecha_entrega,
                  fecha_creacion
              )
          ) AS ultima_factura
      FROM facturas
      GROUP BY customer_code;
    `;

    const ultimasFacturas = await db.query(ultimaFacturaSQL, {
      type: db.QueryTypes.SELECT,
    });

    const mapUltimaFactura = new Map(
      ultimasFacturas.map(v => [v.customer_code, v.ultima_factura])
    );

    // ============================================================
    // 7) FORMATEAR FECHAS
    // ============================================================
    function formatFecha(fecha) {
      if (!fecha) return null;
      const d = new Date(fecha);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    }

    listaClientesSinConsumo.forEach(cli => {
      cli.ultima_visita = formatFecha(mapUltimaVisita.get(cli.codigo_cliente));
      cli.ultima_factura = formatFecha(mapUltimaFactura.get(cli.codigo_cliente));
    });

    // ============================================================
    // 8) RESPUESTA FINAL
    // ============================================================
    const totalClientesRuta = clientesRuta.length;
    const totalSin = listaClientesSinConsumo.length;

    return res.json({
      ruta: ruta.toUpperCase(),
      anio: anioNum,
      mes: mesNum,

      resumenClientes: {
        totalClientesRuta,
        clientesConConsumo: totalClientesRuta - totalSin,
        clientesSinConsumo: totalSin,
      },

      listaClientesSinConsumo,
      productosVendidos
    });

  } catch (error) {
    console.error("❌ ERROR EN DETALLE RUTA:", error);
    return res.status(500).json({ error: "Error al obtener detalle de ruta" });
  }
};

module.exports = {
  obtenerDetalleRuta,
};
