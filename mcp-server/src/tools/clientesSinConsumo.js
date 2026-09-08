// src/tools/clientesSinConsumo.js
// Universo COMPLETO de clientes de un grupo/canal (no solo quienes compraron)
// que NO compraron una categoría de producto en un rango de fechas — para
// reportes tipo "consumo cero" recurrentes (ej. "clientes de EMPRESAS sin
// compra de BOTELLÓN esta semana"), que un usuario de negocio pueda pedir él
// mismo con un prompt simple en vez de que se arme a mano cada vez.
//
// Construida a partir de un reporte real (consumo cero EMPRESAS/BOTELLÓN
// semanal, 2026-09-08) que encontró y corrigió 2 problemas de fondo que esta
// tool ya trae resueltos de fábrica, no como parche:
//   1. `dias_desde_ultima` con aritmética de SOLO FECHA (no timestamp
//      completo) — dos documentos con la misma fecha calendario pero
//      distinta hora del día daban "días" distintos si se restaba el
//      timestamp completo contra medianoche de hoy y se truncaba con floor.
//   2. Duplicados de maestro de clientes (mismo identificacion_cliente +
//      company_id + nombre_cliente EXACTO bajo 2+ codigo_cliente) se
//      consolidan automáticamente en una sola fila, quedándose con la fecha
//      de última compra más reciente entre los códigos duplicados — no es
//      una decisión de negocio caso a caso, es limpieza de datos sobre un
//      hecho verificable (mismo RUC+compañía+nombre).
//
// No soporta PREVENTA: ese grupo tiene su propio mecanismo de clasificación
// (FILTRO_PREVENTA_SELLER, status=5, fecha_entrega, filtro condicional de
// guía — ver clasificacion.js) que no encaja en el patrón CASE_GRUPO_*/
// fecha_creacion que usa esta tool. Pedirlo para PREVENTA es un error de
// validación explícito, no un resultado silenciosamente incorrecto.
const { z } = require("zod");
const { pool } = require("../db");
const { finExclusivo, diffDias } = require("../util/fechas");
const {
  CASE_GRUPO_ORDENES,
  FILTRO_ORDENES_GRUPO_VALIDO,
  CASE_GRUPO_FACTURAS,
  GRUPOS_VALIDOS,
  CATEGORIAS_VALIDAS,
  FILTRO_CLIENTE_VALIDO,
} = require("../sql/clasificacion");

const MAX_RANGO_DIAS = 400;
const LIMITE_DEFAULT = 300;
const LIMITE_MAX = 1000;

const GRUPOS_SOPORTADOS = GRUPOS_VALIDOS.filter((g) => g !== "PREVENTA");

const inputSchema = {
  grupo: z.enum(GRUPOS_SOPORTADOS),
  categoria: z.enum(CATEGORIAS_VALIDAS),
  fecha_inicio: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  fecha_fin: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  limite: z.number().int().min(1).max(LIMITE_MAX).default(LIMITE_DEFAULT),
};

// Universo crudo: cualquier documento (SIN filtrar status) que el CASE
// clasifique en este grupo — a propósito sin exigir status=2, para poder
// distinguir después "sin facturación formal" (documento existe pero nunca
// llegó a posteado) de "consumo cero real" (sí factura, solo que no de esta
// categoría/periodo). $1 = grupo.
const SQL_UNIVERSO = `
  SELECT DISTINCT customer_code FROM (
    SELECT o.customer_code
    FROM ordenes o
    WHERE o.origen_sistema = 'MOBILVENDOR'
      AND ${FILTRO_ORDENES_GRUPO_VALIDO}
      AND ${FILTRO_CLIENTE_VALIDO("o.customer_code")}
      AND (${CASE_GRUPO_ORDENES}) = $1

    UNION ALL

    SELECT f.customer_code
    FROM facturas f
    WHERE ${FILTRO_CLIENTE_VALIDO("f.customer_code")}
      AND (${CASE_GRUPO_FACTURAS}) = $1

    UNION ALL

    SELECT o.customer_code
    FROM ordenes o
    WHERE o.equipo_ventas = 'Website'
      AND ${FILTRO_CLIENTE_VALIDO("o.customer_code")}
      AND $1 = 'DOMICILIO'
  ) x;
`;

// Clientes con AL MENOS un documento status=2 (cualquier categoría) en este
// grupo — "tiene facturación formal", sin importar si fue de la categoría
// pedida. $1 = grupo.
const SQL_FORMAL = `
  SELECT DISTINCT customer_code FROM (
    SELECT o.customer_code
    FROM ordenes o
    WHERE o.origen_sistema = 'MOBILVENDOR' AND o.status = 2
      AND ${FILTRO_ORDENES_GRUPO_VALIDO}
      AND ${FILTRO_CLIENTE_VALIDO("o.customer_code")}
      AND (${CASE_GRUPO_ORDENES}) = $1

    UNION ALL

    SELECT f.customer_code
    FROM facturas f
    WHERE f.status = 2
      AND ${FILTRO_CLIENTE_VALIDO("f.customer_code")}
      AND (${CASE_GRUPO_FACTURAS}) = $1

    UNION ALL

    SELECT o.customer_code
    FROM ordenes o
    WHERE o.equipo_ventas = 'Website' AND o.status = 2
      AND ${FILTRO_CLIENTE_VALIDO("o.customer_code")}
      AND $1 = 'DOMICILIO'
  ) x;
`;

