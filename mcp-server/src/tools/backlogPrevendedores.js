// src/tools/backlogPrevendedores.js
// Backlog de un prevendedor (o de una ruta D específica, vía su seller_code)
// — cuántas órdenes creó en un rango de fechas, cuántas ya avanzaron y
// cuántas siguen pendientes. Pedido real: "las rutas D (D1...D20) entregan
// las órdenes que los prevendedores crean en MobilVendor — hoy no existe
// forma de ver el backlog real de cada prevendedor, solo lo ya
// vendido/facturado."
//
// ============================================================
// Investigación previa a construir esto (resumen — ver TODO.md para el
// detalle completo con todos los datos reales revisados)
// ============================================================
// 1) "Rutas D" NO están en `ordenes.route_code` (ese campo es basura
//    conocida — zonas tipo Z1/Z5/Z13, no rutas reales, ver clasificacion.js
//    y hallazgos previos de esta sesión). Aparecen en `facturas.seller_code`
//    (D1/D8/D9/D56/D210/D314/D1112/D1213), pero eso es la FACTURA final, no
//    la orden.
// 2) Los prevendedores reales de este flujo son el canal TIENDAS/
//    TIENDAS_VIP (`T*`/`TV*` en `ordenes.seller_code` — T5, T6, T9, TV2,
//    etc., ~98,000 órdenes), NO el canal PREVENTA (`PV*`/`TELEVENTA*`, que
//    ya tiene su propio mecanismo de guía/status=5 documentado y NO debe
//    confundirse con este).
// 3) Se intentó exhaustivamente encontrar un vínculo orden→factura directo
//    (parent_id, source_document, invoice_origin, concept_code/origin,
//    mobilvendor_id, waybill_code/status, coincidencia cliente+fecha+monto+
//    línea de producto) — NINGUNO funciona. Probado con casos reales
//    concretos: una factura del mismo cliente cerca en fecha tenía
//    productos/cantidades completamente distintos a la orden. `waybill_code`
//    está vacío en el 100% de las ~98,000 órdenes de este canal (el
//    mecanismo de guía synced solo existe para PREVENTA). Conclusión: NO
//    hay forma de saber si UNA orden específica ya se facturó.
// 4) Decisión de Alberto (confirmada con datos reales antes de construir):
//    usar directamente `ordenes.status` — 2 = pendiente (la orden nunca
//    avanzó), cualquier otro valor (3/4/5/10) = avanzada. Confirmado que
//    `status` SÍ está completo y sincronizado igual para TODAS las órdenes
//    de este canal (no hay ninguna barrera de lectura) — lo que pasa es que
//    la gran mayoría simplemente se queda en status=2 sin avanzar nunca.
// 5) CAVEAT real, verificado en el código (backend/cron/tareasCron.js,
//    DIAS_RETRO=10): el cron solo re-sincroniza los últimos 10 días + hoy,
//    dos veces al día. `status` se sobreescribe SIN protección en cada
//    resync (a diferencia de waybill_status, que sí tiene COALESCE) — así
//    que para una orden creada hace MÁS de ~10-14 días, "pendiente" en nuestra
//    base es el ÚLTIMO valor visto, no necesariamente el estado actual real
//    en MobilVendor (pudo haber avanzado sin que lo hayamos vuelto a
//    consultar). Para órdenes recientes (dentro de la ventana del cron) el
//    dato sí es en vivo. Ver `advertencia_status_desactualizado` abajo.
// 6) Cruce adicional pedido por Alberto: para cada orden, si el cliente
//    tiene una factura real (cualquier canal) dentro de una ventana de días
//    después de la fecha de la orden — es una señal de CORROBORACIÓN a
//    nivel cliente, NO una confirmación de que ESA orden puntual se
//    facturó (ya se descartó esa granularidad en el punto 3). Se expone
//    por separado y nombrado explícitamente para no confundir las dos
//    cosas.
// ============================================================
const { z } = require("zod");
const { pool } = require("../db");
const { finExclusivo, diffDias } = require("../util/fechas");
const { FILTRO_CLIENTE_VALIDO } = require("../sql/clasificacion");

