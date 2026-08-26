// src/tools/ventasCliente.js
// Historial de ventas de un cliente específico, buscado por nombre parcial
// (el usuario no escribe el nombre exacto tal cual está en la base).
// Filtros opcionales combinables (AND) por categoría de producto y/o por
// un producto específico (también buscado por nombre parcial).
const { z } = require("zod");
const { pool } = require("../db");
const { finExclusivo, diffDias } = require("../util/fechas");
const { CATEGORIAS_VALIDAS } = require("../sql/clasificacion");

const MAX_RANGO_DIAS = 800; // "los últimos meses" puede ser un rango largo
const MAX_CANDIDATOS = 20;
const MIN_LARGO_NOMBRE = 3;

const inputSchema = {
  nombre_cliente: z.string().min(MIN_LARGO_NOMBRE, `mínimo ${MIN_LARGO_NOMBRE} caracteres`),
  fecha_inicio: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  fecha_fin: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  categoria: z.enum(CATEGORIAS_VALIDAS).optional(),
  producto: z.string().min(MIN_LARGO_NOMBRE, `mínimo ${MIN_LARGO_NOMBRE} caracteres`).optional(),
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

const SQL_BUSCAR_PRODUCTO = `
  SELECT codigo_producto, nombre_producto
  FROM productos
  WHERE nombre_producto ILIKE $1
  ORDER BY nombre_producto
  LIMIT ${MAX_CANDIDATOS + 1};
`;

// $1 = codigo_cliente, $2 = inicio (timestamp), $3 = fin exclusivo (timestamp)
// $4 = categoria (o NULL), $5 = codigo_producto (o NULL)
const SQL_HISTORIAL = `
  WITH base AS (
    SELECT
      o.fecha_creacion AS fecha,
      o.customer_address_code AS direccion_code,
      dd.codigo_producto AS producto_code,
      dd.descripcion AS producto_descripcion,
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
      AND ($4::text IS NULL OR dd.descripcion_categoria = $4)
      AND ($5::text IS NULL OR dd.codigo_producto = $5)

    UNION ALL

    SELECT
      f.fecha_creacion AS fecha,
      f.customer_address_code AS direccion_code,
      dd.codigo_producto AS producto_code,
      dd.descripcion AS producto_descripcion,
      CASE WHEN f.tipo_movimiento = 'out_refund' THEN -dd.cantidad ELSE dd.cantidad END AS unidades,
      CASE WHEN f.tipo_movimiento = 'out_refund' THEN -dd.total    ELSE dd.total    END AS dolares,
      f.code AS doc_code
    FROM facturas f
    JOIN detalle_documento dd ON dd.documento_code = f.code
    WHERE f.status = 2
      AND f.customer_code = $1
      AND f.fecha_creacion >= $2
      AND f.fecha_creacion <  $3
      AND ($4::text IS NULL OR dd.descripcion_categoria = $4)
      AND ($5::text IS NULL OR dd.codigo_producto = $5)
  )
  SELECT
    to_char(date_trunc('month', fecha), 'YYYY-MM') AS mes,
    direccion_code,
    producto_code,
    producto_descripcion,
    SUM(unidades) AS unidades,
    SUM(dolares)  AS dolares,
    COUNT(DISTINCT doc_code) AS num_documentos
  FROM base
  GROUP BY mes, direccion_code, producto_code, producto_descripcion
  ORDER BY mes;
`;

const SQL_DIRECCIONES = `
  SELECT codigo_direccion_cliente, descripcion_direccion_cliente, calle1_direccion_cliente
  FROM direcciones_clientes
  WHERE codigo_cliente = $1
    AND codigo_direccion_cliente = ANY($2::text[]);
`;

const SQL_NOMBRES_PRODUCTOS = `
  SELECT codigo_producto, nombre_producto
  FROM productos
  WHERE codigo_producto = ANY($1::text[]);
`;

async function buscarUno(sql, patron, camposCandidato) {
  const { rows } = await pool.query(sql, [patron]);
  if (rows.length === 0) return { estado: "sin_coincidencias", candidatos: [] };
  if (rows.length > 1) {
    return {
      estado: "coincidencias_multiples",
      candidatos: rows.slice(0, MAX_CANDIDATOS).map((r) => {
        const c = {};
        camposCandidato.forEach((campo) => (c[campo] = r[campo]));
        return c;
      }),
      truncado: rows.length > MAX_CANDIDATOS,
    };
  }
  return { estado: "resuelto", fila: rows[0] };
}

async function ventasCliente({ nombre_cliente, fecha_inicio, fecha_fin, categoria, producto }) {
  const largoDias = diffDias(fecha_inicio, fecha_fin);
  if (largoDias < 0) throw new Error("fecha_inicio no puede ser posterior a fecha_fin");
  if (largoDias > MAX_RANGO_DIAS) throw new Error(`rango máximo permitido: ${MAX_RANGO_DIAS} días`);

  // 1) Resolver cliente.
  const patronCliente = `%${escaparComodinesLike(nombre_cliente)}%`;
  const resultCliente = await buscarUno(SQL_BUSCAR_CLIENTE, patronCliente, [
    "codigo_cliente",
    "nombre_cliente",
    "nombre_comercial_cliente",
  ]);
  if (resultCliente.estado === "sin_coincidencias") {
    return { encontrado: false, motivo: "sin_coincidencias_cliente", candidatos: [] };
  }
  if (resultCliente.estado === "coincidencias_multiples") {
    return {
      encontrado: false,
      motivo: "coincidencias_multiples_cliente",
      candidatos: resultCliente.candidatos,
      candidatos_truncados: resultCliente.truncado,
    };
  }
  const cliente = resultCliente.fila;

  // 2) Resolver producto, solo si se pidió.
  let productoResuelto = null;
  if (producto) {
    const patronProducto = `%${escaparComodinesLike(producto)}%`;
    const resultProducto = await buscarUno(SQL_BUSCAR_PRODUCTO, patronProducto, ["codigo_producto", "nombre_producto"]);
    if (resultProducto.estado === "sin_coincidencias") {
      return {
        encontrado: false,
        motivo: "sin_coincidencias_producto",
        cliente: {
          codigo_cliente: cliente.codigo_cliente,
          nombre_cliente: cliente.nombre_cliente,
          nombre_comercial_cliente: cliente.nombre_comercial_cliente,
        },
        candidatos_producto: [],
      };
    }
    if (resultProducto.estado === "coincidencias_multiples") {
      return {
        encontrado: false,
        motivo: "coincidencias_multiples_producto",
        cliente: {
          codigo_cliente: cliente.codigo_cliente,
          nombre_cliente: cliente.nombre_cliente,
          nombre_comercial_cliente: cliente.nombre_comercial_cliente,
        },
        candidatos_producto: resultProducto.candidatos,
        candidatos_producto_truncados: resultProducto.truncado,
      };
    }
    productoResuelto = resultProducto.fila;
  }

  // 3) Historial de ventas, con categoria/producto como filtros opcionales.
  const inicioTs = `${fecha_inicio} 00:00:00`;
  const finTs = `${finExclusivo(fecha_fin)} 00:00:00`;
  const categoriaParam = categoria || null;
  const productoParam = productoResuelto ? productoResuelto.codigo_producto : null;

  const { rows: filas } = await pool.query(SQL_HISTORIAL, [
    cliente.codigo_cliente,
    inicioTs,
    finTs,
    categoriaParam,
    productoParam,
  ]);

  const porMesMap = new Map();
  const porDireccionMap = new Map();
  const porProductoMap = new Map();
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

    const productoKey = f.producto_code || "SIN_PRODUCTO";
    const prodActual = porProductoMap.get(productoKey) || {
      dolares: 0,
      unidades: 0,
      descripcion: f.producto_descripcion || null,
    };
    prodActual.dolares += dolares;
    prodActual.unidades += unidades;
    porProductoMap.set(productoKey, prodActual);
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

  // por_producto solo se calcula si hay un filtro aplicado (categoria o
  // producto) — sin filtro, el historial completo podría tener decenas de
  // productos distintos y no aporta a la pregunta original.
  let porProducto;
  if (categoriaParam || productoParam) {
    const productosCodigos = [...porProductoMap.keys()].filter((k) => k !== "SIN_PRODUCTO");
    let nombresCanonicos = {};
    if (productosCodigos.length > 0) {
      const { rows: productosRows } = await pool.query(SQL_NOMBRES_PRODUCTOS, [productosCodigos]);
      nombresCanonicos = Object.fromEntries(productosRows.map((p) => [p.codigo_producto, p.nombre_producto]));
    }
    porProducto = [...porProductoMap.entries()]
      .map(([codigo, v]) => ({
        codigo_producto: codigo === "SIN_PRODUCTO" ? null : codigo,
        descripcion: codigo === "SIN_PRODUCTO" ? null : nombresCanonicos[codigo] || v.descripcion,
        dolares: Number(v.dolares.toFixed(2)),
        unidades: v.unidades,
      }))
      .sort((a, b) => b.dolares - a.dolares);
  }

  const resultado = {
    encontrado: true,
    cliente: {
      codigo_cliente: cliente.codigo_cliente,
      nombre_cliente: cliente.nombre_cliente,
      nombre_comercial_cliente: cliente.nombre_comercial_cliente,
    },
    filtros: {
      categoria: categoriaParam,
      producto: productoResuelto
        ? { codigo_producto: productoResuelto.codigo_producto, nombre_producto: productoResuelto.nombre_producto }
        : null,
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
  if (porProducto) resultado.por_producto = porProducto;

  return resultado;
}

module.exports = { ventasCliente, inputSchema };
