const Sequelize = require("sequelize");
const { sequelize } = require("../../models");

/**
 * =====================================================
 * MAPA DE GRUPOS → PREFIJO RUTA
 * =====================================================
 */
const GRUPOS_RUTA = {
  DOMICILIO: "A",
  EMPRESAS: "E",
  MAYORISTA: "M",
  RURAL: "R",
  TIENDAS: "T",
  VIP: "V",
};

/**
 * =====================================================
 * GET CLIENTES BOTELLONES
 * =====================================================
 * /api/botellones/clientes?grupo=RURAL
 * /api/botellones/clientes?ruta=R1
 * /api/botellones/clientes?grupo=RURAL&ruta=R1
 */
async function obtenerClientesBotellon(req, res) {
  try {
    const { grupo, ruta } = req.query;

    let whereSQL = "";
    let replacements = {};

    // ==========================
    // PRIORIDAD: RUTA
    // ==========================
    if (ruta) {
      whereSQL = `c.ruta_asignada ILIKE :ruta`;
      replacements.ruta = ruta;
    }
    // ==========================
    // SI NO HAY RUTA → USAR GRUPO
    // ==========================
    else if (grupo) {
      const prefijo = GRUPOS_RUTA[grupo];

      if (!prefijo) {
        return res.status(400).json({
          error: "Grupo no válido",
        });
      }

      whereSQL = `c.ruta_asignada ILIKE :prefijo`;
      replacements.prefijo = `${prefijo}%`;
    }
    // ==========================
    // NINGÚN FILTRO
    // ==========================
    else {
      return res.status(400).json({
        error: "Debe enviar al menos ?ruta o ?grupo",
      });
    }

    // ==========================
    // QUERY FINAL (INCLUYE TOTAL BOTELLONES EN ENTERO)
    // ==========================
    const sql = `
      SELECT
        c.codigo_cliente,
        c.nombre_cliente,
        c.direccion_entrega,
        c.telefono,
        c.email,
        c.ruta_asignada,
        FLOOR(SUM(dd.cantidad)) AS total_botellones  -- Redondeo a entero
      FROM clientes_ventas c
      JOIN ordenes o ON o.customer_code = c.codigo_cliente
      JOIN detalle_documento dd ON dd.documento_code = o.code
      WHERE ${whereSQL}
      GROUP BY
        c.codigo_cliente,
        c.nombre_cliente,
        c.direccion_entrega,
        c.telefono,
        c.email,
        c.ruta_asignada
      ORDER BY
        c.ruta_asignada,
        c.nombre_cliente
    `;

    const clientes = await sequelize.query(sql, {
      replacements,
      type: Sequelize.QueryTypes.SELECT,
    });

    console.log("🔎 CLIENTES BOTELLONES", clientes.length);

    return res.status(200).json({
      grupo: grupo || null,
      ruta: ruta || null,
      total: clientes.length,
      clientes,
    });

  } catch (error) {
    console.error("❌ ERROR CLIENTES BOTELLONES:", error);
    return res.status(500).json({
      message: "Error al obtener clientes de botellones",
    });
  }
}

module.exports = {
  obtenerClientesBotellon,
};
