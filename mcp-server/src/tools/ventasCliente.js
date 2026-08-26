// src/tools/ventasCliente.js
// Historial de ventas de un cliente específico, buscado por nombre parcial
// (el usuario no escribe el nombre exacto tal cual está en la base).
const { z } = require("zod");
const { pool } = require("../db");
const { finExclusivo, diffDias } = require("../util/fechas");

const MAX_RANGO_DIAS = 800; // "los últimos meses" puede ser un rango largo
const MAX_CANDIDATOS = 20;
const MIN_LARGO_NOMBRE = 3;

const inputSchema = {
  nombre_cliente: z.string().min(MIN_LARGO_NOMBRE, `mínimo ${MIN_LARGO_NOMBRE} caracteres`),
  fecha_inicio: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  fecha_fin: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
};

// Escapa los caracteres especiales de LIKE/ILIKE (% y _) que el usuario
// pudiera escribir sin querer usarlos como wildcard — el patrón sigue yendo
// como parámetro de pg ($1), esto es corrección de resultados, no el
// mecanismo de seguridad contra inyección.
function escaparComodinesLike(texto) {
  return texto.replace(/[\\%_]/g, (c) => `\\${c}`);
}

const SQL_BUSCAR_CLIENTE = `
  SELECT codigo_cliente, nombre_cliente, nombre_comercial_cliente
  FROM clientes
  WHERE nombre_cliente ILIKE $1 OR nombre_comercial_cliente ILIKE $1
  ORDER BY nombre_cliente
  LIMIT ${MAX_CANDIDATOS + 1};
`;

// $1 = codigo_cliente, $2 = inicio (timestamp), $3 = fin exclusivo (timestamp)
const SQL_HISTORIAL = `
  WITH base AS (
    SELECT
      o.fecha_creacion AS fecha,
      o.customer_address_code AS direccion_code,
      dd.cantidad AS unidades,
      dd.total    AS dolares,
      o.code      AS doc_code
    FROM ordenes o
    JOIN detalle_documento dd ON dd.documento_code = o.code
    WHERE o.status = 2
      AND o.origen_sistema = 'MOBILVENDOR'
      AND o.customer_code = $1
      AND o.fecha_creacion >= $2
      AND o.fecha_creacion <  $3

    UNION ALL

    SELECT
      f.fecha_creacion AS fecha,
      f.customer_address_code AS direccion_code,
      CASE WHEN f.tipo_movimiento = 'out_refund' THEN -dd.cantidad ELSE dd.cantidad END AS unidades,
      CASE WHEN f.tipo_movimiento = 'out_refund' THEN -dd.total    ELSE dd.total    END AS dolares,
      f.code AS doc_code
    FROM facturas f
    JOIN detalle_documento dd ON dd.documento_code = f.code
    WHERE f.status = 2
      AND f.customer_code = $1
      AND f.fecha_creacion >= $2
      AND f.fecha_creacion <  $3
  )
  SELECT
    to_char(date_trunc('month', fecha), 'YYYY-MM') AS mes,
    direccion_code,
    SUM(unidades) AS unidades,
    SUM(dolares)  AS dolares,
    COUNT(DISTINCT doc_code) AS num_documentos
  FROM base
  GROUP BY mes, direccion_code
  ORDER BY mes;
`;

const SQL_DIRECCIONES = `
  SELECT codigo_direccion_cliente, descripcion_direccion_cliente, calle1_direccion_cliente
  FROM direcciones_clientes
  WHERE codigo_cliente = $1
    AND codigo_direccion_cliente = ANY($2::text[]);
`;

