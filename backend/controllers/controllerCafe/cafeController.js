// controllers/controllerCafe/cafeController.js
// Ventas de CAFÉ — Empresa IIBC S.A.
// Fuente única: Pedidos de Venta (sale.order) de Odoo
//   ordenes.campania_id = 4   (IIBC S.A.)
//   ordenes.status      = 2   (sale / done)
// Esto replica el reporte "Análisis de ventas → Pedidos de ventas" de Odoo.

const Sequelize = require("sequelize");
const { sequelize } = require("../../models");
const { getDiasHabilesTranscurridos, getDiasLaborablesMes } = require("../../utils/diasFestivos");

// ================================================================
// HELPERS DE FECHA
// ================================================================
function getFechaInicioMes(anio, mes) {
  return `${anio}-${String(mes).padStart(2, "0")}-01 00:00:00`;
}

function getFechaFinMes(anio, mes) {
  let mesFin = mes + 1, anioFin = anio;
  if (mesFin === 13) { mesFin = 1; anioFin++; }
  return `${anioFin}-${String(mesFin).padStart(2, "0")}-01 00:00:00`;
}

const getFechaFinQuery = (anio, mes) => getFechaFinMes(anio, mes);

// ================================================================
// QUERY TOTALES CAFÉ — Pedidos de Venta Odoo (IIBC, campania_id=4)
// ================================================================
const queryTotalesCafe = async (inicio, fin) => {
  const [row] = await sequelize.query(
    `SELECT
       SUM(dd.cantidad)                  AS unidades,
       SUM(dd.total)                     AS dolares,
       COUNT(DISTINCT o.code)            AS cant_facturas,
       COUNT(DISTINCT o.customer_code)   AS cant_clientes
     FROM ordenes o
     JOIN detalle_documento dd ON dd.documento_code = o.code
     WHERE o.campania_id = 4
       AND o.status = 2
       AND o.fecha_creacion >= :inicio
       AND o.fecha_creacion <  :fin`,
    { replacements: { inicio, fin }, type: Sequelize.QueryTypes.SELECT }
  );
  return {
    unidades:     Number(row?.unidades     || 0),
    dolares:      Number(row?.dolares      || 0),
    cant_facturas:Number(row?.cant_facturas|| 0),
    cant_clientes:Number(row?.cant_clientes|| 0),
  };
};

// ================================================================
// QUERY VENTAS POR CANAL / EQUIPO DE VENTAS
// Café no maneja rutas, sólo equipos: Website / Point of Sale.
// ================================================================
const queryVentasPorRuta = async (inicio, fin) => {
  return sequelize.query(`
    SELECT
      COALESCE(o.equipo_ventas, o.seller_nombre, 'SIN CANAL') AS ruta,
      SUM(dd.cantidad)                AS unidades,
      SUM(dd.total)                   AS dolares,
      COUNT(DISTINCT o.code)          AS cant_facturas,
      COUNT(DISTINCT o.customer_code) AS cant_clientes
    FROM ordenes o
    JOIN detalle_documento dd ON dd.documento_code = o.code
    WHERE o.campania_id = 4
      AND o.status = 2
      AND o.fecha_creacion >= :inicio
      AND o.fecha_creacion <  :fin
    GROUP BY COALESCE(o.equipo_ventas, o.seller_nombre, 'SIN CANAL')
    ORDER BY dolares DESC
  `, { replacements: { inicio, fin }, type: Sequelize.QueryTypes.SELECT });
};

