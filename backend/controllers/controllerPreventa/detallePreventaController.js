const { Orden, RutaPreventa } = require("../../models");
const db = require("../../db");
const Sequelize = require("sequelize");
const Op = Sequelize.Op;

// ========================================================
// 🧩 HELPER PARA FORMATEAR FECHAS A YYYY-MM-DD
// ========================================================
function formatFecha(fecha) {
  if (!fecha) return null;
  const d = new Date(fecha);
  if (isNaN(d.getTime())) return null;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
}

// ========================================================
// 🧩 FUNCIÓN SEGURA PARA GENERAR FECHAS PG EN UTC
// ========================================================
// Rango seguro UTC para PostgreSQL (MES ACTUAL)
function obtenerRangoFechasPG(anio, mes) {
  const inicio = new Date(Date.UTC(anio, mes - 1, 1));
  const fin = new Date(Date.UTC(anio, mes, 1));

  return {
    fechaInicioStr: inicio.toISOString().replace("T", " ").substring(0, 19),
    fechaFinStr: fin.toISOString().replace("T", " ").substring(0, 19),
  };
}



// 🔹 RANGO MES ANTERIOR REAL
function obtenerRangoMesAnterior(anioNum, mesNum) {
  // Si el mes es enero (mes 1), entonces el mes anterior es diciembre del año anterior
  if (mesNum === 1) {
    anioNum--; // Restamos un año
    mesNum = 12; // El mes anterior es diciembre
  } else {
    mesNum--; // De lo contrario, simplemente restamos un mes
  }

  // Calculamos las fechas de inicio y fin del mes anterior
  const inicio = new Date(Date.UTC(anioNum, mesNum - 1, 1));
  const fin = new Date(Date.UTC(anioNum, mesNum, 1));

  return {
    inicio: inicio.toISOString().replace("T", " ").substring(0, 19),
    fin: fin.toISOString().replace("T", " ").substring(0, 19),
  };
}

