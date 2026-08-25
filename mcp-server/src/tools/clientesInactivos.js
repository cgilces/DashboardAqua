// src/tools/clientesInactivos.js
const { z } = require("zod");
const { pool } = require("../db");
const { sumarDias } = require("../util/fechas");

const RUTA_RE = /^[A-Za-z0-9._-]{1,20}$/;

// Ventanas fijas server-side (el criterio de "inactivo" no lo decide el LLM):
// "compró en los 60 días previos a los últimos 15, pero no en los últimos 15".
const VENTANA_RECIENTE_DIAS = 15;
const VENTANA_HISTORICA_DIAS = 60;

const inputSchema = {
  ruta: z.string().regex(RUTA_RE, "código de ruta inválido"),
};

// $1 = ruta, $2 = inicio de la ventana total (hoy - 75d), $3 = corte reciente (hoy - 15d)
const SQL = `
  WITH compras AS (
    SELECT o.customer_code AS codigo_cliente, o.fecha_creacion AS fecha, dd.total AS dolares
    FROM ordenes o
    JOIN detalle_documento dd ON dd.documento_code = o.code
    WHERE o.status = 2
      AND o.origen_sistema = 'MOBILVENDOR'
      AND o.seller_code = $1
      AND o.fecha_creacion >= $2

    UNION ALL

    SELECT f.customer_code,
           f.fecha_creacion,
           CASE WHEN f.tipo_movimiento = 'out_refund' THEN -dd.total ELSE dd.total END
    FROM facturas f
    JOIN detalle_documento dd ON dd.documento_code = f.code
    WHERE f.status = 2
      AND f.seller_code = $1
      AND f.fecha_creacion >= $2
  ),
  recientes AS (
    SELECT DISTINCT codigo_cliente FROM compras WHERE fecha >= $3
  ),
  historicos AS (
    SELECT codigo_cliente, MAX(fecha) AS ultima_compra, AVG(dolares) AS monto_promedio_historico
    FROM compras
    WHERE fecha < $3
    GROUP BY codigo_cliente
  )
  SELECT
    h.codigo_cliente,
    COALESCE(c.nombre_comercial_cliente, c.nombre_cliente) AS nombre_cliente,
    h.ultima_compra,
    h.monto_promedio_historico
  FROM historicos h
  LEFT JOIN clientes c ON c.codigo_cliente = h.codigo_cliente
  WHERE h.codigo_cliente IS NOT NULL
    AND h.codigo_cliente NOT IN (SELECT codigo_cliente FROM recientes)
  ORDER BY h.ultima_compra DESC;
`;

async function clientesInactivos({ ruta }) {
  const hoy = new Date().toISOString().slice(0, 10);
  const inicioVentanaTotal = sumarDias(hoy, -(VENTANA_HISTORICA_DIAS + VENTANA_RECIENTE_DIAS));
  const corteReciente = sumarDias(hoy, -VENTANA_RECIENTE_DIAS);

  const { rows } = await pool.query(SQL, [
    ruta,
    `${inicioVentanaTotal} 00:00:00`,
    `${corteReciente} 00:00:00`,
  ]);

  return {
    ruta,
    ventana_reciente_dias: VENTANA_RECIENTE_DIAS,
    ventana_historica_dias: VENTANA_HISTORICA_DIAS,
    clientes: rows.map((r) => ({
      codigo_cliente: r.codigo_cliente,
      nombre_cliente: r.nombre_cliente || null,
      ultima_compra: r.ultima_compra,
      monto_promedio_historico: r.monto_promedio_historico != null ? Number(Number(r.monto_promedio_historico).toFixed(2)) : null,
    })),
  };
}

module.exports = { clientesInactivos, inputSchema };
