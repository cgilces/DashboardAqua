const db = require("../../db");
const Sequelize = require("sequelize");

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
function obtenerRangoMesAnterior(anio, mes) {
  const fecha = new Date(Date.UTC(anio, mes - 2, 1));
  const inicio = new Date(Date.UTC(fecha.getFullYear(), fecha.getMonth(), 1));
  const fin = new Date(Date.UTC(fecha.getFullYear(), fecha.getMonth() + 1, 1));

  return {
    inicio: inicio.toISOString().replace("T", " ").substring(0, 19),
    fin: fin.toISOString().replace("T", " ").substring(0, 19),
  };
}

/* ========================================================
   🚀 CONTROLADOR BOTELLÓN
======================================================== */

const obtenerDetalleRuta = async (req, res) => {
  console.log("▶️ [detalleBotellon] Params:", req.params);

  try {
    const { ruta, anio, mes } = req.params;

    if (!ruta || !anio || !mes) {
      return res.status(400).json({ error: "Debe enviar /ruta/anio/mes" });
    }

    const anioNum = parseInt(anio);
    const mesNum = parseInt(mes);

    if (isNaN(anioNum) || isNaN(mesNum) || mesNum < 1 || mesNum > 12) {
      return res.status(400).json({ error: "Mes o año inválido" });
    }

    const { fInicio, fFin } = obtenerRangoFechasPG(anioNum, mesNum);
    const { inicio: antInicio, fin: antFin } = obtenerRangoMesAnterior(anioNum, mesNum);

    const rutaUpper = ruta.trim().toUpperCase();

    /* ========================================================
       1️⃣ CLIENTES ASIGNADOS A LA RUTA
    ======================================================== */

    const clientesRutaSQL = `
  SELECT DISTINCT
    cuv.codigo_cliente,
    cv.nombre_cliente,
    dc.codigo_direccion_cliente,
    dc.calle1_direccion_cliente AS direccion_cliente,  -- Usamos la columna 'calle1_direccion_cliente' como la dirección
    dc.telefono_direccion_cliente,
    dc.latitud_direccion_cliente,  -- Agregamos latitud
    dc.longitud_direccion_cliente  -- Agregamos longitud
  FROM clientes_usuarios_ventas cuv
  JOIN clientes cv ON cv.codigo_cliente = cuv.codigo_cliente
  JOIN direcciones_clientes dc ON dc.codigo_cliente = cv.codigo_cliente  -- Hacemos JOIN con 'direcciones_clientes'
  WHERE cuv.seller_code = :ruta  -- Filtramos por la ruta que se pasa como parámetro
  ORDER BY cv.nombre_cliente;
`;

    const clientesRuta = await db.query(clientesRutaSQL, {
      replacements: { ruta },  // 'ruta' es el parámetro que se pasa a la consulta
      type: db.QueryTypes.SELECT,
    });





    /* ========================================================
       2️⃣ CLIENTES CON CONSUMO EN EL MES ACTUAL
    ======================================================== */
    const clientesConConsumoSQL = `
      SELECT DISTINCT f.customer_code
      FROM facturas f
      JOIN detalle_documento d
        ON d.documento_code = f.code
      WHERE f.seller_code = :ruta
        AND f.status IN ('2','4','5')
        AND d.codigo_categoria = '5'
        AND f.fecha_entrega >= :inicio
        AND f.fecha_entrega <  :fin;
    `;

    const clientesConConsumoRows = await db.query(clientesConConsumoSQL, {
      replacements: { ruta: rutaUpper, inicio: fInicio, fin: fFin },
      type: db.QueryTypes.SELECT,
    });

    const clientesConConsumo = new Set(
      clientesConConsumoRows.map((c) => c.customer_code)
    );

    /* ========================================================
       3️⃣ CONSUMO ACTUAL VS MES ANTERIOR REAL
    ======================================================== */
    const consumoSQL = `
      SELECT
        f.customer_code,
        SUM(
          CASE 
            WHEN f.fecha_entrega >= :inicio
             AND f.fecha_entrega <  :fin
            THEN d.total ELSE 0 
          END
        ) AS consumo_actual,
        SUM(
          CASE 
            WHEN f.fecha_entrega >= :antInicio
             AND f.fecha_entrega <  :antFin
            THEN d.total ELSE 0 
          END
        ) AS consumo_anterior
      FROM facturas f
      JOIN detalle_documento d
        ON d.documento_code = f.code
      WHERE f.seller_code = :ruta
        AND f.status IN ('2','4','5')
        AND d.codigo_categoria = '5'
      GROUP BY f.customer_code;
    `;

    const consumoData = await db.query(consumoSQL, {
      replacements: {
        ruta: rutaUpper,
        inicio: fInicio,
        fin: fFin,
        antInicio,
        antFin,
      },
      type: db.QueryTypes.SELECT,
    });

    /* ========================================================
       4️⃣ PRODUCTOS VENDIDOS
    ======================================================== */
    const productosVendidosSQL = `
      SELECT
        d.descripcion AS producto,
        SUM(d.cantidad) AS unidades_vendidas,
        SUM(d.total)    AS monto_usd
      FROM facturas f
      JOIN detalle_documento d
        ON d.documento_code = f.code
      WHERE f.seller_code = :ruta
        AND f.status IN ('2','4','5')
        AND d.codigo_categoria = '5'
        AND f.fecha_entrega >= :inicio
        AND f.fecha_entrega <  :fin
      GROUP BY d.descripcion
      ORDER BY unidades_vendidas DESC;
    `;

    const productosVendidos = await db.query(productosVendidosSQL, {
      replacements: { ruta: rutaUpper, inicio: fInicio, fin: fFin },
      type: db.QueryTypes.SELECT,
    });

    /* ========================================================
       5️⃣ CANTIDAD BOTELLONES POR CLIENTE
    ======================================================== */
    const cantidadPorClienteSQL = `
      SELECT
        f.customer_code,
        SUM(d.cantidad) AS unidades_botellon
      FROM facturas f
      JOIN detalle_documento d
        ON d.documento_code = f.code
      WHERE f.seller_code = :ruta
        AND f.status IN ('2','4','5')
        AND d.codigo_categoria = '5'
        AND f.fecha_entrega >= :inicio
        AND f.fecha_entrega <  :fin
      GROUP BY f.customer_code;
    `;

    const cantidadPorCliente = await db.query(cantidadPorClienteSQL, {
      replacements: { ruta: rutaUpper, inicio: fInicio, fin: fFin },
      type: db.QueryTypes.SELECT,
    });

    const mapCantidad = new Map(
      cantidadPorCliente.map((c) => [
        c.customer_code,
        Number(c.unidades_botellon || 0),
      ])
    );

    /* ========================================================
       6️⃣ ÚLTIMA VISITA / FACTURA
    ======================================================== */
    const ultimasVisitas = await db.query(
      `SELECT customer_code, MAX(fecha_entrega) AS ultima_visita FROM facturas GROUP BY customer_code;`,
      { type: db.QueryTypes.SELECT }
    );

    const ultimasFacturas = await db.query(
      `SELECT customer_code, MAX(COALESCE(fecha_autorizacion, fecha_entrega, fecha_creacion)) AS ultima_factura FROM facturas GROUP BY customer_code;`,
      { type: db.QueryTypes.SELECT }
    );

    const mapUltimaVisita = new Map(
      ultimasVisitas.map((v) => [v.customer_code, v.ultima_visita])
    );
    const mapUltimaFactura = new Map(
      ultimasFacturas.map((v) => [v.customer_code, v.ultima_factura])
    );

    /* ========================================================
       7️⃣ ARMADO FINAL
    ======================================================== */
    const clientesRutaFinal = clientesRuta.map((c) => {
      const consumo =
        consumoData.find((x) => x.customer_code === c.codigo_cliente) || {};

      const actual = Number(consumo.consumo_actual || 0);
      const anterior = Number(consumo.consumo_anterior || 0);

      const variacionAbs = actual - anterior;

      let variacionPorc = 0;
      if (anterior > 0) {
        variacionPorc = (variacionAbs / anterior) * 100;
      } else if (actual > 0) {
        variacionPorc = 100;
      }

    return {
        codigo_cliente: c.codigo_cliente,
        nombre_cliente: c.nombre_cliente,
        direccion_cliente: c.direccion_cliente,
        telefono_direccion_cliente: c.telefono_direccion_cliente,
        latitud_direccion_cliente: c.latitud_direccion_cliente,  // Latitud
        longitud_direccion_cliente: c.longitud_direccion_cliente,  // Longitud
        codigo_direccion_cliente: c.codigo_direccion_cliente,  // Código dirección
        ultima_visita: formatFecha(
          mapUltimaVisita.get(c.codigo_cliente)
        ),
        ultima_factura: formatFecha(
          mapUltimaFactura.get(c.codigo_cliente)
        ),

        consumo_actual: actual.toFixed(2),

        vsMesAnterior: {
          monto_anterior: Number(anterior.toFixed(2)),
          variacion_abs: Number(variacionAbs.toFixed(2)),
          variacion_porc: `${variacionPorc.toFixed(2)}%`,
        },

        tuvo_consumo: clientesConConsumo.has(c.codigo_cliente)
          ? "Sí"
          : "No",

        cantidad_botellon: mapCantidad.get(c.codigo_cliente) || 0,
      };
    });

    return res.json({
      ruta: rutaUpper,
      anio: anioNum,
      mes: mesNum,
      rangoFechas: { inicio: fInicio, fin: fFin },
      resumenClientes: {
        totalClientesRuta: clientesRuta.length,
        clientesConConsumo: clientesConConsumo.size,
        clientesSinConsumo: clientesRuta.length - clientesConConsumo.size,
      },
      productosVendidos,
      clientesRuta: clientesRutaFinal,
    });
  } catch (error) {
    console.error("❌ [detalleBotellon] Error:", error);
    return res.status(500).json({
      error: "Error al obtener detalle de ruta botellón",
      detalle: error.message,
    });
  }
};

module.exports = {
  obtenerDetalleRuta,
};