// ================================================================
// TENDENCIA 6 MESES CAFÉ
// ================================================================
const tendencia6MesesCafe = async (anioNum, mesNum) => {
  const NOMBRES = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
  let mesInicio = mesNum - 11, anioInicio = anioNum;
  while (mesInicio <= 0) { mesInicio += 12; anioInicio--; }
  const inicio6 = getFechaInicioMes(anioInicio, mesInicio);
  let mesFin = mesNum + 1, anioFin = anioNum;
  if (mesFin === 13) { mesFin = 1; anioFin++; }
  const fin6 = `${anioFin}-${String(mesFin).padStart(2,'0')}-01 00:00:00`;

  const rows = await sequelize.query(`
    SELECT DATE_TRUNC('month', o.fecha_creacion) AS mes_periodo,
           SUM(dd.total)    AS dolares,
           SUM(dd.cantidad) AS unidades
    FROM ordenes o
    JOIN detalle_documento dd ON dd.documento_code = o.code
    WHERE o.campania_id = 4
      AND o.status = 2
      AND o.fecha_creacion >= :inicio6
      AND o.fecha_creacion <  :fin6
    GROUP BY DATE_TRUNC('month', o.fecha_creacion)
    ORDER BY mes_periodo
  `, { replacements: { inicio6, fin6 }, type: Sequelize.QueryTypes.SELECT });

  const hoy = new Date();
  return rows.map(r => {
    const d        = new Date(r.mes_periodo);
    const mes      = d.getMonth() + 1;
    const anio     = d.getFullYear();
    const dolares  = Number(Number(r.dolares  || 0).toFixed(2));
    const unidades = Number(r.unidades || 0);
    const esCurrent = anio === hoy.getFullYear() && mes === hoy.getMonth() + 1;
    const diasT = esCurrent ? getDiasHabilesTranscurridos(anio, mes) : 0;
    const diasL = esCurrent ? getDiasLaborablesMes(anio, mes) : 0;
    const proyeccion = esCurrent && diasT > 0
      ? Number(((dolares / diasT) * diasL).toFixed(2))
      : dolares;
    return { label: NOMBRES[d.getMonth()], anio, mes, dolares, unidades, proyeccion };
  });
};

