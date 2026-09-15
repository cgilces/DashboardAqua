// src/tools/clientesVisitadosSinVenta.js
// Intersección de 2 conjuntos, dentro de un rango de fechas:
//   A = clientes con `visit_start`/`visit_end` CONFIRMADO explícitamente en
//       `historial_visitas` (el vendedor tocó el botón de check-in/out).
//   B = clientes "sin venta" de un grupo/categoría en ese mismo período —
//       misma lógica exacta que `clientesSinConsumo` (universo completo,
//       CONSUMO_CERO / NUNCA_COMPRO_<categoria> / SIN_FACTURACION_FORMAL).
// A ∩ B = "se confirmó que un vendedor visitó a este cliente, y no hubo
// venta registrada" — el caso más accionable de "visita sin venta": no es
// una inferencia, el check-in existe.
//
// ============================================================
// ⚠️ ESTO ES UNA MUESTRA, NO EL UNIVERSO COMPLETO — leer antes de usar
// ============================================================
// `historial_visitas` (el log explícito de visit_start/visit_end) tiene
// adopción muy baja — confirmado con datos reales (ver TODO.md,
// investigación de clientesSinVisita): cubre históricamente ~300
// clientes/mes de los miles que compran, la inmensa mayoría de vendedores
// NO usa ese botón. Por eso el conjunto A es chico y sesgado hacia quien sí
// lo usa — NO es representativo del universo real de visitas (para eso
// existe `clientesSinVisita`, que usa `fecha_ultima_visita_direccion_cliente`,
// una fuente con cobertura real de miles de clientes).
//
// Esta tool responde una pregunta MÁS ESTRECHA pero más FUERTE: "de los
// clientes donde el check-in explícito SÍ existe, ¿cuáles no tuvieron
// venta?" — un resultado vacío o chico NO significa "casi nadie fue
// visitado sin vender"; significa que pocos vendedores usan el botón de
// check-in en general. La respuesta trae `cobertura` con el tamaño real de
// A para que quede explícito qué tan chica es la muestra en cada consulta.
//
// ============================================================
// El corte de `historial_visitas` no es una fecha fija — se mueve
// ============================================================
// La investigación anterior (2026-09-08) encontró el último dato real en
// 2026-08-29; al construir esta tool (2026-09-14) el corte real ya había
// avanzado a 2026-09-04 — la fuente sigue recibiendo datos de forma
// intermitente, no quedó congelada en una fecha fija. Por eso esta tool
// consulta el corte real (`MAX(fecha_visita)`) EN VIVO en cada llamada, en
// vez de asumir una fecha — si `fecha_fin` (o todo el rango) queda después
// del corte real, la respuesta trae una advertencia EXPLÍCITA en vez de
// devolver una lista vacía/incompleta en silencio.
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
  FILTRO_CLIENTE_VALIDO,
} = require("../sql/clasificacion");

const MAX_RANGO_DIAS = 400;
const LIMITE_DEFAULT = 300;
const LIMITE_MAX = 1000;

const inputSchema = {
  grupo: z.enum(GRUPOS_VALIDOS),
  categoria: z.enum(CATEGORIAS_VALIDAS),
  fecha_inicio: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  fecha_fin: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  limite: z.number().int().min(1).max(LIMITE_MAX).default(LIMITE_DEFAULT),
};

// ============================================================
// Set A: visitas CONFIRMADAS por check-in explícito en historial_visitas.
// ============================================================
const SQL_ULTIMO_CORTE_VISITAS = `
  SELECT MAX(fecha_visita) AS ultima_fecha
  FROM historial_visitas
  WHERE accion IN ('visit_start', 'visit_end');
`;

// $1 = inicio, $2 = fin exclusivo. Por cliente: última visita confirmada
// DENTRO del rango pedido (puede tener varias, se muestra la más reciente).
const SQL_VISITAS_CONFIRMADAS_EN_RANGO = `
  SELECT codigo_cliente, MAX(fecha_visita) AS ultima_visita_confirmada
  FROM historial_visitas
  WHERE accion IN ('visit_start', 'visit_end')
    AND fecha_visita >= $1 AND fecha_visita < $2
  GROUP BY codigo_cliente;
`;

// ============================================================
// Set B: misma lógica EXACTA que clientesSinConsumo.js — ver ese archivo
// para el detalle de cada decisión (universo sin exigir status, PREVENTA
// con guía laxa, exclusión de notas de crédito, etc.). Duplicado a
// propósito acá (mismo patrón de aislamiento ya usado en todo el proyecto
// para las ramas de PREVENTA) en vez de importar la tool y arriesgar el
// truncado de `limite` — acá se necesita el conjunto COMPLETO sin recortar
// para poder intersectar correctamente contra el conjunto A.
// ============================================================
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

