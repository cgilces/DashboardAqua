const express = require('express');
const { Op } = require('sequelize');
const sequelize = require("../../db");
const { Ruta, Clientes, Orden, HistorialVisitas } = require('../../models'); // Asegúrate de tener los modelos bien definidos
const app = express();


const obtenerDashboardVisitas = async (req, res) => {
  const { fechaInicio, fechaFin, tipoFiltro } = req.query;
  console.log("🔍 Parámetros recibidos:", { fechaInicio, fechaFin, tipoFiltro });
  try {
    let whereClause = {};

    // Filtro por mes
    if (tipoFiltro === 'mes') {
      whereClause.fecha_visita = {
        [Op.gte]: `${fechaInicio} 00:00:00`, // Usamos solo fechaInicio sin concatenar '-01'
        [Op.lte]: `${fechaFin} 23:59:59`     // Usamos solo fechaFin sin concatenar '-31'
      };
    }



    // Filtro por semana
    // else if (tipoFiltro === 'semana') {
    //   whereClause.semana = { [Op.between]: fechaInicio, fechaFin };
    // }

    else if (tipoFiltro === 'semana') {
      // Asumimos que `fechaInicio` y `fechaFin` son fechas con el rango de la semana
      whereClause.fecha_visita = {
        [Op.gte]: fechaInicio,
        [Op.lte]: fechaFin
      };
    }

    // Filtro por día específico
    else if (tipoFiltro === 'dia') {
      whereClause.fecha_visita = { [Op.gte]: `${fechaInicio} 00:00:00`, [Op.lte]: `${fechaInicio} 23:59:59` };
    }

    console.log("🔍 Filtro de consulta:", whereClause);

    // Obtener todas las rutas
    const rutas = await Ruta.findAll();

    // Crear un array para almacenar los resultados de todas las rutas
    let resultado = [];

    // Iterar sobre las rutas para obtener las visitas correspondientes
    for (let ruta of rutas) {
      // Filtro para obtener las visitas de cada ruta
      const visitas = await HistorialVisitas.findAll({
        where: {
          ...whereClause,
          codigo_ruta: ruta.codigo, // Filtrar por código de ruta
        },
        include: [
          {
            model: Clientes,
            attributes: ['codigo_cliente'],
            as: 'cliente',
          },
          {
            model: Orden,
            attributes: ['total', 'subtotal', 'iva'],
            where: { status: 10 },  // Solo las órdenes confirmadas
            required: false,  // No es obligatorio que haya una orden
            as: 'orden',
          },
        ],
      });

      // Calcular las visitas planeadas, fuera de ruta, y vendidas
      const totalVisitado = visitas.length;
      const totalPlaneado = totalVisitado; // O ajustar según cómo se calculan las visitas planeadas
      const vendido = visitas.filter(visita => visita.orden).length;
      const fueraDeRuta = visitas.filter(visita => visita.ruptura_secuencia === 1).length; // Asumimos que `ruptura_secuencia` indica fuera de ruta

      // Calcular los porcentajes
      const porcentajePlaneado = (totalVisitado / totalPlaneado) * 100;
      const porcentajeFueraRuta = (fueraDeRuta / totalPlaneado) * 100;
      const porcentajeVendido = (vendido / totalPlaneado) * 100;

      // Asignar color según el porcentaje planeado
      let color = 'verde';
      if (porcentajePlaneado < 70) {
        color = 'rojo';
      }

      // Crear el objeto de resultados para esta ruta
      resultado.push({
        ruta: ruta.codigo, // Usamos el código de la ruta
        totalPlaneado,
        totalVisitado,
        fueraDeRuta,
        vendido,
        porcentajePlaneado,
        porcentajeFueraRuta,
        porcentajeVendido,
        color,
      });
    }

    // Ordenar los resultados por el porcentaje planeado de mayor a menor
    resultado.sort((a, b) => b.porcentajePlaneado - a.porcentajePlaneado);

    // Enviar la respuesta con los resultados
    res.status(200).json(resultado);
  } catch (error) {
    console.error('Error al obtener visitas:', error);
    res.status(500).send('Error al obtener visitas');
  }
};