// Mismo patrón que ventasPorRuta.js/clientesSinVisita.js — espacio incluido
// a propósito (rutas reales como "TELEVENTA 1").
const RUTA_RE = /^[A-Za-z0-9._ -]{1,20}$/;
const MAX_RANGO_DIAS = 400;
const MAX_RUTAS = 50;

// Ventana para el cruce "factura del cliente después de la orden" — pedido
// de Alberto, NO un vínculo exacto (ver punto 6 arriba). Configurable
// porque es una heurística exploratoria sin validar todavía contra mucho
// volumen; default generoso (30 días) basado en los retrasos reales
// observados en la investigación (hasta ~15 días en los casos revisados).
const VENTANA_FACTURA_DEFAULT = 30;
const VENTANA_FACTURA_MAX = 90;

// Ver punto 5 del comentario del archivo — DIAS_RETRO real de
// backend/cron/tareasCron.js (no se puede importar entre repos, se
// documenta el valor acá; si ese archivo cambia, actualizar acá también).
const DIAS_RETRO_CRON = 10;
// Margen extra sobre DIAS_RETRO_CRON antes de advertir — una orden de hace
// exactamente 10 días todavía pudo tocarse en la corrida de HOY.
const MARGEN_ADVERTENCIA_DIAS = 4;

const RUTA_SCHEMA = z.string().regex(RUTA_RE, "código de ruta/prevendedor inválido");
const inputSchema = {
  ruta: z.union([RUTA_SCHEMA, z.array(RUTA_SCHEMA).min(1).max(MAX_RUTAS)]),
  fecha_inicio: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  fecha_fin: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  ventana_dias_factura_cliente: z.number().int().min(1).max(VENTANA_FACTURA_MAX).default(VENTANA_FACTURA_DEFAULT),
};

// $1 = array de seller_code (prevendedores/ruta), $2 = inicio (timestamp),
// $3 = fin exclusivo (timestamp), $4 = ventana en días para el cruce de
// factura del cliente.
//
// Solo `ordenes` de origen MOBILVENDOR — Odoo tiene sus propios campos
// estado_entrega/estado_facturacion (no comparables, semántica distinta,
// ver comentario del archivo) y este flujo es 100% MobilVendor.
const SQL = `
  WITH universo AS (
    SELECT
      o.code,
      o.customer_code,
      o.seller_code,
      o.status,
      o.fecha_creacion,
      o.total
    FROM ordenes o
    WHERE o.type = 2
      AND o.origen_sistema = 'MOBILVENDOR'
      AND o.seller_code = ANY($1::text[])
      AND o.fecha_creacion >= $2
      AND o.fecha_creacion <  $3
      AND ${FILTRO_CLIENTE_VALIDO("o.customer_code")}
  ),
  con_factura AS (
    SELECT DISTINCT u.code
    FROM universo u
    JOIN facturas f
      ON f.customer_code = u.customer_code
     AND f.status = 2
     AND f.fecha_creacion >= u.fecha_creacion
     AND f.fecha_creacion <  u.fecha_creacion + make_interval(days => $4::int)
  )
  SELECT
    u.seller_code,
    u.status,
    (cf.code IS NOT NULL) AS tiene_factura_cliente_posterior,
    COUNT(*) AS cantidad,
    SUM(u.total) AS dolares
  FROM universo u
  LEFT JOIN con_factura cf ON cf.code = u.code
  GROUP BY u.seller_code, u.status, (cf.code IS NOT NULL);
`;

