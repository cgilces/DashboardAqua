// controllers/controllerGerencia/gerenciaController.js
// Dashboard Ejecutivo de Gerencia — Grupo AQUA S.A.
// Módulos: Cobranza · Vendedores · Riesgo de Fuga · Metas vs Real · Margen
//          Top Productos · Clientes Nuevos vs Recurrentes · Proyección · Ranking Clientes

"use strict";
const { sequelize } = require("../../models");
const Sequelize = require("sequelize");
const { dedupeProductosVendidos } = require("../../utils/dedupeProductos");

// ================================================================
// HELPERS
// ================================================================
function getInicio(anio, mes) {
  return `${anio}-${String(mes).padStart(2, "0")}-01 00:00:00`;
}
function getFin(anio, mes) {
  let mf = mes + 1, af = anio;
  if (mf === 13) { mf = 1; af++; }
  return `${af}-${String(mf).padStart(2, "0")}-01 00:00:00`;
}
function getAnioMes(query) {
  const hoy = new Date();
  const anio = parseInt(query.anio) || hoy.getFullYear();
  const mes  = parseInt(query.mes)  || (hoy.getMonth() + 1);
  return { anio, mes };
}

// ================================================================
// 1. SEMÁFORO DE COBRANZA
// ================================================================
exports.getCobranza = async (req, res) => {
  try {
    const { anio, mes } = getAnioMes(req.query);
    const inicio = getInicio(anio, mes);
    const fin    = getFin(anio, mes);

    const rows = await sequelize.query(`
      SELECT
        c.codigo_cliente,
        COALESCE(c.nombre_cliente, f.customer_code)             AS nombre_cliente,
        c.telefono_cliente,
        COUNT(f.id_factura)                                      AS facturas_pendientes,
        ROUND(SUM(f.saldo_pendiente)::numeric, 2)               AS saldo_total,
        MIN(f.fecha_vencimiento::date)                           AS fecha_mas_antigua,
        GREATEST(0, (CURRENT_DATE - MIN(f.fecha_vencimiento::date))) AS dias_vencido,
        CASE
          WHEN GREATEST(0,(CURRENT_DATE - MIN(f.fecha_vencimiento::date))) > 45 THEN 'CRITICO'
          WHEN GREATEST(0,(CURRENT_DATE - MIN(f.fecha_vencimiento::date))) > 20 THEN 'ALERTA'
          ELSE 'OK'
        END                                                      AS estado
      FROM facturas f
      LEFT JOIN clientes c ON c.codigo_cliente = f.customer_code
      WHERE f.estado_pago IN ('not_paid','partial')
        AND f.saldo_pendiente > 0
        AND f.status IN (0,2,3,4,5)
      GROUP BY c.codigo_cliente, c.nombre_cliente, c.telefono_cliente, f.customer_code
      HAVING SUM(f.saldo_pendiente) > 0
      ORDER BY dias_vencido DESC, saldo_total DESC
      LIMIT 100
    `, { type: Sequelize.QueryTypes.SELECT });

    const resumen = {
      total_cartera:  rows.reduce((s, r) => s + Number(r.saldo_total),  0),
      clientes_criticos: rows.filter(r => r.estado === "CRITICO").length,
      clientes_alerta:   rows.filter(r => r.estado === "ALERTA").length,
      clientes_ok:       rows.filter(r => r.estado === "OK").length,
    };

    res.json({ resumen, detalle: rows });
  } catch (err) {
    console.error("getCobranza:", err.message);
    res.status(500).json({ error: err.message });
  }
};

