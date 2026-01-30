const sequelize = require("../../db");
const { QueryTypes } = require("sequelize");

const obtenerDashboardVisitas = async (req, res) => {
  try {
    console.log("🟢 [dashboardVisitas] Request recibido");
    console.log("➡️ Query params:", req.query);

    const { tipo, fecha, inicio, fin } = req.query;

    let fechaInicio;
    let fechaFin;
    let filtroDia = null;

    // ===============================
    // 📅 DEFINICIÓN DE RANGO
    // ===============================
    if (tipo === "mes") {
      fechaInicio = `${fecha}-01`;
      fechaFin = new Date(fechaInicio);
      fechaFin.setMonth(fechaFin.getMonth() + 1);
    } 
    else if (tipo === "semana") {
      fechaInicio = inicio;
      fechaFin = fin;
    } 
    else if (tipo === "dia") {
      fechaInicio = fecha;
      fechaFin = new Date(fecha);
      fechaFin.setDate(fechaFin.getDate() + 1);

      // 1=domingo ... 7=sábado
      filtroDia = new Date(fecha).getDay() + 1;
    } 
    else {
      return res.status(400).json({ error: "Tipo inválido" });
    }

    console.log("📅 Rango:", fechaInicio, fechaFin);
    console.log("📆 Día planificación:", filtroDia);

    // ===============================
    // 📊 QUERY DASHBOARD REAL
    // ===============================
    const query = `
      SELECT
        r.codigo_ruta AS ruta,

        COUNT(DISTINCT rd.codigo_cliente) AS planeadas,

        COUNT(DISTINCT v.codigo_cliente) AS visitas,

        COUNT(DISTINCT CASE 
          WHEN v.hubo_venta THEN v.codigo_cliente 
        END) AS vendido,

        COUNT(DISTINCT CASE 
          WHEN v.es_fuera_ruta THEN v.codigo_cliente 
        END) AS fuera_ruta,

        ROUND(
          COUNT(DISTINCT v.codigo_cliente)::numeric /
          NULLIF(COUNT(DISTINCT rd.codigo_cliente), 0) * 100,
          2
        ) AS porc_planeado,

        ROUND(
          COUNT(DISTINCT CASE 
            WHEN v.hubo_venta THEN v.codigo_cliente 
          END)::numeric /
          NULLIF(COUNT(DISTINCT rd.codigo_cliente), 0) * 100,
          2
        ) AS porc_vendido,

        ROUND(
          COUNT(DISTINCT CASE 
            WHEN v.es_fuera_ruta THEN v.codigo_cliente 
          END)::numeric /
          NULLIF(COUNT(DISTINCT rd.codigo_cliente), 0) * 100,
          2
        ) AS porc_fuera_ruta

      FROM rutas_preventas r

      LEFT JOIN route_details rd
        ON rd.codigo_ruta = r.codigo_ruta
        ${filtroDia ? "AND rd.dia = :dia" : ""}

      LEFT JOIN visitas_preventas v
        ON v.ruta_code = r.codigo_ruta
       AND v.fecha_visita >= :fechaInicio
       AND v.fecha_visita <  :fechaFin

      GROUP BY r.codigo_ruta
      ORDER BY porc_planeado DESC;
    `;

    console.time("⏱️ Dashboard visitas");
    const data = await sequelize.query(query, {
      replacements: {
        fechaInicio,
        fechaFin,
        dia: filtroDia,
      },
      type: QueryTypes.SELECT,
    });
    console.timeEnd("⏱️ Dashboard visitas");

    return res.json({
      filtro: tipo,
      desde: fechaInicio,
      hasta: fechaFin,
      total_rutas: data.length,
      data,
    });

  } catch (error) {
    console.error("❌ Error dashboard visitas:", error);
    res.status(500).json({
      error: "Error obteniendo dashboard de visitas",
    });
  }
};


const obtenerClientesNoVisitados = async (req, res) => {
  try {
    const { ruta, tipo, fecha, inicio, fin } = req.query;

    if (!ruta || !tipo) {
      return res.status(400).json({
        error: "Parámetros requeridos: ruta y tipo",
      });
    }

    let fechaInicio;
    let fechaFin;

    // ===============================
    // 📅 DEFINICIÓN DE RANGO DE FECHAS
    // ===============================
    if (tipo === "mes") {
      // fecha = 2025-01
      fechaInicio = `${fecha}-01`;
      const f = new Date(fechaInicio);
      f.setMonth(f.getMonth() + 1);
      fechaFin = f.toISOString().slice(0, 10);
    } 
    else if (tipo === "semana") {
      // inicio=YYYY-MM-DD & fin=YYYY-MM-DD
      fechaInicio = inicio;
      fechaFin = fin;
    } 
    else if (tipo === "dia") {
      fechaInicio = fecha;
      const f = new Date(fecha);
      f.setDate(f.getDate() + 1);
      fechaFin = f.toISOString().slice(0, 10);
    } 
    else {
      return res.status(400).json({
        error: "Tipo de filtro inválido",
      });
    }

    // ===============================
    // 🔍 QUERY CLIENTES NO VISITADOS
    // ===============================
    const query = `
      SELECT DISTINCT ON (cv.codigo_cliente)
        cv.codigo_cliente,
        cv.nombre_cliente,
        cv.direccion_entrega,
        cv.telefono,

        -- 🕒 última visita HISTÓRICA
        uv.fecha_visita AS ultima_visita,
        uv.ruta_code    AS ultima_ruta,

        -- 📦 último producto HISTÓRICO
        up.descripcion  AS ultimo_producto

      FROM clientes_usuarios_ventas cuv
      JOIN clientes_ventas cv
        ON cv.codigo_cliente = cuv.codigo_cliente

      -- ==========================
      -- ÚLTIMA VISITA HISTÓRICA
      -- ==========================
      LEFT JOIN LATERAL (
        SELECT
          v.fecha_visita,
          v.ruta_code,
          v.documento_code
        FROM visitas_preventas v
        WHERE v.codigo_cliente = cv.codigo_cliente
        ORDER BY v.fecha_visita DESC
        LIMIT 1
      ) uv ON true

      -- ==========================
      -- ÚLTIMO PRODUCTO HISTÓRICO
      -- ==========================
      LEFT JOIN LATERAL (
        SELECT
          dd.descripcion
        FROM detalle_documento dd
        WHERE dd.documento_code = uv.documento_code
        LIMIT 1
      ) up ON true

      -- ==========================
      -- NO VISITADOS EN EL PERÍODO
      -- ==========================
      WHERE cuv.ruta_code = :ruta
      AND NOT EXISTS (
        SELECT 1
        FROM visitas_preventas v
        WHERE v.codigo_cliente = cv.codigo_cliente
          AND v.ruta_code = :ruta
          AND v.fecha_visita >= :fechaInicio
          AND v.fecha_visita <  :fechaFin
      )

      ORDER BY cv.codigo_cliente, uv.fecha_visita DESC;
    `;

    const rows = await sequelize.query(query, {
      replacements: {
        ruta,
        fechaInicio,
        fechaFin,
      },
      type: QueryTypes.SELECT,
    });

    return res.json({
      ruta,
      filtro: tipo,
      desde: fechaInicio,
      hasta: fechaFin,
      total_no_visitados: rows.length,
      data: rows,
    });
  } catch (error) {
    console.error("❌ Error clientes no visitados:", error);
    return res.status(500).json({
      error: "Error obteniendo clientes no visitados",
    });
  }
};

module.exports = {
  obtenerDashboardVisitas,
  obtenerClientesNoVisitados
};