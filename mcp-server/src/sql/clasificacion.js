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
// hasta su propio status válido, ver FILTRO_PREVENTA_SELLER más abajo.
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
// PREVENTA — portado de ventasController.calcularKPIsMes, la función que
// genera el ranking real que ve un gerente en el dashboard (confirmado
// palabra por palabra contra un cuadro real de agosto 2026, ruta por ruta).
//
// OJO: una versión anterior de este archivo usaba la lógica de
// "RANKING RUTAS R (R%/PVR%)" (obtenerRankingRutasDescartable) para
// PREVENTA — eso fue un ERROR: esa función es sobre una migración de
// nomenclatura de rutas rurales (R% pasando a llamarse PVR%), NO sobre
// PREVENTA.
//
// CORRECCIÓN 2026-08-31: la exclusión de 'PVR%' que tenía este filtro
// también era un error — PVR3/PVR4/PVR5 SÍ son rutas de preventa reales
// (confirmado con un Excel real de "guías terminadas" de MobilVendor,
// producto BOTELLON VERDE PET, julio 2026: 14 documentos de PVR3/4/5 con
// venta real). Se quitó la exclusión.
//
// CORRECCIÓN 2026-08-31 (la importante): `o.status = 5` significa
// "facturado/cerrado administrativamente", NO "efectivamente entregado".
// Una orden puede llegar a status=5 sin que nunca se haya despachado una
// guía física — MobilVendor la factura igual. El campo real de "¿se
// entregó de verdad?" es la GUÍA DE ENTREGA (objeto `waybill`, separado
// del status de la orden), con su propio `waybill.status`. Confirmado
// empíricamente cruzando un Excel real de guías "Terminated" (82
// documentos, producto BOTELLON VERDE PET, julio 2026) contra la base:
// 0 documentos faltantes, pero 33 "de más" con status=5 — 31 de esos 33
// NO tenían guía asociada en absoluto (`waybill_status IS NULL`), y los
// otros 2 tenían `waybill_status` distinto de "3" (probable desfase
// temporal entre el Excel y la consulta). Regla confirmada para guías
// tipo ruta (`GUT#.#-######`/`GUR#-######`, botellón/reparto individual):
// `waybill_status = '3'` = guía terminada/entregada.
//
// CORRECCIÓN 2026-09-01: esa regla NO generaliza a DESCARTABLE. Las guías
// de productos empaquetados/livianos usan un esquema de código distinto
// (`GU######` puro, sin sufijo de ruta — varios artículos/documentos
// consolidados en una sola guía, ej. 5 invoices reales bajo `GU000458`)
// donde el significado de `waybill_status` NO es el mismo: confirmado con
// 5 documentos reales marcados "Terminated" en un Excel de guías de
// MobilVendor (agosto 2026, productos DESCARTABLE) que tenían
// `waybill_status = '0'` — el mismo valor que para rutas de botellón
// significa "Shipping" (no entregado). Probar "tiene guía asociada, sin
// mirar el status" contra ambos casos reales de agosto confirmó que la
// regla correcta depende de la categoría:
//   - DESCARTABLE: `waybill_code IS NOT NULL` (sin filtrar por status) →
//     $252,889.93 vs. real $252,960.52 (0.03% de diferencia).
//   - BOTELLÓN: mismo criterio da $1,504.44 vs. real $1,288.76 (+17%,
//     igual de mal que sin ningún filtro de guía) — para botellón SÍ hace
//     falta `waybill_status = '3'`, tener guía no alcanza porque casi
//     cualquier pedido consigue una guía rápido, esté o no realmente
//     entregada.
// Categorías no probadas contra un Excel real (HIELO, CAFÉ, PLUS, PT-*,
// SUSCRIPCION, SERVICIOS, GASTOS GENERALES) caen en la rama estricta
// (`waybill_status = '3'`) por default — más conservadora, sin evidencia
// propia todavía.
//
// Filtro de ruta: PV%/PREVENTA%/TELEVENTA% (ya no excluye PVR%).
// Además: o.type = 2, o.status = 5, el filtro de guía condicional de
// arriba, dd.codigo_categoria = '7' (DESCARTABLE) por default — el propio
// código fuente original comenta que sin el filtro de categoría se
// inflaba cada ruta con líneas no-descartable/anticipos/envíos. Por eso,
// a diferencia de los demás grupos, PREVENTA solo acepta `categoria`
// distinta a DESCARTABLE como filtro EXTRA explícito (ver
// ventasPorGrupo.js/topProductos.js), no como reemplazo del default.
// Fecha: o.fecha_entrega (no fecha_creacion). Solo `ordenes`, sin `facturas`
// ni rama de pedido web (igual que la función original).
// ============================================================
const CATEGORIA_PREVENTA = "DESCARTABLE";

// `categoriaParam` es el placeholder posicional ($3, $4, ...) que cada
// query ya usa para su propio filtro de categoría — se reutiliza acá para
// que el criterio de guía dependa del MISMO valor que el caller pase,
// sin agregar un parámetro nuevo.
const FILTRO_PREVENTA_SELLER = (categoriaParam) => `
  (o.seller_code ILIKE 'PV%' OR o.seller_code ILIKE 'PREVENTA%' OR o.seller_code ILIKE 'TELEVENTA%')
  AND (
    (${categoriaParam} = 'DESCARTABLE' AND o.waybill_code IS NOT NULL)
    OR
    (${categoriaParam} <> 'DESCARTABLE' AND o.waybill_status = '3')
  )
`;

module.exports = {
  CASE_GRUPO_ORDENES,
  FILTRO_ORDENES_GRUPO_VALIDO,
  CASE_GRUPO_FACTURAS,
  signedCol,
  GRUPOS_VALIDOS,
  CATEGORIAS_VALIDAS,
  FILTRO_PREVENTA_SELLER,
  CATEGORIA_PREVENTA,
};