// ================================================================
// 2. EFICIENCIA DE VENDEDORES
// ================================================================
exports.getEficienciaVendedores = async (req, res) => {
  try {
    const { anio, mes } = getAnioMes(req.query);
    const inicio = getInicio(anio, mes);
    const fin    = getFin(anio, mes);

    const rows = await sequelize.query(`
      WITH visitas_mes AS (
        SELECT
          codigo_usuario,
          MAX(nombre_usuario)                                          AS nombre_usuario,
          COUNT(DISTINCT codigo_cliente)                               AS clientes_visitados,
          COUNT(*)                                                     AS total_acciones
        FROM historial_visitas
        WHERE fecha_visita >= :inicio AND fecha_visita < :fin
        GROUP BY codigo_usuario
      ),
      pedidos_mes AS (
        SELECT
          seller_code,
          COUNT(DISTINCT code)            AS pedidos,
          ROUND(SUM(total)::numeric, 2)   AS ventas_total,
          ROUND(SUM(COALESCE(margen,0))::numeric,2) AS margen_total,
          COUNT(DISTINCT customer_code)   AS clientes_con_pedido
        FROM ordenes
        WHERE fecha_creacion >= :inicio AND fecha_creacion < :fin
          AND status IN (2,4,5)
        GROUP BY seller_code
      )
      SELECT
        COALESCE(v.nombre_usuario, p.seller_code)                          AS nombre_vendedor,
        COALESCE(v.codigo_usuario, p.seller_code)                          AS codigo_vendedor,
        COALESCE(v.clientes_visitados, 0)                                  AS clientes_visitados,
        COALESCE(p.pedidos, 0)                                             AS pedidos,
        COALESCE(p.ventas_total, 0)                                        AS ventas_total,
        COALESCE(p.margen_total, 0)                                        AS margen_total,
        COALESCE(p.clientes_con_pedido, 0)                                 AS clientes_con_pedido,
        CASE
          WHEN COALESCE(v.clientes_visitados, 0) > 0
          THEN ROUND((COALESCE(p.clientes_con_pedido,0)::numeric
               / COALESCE(v.clientes_visitados,1)) * 100, 1)
          ELSE 0
        END                                                                AS tasa_cierre_pct,
        CASE
          WHEN COALESCE(p.ventas_total, 0) > 0
          THEN ROUND((COALESCE(p.margen_total,0)::numeric
               / COALESCE(p.ventas_total,1)) * 100, 1)
          ELSE 0
        END                                                                AS margen_pct
      FROM visitas_mes v
      FULL OUTER JOIN pedidos_mes p ON p.seller_code = v.codigo_usuario
      ORDER BY ventas_total DESC
      LIMIT 50
    `, {
      replacements: { inicio, fin },
      type: Sequelize.QueryTypes.SELECT,
    });

    res.json({ vendedores: rows, anio, mes });
  } catch (err) {
    console.error("getEficienciaVendedores:", err.message);
    res.status(500).json({ error: err.message });
  }
};

// ================================================================
// 3. CLIENTES EN RIESGO DE FUGA
// ================================================================
exports.getClientesRiesgo = async (req, res) => {
  try {
    const umbral30  = parseInt(req.query.dias30)  || 30;
    const umbral60  = parseInt(req.query.dias60)  || 60;
    const limite    = parseInt(req.query.limite)  || 100;

    const rows = await sequelize.query(`
      WITH ultima_compra AS (
        SELECT
          f.customer_code,
          MAX(f.fecha_creacion::date)             AS ultima_fecha,
          COUNT(DISTINCT f.code)                  AS total_facturas,
          ROUND(SUM(f.total)::numeric, 2)         AS ventas_acumuladas,
          ROUND(AVG(f.total)::numeric, 2)         AS ticket_promedio
        FROM facturas f
        WHERE f.status IN (0,2,3,4,5)
        GROUP BY f.customer_code
      )
      SELECT
        c.codigo_cliente,
        COALESCE(c.nombre_cliente, uc.customer_code)    AS nombre_cliente,
        c.telefono_cliente,
        c.vendedor_asignado_cliente                     AS vendedor,
        uc.ultima_fecha,
        (CURRENT_DATE - uc.ultima_fecha)                AS dias_sin_comprar,
        uc.total_facturas,
        uc.ventas_acumuladas,
        uc.ticket_promedio,
        CASE
          WHEN (CURRENT_DATE - uc.ultima_fecha) > :umbral60 THEN 'PERDIDO'
          WHEN (CURRENT_DATE - uc.ultima_fecha) > :umbral30 THEN 'RIESGO'
          ELSE 'ALERTA'
        END                                             AS estado
      FROM ultima_compra uc
      LEFT JOIN clientes c ON c.codigo_cliente = uc.customer_code
      WHERE (CURRENT_DATE - uc.ultima_fecha) >= :umbral30
      ORDER BY dias_sin_comprar DESC, ventas_acumuladas DESC
      LIMIT :limite
    `, {
      replacements: { umbral30, umbral60, limite },
      type: Sequelize.QueryTypes.SELECT,
    });

    const resumen = {
      perdidos: rows.filter(r => r.estado === "PERDIDO").length,
      en_riesgo: rows.filter(r => r.estado === "RIESGO").length,
      en_alerta: rows.filter(r => r.estado === "ALERTA").length,
      cartera_en_riesgo: rows.reduce((s, r) => s + Number(r.ventas_acumuladas), 0),
    };

    res.json({ resumen, clientes: rows });
  } catch (err) {
    console.error("getClientesRiesgo:", err.message);
    res.status(500).json({ error: err.message });
  }
};

