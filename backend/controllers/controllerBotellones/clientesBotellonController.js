// const Sequelize = require("sequelize");
// const db = require("../../db");

// /**
//  * =====================================================
//  * 🧩 FUNCIÓN SEGURA PARA GENERAR FECHAS PG EN UTC
//  * =====================================================
//  */
// function obtenerRangoFechasPG(anio, mes) {
//   const inicio = new Date(Date.UTC(anio, mes - 1, 1));
//   const fin = new Date(Date.UTC(anio, mes, 1));

//   const fInicio = inicio.toISOString().replace("T", " ").substring(0, 19);
//   const fFin = fin.toISOString().replace("T", " ").substring(0, 19);

//   return { fInicio, fFin };
// }

// /**
//  * =====================================================
//  * 📅 FORMATEADOR SEGURO DE FECHA
//  * =====================================================
//  */
// function formatFecha(fecha) {
//   if (!fecha) return null;
//   const d = new Date(fecha);
//   if (isNaN(d.getTime())) return null;
//   return d.toISOString().split("T")[0];
// }

// /**
//  * =====================================================
//  * 🎯 CONTROLADOR PRINCIPAL
//  * =====================================================
//  */
// const obtenerClientesBotellon = async (req, res) => {
//   console.log(
//     "▶️ [detallePreventa] Inicio obtenerClientesBotellon, params:",
//     req.params
//   );

//   try {
//     const { ruta, anio, mes } = req.params;

//     if (!ruta || !anio || !mes) {
//       return res.status(400).json({
//         error: "Debe enviar /ruta/anio/mes",
//       });
//     }

//     const anioNum = parseInt(anio);
//     const mesNum = parseInt(mes);

//     if (isNaN(anioNum) || isNaN(mesNum) || mesNum < 1 || mesNum > 12) {
//       return res.status(400).json({
//         error: "Mes o año inválido",
//       });
//     }

//     // ================= FECHAS =================
//     const { fInicio, fFin } = obtenerRangoFechasPG(anioNum, mesNum);

//     const rutaUpper = ruta.trim().toUpperCase();

//     // =====================================================
//     // 1️⃣ CLIENTES ASIGNADOS A LA RUTA
//     // =====================================================
//     const clientesRuta = await db.query(
//       `
//       SELECT codigo_cliente, nombre_cliente, direccion_entrega, ruta_asignada
//       FROM clientes
//       WHERE ruta_asignada ILIKE :ruta;
//     `,
//       {
//         replacements: { ruta: rutaUpper },
//         type: db.QueryTypes.SELECT,
//       }
//     );

//     console.log(
//       `ℹ️ [detallePreventa] Clientes en ruta ${rutaUpper}:`,
//       clientesRuta
//     );

//     // =====================================================
//     // 2️⃣ CLIENTES CON CONSUMO EN EL MES
//     // =====================================================
//     const clientesConConsumoRows = await db.query(
//       `
//       SELECT DISTINCT customer_code
//       FROM ordenes
//       WHERE seller_code = :ruta
//         AND type = 2
//         AND status = 5
//         AND fecha_entrega >= :inicio
//         AND fecha_entrega < :fin;
//     `,
//       {
//         replacements: { ruta: rutaUpper, inicio: fInicio, fin: fFin },
//         type: db.QueryTypes.SELECT,
//       }
//     );

//     const clientesConConsumo = new Set(
//       clientesConConsumoRows.map((c) => c.customer_code)
//     );

//     // =====================================================
//     // 3️⃣ CONSUMO ACTUAL / ANTERIOR
//     // =====================================================
//     const clientesConsumoData = await db.query(
//       `
//       SELECT 
//         customer_code,
//         SUM(CASE WHEN fecha_entrega >= :inicio AND fecha_entrega < :fin THEN total ELSE 0 END) AS consumo_actual,
//         SUM(CASE WHEN fecha_entrega < :inicio THEN total ELSE 0 END) AS consumo_anterior
//       FROM ordenes
//       WHERE seller_code = :ruta
//         AND type = 2
//         AND status = 5
//       GROUP BY customer_code;
//     `,
//       {
//         replacements: { ruta: rutaUpper, inicio: fInicio, fin: fFin },
//         type: db.QueryTypes.SELECT,
//       }
//     );

