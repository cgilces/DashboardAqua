// src/sql/clasificacion.js
// Fuente única de la clasificación por grupo de ruta (seller_code/route_code),
// portada tal cual del patrón ya validado en producción en
// backend/controllers/controllerBotellones/botellonesController.js (objeto
// GRUPOS + el SQL de obtenerGrupoBotellon), pero generalizada a TODAS las
// categorías de producto — el backend original la usa solo para BOTELLÓN.
//
// Son fragmentos de texto SQL ESTÁTICOS (constantes de código, no vienen de
// input de usuario) — el ruta/grupo/fechas que sí vienen del usuario siempre
// se pasan como parámetros $1, $2, ... en cada tool, nunca concatenados aquí.

// Usado en la rama de `ordenes` (alias o). MobilVendor solo genera "ordenes"
// para estos 5 canales; DOMICILIO/EMPRESAS/VIP/QUITO llegan vía `facturas`
// (Odoo) o vía el pedido web (ver CTE_WEBSITE).
const CASE_GRUPO_ORDENES = `
  CASE
    WHEN o.seller_code ILIKE 'M%'  THEN 'MAYORISTA'
    WHEN o.seller_code ILIKE 'TV%' THEN 'TIENDAS_VIP'
    WHEN o.seller_code ILIKE 'T%'  AND o.seller_code NOT ILIKE 'TV%' THEN 'TIENDAS'
    WHEN o.seller_code ILIKE 'R%'  THEN 'RURAL'
    WHEN o.seller_code = '148399'  THEN 'TELEVENTA_VIP'
  END
`;

// Solo estos seller_code de `ordenes` tienen grupo conocido (ver comentario arriba).
const FILTRO_ORDENES_GRUPO_VALIDO = `
  (
    o.seller_code ILIKE 'M%'
    OR o.seller_code ILIKE 'TV%'
    OR (o.seller_code ILIKE 'T%' AND o.seller_code NOT ILIKE 'TV%')
    OR o.seller_code ILIKE 'R%'
    OR o.seller_code = '148399'
  )
`;

// Usado en la rama de `facturas` (alias f). Cubre todos los grupos.
// 'OTROS' es un catch-all deliberado (facturas que no calzan ningún canal
// conocido) — nunca se expone como grupo válido hacia afuera.
const CASE_GRUPO_FACTURAS = `
  CASE
    WHEN f.seller_code IN ('A1','A2','A3','A4.1','A5','A6','A7','TA2') THEN 'DOMICILIO'
    WHEN f.seller_code ILIKE 'M%' THEN 'MAYORISTA'
    WHEN f.seller_code ILIKE 'E%' THEN 'EMPRESAS'
    WHEN f.seller_code ILIKE 'R%' THEN 'RURAL'
    WHEN f.seller_code ILIKE 'TV%' THEN 'TIENDAS_VIP'
    WHEN f.seller_code ILIKE 'T%' AND f.seller_code NOT ILIKE 'TV%' THEN 'TIENDAS'
    WHEN f.codigo_tipo_negocio = '29' THEN 'VIP'
    WHEN f.seller_code = 'U1' THEN 'QUITO'
    ELSE 'OTROS'
  END
`;

// Suma con signo para `facturas`: las notas de crédito (tipo_movimiento =
// 'out_refund') se RESTAN en vez de excluirse, igual que en
// botellonesController.signedSumFactura.
const signedCol = (aliasFactura, aliasDetalle, campo) =>
  `CASE WHEN ${aliasFactura}.tipo_movimiento = 'out_refund' THEN -${aliasDetalle}.${campo} ELSE ${aliasDetalle}.${campo} END`;

// Grupos válidos que se exponen hacia las tools (excluye 'OTROS' y NULL).
// 'PREVENTA' es distinto a los demás: no encaja en el CASE de arriba (ese es
// el patrón de botellonesController.js) — tiene su propia clasificación y
// hasta su propio status válido, ver filtroPreventa() más abajo.
const GRUPOS_VALIDOS = [
  "MAYORISTA",
  "TIENDAS_VIP",
  "TIENDAS",
  "RURAL",
  "TELEVENTA_VIP",
  "DOMICILIO",
  "EMPRESAS",
  "VIP",
  "QUITO",
  "PREVENTA",
];

// Categorías de producto reales (detalle_documento.descripcion_categoria),
// confirmadas contra datos reales — se excluyen los "All / ..." genéricos de
// Odoo (sin valor de negocio, son un catch-all de sincronización).
const CATEGORIAS_VALIDAS = [
  "BOTELLÓN",
  "DESCARTABLE",
  "HIELO",
  "CAFÉ",
  "PLUS",
  "SUSCRIPCION",
  "PT-DISTRINTER",
  "PT-COTTSA",
  "PT-IIBC",
  "SERVICIOS",
  "GASTOS GENERALES",
];

// ============================================================
// PREVENTA — portado de ventasController.js (obtenerRankingRutasDescartable):
// clasificación por seller_code con una regla de transición POR FECHA:
//   < 2026-03-01           → solo 'R%' (excluye 'PVR%')
//   2026-03-01 .. 2026-04-01 (exclusive) → 'R%' O 'PVR%' (mes de transición)
//   >= 2026-04-01           → solo 'PVR%'
//
// El código original de ventasController.js decide UNA regla por (año, mes)
// completo (llama la función una vez por mes consultado). Las tools de este
// MCP aceptan un rango de fechas arbitrario que puede CRUZAR esas fronteras
// (ej. 15-feb a 15-abr 2026) — por eso este filtro evalúa la regla POR FILA,
// usando la fecha de cada fila, en vez de una sola regla para todo el rango.
// Para cualquier rango que caiga completo dentro de una sola era, esto da
// exactamente el mismo resultado que el código original.
// ============================================================
const PREVENTA_TRANSICION_INICIO = "2026-03-01 00:00:00";
const PREVENTA_TRANSICION_FIN = "2026-04-01 00:00:00";

// aliasFecha: expresión SQL de la fecha de la fila (ej. "o.fecha_creacion" o
//             "COALESCE(f.fecha_entrega, f.fecha_creacion)")
// aliasSeller: expresión SQL del seller_code de la fila (ej. "o.seller_code")
const filtroPreventa = (aliasFecha, aliasSeller) => `
  (
    (${aliasFecha} <  '${PREVENTA_TRANSICION_INICIO}'
      AND ${aliasSeller} ILIKE 'R%' AND ${aliasSeller} NOT ILIKE 'PVR%')
    OR
    (${aliasFecha} >= '${PREVENTA_TRANSICION_INICIO}' AND ${aliasFecha} < '${PREVENTA_TRANSICION_FIN}'
      AND (${aliasSeller} ILIKE 'R%' OR ${aliasSeller} ILIKE 'PVR%'))
    OR
    (${aliasFecha} >= '${PREVENTA_TRANSICION_FIN}'
      AND ${aliasSeller} ILIKE 'PVR%')
  )
`;

module.exports = {
  CASE_GRUPO_ORDENES,
  FILTRO_ORDENES_GRUPO_VALIDO,
  CASE_GRUPO_FACTURAS,
  signedCol,
  GRUPOS_VALIDOS,
  CATEGORIAS_VALIDAS,
  filtroPreventa,
  PREVENTA_TRANSICION_INICIO,
  PREVENTA_TRANSICION_FIN,
};