// ========================================================
// 🚀 CONTROLADOR PRINCIPAL
// ========================================================
const obtenerDetalleRuta = async (req, res) => {
  // console.log("▶️ [detallePreventa] Inicio obtenerDetalleRuta, params:", req.params);

  try {
    const { ruta, anio, mes } = req.params;
    if (!ruta || !anio || !mes) {
      // console.warn("⚠️ [detallePreventa] Faltan parámetros /ruta/anio/mes");
      return res.status(400).json({ error: "Debe enviar /ruta/anio/mes" });
    }

    const anioNum = parseInt(anio);
    const mesNum = parseInt(mes);

    if (isNaN(anioNum) || isNaN(mesNum) || mesNum < 1 || mesNum > 12) {
      // console.warn("⚠️ [detallePreventa] Año o mes inválido:", { anio, mes });
      return res.status(400).json({ error: "Mes o año inválido" });
    }

    // ============================================================
    // 🗓 USO DE FUNCIÓN SEGURA PARA FECHAS PG
    // ============================================================
    const { fechaInicioStr: fechaInicioStr, fechaFinStr: fechaFinStr } = obtenerRangoFechasPG(anioNum, mesNum);
    const { inicio: antInicio, fin: antFin } = obtenerRangoMesAnterior(anioNum, mesNum);

    // Agregar los console.log para verificar las fechas
    console.log("📅 Rango actual:");
    console.log(`Fecha de inicio: ${fechaInicioStr}`);
    console.log(`Fecha de fin: ${fechaFinStr}`);

    console.log("📅 Rango mes anterior:");
    console.log(`Fecha de inicio: ${antInicio}`);
    console.log(`Fecha de fin: ${antFin}`);



    // // console.log("🧮 [detallePreventa] Rango de fechas calculado (SEGURIDAD UTC):", {
    //   anioNum,
    //   mesNum,
    //   fechaInicioStr,
    //   fechaFinStr,
    // });

    const rutaUpper = ruta.trim().toUpperCase();

    // ============================================================
    // 1) CONSULTAR CLIENTES ASIGNADOS A LA RUTA
    // ============================================================
    // console.log("👥 [detallePreventa] Consultando clientes asignados a la ruta...");

    const sellerCode = rutaUpper; // PV1, H1, etc.

    const clientesRutaSQL = `
                SELECT DISTINCT
                  cuv.codigo_cliente,
                  cv.nombre_cliente,
                  cv.direccion_entrega
                FROM clientes_usuarios_ventas cuv
                JOIN clientes_ventas cv
                  ON cv.codigo_cliente = cuv.codigo_cliente
                WHERE cuv.seller_code = :sellerCode
                ORDER BY cv.nombre_cliente;
              `;

    const clientesRuta = await db.query(clientesRutaSQL, {
      replacements: { sellerCode },
      type: db.QueryTypes.SELECT,
    });

    //  console.log(
    //   "👥 [detallePreventa] Total clientes asignados:",
    //   clientesRuta.length
    // );


    // ============================================================
    // 2) CONSULTAR CLIENTES CON CONSUMO EN EL MES
    // ============================================================
    // console.log("📊 [detallePreventa] Consultando clientes con consumo...");

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
      replacements: { ruta: rutaUpper, inicio: fechaInicioStr, fin: fechaFinStr },
      type: db.QueryTypes.SELECT,
    });

    // console.log("📊 [detallePreventa] Clientes con consumo:", clientesConConsumoRows.length);

    const clientesConConsumo = new Set(
      clientesConConsumoRows.map((c) => c.customer_code)
    );

    // ============================================================
    // 3) CONSULTAR CONSUMO ACTUAL Y ANTERIOR
    // ============================================================
    // const clientesConsumoDataSQL = `
    //   SELECT
    //       customer_code,
    //       SUM(CASE WHEN fecha_entrega >= :inicio AND fecha_entrega < :fin THEN total ELSE 0 END) AS consumo_actual,
    //       SUM(CASE WHEN fecha_entrega < :inicio THEN total ELSE 0 END) AS consumo_anterior
    //   FROM ordenes
    //   WHERE seller_code = :ruta
    //   AND type = 2
    //   AND status = 5
    //   GROUP BY customer_code;
    // `;



    const clientesConsumoDataSQL = `
                SELECT 
                    f.customer_code,
                    SUM(CASE 
                        WHEN f.fecha_entrega >= :inicio AND f.fecha_entrega < :fin THEN d.total 
                        ELSE 0 
                    END) AS consumo_actual,

                    SUM(CASE 
                        WHEN f.fecha_entrega >= :antInicio AND f.fecha_entrega < :antFin THEN d.total 
                        ELSE 0 
                    END) AS consumo_anterior
                FROM facturas f
                JOIN detalle_documento d ON d.documento_code = f.code
                WHERE f.route_code = :ruta  
                  AND f.status IN ('2', '4', '5')  
                GROUP BY f.customer_code
            `;

    // Definir las fechas de inicio y fin para los meses actual y anterior
    const clientesConsumoData = await db.query(clientesConsumoDataSQL, {
      replacements: {
        ruta: rutaUpper,
        inicio: fechaInicioStr,
        fin: fechaFinStr,
        antInicio,
        antFin,
      },
      type: db.QueryTypes.SELECT,
    });
    console.log("🔍 Parámetros de consulta:", { ruta: rutaUpper, inicio: fechaInicioStr, fin: fechaFinStr });
    console.log("📊 [detallepreventa] Datos de consumo obtenidos:", clientesConsumoData);


    // ============================================================
    // 4) CONSULTAR PRODUCTOS VENDIDOS EN EL MES
    // ============================================================
    // console.log("🧾 [detallePreventa] Consultando productos vendidos...");

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
      AND o.status IN ('2', '4', '5')  
      AND o.seller_code = :ruta
      AND o.fecha_entrega >= :inicio
      AND o.fecha_entrega <  :fin
  GROUP BY dd.descripcion
  ORDER BY unidades_vendidas DESC;