const obtenerClientesNoVisitados = async (req, res) => {
  try {
    const { ruta, tipo, fecha, inicio, fin } = req.query;
    console.log("🔍 Parámetros recibidos para clientes no visitados:", { ruta, tipo, fecha, inicio, fin });

    // Validar que los parámetros requeridos estén presentes
    if (!ruta || !tipo) {
      console.log("❌ Parámetros requeridos no presentes: ruta y tipo");
      return res.status(400).json({
        error: "Parámetros requeridos: ruta y tipo",
      });
    }

    let fechaInicio;
    let fechaFin;

    // ===============================
    // 📅 DEFINICIÓN DE RANGO DE FECHAS
    // ===============================
    console.log(`📅 Definiendo el rango de fechas para el tipo: ${tipo}`);
    if (tipo === "mes") {
      fechaInicio = `${fecha}-01`; // Primer día del mes
      const f = new Date(fechaInicio);
      f.setMonth(f.getMonth() + 1); // Sumar un mes
      fechaFin = new Date(f.setDate(0)).toISOString().slice(0, 10); // Último día del mes
      console.log(`🔍 Fecha de inicio (mes): ${fechaInicio}, Fecha de fin (mes): ${fechaFin}`);
    } else if (tipo === "semana") {
      fechaInicio = inicio;
      fechaFin = fin;
      console.log(`🔍 Fecha de inicio (semana): ${fechaInicio}, Fecha de fin (semana): ${fechaFin}`);
    } else if (tipo === "dia") {
      fechaInicio = fecha;
      fechaFin = fecha; // Mismo día
      console.log(`🔍 Fecha de inicio (día): ${fechaInicio}, Fecha de fin (día): ${fechaFin}`);
    } else {
      console.log("❌ Tipo de filtro inválido");
      return res.status(400).json({
        error: "Tipo de filtro inválido",
      });
    }

    // ===============================
    // 🔍 QUERY CLIENTES NO VISITADOS (Con Paginación)
    // ===============================
    let page = 1;
    let totalPages = 1;
    const clientesNoVisitados = [];

    console.log("🔍 Iniciando búsqueda de clientes no visitados...");
    // Ciclo para paginación en bloques de 1000 clientes
    while (page <= totalPages) {
      console.log(`🔍 Ejecutando query para la página ${page}`);

      const query = `
        SELECT DISTINCT ON (cv.codigo_cliente)
          cv.codigo_cliente,
          cv.nombre_cliente,
          cv.direccion_entrega,
          cv.telefono,
          uv.fecha_visita AS ultima_visita,
          uv.ruta_code AS ultima_ruta,
          up.descripcion AS ultimo_producto
        FROM clientes_usuarios_ventas cuv
        JOIN clientes cv ON cv.codigo_cliente = cuv.codigo_cliente
        LEFT JOIN LATERAL (
          SELECT v.fecha_visita, v.ruta_code, v.documento_code
          FROM visitas_preventas v
          WHERE v.codigo_cliente = cv.codigo_cliente
          ORDER BY v.fecha_visita DESC
          LIMIT 1
        ) uv ON true
        LEFT JOIN LATERAL (
          SELECT dd.descripcion
          FROM detalle_documento dd
          WHERE dd.documento_code = uv.documento_code
          LIMIT 1
        ) up ON true
        WHERE cuv.ruta_code = :ruta
        AND NOT EXISTS (
          SELECT 1
          FROM visitas_preventas v
          WHERE v.codigo_cliente = cv.codigo_cliente
            AND v.ruta_code = :ruta
            AND v.fecha_visita >= :fechaInicio
            AND v.fecha_visita < :fechaFin
        )
        ORDER BY cv.codigo_cliente, uv.fecha_visita DESC
        LIMIT 1000 OFFSET ${(page - 1) * 1000};
      `;

      const rows = await sequelize.query(query, {
        replacements: { ruta, fechaInicio, fechaFin },
        type: QueryTypes.SELECT,
      });

      console.log(`🔍 Página ${page}: ${rows.length} registros encontrados.`);

      clientesNoVisitados.push(...rows);

      totalPages = Math.ceil(clientesNoVisitados.length / 1000); // Ajuste para paginación
      page++;

      console.log(`🔍 Total de páginas: ${totalPages}`);
    }

    // Respuesta con los clientes no visitados
    console.log("🔍 Respuesta: clientes no visitados obtenidos correctamente.");
    return res.json({
      ruta,
      filtro: tipo,
      desde: fechaInicio,
      hasta: fechaFin,
      total_no_visitados: clientesNoVisitados.length,
      data: clientesNoVisitados,
    });
  } catch (error) {
    console.error("❌ Error clientes no visitados:", error);
    return res.status(500).json({
      error: "Error obteniendo clientes no visitados",
    });
  }
};


