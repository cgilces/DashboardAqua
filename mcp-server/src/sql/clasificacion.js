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
];

module.exports = {
  CASE_GRUPO_ORDENES,
  FILTRO_ORDENES_GRUPO_VALIDO,
  CASE_GRUPO_FACTURAS,
  signedCol,
  GRUPOS_VALIDOS,
};