// ================================================================
// 4. METAS vs REAL
// ================================================================
exports.getMetasVsReal = async (req, res) => {
  try {
    const { anio, mes } = getAnioMes(req.query);
    const inicio = getInicio(anio, mes);
    const fin    = getFin(anio, mes);

    // Preventas
    const preventas = await sequelize.query(`
      SELECT
        mp.codigo_ruta,
        mp.meta_dolares,
        mp.meta_unidades,
        COALESCE(v.real_dolares, 0)   AS real_dolares,
        COALESCE(v.real_unidades, 0)  AS real_unidades,
        CASE WHEN mp.meta_dolares > 0
          THEN ROUND((COALESCE(v.real_dolares,0)::numeric / mp.meta_dolares::numeric) * 100, 1)
          ELSE 0
        END                           AS pct_dolares,
        CASE WHEN mp.meta_unidades > 0
          THEN ROUND((COALESCE(v.real_unidades,0)::numeric / mp.meta_unidades::numeric) * 100, 1)
          ELSE 0
        END                           AS pct_unidades
      FROM metas_preventas mp
      LEFT JOIN (
        SELECT
          o.route_code,
          ROUND(SUM(o.total)::numeric, 2)      AS real_dolares,
          COALESCE(SUM(dd.cantidad)::int, 0)   AS real_unidades
        FROM ordenes o
        LEFT JOIN detalle_documento dd ON dd.documento_code = o.code
        WHERE o.fecha_creacion >= :inicio AND o.fecha_creacion < :fin
          AND o.status IN (2,4,5)
        GROUP BY o.route_code
      ) v ON v.route_code = mp.codigo_ruta
      WHERE mp.anio = :anio AND mp.mes = :mes
      ORDER BY pct_dolares ASC
    `, {
      replacements: { inicio, fin, anio, mes },
      type: Sequelize.QueryTypes.SELECT,
    });

    // Botellones
    const botellones = await sequelize.query(`
      SELECT
        mb.seccion,
        mb.meta_unidades,
        mb.meta_dolares,
        COALESCE(v.real_dolares, 0)  AS real_dolares,
        COALESCE(v.real_unidades, 0) AS real_unidades,
        CASE WHEN mb.meta_dolares > 0
          THEN ROUND((COALESCE(v.real_dolares,0)::numeric / mb.meta_dolares::numeric) * 100, 1)
          ELSE 0
        END AS pct_dolares
      FROM metas_botellon mb
      LEFT JOIN (
        SELECT
          o.codigo_tipo_negocio AS seccion,
          ROUND(SUM(o.total)::numeric,2) AS real_dolares,
          COALESCE(SUM(dd.cantidad)::int,0) AS real_unidades
        FROM ordenes o
        LEFT JOIN detalle_documento dd ON dd.documento_code = o.code
        WHERE o.fecha_creacion >= :inicio AND o.fecha_creacion < :fin
          AND o.status IN (2,4,5)
        GROUP BY o.codigo_tipo_negocio
      ) v ON v.seccion = mb.seccion
      WHERE mb.anio = :anio AND mb.mes = :mes
      ORDER BY pct_dolares ASC
    `, {
      replacements: { inicio, fin, anio, mes },
      type: Sequelize.QueryTypes.SELECT,
    }).catch(() => []);

    const totalMeta  = preventas.reduce((s, r) => s + Number(r.meta_dolares), 0);
    const totalReal  = preventas.reduce((s, r) => s + Number(r.real_dolares), 0);
    const pctGlobal  = totalMeta > 0 ? Math.round((totalReal / totalMeta) * 100) : 0;

    res.json({ preventas, botellones, resumen: { totalMeta, totalReal, pctGlobal }, anio, mes });
  } catch (err) {
    console.error("getMetasVsReal:", err.message);
    res.status(500).json({ error: err.message });
  }
};