//     // =====================================================
//     // 4️⃣ PRODUCTOS VENDIDOS POR CLIENTE
//     // =====================================================
//     const productosVendidosCantidad = await db.query(
//       `
//       SELECT
//         o.customer_code,
//         SUM(dd.cantidad) AS unidades_vendidas_cliente
//       FROM ordenes o
//       JOIN detalle_documento dd ON dd.documento_code = o.code
//       WHERE o.type = 2
//         AND o.status = 5
//         AND o.seller_code = :ruta
//         AND o.fecha_entrega >= :inicio
//         AND o.fecha_entrega < :fin
//       GROUP BY o.customer_code;
//     `,
//       {
//         replacements: { ruta: rutaUpper, inicio: fInicio, fin: fFin },
//         type: db.QueryTypes.SELECT,
//       }
//     );

//     const mapProductos = new Map();
//     productosVendidosCantidad.forEach((p) => {
//       mapProductos.set(
//         p.customer_code,
//         Number(p.unidades_vendidas_cliente) || 0
//       );
//     });

//     // =====================================================
//     // 5️⃣ ÚLTIMA VISITA
//     // =====================================================
//     const ultimasVisitas = await db.query(
//       `
//       SELECT customer_code, MAX(fecha_entrega) AS ultima_visita
//       FROM (
//         SELECT customer_code, fecha_entrega FROM ordenes
//         UNION ALL
//         SELECT customer_code, fecha_entrega FROM facturas
//       ) x
//       GROUP BY customer_code;
//     `,
//       { type: db.QueryTypes.SELECT }
//     );

//     const mapUltimaVisita = new Map(
//       ultimasVisitas.map((v) => [v.customer_code, v.ultima_visita])
//     );

//     // =====================================================
//     // 6️⃣ ÚLTIMA FACTURA
//     // =====================================================
//     const ultimasFacturas = await db.query(
//       `
//       SELECT 
//         customer_code,
//         MAX(COALESCE(fecha_autorizacion, fecha_entrega, fecha_creacion)) AS ultima_factura
//       FROM facturas
//       GROUP BY customer_code;
//     `,
//       { type: db.QueryTypes.SELECT }
//     );

//     const mapUltimaFactura = new Map(
//       ultimasFacturas.map((v) => [v.customer_code, v.ultima_factura])
//     );

//     // =====================================================
//     // 7️⃣ UNIFICAR CLIENTES
//     // =====================================================
//     const clientesRutaConDetalles = clientesRuta.map((cliente) => {
//       const consumo =
//         clientesConsumoData.find(
//           (c) => c.customer_code === cliente.codigo_cliente
//         ) || {};

//       const actual = Number(consumo.consumo_actual) || 0;
//       const anterior = Number(consumo.consumo_anterior) || 0;

//       const porcentaje =
//         anterior === 0
//           ? "100%"
//           : (((actual - anterior) / anterior) * 100).toFixed(2) + "%";

//       return {
//         codigo_cliente: cliente.codigo_cliente,
//         nombre_cliente: cliente.nombre_cliente,
//         direccion_entrega: cliente.direccion_entrega,
//         ultima_visita: formatFecha(
//           mapUltimaVisita.get(cliente.codigo_cliente)
//         ),
//         ultima_factura: formatFecha(
//           mapUltimaFactura.get(cliente.codigo_cliente)
//         ),
//         consumo_actual: actual.toFixed(2),
//         consumo_anterior: anterior.toFixed(2),
//         max_consumo: Math.max(actual, anterior).toFixed(2),
//         porcentaje_cambio: porcentaje,
//         tuvo_consumo: clientesConConsumo.has(cliente.codigo_cliente)
//           ? "Sí"
//           : "No",
//         cantidad_productos: mapProductos.get(cliente.codigo_cliente) || 0,
//       };
//     });

//     // =====================================================
//     // ✅ RESPUESTA FINAL
//     // =====================================================
//     return res.json({
//       ruta: rutaUpper,
//       anio: anioNum,
//       mes: mesNum,
//       rangoFechas: { inicio: fInicio, fin: fFin },
//       resumenClientes: {
//         totalClientesRuta: clientesRuta.length,
//         clientesConConsumo: clientesConConsumo.size,
//         clientesSinConsumo:
//           clientesRuta.length - clientesConConsumo.size,
//       },
//       clientesRuta: clientesRutaConDetalles,
//     });
//   } catch (error) {
//     console.error("❌ [detallePreventa] ERROR:", error);
//     return res.status(500).json({
//       error: "Error al obtener detalle de ruta",
//       detalle: error.message,
//     });
//   }
// };

// module.exports = {
//   obtenerClientesBotellon,
// };