// Combina las filas agrupadas en { total, pendientes, avanzadas, por_status,
// cruce_factura_cliente } para UN seller_code (o el consolidado de varios).
function resumirGrupo(filas) {
  const totales = { cantidad: 0, dolares: 0 };
  const pendientes = { cantidad: 0, dolares: 0 };
  const avanzadas = { cantidad: 0, dolares: 0 };
  const porStatusMap = new Map();
  const cruce = {
    con_factura_posterior: { cantidad: 0 },
    sin_factura_posterior: { cantidad: 0 },
  };

  for (const f of filas) {
    const cantidad = Number(f.cantidad) || 0;
    const dolares = Number(f.dolares) || 0;
    const status = Number(f.status);

    totales.cantidad += cantidad;
    totales.dolares += dolares;

    if (status === 2) {
      pendientes.cantidad += cantidad;
      pendientes.dolares += dolares;
    } else {
      avanzadas.cantidad += cantidad;
      avanzadas.dolares += dolares;
    }

    const statusActual = porStatusMap.get(status) || { cantidad: 0, dolares: 0 };
    statusActual.cantidad += cantidad;
    statusActual.dolares += dolares;
    porStatusMap.set(status, statusActual);

    if (f.tiene_factura_cliente_posterior) {
      cruce.con_factura_posterior.cantidad += cantidad;
    } else {
      cruce.sin_factura_posterior.cantidad += cantidad;
    }
  }

  const por_status = [...porStatusMap.entries()]
    .map(([status, v]) => ({ status, cantidad: v.cantidad, dolares: Number(v.dolares.toFixed(2)) }))
    .sort((a, b) => a.status - b.status);

  return {
    total_ordenes: totales.cantidad,
    dolares_totales: Number(totales.dolares.toFixed(2)),
    pendientes: { cantidad: pendientes.cantidad, dolares: Number(pendientes.dolares.toFixed(2)) },
    avanzadas: { cantidad: avanzadas.cantidad, dolares: Number(avanzadas.dolares.toFixed(2)) },
    por_status,
    cruce_factura_cliente: cruce,
  };
}

async function backlogPrevendedores({ ruta, fecha_inicio, fecha_fin, ventana_dias_factura_cliente }) {
  const largoDias = diffDias(fecha_inicio, fecha_fin);
  if (largoDias < 0) throw new Error("fecha_inicio no puede ser posterior a fecha_fin");
  if (largoDias > MAX_RANGO_DIAS) throw new Error(`rango máximo permitido: ${MAX_RANGO_DIAS} días`);

  const inicioTs = `${fecha_inicio} 00:00:00`;
  const finTs = `${finExclusivo(fecha_fin)} 00:00:00`;
  const rutasSolicitadas = Array.isArray(ruta) ? ruta : [ruta];

  const { rows } = await pool.query(SQL, [rutasSolicitadas, inicioTs, finTs, ventana_dias_factura_cliente]);

  // Advertencia de status desactualizado — ver punto 5 del comentario del
  // archivo. Se dispara si CUALQUIER parte del rango pedido queda más allá
  // de la ventana que el cron re-sincroniza en vivo (hoy - DIAS_RETRO_CRON,
  // con margen) — más allá de eso, "pendiente" puede ser un valor viejo, no
  // necesariamente el estado actual real en MobilVendor.
  const hoy = new Date();
  const corteResyncVivo = new Date(hoy);
  corteResyncVivo.setDate(corteResyncVivo.getDate() - (DIAS_RETRO_CRON + MARGEN_ADVERTENCIA_DIAS));
  const fechaInicioDate = new Date(`${fecha_inicio}T00:00:00`);
  let advertencia_status_desactualizado = null;
  if (fechaInicioDate < corteResyncVivo) {
    advertencia_status_desactualizado =
      `El cron solo re-sincroniza los últimos ${DIAS_RETRO_CRON} días + hoy (backend/cron/tareasCron.js). ` +
      `Para órdenes creadas antes de ${corteResyncVivo.toISOString().slice(0, 10)}, "status" refleja el ÚLTIMO valor ` +
      `sincronizado, no necesariamente el estado actual real en MobilVendor — pudo haber avanzado sin que se ` +
      `haya vuelto a consultar. "pendientes" para ese período puede estar sobreestimado.`;
  }

  const porRutaMap = new Map();
  for (const f of rows) {
    const grupo = porRutaMap.get(f.seller_code) || [];
    grupo.push(f);
    porRutaMap.set(f.seller_code, grupo);
  }

  const resultadoBase = {
    rango: { fecha_inicio, fecha_fin },
    ventana_dias_factura_cliente,
    advertencia_status_desactualizado,
  };

  if (!Array.isArray(ruta)) {
    return { ruta, ...resultadoBase, ...resumirGrupo(rows) };
  }

  const por_ruta = rutasSolicitadas
    .map((r) => ({ ruta: r, ...resumirGrupo(porRutaMap.get(r) || []) }))
    .sort((a, b) => b.total_ordenes - a.total_ordenes);

  return { rutas: rutasSolicitadas, ...resultadoBase, ...resumirGrupo(rows), por_ruta };
}

module.exports = { backlogPrevendedores, inputSchema };