// ================================================================
// 5. MARGEN POR PRODUCTO / CANAL
// ================================================================
exports.getMargenCanal = async (req, res) => {
  try {
    const { anio, mes } = getAnioMes(req.query);
    const inicio = getInicio(anio, mes);
    const fin    = getFin(anio, mes);

    const porCanal = await sequelize.query(`
      SELECT
        COALESCE(tn.descripcion, o.codigo_tipo_negocio, 'Sin clasificar') AS canal,
        ROUND(SUM(o.total)::numeric, 2)                                   AS ventas_total,
        ROUND(SUM(COALESCE(o.margen, 0))::numeric, 2)                     AS margen_total,
        COUNT(DISTINCT o.code)                                             AS num_pedidos,
        CASE WHEN SUM(o.total) > 0
          THEN ROUND((SUM(COALESCE(o.margen,0))::numeric / SUM(o.total)::numeric) * 100, 2)
          ELSE 0
        END                                                                AS margen_pct
      FROM ordenes o
      LEFT JOIN tipos_negocio tn ON tn.codigo = o.codigo_tipo_negocio
      WHERE o.fecha_creacion >= :inicio AND o.fecha_creacion < :fin
        AND o.status IN (2,4,5)
      GROUP BY tn.descripcion, o.codigo_tipo_negocio
      ORDER BY ventas_total DESC
    `, {
      replacements: { inicio, fin },
      type: Sequelize.QueryTypes.SELECT,
    });

    const porCategoria = await sequelize.query(`
      SELECT
        COALESCE(dd.descripcion_categoria, 'Sin categoría')   AS categoria,
        ROUND(SUM(dd.total)::numeric, 2)                      AS ventas_total,
        ROUND(SUM(COALESCE(dd.margen_linea, 0))::numeric, 2)  AS margen_total,
        ROUND(SUM(dd.cantidad)::numeric, 0)                   AS unidades,
        CASE WHEN SUM(dd.total) > 0
          THEN ROUND((SUM(COALESCE(dd.margen_linea,0))::numeric / SUM(dd.total)::numeric) * 100, 2)
          ELSE 0
        END                                                   AS margen_pct
      FROM detalle_documento dd
      JOIN ordenes o ON o.code = dd.documento_code
      WHERE o.fecha_creacion >= :inicio AND o.fecha_creacion < :fin
        AND o.status IN (2,4,5)
      GROUP BY dd.descripcion_categoria
      ORDER BY ventas_total DESC
      LIMIT 20
    `, {
      replacements: { inicio, fin },
      type: Sequelize.QueryTypes.SELECT,
    });

    const totalVentas = porCanal.reduce((s, r) => s + Number(r.ventas_total), 0);
    const totalMargen = porCanal.reduce((s, r) => s + Number(r.margen_total), 0);
    const margenGlobal = totalVentas > 0 ? Math.round((totalMargen / totalVentas) * 100 * 100) / 100 : 0;

    res.json({ porCanal, porCategoria, resumen: { totalVentas, totalMargen, margenGlobal }, anio, mes });
  } catch (err) {
    console.error("getMargenCanal:", err.message);
    res.status(500).json({ error: err.message });
  }
};