// Última compra POSTEADA de la categoría pedida, en cualquier fecha (no solo
// el rango) — excluye notas de crédito (out_refund), una devolución no es
// una compra. $1 = grupo, $2 = categoria.
const SQL_ULTIMA_COMPRA = `
  SELECT customer_code, MAX(fecha) AS ultima FROM (
    SELECT o.customer_code, o.fecha_creacion AS fecha
    FROM ordenes o
    JOIN detalle_documento dd ON dd.documento_code = o.code
    WHERE o.origen_sistema = 'MOBILVENDOR' AND o.status = 2
      AND ${FILTRO_ORDENES_GRUPO_VALIDO}
      AND ${FILTRO_CLIENTE_VALIDO("o.customer_code")}
      AND (${CASE_GRUPO_ORDENES}) = $1
      AND dd.descripcion_categoria = $2

    UNION ALL

    SELECT f.customer_code, f.fecha_creacion AS fecha
    FROM facturas f
    JOIN detalle_documento dd ON dd.documento_code = f.code
    WHERE f.status = 2 AND f.tipo_movimiento = 'out_invoice'
      AND ${FILTRO_CLIENTE_VALIDO("f.customer_code")}
      AND (${CASE_GRUPO_FACTURAS}) = $1
      AND dd.descripcion_categoria = $2

    UNION ALL

    SELECT o.customer_code, o.fecha_creacion AS fecha
    FROM ordenes o
    JOIN detalle_documento dd ON dd.documento_code = o.code
    WHERE o.equipo_ventas = 'Website' AND o.status = 2
      AND ${FILTRO_CLIENTE_VALIDO("o.customer_code")}
      AND $1 = 'DOMICILIO'
      AND dd.descripcion_categoria = $2
  ) x
  GROUP BY customer_code;
`;

// Clientes que SÍ compraron la categoría pedida DENTRO del rango pedido
// (para excluirlos del reporte de "sin consumo"). $1 = grupo, $2 = categoria,
// $3 = inicio, $4 = fin exclusivo.
const SQL_COMPRARON_EN_RANGO = `
  SELECT DISTINCT customer_code FROM (
    SELECT o.customer_code, o.fecha_creacion AS fecha
    FROM ordenes o
    JOIN detalle_documento dd ON dd.documento_code = o.code
    WHERE o.origen_sistema = 'MOBILVENDOR' AND o.status = 2
      AND ${FILTRO_ORDENES_GRUPO_VALIDO}
      AND ${FILTRO_CLIENTE_VALIDO("o.customer_code")}
      AND (${CASE_GRUPO_ORDENES}) = $1
      AND dd.descripcion_categoria = $2

    UNION ALL

    SELECT f.customer_code, f.fecha_creacion AS fecha
    FROM facturas f
    JOIN detalle_documento dd ON dd.documento_code = f.code
    WHERE f.status = 2 AND f.tipo_movimiento = 'out_invoice'
      AND ${FILTRO_CLIENTE_VALIDO("f.customer_code")}
      AND (${CASE_GRUPO_FACTURAS}) = $1
      AND dd.descripcion_categoria = $2

    UNION ALL

    SELECT o.customer_code, o.fecha_creacion AS fecha
    FROM ordenes o
    JOIN detalle_documento dd ON dd.documento_code = o.code
    WHERE o.equipo_ventas = 'Website' AND o.status = 2
      AND ${FILTRO_CLIENTE_VALIDO("o.customer_code")}
      AND $1 = 'DOMICILIO'
      AND dd.descripcion_categoria = $2
  ) x
  WHERE fecha >= $3 AND fecha < $4;
`;

const SQL_NOMBRES = `
  SELECT codigo_cliente, COALESCE(nombre_comercial_cliente, nombre_cliente) AS nombre
  FROM clientes WHERE codigo_cliente = ANY($1::text[]);
`;

// Duplicados de maestro dentro del universo pedido: mismo identificacion_cliente
// + company_id + nombre_cliente EXACTO bajo 2+ codigo_cliente distintos —
// hecho verificable, no ambigüedad de negocio (ver comentario del archivo).
const SQL_DUPLICADOS = `
  SELECT array_agg(codigo_cliente ORDER BY codigo_cliente) AS codigos
  FROM clientes
  WHERE codigo_cliente = ANY($1::text[])
    AND identificacion_cliente IS NOT NULL AND TRIM(identificacion_cliente) <> ''
  GROUP BY identificacion_cliente, company_id, nombre_cliente
  HAVING COUNT(*) > 1;
`;

function fechaSoloDia(valor) {
  const iso = (valor instanceof Date ? valor : new Date(valor)).toISOString().slice(0, 10);
  return new Date(`${iso}T00:00:00Z`);
}

