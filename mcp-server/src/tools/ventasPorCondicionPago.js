// src/tools/ventasPorCondicionPago.js
// Ventas de un grupo de canal desglosadas por condición de pago
// (CONTADO/CREDITO) — ver clasificacion.js (CONDICION_PAGO_FACTURA/
// CONDICION_PAGO_CLIENTE) para la investigación completa de por qué existen
// 2 señales y cómo se combinan.
//
// Motivo: la vieja asunción "contado=MobilVendor / crédito=Odoo" (usar
// origen_sistema como proxy) es INCORRECTA como regla general — Alberto
// confirmó clientes VIP e HIELO en MobilVendor que son de crédito. Esta
// tool usa la condición de pago REAL del documento/cliente, nunca el
// origen_sistema.
//
// Enfoque híbrido (decisión de Alberto, 2026-09-16): `facturas` usa la
// señal TRANSACCIONAL (fecha_vencimiento - fecha_creacion, propia de cada
// documento); `ordenes` — incluido PREVENTA, que nunca genera factura
// propia — usa `clientes.metodo_pago_cliente` como fallback. Excluir
// PREVENTA hubiera repetido el mismo punto ciego ya corregido con LIQ y el
// universo de status: cobertura completa, no solo lo más simple de
// construir.
//
// Cada fila de salida trae `fuente_condicion` ('TRANSACCIONAL' o
// 'METODO_PAGO_CLIENTE') para poder rastrear si un patrón raro viene del
// fallback o de la señal transaccional, sin rehacer la investigación.
const { z } = require("zod");
const { pool } = require("../db");
const { finExclusivo, diffDias } = require("../util/fechas");
const {
  CASE_GRUPO_ORDENES,
  FILTRO_ORDENES_GRUPO_VALIDO,
  CASE_GRUPO_FACTURAS,
  GRUPOS_VALIDOS,
  CATEGORIAS_VALIDAS,
  FILTRO_PREVENTA_SELLER,
  CATEGORIA_PREVENTA,
  FILTRO_CLIENTE_VALIDO,
  CONDICION_PAGO_CLIENTE,
  FUENTE_CONDICION_PAGO_CLIENTE,
  CONDICION_PAGO_FACTURA,
  FUENTE_CONDICION_PAGO_FACTURA,
} = require("../sql/clasificacion");

const MAX_RANGO_DIAS = 400;

const inputSchema = {
  grupo: z.enum(GRUPOS_VALIDOS),
  categoria: z.enum(CATEGORIAS_VALIDAS).optional(),
  fecha_inicio: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  fecha_fin: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
};

// $1 = grupo, $2 = inicio (timestamp), $3 = fin exclusivo (timestamp),
// $4 = categoria (o NULL para no filtrar por categoría). LEFT JOIN clientes
// (nunca INNER) — no hay FK que garantice que todo customer_code tenga fila
// en clientes; con INNER JOIN un cliente faltante haría desaparecer el
// documento de la suma en vez de degradar a SIN_DATO.
const SQL = `
  WITH base AS (
    SELECT
      ${CONDICION_PAGO_CLIENTE("c")} AS condicion_pago,
      ${FUENTE_CONDICION_PAGO_CLIENTE} AS fuente_condicion,
      dd.cantidad AS unidades,
      dd.total    AS dolares,
      o.code      AS doc_code
    FROM ordenes o
    JOIN detalle_documento dd ON dd.documento_code = o.code
    LEFT JOIN clientes c ON c.codigo_cliente = o.customer_code
    WHERE o.status = 2
      AND o.origen_sistema = 'MOBILVENDOR'
      AND ${FILTRO_ORDENES_GRUPO_VALIDO}
      AND (${CASE_GRUPO_ORDENES}) = $1
      AND ${FILTRO_CLIENTE_VALIDO("o.customer_code")}
      AND o.fecha_creacion >= $2
      AND o.fecha_creacion <  $3
      AND ($4::text IS NULL OR dd.descripcion_categoria = $4)

    UNION ALL

    SELECT
      ${CONDICION_PAGO_FACTURA("f", "c")} AS condicion_pago,
      ${FUENTE_CONDICION_PAGO_FACTURA("f")} AS fuente_condicion,
      CASE WHEN f.tipo_movimiento = 'out_refund' THEN -dd.cantidad ELSE dd.cantidad END AS unidades,
      CASE WHEN f.tipo_movimiento = 'out_refund' THEN -dd.total    ELSE dd.total    END AS dolares,
      f.code AS doc_code
    FROM facturas f
    JOIN detalle_documento dd ON dd.documento_code = f.code
    LEFT JOIN clientes c ON c.codigo_cliente = f.customer_code
    WHERE f.status = 2
      AND (${CASE_GRUPO_FACTURAS}) = $1
      AND ${FILTRO_CLIENTE_VALIDO("f.customer_code")}
      AND f.fecha_creacion >= $2
      AND f.fecha_creacion <  $3
      AND ($4::text IS NULL OR dd.descripcion_categoria = $4)

    UNION ALL

    SELECT
      ${CONDICION_PAGO_CLIENTE("c")} AS condicion_pago,
      ${FUENTE_CONDICION_PAGO_CLIENTE} AS fuente_condicion,
      dd.cantidad AS unidades,
      dd.total    AS dolares,
      o.code      AS doc_code
    FROM ordenes o
    JOIN detalle_documento dd ON dd.documento_code = o.code
    LEFT JOIN clientes c ON c.codigo_cliente = o.customer_code
    WHERE o.status = 2
      AND o.equipo_ventas = 'Website'
      AND ${FILTRO_CLIENTE_VALIDO("o.customer_code")}
      AND $1 = 'DOMICILIO'
      AND o.fecha_creacion >= $2
      AND o.fecha_creacion <  $3
      AND ($4::text IS NULL OR dd.descripcion_categoria = $4)
  )
  SELECT
    condicion_pago,
    fuente_condicion,
    SUM(unidades) AS unidades,
    SUM(dolares)  AS dolares,
    COUNT(DISTINCT doc_code) AS num_documentos
  FROM base
  GROUP BY GROUPING SETS ((condicion_pago, fuente_condicion), (condicion_pago), ());
`;