// ================================================================
// 6. KPIs EJECUTIVOS (resumen rápido para el header)
// ================================================================
exports.getKpisEjecutivos = async (req, res) => {
  try {
    const { anio, mes } = getAnioMes(req.query);
    const inicio    = getInicio(anio, mes);
    const fin       = getFin(anio, mes);

    let mAnt = mes - 1, aAnt = anio;
    if (mAnt === 0) { mAnt = 12; aAnt--; }
    const inicioAnt = getInicio(aAnt, mAnt);
    const finAnt    = getFin(aAnt, mAnt);

    const [actual, anterior] = await Promise.all([
      sequelize.query(`
        SELECT
          ROUND(SUM(o.total)::numeric, 2)               AS ventas,
          COALESCE(SUM(dd.cantidad)::int, 0)             AS unidades,
          COUNT(DISTINCT o.code)                         AS pedidos,
          COUNT(DISTINCT o.customer_code)                AS clientes_activos,
          ROUND(SUM(COALESCE(o.margen,0))::numeric, 2)  AS margen
        FROM ordenes o
        LEFT JOIN detalle_documento dd ON dd.documento_code = o.code
        WHERE o.fecha_creacion >= :inicio AND o.fecha_creacion < :fin
          AND o.status IN (2,4,5)
      `, { replacements: { inicio, fin }, type: Sequelize.QueryTypes.SELECT }),

      sequelize.query(`
        SELECT ROUND(SUM(o.total)::numeric,2) AS ventas
        FROM ordenes o
        WHERE o.fecha_creacion >= :inicio AND o.fecha_creacion < :fin
          AND o.status IN (2,4,5)
      `, { replacements: { inicio: inicioAnt, fin: finAnt }, type: Sequelize.QueryTypes.SELECT }),
    ]);

    const ventasAct = Number(actual[0]?.ventas  || 0);
    const ventasAnt = Number(anterior[0]?.ventas || 0);
    const variacion = ventasAnt > 0
      ? Math.round(((ventasAct - ventasAnt) / ventasAnt) * 100 * 10) / 10
      : null;

    res.json({
      ventas:          ventasAct,
      unidades:        Number(actual[0]?.unidades        || 0),
      pedidos:         Number(actual[0]?.pedidos         || 0),
      clientes_activos:Number(actual[0]?.clientes_activos|| 0),
      margen:          Number(actual[0]?.margen          || 0),
      ventas_anterior: ventasAnt,
      variacion_pct:   variacion,
      anio, mes,
    });
  } catch (err) {
    console.error("getKpisEjecutivos:", err.message);
    res.status(500).json({ error: err.message });
  }
};

// ================================================================
// 7. TOP PRODUCTOS (ventas, unidades, margen)
// ================================================================
exports.getTopProductos = async (req, res) => {
  try {
    const { anio, mes } = getAnioMes(req.query);
    const inicio = getInicio(anio, mes);
    const fin    = getFin(anio, mes);
    const limite = parseInt(req.query.limite) || 20;

    const rows = await sequelize.query(`
      SELECT
        COALESCE(dd.producto_nombre, dd.descripcion, dd.codigo_producto)  AS producto,
        dd.codigo_producto,
        COALESCE(dd.descripcion_categoria, 'Sin categoría')               AS categoria,
        ROUND(SUM(dd.total)::numeric, 2)                                   AS ventas_total,
        ROUND(SUM(dd.cantidad)::numeric, 0)                                AS unidades,
        ROUND(SUM(COALESCE(dd.margen_linea, 0))::numeric, 2)               AS margen_total,
        COUNT(DISTINCT o.customer_code)                                    AS num_clientes,
        COUNT(DISTINCT o.code)                                             AS num_pedidos,
        CASE WHEN SUM(dd.total) > 0
          THEN ROUND((SUM(COALESCE(dd.margen_linea,0))::numeric / SUM(dd.total)::numeric) * 100, 2)
          ELSE 0
        END                                                                AS margen_pct,
        ROUND(AVG(COALESCE(dd.precio, dd.precio_sin_impuesto))::numeric, 4) AS precio_promedio
      FROM detalle_documento dd
      JOIN ordenes o ON o.code = dd.documento_code
      WHERE o.fecha_creacion >= :inicio AND o.fecha_creacion < :fin
        AND o.status IN (2,4,5)
      GROUP BY dd.producto_nombre, dd.descripcion, dd.codigo_producto, dd.descripcion_categoria
      ORDER BY ventas_total DESC
      LIMIT :limite
    `, {
      replacements: { inicio, fin, limite },
      type: Sequelize.QueryTypes.SELECT,
    });

    res.json({ productos: dedupeProductosVendidos(rows), anio, mes });
  } catch (err) {
    console.error("getTopProductos:", err.message);
    res.status(500).json({ error: err.message });
  }
};