async function clientesSinConsumo({ grupo, categoria, fecha_inicio, fecha_fin, limite }) {
  const largoDias = diffDias(fecha_inicio, fecha_fin);
  if (largoDias < 0) throw new Error("fecha_inicio no puede ser posterior a fecha_fin");
  if (largoDias > MAX_RANGO_DIAS) throw new Error(`rango máximo permitido: ${MAX_RANGO_DIAS} días`);

  const inicioTs = `${fecha_inicio} 00:00:00`;
  const finTs = `${finExclusivo(fecha_fin)} 00:00:00`;
  const limiteReal = limite ?? LIMITE_DEFAULT;
  const hoy = fechaSoloDia(new Date());

  const [
    { rows: universoRows },
    { rows: formalRows },
    { rows: ultimaRows },
    { rows: compraronRows },
  ] = await Promise.all([
    pool.query(SQL_UNIVERSO, [grupo]),
    pool.query(SQL_FORMAL, [grupo]),
    pool.query(SQL_ULTIMA_COMPRA, [grupo, categoria]),
    pool.query(SQL_COMPRARON_EN_RANGO, [grupo, categoria, inicioTs, finTs]),
  ]);

  const conFacturacionFormal = new Set(formalRows.map((r) => r.customer_code));
  const compraronEnRango = new Set(compraronRows.map((r) => r.customer_code));
  const mapUltima = new Map(ultimaRows.map((r) => [r.customer_code, r.ultima]));

  const codigosUniverso = universoRows.map((r) => r.customer_code);
  const { rows: nombresRows } = await pool.query(SQL_NOMBRES, [codigosUniverso]);
  const mapNombre = new Map(nombresRows.map((r) => [r.codigo_cliente, (r.nombre || "").replace(/\s+/g, " ").trim()]));

  let clientes = [];
  for (const codigo of codigosUniverso) {
    if (compraronEnRango.has(codigo)) continue;

    const sinFacturacionFormal = !conFacturacionFormal.has(codigo);
    const ultimaRaw = mapUltima.get(codigo) || null;
    const ultimaDia = ultimaRaw ? fechaSoloDia(ultimaRaw) : null;
    const dias = ultimaDia ? Math.round((hoy - ultimaDia) / 86400000) : null;

    let clasificacion;
    if (sinFacturacionFormal) clasificacion = "SIN_FACTURACION_FORMAL";
    else if (ultimaDia === null) clasificacion = `NUNCA_COMPRO_${categoria}`;
    else clasificacion = "CONSUMO_CERO";

    clientes.push({
      codigos: [codigo],
      nombre: mapNombre.get(codigo) || null,
      ultimaDia,
      dias,
      clasificacion,
    });
  }

  // Consolidar duplicados de maestro (mismo RUC+compañía+nombre exacto):
  // se queda con la fecha MÁS RECIENTE entre los códigos duplicados.
  const { rows: dupRows } = await pool.query(SQL_DUPLICADOS, [codigosUniverso]);
  const porCodigo = new Map();
  clientes.forEach((c, i) => porCodigo.set(c.codigos[0], i));
  let duplicadosConsolidados = 0;
  for (const { codigos: grupoDup } of dupRows) {
    const indices = grupoDup.map((c) => porCodigo.get(c)).filter((i) => i !== undefined);
    if (indices.length < 2) continue; // alguno ya compró en el rango, no aplica acá
    const filasDup = indices.map((i) => clientes[i]);
    const mejor = filasDup.reduce((a, b) => {
      if (a.dias === null) return b;
      if (b.dias === null) return a;
      return a.dias <= b.dias ? a : b;
    });
    mejor.codigos = grupoDup;
    clientes[indices[0]] = mejor;
    for (const i of indices.slice(1)) clientes[i] = null;
    duplicadosConsolidados++;
  }
  clientes = clientes.filter((c) => c !== null);

  clientes.sort((a, b) => {
    const rank = { CONSUMO_CERO: 0 };
    const ra = rank[a.clasificacion] ?? (a.clasificacion === "SIN_FACTURACION_FORMAL" ? 2 : 1);
    const rb = rank[b.clasificacion] ?? (b.clasificacion === "SIN_FACTURACION_FORMAL" ? 2 : 1);
    if (ra !== rb) return ra - rb;
    return (b.dias ?? 99999) - (a.dias ?? 99999);
  });

  const total = clientes.length;
  const devueltos = clientes.slice(0, limiteReal);

  return {
    grupo,
    categoria,
    fecha_inicio,
    fecha_fin,
    universo_total: codigosUniverso.length - duplicadosConsolidados,
    compraron_en_periodo: compraronEnRango.size,
    sin_consumo_total: total,
    sin_consumo_devueltos: devueltos.length,
    duplicados_consolidados: duplicadosConsolidados,
    clientes: devueltos.map((c) => ({
      codigo_cliente: c.codigos.join("+"),
      nombre_cliente: c.nombre,
      ultima_compra: c.ultimaDia ? c.ultimaDia.toISOString().slice(0, 10) : null,
      dias_desde_ultima: c.dias,
      clasificacion: c.clasificacion,
    })),
  };
}

module.exports = { clientesSinConsumo, inputSchema };
