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
  if (mesNum === 1) {
    anioNum--;
    mesNum = 12;
  } else {
    mesNum--;
  }
  const inicio = new Date(Date.UTC(anioNum, mesNum - 1, 1));
  const fin = new Date(Date.UTC(anioNum, mesNum, 1));
  return {
    inicio: inicio.toISOString().replace("T", " ").substring(0, 19),
    fin: fin.toISOString().replace("T", " ").substring(0, 19),
  };
}


// ========================================================
//  CONTROLADOR PRINCIPAL
// ========================================================
const obtenerDetalleRuta = async (req, res) => {

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

    // ============================================================
    //  FECHAS
    // ============================================================
    const { fInicio, fFin } = obtenerRangoFechasPG(anioNum, mesNum);
    const { inicio: antInicio, fin: antFin } = obtenerRangoMesAnterior(anioNum, mesNum);

    console.log("📅 Rango actual:", fInicio, "→", fFin);
    console.log("📅 Rango mes anterior:", antInicio, "→", antFin);

    // ============================================================
    // NORMALIZAR RUTA (se mantiene para identificar la página en el frontend)
    // ============================================================
    const rutaOriginal = ruta?.trim();
    const rutaUpper = rutaOriginal?.toLowerCase() === "h3"
      ? "h3"
      : rutaOriginal?.toUpperCase();

    console.log("🔎 Ruta normalizada:", rutaUpper);

    const fechaInicioAnio = `${anioNum}-01-01 00:00:00`;
    const fechaFinAnio    = `${anioNum + 1}-01-01 00:00:00`;

    const meses = [
      "Enero", "Febrero", "Marzo", "Abril",
      "Mayo", "Junio", "Julio", "Agosto",
      "Septiembre", "Octubre", "Noviembre", "Diciembre"
    ];

    // ============================================================
    // 1) CLIENTES ASIGNADOS A RUTAS H* (todos)
    // ============================================================
    const clientesRutaSQL = `
      SELECT DISTINCT ON (cuv.codigo_cliente)
        cuv.codigo_cliente,
        cv.nombre_cliente,
        cv.codigo_tipo_negocio,
        tn.descripcion AS tipo_negocio,
        dc.codigo_direccion_cliente,
        dc.descripcion_direccion_cliente AS direccion_cliente,
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
      WHERE (cuv.seller_code ILIKE 'H%' OR TRIM(cuv.seller_code) IN ('10', 'h3'))
      ORDER BY cuv.codigo_cliente, dc.fecha_creacion_direccion_cliente DESC;
    `;

    const clientesRuta = await db.query(clientesRutaSQL, {
      type: db.QueryTypes.SELECT,
    });

    console.log("👥 Total clientes H*:", clientesRuta.length);

    // ============================================================
    // 2) CLIENTES CON CONSUMO EN EL MES
    // ============================================================
    const clientesConConsumoSQL = `
      SELECT DISTINCT o.customer_code
      FROM facturas o
      JOIN detalle_documento dd
        ON dd.documento_code = o.code
      WHERE
        (o.seller_code ILIKE 'H%' OR o.seller_code IN ('10', 'h3'))
        AND o.status IN ('2', '4', '5')
        AND o.fecha_entrega >= :inicio
        AND o.fecha_entrega < :fin
    `;

    const clientesConConsumoRows = await db.query(clientesConConsumoSQL, {
      replacements: { inicio: fInicio, fin: fFin },
    });

    const clientesConConsumo = new Set(
      clientesConConsumoRows[0].map((c) => c.customer_code)
    );

    console.log("✅ Clientes con consumo:", clientesConConsumo.size);

    // ============================================================
    // 3) CONSUMO ACTUAL Y ANTERIOR POR CLIENTE
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
      WHERE (f.seller_code ILIKE 'H%' OR f.seller_code IN ('10', 'h3'))
        AND f.status IN ('0','2','4','5')
      GROUP BY f.customer_code
    `;

    const clientesConsumoData = await db.query(clientesConsumoDataSQL, {
      replacements: { inicio: fInicio, fin: fFin, antInicio, antFin },
      type: db.QueryTypes.SELECT,
    });

    // ============================================================
    // CONSUMO MÁXIMO ANUAL
    // ============================================================
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
          (f.seller_code ILIKE 'H%' OR f.seller_code IN ('10', 'h3'))
          AND f.status IN ('0','2','4','5')
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
      replacements: { inicioAnio: fechaInicioAnio, finAnio: fechaFinAnio },
      type: db.QueryTypes.SELECT,
    });

    const mapMaxConsumoAnual = new Map(
      consumoMaximoAnual.map(c => [
        c.customer_code,
        { monto: Number(c.consumo_mes) || 0, mes: c.mes }
      ])
    );

    // ============================================================
    // 4) PRODUCTOS VENDIDOS EN EL MES (resumen general)
    // ============================================================
    const productosVendidosSQL = `
      SELECT
        dd.descripcion AS producto,
        SUM(dd.cantidad) AS unidades_vendidas,
        SUM(dd.total) AS monto_usd
      FROM facturas o
      JOIN detalle_documento dd
        ON dd.documento_code = o.code
      WHERE
        (o.seller_code ILIKE 'H%' OR o.seller_code IN ('10', 'h3'))
        AND o.status IN ('2', '4', '5')
        AND o.fecha_entrega >= :inicio
        AND o.fecha_entrega <  :fin
        AND dd.codigo_categoria = '40'
      GROUP BY dd.descripcion
      ORDER BY unidades_vendidas DESC;
    `;

    const productosVendidos = await db.query(productosVendidosSQL, {
      replacements: { inicio: fInicio, fin: fFin },
      type: db.QueryTypes.SELECT,
    });

    // ============================================================
    // PRODUCTOS VENDIDOS POR CLIENTE EN EL MES
    // ============================================================
    const productosVendidosSQLCantidad = `
      SELECT
        f.customer_code,
        dd.descripcion AS producto,
        SUM(dd.cantidad) AS unidades_vendidas_cliente
      FROM facturas f
      JOIN detalle_documento dd
        ON dd.documento_code = f.code
      WHERE
        (f.seller_code ILIKE 'H%' OR f.seller_code IN ('10', 'h3'))
        AND f.status IN ('0','2','4','5')
        AND f.fecha_entrega >= :inicio
        AND f.fecha_entrega < :fin
      GROUP BY f.customer_code, dd.descripcion
      HAVING SUM(dd.cantidad) > 0
      ORDER BY unidades_vendidas_cliente DESC;
    `;

    const productosVendidosCantidad = await db.query(productosVendidosSQLCantidad, {
      replacements: { inicio: fInicio, fin: fFin },
      type: db.QueryTypes.SELECT,
    });

    // ============================================================
    // 5) ÚLTIMA VISITA GLOBAL
    // ============================================================
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

    const mapUltimaVisita = new Map(
      ultimasVisitas.map((v) => [v.customer_code, v.ultima_visita])
    );

    // ============================================================
    // 6) ÚLTIMA FACTURA GLOBAL
    // ============================================================
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

    const mapUltimaFactura = new Map(
      ultimasFacturas.map((v) => [v.customer_code, v.ultima_factura])
    );

    // ============================================================
    // 7) UNIFICAR CLIENTES CON DETALLES
    // ============================================================
    const clienteProductosVendidos = new Map();

    productosVendidosCantidad.forEach((producto) => {
      const cantidadVendida = parseFloat(producto.unidades_vendidas_cliente) || 0;
      if (!clienteProductosVendidos.has(producto.customer_code)) {
        clienteProductosVendidos.set(producto.customer_code, 0);
      }
      clienteProductosVendidos.set(
        producto.customer_code,
        clienteProductosVendidos.get(producto.customer_code) + cantidadVendida
      );
    });

    const clientesRutaConDetalles = clientesRuta.map((cliente) => {
      const consumoData = clientesConsumoData.find(
        (c) => c.customer_code === cliente.codigo_cliente
      ) || {};

      const consumoActual   = Number(consumoData.consumo_actual)   || 0;
      const consumoAnterior = Number(consumoData.consumo_anterior) || 0;
      const variacionAbs    = consumoActual - consumoAnterior;

      let variacionPorc = 0;
      if (consumoAnterior > 0) {
        variacionPorc = (variacionAbs / consumoAnterior) * 100;
      } else if (consumoActual > 0) {
        variacionPorc = 100;
      }

      let cantidadProductosVendidos = Number(
        clienteProductosVendidos.get(cliente.codigo_cliente) || 0
      );
      if (isNaN(cantidadProductosVendidos)) cantidadProductosVendidos = 0;

      const maxData = mapMaxConsumoAnual.get(cliente.codigo_cliente) || {
        monto: 0,
        mes: null,
      };

      const mesNumero = maxData.mes ? new Date(maxData.mes).getUTCMonth() : null;
      const mesNombre = mesNumero !== null ? meses[mesNumero] : null;

      return {
        codigo_cliente:                cliente.codigo_cliente,
        nombre_cliente:                cliente.nombre_cliente,
        descripcion_direccion_cliente: cliente.direccion_cliente,
        direccion_entrega:             cliente.direccion_cliente,
        codigo_tipo_negocio:           cliente.codigo_tipo_negocio || null,
        tipo_negocio:                  cliente.tipo_negocio || "SIN CLASIFICAR",
        telefono_cliente:              cliente.telefono_direccion_cliente,
        latitud_cliente:               cliente.latitud_direccion_cliente,
        longitud_cliente:              cliente.longitud_direccion_cliente,
        seller_code:                   cliente.seller_code,
        ultima_visita:    formatFecha(mapUltimaVisita.get(cliente.codigo_cliente)),
        ultima_factura:   formatFecha(mapUltimaFactura.get(cliente.codigo_cliente)),
        consumo_actual:   consumoActual.toFixed(2),
        tuvo_consumo:     clientesConConsumo.has(cliente.codigo_cliente) ? 'Sí' : 'No',
        cantidad_productos: cantidadProductosVendidos,
        max_consumo:      maxData.monto.toFixed(2),
        mes_max_consumo:  mesNumero !== null ? mesNumero + 1 : null,
        mes_max_consumo_nombre: mesNombre,
        vsMesAnterior: {
          monto_anterior: consumoAnterior.toFixed(2),
          variacion_abs:  variacionAbs.toFixed(2),
          variacion_porc: `${variacionPorc.toFixed(2)}%`,
        },
      };
    });

    const totalClientesRuta = clientesRuta.length;
    const totalSin          = clientesRuta.length - clientesConConsumo.size;

    // ============================================================
    // DISTRINTER (ORDENES) — campania_id=5
    // ============================================================
    const distrinterVentasSQL = `
      SELECT
        SUM(dd.total)                    AS total_ventas,
        SUM(dd.cantidad)                 AS total_unidades,
        COUNT(DISTINCT o.code)           AS total_ordenes,
        COUNT(DISTINCT o.customer_code)  AS total_clientes
      FROM ordenes o
      JOIN detalle_documento dd ON dd.documento_code = o.code
      WHERE o.campania_id = 5
        AND o.fecha_creacion >= :inicio
        AND o.fecha_creacion <  :fin
        AND o.status IN (2)
    `;

    const distrinter = await db.query(distrinterVentasSQL, {
      replacements: { inicio: fInicio, fin: fFin },
      type: db.QueryTypes.SELECT,
    });

    const dist = distrinter[0] || {};
    const dist_total_ventas   = Number(dist.total_ventas)   || 0;
    const dist_total_unidades = Number(dist.total_unidades) || 0;
    const dist_total_ordenes  = Number(dist.total_ordenes)  || 0;
    const dist_total_clientes = Number(dist.total_clientes) || 0;

    // ============================================================
    // MOBILVENDOR (FACTURAS) — todos los H*, fecha_creacion, status 2
    // ============================================================
    const movilVendorVentasSQL = `
      SELECT
        CASE
          WHEN f.seller_code ILIKE 'H%' THEN SPLIT_PART(REPLACE(f.seller_code, ' ', ''), '-', 1)
          ELSE f.seller_code
        END AS usuario,
        SUM(dd.cantidad)                  AS cantidad,
        SUM(dd.total)                     AS total,
        COUNT(DISTINCT f.code)            AS total_facturas,
        COUNT(DISTINCT f.customer_code)   AS total_clientes
      FROM facturas f
      LEFT JOIN detalle_documento dd ON f.code = dd.documento_code
      WHERE
        (f.seller_code ILIKE 'H%' OR f.seller_code IN ('10', 'h3'))
        AND f.status IN ('2')
        AND f.fecha_creacion >= :inicio
        AND f.fecha_creacion <  :fin
      GROUP BY usuario
    `;

    const movilvendor = await db.query(movilVendorVentasSQL, {
      replacements: { inicio: fInicio, fin: fFin },
      type: db.QueryTypes.SELECT,
    });

    const mob_total_ventas   = movilvendor.reduce((s, r) => s + (Number(r.total)          || 0), 0);
    const mob_total_unidades = movilvendor.reduce((s, r) => s + (Number(r.cantidad)        || 0), 0);
    const mob_total_facturas = movilvendor.reduce((s, r) => s + (Number(r.total_facturas)  || 0), 0);
    const mob_total_clientes = movilvendor.reduce((s, r) => s + (Number(r.total_clientes)  || 0), 0);

    // ============================================================
    // SUMA FINAL PARA DASHBOARD
    // ============================================================
    const total_ventas   = mob_total_ventas   + dist_total_ventas;
    const total_unidades = mob_total_unidades + dist_total_unidades;
    const total_ordenes  = dist_total_ordenes;
    const total_facturas = mob_total_facturas;
    const total_clientes = mob_total_clientes + dist_total_clientes;

    return res.json({
      ruta: rutaUpper,
      anio: anioNum,
      mes:  mesNum,
      rangoFechas: { inicio: fInicio, fin: fFin },
      resumenClientes: {
        totalClientesRuta,
        clientesConConsumo: totalClientesRuta - totalSin,
        clientesSinConsumo: totalSin,
      },
      productosVendidos,
      clientesRuta: clientesRutaConDetalles,
      dashboardKPI: {
        total_ventas,
        total_unidades,
        total_ordenes,
        total_facturas,
        total_clientes,
        detalle: {
          mobilvendor: {
            total_ventas:   mob_total_ventas,
            total_unidades: mob_total_unidades,
            total_facturas: mob_total_facturas,
            total_clientes: mob_total_clientes,
          },
          distrinter: {
            total_ventas:   dist_total_ventas,
            total_unidades: dist_total_unidades,
            total_ordenes:  dist_total_ordenes,
            total_clientes: dist_total_clientes,
          },
        },
      },
    });

  } catch (error) {
    console.error("❌ [detalleHielo] ERROR EN DETALLE RUTA:", error);
    return res.status(500).json({
      error: "Error al obtener detalle de ruta",
      detalle: error.message,
    });
  }
};


module.exports = {
  obtenerDetalleRuta,
};