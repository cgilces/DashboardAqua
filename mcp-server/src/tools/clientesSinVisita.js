// src/tools/clientesSinVisita.js
// Universo COMPLETO de clientes de un grupo/canal que NO tienen una visita
// reciente registrada — mismo patrón que clientesSinConsumo, pero sobre
// visitas en vez de compras.
//
// ============================================================
// ⚠️ LA FUENTE ES UN PUNTERO, NO UN HISTORIAL — leer antes de usar
// ============================================================
// La fuente es `direcciones_clientes.fecha_ultima_visita_direccion_cliente`,
// alimentada por el campo `last_visit_date` que MobilVendor manda incrustado
// en CADA documento (orden), no un evento separado de check-in. Investigado
// y descartado como fuente: `historial_visitas` (el log explícito de
// visit_start/visit_end) — cubre solo ~300 clientes/mes de los miles que
// realmente compran, la inmensa mayoría de vendedores no usa ese botón. Este
// campo, en cambio, cubre 13,771 clientes reales, siempre al día (se
// confirmó actualizado hasta el mismo día de la consulta), y coincide con el
// 91% de quienes compraron en un mes real (agosto 2026: 6,961 de 7,671).
//
// PERO: es un campo que se SOBREESCRIBE con cada documento nuevo — guarda
// SOLO la visita más reciente conocida, no un log de todas las visitas. Eso
// significa:
//   - Sirve perfecto para un reporte EN VIVO ("¿quién no tiene visita
//     reciente, a día de hoy?").
//   - NO sirve para reconstruir retroactivamente "¿fue visitado en la semana
//     del 10 de agosto?" una vez que ya pasaron semanas y hubo visitas más
//     nuevas — esa visita más nueva pisó cualquier rastro de si la de agosto
//     existió. No hay forma de recuperar eso con los datos que tenemos.
// Por eso esta tool calcula `dias_desde_ultima` contra la fecha REAL de HOY
// (no contra `fecha_fin`) — si se le pide un `fecha_fin` que no es reciente,
// el resultado devuelve una advertencia explícita en la respuesta en vez de
// fingir que el reporte es válido para esa fecha pasada.
//
// ============================================================
// Agregación por cliente (no por dirección) — sucursales
// ============================================================
// Un mismo `codigo_cliente` puede tener MUCHAS direcciones en
// `direcciones_clientes` (confirmado con datos reales: hasta 399 en un
// caso) — el mismo patrón de sucursales ya visto en el reporte de EMPRESAS
// (INDUSTRIAL PESQUERA SANTA PRISCILA S.A., código 108557, tiene 12:
// MATRIZ, ALDEA, PLANTA 2, PLANTA 7, TROPACK, etc.). Decisión: CUALQUIER
// dirección visitada cuenta como cliente visitado — se toma la fecha MÁS
// RECIENTE entre todas sus direcciones (`MAX(...) GROUP BY codigo_cliente`),
// no se reporta por dirección. Esto es automático en la query, no hace falta
// tratamiento especial.
//
// Los duplicados de MAESTRO (mismo RUC+compañía+nombre exacto bajo 2
// codigo_cliente, ej. ERNST & YOUNG 183333/184172) son un problema
// DISTINTO al de sucursales — se resuelven igual que en clientesSinConsumo,
// consolidando en una sola fila.
//
// ============================================================
// Por qué ~710 compradores de agosto no tienen fecha de visita — investigado
// ============================================================
// Confirmado con datos reales: el campo SOLO se puebla para clientes con al
// menos un documento de origen MOBILVENDOR — es un campo del formato de
// documento de MobilVendor, no existe en los documentos de Odoo. De los 710
// compradores de agosto sin fecha de visita, el 100% son clientes servidos
// EXCLUSIVAMENTE por Odoo (sin ningún documento MobilVendor) — 165 de
// EMPRESAS (cuentas corporativas grandes, sin ruta física), 156 de RURAL,
// 117 de DOMICILIO, resto repartido. No es un hueco de datos — es un
// segmento real donde el concepto de "visita física de ruta" no aplica.
// Confirmado: CERO casos con documento MobilVendor y sin fecha de visita.
const { z } = require("zod");
const { pool } = require("../db");
const { finExclusivo, diffDias } = require("../util/fechas");
const {
  CASE_GRUPO_ORDENES,
  FILTRO_ORDENES_GRUPO_VALIDO,
  CASE_GRUPO_FACTURAS,
  GRUPOS_VALIDOS,
  FILTRO_CLIENTE_VALIDO,
} = require("../sql/clasificacion");

