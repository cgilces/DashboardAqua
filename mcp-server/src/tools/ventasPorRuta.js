// src/tools/ventasPorRuta.js
const { z } = require("zod");
const { pool } = require("../db");
const { finExclusivo, diffDias } = require("../util/fechas");
const { FILTRO_PREVENTA_SELLER } = require("../sql/clasificacion");

const RUTA_RE = /^[A-Za-z0-9._-]{1,20}$/;
const MAX_RANGO_DIAS = 400;

// Mismo patrón que FILTRO_PREVENTA_SELLER (o.seller_code ILIKE 'PV%'/'PREVENTA%'/
// 'TELEVENTA%') pero evaluado del lado de JS sobre el valor exacto de `ruta`,
// para decidir qué SQL correr — ver hallazgo en TODO.md ("ventasPorRuta —
// brecha real para rutas de preventa"): antes de este fix, pedir una ruta
// PVR*/PV1-14/PVM/PVQ1/TELEVENTA* daba $0 en silencio (usaba status=2, pero
// las órdenes de PREVENTA reales están en status=5).
const RUTA_PREVENTA_RE = /^(PV|PREVENTA|TELEVENTA)/i;

const inputSchema = {
  ruta: z.string().regex(RUTA_RE, "código de ruta inválido"),
  fecha_inicio: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  fecha_fin: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
};

// SQL: unión ordenes(MobilVendor) + facturas(Odoo, neto de NotCr) + pedido web,
// todo filtrado por la MISMA ruta ($1) — mismo patrón de 3 ramas que
// obtenerGrupoBotellon, generalizado a todas las categorías de producto.
const SQL = `
  WITH base AS (
    SELECT
      dd.descripcion_categoria AS categoria,
      dd.cantidad AS unidades,
      dd.total    AS dolares,
      o.code      AS doc_code
    FROM ordenes o
    JOIN detalle_documento dd ON dd.documento_code = o.code
    WHERE o.status = 2
      AND o.origen_sistema = 'MOBILVENDOR'
      AND o.seller_code = $1
      AND o.fecha_creacion >= $2
      AND o.fecha_creacion <  $3

    UNION ALL

    SELECT
      dd.descripcion_categoria AS categoria,
      CASE WHEN f.tipo_movimiento = 'out_refund' THEN -dd.cantidad ELSE dd.cantidad END AS unidades,
      CASE WHEN f.tipo_movimiento = 'out_refund' THEN -dd.total    ELSE dd.total    END AS dolares,
      f.code AS doc_code
    FROM facturas f
    JOIN detalle_documento dd ON dd.documento_code = f.code
    WHERE f.status = 2
      AND f.seller_code = $1
      AND f.fecha_creacion >= $2
      AND f.fecha_creacion <  $3

    UNION ALL

    -- Pedido web: solo aporta si el pedido web quedó con seller_code = la
    -- ruta consultada (normalmente aplica a rutas DOMICILIO).
    SELECT
      dd.descripcion_categoria AS categoria,
      dd.cantidad AS unidades,
      dd.total    AS dolares,
      o.code      AS doc_code
    FROM ordenes o
    JOIN detalle_documento dd ON dd.documento_code = o.code
    WHERE o.status = 2
      AND o.equipo_ventas = 'Website'
      AND o.seller_code = $1
      AND o.fecha_creacion >= $2
      AND o.fecha_creacion <  $3
  )
  SELECT
    categoria,
    SUM(unidades) AS unidades,
    SUM(dolares)  AS dolares,
    SUM(SUM(unidades)) OVER () AS unidades_totales,
    SUM(SUM(dolares))  OVER () AS dolares_totales,
    (SELECT COUNT(DISTINCT doc_code) FROM base) AS num_documentos
  FROM base
  GROUP BY categoria
  ORDER BY dolares DESC;
`;

// PREVENTA (PV*/PREVENTA*/TELEVENTA*): NO usa `status=2`/`fecha_creacion` como
// el resto de rutas — usa `type=2, status=5, fecha_entrega` (no fecha_creacion)
// y el filtro condicional por categoría de guía (waybill_code para
// DESCARTABLE, waybill_status='3' para el resto), MISMA lógica ya validada
// contra Excel real en ventasPorGrupo/topProductos (ver clasificacion.js).
// Solo `ordenes` — sin rama de facturas ni de pedido web, igual que
// SQL_PREVENTA en ventasPorGrupo.js (PREVENTA nunca pasa por esas ramas).
const SQL_PREVENTA = `
  WITH base AS (
    SELECT
      dd.descripcion_categoria AS categoria,
      dd.cantidad AS unidades,
      dd.total    AS dolares,
      o.code      AS doc_code
    FROM ordenes o
    JOIN detalle_documento dd ON dd.documento_code = o.code
    WHERE o.type = 2
      AND o.status = 5
      AND o.seller_code = $1
      AND ${FILTRO_PREVENTA_SELLER("dd.descripcion_categoria")}
      AND o.fecha_entrega >= $2
      AND o.fecha_entrega <  $3
  )
  SELECT
    categoria,
    SUM(unidades) AS unidades,
    SUM(dolares)  AS dolares,
    SUM(SUM(unidades)) OVER () AS unidades_totales,
    SUM(SUM(dolares))  OVER () AS dolares_totales,
    (SELECT COUNT(DISTINCT doc_code) FROM base) AS num_documentos
  FROM base
  GROUP BY categoria
  ORDER BY dolares DESC;
`;

async function ventasPorRuta({ ruta, fecha_inicio, fecha_fin }) {
  if (diffDias(fecha_inicio, fecha_fin) < 0) {
    throw new Error("fecha_inicio no puede ser posterior a fecha_fin");
  }
  if (diffDias(fecha_inicio, fecha_fin) > MAX_RANGO_DIAS) {
    throw new Error(`rango máximo permitido: ${MAX_RANGO_DIAS} días`);
  }

  const inicioTs = `${fecha_inicio} 00:00:00`;
  const finTs = `${finExclusivo(fecha_fin)} 00:00:00`;

  const esRutaPreventa = RUTA_PREVENTA_RE.test(ruta);
  const { rows } = await pool.query(esRutaPreventa ? SQL_PREVENTA : SQL, [ruta, inicioTs, finTs]);

  if (rows.length === 0) {
    return { ruta, unidades_totales: 0, dolares_totales: 0, num_documentos: 0, por_categoria: [] };
  }

  return {
    ruta,
    unidades_totales: Number(rows[0].unidades_totales) || 0,
    dolares_totales: Number(rows[0].dolares_totales) || 0,
    num_documentos: Number(rows[0].num_documentos) || 0,
    por_categoria: rows.map((r) => ({
      categoria: r.categoria || "SIN_CATEGORIA",
      unidades: Number(r.unidades) || 0,
      dolares: Number(r.dolares) || 0,
    })),
  };
}

module.exports = { ventasPorRuta, inputSchema };
