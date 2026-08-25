// src/tools/ventasPorRuta.js
const { z } = require("zod");
const { pool } = require("../db");
const { finExclusivo, diffDias } = require("../util/fechas");

const RUTA_RE = /^[A-Za-z0-9._-]{1,20}$/;
const MAX_RANGO_DIAS = 400;

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

async function ventasPorRuta({ ruta, fecha_inicio, fecha_fin }) {
  if (diffDias(fecha_inicio, fecha_fin) < 0) {
    throw new Error("fecha_inicio no puede ser posterior a fecha_fin");
  }
  if (diffDias(fecha_inicio, fecha_fin) > MAX_RANGO_DIAS) {
    throw new Error(`rango máximo permitido: ${MAX_RANGO_DIAS} días`);
  }

  const inicioTs = `${fecha_inicio} 00:00:00`;
  const finTs = `${finExclusivo(fecha_fin)} 00:00:00`;

  const { rows } = await pool.query(SQL, [ruta, inicioTs, finTs]);

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