// Compra MÁS RECIENTE de la categoría pedida en CUALQUIER OTRO grupo (no el
// pedido) — mismo fix que clientesSinConsumo.js (ver ese archivo para el
// caso real que lo motivó: cliente TIENDAS_VIP con evidencia de hace 532
// días, comprador activo actual bajo TIENDAS normal). $1 = códigos, $2 =
// categoria, $3 = grupo pedido (se excluye).
const SQL_ULTIMA_COMPRA_OTRA_RUTA = `
  SELECT DISTINCT ON (customer_code) customer_code, seller_code, fecha FROM (
    SELECT o.customer_code, o.seller_code, o.fecha_creacion AS fecha
    FROM ordenes o
    JOIN detalle_documento dd ON dd.documento_code = o.code
    WHERE o.origen_sistema = 'MOBILVENDOR' AND o.status = 2
      AND dd.descripcion_categoria = $2
      AND o.customer_code = ANY($1::text[])
      AND (${CASE_GRUPO_ORDENES}) IS DISTINCT FROM $3

    UNION ALL

    SELECT f.customer_code, f.seller_code, f.fecha_creacion AS fecha
    FROM facturas f
    JOIN detalle_documento dd ON dd.documento_code = f.code
    WHERE f.status = 2 AND f.tipo_movimiento = 'out_invoice'
      AND dd.descripcion_categoria = $2
      AND f.customer_code = ANY($1::text[])
      AND (${CASE_GRUPO_FACTURAS}) IS DISTINCT FROM $3
  ) x
  ORDER BY customer_code, fecha DESC;
`;

// ACTUALIZADO 2026-09-15: ya no exige waybill_code — ver clientesSinVisita.js
// para el detalle completo (órdenes creadas por administración cuando el
// dispositivo del vendedor falla mid-entrega: venta real y de la ruta,
// nunca va a tener guía; status=5 solo ya es "entrega confirmada" acá).
// ACTUALIZADO 2026-09-15 (2do cambio, mismo día): status=2 también cuenta
// como actividad real del cliente — decisión explícita de Alberto tras
// revisar la documentación oficial del API MobilVendor v2.13 (status=2 =
// "Confirmado", ya es una transacción comprometida, sin importar si nunca
// llega a status=5/10). Confirmado empíricamente que status=2 NO progresa
// con el tiempo (92.5% tiene 90+ días de antigüedad en las 28 rutas
// PREVENTA) — ver clientesSinVisita.js para el detalle completo.
const SQL_UNIVERSO_PREVENTA = `
  SELECT DISTINCT o.customer_code AS customer_code
  FROM ordenes o
  WHERE o.type = 2 AND o.status IN (2, 5)
    AND (o.seller_code ILIKE 'PV%' OR o.seller_code ILIKE 'PREVENTA%' OR o.seller_code ILIKE 'TELEVENTA%')
    AND ${FILTRO_CLIENTE_VALIDO("o.customer_code")};
`;

const SQL_ULTIMA_COMPRA_PREVENTA = `
  SELECT o.customer_code AS customer_code, MAX(o.fecha_entrega) AS ultima
  FROM ordenes o
  JOIN detalle_documento dd ON dd.documento_code = o.code
  WHERE o.type = 2 AND o.status = 5
    AND ${FILTRO_PREVENTA_SELLER("$1")}
    AND ${FILTRO_CLIENTE_VALIDO("o.customer_code")}
    AND dd.descripcion_categoria = $1
  GROUP BY o.customer_code;
`;

const SQL_COMPRARON_EN_RANGO_PREVENTA = `
  SELECT DISTINCT o.customer_code AS customer_code
  FROM ordenes o
  JOIN detalle_documento dd ON dd.documento_code = o.code
  WHERE o.type = 2 AND o.status = 5
    AND ${FILTRO_PREVENTA_SELLER("$1")}
    AND ${FILTRO_CLIENTE_VALIDO("o.customer_code")}
    AND dd.descripcion_categoria = $1
    AND o.fecha_entrega >= $2 AND o.fecha_entrega < $3;
`;

const SQL_NOMBRES = `
  SELECT codigo_cliente, COALESCE(nombre_comercial_cliente, nombre_cliente) AS nombre
  FROM clientes WHERE codigo_cliente = ANY($1::text[]);
`;

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

