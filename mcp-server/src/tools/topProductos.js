// src/tools/topProductos.js
const { z } = require("zod");
const { pool } = require("../db");
const { finExclusivo, diffDias } = require("../util/fechas");

const MAX_RANGO_DIAS = 400;
const LIMITE_DEFAULT = 10;
const LIMITE_MAX = 50;

const inputSchema = {
  fecha_inicio: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  fecha_fin: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  limite: z.number().int().min(1).max(LIMITE_MAX).default(LIMITE_DEFAULT),
};

// $1 = inicio, $2 = fin exclusivo, $3 = limite (validado por zod antes, pero
// igual va como parámetro real de PG, nunca interpolado en el texto SQL).
//
// Misma estructura de 3 ramas que ventasPorRuta/ventasPorGrupo — confirmado
// contra datos reales: los pedidos "Website" quedan en `ordenes` con
// origen_sistema='ODOO' (no 'MOBILVENDOR') y seller_code vacío, por eso
// necesitan su propia rama en vez de calzar en la rama MOBILVENDOR. El resto
// de `ordenes` con origen_sistema='ODOO' (no-Website) NO se cuenta aparte:
// esas órdenes ya terminan reflejadas en `facturas`, contarlas también aquí
// duplicaría el monto.
const SQL = `
  WITH base AS (
    SELECT
      dd.codigo_producto AS codigo,
      dd.descripcion      AS descripcion,
      dd.cantidad         AS unidades,
      dd.total            AS dolares
    FROM ordenes o
    JOIN detalle_documento dd ON dd.documento_code = o.code
    WHERE o.status = 2
      AND o.origen_sistema = 'MOBILVENDOR'
      AND o.fecha_creacion >= $1
      AND o.fecha_creacion <  $2

    UNION ALL

    SELECT
      dd.codigo_producto AS codigo,
      dd.descripcion      AS descripcion,
      CASE WHEN f.tipo_movimiento = 'out_refund' THEN -dd.cantidad ELSE dd.cantidad END AS unidades,
      CASE WHEN f.tipo_movimiento = 'out_refund' THEN -dd.total    ELSE dd.total    END AS dolares
    FROM facturas f
    JOIN detalle_documento dd ON dd.documento_code = f.code
    WHERE f.status = 2
      AND f.fecha_creacion >= $1
      AND f.fecha_creacion <  $2

    UNION ALL

    SELECT
      dd.codigo_producto AS codigo,
      dd.descripcion      AS descripcion,
      dd.cantidad         AS unidades,
      dd.total            AS dolares
    FROM ordenes o
    JOIN detalle_documento dd ON dd.documento_code = o.code
    WHERE o.status = 2
      AND o.equipo_ventas = 'Website'
      AND o.fecha_creacion >= $1
      AND o.fecha_creacion <  $2
  )
  SELECT
    b.codigo,
    COALESCE(p.nombre_producto, MIN(b.descripcion)) AS descripcion,
    SUM(b.unidades) AS unidades,
    SUM(b.dolares)  AS dolares
  FROM base b
  LEFT JOIN productos p ON p.codigo_producto = b.codigo
  GROUP BY b.codigo, p.nombre_producto
  ORDER BY dolares DESC
  LIMIT $3;
`;

async function topProductos({ fecha_inicio, fecha_fin, limite }) {
  const largoDias = diffDias(fecha_inicio, fecha_fin);
  if (largoDias < 0) throw new Error("fecha_inicio no puede ser posterior a fecha_fin");
  if (largoDias > MAX_RANGO_DIAS) throw new Error(`rango máximo permitido: ${MAX_RANGO_DIAS} días`);

  const inicioTs = `${fecha_inicio} 00:00:00`;
  const finTs = `${finExclusivo(fecha_fin)} 00:00:00`;

  const { rows } = await pool.query(SQL, [inicioTs, finTs, limite ?? LIMITE_DEFAULT]);

  return {
    productos: rows.map((r) => ({
      codigo: r.codigo,
      descripcion: r.descripcion,
      unidades: Number(r.unidades) || 0,
      dolares: Number(r.dolares) || 0,
    })),
  };
}

module.exports = { topProductos, inputSchema };
