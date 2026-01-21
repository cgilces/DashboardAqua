const { sequelize } = require("../../models");
const { QueryTypes } = require("sequelize");

/**
 * =====================================================
 * 📦 CLIENTES BOTELLÓN POR RUTA (SIN REPETIR)
 * =====================================================
 * - Filtra por ruta (ej: A2)
 * - Solo categoría BOTELLÓN (codigo_categoria = '5')
 * - Agrupa por cliente
 * - Suma unidades y monto
 */
const obtenerDetalleRuta = async (req, res) => {
  try {
    const { ruta } = req.params;

    if (!ruta) {
      return res.status(400).json({
        ok: false,
        message: "Debe enviar la ruta (ej: A2)",
      });
    }

    const clientesRutaBotellonSQL = `
      SELECT
          c.codigo_cliente,
          c.nombre_cliente,
          c.direccion_entrega,
          c.telefono,
          f.route_code AS ruta,

          d.codigo_categoria,
          d.descripcion_categoria,

          SUM(d.cantidad) AS unidades_botellon,
          SUM(d.total)    AS monto_usd
      FROM facturas f
      JOIN detalle_documento d
          ON d.documento_code = f.code
      JOIN clientes_ventas c
          ON c.codigo_cliente = f.customer_code
      WHERE f.route_code ILIKE :ruta
        AND d.codigo_categoria = '5' -- BOTELLÓN
      GROUP BY
          c.codigo_cliente,
          c.nombre_cliente,
          c.direccion_entrega,
          c.telefono,
          f.route_code,
          d.codigo_categoria,
          d.descripcion_categoria
      ORDER BY monto_usd DESC;
    `;

    const data = await sequelize.query(clientesRutaBotellonSQL, {
      replacements: { ruta },
      type: QueryTypes.SELECT,
    });

    return res.status(200).json({
      ok: true,
      ruta,
      total_clientes: data.length,
      data,
    });

  } catch (error) {
    console.error("❌ Error obtenerDetalleRuta:", error);
    return res.status(500).json({
      ok: false,
      message: "Error al obtener clientes botellón por ruta",
      error: error.message,
    });
  }
};

module.exports = {
  obtenerDetalleRuta,
};