// ================================================================
// 8. CLIENTES NUEVOS vs RECURRENTES
// ================================================================
exports.getClientesNuevosVsRecurrentes = async (req, res) => {
  try {
    const { anio, mes } = getAnioMes(req.query);
    const inicio = getInicio(anio, mes);
    const fin    = getFin(anio, mes);

    const rows = await sequelize.query(`
      WITH primera_compra AS (
        SELECT customer_code, MIN(fecha_creacion) AS primera
        FROM ordenes WHERE status IN (2,4,5)
        GROUP BY customer_code
      ),
      activos_mes AS (
        SELECT DISTINCT o.customer_code
        FROM ordenes o
        WHERE o.fecha_creacion >= :inicio AND o.fecha_creacion < :fin
          AND o.status IN (2,4,5)
      )
      SELECT
        SUM(CASE WHEN pc.primera >= :inicio AND pc.primera < :fin THEN 1 ELSE 0 END)  AS nuevos,
        SUM(CASE WHEN pc.primera < :inicio THEN 1 ELSE 0 END)                          AS recurrentes,
        COUNT(*)                                                                         AS total_activos
      FROM activos_mes am
      JOIN primera_compra pc ON pc.customer_code = am.customer_code
    `, {
      replacements: { inicio, fin },
      type: Sequelize.QueryTypes.SELECT,
    });

    // Tendencia últimos 6 meses
    const tendencia = await sequelize.query(`
      WITH meses AS (
        SELECT generate_series(
          DATE_TRUNC('month', :fin::date) - INTERVAL '5 months',
          DATE_TRUNC('month', :fin::date),
          '1 month'
        ) AS mes_ini
      ),
      primera_compra AS (
        SELECT customer_code, MIN(fecha_creacion) AS primera
        FROM ordenes WHERE status IN (2,4,5)
        GROUP BY customer_code
      )
      SELECT
        TO_CHAR(m.mes_ini, 'Mon YY') AS label,
        COUNT(DISTINCT CASE WHEN pc.primera >= m.mes_ini AND pc.primera < m.mes_ini + INTERVAL '1 month' THEN o.customer_code END) AS nuevos,
        COUNT(DISTINCT CASE WHEN pc.primera < m.mes_ini THEN o.customer_code END) AS recurrentes
      FROM meses m
      LEFT JOIN ordenes o ON o.fecha_creacion >= m.mes_ini AND o.fecha_creacion < m.mes_ini + INTERVAL '1 month' AND o.status IN (2,4,5)
      LEFT JOIN primera_compra pc ON pc.customer_code = o.customer_code
      GROUP BY m.mes_ini
      ORDER BY m.mes_ini
    `, {
      replacements: { fin },
      type: Sequelize.QueryTypes.SELECT,
    });

    res.json({ resumen: rows[0] || {}, tendencia, anio, mes });
  } catch (err) {
    console.error("getClientesNuevosVsRecurrentes:", err.message);
    res.status(500).json({ error: err.message });
  }
};