/* ======================================================
   DASHBOARD POR USUARIO
   GET /api/visitas/dashboard-usuarios?fechaInicio=&fechaFin=
====================================================== */
const obtenerDashboardPorUsuario = async (req, res) => {
  const { fechaInicio, fechaFin } = req.query;
  if (!fechaInicio || !fechaFin)
    return res.status(400).json({ error: 'fechaInicio y fechaFin requeridos' });

  try {
    const { QueryTypes } = require('sequelize');

    // Ecuador = UTC-5. Convertir rango local → UTC para historial_visitas
    // Ej: 2026-03-31 Ecuador = 2026-03-31 05:00:00 UTC  a  2026-04-01 04:59:59 UTC
    const [yr, mo, da] = fechaFin.split('-').map(Number);
    const nextDay = new Date(Date.UTC(yr, mo - 1, da + 1));
    const nextDayStr = nextDay.toISOString().slice(0, 10);

    const utcInicio = `${fechaInicio} 05:00:00`;
    const utcFin    = `${nextDayStr} 04:59:59`;

    const rows = await sequelize.query(`
      WITH

      /* ═══════════════════════════════════════════════════════════
         1. HISTORIAL agrupado por RUTA (no por usuario)
            — Los timestamps se convierten a hora Ecuador (UTC-5)
            — day_start  = parada planeada en ruta
            — visit_start = cliente efectivamente visitado
      ═══════════════════════════════════════════════════════════ */
      hv_base AS (
        SELECT
          hv.codigo_ruta,
          MAX(hv.codigo_usuario)                                            AS codigo_usuario,
          MAX(hv.nombre_usuario)                                            AS nombre_usuario,
          MAX(hv.sucursal_usuario)                                          AS sucursal_usuario,
          COALESCE(MAX(hv.codigo_rol_usuario), 'POR DEFECTO')               AS grupo_usuario,
          /* hora local Ecuador = UTC - 5h */
          MIN(hv.fecha_visita - INTERVAL '5 hours')                         AS dia_inicio,
          CASE WHEN MAX(hv.fecha_visita) <> MIN(hv.fecha_visita)
               THEN MAX(hv.fecha_visita - INTERVAL '5 hours')
               ELSE NULL END                                                AS dia_fin,
          COUNT(CASE WHEN hv.accion = 'day_start'   THEN 1 END)            AS total_ruta,
          COUNT(DISTINCT CASE WHEN hv.accion = 'visit_start'
                              THEN hv.codigo_cliente END)                  AS visitas
        FROM historial_visitas hv
        WHERE hv.fecha_visita >= :utcInicio
          AND hv.fecha_visita <= :utcFin
        GROUP BY hv.codigo_ruta
      ),

      /* ═══════════════════════════════════════════════════════════
         2. FACTURAS agrupadas por ROUTE_CODE
            facturas_monto = subtotal (sin IVA)
            pagos_monto    = total (con IVA) de las cobradas (NULL o paid/partial/in_payment)
            devoluciones   = reversed
      ═══════════════════════════════════════════════════════════ */
      fact_base AS (
        SELECT
          f.route_code,
          SUM(CASE WHEN f.estado_pago <> 'reversed' OR f.estado_pago IS NULL
                   THEN COALESCE(f.subtotal, 0) ELSE 0 END)                AS facturas_monto,
          COUNT(CASE WHEN f.estado_pago <> 'reversed' OR f.estado_pago IS NULL
                     THEN 1 END)                                           AS facturas_count,
          SUM(CASE WHEN f.estado_pago IS NULL
                    OR f.estado_pago NOT IN ('not_paid', 'reversed')
                   THEN COALESCE(f.total, 0) ELSE 0 END)                   AS pagos_monto,
          COUNT(CASE WHEN f.estado_pago IS NULL
                      OR f.estado_pago NOT IN ('not_paid', 'reversed')
                     THEN 1 END)                                           AS pagos_count,
          SUM(CASE WHEN f.estado_pago = 'reversed'
                   THEN COALESCE(f.total, 0) ELSE 0 END)                   AS devoluciones_monto,
          COUNT(CASE WHEN f.estado_pago = 'reversed' THEN 1 END)           AS devoluciones_count
        FROM facturas f
        WHERE COALESCE(f.fecha_entrega, f.fecha_creacion) >= :inicio
          AND COALESCE(f.fecha_entrega, f.fecha_creacion) <= :fin
          AND f.status = 2
        GROUP BY f.route_code
      ),

      /* ═══════════════════════════════════════════════════════════
         3. ORDENES agrupadas por ROUTE_CODE (preventa / televentas)
      ═══════════════════════════════════════════════════════════ */
      ord_base AS (
        SELECT
          o.route_code,
          MAX(o.seller_nombre)           AS seller_nombre,
          SUM(COALESCE(o.total, 0))      AS ordenes_monto,
          COUNT(*)                       AS ordenes_count
        FROM ordenes o
        WHERE o.fecha_creacion >= :inicio
          AND o.fecha_creacion <= :fin
          AND o.status = 2
        GROUP BY o.route_code
      ),

      /* ═══════════════════════════════════════════════════════════
         4. UNIÓN de todas las rutas activas en el período
      ═══════════════════════════════════════════════════════════ */
      all_routes AS (
        SELECT codigo_ruta AS route_code FROM hv_base
        UNION
        SELECT route_code FROM fact_base WHERE route_code IS NOT NULL
        UNION
        SELECT route_code FROM ord_base  WHERE route_code IS NOT NULL
      )

      SELECT
        COALESCE(hv.codigo_usuario,  ar.route_code)                    AS codigo_usuario,
        COALESCE(hv.nombre_usuario,  ob.seller_nombre, ar.route_code)  AS nombre_usuario,
        ar.route_code                                                   AS codigo_ruta,
        hv.sucursal_usuario,
        COALESCE(hv.grupo_usuario, 'POR DEFECTO')                      AS grupo_usuario,
        hv.dia_inicio,
        hv.dia_fin,
        COALESCE(hv.total_ruta, 0)                                     AS total_ruta,
        COALESCE(hv.visitas,    0)                                     AS visitas,
        COALESCE(fb.facturas_monto,     0)                             AS facturas_monto,
        COALESCE(fb.facturas_count,     0)                             AS facturas_count,
        COALESCE(ob.ordenes_monto,      0)                             AS ordenes_monto,
        COALESCE(ob.ordenes_count,      0)                             AS ordenes_count,
        0                                                              AS transferencias_monto,
        0                                                              AS transferencias_count,
        COALESCE(fb.devoluciones_monto, 0)                             AS devoluciones_monto,
        COALESCE(fb.devoluciones_count, 0)                             AS devoluciones_count,
        COALESCE(fb.pagos_monto,        0)                             AS pagos_monto,
        COALESCE(fb.pagos_count,        0)                             AS pagos_count
      FROM all_routes ar
      LEFT JOIN hv_base   hv ON hv.codigo_ruta  = ar.route_code
      LEFT JOIN fact_base fb ON fb.route_code   = ar.route_code
      LEFT JOIN ord_base  ob ON ob.route_code   = ar.route_code
      ORDER BY COALESCE(hv.nombre_usuario, ob.seller_nombre, ar.route_code)
    `, {
      replacements: {
        utcInicio,
        utcFin,
        inicio: `${fechaInicio} 00:00:00`,
        fin:    `${fechaFin} 23:59:59`,
      },
      type: QueryTypes.SELECT,
    });

    return res.json(rows);
  } catch (error) {
    console.error('❌ Error dashboard por usuario:', error);
    return res.status(500).json({ error: 'Error al obtener dashboard por usuario', detail: error.message });
  }
};

module.exports = {
  obtenerDashboardVisitas,
  obtenerClientesNoVisitados,
  obtenerDashboardPorUsuario,
};