// ================================================================
// ENDPOINT PRINCIPAL — GET /api/cafe/dashboard?anio=YYYY&mes=MM
// ================================================================
const obtenerDashboardCafe = async (req, res) => {
  try {
    const { anio, mes } = req.query;
    if (!anio || !mes)
      return res.status(400).json({ error: "Debe enviar ?anio=YYYY&mes=MM" });

    const anioNum = parseInt(anio, 10);
    const mesNum  = parseInt(mes,  10);
    if (isNaN(anioNum) || isNaN(mesNum) || mesNum < 1 || mesNum > 12)
      return res.status(400).json({ error: "Parámetros anio/mes inválidos." });

    const hoy = new Date();
    const esMesActual = anioNum === hoy.getFullYear() && mesNum === hoy.getMonth() + 1;

    const inicio    = getFechaInicioMes(anioNum, mesNum);
    const finFull   = getFechaFinMes(anioNum, mesNum);
    const finHoy    = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}-${String(hoy.getDate()).padStart(2, '0')} 00:00:00`;
    const fin       = esMesActual ? finHoy : finFull;

    let mesPrev = mesNum - 1, anioPrev = anioNum;
    if (mesPrev === 0) { mesPrev = 12; anioPrev--; }
    const inicioPrev = getFechaInicioMes(anioPrev, mesPrev);
    const finPrev    = getFechaFinMes(anioPrev, mesPrev);

    const diasTranscurridos = getDiasHabilesTranscurridos(anioNum, mesNum);
    const diasLaborablesMes = getDiasLaborablesMes(anioNum, mesNum);

    const [actual, anterior, rutasActual, tendencia6Meses] = await Promise.all([
      queryTotalesCafe(inicio, fin),
      queryTotalesCafe(inicioPrev, finPrev),
      queryVentasPorRuta(inicio, fin),
      tendencia6MesesCafe(anioNum, mesNum),
    ]);

    const proyeccionDolares = esMesActual && diasTranscurridos > 0
      ? (actual.dolares  / diasTranscurridos) * diasLaborablesMes
      : actual.dolares;

    const proyeccionUnidades = esMesActual && diasTranscurridos > 0
      ? (actual.unidades / diasTranscurridos) * diasLaborablesMes
      : actual.unidades;

    // Variación: proyección vs mes anterior (no valor real vs mes anterior)
    const varDolaresAbs  = proyeccionDolares  - anterior.dolares;
    const varDolaresPorc = anterior.dolares > 0
      ? (varDolaresAbs / anterior.dolares) * 100
      : null;

    const varUnidadesAbs  = proyeccionUnidades - anterior.unidades;
    const varUnidadesPorc = anterior.unidades > 0
      ? (varUnidadesAbs / anterior.unidades) * 100
      : null;

    const rutas = rutasActual.map(r => ({
      ruta:          r.ruta,
      unidades:      Number(r.unidades)      || 0,
      dolares:       Number(Number(r.dolares).toFixed(2)),
      cant_facturas: Number(r.cant_facturas) || 0,
      cant_clientes: Number(r.cant_clientes) || 0,
    }));

    return res.status(200).json({
      periodo: { anio: anioNum, mes: mesNum, esMesActual },
      fechas:  { inicio, fin, inicioPrev, finPrev },
      dias:    { transcurridos: diasTranscurridos, laborables: diasLaborablesMes },
      totales: {
        unidades:            actual.unidades,
        dolares:             Number(actual.dolares.toFixed(2)),
        proyeccion_unidades: Number(proyeccionUnidades.toFixed(0)),
        proyeccion_dolares:  Number(proyeccionDolares.toFixed(2)),
        cant_facturas:       actual.cant_facturas,
        cant_clientes:       actual.cant_clientes,
        mes_anterior: {
          unidades: anterior.unidades,
          dolares:  Number(anterior.dolares.toFixed(2)),
        },
        variacion_dolares: {
          abs:        Number(varDolaresAbs.toFixed(2)),
          porcentaje: varDolaresPorc !== null ? Number(varDolaresPorc.toFixed(2)) : null,
        },
        variacion_unidades: {
          abs:        Number(varUnidadesAbs.toFixed(0)),
          porcentaje: varUnidadesPorc !== null ? Number(varUnidadesPorc.toFixed(2)) : null,
        },
      },
      rutas,
      tendencia6Meses,
    });

  } catch (error) {
    console.error("❌ ERROR dashboard café:", error);
    return res.status(500).json({ message: "Error al obtener datos café", detalle: error.message });
  }
};

// ================================================================
// ENDPOINT CLIENTES — GET /api/cafe/clientes?anio=YYYY&mes=MM
// Fuente: ordenes (Odoo sale.order) campania_id=4 status=2
// ================================================================
const obtenerClientesCafe = async (req, res) => {
  try {
    const { anio, mes } = req.query;
    if (!anio || !mes)
      return res.status(400).json({ error: "Debe enviar ?anio=YYYY&mes=MM" });

    const anioNum = parseInt(anio, 10);
    const mesNum  = parseInt(mes,  10);
    if (isNaN(anioNum) || isNaN(mesNum) || mesNum < 1 || mesNum > 12)
      return res.status(400).json({ error: "Parámetros inválidos" });

    const inicio    = getFechaInicioMes(anioNum, mesNum);
    const fin       = await getFechaFinQuery(anioNum, mesNum);

    let mesPrev = mesNum - 1, anioPrev = anioNum;
    if (mesPrev === 0) { mesPrev = 12; anioPrev--; }
    const antInicio = getFechaInicioMes(anioPrev, mesPrev);
    const antFin    = getFechaFinMes(anioPrev, mesPrev);

    const inicioAnio = `${anioNum}-01-01 00:00:00`;
    const finAnio    = `${anioNum + 1}-01-01 00:00:00`;

    const R = { inicio, fin, antInicio, antFin, inicioAnio, finAnio };

    // customer_address_code es INTEGER en ordenes → cast a TEXT para
    // empatar con direcciones_clientes.codigo_direccion_cliente.
    // ── 1. Clientes únicos del año ────────────────────────────────
    const clientesSQL = `
      SELECT DISTINCT ON (o.customer_code, o.customer_address_code)
        o.customer_code,
        o.customer_address_code::TEXT                              AS customer_address_code,
        c.nombre_cliente,
        tn.descripcion                                              AS tipo_negocio,
        dc.descripcion_direccion_cliente                           AS nombre_sucursal,
        COALESCE(dc.calle1_direccion_cliente, c.direccion_cliente) AS direccion_entrega,
        COALESCE(dc.telefono_direccion_cliente, c.telefono_cliente)AS telefono_cliente,
        dc.latitud_direccion_cliente                               AS latitud_cliente,
        dc.longitud_direccion_cliente                              AS longitud_cliente
      FROM ordenes o
      LEFT JOIN clientes c              ON c.codigo_cliente = o.customer_code
      LEFT JOIN tipos_negocio tn        ON tn.codigo = c.codigo_tipo_negocio
      LEFT JOIN direcciones_clientes dc ON dc.codigo_direccion_cliente::TEXT = o.customer_address_code::TEXT
      WHERE o.campania_id = 4
        AND o.status = 2
        AND o.fecha_creacion >= :inicioAnio
        AND o.fecha_creacion <  :finAnio
      ORDER BY o.customer_code, o.customer_address_code, c.nombre_cliente
    `;

    // ── 2. Consumo actual / anterior ──────────────────────────────
    const consumoSQL = `
      SELECT o.customer_code, o.customer_address_code::TEXT AS customer_address_code,
        SUM(CASE WHEN o.fecha_creacion >= :inicio    AND o.fecha_creacion < :fin    THEN dd.total    ELSE 0 END) AS consumo_actual,
        SUM(CASE WHEN o.fecha_creacion >= :antInicio AND o.fecha_creacion < :antFin THEN dd.total    ELSE 0 END) AS consumo_anterior,
        SUM(CASE WHEN o.fecha_creacion >= :inicio    AND o.fecha_creacion < :fin    THEN dd.cantidad ELSE 0 END) AS cantidad_actual
      FROM ordenes o
      JOIN detalle_documento dd ON dd.documento_code = o.code
      WHERE o.campania_id = 4 AND o.status = 2
      GROUP BY o.customer_code, o.customer_address_code
    `;

    // ── 3. Máximo consumo mensual del año ─────────────────────────
    const maxConsumoSQL = `
      WITH cm AS (
        SELECT o.customer_code, o.customer_address_code::TEXT AS customer_address_code,
               DATE_TRUNC('month', o.fecha_creacion) AS mes,
               SUM(dd.total) AS consumo_mes
        FROM ordenes o
        JOIN detalle_documento dd ON dd.documento_code = o.code
        WHERE o.campania_id = 4 AND o.status = 2
          AND o.fecha_creacion >= :inicioAnio AND o.fecha_creacion < :finAnio
        GROUP BY o.customer_code, o.customer_address_code, DATE_TRUNC('month', o.fecha_creacion)
      )
      SELECT DISTINCT ON (customer_code, customer_address_code)
        customer_code, customer_address_code, mes, consumo_mes
      FROM cm
      ORDER BY customer_code, customer_address_code, consumo_mes DESC
    `;

    // ── 4. Última fecha de pedido ─────────────────────────────────
    const ultimaSQL = `
      SELECT customer_code, customer_address_code::TEXT AS customer_address_code,
             MAX(fecha_creacion) AS ultima_factura
      FROM ordenes
      WHERE campania_id = 4 AND status = 2
      GROUP BY customer_code, customer_address_code
    `;

    // ── 5. Productos vendidos ─────────────────────────────────────
    const productosSQL = `
      SELECT dd.descripcion AS producto,
             SUM(dd.cantidad) AS unidades_vendidas,
             SUM(dd.total)    AS monto_usd
      FROM ordenes o
      JOIN detalle_documento dd ON dd.documento_code = o.code
      WHERE o.campania_id = 4 AND o.status = 2
        AND o.fecha_creacion >= :inicio AND o.fecha_creacion < :fin
      GROUP BY dd.descripcion
      ORDER BY unidades_vendidas DESC
    `;

    const [clientes, consumoData, maxConsumoData, ultimaData, productosVendidosRaw] = await Promise.all([
      sequelize.query(clientesSQL,   { replacements: R, type: Sequelize.QueryTypes.SELECT }),
      sequelize.query(consumoSQL,    { replacements: R, type: Sequelize.QueryTypes.SELECT }),
      sequelize.query(maxConsumoSQL, { replacements: R, type: Sequelize.QueryTypes.SELECT }),
      sequelize.query(ultimaSQL,     { replacements: R, type: Sequelize.QueryTypes.SELECT }),
      sequelize.query(productosSQL,  { replacements: R, type: Sequelize.QueryTypes.SELECT }),
    ]);

    // Limpia el código entre corchetes al inicio (ej: "[8056370761357] MUST DG CAPUCCINO X 16" → "MUST DG CAPUCCINO X 16")
    // y consolida líneas duplicadas que queden con el mismo nombre.
    const limpiarNombreProducto = (n) => (n ? n.replace(/^\[[^\]]+\]\s*/, '').trim() : '');
    const productosMap = new Map();
    for (const p of productosVendidosRaw) {
      const nombre = limpiarNombreProducto(p.producto);
      if (!productosMap.has(nombre)) {
        productosMap.set(nombre, { producto: nombre, unidades_vendidas: 0, monto_usd: 0 });
      }
      const acc = productosMap.get(nombre);
      acc.unidades_vendidas += Number(p.unidades_vendidas) || 0;
      acc.monto_usd         += Number(p.monto_usd)         || 0;
    }
    const productosVendidos = Array.from(productosMap.values())
      .sort((a, b) => b.unidades_vendidas - a.unidades_vendidas);

    const clave = (r) => `${r.customer_code}__${r.customer_address_code ?? ""}`;

    const mapConsumo    = new Map(consumoData.map(r    => [clave(r), r]));
    const mapMaxConsumo = new Map(maxConsumoData.map(r  => [clave(r), r]));
    const mapUltima     = new Map(ultimaData.map(r      => [clave(r), r.ultima_factura]));

    const fmtFecha = (f) => {
      if (!f) return null;
      const d = new Date(f);
      if (isNaN(d.getTime())) return null;
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    };
    const nombreMes = (fecha) => {
      if (!fecha) return null;
      const M = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];
      return M[new Date(fecha).getMonth()];
    };

    const resultado = clientes.map(c => {
      const k = clave(c);
      const consumo  = mapConsumo.get(k)    || {};
      const maxC     = mapMaxConsumo.get(k) || {};
      const ultFecha = mapUltima.get(k)     || null;

      const consumoActual   = Number(consumo.consumo_actual)   || 0;
      const consumoAnterior = Number(consumo.consumo_anterior) || 0;
      const varAbs  = consumoActual - consumoAnterior;
      const varPorc = consumoAnterior > 0
        ? (varAbs / consumoAnterior) * 100
        : consumoActual > 0 ? 100 : 0;

      return {
        codigo_cliente:         c.customer_code,
        codigo_direccion:       c.customer_address_code || null,
        nombre_cliente:         c.nombre_cliente,
        nombre_sucursal:        c.nombre_sucursal || null,
        direccion_entrega:      c.direccion_entrega,
        tipo_negocio:           c.tipo_negocio || "SIN CLASIFICAR",
        telefono_cliente:       c.telefono_cliente || "—",
        latitud_cliente:        c.latitud_cliente  || "—",
        longitud_cliente:       c.longitud_cliente || "—",
        cantidad_productos:     Number(consumo.cantidad_actual) || 0,
        consumo_actual:         consumoActual.toFixed(2),
        max_consumo:            Number(maxC.consumo_mes || 0).toFixed(2),
        mes_max_consumo_nombre: nombreMes(maxC.mes),
        ultima_factura:         fmtFecha(ultFecha),
        vsMesAnterior: {
          monto_anterior: consumoAnterior.toFixed(2),
          variacion_abs:  varAbs.toFixed(2),
          variacion_porc: `${varPorc.toFixed(2)}%`,
        },
        tuvo_consumo: consumoActual > 0 ? "Sí" : "No",
      };
    });

    const conConsumo     = resultado.filter(r => r.tuvo_consumo === "Sí").length;
    const clientesUnicos = new Set(resultado.map(r => r.codigo_cliente)).size;

    return res.json({
      clientes: resultado,
      resumen: {
        totalClientes:      clientesUnicos,
        totalDirecciones:   resultado.length,
        clientesConConsumo: conConsumo,
        clientesSinConsumo: resultado.length - conConsumo,
      },
      productosVendidos,
    });

  } catch (error) {
    console.error("❌ ERROR CLIENTES CAFÉ:", error);
    return res.status(500).json({ message: "Error al obtener clientes café", detalle: error.message });
  }
};

// ================================================================
// ENDPOINT PRODUCTOS POR SUCURSAL — CAFÉ
// GET /api/cafe/sucursal-productos?anio=YYYY&mes=MM&customerCode=X&addressCode=Y
// Devuelve los productos vendidos a una (cliente, dirección) en el mes.
// ================================================================
const obtenerProductosSucursalCafe = async (req, res) => {
  try {
    const { anio, mes, customerCode, addressCode } = req.query;
    if (!anio || !mes || !customerCode)
      return res.status(400).json({ ok: false, error: "Faltan parámetros" });

    const anioNum = parseInt(anio, 10);
    const mesNum  = parseInt(mes,  10);
    if (isNaN(anioNum) || isNaN(mesNum) || mesNum < 1 || mesNum > 12)
      return res.status(400).json({ ok: false, error: "Parámetros inválidos" });

    const inicio = getFechaInicioMes(anioNum, mesNum);
    const fin    = getFechaFinMes(anioNum, mesNum);

    const addrFilter = addressCode ? `AND o.customer_address_code::TEXT = :addressCode` : '';

    const sql = `
      SELECT dd.descripcion AS producto,
             SUM(dd.cantidad) AS unidades_vendidas,
             SUM(dd.total)    AS monto_usd
      FROM ordenes o
      JOIN detalle_documento dd ON dd.documento_code = o.code
      WHERE o.campania_id = 4
        AND o.status = 2
        AND o.customer_code = :customerCode
        ${addrFilter}
        AND o.fecha_creacion >= :inicio
        AND o.fecha_creacion <  :fin
      GROUP BY dd.descripcion
      ORDER BY unidades_vendidas DESC
    `;

    const filas = await sequelize.query(sql, {
      replacements: { customerCode, addressCode: addressCode || null, inicio, fin },
      type: Sequelize.QueryTypes.SELECT,
    });

    // Limpia el código entre corchetes y consolida líneas con mismo nombre.
    const limpiar = (n) => (n ? n.replace(/^\[[^\]]+\]\s*/, '').trim() : '');
    const map = new Map();
    for (const f of filas) {
      const nombre = limpiar(f.producto);
      if (!map.has(nombre)) {
        map.set(nombre, { producto: nombre, unidades_vendidas: 0, monto_usd: 0 });
      }
      const acc = map.get(nombre);
      acc.unidades_vendidas += Number(f.unidades_vendidas) || 0;
      acc.monto_usd         += Number(f.monto_usd)         || 0;
    }
    const productos = Array.from(map.values())
      .sort((a, b) => b.monto_usd - a.monto_usd);

    return res.json({ ok: true, productos });
  } catch (error) {
    console.error("❌ ERROR productos sucursal café:", error);
    return res.status(500).json({ ok: false, error: error.message });
  }
};

module.exports = { obtenerDashboardCafe, obtenerClientesCafe, obtenerProductosSucursalCafe };
