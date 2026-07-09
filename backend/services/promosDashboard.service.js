// services/promosDashboard.service.js
// ════════════════════════════════════════════════════════════════════════════
// ANALÍTICA DE PROMOCIONES — "promos vendidas por prendedor"
//
// Fuente de verdad: las LÍNEAS DE VENTA reales (detalle_documento), que traen
// promo_code / promo_action_code por línea. La cabecera (facturas type=1 u
// ordenes type=2) aporta el vendedor (seller_code) y la fecha.
//
//   - NO usa users_in_promos (ese schema no lo expone el web-service y, además,
//     describiría inventario ASIGNADO, no lo VENDIDO).
//   - El nombre legible de la promo sale del maestro `promos` (description).
//
// Estas funciones son deterministas y se reutilizan tanto en el dashboard como
// en el chatbot IA, para que las cifras cuadren (filosofía del proyecto).
// ════════════════════════════════════════════════════════════════════════════
"use strict";

const { QueryTypes } = require("sequelize");
const sequelize = require("../db");

// ── Rango de fechas seguro (>= inicio AND < inicio_siguiente) ────────────────
// anio/mes opcionales: si faltan, no se filtra por fecha (histórico completo).
function construirRango(anio, mes) {
  const a = Number(anio);
  const m = Number(mes);
  if (!a || !m || m < 1 || m > 12) return null;
  const inicio = `${a}-${String(m).padStart(2, "0")}-01`;
  const aSig = m === 12 ? a + 1 : a;
  const mSig = m === 12 ? 1 : m + 1;
  const fin = `${aSig}-${String(mSig).padStart(2, "0")}-01`;
  return { inicio, fin };
}

// CTE base: una fila por línea de venta CON promo, con vendedor, fecha y tipo ya
// desnormalizados. Fuente = promo_lineas_venta (la escribe SOLO MobilVendor; Odoo
// NUNCA la toca), para que las promos de las facturas no las pise el sync de Odoo
// —que comparte el número fiscal y antes sobrescribía detalle_documento sin promo.
// El filtro de fecha se inyecta aparte.
function baseLineasCTE(filtroFecha) {
  return `
    WITH lineas AS (
      SELECT
        v.promo_code,
        v.promo_action_code,
        v.descripcion                   AS articulo,
        v.codigo_producto,
        COALESCE(v.cantidad, 0)         AS cantidad,
        COALESCE(v.total, 0)            AS total,
        COALESCE(v.precio, 0)           AS precio,
        COALESCE(v.subtotal, 0)         AS subtotal,
        COALESCE(v.descuento_linea, 0)  AS descuento,
        v.seller_code                   AS seller_code,
        v.fecha                         AS fecha,
        v.documento_code
      FROM promo_lineas_venta v
      WHERE v.promo_code IS NOT NULL
        AND TRIM(v.promo_code) <> ''
        ${filtroFecha}
    )
  `;
}

// Cláusula de fecha reutilizable. Devuelve "" si no hay rango.
function clausulaFecha(rango) {
  return rango ? "AND v.fecha >= :inicio AND v.fecha < :fin" : "";
}

// Cláusula de filtro por vendedor sobre la CTE.
function run(sql, replacements) {
  return sequelize.query(sql, { type: QueryTypes.SELECT, replacements });
}

// ─────────────────────────────────────────────────────────────────────────────
// 1) RANKING GENERAL DE PROMOS (qué promo se vendió más, global)
//    metricas: veces (nº de ventas con la promo), unidades, monto, descuento.
// ─────────────────────────────────────────────────────────────────────────────
async function rankingGeneral({ anio, mes, limit = 50 } = {}) {
  const rango = construirRango(anio, mes);
  const sql = `
    ${baseLineasCTE(clausulaFecha(rango))}
    SELECT
      l.promo_code                                   AS promo_codigo,
      COALESCE(NULLIF(TRIM(p.description), ''), l.promo_code) AS promo_nombre,
      p.type                                         AS tipo,
      p.status                                       AS estado,
      COUNT(DISTINCT l.documento_code)               AS veces,
      COUNT(DISTINCT l.seller_code)                  AS prendedores,
      SUM(l.cantidad)                                AS unidades,
      SUM(l.subtotal)                                AS subtotal,
      SUM(l.total)                                   AS monto,
      SUM(l.descuento)                               AS descuento
    FROM lineas l
    LEFT JOIN promos p ON p.code = l.promo_code
    GROUP BY l.promo_code, p.description, p.type, p.status
    ORDER BY veces DESC, unidades DESC
    LIMIT :limit
  `;
  const rows = await run(sql, { ...(rango || {}), limit: Number(limit) || 50 });
  return rows.map(normalizaPromoRow);
}

