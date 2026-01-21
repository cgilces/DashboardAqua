const { Orden } = require("../../models");
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
function obtenerRangoFechasPG(anio, mes) {
  const inicio = new Date(Date.UTC(anio, mes - 1, 1)); // inicio mes
  const fin = new Date(Date.UTC(anio, mes, 1));       // siguiente mes

  const fInicio = inicio.toISOString().replace("T", " ").substring(0, 19);
  const fFin = fin.toISOString().replace("T", " ").substring(0, 19);

  return { fInicio, fFin };
}

// ========================================================
// 🚀 CONTROLADOR PRINCIPAL
// ========================================================
const obtenerDetalleRuta = async (req, res) => {
  console.log("▶️ [detalleHielo] Inicio obtenerDetalleRuta, params:", req.params);

  try {
    const { ruta, anio, mes } = req.params;
    if (!ruta || !anio || !mes) {
      console.warn("⚠️ [detalleHielo] Faltan parámetros /ruta/anio/mes");
      return res.status(400).json({ error: "Debe enviar /ruta/anio/mes" });
    }

    const anioNum = parseInt(anio);
    const mesNum = parseInt(mes);

    if (isNaN(anioNum) || isNaN(mesNum) || mesNum < 1 || mesNum > 12) {
      console.warn("⚠️ [detalleHielo] Año o mes inválido:", { anio, mes });
      return res.status(400).json({ error: "Mes o año inválido" });
    }

    // ============================================================
    // 🗓 USO DE FUNCIÓN SEGURA PARA FECHAS PG
    // ============================================================
    const { fInicio: fechaInicioStr, fFin: fechaFinStr } = obtenerRangoFechasPG(anioNum, mesNum);

    console.log("🧮 [detalleHielo] Rango de fechas calculado (SEGURIDAD UTC):", {
      anioNum,
      mesNum,
      fechaInicioStr,
      fechaFinStr,
    });
    // const rutaUpper = ruta.trim().toUpperCase();
    // Suponiendo que la ruta incluye 'h3', dejamos esta parte sin cambios
    let rutaOriginal = ruta.trim();
    // Identificamos si contiene 'h3' y la dejamos intacta
    if (rutaOriginal.toLowerCase() === 'h3') {
      // Si la ruta es igual a 'h3', no la convertimos a mayúsculas
      rutaUpper = 'h3';  // Mantener 'h3' como está
    } else {
      // Convertir el resto de la ruta a mayúsculas
      rutaUpper = rutaOriginal.toUpperCase();
    }
    console.log(rutaUpper);  // Ahora 'h3' no se convertirá a mayúsculas

    // ============================================================
    // 1) CONSULTAR CLIENTES ASIGNADOS A LA RUTA
    // ============================================================
    console.log("👥 [detalleHielo] Consultando clientes asignados a la ruta...");

    const clientesRutaSQL = `
      SELECT codigo_cliente, nombre_cliente, direccion_entrega
      FROM clientes_ventas
      WHERE usuario_asignado ILIKE :ruta;
    `;

    const clientesRuta = await db.query(clientesRutaSQL, {
      replacements: { ruta: rutaUpper },
      type: db.QueryTypes.SELECT,
    });

    console.log("👥 [detalleHielo] Total clientes asignados:", clientesRuta.length);

    // ============================================================
    // 2) CONSULTAR CLIENTES CON CONSUMO EN EL MES
    // ============================================================
    console.log("📊 [detalleHielo] Consultando clientes con consumo...");
    const clientesConConsumoSQL = `
      SELECT DISTINCT o.customer_code
      FROM facturas o
      JOIN detalle_documento dd 
          ON dd.documento_code = o.code
      WHERE 
          o.seller_code = :ruta  -- Ruta H10
          AND o.status IN ('2', '4', '5')  -- Estado de la factura (entregada)
          AND o.fecha_entrega >= :inicio  -- Fecha de inicio (1 de diciembre de 2025)
          AND o.fecha_entrega < :fin  -- Fecha de fin (31 de diciembre de 2025)
    `;
    const clientesConConsumoRows = await db.query(clientesConConsumoSQL, {
      replacements: { ruta: rutaUpper, inicio: fechaInicioStr, fin: fechaFinStr },
      type: db.QueryTypes.SELECT,
    });


    console.log("📊 [detalleHielo] Clientes con consumo:", clientesConConsumoRows.length);

    const clientesConConsumo = new Set(
      clientesConConsumoRows.map((c) => c.customer_code)
    );

    // ============================================================
    // 3) CONSULTAR CONSUMO ACTUAL Y ANTERIOR
    // ============================================================
    const clientesConsumoDataSQL = `
        SELECT 
            customer_code,
            SUM(CASE WHEN fecha_entrega >= :inicio AND fecha_entrega < :fin THEN total ELSE 0 END) AS consumo_actual,
            SUM(CASE WHEN fecha_entrega < :inicio THEN total ELSE 0 END) AS consumo_anterior
        FROM facturas
        WHERE seller_code = :ruta
        AND status IN ('2', '4', '5')
        AND fecha_entrega >= :inicio  -- Fecha de inicio
        AND fecha_entrega < :fin  -- Fecha de fin
        GROUP BY customer_code;
      `;


    const clientesConsumoData = await db.query(clientesConsumoDataSQL, {
      replacements: { ruta: rutaUpper, inicio: fechaInicioStr, fin: fechaFinStr },
      type: db.QueryTypes.SELECT,
    });

    // ============================================================
    // 4) CONSULTAR PRODUCTOS VENDIDOS EN EL MES
    // ============================================================
    // console.log("🧾 [detalleHielo] Consultando productos vendidos...");
    const productosVendidosSQL = `
      SELECT
          dd.descripcion AS producto,
          SUM(dd.cantidad) AS unidades_vendidas,
          SUM(dd.total) AS monto_usd
      FROM facturas o
      JOIN detalle_documento dd
          ON dd.documento_code = o.code
      WHERE
          o.seller_code = :ruta
          AND o.status IN ('2', '4', '5')
          AND o.fecha_entrega >= :inicio
          AND o.fecha_entrega <  :fin
          AND dd.codigo_categoria = '40'
      GROUP BY dd.descripcion
      ORDER BY unidades_vendidas DESC;
    `;

    const productosVendidos = await db.query(productosVendidosSQL, {
      replacements: { ruta: rutaUpper, inicio: fechaInicioStr, fin: fechaFinStr },
      type: db.QueryTypes.SELECT,
    });

    // console.log("🧾 [detalleHielo] Productos vendidos obtenidos:", productosVendidos.length);


    // CONSULTAR PRODUCTOS VENDIDOS CANTIDAD POR CLIENTE EN EL MES
    const productosVendidosSQLCantidad = `
        SELECT
            f.customer_code,         -- Código del cliente
            dd.descripcion AS producto,
            SUM(dd.cantidad) AS unidades_vendidas_cliente  -- Suma de la cantidad de productos vendidos por cliente
        FROM facturas f
        JOIN detalle_documento dd
            ON dd.documento_code = f.code
        WHERE 
            f.status IN ('2', '4', '5')  -- Estado de la factura (entregada)
            AND f.seller_code = :ruta  -- Ruta H7
            AND f.fecha_entrega >= :inicio  -- Fecha de inicio (1 de diciembre de 2025)
            AND f.fecha_entrega < :fin  -- Fecha de fin (31 de diciembre de 2025)
        GROUP BY f.customer_code, dd.descripcion
        HAVING SUM(dd.cantidad) > 0  -- Solo mostramos productos con ventas
        ORDER BY unidades_vendidas_cliente DESC;
      `;


    const productosVendidosCantidad = await db.query(productosVendidosSQLCantidad, {
      replacements: { ruta: rutaUpper, inicio: fechaInicioStr, fin: fechaFinStr },
      type: db.QueryTypes.SELECT,
    });

     console.log("🧾 [detalleHielo] Productos vendidos obtenidos:", productosVendidosCantidad);



    // ============================================================
    // 5) CONSULTAR ÚLTIMA VISITA GLOBAL
    // ============================================================
    // console.log("📅 [detalleHielo] Consultando última visita...");

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
    // console.log("📅 [detalleHielo] Registros última visita:", ultimasVisitas.length);

    const mapUltimaVisita = new Map(
      ultimasVisitas.map((v) => [v.customer_code, v.ultima_visita])
    );

    // ============================================================
    // 6) CONSULTAR ÚLTIMA FACTURA GLOBAL
    // ============================================================
    // console.log("🧾 [detalleHielo] Consultando última factura...");

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

    // console.log("🧾 [detalleHielo] Registros última factura:", ultimasFacturas.length);

    const mapUltimaFactura = new Map(
      ultimasFacturas.map((v) => [v.customer_code, v.ultima_factura])
    );

    // 7) UNIFICAR CLIENTES CON Y SIN CONSUMO EN UN SOLO ARRAY
    // console.log("🛠 [detalleHielo] Unificando clientes...");

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
      const consumoActual = parseFloat(consumoData.consumo_actual) || 0;  // Si es NaN, asigna 0
      const consumoAnterior = parseFloat(consumoData.consumo_anterior) || 0;  // Si es NaN, asigna 0

      // Calcular el porcentaje de cambio correctamente
      const porcentajeCambio = consumoAnterior === 0
        ? '100%'
        : ((consumoActual - consumoAnterior) / consumoAnterior * 100).toFixed(2) + '%';

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
        consumo_anterior: consumoAnterior.toFixed(2),
        max_consumo: Math.max(consumoActual, consumoAnterior).toFixed(2),
        porcentaje_cambio: porcentajeCambio,
        tuvo_consumo: clientesConConsumo.has(cliente.codigo_cliente) ? 'Sí' : 'No',
        cantidad_productos: cantidadProductosVendidos,  // Agregar cantidad de productos vendidos
      };
    });

    // console.log("✅ [detalleHielo] Resumen clientes:", clientesRutaConDetalles);

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
    console.error("❌ [detalleHielo] ERROR EN DETALLE RUTA:", error);
    return res.status(500).json({ error: "Error al obtener detalle de ruta", detalle: error.message });
  }
};




module.exports = {
  obtenerDetalleRuta,
};