// ================================================================
// 9. PROYECCIÓN DEL MES (basada en días transcurridos)
// ================================================================
exports.getProyeccion = async (req, res) => {
  try {
    const { anio, mes } = getAnioMes(req.query);
    const inicio = getInicio(anio, mes);
    const fin    = getFin(anio, mes);

    // Días del mes y días transcurridos
    const diasMes = new Date(anio, mes, 0).getDate();
    const hoy = new Date();
    const esActual = hoy.getFullYear() === anio && (hoy.getMonth() + 1) === mes;
    const diasTranscurridos = esActual
      ? Math.max(1, hoy.getDate())
      : diasMes;

    const rows = await sequelize.query(`
      SELECT
        ROUND(SUM(o.total)::numeric, 2)   AS ventas_actual,
        COUNT(DISTINCT o.code)             AS pedidos_actual,
        COUNT(DISTINCT o.customer_code)    AS clientes_actual
      FROM ordenes o
      WHERE o.fecha_creacion >= :inicio AND o.fecha_creacion < :fin
        AND o.status IN (2,4,5)
    `, {
      replacements: { inicio, fin },
      type: Sequelize.QueryTypes.SELECT,
    });

    // Mes anterior para comparar
    let mAnt = mes - 1, aAnt = anio;
    if (mAnt === 0) { mAnt = 12; aAnt--; }
    const iniAnt = getInicio(aAnt, mAnt);
    const finAnt = getFin(aAnt, mAnt);
    const anterior = await sequelize.query(`
      SELECT ROUND(SUM(o.total)::numeric,2) AS ventas_anterior
      FROM ordenes o
      WHERE o.fecha_creacion >= :inicio AND o.fecha_creacion < :fin
        AND o.status IN (2,4,5)
    `, {
      replacements: { inicio: iniAnt, fin: finAnt },
      type: Sequelize.QueryTypes.SELECT,
    });

    const ventasActual    = Number(rows[0]?.ventas_actual || 0);
    const ventasAnterior  = Number(anterior[0]?.ventas_anterior || 0);
    const tasaDiaria      = diasTranscurridos > 0 ? ventasActual / diasTranscurridos : 0;
    const proyeccion      = Math.round(tasaDiaria * diasMes * 100) / 100;
    const pctMesAnterior  = ventasAnterior > 0
      ? Math.round((proyeccion / ventasAnterior) * 100)
      : null;

    res.json({
      ventas_actual:     ventasActual,
      dias_transcurridos: diasTranscurridos,
      dias_mes:           diasMes,
      tasa_diaria:        Math.round(tasaDiaria * 100) / 100,
      proyeccion,
      ventas_anterior:    ventasAnterior,
      pct_mes_anterior:   pctMesAnterior,
      pedidos_actual:     Number(rows[0]?.pedidos_actual   || 0),
      clientes_actual:    Number(rows[0]?.clientes_actual  || 0),
      anio, mes,
    });
  } catch (err) {
    console.error("getProyeccion:", err.message);
    res.status(500).json({ error: err.message });
  }
};

// ================================================================
// 10. RANKING DE CLIENTES (top compradores del mes)
// ================================================================
exports.getRankingClientes = async (req, res) => {
  try {
    const { anio, mes } = getAnioMes(req.query);
    const inicio = getInicio(anio, mes);
    const fin    = getFin(anio, mes);
    const limite = parseInt(req.query.limite) || 25;

    const rows = await sequelize.query(`
      SELECT
        o.customer_code,
        COALESCE(c.nombre_cliente, o.customer_code)              AS nombre_cliente,
        c.telefono_cliente,
        COALESCE(tn.descripcion, 'Sin clasificar')               AS tipo_negocio,
        o.seller_code,
        ROUND(SUM(o.total)::numeric, 2)                          AS ventas_total,
        COALESCE(SUM(dd.cantidad)::int, 0)                        AS unidades_total,
        COUNT(DISTINCT o.code)                                   AS num_pedidos,
        ROUND(AVG(o.total)::numeric, 2)                          AS ticket_promedio,
        ROUND(SUM(COALESCE(o.margen, 0))::numeric, 2)            AS margen_total
      FROM ordenes o
      LEFT JOIN clientes c    ON c.codigo_cliente = o.customer_code
      LEFT JOIN tipos_negocio tn ON tn.codigo = o.codigo_tipo_negocio
      LEFT JOIN detalle_documento dd ON dd.documento_code = o.code
      WHERE o.fecha_creacion >= :inicio AND o.fecha_creacion < :fin
        AND o.status IN (2,4,5)
      GROUP BY o.customer_code, c.nombre_cliente, c.telefono_cliente, tn.descripcion, o.seller_code
      ORDER BY ventas_total DESC
      LIMIT :limite
    `, {
      replacements: { inicio, fin, limite },
      type: Sequelize.QueryTypes.SELECT,
    });

    res.json({ clientes: rows, anio, mes });
  } catch (err) {
    console.error("getRankingClientes:", err.message);
    res.status(500).json({ error: err.message });
  }
};