async function clientesVisitadosSinVenta({ grupo, categoria, fecha_inicio, fecha_fin, limite }) {
  const largoDias = diffDias(fecha_inicio, fecha_fin);
  if (largoDias < 0) throw new Error("fecha_inicio no puede ser posterior a fecha_fin");
  if (largoDias > MAX_RANGO_DIAS) throw new Error(`rango máximo permitido: ${MAX_RANGO_DIAS} días`);

  const inicioTs = `${fecha_inicio} 00:00:00`;
  const finTs = `${finExclusivo(fecha_fin)} 00:00:00`;
  const limiteReal = limite ?? LIMITE_DEFAULT;
  const hoy = fechaSoloDia(new Date());
  const esPreventa = grupo === "PREVENTA";

  // Corte real de historial_visitas, consultado EN VIVO — nunca asumido.
  const { rows: corteRows } = await pool.query(SQL_ULTIMO_CORTE_VISITAS);
  const ultimoCorte = corteRows[0]?.ultima_fecha ? fechaSoloDia(corteRows[0].ultima_fecha) : null;
  const inicioDia = fechaSoloDia(fecha_inicio);
  const finDia = fechaSoloDia(fecha_fin);

  let advertenciaCobertura = null;
  if (!ultimoCorte) {
    advertenciaCobertura = "historial_visitas no tiene NINGÚN dato de visit_start/visit_end en este momento — imposible calcular visitas confirmadas para cualquier rango.";
  } else if (inicioDia > ultimoCorte) {
    advertenciaCobertura = `historial_visitas no tiene datos después de ${ultimoCorte.toISOString().slice(0, 10)} — todo el rango pedido (${fecha_inicio} a ${fecha_fin}) es posterior a eso. El resultado estará vacío, pero NO significa que no hubo visitas: significa que no hay dato de check-in confirmado disponible para ningún día de este rango.`;
  } else if (finDia > ultimoCorte) {
    advertenciaCobertura = `historial_visitas no tiene datos después de ${ultimoCorte.toISOString().slice(0, 10)} — parte del rango pedido (${fecha_inicio} a ${fecha_fin}) queda sin cobertura. El resultado solo refleja check-ins confirmados hasta esa fecha, no todo el rango pedido.`;
  }

  // Set A: visitas confirmadas en el rango.
  const { rows: visitasRows } = await pool.query(SQL_VISITAS_CONFIRMADAS_EN_RANGO, [inicioTs, finTs]);
  const mapVisitaConfirmada = new Map(visitasRows.map((r) => [r.codigo_cliente, r.ultima_visita_confirmada]));

  // Set B: misma lógica que clientesSinConsumo, sin truncar por límite.
  let universoRows, formalRows, ultimaCompraRows, compraronRows;
  if (esPreventa) {
    const [uni, ult, comp] = await Promise.all([
      pool.query(SQL_UNIVERSO_PREVENTA),
      pool.query(SQL_ULTIMA_COMPRA_PREVENTA, [categoria]),
      pool.query(SQL_COMPRARON_EN_RANGO_PREVENTA, [categoria, inicioTs, finTs]),
    ]);
    universoRows = uni.rows;
    ultimaCompraRows = ult.rows;
    compraronRows = comp.rows;
    formalRows = universoRows;
  } else {
    const [uni, form, ult, comp] = await Promise.all([
      pool.query(SQL_UNIVERSO, [grupo]),
      pool.query(SQL_FORMAL, [grupo]),
      pool.query(SQL_ULTIMA_COMPRA, [grupo, categoria]),
      pool.query(SQL_COMPRARON_EN_RANGO, [grupo, categoria, inicioTs, finTs]),
    ]);
    universoRows = uni.rows;
    formalRows = form.rows;
    ultimaCompraRows = ult.rows;
    compraronRows = comp.rows;
  }

  const conFacturacionFormal = new Set(formalRows.map((r) => r.customer_code));
  const compraronEnRango = new Set(compraronRows.map((r) => r.customer_code));
  const mapUltimaCompra = new Map(ultimaCompraRows.map((r) => [r.customer_code, r.ultima]));

  const codigosUniverso = universoRows.map((r) => r.customer_code);
  const { rows: nombresRows } = await pool.query(SQL_NOMBRES, [codigosUniverso]);
  const mapNombre = new Map(nombresRows.map((r) => [r.codigo_cliente, (r.nombre || "").replace(/\s+/g, " ").trim()]));

  // Construir Set B completo (sin venta), guardando el código crudo — la
  // intersección con A se hace ANTES de consolidar duplicados de maestro,
  // porque A usa códigos crudos de historial_visitas (nunca fusionados).
  let sinVenta = [];
  for (const codigo of codigosUniverso) {
    if (compraronEnRango.has(codigo)) continue;

    const sinFacturacionFormal = !conFacturacionFormal.has(codigo);
    const ultimaRaw = mapUltimaCompra.get(codigo) || null;
    const ultimaDia = ultimaRaw ? fechaSoloDia(ultimaRaw) : null;
    const dias = ultimaDia ? Math.round((hoy - ultimaDia) / 86400000) : null;

    let clasificacion;
    if (sinFacturacionFormal) clasificacion = "SIN_FACTURACION_FORMAL";
    else if (ultimaDia === null) clasificacion = `NUNCA_COMPRO_${categoria}`;
    else clasificacion = "CONSUMO_CERO";

    sinVenta.push({ codigos: [codigo], nombre: mapNombre.get(codigo) || null, ultimaDia, dias, clasificacion, otraRuta: null });
  }

  // A ∩ B: se queda solo con los que tienen visita confirmada en el rango.
  let interseccion = sinVenta.filter((c) => mapVisitaConfirmada.has(c.codigos[0]));

  // `venta_reciente_otra_ruta` — ver clientesSinConsumo.js para el caso real
  // que lo motivó. Solo se busca sobre la intersección ya filtrada (chica),
  // no sobre todo Set B. No aplica a PREVENTA.
  if (!esPreventa && interseccion.length) {
    const { rows: otraRutaRows } = await pool.query(SQL_ULTIMA_COMPRA_OTRA_RUTA, [
      interseccion.map((c) => c.codigos[0]),
      categoria,
      grupo,
    ]);
    const mapOtraRuta = new Map(otraRutaRows.map((r) => [r.customer_code, r]));
    for (const c of interseccion) {
      const otra = mapOtraRuta.get(c.codigos[0]);
      if (!otra) continue;
      const otraDia = fechaSoloDia(otra.fecha);
      if (c.ultimaDia === null || otraDia > c.ultimaDia) {
        c.otraRuta = { ruta: otra.seller_code, fecha: otraDia.toISOString().slice(0, 10) };
      }
    }
  }

  // Consolidar duplicados de maestro SOLO dentro de la intersección ya
  // filtrada — mismo criterio que clientesSinConsumo/clientesSinVisita.
  const codigosInterseccion = interseccion.map((c) => c.codigos[0]);
  const { rows: dupRows } = await pool.query(SQL_DUPLICADOS, [codigosInterseccion]);
  const porCodigo = new Map();
  interseccion.forEach((c, i) => porCodigo.set(c.codigos[0], i));
  let duplicadosConsolidados = 0;
  for (const { codigos: grupoDup } of dupRows) {
    const indices = grupoDup.map((c) => porCodigo.get(c)).filter((i) => i !== undefined);
    if (indices.length < 2) continue;
    const filasDup = indices.map((i) => interseccion[i]);
    const mejor = filasDup.reduce((a, b) => (a.dias === null ? b : b.dias === null ? a : a.dias <= b.dias ? a : b));
    mejor.codigos = grupoDup;
    interseccion[indices[0]] = mejor;
    for (const i of indices.slice(1)) interseccion[i] = null;
    duplicadosConsolidados++;
  }
  interseccion = interseccion.filter((c) => c !== null);

  interseccion.sort((a, b) => (b.dias ?? 99999) - (a.dias ?? 99999));
  const devueltos = interseccion.slice(0, limiteReal);

  return {
    grupo,
    categoria,
    fecha_inicio,
    fecha_fin,
    muestra_no_universo:
      "Esta tool cruza contra historial_visitas (check-in explícito, adopción baja) — NO es el universo completo de visitas. Un resultado chico o vacío no significa que casi nadie fue visitado sin vender; significa que pocos vendedores registraron el check-in en este período. Para el universo completo de cobertura de visitas usar clientesSinVisita.",
    advertencia_cobertura_temporal: advertenciaCobertura,
    ultimo_dato_historial_visitas: ultimoCorte ? ultimoCorte.toISOString().slice(0, 10) : null,
    cobertura: {
      clientes_con_checkin_confirmado_en_rango: mapVisitaConfirmada.size,
      clientes_sin_venta_en_rango: sinVenta.length,
      interseccion_total: interseccion.length,
    },
    interseccion_devueltos: devueltos.length,
    duplicados_consolidados: duplicadosConsolidados,
    con_venta_reciente_otra_ruta: interseccion.filter((c) => c.otraRuta).length,
    clientes: devueltos.map((c) => ({
      codigo_cliente: c.codigos.join("+"),
      nombre_cliente: c.nombre,
      ultima_visita_confirmada: (() => {
        const fechas = c.codigos.map((cod) => mapVisitaConfirmada.get(cod)).filter(Boolean);
        if (!fechas.length) return null;
        return new Date(Math.max(...fechas.map((f) => new Date(f)))).toISOString().slice(0, 10);
      })(),
      ultima_compra: c.ultimaDia ? c.ultimaDia.toISOString().slice(0, 10) : null,
      dias_desde_ultima_compra: c.dias,
      clasificacion: c.clasificacion,
      venta_reciente_otra_ruta: c.otraRuta,
    })),
  };
}

module.exports = { clientesVisitadosSinVenta, inputSchema };