// PREVENTA — misma ventana status=5/fecha_entrega/FILTRO_PREVENTA_SELLER ya
// validada contra Excel real en ventasPorGrupo.js (no se toca ese criterio
// acá, esta tool solo agrega la dimensión de condición de pago encima). Solo
// `ordenes` (PREVENTA nunca genera facturas propias) — condición SIEMPRE por
// fallback de cliente, no hay fecha_vencimiento en `ordenes`.
// $1 = inicio (timestamp), $2 = fin exclusivo (timestamp), $3 = categoria.
const SQL_PREVENTA = `
  SELECT
    ${CONDICION_PAGO_CLIENTE("c")} AS condicion_pago,
    ${FUENTE_CONDICION_PAGO_CLIENTE} AS fuente_condicion,
    SUM(dd.cantidad) AS unidades,
    SUM(dd.total)    AS dolares,
    COUNT(DISTINCT o.code) AS num_documentos
  FROM ordenes o
  JOIN detalle_documento dd ON dd.documento_code = o.code
  LEFT JOIN clientes c ON c.codigo_cliente = o.customer_code
  WHERE o.type = 2
    AND o.status = 5
    AND ${FILTRO_PREVENTA_SELLER("$3")}
    AND ${FILTRO_CLIENTE_VALIDO("o.customer_code")}
    AND dd.descripcion_categoria = $3
    AND o.fecha_entrega >= $1
    AND o.fecha_entrega <  $2
  GROUP BY GROUPING SETS ((condicion_pago, fuente_condicion), (condicion_pago), ());
`;

// Combina las filas GROUPING SETS en { totales, por_condicion, por_condicion_y_fuente }.
function desagregar(rows) {
  const totales = { unidades: 0, dolares: 0, num_documentos: 0 };
  const por_condicion = [];
  const por_condicion_y_fuente = [];

  for (const r of rows) {
    const unidades = Number(r.unidades) || 0;
    const dolares = Number(r.dolares) || 0;
    const num_documentos = Number(r.num_documentos) || 0;

    if (r.condicion_pago == null && r.fuente_condicion == null) {
      totales.unidades = unidades;
      totales.dolares = dolares;
      totales.num_documentos = num_documentos;
    } else if (r.fuente_condicion == null) {
      por_condicion.push({ condicion_pago: r.condicion_pago, unidades, dolares, num_documentos });
    } else {
      por_condicion_y_fuente.push({
        condicion_pago: r.condicion_pago,
        fuente_condicion: r.fuente_condicion,
        unidades,
        dolares,
        num_documentos,
      });
    }
  }

  por_condicion.sort((a, b) => b.dolares - a.dolares);
  por_condicion_y_fuente.sort((a, b) => b.dolares - a.dolares);
  return { totales, por_condicion, por_condicion_y_fuente };
}

async function totalesGrupo(grupo, inicioTs, finTs, categoria) {
  const { rows } = await pool.query(SQL, [grupo, inicioTs, finTs, categoria ?? null]);
  return desagregar(rows);
}

async function totalesPreventa(inicioTs, finTs, categoria) {
  const categoriaEfectiva = categoria || CATEGORIA_PREVENTA;
  const { rows } = await pool.query(SQL_PREVENTA, [inicioTs, finTs, categoriaEfectiva]);
  return desagregar(rows);
}

async function ventasPorCondicionPago({ grupo, categoria, fecha_inicio, fecha_fin }) {
  const largoDias = diffDias(fecha_inicio, fecha_fin);
  if (largoDias < 0) throw new Error("fecha_inicio no puede ser posterior a fecha_fin");
  if (largoDias > MAX_RANGO_DIAS) throw new Error(`rango máximo permitido: ${MAX_RANGO_DIAS} días`);

  const inicioTs = `${fecha_inicio} 00:00:00`;
  const finTs = `${finExclusivo(fecha_fin)} 00:00:00`;

  const esPreventa = grupo === "PREVENTA";
  const { totales, por_condicion, por_condicion_y_fuente } = esPreventa
    ? await totalesPreventa(inicioTs, finTs, categoria)
    : await totalesGrupo(grupo, inicioTs, finTs, categoria);

  return {
    grupo,
    categoria: esPreventa ? categoria || CATEGORIA_PREVENTA : categoria || null,
    unidades_totales: totales.unidades,
    dolares_totales: Number(totales.dolares.toFixed(2)),
    num_documentos: totales.num_documentos,
    por_condicion: por_condicion.map((r) => ({
      ...r,
      dolares: Number(r.dolares.toFixed(2)),
    })),
    por_condicion_y_fuente: por_condicion_y_fuente.map((r) => ({
      ...r,
      dolares: Number(r.dolares.toFixed(2)),
    })),
  };
}

module.exports = { ventasPorCondicionPago, inputSchema, totalesGrupo, totalesPreventa };