`;

    const productosVendidos = await db.query(productosVendidosSQL, {
      replacements: { ruta: rutaUpper, inicio: fechaInicioStr, fin: fechaFinStr },
      type: db.QueryTypes.SELECT,
    });

    // console.log("🧾 [detallePreventa] Productos vendidos obtenidos:", productosVendidos.length);


    // CONSULTAR PRODUCTOS VENDIDOS CANTIDAD POR CLIENTE EN EL MES
    const productosVendidosSQLCantidad = `
  SELECT
      o.customer_code,         -- Código del cliente
      dd.descripcion AS producto,
      SUM(dd.cantidad) AS unidades_vendidas_cliente  -- Suma de la cantidad de productos vendidos por cliente
  FROM ordenes o
  JOIN detalle_documento dd
      ON dd.documento_code = o.code
  WHERE 
      o.type = 2
      AND o.status IN ('2', '4', '5')  
      AND o.seller_code = :ruta
      AND o.fecha_entrega >= :inicio
      AND o.fecha_entrega < :fin
  GROUP BY o.customer_code, dd.descripcion
  HAVING SUM(dd.cantidad) > 0  -- Solo mostramos productos con ventas
  ORDER BY unidades_vendidas_cliente DESC;
`;

    const productosVendidosCantidad = await db.query(productosVendidosSQLCantidad, {
      replacements: { ruta: rutaUpper, inicio: fechaInicioStr, fin: fechaFinStr },
      type: db.QueryTypes.SELECT,
    });

    // console.log("🧾 [detallePreventa] Productos vendidos obtenidos:", productosVendidosCantidad.length);



    // ============================================================
    // 5) CONSULTAR ÚLTIMA VISITA GLOBAL
    // ============================================================
    // console.log("📅 [detallePreventa] Consultando última visita...");

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
    // console.log("📅 [detallePreventa] Registros última visita:", ultimasVisitas.length);

    const mapUltimaVisita = new Map(
      ultimasVisitas.map((v) => [v.customer_code, v.ultima_visita])
    );

    // ============================================================
    // 6) CONSULTAR ÚLTIMA FACTURA GLOBAL
    // ============================================================
    // console.log("🧾 [detallePreventa] Consultando última factura...");

    const ultimaFacturaSQL = `
      SELECT 
          customer_code,
          MAX(
              COALESCE(fecha_autorizacion, fecha_entrega, fecha_creacion)
          ) AS ultima_factura
      FROM facturas
      GROUP BY customer_code;
    `;

    const ultimasFacturas = await db.query(ultimaFacturaSQL, {
      type: db.QueryTypes.SELECT,
    });

    // console.log("🧾 [detallePreventa] Registros última factura:", ultimasFacturas.length);

    const mapUltimaFactura = new Map(
      ultimasFacturas.map((v) => [v.customer_code, v.ultima_factura])
    );

    // 7) UNIFICAR CLIENTES CON Y SIN CONSUMO EN UN SOLO ARRAY
    // console.log("🛠 [detallePreventa] Unificando clientes...");

    // Crear un mapa para almacenar la cantidad total de productos vendidos por cliente
    const clienteProductosVendidos = new Map();

    // Llenar el mapa con los datos de la consulta de productos vendidos
    // productosVendidos.forEach((producto) => {
    productosVendidosCantidad.forEach((producto) => {

      // Asegurarse de que la cantidad vendida sea un número antes de sumarla
      // const cantidadVendida = parseFloat(producto.unidades_vendidas) || 0;  // Si es NaN, asigna 0
      const cantidadVendida = parseFloat(producto.unidades_vendidas_cliente) || 0;  // Si es NaN, asigna 0


      if (!clienteProductosVendidos.has(producto.customer_code)) {
        clienteProductosVendidos.set(producto.customer_code, 0);
      }

      // Sumar las unidades vendidas por cliente
      clienteProductosVendidos.set(
        producto.customer_code,
        clienteProductosVendidos.get(producto.customer_code) + cantidadVendida
      );
    });

    // Ahora, unificar los datos de los clientes con y sin consumo
    const clientesRutaConDetalles = clientesRuta.map((cliente) => {
      // Buscar los datos de consumo de cada cliente
      const consumoData = clientesConsumoData.find((c) => c.customer_code === cliente.codigo_cliente) || {};

      // Asegurarse de que consumoActual y consumoAnterior sean números
      const consumoActual = Number(consumoData.consumo_actual) || 0;  // Si es NaN, asigna 0
      const consumoAnterior = Number(consumoData.consumo_anterior) || 0;  // Si es NaN, asigna 0

      // Calcular el porcentaje de cambio correctamente

      // Calcular la variación absoluta
      const variacionAbs = consumoActual - consumoAnterior;

      // Calcular la variación porcentual
      let variacionPorc = 0;
      if (consumoAnterior > 0) {
        variacionPorc = (variacionAbs / consumoAnterior) * 100;
      } else if (consumoActual > 0) {
        variacionPorc = 100;
      }



      // const porcentajeCambio = consumoAnterior === 0
      //   ? '100%'
      //   : ((consumoActual - consumoAnterior) / consumoAnterior * 100).toFixed(2) + '%';

      // Obtener la cantidad de productos vendidos en el mes actual para el cliente
      let cantidadProductosVendidos = clienteProductosVendidos.get(cliente.codigo_cliente) || 0;

      // Asegurarse de que la cantidad de productos sea un número
      cantidadProductosVendidos = Number(cantidadProductosVendidos);  // Forzamos a convertirlo en un número

      // Verificamos si la conversión fue exitosa
      if (isNaN(cantidadProductosVendidos)) {
        cantidadProductosVendidos = 0;  // Si no es un número válido, lo asignamos como 0
      }

      return {
        codigo_cliente: cliente.codigo_cliente,
        nombre_cliente: cliente.nombre_cliente,
        direccion_entrega: cliente.direccion_entrega,
        ultima_visita: formatFecha(mapUltimaVisita.get(cliente.codigo_cliente)),
        ultima_factura: formatFecha(mapUltimaFactura.get(cliente.codigo_cliente)),
        consumo_actual: consumoActual.toFixed(2),
        max_consumo: Math.max(consumoActual, consumoAnterior).toFixed(2),
        // Agregar vsMesAnterior con la estructura solicitada
        vsMesAnterior: {
          monto_anterior: consumoAnterior.toFixed(2),
          variacion_abs: variacionAbs.toFixed(2),
          variacion_porc: `${variacionPorc.toFixed(2)}%`,

        },
        tuvo_consumo: clientesConConsumo.has(cliente.codigo_cliente) ? 'Sí' : 'No',
        cantidad_productos: cantidadProductosVendidos,  // Agregar cantidad de productos vendidos
      };
    });

    // console.log("✅ [detallePreventa] Resumen clientes:", clientesRutaConDetalles);

    // Definir el total de clientes en la ruta
    const totalClientesRuta = clientesRuta.length;  // Número total de clientes asignados a la ruta
    const totalSin = clientesRuta.length - clientesConConsumo.size;  // Número de clientes sin consumo

    // Responder con la información final
    return res.json({
      ruta: rutaUpper,
      anio: anioNum,
      mes: mesNum,
      rangoFechas: { inicio: fechaInicioStr, fin: fechaFinStr },
      resumenClientes: {
        totalClientesRuta,  // Total de clientes asignados a la ruta
        clientesConConsumo: totalClientesRuta - totalSin,  // Clientes con consumo
        clientesSinConsumo: totalSin,  // Clientes sin consumo
      },
      productosVendidos,  // Aquí se incluyen los productos vendidos
      clientesRuta: clientesRutaConDetalles,  // Aquí se incluyen todos los clientes con detalles
    });


  } catch (error) {
    console.error("❌ [detallePreventa] ERROR EN DETALLE RUTA:", error);
    return res.status(500).json({ error: "Error al obtener detalle de ruta", detalle: error.message });
  }
};

// // Función principal para obtener productos Descartable
const obtenerProductosVendidosRuta = async (req, res) => {
  // console.log("▶️ [obtenerProductosVendidosRuta] Inicio, params:", req.params);

  try {
    const { ruta, anio, mes } = req.params;

    // Validar los parámetros
    if (!ruta || !anio || !mes) {
      // console.warn("⚠️ [obtenerProductosVendidosRuta] Faltan parámetros /ruta/anio/mes");
      return res.status(400).json({ error: "Debe enviar /ruta/anio/mes" });
    }

    const anioNum = parseInt(anio);
    const mesNum = parseInt(mes);

    if (isNaN(anioNum) || isNaN(mesNum) || mesNum < 1 || mesNum > 12) {
      // console.warn("⚠️ [obtenerProductosVendidosRuta] Año o mes inválido:", { anio, mes });
      return res.status(400).json({ error: "Mes o año inválido" });
    }

    // Obtener el rango de fechas para diciembre
    const { fechaInicioStr: fechaInicioStr, fechaFinStr: fechaFinStr } = obtenerRangoFechasPG(anioNum, mesNum);
    // console.log("🧮 [obtenerProductosVendidosRuta] Rango de fechas:", { fechaInicioStr, fechaFinStr });
    const { inicio: antInicio, fin: antFin } = obtenerRangoMesAnterior(anioNum, mesNum);

    // Agregar los console.log para verificar las fechas
    console.log("📅 Rango actual:");
    console.log(`Fecha de inicio: ${fechaInicioStr}`);
    console.log(`Fecha de fin: ${fechaFinStr}`);

    console.log("📅 Rango mes anterior:");
    console.log(`Fecha de inicio: ${antInicio}`);
    console.log(`Fecha de fin: ${antFin}`);






    const rutaUpper = ruta.trim().toUpperCase(); // Asegurar que la ruta esté en mayúsculas

    // Consulta SQL para obtener los productos vendidos en la ruta en el mes de diciembre
    const productosVendidosSQL = `
      SELECT 
        dd.descripcion AS producto,
        SUM(dd.cantidad) AS unidades_vendidas,
        SUM(dd.total) AS monto_usd
      FROM facturas o
      JOIN detalle_documento dd ON dd.documento_code = o.code
      WHERE 
        o.seller_code = :ruta  -- Ruta específica
        AND o.status IN ('2', '4', '5')  -- Estado de la factura (entregada)
        AND o.fecha_entrega >= :inicio  -- Fecha de inicio (1 de diciembre)
        AND o.fecha_entrega < :fin  -- Fecha de fin (31 de diciembre)
        AND dd.codigo_categoria = '7'  -- Filtro para DESCARTABLE 7
      GROUP BY dd.descripcion
      ORDER BY unidades_vendidas DESC;
    `;

    // Ejecutar la consulta SQL
    const productosVendidos = await db.query(productosVendidosSQL, {
      replacements: { ruta: rutaUpper, inicio: fechaInicioStr, fin: fechaFinStr },
      type: db.QueryTypes.SELECT,
    });

    // console.log("🧾 [obtenerProductosVendidosRuta] Productos vendidos obtenidos:", productosVendidos.length);

    // Responder con los productos vendidos
    return res.json({
      ruta: rutaUpper,
      anio: anioNum,
      mes: mesNum,
      rangoFechas: { inicio: fechaInicioStr, fin: fechaFinStr },
      productosVendidos,
    });

  } catch (error) {
    // console.error("❌ [obtenerProductosVendidosRuta] ERROR:", error);
    return res.status(500).json({ error: "Error al obtener productos vendidos", detalle: error.message });
  }
};

module.exports = {
  obtenerDetalleRuta,
  obtenerProductosVendidosRuta

};