async function ventasCliente({ nombre_cliente, fecha_inicio, fecha_fin }) {
  const largoDias = diffDias(fecha_inicio, fecha_fin);
  if (largoDias < 0) throw new Error("fecha_inicio no puede ser posterior a fecha_fin");
  if (largoDias > MAX_RANGO_DIAS) throw new Error(`rango máximo permitido: ${MAX_RANGO_DIAS} días`);

  const patron = `%${escaparComodinesLike(nombre_cliente)}%`;
  const { rows: candidatos } = await pool.query(SQL_BUSCAR_CLIENTE, [patron]);

  if (candidatos.length === 0) {
    return { encontrado: false, motivo: "sin_coincidencias", candidatos: [] };
  }
  if (candidatos.length > 1) {
    return {
      encontrado: false,
      motivo: "coincidencias_multiples",
      candidatos: candidatos.slice(0, MAX_CANDIDATOS).map((c) => ({
        codigo_cliente: c.codigo_cliente,
        nombre_cliente: c.nombre_cliente,
        nombre_comercial_cliente: c.nombre_comercial_cliente,
      })),
      candidatos_truncados: candidatos.length > MAX_CANDIDATOS,
    };
  }

  const cliente = candidatos[0];
  const inicioTs = `${fecha_inicio} 00:00:00`;
  const finTs = `${finExclusivo(fecha_fin)} 00:00:00`;

  const { rows: filas } = await pool.query(SQL_HISTORIAL, [cliente.codigo_cliente, inicioTs, finTs]);

  const porMesMap = new Map();
  const porDireccionMap = new Map();
  const docCodesVistos = new Set(); // solo para el total; num_documentos por fila ya viene agregado por grupo
  let dolaresTotales = 0;
  let unidadesTotales = 0;
  let numDocumentosTotal = 0;

  for (const f of filas) {
    const dolares = Number(f.dolares) || 0;
    const unidades = Number(f.unidades) || 0;
    dolaresTotales += dolares;
    unidadesTotales += unidades;
    numDocumentosTotal += Number(f.num_documentos) || 0;

    const mesActual = porMesMap.get(f.mes) || { dolares: 0, unidades: 0 };
    mesActual.dolares += dolares;
    mesActual.unidades += unidades;
    porMesMap.set(f.mes, mesActual);

    const direccionKey = f.direccion_code || "SIN_DIRECCION";
    const dirActual = porDireccionMap.get(direccionKey) || { dolares: 0, unidades: 0 };
    dirActual.dolares += dolares;
    dirActual.unidades += unidades;
    porDireccionMap.set(direccionKey, dirActual);
  }

  const direccionesCodigos = [...porDireccionMap.keys()].filter((k) => k !== "SIN_DIRECCION");
  let descripcionesPorCodigo = {};
  if (direccionesCodigos.length > 0) {
    const { rows: direcciones } = await pool.query(SQL_DIRECCIONES, [cliente.codigo_cliente, direccionesCodigos]);
    descripcionesPorCodigo = Object.fromEntries(
      direcciones.map((d) => [
        d.codigo_direccion_cliente,
        d.descripcion_direccion_cliente || d.calle1_direccion_cliente || null,
      ])
    );
  }

  return {
    encontrado: true,
    cliente: {
      codigo_cliente: cliente.codigo_cliente,
      nombre_cliente: cliente.nombre_cliente,
      nombre_comercial_cliente: cliente.nombre_comercial_cliente,
    },
    rango: { fecha_inicio, fecha_fin },
    total: {
      dolares: Number(dolaresTotales.toFixed(2)),
      unidades: unidadesTotales,
      num_documentos: numDocumentosTotal,
    },
    por_mes: [...porMesMap.entries()]
      .map(([mes, v]) => ({ mes, dolares: Number(v.dolares.toFixed(2)), unidades: v.unidades }))
      .sort((a, b) => a.mes.localeCompare(b.mes)),
    por_direccion: [...porDireccionMap.entries()]
      .map(([codigo, v]) => ({
        codigo_direccion: codigo === "SIN_DIRECCION" ? null : codigo,
        descripcion: codigo === "SIN_DIRECCION" ? null : descripcionesPorCodigo[codigo] || null,
        dolares: Number(v.dolares.toFixed(2)),
        unidades: v.unidades,
      }))
      .sort((a, b) => b.dolares - a.dolares),
  };
}

module.exports = { ventasCliente, inputSchema };
