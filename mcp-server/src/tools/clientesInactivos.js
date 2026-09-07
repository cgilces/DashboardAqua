// src/tools/clientesInactivos.js
//
// ⚠️ NO USAR para rutas de PREVENTA (PV*/PVR*/TELEVENTA*/PREVENTA VIP*) — el
// fix de espacio de acá abajo solo corrige que la regex ya no las rechace,
// pero la query SIGUE usando `status=2`/`fecha_creacion` (el criterio
// genérico de status=2 vs. el status=5+guía validado que de verdad usan
// esas rutas), y una ventana FIJA de 60/15 días corrida desde HOY (no un
// mes calendario). Para PREVENTA da un resultado que PARECE válido pero no
// tiene relación real con quién dejó de comprar — confirmado con datos:
// comparado contra `clientesPorGrupo` (grupo=PREVENTA, por_mes) para las
// mismas rutas, 0 de 32 clientes coincidieron entre los dos métodos. Ver
// TODO.md, "reporte de clientes en $0 por vendedor construido con la
// herramienta equivocada". Para PREVENTA, usar `clientesPorGrupo` con
// `por_mes:true` y comparar los meses que corresponda — no este tool.
const { z } = require("zod");
const { pool } = require("../db");
const { sumarDias } = require("../util/fechas");

// Espacio incluido a propósito: hay códigos de ruta reales con espacio
// ("TELEVENTA 1", "PREVENTA VIP 1", "RUTA 113" de COTTSA) que esta regex
// rechazaba antes, devolviendo "código de ruta inválido" para rutas que sí
// existen — mismo bug ya corregido en ventasPorRuta.js. Encontrado acá
// cuando un reporte real a gerencia ("clientes en $0 por vendedor") omitió
// por completo TELEVENTA 1-4 y PREVENTA VIP 1-2 sin ningún aviso.
const RUTA_RE = /^[A-Za-z0-9._ -]{1,20}$/;

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