const MAX_RANGO_DIAS = 400;
const LIMITE_DEFAULT = 300;
const LIMITE_MAX = 1000;
// Si fecha_fin queda a más de este umbral de HOY, el reporte no puede
// responder con confianza para esa fecha (ver advertencia en el archivo) —
// se avisa en la respuesta en vez de fallar, para no bloquear un uso
// exploratorio, pero dejando clarísimo el límite.
const UMBRAL_ADVERTENCIA_DIAS = 3;

const inputSchema = {
  grupo: z.enum(GRUPOS_VALIDOS),
  fecha_inicio: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  fecha_fin: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  limite: z.number().int().min(1).max(LIMITE_MAX).default(LIMITE_DEFAULT),
};

// Universo del grupo — mismo patrón que clientesSinConsumo (sin exigir
// status, para no perder ningún cliente real del canal). $1 = grupo.
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

// PREVENTA: mismo universo laxo (criterio de DESCARTABLE) ya acordado y
// usado en clientesSinConsumo, por consistencia — acá no depende de
// categoría porque esta tool no filtra por categoría en absoluto.
const SQL_UNIVERSO_PREVENTA = `
  SELECT DISTINCT o.customer_code AS customer_code
  FROM ordenes o
  WHERE o.type = 2 AND o.status = 5
    AND (o.seller_code ILIKE 'PV%' OR o.seller_code ILIKE 'PREVENTA%' OR o.seller_code ILIKE 'TELEVENTA%')
    AND o.waybill_code IS NOT NULL
    AND ${FILTRO_CLIENTE_VALIDO("o.customer_code")};
`;

// Última visita conocida por CLIENTE (no por dirección) — MAX entre todas
// sus direcciones, ver comentario de sucursales arriba. $1 = array de
// códigos del universo.
const SQL_ULTIMA_VISITA = `
  SELECT codigo_cliente, MAX(fecha_ultima_visita_direccion_cliente) AS ultima
  FROM direcciones_clientes
  WHERE codigo_cliente = ANY($1::text[])
  GROUP BY codigo_cliente;
`;

const SQL_NOMBRES = `
  SELECT codigo_cliente, COALESCE(nombre_comercial_cliente, nombre_cliente) AS nombre
  FROM clientes WHERE codigo_cliente = ANY($1::text[]);
`;

// Mismo criterio de duplicados de maestro que clientesSinConsumo (mismo
// RUC+compañía+nombre exacto) — hecho verificable, no ambigüedad de negocio.
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