// ─────────────────────────────────────────────────────────────────────────────
// 2) RANKING DE PRENDEDORES (quién usa más promociones)
//    Para la vista general "por prendedor" y para construir la lista de drill-down.
// ─────────────────────────────────────────────────────────────────────────────
async function rankingPrendedores({ anio, mes, limit = 100 } = {}) {
  const rango = construirRango(anio, mes);
  const sql = `
    ${baseLineasCTE(clausulaFecha(rango))}
    SELECT
      l.seller_code                       AS prendedor,
      COUNT(DISTINCT l.promo_code)        AS promos_distintas,
      COUNT(DISTINCT l.documento_code)    AS ventas_con_promo,
      SUM(l.cantidad)                     AS unidades,
      SUM(l.subtotal)                     AS subtotal,
      SUM(l.total)                        AS monto,
      SUM(l.descuento)                    AS descuento
    FROM lineas l
    WHERE l.seller_code IS NOT NULL AND TRIM(l.seller_code) <> ''
    GROUP BY l.seller_code
    ORDER BY unidades DESC, ventas_con_promo DESC
    LIMIT :limit
  `;
  const rows = await run(sql, { ...(rango || {}), limit: Number(limit) || 100 });
  return rows.map((r) => ({
    prendedor: r.prendedor,
    promosDistintas: Number(r.promos_distintas) || 0,
    ventasConPromo: Number(r.ventas_con_promo) || 0,
    unidades: Number(r.unidades) || 0,
    subtotal: Number(r.subtotal) || 0, // sin IVA
    monto: Number(r.monto) || 0,       // con IVA
    descuento: Number(r.descuento) || 0,
  }));
}

// ─────────────────────────────────────────────────────────────────────────────
// 3) PROMOS DE UN PRENDEDOR (drill-down: qué vendió ese prendedor)
// ─────────────────────────────────────────────────────────────────────────────
async function promosPorPrendedor({ sellerCode, anio, mes } = {}) {
  if (!sellerCode) throw new Error("sellerCode es obligatorio.");
  const rango = construirRango(anio, mes);
  const sql = `
    ${baseLineasCTE(clausulaFecha(rango))}
    SELECT
      l.promo_code                                   AS promo_codigo,
      COALESCE(NULLIF(TRIM(p.description), ''), l.promo_code) AS promo_nombre,
      COUNT(DISTINCT l.documento_code)               AS veces,
      SUM(l.cantidad)                                AS unidades,
      SUM(l.subtotal)                                AS subtotal,
      SUM(l.total)                                   AS monto,
      SUM(l.descuento)                               AS descuento
    FROM lineas l
    LEFT JOIN promos p ON p.code = l.promo_code
    WHERE l.seller_code = :sellerCode
    GROUP BY l.promo_code, p.description
    ORDER BY veces DESC, unidades DESC
  `;
  const rows = await run(sql, { ...(rango || {}), sellerCode: String(sellerCode) });
  return rows.map(normalizaPromoRow);
}

