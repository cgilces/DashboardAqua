const { Orden,
  // RutaPreventa 
} = require("../../models");
const db = require("../../db");
const Sequelize = require("sequelize");
const Op = Sequelize.Op;
const { QueryTypes } = require("sequelize");


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

function obtenerNombreMes(fecha) {
  if (!fecha) return null;
  const meses = [
    "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
    "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
  ];
  const d = new Date(fecha);
  return meses[d.getMonth()];
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

    // ============================================================
    // RANGO DE FECHAS
    // ============================================================

    console.log("📅 Rango actual:");
    console.log(`Fecha de inicio: ${fechaInicioStr}`);
    console.log(`Fecha de fin: ${fechaFinStr}`);

    console.log("📅 Rango mes anterior:");
    console.log(`Fecha de inicio: ${antInicio}`);
    console.log(`Fecha de fin: ${antFin}`);


    // ============================================================
    // CONSULTAR CLIENTES ASIGNADOS A LA RUTA
    // ============================================================
    const rutaUpper = ruta?.trim().toUpperCase();

    console.log("🔎 Ruta cruda:", ruta);
    console.log("🔎 Ruta transformada:", rutaUpper);
    console.log("🔎 Ruta length:", rutaUpper?.length);
    console.log("🔎 Ruta char codes:", [...rutaUpper].map(c => c.charCodeAt(0)));

    const clientesRutaSQL = `
                     SELECT DISTINCT
    cuv.codigo_cliente,
    cv.nombre_cliente,
    cv.codigo_tipo_negocio,
    tn.descripcion AS tipo_negocio,
    dc.codigo_direccion_cliente,
    dc.calle1_direccion_cliente AS direccion_cliente,
    dc.telefono_direccion_cliente,
    dc.latitud_direccion_cliente,
    dc.longitud_direccion_cliente,
    cuv.seller_code
FROM public.clientes_usuarios_ventas cuv
LEFT JOIN public.clientes cv 
    ON cv.codigo_cliente = cuv.codigo_cliente
LEFT JOIN public.tipos_negocio tn
    ON tn.codigo = cv.codigo_tipo_negocio
LEFT JOIN public.direcciones_clientes dc 
    ON dc.codigo_cliente = cv.codigo_cliente
WHERE UPPER(TRIM(cuv.seller_code)) = :ruta
ORDER BY cv.nombre_cliente;

                        `;


    const dbActual = await db.query("SELECT current_database()", {
      type: QueryTypes.SELECT
    });
    console.log("📦 Base actual:", dbActual);


    const clientesRuta = await db.query(clientesRutaSQL, {
      replacements: { ruta: rutaUpper },
      type: QueryTypes.SELECT,
    });

    console.log("👥 Total clientes:", clientesRuta.length);


    // ============================================================
    // 2) CONSULTAR CLIENTES CON CONSUMO EN EL MES
    // ============================================================
    // console.log(" [detallePreventa] Consultando clientes con consumo...");

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
    const clientesConsumoDataSQL = `
              SELECT 
    o.customer_code,

    SUM(CASE 
        WHEN o.fecha_entrega >= :inicio 
         AND o.fecha_entrega <  :fin 
        THEN d.total ELSE 0 END
    ) AS consumo_actual,

    SUM(CASE 
        WHEN o.fecha_entrega >= :antInicio 
         AND o.fecha_entrega <  :antFin 
        THEN d.total ELSE 0 END
    ) AS consumo_anterior

FROM ordenes o
JOIN detalle_documento d 
    ON d.documento_code = o.code

WHERE 
    o.seller_code = :ruta
    AND o.type = 2
    AND o.status = 5

GROUP BY o.customer_code;
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
    // console.log("📊 [detallepreventa] Datos de consumo obtenidos:", clientesConsumoData);







    // ============================================================
    //  CONSUMO MÁXIMO ANUAL POR CLIENTE
    // ============================================================

    const fechaInicioAnio = `${anioNum}-01-01 00:00:00`;
    const fechaFinAnio = `${anioNum + 1}-01-01 00:00:00`;
    console.log("📅 Rango anual:", { inicio: fechaInicioAnio, fin: fechaFinAnio });

    const consumoMaximoAnualSQL = `
             WITH consumo_mensual AS (
    SELECT 
        o.customer_code,
        DATE_TRUNC('month', o.fecha_entrega) AS mes,
        SUM(d.total) AS consumo_mes
    FROM ordenes o
    JOIN detalle_documento d 
        ON d.documento_code = o.code
    WHERE 
        o.seller_code = :ruta
        AND o.type = 2
        AND o.status = 5
        AND o.fecha_entrega >= :inicioAnio
        AND o.fecha_entrega <  :finAnio
    GROUP BY o.customer_code, DATE_TRUNC('month', o.fecha_entrega)
)
SELECT DISTINCT ON (customer_code)
    customer_code,
    mes,
    consumo_mes
FROM consumo_mensual
ORDER BY customer_code, consumo_mes DESC;
              `;

    const consumoMaximoAnual = await db.query(consumoMaximoAnualSQL, {
      replacements: {
        ruta: rutaUpper,
        inicioAnio: fechaInicioAnio,
        finAnio: fechaFinAnio,
      },
      type: db.QueryTypes.SELECT,
    });

    // Convertimos a Map para búsqueda rápida
    const mapMaxConsumoAnual = new Map(
      consumoMaximoAnual.map(c => [
        c.customer_code,
        {
          monto: Number(c.consumo_mes) || 0,
          mes: c.mes
        }
      ])
    );




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
    o.seller_code = :ruta
    AND o.type = 2
    AND o.status = 5
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
    o.customer_code,
    SUM(dd.cantidad) AS unidades_vendidas_cliente
FROM ordenes o
JOIN detalle_documento dd
    ON dd.documento_code = o.code
WHERE 
    o.seller_code = :ruta
    AND o.type = 2
    AND o.status = 5
    AND o.fecha_entrega >= :inicio
    AND o.fecha_entrega <  :fin
GROUP BY o.customer_code;
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

    // Unificar clientes con detalles de consumo
    // Unificar clientes con detalles de consumo
    const clientesRutaConDetalles = clientesRuta.map((cliente) => {
      const consumoData =
        clientesConsumoData.find(
          (c) => c.customer_code === cliente.codigo_cliente
        ) || {};

      const consumoActual = Number(consumoData.consumo_actual) || 0;
      const consumoAnterior = Number(consumoData.consumo_anterior) || 0;

      const variacionAbs = consumoActual - consumoAnterior;

      const variacionPorc =
        consumoAnterior > 0
          ? (variacionAbs / consumoAnterior) * 100
          : consumoActual > 0
            ? 100
            : 0;

      // ✅ OBTENER FECHAS DESDE LOS MAP
      const ultimaVisita = mapUltimaVisita.get(cliente.codigo_cliente) || null;
      const ultimaFactura = mapUltimaFactura.get(cliente.codigo_cliente) || null;
      const dataMax = mapMaxConsumoAnual.get(cliente.codigo_cliente) || { monto: 0, mes: null };

      return {
        codigo_cliente: cliente.codigo_cliente,
        nombre_cliente: cliente.nombre_cliente,
        direccion_entrega: cliente.direccion_cliente,
        codigo_tipo_negocio: cliente.codigo_tipo_negocio || null,
        tipo_negocio: cliente.tipo_negocio || "SIN CLASIFICAR",
        telefono_cliente: cliente.telefono_direccion_cliente || "—",
        latitud_cliente: cliente.latitud_direccion_cliente || "—",
        longitud_cliente: cliente.longitud_direccion_cliente || "—",

        // FORMATEADAS
        ultima_visita: formatFecha(ultimaVisita),
        ultima_factura: formatFecha(ultimaFactura),

        consumo_actual: consumoActual.toFixed(2),
        cantidad_productos: clienteProductosVendidos.get(cliente.codigo_cliente) || 0,
        max_consumo: dataMax.monto.toFixed(2),
        mes_max_consumo_nombre: obtenerNombreMes(dataMax.mes),

        vsMesAnterior: {
          monto_anterior: consumoAnterior.toFixed(2),
          variacion_abs: variacionAbs.toFixed(2),
          variacion_porc: `${variacionPorc.toFixed(2)}%`,
        },

        // ✅ Consumo real del mes
        tuvo_consumo: consumoActual > 0 ? "Sí" : "No",
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

// ========================================================
// 🏙️ CONSOLIDADO DE CLIENTES POR CANAL DESCARTABLE
//    GET /api/ventas/clientes-canal-descartable/:canal/:anio/:mes
//    canal: domicilio | vip | mayorista
// ========================================================
const obtenerClientesCanalDescartable = async (req, res) => {
  try {
    const { canal, anio, mes } = req.params;
    const anioNum = parseInt(anio);
    const mesNum  = parseInt(mes);

    if (isNaN(anioNum) || isNaN(mesNum) || mesNum < 1 || mesNum > 12) {
      return res.status(400).json({ error: "Mes o año inválido" });
    }

    const prefijos = { domicilio: "A", vip: "V", mayorista: "M" };
    const prefijo  = prefijos[canal?.toLowerCase()];
    if (!prefijo) return res.status(400).json({ error: "Canal inválido. Use: domicilio, vip o mayorista" });

    const { fechaInicioStr, fechaFinStr } = obtenerRangoFechasPG(anioNum, mesNum);
    const { inicio: antInicio, fin: antFin } = obtenerRangoMesAnterior(anioNum, mesNum);

    // 1. Clientes asignados a rutas del canal
    const clientesSQL = `
      SELECT DISTINCT
        cuv.codigo_cliente,
        cv.nombre_cliente,
        tn.descripcion          AS tipo_negocio,
        dc.calle1_direccion_cliente  AS direccion_entrega,
        dc.telefono_direccion_cliente AS telefono,
        dc.latitud_direccion_cliente  AS latitud,
        dc.longitud_direccion_cliente AS longitud
      FROM clientes_usuarios_ventas cuv
      LEFT JOIN clientes          cv  ON cv.codigo_cliente  = cuv.codigo_cliente
      LEFT JOIN tipos_negocio     tn  ON tn.codigo          = cv.codigo_tipo_negocio
      LEFT JOIN direcciones_clientes dc ON dc.codigo_cliente = cv.codigo_cliente
      WHERE cuv.seller_code ILIKE :prefix
      ORDER BY cv.nombre_cliente
    `;
    const clientesRuta = await db.query(clientesSQL, {
      replacements: { prefix: `${prefijo}%` },
      type: QueryTypes.SELECT,
    });

    // 2. Consumo actual + anterior por cliente
    const consumoSQL = `
      SELECT
        o.customer_code,
        SUM(CASE WHEN o.fecha_entrega >= :inicio    AND o.fecha_entrega < :fin
                 THEN dd.total ELSE 0 END) AS consumo_actual,
        SUM(CASE WHEN o.fecha_entrega >= :antInicio AND o.fecha_entrega < :antFin
                 THEN dd.total ELSE 0 END) AS consumo_anterior
      FROM ordenes o
      JOIN detalle_documento dd ON dd.documento_code = o.code
      WHERE o.seller_code ILIKE :prefix
        AND o.type = 2
        AND o.status IN (2,4,5)
        AND dd.codigo_categoria = '7'
      GROUP BY o.customer_code
    `;
    const consumoData = await db.query(consumoSQL, {
      replacements: { prefix: `${prefijo}%`, inicio: fechaInicioStr, fin: fechaFinStr, antInicio, antFin },
      type: QueryTypes.SELECT,
    });

    // 3. Cantidad (unidades) por cliente en mes actual
    const cantidadSQL = `
      SELECT o.customer_code, SUM(dd.cantidad) AS cantidad_actual
      FROM ordenes o
      JOIN detalle_documento dd ON dd.documento_code = o.code
      WHERE o.seller_code ILIKE :prefix
        AND o.type = 2
        AND o.status IN (2,4,5)
        AND dd.codigo_categoria = '7'
        AND o.fecha_entrega >= :inicio AND o.fecha_entrega < :fin
      GROUP BY o.customer_code
    `;
    const cantidadData = await db.query(cantidadSQL, {
      replacements: { prefix: `${prefijo}%`, inicio: fechaInicioStr, fin: fechaFinStr },
      type: QueryTypes.SELECT,
    });

    // 4. Última orden del canal por cliente
    const ultimaOrdenSQL = `
      SELECT o.customer_code, MAX(o.fecha_entrega) AS ultima_factura
      FROM ordenes o
      JOIN detalle_documento dd ON dd.documento_code = o.code
      WHERE o.seller_code ILIKE :prefix
        AND o.type = 2
        AND o.status IN (2,4,5)
        AND dd.codigo_categoria = '7'
      GROUP BY o.customer_code
    `;
    const ultimasOrdenes = await db.query(ultimaOrdenSQL, {
      replacements: { prefix: `${prefijo}%` },
      type: QueryTypes.SELECT,
    });

    // 5. Productos vendidos en el canal en el mes
    const productosSQL = `
      SELECT
        dd.descripcion  AS producto,
        SUM(dd.cantidad) AS unidades_vendidas,
        SUM(dd.total)    AS monto_usd
      FROM ordenes o
      JOIN detalle_documento dd ON dd.documento_code = o.code
      WHERE o.seller_code ILIKE :prefix
        AND o.type = 2
        AND o.status IN (2,4,5)
        AND dd.codigo_categoria = '7'
        AND o.fecha_entrega >= :inicio AND o.fecha_entrega < :fin
      GROUP BY dd.descripcion
      ORDER BY unidades_vendidas DESC
    `;
    const productosVendidos = await db.query(productosSQL, {
      replacements: { prefix: `${prefijo}%`, inicio: fechaInicioStr, fin: fechaFinStr },
      type: QueryTypes.SELECT,
    });

    // Construir maps
    const consumoMap  = new Map(consumoData.map(c  => [c.customer_code,  c]));
    const cantidadMap = new Map(cantidadData.map(c => [c.customer_code, Number(c.cantidad_actual)]));
    const ordenMap    = new Map(ultimasOrdenes.map(u => [u.customer_code, u.ultima_factura]));

    const clientes = clientesRuta.map(c => {
      const cons           = consumoMap.get(c.codigo_cliente) || {};
      const consumoActual  = Number(cons.consumo_actual)  || 0;
      const consumoAnterior = Number(cons.consumo_anterior) || 0;
      return {
        codigo_cliente:   c.codigo_cliente,
        nombre_cliente:   c.nombre_cliente,
        direccion_entrega: c.direccion_entrega || "—",
        tipo_negocio:     c.tipo_negocio      || "—",
        telefono:         c.telefono          || "—",
        latitud:          c.latitud           || "—",
        longitud:         c.longitud          || "—",
        cantidad_actual:  cantidadMap.get(c.codigo_cliente) || 0,
        consumo_actual:   consumoActual,
        consumo_anterior: consumoAnterior,
        ultima_factura:   formatFecha(ordenMap.get(c.codigo_cliente)) || null,
      };
    });

    const conConsumo = clientes.filter(c => c.consumo_actual > 0).length;

    return res.json({
      clientes,
      resumen: {
        totalClientes:       clientes.length,
        clientesConConsumo:  conConsumo,
        clientesSinConsumo:  clientes.length - conConsumo,
      },
      productosVendidos,
    });
  } catch (error) {
    return res.status(500).json({ error: "Error al obtener clientes del canal", detalle: error.message });
  }
};

module.exports = {
  obtenerDetalleRuta,
  obtenerProductosVendidosRuta,
  obtenerClientesCanalDescartable,
};