async function clientesSinVisita({ grupo, fecha_inicio, fecha_fin, limite }) {
  const largoDias = diffDias(fecha_inicio, fecha_fin);
  if (largoDias < 0) throw new Error("fecha_inicio no puede ser posterior a fecha_fin");
  if (largoDias > MAX_RANGO_DIAS) throw new Error(`rango máximo permitido: ${MAX_RANGO_DIAS} días`);

  const limiteReal = limite ?? LIMITE_DEFAULT;
  const hoy = fechaSoloDia(new Date());
  const inicioDia = fechaSoloDia(fecha_inicio);
  const finDia = fechaSoloDia(fecha_fin);

  // Advertencia explícita si se pide un fecha_fin que no es reciente — el
  // campo fuente es un puntero, no se puede reconstruir ese punto en el
  // pasado con confianza (ver comentario grande del archivo).
  const diasDesdeFinAHoy = Math.round((hoy - finDia) / 86400000);
  const advertencia =
    diasDesdeFinAHoy > UMBRAL_ADVERTENCIA_DIAS
      ? `fecha_fin (${fecha_fin}) es de hace ${diasDesdeFinAHoy} días. fecha_ultima_visita_direccion_cliente es un PUNTERO a la visita más reciente conocida HOY, no un historial — no se puede reconstruir con confianza si un cliente tenía o no visita reciente en una fecha pasada, porque visitas posteriores ya sobreescribieron ese dato. Este reporte refleja el estado ACTUAL (a hoy), no el de fecha_fin.`
      : null;

  const esPreventa = grupo === "PREVENTA";
  const { rows: universoRows } = await pool.query(esPreventa ? SQL_UNIVERSO_PREVENTA : SQL_UNIVERSO, esPreventa ? [] : [grupo]);
  const codigosUniverso = universoRows.map((r) => r.customer_code);

  const [{ rows: visitaRows }, { rows: nombresRows }] = await Promise.all([
    pool.query(SQL_ULTIMA_VISITA, [codigosUniverso]),
    pool.query(SQL_NOMBRES, [codigosUniverso]),
  ]);
  const mapUltima = new Map(visitaRows.map((r) => [r.codigo_cliente, r.ultima]));
  const mapNombre = new Map(nombresRows.map((r) => [r.codigo_cliente, (r.nombre || "").replace(/\s+/g, " ").trim()]));

  let clientes = [];
  let conVisitaReciente = 0;
  for (const codigo of codigosUniverso) {
    const ultimaRaw = mapUltima.get(codigo) || null;
    const ultimaDia = ultimaRaw ? fechaSoloDia(ultimaRaw) : null;

    // "Con visita reciente" = su última visita conocida cae en o después de
    // fecha_inicio — se excluye del reporte de "sin visita".
    if (ultimaDia && ultimaDia >= inicioDia) {
      conVisitaReciente++;
      continue;
    }

    const dias = ultimaDia ? Math.round((hoy - ultimaDia) / 86400000) : null;
    const clasificacion = ultimaDia === null ? "SIN_VISITA_NUNCA" : "SIN_VISITA_RECIENTE";

    clientes.push({
      codigos: [codigo],
      nombre: mapNombre.get(codigo) || null,
      ultimaDia,
      dias,
      clasificacion,
    });
  }

  // Consolidar duplicados de maestro — misma lógica que clientesSinConsumo.
  const { rows: dupRows } = await pool.query(SQL_DUPLICADOS, [codigosUniverso]);
  const porCodigo = new Map();
  clientes.forEach((c, i) => porCodigo.set(c.codigos[0], i));
  let duplicadosConsolidados = 0;
  for (const { codigos: grupoDup } of dupRows) {
    const indices = grupoDup.map((c) => porCodigo.get(c)).filter((i) => i !== undefined);
    if (indices.length < 2) continue;
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

  clientes.sort((a, b) => (b.dias ?? 99999) - (a.dias ?? 99999));

  const total = clientes.length;
  const devueltos = clientes.slice(0, limiteReal);

  return {
    grupo,
    fecha_inicio,
    fecha_fin,
    advertencia,
    universo_total: codigosUniverso.length - duplicadosConsolidados,
    con_visita_reciente: conVisitaReciente,
    sin_visita_total: total,
    sin_visita_devueltos: devueltos.length,
    duplicados_consolidados: duplicadosConsolidados,
    clientes: devueltos.map((c) => ({
      codigo_cliente: c.codigos.join("+"),
      nombre_cliente: c.nombre,
      ultima_visita: c.ultimaDia ? c.ultimaDia.toISOString().slice(0, 10) : null,
      dias_desde_ultima: c.dias,
      clasificacion: c.clasificacion,
    })),
  };
}

module.exports = { clientesSinVisita, inputSchema };