// ─────────────────────────────────────────────────────────────────────────────
// 4) FICHA DE UNA PROMO (regla + quién la vende + totales)
// ─────────────────────────────────────────────────────────────────────────────
async function detallePromo({ promoCode, anio, mes } = {}) {
  if (!promoCode) throw new Error("promoCode es obligatorio.");
  const rango = construirRango(anio, mes);

  // a) Maestro + reglas (definición de la promo)
  const [definicion] = await run(
    `SELECT code AS promo_codigo, description AS promo_nombre, type AS tipo,
            status AS estado, start_date AS fecha_inicio, end_date AS fecha_fin,
            priority AS prioridad, min_sale AS venta_minima, max_sale AS venta_maxima,
            payment_method AS metodo_pago
       FROM promos WHERE code = :promoCode`,
    { promoCode: String(promoCode) }
  );
  const condiciones = await run(
    `SELECT condition AS condicion, object AS objeto, list AS lista,
            quantity_condition AS condicion_cantidad, quantity1 AS cantidad_desde,
            quantity2 AS cantidad_hasta, amount1 AS monto_desde, amount2 AS monto_hasta
       FROM promo_conditions WHERE promo_code = :promoCode`,
    { promoCode: String(promoCode) }
  );
  const acciones = await run(
    `SELECT action AS accion, discount AS descuento, discount_type AS tipo_descuento,
            price_value AS precio_especial, gift AS regalo, gift_base AS regalo_base,
            articles AS articulos
       FROM promo_actions WHERE promo_code = :promoCode`,
    { promoCode: String(promoCode) }
  );

  // b) Quién la vende y totales (redención real)
  //    Separación "promoción vs sin promoción": el "+1 gratis" viene embebido como
  //    descuento (no como línea a $0). Como los datos NO guardan cuántas unidades fueron
  //    regaladas, se DEDUCE del descuento y se REDONDEA por línea para dar enteros:
  //      gratis (promoción) = ROUND(descuento / precio)   → ej. round(4.39/4.07)=1
  //      pagadas (sin promo) = cantidad − gratis           → ej. 6 − 1 = 5
  //    Líneas 100% gratis (precio=0): toda la cantidad cuenta como promoción.
  //    Dólares = bruto (subtotal+descuento) · Total = neto (subtotal). bruto−desc = neto.
  const sqlVendedores = `
    ${baseLineasCTE(clausulaFecha(rango))}
    SELECT
      l.seller_code                    AS prendedor,
      COUNT(DISTINCT l.documento_code) AS veces,
      SUM(l.cantidad)                  AS unidades,
      SUM(ROUND(CASE WHEN l.precio > 0 THEN l.descuento / l.precio ELSE l.cantidad END)) AS cant_promocion,
      SUM(l.subtotal + l.descuento)    AS dolares,
      SUM(l.descuento)                 AS descuento,
      SUM(l.subtotal)                  AS total
    FROM lineas l
    WHERE l.promo_code = :promoCode
    GROUP BY l.seller_code
    ORDER BY total DESC
  `;
  const porPrendedor = (await run(sqlVendedores, { ...(rango || {}), promoCode: String(promoCode) }))
    .map((r) => {
      const unidades = Math.round(Number(r.unidades) || 0);
      const cantidadPromocion = Math.round(Number(r.cant_promocion) || 0);
      return {
        prendedor: r.prendedor,
        veces: Number(r.veces) || 0,
        unidades,
        cantidadPromocion,
        cantidadSinPromocion: Math.max(0, unidades - cantidadPromocion),
        dolares: Number(r.dolares) || 0,
        descuento: Number(r.descuento) || 0,
        total: Number(r.total) || 0,
      };
    });

  const totales = porPrendedor.reduce(
    (acc, r) => ({
      veces: acc.veces + r.veces,
      unidades: acc.unidades + r.unidades,
      cantidadPromocion: acc.cantidadPromocion + r.cantidadPromocion,
      cantidadSinPromocion: acc.cantidadSinPromocion + r.cantidadSinPromocion,
      dolares: acc.dolares + r.dolares,
      descuento: acc.descuento + r.descuento,
      total: acc.total + r.total,
    }),
    { veces: 0, unidades: 0, cantidadPromocion: 0, cantidadSinPromocion: 0, dolares: 0, descuento: 0, total: 0 }
  );

  return {
    definicion: definicion || { promo_codigo: promoCode, promo_nombre: promoCode },
    condiciones,
    acciones,
    totales,
    porPrendedor,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// 5) REPORTE "PROMOCIONES UTILIZADAS" (réplica del dashboard86 de MobilVendor)
//    Detalle LÍNEA por LÍNEA (no agregado): cada fila = una línea de venta con
//    promo. Filtros: rango de fechas (con hora), promo específica y pestaña.
//
//    NOTA sobre la spec de MobilVendor:
//    - FACTOR no se persiste en el sync actual (no lo expone getInvoices por
//      línea) → se devuelve 1. Capturarlo real es fase 2 (tocar el sync).
//    - DESC. % no se guarda como porcentaje (solo el monto `descuento_linea`) →
//      se calcula = descuento / (precio × cantidad) × 100.
//    - La pestaña "devolucion" (Devolucion_SolicitudDev) no tiene fuente: el sync
//      solo pide type 1 (factura) y 2 (orden). Hasta sincronizar devoluciones se
//      responde vacío con soportado:false para que la UI muestre el empty-state.
// ─────────────────────────────────────────────────────────────────────────────
async function reporteUtilizadas({ inicio, fin, promoCode, tab = "factura_orden" } = {}) {
  if (tab === "devolucion") {
    return { rows: [], totalCantidad: 0, conteo: { factura: 0, orden: 0, total: 0 }, soportado: false };
  }

  // Fuente = promo_lineas_venta (aislada de Odoo). Antes leía detalle_documento
  // + JOIN a facturas/ordenes, que Odoo reescribía → las facturas perdían la promo.
  const where = ["v.promo_code IS NOT NULL", "TRIM(v.promo_code) <> ''"];
  const repl = {};
  if (inicio) { where.push("v.fecha >= :inicio"); repl.inicio = inicio; }
  if (fin)    { where.push("v.fecha <= :fin");    repl.fin = fin; }
  if (promoCode && String(promoCode).trim()) {
    where.push("v.promo_code = :promoCode");
    repl.promoCode = String(promoCode).trim();
  }

  const sql = `
    SELECT
      v.tipo                                              AS tipo,
      v.seller_code                                       AS vendedor,
      v.documento_code                                    AS codigo_doc,
      v.fecha                                             AS fecha,
      v.codigo_producto                                   AS articulo,
      v.descripcion                                       AS descripcion,
      COALESCE(NULLIF(TRIM(v.unidad), ''), 'UNI')         AS unidad,
      COALESCE(v.cantidad, 0)                             AS cantidad,
      COALESCE(v.precio, 0)                               AS precio,
      COALESCE(v.descuento_linea, 0)                      AS descuento,
      v.promo_code                                        AS promo_code,
      v.promo_action_code                                 AS promo_action_code
    FROM promo_lineas_venta v
    WHERE ${where.join(" AND ")}
    ORDER BY v.fecha DESC, v.documento_code, v.id
  `;
  const raw = await run(sql, repl);

  let totalCantidad = 0;
  let cFactura = 0;
  let cOrden = 0;
  const rows = raw.map((r) => {
    const cantidad = Number(r.cantidad) || 0;
    const precio = Number(r.precio) || 0;
    const descuento = Number(r.descuento) || 0;
    const base = precio * cantidad;
    const descPct = base > 0 ? (descuento / base) * 100 : 0;
    totalCantidad += cantidad;
    if (r.tipo === "FACTURA") cFactura++;
    else if (r.tipo === "ORDEN") cOrden++;
    // PROMOCION en formato CODIGO/CODIGO (acción = código de la promo si no hay acción)
    const action = (r.promo_action_code && String(r.promo_action_code).trim()) || r.promo_code;
    return {
      tipo: r.tipo,
      vendedor: r.vendedor,
      codigoDoc: r.codigo_doc,
      fecha: r.fecha,
      articulo: r.articulo,
      descripcion: r.descripcion,
      unidad: r.unidad,
      factor: 1, // MobilVendor no expone el factor por línea en el sync actual
      cantidad,
      descPct: Number(descPct.toFixed(2)),
      promocion: `${r.promo_code}/${action}`,
    };
  });

  return {
    rows,
    totalCantidad: Number(totalCantidad.toFixed(2)),
    conteo: { factura: cFactura, orden: cOrden, total: rows.length },
    soportado: true,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// 6) LISTA DE PROMOS para el dropdown del reporte (todas las vendidas alguna vez)
// ─────────────────────────────────────────────────────────────────────────────
async function listaPromos() {
  const sql = `
    SELECT DISTINCT
      v.promo_code                                            AS codigo,
      COALESCE(NULLIF(TRIM(p.description), ''), v.promo_code) AS nombre
    FROM promo_lineas_venta v
    LEFT JOIN promos p ON p.code = v.promo_code
    WHERE v.promo_code IS NOT NULL AND TRIM(v.promo_code) <> ''
    ORDER BY nombre
  `;
  const rows = await run(sql, {});
  return rows.map((r) => ({ codigo: r.codigo, nombre: r.nombre }));
}

// ── Helper de normalización numérica de una fila de promo ────────────────────
function normalizaPromoRow(r) {
  return {
    promoCodigo: r.promo_codigo,
    promoNombre: r.promo_nombre,
    tipo: r.tipo ?? null,
    estado: r.estado ?? null,
    veces: Number(r.veces) || 0,
    prendedores: r.prendedores != null ? Number(r.prendedores) : undefined,
    unidades: Number(r.unidades) || 0,
    subtotal: Number(r.subtotal) || 0, // sin IVA
    monto: Number(r.monto) || 0,       // con IVA
    descuento: Number(r.descuento) || 0,
  };
}

module.exports = {
  rankingGeneral,
  rankingPrendedores,
  promosPorPrendedor,
  detallePromo,
  reporteUtilizadas,
  listaPromos,
};
