const { Orden } = require("../../models");
const db = require("../../db");
const Sequelize = require("sequelize");
const Op = Sequelize.Op;

/* ========================================================
   🧩 HELPERS
======================================================== */

// Formatear fecha YYYY-MM-DD
function formatFecha(fecha) {
  if (!fecha) return null;
  const d = new Date(fecha);
  if (isNaN(d.getTime())) return null;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
}

// Rango seguro UTC para PostgreSQL (MES ACTUAL)
function obtenerRangoFechasPG(anio, mes) {
  const inicio = new Date(Date.UTC(anio, mes - 1, 1));
  const fin = new Date(Date.UTC(anio, mes, 1));

  return {
    fInicio: inicio.toISOString().replace("T", " ").substring(0, 19),
    fFin: fin.toISOString().replace("T", " ").substring(0, 19),
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
  // console.log("▶️ [detalleHielo] Inicio obtenerDetalleRuta, params:", req.params);

  try {
    const { ruta, anio, mes } = req.params;
    if (!ruta || !anio || !mes) {
      // console.warn("⚠️ [detalleHielo] Faltan parámetros /ruta/anio/mes");
      return res.status(400).json({ error: "Debe enviar /ruta/anio/mes" });
    }

    const anioNum = parseInt(anio);
    const mesNum = parseInt(mes);

    if (isNaN(anioNum) || isNaN(mesNum) || mesNum < 1 || mesNum > 12) {
      // console.warn("⚠️ [detalleHielo] Año o mes inválido:", { anio, mes });
      return res.status(400).json({ error: "Mes o año inválido" });
    }

    // ============================================================
    //  USO DE FUNCIÓN SEGURA PARA FECHAS PG
    // ============================================================
    // Obtener las fechas del mes actual y del mes anterior
    const { fInicio, fFin } = obtenerRangoFechasPG(anioNum, mesNum);
    const { inicio: antInicio, fin: antFin } = obtenerRangoMesAnterior(anioNum, mesNum);

    // Agregar los console.log para verificar las fechas
    console.log("📅 Rango actual:");
    console.log(`Fecha de inicio: ${fInicio}`);
    console.log(`Fecha de fin: ${fFin}`);

    console.log("📅 Rango mes anterior:");
    console.log(`Fecha de inicio: ${antInicio}`);
    console.log(`Fecha de fin: ${antFin}`);

    console.log("🧮 [detalleHielo] Rango de fechas calculado (SEGURIDAD UTC):", {
      anioNum,
      mesNum,
      fInicio,
      fFin,
    });


    // ============================================================
    // NORMALIZAR RUTA (solo una vez)
    // ============================================================

    let rutaUpper;

    const rutaOriginal = ruta?.trim();

    if (rutaOriginal?.toLowerCase() === "h3") {
      rutaUpper = "h3";
    } else {
      rutaUpper = rutaOriginal?.toUpperCase();
    }

    console.log("🔎 Ruta normalizada:", rutaUpper);


    // ============================================================
    // 1) CONSULTAR CLIENTES ASIGNADOS A LA RUTA
    // ============================================================
    // console.log("👥 [detalleHielo] Consultando clientes asignados a la ruta...");

    const clientesRutaSQL = `
          SELECT DISTINCT ON (cuv.codigo_cliente)
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
          ORDER BY cuv.codigo_cliente, dc.fecha_creacion_direccion_cliente DESC;
      `;



    const clientesRuta = await db.query(clientesRutaSQL, {
      replacements: { ruta: rutaUpper }, // AQUÍ es importante
      type: db.QueryTypes.SELECT,
    });



    console.log("👥 Total clientes:", clientesRuta.length);




    // ============================================================
    // 2) CONSULTAR CLIENTES CON CONSUMO EN EL MES
    // ============================================================
    // console.log("📊 [detalleHielo] Consultando clientes con consumo...");
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
      replacements: { ruta: rutaUpper, inicio: fInicio, fin: fFin },
      type: db.QueryTypes.SELECT,
    });
    // console.log("📊 [detalleHielo] Clientes con consumo:", clientesConConsumoRows.length);
    const clientesConConsumo = new Set(
      clientesConConsumoRows.map((c) => c.customer_code)
    );

    // ============================================================
    // 3) CONSULTAR CONSUMO ACTUAL Y ANTERIOR
    // ============================================================
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
                WHERE f.seller_code = :ruta  
                  AND f.status IN ('2', '4', '5')  
                GROUP BY f.customer_code
            `;
    // Definir las fechas de inicio y fin para los meses actual y anterior
    const clientesConsumoData = await db.query(clientesConsumoDataSQL, {
      replacements: {
        ruta: rutaUpper,
        inicio: fInicio,
        fin: fFin,
        antInicio,
        antFin,
      },
      type: db.QueryTypes.SELECT,
    });

    console.log("📊 [detalleHielo] Datos de consumo obtenidos:", clientesConsumoData);




    /* ========================================================
    CONSUMO MÁXIMO ANUAL HIELO
======================================================== */

    const fechaInicioAnio = `${anioNum}-01-01 00:00:00`;
    const fechaFinAnio = `${anioNum + 1}-01-01 00:00:00`;

    const consumoMaximoAnualSQL = `
        WITH consumo_mensual AS (
            SELECT 
                f.customer_code,
                DATE_TRUNC('month', f.fecha_entrega) AS mes,
                SUM(d.total) AS consumo_mes
            FROM facturas f
            JOIN detalle_documento d 
                ON d.documento_code = f.code
            WHERE 
                f.seller_code = :ruta
                AND f.status IN ('2','4','5')
                AND d.codigo_categoria = '40'
                AND f.fecha_entrega >= :inicioAnio
                AND f.fecha_entrega <  :finAnio
            GROUP BY f.customer_code, DATE_TRUNC('month', f.fecha_entrega)
        )
        SELECT DISTINCT ON (customer_code)
            customer_code,
            consumo_mes,
            mes
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


    const mapMaxConsumoAnual = new Map(
      consumoMaximoAnual.map(c => [
        c.customer_code,
        {
          monto: Number(c.consumo_mes) || 0,
          mes: c.mes
        }
      ])
    );


    const meses = [
      "Enero", "Febrero", "Marzo", "Abril",
      "Mayo", "Junio", "Julio", "Agosto",
      "Septiembre", "Octubre", "Noviembre", "Diciembre"
    ];





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
      replacements: { ruta: rutaUpper, inicio: fInicio, fin: fFin },
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
      replacements: { ruta: rutaUpper, inicio: fInicio, fin: fFin },
      type: db.QueryTypes.SELECT,
    });

    // console.log("🧾 [detalleHielo] Productos vendidos obtenidos:", productosVendidosCantidad);



    // ============================================================
    // 5) CONSULTAR ÚLTIMA VISITA GLOBAL
    // ============================================================
    // console.log("usuario [detalleHielo] Consultando última visita...");

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
    // console.log("usuario [detalleHielo] Registros última visita:", ultimasVisitas.length);
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
    // 7) UNIFICAR CLIENTES CON Y SIN CONSUMO EN UN SOLO ARRAY
    // console.log("🛠 [detalleHielo] Unificando clientes...");

    const clientesRutaConDetalles = clientesRuta.map((cliente) => {
      // Buscar los datos de consumo de cada cliente
      const consumoData = clientesConsumoData.find((c) => c.customer_code === cliente.codigo_cliente) || {};

      // Asegurarse de que consumoActual y consumoAnterior sean números
      const consumoActual = Number(consumoData.consumo_actual) || 0;  // Si es NaN, asigna 0
      const consumoAnterior = Number(consumoData.consumo_anterior) || 0;  // Si es NaN, asigna 0

      // Calcular la variación absoluta
      const variacionAbs = consumoActual - consumoAnterior;

      // Calcular la variación porcentual
      let variacionPorc = 0;
      if (consumoAnterior > 0) {
        variacionPorc = (variacionAbs / consumoAnterior) * 100;
      } else if (consumoActual > 0) {
        variacionPorc = 100;
      }

      // Obtener la cantidad de productos vendidos en el mes actual para el cliente
      let cantidadProductosVendidos = clienteProductosVendidos.get(cliente.codigo_cliente) || 0;

      // Asegurarse de que la cantidad de productos sea un número
      cantidadProductosVendidos = Number(cantidadProductosVendidos);  // Forzamos a convertirlo en un número

      // Verificamos si la conversión fue exitosa
      if (isNaN(cantidadProductosVendidos)) {
        cantidadProductosVendidos = 0;  // Si no es un número válido, lo asignamos como 0
      }


      const maxData = mapMaxConsumoAnual.get(cliente.codigo_cliente) || {
        monto: 0,
        mes: null
      };

      const mesNumero = maxData.mes
        ? new Date(maxData.mes).getUTCMonth()
        : null;

      const mesNombre = mesNumero !== null
        ? meses[mesNumero]
        : null;


      return {
        codigo_cliente: cliente.codigo_cliente,
        nombre_cliente: cliente.nombre_cliente,
        direccion_entrega: cliente.direccion_cliente,
        codigo_tipo_negocio: cliente.codigo_tipo_negocio || null,
        tipo_negocio: cliente.tipo_negocio || "SIN CLASIFICAR",
        telefono_cliente: cliente.telefono_direccion_cliente, // Nuevo campo
        latitud_cliente: cliente.latitud_direccion_cliente,  // Nuevo campo
        longitud_cliente: cliente.longitud_direccion_cliente,  // Nuevo campo
        ultima_visita: formatFecha(mapUltimaVisita.get(cliente.codigo_cliente)),
        ultima_factura: formatFecha(mapUltimaFactura.get(cliente.codigo_cliente)),
        consumo_actual: consumoActual.toFixed(2),
        tuvo_consumo: clientesConConsumo.has(cliente.codigo_cliente) ? 'Sí' : 'No',
        cantidad_productos: cantidadProductosVendidos,  // Agregar cantidad de productos vendidos
        max_consumo: maxData.monto.toFixed(2),
        mes_max_consumo: mesNumero !== null ? mesNumero + 1 : null,
        mes_max_consumo_nombre: mesNombre,

        vsMesAnterior: {
          monto_anterior: consumoAnterior.toFixed(2),
          variacion_abs: variacionAbs.toFixed(2),
          variacion_porc: `${variacionPorc.toFixed(2)}%`,
        }
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
      rangoFechas: { inicio: fInicio, fin: fFin },
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
