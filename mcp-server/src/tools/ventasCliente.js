// src/tools/ventasCliente.js
// Historial de ventas de un cliente específico, buscado por nombre parcial
// (el usuario no escribe el nombre exacto tal cual está en la base).
// Filtros opcionales combinables (AND) por categoría de producto y/o por
// un producto específico (también buscado por nombre parcial).
//
// Caso multi-compañía: una misma entidad (mismo identificacion_cliente/RUC,
// mismo nombre) puede existir varias veces en `clientes` con distinto
// codigo_cliente porque está facturada desde distintas compañías del grupo
// (company_id/descripcion_company — GRUPOAQUA S.A., DISTRINTER, IIBC, etc.).
// Cuando la búsqueda por nombre cae en ese caso, no se trata como una
// ambigüedad genérica: se informa explícitamente (`es_multicompania`) para
// que el asistente pueda preguntar en términos de negocio ("¿las tres
// compañías o solo una?") en vez de un código sin contexto. La respuesta
// puede entonces repetirse pasando `codigo_cliente` (uno o varios) para
// pedir el consolidado o una compañía puntual sin volver a resolver el
// nombre.
//
// Nombres incompletos/con errores: la búsqueda por nombre normaliza tildes
// y mayúsculas con unaccent() (sin umbral, no es difusa). Si aun así da
// cero resultados (typo, palabra faltante), corre un fallback de similitud
// (pg_trgm) y devuelve una lista de `sugerencias` — nunca se autoselecciona
// ninguna, es solo un "¿quisiste decir...?" para que el asistente confirme.
const { z } = require("zod");
const { pool } = require("../db");
const { finExclusivo, diffDias } = require("../util/fechas");
const { CATEGORIAS_VALIDAS } = require("../sql/clasificacion");

const MAX_RANGO_DIAS = 800; // "los últimos meses" puede ser un rango largo
const MAX_CANDIDATOS = 20;
const MIN_LARGO_NOMBRE = 3;
const MAX_CODIGOS_CLIENTE = 10;
const UMBRAL_SIMILITUD_SUGERENCIA = 0.3;
const MAX_SUGERENCIAS = 5;

