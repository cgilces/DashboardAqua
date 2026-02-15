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


module.exports = {
  obtenerDashboardVisitas,
  obtenerClientesNoVisitados,
};