const inputSchema = {
  nombre_cliente: z.string().min(MIN_LARGO_NOMBRE, `mínimo ${MIN_LARGO_NOMBRE} caracteres`).optional(),
  codigo_cliente: z
    .array(z.string().min(1))
    .min(1)
    .max(MAX_CODIGOS_CLIENTE, `máximo ${MAX_CODIGOS_CLIENTE} códigos por consulta`)
    .optional(),
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

// unaccent(...) ILIKE unaccent($1): normaliza tildes/mayúsculas en ambos
// lados de la comparación — es corrección exacta, no búsqueda difusa (sin
// umbral, sin falsos positivos posibles).
const SQL_BUSCAR_CLIENTE = `
  SELECT codigo_cliente, nombre_cliente, nombre_comercial_cliente,
         identificacion_cliente, company_id, descripcion_company
  FROM clientes
  WHERE unaccent(nombre_cliente) ILIKE unaccent($1) OR unaccent(nombre_comercial_cliente) ILIKE unaccent($1)
  ORDER BY nombre_cliente
  LIMIT ${MAX_CANDIDATOS + 1};
`;

// Fallback de similitud (pg_trgm) — SOLO se corre cuando la búsqueda exacta
// de arriba da cero resultados. $1 = texto crudo (NO el patrón %...% de
// ILIKE, similarity() no es un wildcard match), $2 = umbral, $3 = tope.
// Es una sugerencia "¿quisiste decir...?", nunca se autoselecciona.
const SQL_SUGERENCIAS_CLIENTE = `
  SELECT codigo_cliente, nombre_cliente, nombre_comercial_cliente,
         GREATEST(similarity(unaccent(nombre_cliente), unaccent($1)),
                  similarity(unaccent(nombre_comercial_cliente), unaccent($1))) AS similitud
  FROM clientes
  WHERE similarity(unaccent(nombre_cliente), unaccent($1)) > $2
     OR similarity(unaccent(nombre_comercial_cliente), unaccent($1)) > $2
  ORDER BY similitud DESC
  LIMIT $3;
`;

// $1 = lista de codigo_cliente (uno o varios, ya resueltos o pedidos directo)
const SQL_CLIENTES_POR_CODIGO = `
  SELECT codigo_cliente, nombre_cliente, nombre_comercial_cliente,
         identificacion_cliente, company_id, descripcion_company
  FROM clientes
  WHERE codigo_cliente = ANY($1::text[]);
`;

const SQL_BUSCAR_PRODUCTO = `
  SELECT codigo_producto, nombre_producto
  FROM productos
  WHERE nombre_producto ILIKE $1
  ORDER BY nombre_producto
  LIMIT ${MAX_CANDIDATOS + 1};
`;

// $1 = lista de codigo_cliente (uno o varios), $2 = inicio (timestamp),
// $3 = fin exclusivo (timestamp), $4 = categoria (o NULL), $5 = codigo_producto (o NULL)
const SQL_HISTORIAL = `
  WITH base AS (
    SELECT
      o.fecha_creacion AS fecha,
      o.customer_code AS codigo_cliente_fila,
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
      AND o.customer_code = ANY($1::text[])
      AND o.fecha_creacion >= $2
      AND o.fecha_creacion <  $3
      AND ($4::text IS NULL OR dd.descripcion_categoria = $4)
      AND ($5::text IS NULL OR dd.codigo_producto = $5)

    UNION ALL

    SELECT
      f.fecha_creacion AS fecha,
      f.customer_code AS codigo_cliente_fila,
      f.customer_address_code AS direccion_code,
      dd.codigo_producto AS producto_code,
      dd.descripcion AS producto_descripcion,
      CASE WHEN f.tipo_movimiento = 'out_refund' THEN -dd.cantidad ELSE dd.cantidad END AS unidades,
      CASE WHEN f.tipo_movimiento = 'out_refund' THEN -dd.total    ELSE dd.total    END AS dolares,
      f.code AS doc_code
    FROM facturas f
    JOIN detalle_documento dd ON dd.documento_code = f.code
    WHERE f.status = 2
      AND f.customer_code = ANY($1::text[])
      AND f.fecha_creacion >= $2
      AND f.fecha_creacion <  $3
      AND ($4::text IS NULL OR dd.descripcion_categoria = $4)
      AND ($5::text IS NULL OR dd.codigo_producto = $5)
  )
  SELECT
    to_char(date_trunc('month', fecha), 'YYYY-MM') AS mes,
    codigo_cliente_fila,
    direccion_code,
    producto_code,
    producto_descripcion,
    SUM(unidades) AS unidades,
    SUM(dolares)  AS dolares,
    COUNT(DISTINCT doc_code) AS num_documentos
  FROM base
  GROUP BY mes, codigo_cliente_fila, direccion_code, producto_code, producto_descripcion
  ORDER BY mes;
`;

// $1 = lista de codigo_cliente (puede ser más de uno en el caso multi-compañía)
const SQL_DIRECCIONES = `
  SELECT codigo_direccion_cliente, descripcion_direccion_cliente, calle1_direccion_cliente
  FROM direcciones_clientes
  WHERE codigo_cliente = ANY($1::text[])
    AND codigo_direccion_cliente = ANY($2::text[]);
`;

const SQL_NOMBRES_PRODUCTOS = `
  SELECT codigo_producto, nombre_producto
  FROM productos
  WHERE codigo_producto = ANY($1::text[]);
`;

async function buscarSugerenciasCliente(textoCrudo) {
  const { rows } = await pool.query(SQL_SUGERENCIAS_CLIENTE, [
    textoCrudo,
    UMBRAL_SIMILITUD_SUGERENCIA,
    MAX_SUGERENCIAS,
  ]);
  return rows.map((r) => ({
    codigo_cliente: r.codigo_cliente,
    nombre_cliente: r.nombre_cliente,
    nombre_comercial_cliente: r.nombre_comercial_cliente,
    similitud: Number(r.similitud.toFixed(2)),
  }));
}

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

async function ventasCliente({ nombre_cliente, codigo_cliente, fecha_inicio, fecha_fin, categoria, producto }) {
  const largoDias = diffDias(fecha_inicio, fecha_fin);
  if (largoDias < 0) throw new Error("fecha_inicio no puede ser posterior a fecha_fin");
  if (largoDias > MAX_RANGO_DIAS) throw new Error(`rango máximo permitido: ${MAX_RANGO_DIAS} días`);
  if (!nombre_cliente && !(codigo_cliente && codigo_cliente.length > 0)) {
    throw new Error("se requiere nombre_cliente o codigo_cliente");
  }

  // 1) Resolver cliente(s). Si viene `codigo_cliente` explícito (típicamente
  //    una llamada de seguimiento tras un resultado es_multicompania), se usa
  //    directo y no se vuelve a resolver por nombre.
  let clientesResueltos;
  let codigosNoEncontrados = [];

  if (codigo_cliente && codigo_cliente.length > 0) {
    const { rows } = await pool.query(SQL_CLIENTES_POR_CODIGO, [codigo_cliente]);
    if (rows.length === 0) {
      return { encontrado: false, motivo: "codigo_cliente_no_encontrado", codigos_solicitados: codigo_cliente };
    }
    clientesResueltos = rows;
    codigosNoEncontrados = codigo_cliente.filter((c) => !rows.some((r) => r.codigo_cliente === c));
  } else {
    const patronCliente = `%${escaparComodinesLike(nombre_cliente)}%`;
    const resultCliente = await buscarUno(SQL_BUSCAR_CLIENTE, patronCliente, [
      "codigo_cliente",
      "nombre_cliente",
      "nombre_comercial_cliente",
      "identificacion_cliente",
      "company_id",
      "descripcion_company",
    ]);
    if (resultCliente.estado === "sin_coincidencias") {
      const sugerencias = await buscarSugerenciasCliente(nombre_cliente);
      return { encontrado: false, motivo: "sin_coincidencias_cliente", candidatos: [], sugerencias };
    }
    if (resultCliente.estado === "coincidencias_multiples") {
      const candidatos = resultCliente.candidatos;
      const identificacionesUnicas = new Set(candidatos.map((c) => c.identificacion_cliente).filter(Boolean));
      const nombresUnicos = new Set(candidatos.map((c) => c.nombre_cliente));
      // Multi-compañía real: es la MISMA entidad (mismo RUC/cédula y mismo
      // nombre), solo facturada desde distintas compañías del grupo — no
      // clientes distintos que coinciden de nombre por casualidad.
      const esMismaEntidad =
        !resultCliente.truncado &&
        candidatos.every((c) => c.identificacion_cliente) &&
        identificacionesUnicas.size === 1 &&
        nombresUnicos.size === 1;

      if (esMismaEntidad) {
        return {
          encontrado: false,
          motivo: "cliente_multicompania",
          es_multicompania: true,
          cliente: {
            nombre_cliente: candidatos[0].nombre_cliente,
            nombre_comercial_cliente: candidatos[0].nombre_comercial_cliente,
            identificacion_cliente: candidatos[0].identificacion_cliente,
          },
          companias: candidatos.map((c) => ({
            codigo_cliente: c.codigo_cliente,
            company_id: c.company_id,
            descripcion_company: c.descripcion_company,
          })),
        };
      }

      return {
        encontrado: false,
        motivo: "coincidencias_multiples_cliente",
        candidatos: candidatos.map(({ codigo_cliente: cc, nombre_cliente: nc, nombre_comercial_cliente: ncc }) => ({
          codigo_cliente: cc,
          nombre_cliente: nc,
          nombre_comercial_cliente: ncc,
        })),
        candidatos_truncados: resultCliente.truncado,
      };
    }
    clientesResueltos = [resultCliente.fila];
  }

  // Forma resumida del/los cliente(s) resuelto(s), reutilizada en las
  // respuestas de error de abajo y en el resultado final.
  const clienteInfoResumen =
    clientesResueltos.length === 1
      ? {
          codigo_cliente: clientesResueltos[0].codigo_cliente,
          nombre_cliente: clientesResueltos[0].nombre_cliente,
          nombre_comercial_cliente: clientesResueltos[0].nombre_comercial_cliente,
        }
      : {
          nombre_cliente: clientesResueltos[0].nombre_cliente,
          nombre_comercial_cliente: clientesResueltos[0].nombre_comercial_cliente,
          es_multicompania: true,
          companias: clientesResueltos.map((c) => ({
            codigo_cliente: c.codigo_cliente,
            company_id: c.company_id,
            descripcion_company: c.descripcion_company,
          })),
        };

  // 2) Resolver producto, solo si se pidió.
  let productoResuelto = null;
  if (producto) {
    const patronProducto = `%${escaparComodinesLike(producto)}%`;
    const resultProducto = await buscarUno(SQL_BUSCAR_PRODUCTO, patronProducto, ["codigo_producto", "nombre_producto"]);
    if (resultProducto.estado === "sin_coincidencias") {
      return {
        encontrado: false,
        motivo: "sin_coincidencias_producto",
        cliente: clienteInfoResumen,
        candidatos_producto: [],
      };
    }
    if (resultProducto.estado === "coincidencias_multiples") {
      return {
        encontrado: false,
        motivo: "coincidencias_multiples_producto",
        cliente: clienteInfoResumen,
        candidatos_producto: resultProducto.candidatos,
        candidatos_producto_truncados: resultProducto.truncado,
      };
    }
    productoResuelto = resultProducto.fila;
  }

  // 3) Historial de ventas, con categoria/producto como filtros opcionales.
  //    codigosClientes puede tener más de un elemento (consolidado
  //    multi-compañía); SQL_HISTORIAL filtra con ANY(...) y devuelve también
  //    el codigo_cliente de cada fila para poder desglosar por compañía.
  const codigosClientes = clientesResueltos.map((c) => c.codigo_cliente);
  const inicioTs = `${fecha_inicio} 00:00:00`;
  const finTs = `${finExclusivo(fecha_fin)} 00:00:00`;
  const categoriaParam = categoria || null;
  const productoParam = productoResuelto ? productoResuelto.codigo_producto : null;

  const { rows: filas } = await pool.query(SQL_HISTORIAL, [
    codigosClientes,
    inicioTs,
    finTs,
    categoriaParam,
    productoParam,
  ]);

  const porMesMap = new Map();
  const porDireccionMap = new Map();
  const porProductoMap = new Map();
  const porCompaniaMap = new Map();
  let dolaresTotales = 0;
  let unidadesTotales = 0;
  let numDocumentosTotal = 0;

  for (const f of filas) {
    const dolares = Number(f.dolares) || 0;
    const unidades = Number(f.unidades) || 0;
    const numDocumentos = Number(f.num_documentos) || 0;
    dolaresTotales += dolares;
    unidadesTotales += unidades;
    numDocumentosTotal += numDocumentos;

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

    const companiaActual = porCompaniaMap.get(f.codigo_cliente_fila) || { dolares: 0, unidades: 0, num_documentos: 0 };
    companiaActual.dolares += dolares;
    companiaActual.unidades += unidades;
    companiaActual.num_documentos += numDocumentos;
    porCompaniaMap.set(f.codigo_cliente_fila, companiaActual);
  }

  const direccionesCodigos = [...porDireccionMap.keys()].filter((k) => k !== "SIN_DIRECCION");
  let descripcionesPorCodigo = {};
  if (direccionesCodigos.length > 0) {
    const { rows: direcciones } = await pool.query(SQL_DIRECCIONES, [codigosClientes, direccionesCodigos]);
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

  // por_compania: SIEMPRE que se consulta más de un codigo_cliente a la vez
  // (consolidado multi-compañía), para que el total nunca se entregue como
  // un número ciego — siempre auditable contra su desglose.
  let porCompania;
  if (clientesResueltos.length > 1) {
    porCompania = clientesResueltos
      .map((c) => {
        const v = porCompaniaMap.get(c.codigo_cliente) || { dolares: 0, unidades: 0, num_documentos: 0 };
        return {
          codigo_cliente: c.codigo_cliente,
          company_id: c.company_id,
          descripcion_company: c.descripcion_company,
          dolares: Number(v.dolares.toFixed(2)),
          unidades: v.unidades,
          num_documentos: v.num_documentos,
        };
      })
      .sort((a, b) => b.dolares - a.dolares);
  }

  const resultado = {
    encontrado: true,
    cliente: clienteInfoResumen,
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
  if (porCompania) resultado.por_compania = porCompania;
  if (codigosNoEncontrados.length > 0) resultado.codigos_no_encontrados = codigosNoEncontrados;

  return resultado;
}

module.exports = { ventasCliente, inputSchema };
