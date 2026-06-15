// controllers/COTTSAController.js
const { sequelize, MetaPreventa, CottsaExtraMes, PosOrder, PosOrderLine } = require('../../models');
const Sequelize = require('sequelize');
const { getDiasHabilesTranscurridos, getDiasLaborablesMes } = require('../../utils/diasFestivos');
const { dedupeProductosVendidos } = require('../../utils/dedupeProductos');

CottsaExtraMes.sync().catch(err =>
  console.error('⚠️ sync CottsaExtraMes:', err.message)
);

// Tablas POS — se llenan desde sincronizacionOdooService al sincronizar.
// El dashboard actual sigue leyendo en vivo desde Odoo; estas tablas son
// el cache local persistente para uso futuro.
PosOrder.sync().catch(err =>
  console.error('⚠️ sync PosOrder:', err.message)
);
PosOrderLine.sync().catch(err =>
  console.error('⚠️ sync PosOrderLine:', err.message)
);

const COTTSA_COMPANY_ID = 3;

// Rutas COTTSA reportadas. Se usa filtro ESTRICTO (igualdad exacta) para
// excluir variantes como 'RUTA 132.1' que operativamente son cajas POS
// distintas y se reportan aparte. El sync (extraerRutaPorSerie) garantiza
// que las facturas/NotCr lleguen ya con uno de estos 3 valores literales,
// o con 'RUTA 132.1' / null cuando corresponde excluirlas del reporte.
const COTTSA_SELLER_CODES = ['RUTA 113', 'RUTA 131', 'RUTA 132'];
const COTTSA_SELLER_FILTER = `f.seller_code IN (${COTTSA_SELLER_CODES.map(c => `'${c}'`).join(', ')})`;

// ================================================================
// HELPERS
// ================================================================
const obtenerObjetivosGerencia = async (anioNum, mesNum) => {
  try {
    const registros = await MetaPreventa.findAll({
      where: { mes: mesNum, anio: anioNum },
      attributes: ['codigo_ruta', 'meta_dolares', 'meta_unidades'],
      raw: true,
    });

    const mapa = {};
    registros.forEach(m => {
      mapa[String(m.codigo_ruta || '').trim().toUpperCase()] = {
        meta_dolares: Number(m.meta_dolares) || 0,
        meta_unidades: Number(m.meta_unidades) || 0,
      };
    });

    return mapa;
  } catch {
    return {};
  }
};

// ================================================================
// FECHAS
// ================================================================
function getFechaInicioMes(anio, mes) {
  return `${anio}-${String(mes).padStart(2, '0')}-01 00:00:00`;
}

function getFechaFinMes(anio, mes) {
  let mesFin = mes + 1;
  let anioFin = anio;

  if (mesFin === 13) {
    mesFin = 1;
    anioFin++;
  }

  return `${anioFin}-${String(mesFin).padStart(2, '0')}-01 00:00:00`;
}

// ================================================================
// VENTAS POR RUTA
// ================================================================
const obtenerVentasCOTTSAPorRuta = async (anioNum, mesNum, fechaFin = null) => {
  const inicio = getFechaInicioMes(anioNum, mesNum);
  const fin = fechaFin || getFechaFinMes(anioNum, mesNum);

  // Filtro estricto: solo entran 'RUTA 113', 'RUTA 131', 'RUTA 132'.
  // Los POS RUTA 132.1 quedan fuera (gerencia los reporta aparte).
  // SOLO Facts: las NotCr/reembolsos se manejan en una fila de "ajustes"
  // aparte para que el desglose muestre valores brutos por ruta.
  const sql = `
    SELECT
      f.seller_code AS vendedor,
      f.seller_code AS ruta,

      SUM(dd.cantidad) AS unidades,
      SUM(dd.subtotal) AS subtotal,
      SUM(dd.total)    AS dolares,

      COUNT(DISTINCT f.code) AS cant_facturas,
      COUNT(DISTINCT f.customer_code) AS cant_clientes

    FROM facturas f
    JOIN detalle_documento dd ON dd.documento_code = f.code

    WHERE f.company_id = ${COTTSA_COMPANY_ID}
      AND ${COTTSA_SELLER_FILTER}
      AND f.fecha_entrega >= '${inicio}'
      AND f.fecha_entrega < '${fin}'
      AND f.status IN (2,4,5)
      AND f.tipo_documento = '(01) Invoice'

    GROUP BY f.seller_code
    ORDER BY dolares DESC;
  `;

  return sequelize.query(sql, { type: Sequelize.QueryTypes.SELECT });
};

// ================================================================
// VENTAS POS COTTSA (kenny navas — todas las cajas POS agrupadas)
// Suma Facts y resta NotCr de las series POS:
//   POS RUTA 113 / POS RUTA 131 / RUTA 132.1
// Devuelve UNA sola fila con el agregado.
// ================================================================
const COTTSA_POS_SELLER_CODES = ['POS RUTA 113', 'POS RUTA 131', 'RUTA 132.1'];
const COTTSA_POS_FILTER = `f.seller_code IN (${COTTSA_POS_SELLER_CODES.map(c => `'${c}'`).join(', ')})`;

// Filtro combinado: preventa + POS — para listas que deben mostrar TODOS
// los clientes/productos de COTTSA (ej. /clientes), alineado con el total
// "COTTSA — AGUA OK" del dashboard.
const COTTSA_TODOS_SELLER_CODES = [...COTTSA_SELLER_CODES, ...COTTSA_POS_SELLER_CODES];
const COTTSA_TODOS_FILTER = `f.seller_code IN (${COTTSA_TODOS_SELLER_CODES.map(c => `'${c}'`).join(', ')})`;

const obtenerVentasPOSCOTTSA = async (anioNum, mesNum, fechaFin = null) => {
  const inicio = getFechaInicioMes(anioNum, mesNum);
  const fin = fechaFin || getFechaFinMes(anioNum, mesNum);

  // SOLO Facts del bucket POS (POS RUTA 113 / POS RUTA 131 / RUTA 132.1).
  // Las NotCr/reembolsos vienen aparte desde Odoo (obtenerResumenReembolsosCOTTSA)
  // para evitar que NotCr facturadas tarde con fecha_entrega corrida queden fuera.
  const sql = `
    SELECT
      COALESCE(SUM(dd.cantidad), 0) AS unidades,
      COALESCE(SUM(dd.subtotal), 0) AS subtotal,
      COALESCE(SUM(dd.total), 0)    AS dolares,
      COUNT(DISTINCT f.code)        AS cant_facturas,
      COUNT(DISTINCT f.customer_code) AS cant_clientes
    FROM facturas f
    JOIN detalle_documento dd ON dd.documento_code = f.code
    WHERE f.company_id = ${COTTSA_COMPANY_ID}
      AND ${COTTSA_POS_FILTER}
      AND f.fecha_entrega >= '${inicio}'
      AND f.fecha_entrega < '${fin}'
      AND f.status IN (2,4,5)
      AND f.tipo_documento = '(01) Invoice';
  `;

  const rows = await sequelize.query(sql, { type: Sequelize.QueryTypes.SELECT });
  return rows[0] || { unidades: 0, subtotal: 0, dolares: 0, cant_facturas: 0, cant_clientes: 0 };
};

// ================================================================
// HELPER — rango UTC del mes (00:00 Ecuador = 05:00 UTC).
// Odoo guarda datetime en UTC y el sync los persiste así en pos_orders;
// por eso filtramos contra date_order con el offset +5h.
// ================================================================
const getRangoMesUTC = (anioNum, mesNum) => {
  const inicio = new Date(Date.UTC(anioNum, mesNum - 1, 1, 5, 0, 0));
  let mesFin = mesNum + 1, anioFin = anioNum;
  if (mesFin === 13) { mesFin = 1; anioFin++; }
  const fin = new Date(Date.UTC(anioFin, mesFin - 1, 1, 5, 0, 0));
  return { inicio, fin };
};

// ================================================================
// DATOS COTTSA — leídos de pos_orders/pos_order_lines locales.
// Replica EXACTAMENTE el SQL que usa el reporte "Análisis del TPV":
//
//   SELECT rp.name AS vendedor,
//          COUNT(rpo.id), SUM(rpo.product_qty), SUM(rpo.price_total)
//   FROM report_pos_order rpo
//   LEFT JOIN res_users   ru ON rpo.user_id   = ru.id
//   LEFT JOIN res_partner rp ON ru.partner_id = rp.id
//   WHERE state IN ('paid','invoiced') GROUP BY rp.name;
//
// Equivalencias en BD local (sincronizadas por sincronizacionOdooService):
//   - report.pos.order (1 fila/línea) ≡ pos_order_lines JOIN pos_orders
//   - res.users.partner_id.name       ≡ pos_orders.user_partner_name
//   - price_total                     ≡ pos_order_lines.price_subtotal_incl
//   - product_qty                     ≡ pos_order_lines.qty
// ================================================================
const obtenerDatosCOTTSADesdeOdoo = async (anioNum, mesNum) => {
  const vacio = { ranking: [], pos: null };
  const { inicio, fin } = getRangoMesUTC(anioNum, mesNum);

  try {
    const rows = await sequelize.query(`
      WITH stats AS (
        SELECT
          po.user_id,
          po.user_partner_name AS partner_name,
          COUNT(pol.odoo_id)                          AS lineas,
          COALESCE(SUM(pol.qty), 0)                   AS unidades,
          COALESCE(SUM(pol.price_subtotal_incl), 0)   AS dolares
        FROM pos_orders po
        LEFT JOIN pos_order_lines pol
               ON pol.order_odoo_id = po.odoo_id
        WHERE po.company_id  = :companyId
          AND po.date_order >= :inicio
          AND po.date_order <  :fin
          AND po.state IN ('paid', 'invoiced')
        GROUP BY po.user_id, po.user_partner_name
      ),
      partners_por_user AS (
        SELECT
          user_id,
          ARRAY_AGG(DISTINCT partner_id)
            FILTER (WHERE partner_id IS NOT NULL) AS partner_ids
        FROM pos_orders
        WHERE company_id  = :companyId
          AND date_order >= :inicio
          AND date_order <  :fin
          AND state IN ('paid', 'invoiced')
        GROUP BY user_id
      )
      SELECT s.user_id, s.partner_name, s.lineas, s.unidades, s.dolares,
             p.partner_ids
      FROM stats s
      LEFT JOIN partners_por_user p ON p.user_id = s.user_id
    `, {
      replacements: { companyId: COTTSA_COMPANY_ID, inicio, fin },
      type: Sequelize.QueryTypes.SELECT,
    });

    if (!rows.length) return vacio;

    // Agrupar por ruta extraída del partner_name (igual que el código original).
    // Si dos user_id resuelven a "RUTA 113", consolidamos.
    const grupoPorRuta = {};
    let kennyDolares = 0, kennyUnidades = 0, kennyLineas = 0;
    const kennyClientes = new Set();

    for (const r of rows) {
      const partnerName = r.partner_name || '';
      const lineas = Number(r.lineas) || 0;
      const dolares = Number(r.dolares) || 0;
      const unidades = Number(r.unidades) || 0;
      const partnerIds = Array.isArray(r.partner_ids) ? r.partner_ids : [];

      const m = String(partnerName).match(/RUTA\s*\d+/i);
      const ruta = m ? m[0].toUpperCase().replace(/\s+/g, ' ') : null;

      if (!ruta) {
        kennyDolares += dolares;
        kennyUnidades += unidades;
        kennyLineas += lineas;
        for (const c of partnerIds) kennyClientes.add(c);
        continue;
      }

      if (!grupoPorRuta[ruta]) {
        grupoPorRuta[ruta] = { unidades: 0, dolares: 0, lineas: 0, clientes: new Set() };
      }
      grupoPorRuta[ruta].unidades += unidades;
      grupoPorRuta[ruta].dolares  += dolares;
      grupoPorRuta[ruta].lineas   += lineas;
      for (const c of partnerIds) grupoPorRuta[ruta].clientes.add(c);
    }

    const ranking = Object.entries(grupoPorRuta)
      .map(([ruta, g]) => ({
        ruta,
        vendedor: ruta,
        unidades: g.unidades,
        subtotal: Number(g.dolares.toFixed(2)),
        dolares:  Number(g.dolares.toFixed(2)),
        cant_facturas: g.lineas,
        cant_clientes: g.clientes.size,
      }))
      .sort((a, b) => b.dolares - a.dolares);

    const pos = {
      unidades: kennyUnidades,
      subtotal: Number(kennyDolares.toFixed(2)),
      dolares:  Number(kennyDolares.toFixed(2)),
      cant_facturas: kennyLineas,
      cant_clientes: kennyClientes.size,
    };

    return { ranking, pos };
  } catch (err) {
    console.warn('⚠️ obtenerDatosCOTTSADesdeOdoo (BD):', err?.message || err);
    return vacio;
  }
};

// ================================================================
// REEMBOLSOS COTTSA — TODOS los pos.order negativos del período
// (facturados como NotCr + huérfanos sin account_move).
//
// Lee de pos_orders local. El sync persiste date_order en UTC, así
// que las NotCr facturadas tarde con fecha_entrega corrida en BD se
// resuelven correctamente vía pos.order.date_order (fecha real POS).
// ================================================================
const obtenerResumenReembolsosCOTTSA = async (anioNum, mesNum) => {
  const vacio = { total: 0, cantidad: 0, huerfanosTotal: 0, huerfanosCantidad: 0 };
  const { inicio, fin } = getRangoMesUTC(anioNum, mesNum);

  try {
    const [row] = await sequelize.query(`
      SELECT
        COALESCE(SUM(ABS(amount_total)), 0)          AS total,
        COUNT(*)                                      AS cantidad,
        COALESCE(SUM(CASE WHEN account_move_id IS NULL
                          THEN ABS(amount_total) ELSE 0 END), 0) AS huerfanos_total,
        COUNT(*) FILTER (WHERE account_move_id IS NULL) AS huerfanos_cantidad
      FROM pos_orders
      WHERE company_id  = :companyId
        AND amount_total < 0
        AND date_order >= :inicio
        AND date_order <  :fin
        AND state IN ('paid', 'invoiced', 'done')
    `, {
      replacements: { companyId: COTTSA_COMPANY_ID, inicio, fin },
      type: Sequelize.QueryTypes.SELECT,
    });

    return {
      total:             Number(Number(row?.total || 0).toFixed(2)),
      cantidad:          Number(row?.cantidad || 0),
      huerfanosTotal:    Number(Number(row?.huerfanos_total || 0).toFixed(2)),
      huerfanosCantidad: Number(row?.huerfanos_cantidad || 0),
    };
  } catch (err) {
    console.warn('⚠️ obtenerResumenReembolsosCOTTSA (BD):', err?.message || err);
    return vacio;
  }
};

// ================================================================
// ENDPOINT PRINCIPAL
// ================================================================
const obtenerDashboardCOTTSA = async (req, res) => {
  try {
    const { anio, mes } = req.query;

    if (!anio || !mes) {
      return res.status(400).json({ error: 'Debe enviar anio y mes' });
    }

    const anioNum = parseInt(anio, 10);
    const mesNum = parseInt(mes, 10);

    if (isNaN(anioNum) || isNaN(mesNum) || mesNum < 1 || mesNum > 12) {
      return res.status(400).json({ error: 'Parámetros inválidos' });
    }

    const hoy = new Date();
    const esMesCerrado =
      anioNum < hoy.getFullYear() ||
      (anioNum === hoy.getFullYear() && mesNum < hoy.getMonth() + 1);

    const fechaFin = getFechaFinMes(anioNum, mesNum);

    const diasTranscurridos = getDiasHabilesTranscurridos(anioNum, mesNum);
    const diasLaborables = getDiasLaborablesMes(anioNum, mesNum);

    let mesPrev = mesNum - 1;
    let anioPrev = anioNum;

    if (mesPrev === 0) {
      mesPrev = 12;
      anioPrev--;
    }

    // Datos del mes actual y anterior leídos desde pos_orders local
    // (sincronizado por sincronizacionOdooService). Cuadra con el reporte
    // "Análisis del TPV" porque incluye TODOS los pedidos POS del período
    // (no depende de account.move ya facturado en BD). Los huérfanos siguen
    // calculándose con obtenerResumenReembolsosCOTTSA porque el banner de UI
    // necesita su detalle (cantidad / total específico).
    const [datosActuales, datosAnteriores, reembolsosActuales, objetivos] = await Promise.all([
      obtenerDatosCOTTSADesdeOdoo(anioNum, mesNum),
      obtenerDatosCOTTSADesdeOdoo(anioPrev, mesPrev),
      obtenerResumenReembolsosCOTTSA(anioNum, mesNum),
      obtenerObjetivosGerencia(anioNum, mesNum),
    ]);

    const mapAnterior = {};
    (datosAnteriores.ranking || []).forEach(r => {
      const key = String(r.ruta || '').toUpperCase();
      mapAnterior[key] = Number(r.dolares) || 0;
    });

    const ranking = (datosActuales.ranking || []).map(r => {
      const actual = Number(r.dolares) || 0;
      const key = String(r.ruta || '').toUpperCase();
      const anterior = mapAnterior[key] || 0;

      const base = Math.max(diasTranscurridos, 1);
      const proyeccion = esMesCerrado
        ? actual
        : (actual / base) * diasLaborables;

      const variacionAbs = proyeccion - anterior;
      const variacionPorc = anterior > 0
        ? (variacionAbs / anterior) * 100
        : null;

      const obj = objetivos[key] || { meta_dolares: 0, meta_unidades: 0 };

      return {
        ruta: r.ruta,
        vendedor: r.vendedor,
        unidades: Number(r.unidades) || 0,
        subtotal: Number(r.subtotal) || 0,
        dolares: actual,
        proyeccion: Number(proyeccion.toFixed(2)),
        cant_facturas: Number(r.cant_facturas) || 0,
        cant_clientes: Number(r.cant_clientes) || 0,
        objetivo_gerencia: obj.meta_dolares,
        objetivo_gerencia_unidades: obj.meta_unidades,
        vsMesAnterior: {
          dolares_anterior: Number(anterior.toFixed(2)),
          variacion_abs: Number(variacionAbs.toFixed(2)),
          variacion_porc: variacionPorc !== null ? Number(variacionPorc.toFixed(2)) : null,
        },
      };
    });

    // Bloque POS — Kenny Navas. Ahora viene directo desde pos.order:
    // todos los pedidos negativos + los positivos sin "RUTA XXX" en name.
    // Los huérfanos siguen calculándose aparte solo para el banner de UI.
    const posActual = datosActuales.pos || {
      unidades: 0, subtotal: 0, dolares: 0, cant_facturas: 0, cant_clientes: 0,
    };
    const posAnt = datosAnteriores.pos || { dolares: 0 };

    const huerfanosTotal = Number(reembolsosActuales?.huerfanosTotal) || 0;
    const huerfanosCant = Number(reembolsosActuales?.huerfanosCantidad) || 0;

    const posDolares = Number(posActual.dolares) || 0;
    const posDolaresAnt = Number(posAnt.dolares) || 0;
    const posVarAbs = posDolares - posDolaresAnt;
    const posVarPorc = posDolaresAnt !== 0
      ? (posVarAbs / Math.abs(posDolaresAnt)) * 100
      : null;

    const pos = {
      label: 'POS - Kenny Navas',
      unidades: Number(posActual.unidades) || 0,
      subtotal: Number(Number(posActual.subtotal).toFixed(2)),
      dolares: Number(posDolares.toFixed(2)),
      cant_facturas: Number(posActual.cant_facturas) || 0,
      cant_clientes: Number(posActual.cant_clientes) || 0,
      huerfanos: { total: huerfanosTotal, cantidad: huerfanosCant },
      vsMesAnterior: {
        dolares_anterior: Number(posDolaresAnt.toFixed(2)),
        variacion_abs: Number(posVarAbs.toFixed(2)),
        variacion_porc: posVarPorc !== null ? Number(posVarPorc.toFixed(2)) : null,
      },
    };

    // Totales: ranking (positivos por ruta) + POS Kenny Navas (negativos).
    // Cuadra con "Total" del reporte Análisis del TPV de Odoo.
    const totales = {
      unidades: ranking.reduce((a, r) => a + r.unidades, 0) + pos.unidades,
      dolares: ranking.reduce((a, r) => a + r.dolares, 0) + pos.dolares,
      proyeccion: ranking.reduce((a, r) => a + r.proyeccion, 0) + pos.dolares,
      cant_facturas: ranking.reduce((a, r) => a + r.cant_facturas, 0) + pos.cant_facturas,
      cant_clientes: ranking.reduce((a, r) => a + r.cant_clientes, 0) + pos.cant_clientes,
    };

    return res.json({ ranking, pos, totales });

  } catch (error) {
    console.error('❌ DASHBOARD:', error);
    return res.status(500).json({ message: 'Error dashboard' });
  }
};

// ================================================================
// ENDPOINT DETALLE POR RUTA / VENDEDOR
// ================================================================
const obtenerDetalleRutaCOTTSA = async (req, res) => {
  try {
    const { ruta, vendedor, anio, mes } = req.query;

    if ((!ruta && !vendedor) || !anio || !mes)
      return res.status(400).json({ error: 'Debe enviar (ruta o vendedor), anio y mes' });

    const anioNum = parseInt(anio, 10);
    const mesNum = parseInt(mes, 10);

    const inicio = getFechaInicioMes(anioNum, mesNum);
    const fin = getFechaFinMes(anioNum, mesNum);

    const inicioAnio = `${anioNum}-01-01 00:00:00`;
    const finAnio = `${anioNum + 1}-01-01 00:00:00`;

    // Igualdad estricta — el seller_code llega exacto desde la tabla principal
    // ('RUTA 113' / 'RUTA 131' / 'RUTA 132'). Sanitizamos comillas para
    // evitar inyección SQL.
    const filtro = vendedor
      ? `f.seller_code = '${String(vendedor).replace(/'/g, "''")}'`
      : `f.route_code = '${String(ruta).replace(/'/g, "''")}'`;

    // ============================
    //  PRODUCTOS (CORREGIDO)
    // ============================
    const productosSql = `
      SELECT
        dd.codigo_producto,
        dd.descripcion,

        SUM(
          CASE 
            WHEN f.tipo_documento = '(01) Invoice' THEN dd.cantidad
            WHEN f.tipo_documento = '(04) Credit Note' THEN -dd.cantidad
            ELSE 0
          END
        ) AS unidades,

        SUM(
          CASE 
            WHEN f.tipo_documento = '(01) Invoice' THEN dd.subtotal
            WHEN f.tipo_documento = '(04) Credit Note' THEN -dd.subtotal
            ELSE 0
          END
        ) AS subtotal,

        SUM(
          CASE 
            WHEN f.tipo_documento = '(01) Invoice' THEN dd.total
            WHEN f.tipo_documento = '(04) Credit Note' THEN -dd.total
            ELSE 0
          END
        ) AS dolares

      FROM facturas f
      JOIN detalle_documento dd ON dd.documento_code = f.code

      WHERE f.company_id = ${COTTSA_COMPANY_ID}
        AND ${COTTSA_SELLER_FILTER}
        AND f.status IN (2)
        AND f.tipo_documento IN ('(01) Invoice','(04) Credit Note')
        AND ${filtro}
        AND f.fecha_entrega >= '${inicio}'
        AND f.fecha_entrega <  '${fin}'

      GROUP BY dd.codigo_producto, dd.descripcion
      ORDER BY unidades DESC;
    `;

    // ============================
    //  CLIENTES (SIN CAMBIOS LÓGICOS)
    // ============================
    const clientesSql = `
      SELECT
        COUNT(DISTINCT f.customer_code) AS total_clientes,
        COUNT(DISTINCT CASE
          WHEN f.fecha_entrega >= '${inicio}'
           AND f.fecha_entrega < '${fin}'
          THEN f.customer_code END) AS con_consumo
      FROM facturas f
      WHERE f.company_id = ${COTTSA_COMPANY_ID}
        AND ${COTTSA_SELLER_FILTER}
        AND f.status IN (2)
        AND ${filtro}
        AND f.fecha_entrega >= '${inicioAnio}'
        AND f.fecha_entrega < '${finAnio}';
    `;

    const [productos, clientesData] = await Promise.all([
      sequelize.query(productosSql, { type: Sequelize.QueryTypes.SELECT }),
      sequelize.query(clientesSql, { type: Sequelize.QueryTypes.SELECT }),
    ]);

    const totalClientes = Number(clientesData[0]?.total_clientes || 0);
    const conConsumo = Number(clientesData[0]?.con_consumo || 0);

    return res.status(200).json({
      productos,
      resumen: {
        totalClientes,
        conConsumo,
        sinConsumo: totalClientes - conConsumo,
      },
    });

  } catch (error) {
    console.error('❌ Error en obtenerDetalleRutaCOTTSA:', error);
    return res.status(500).json({ message: 'Error interno' });
  }
};

// ================================================================
// ENDPOINT CLIENTES COTTSA (todos los clientes del canal)
// ================================================================
const obtenerClientesCOTTSA = async (req, res) => {
  try {
    const { anio, mes } = req.query;
    if (!anio || !mes)
      return res.status(400).json({ error: 'Debe enviar ?anio=YYYY&mes=MM' });

    const anioNum = parseInt(anio, 10);
    const mesNum = parseInt(mes, 10);
    if (isNaN(anioNum) || isNaN(mesNum) || mesNum < 1 || mesNum > 12)
      return res.status(400).json({ error: 'Parámetros inválidos' });

    const inicio = getFechaInicioMes(anioNum, mesNum);
    const fin = getFechaFinMes(anioNum, mesNum);

    let mesPrev = mesNum - 1, anioPrev = anioNum;
    if (mesPrev === 0) { mesPrev = 12; anioPrev--; }
    const antInicio = getFechaInicioMes(anioPrev, mesPrev);
    const antFin = getFechaFinMes(anioPrev, mesPrev);

    const inicioAnio = `${anioNum}-01-01 00:00:00`;
    const finAnio = `${anioNum + 1}-01-01 00:00:00`;

    // 1. Todos los clientes COTTSA activos en el año
    const clientesSQL = `
      SELECT DISTINCT ON (f.customer_code)
        f.customer_code,
        c.nombre_cliente,
        c.codigo_tipo_negocio,
        tn.descripcion                                               AS tipo_negocio,
        COALESCE(best_dc.calle1_direccion_cliente, c.direccion_cliente)   AS direccion_cliente,
        COALESCE(best_dc.telefono_direccion_cliente, c.telefono_cliente)  AS telefono_cliente,
        COALESCE(best_dc.latitud_direccion_cliente,  c.latitud_cliente::NUMERIC)  AS latitud_direccion_cliente,
        COALESCE(best_dc.longitud_direccion_cliente, c.longitud_cliente::NUMERIC) AS longitud_direccion_cliente
      FROM facturas f
      LEFT JOIN clientes c         ON c.codigo_cliente = f.customer_code
      LEFT JOIN tipos_negocio tn   ON tn.codigo = c.codigo_tipo_negocio
      LEFT JOIN LATERAL (
        SELECT calle1_direccion_cliente,
               telefono_direccion_cliente,
               latitud_direccion_cliente,
               longitud_direccion_cliente
        FROM direcciones_clientes
        WHERE codigo_cliente = f.customer_code
        ORDER BY
          (latitud_direccion_cliente  IS NOT NULL AND longitud_direccion_cliente IS NOT NULL) DESC,
          (telefono_direccion_cliente IS NOT NULL) DESC
        LIMIT 1
      ) best_dc ON true
      WHERE f.company_id = ${COTTSA_COMPANY_ID}
        AND ${COTTSA_TODOS_FILTER}
        AND f.status IN (2,4,5)
        AND f.fecha_entrega >= '${inicioAnio}'
        AND f.fecha_entrega  < '${finAnio}'
      ORDER BY f.customer_code
    `;



    // 2. Consumo actual + anterior + cantidad por cliente.
    //    Las NotCr se restan dentro del CASE (mismo criterio que el dashboard
    //    para que el "consumo" del cliente refleje su NETO real).
    const consumoSQL = `
  SELECT
    f.customer_code,

    SUM(
      CASE
        WHEN f.fecha_entrega >= '${inicio}' AND f.fecha_entrega < '${fin}' THEN
          CASE
            WHEN f.tipo_documento = '(01) Invoice'     THEN  dd.total
            WHEN f.tipo_documento = '(04) Credit Note' THEN -dd.total
            ELSE 0
          END
        ELSE 0
      END
    ) AS consumo_actual,

    SUM(
      CASE
        WHEN f.fecha_entrega >= '${antInicio}' AND f.fecha_entrega < '${antFin}' THEN
          CASE
            WHEN f.tipo_documento = '(01) Invoice'     THEN  dd.total
            WHEN f.tipo_documento = '(04) Credit Note' THEN -dd.total
            ELSE 0
          END
        ELSE 0
      END
    ) AS consumo_anterior,

    SUM(
      CASE
        WHEN f.fecha_entrega >= '${inicio}' AND f.fecha_entrega < '${fin}' THEN
          CASE
            WHEN f.tipo_documento = '(01) Invoice'     THEN  dd.cantidad
            WHEN f.tipo_documento = '(04) Credit Note' THEN -dd.cantidad
            ELSE 0
          END
        ELSE 0
      END
    ) AS cantidad_actual

  FROM facturas f
  JOIN detalle_documento dd
    ON dd.documento_code = f.code

  WHERE f.company_id = ${COTTSA_COMPANY_ID}
    AND ${COTTSA_TODOS_FILTER}
    AND f.status IN (2,4,5)
    AND f.fecha_entrega >= '${inicioAnio}'
    AND f.fecha_entrega < '${finAnio}'
    AND f.tipo_documento IN ('(01) Invoice','(04) Credit Note')

  GROUP BY f.customer_code
`;

    // 3. Máximo consumo mensual del año por cliente (con NotCr restadas).
    const maxConsumoSQL = `
  WITH consumo_mensual AS (
    SELECT
      f.customer_code,
      DATE_TRUNC('month', f.fecha_entrega) AS mes,
      SUM(
        CASE
          WHEN f.tipo_documento = '(01) Invoice'     THEN  dd.total
          WHEN f.tipo_documento = '(04) Credit Note' THEN -dd.total
          ELSE 0
        END
      ) AS consumo_mes
    FROM facturas f
    JOIN detalle_documento dd
      ON dd.documento_code = f.code

    WHERE f.company_id = ${COTTSA_COMPANY_ID}
      AND ${COTTSA_TODOS_FILTER}
      AND f.status IN (2,4,5)
      AND f.tipo_documento IN ('(01) Invoice','(04) Credit Note')
      AND f.fecha_entrega >= '${inicioAnio}'
      AND f.fecha_entrega < '${finAnio}'

    GROUP BY
      f.customer_code,
      DATE_TRUNC('month', f.fecha_entrega)
  )
  SELECT DISTINCT ON (customer_code)
    customer_code,
    mes,
    consumo_mes
  FROM consumo_mensual
  ORDER BY customer_code, consumo_mes DESC
`;

    // 4. Última factura COTTSA por cliente (preventa + POS)
    const ultimaFacturaSQL = `
  SELECT
    f.customer_code,
    MAX(COALESCE(f.fecha_autorizacion, f.fecha_entrega, f.fecha_creacion)) AS ultima_factura
  FROM facturas f

  WHERE f.company_id = ${COTTSA_COMPANY_ID}
    AND ${COTTSA_TODOS_FILTER}
    AND f.status IN (2,4,5)
    AND f.tipo_documento = '(01) Invoice'

  GROUP BY f.customer_code
`;


    const [clientes, consumoData, maxConsumoData, ultimasFacturas, extraData, huerfanosResumen] = await Promise.all([
      sequelize.query(clientesSQL, { type: Sequelize.QueryTypes.SELECT }),
      sequelize.query(consumoSQL, { type: Sequelize.QueryTypes.SELECT }),
      sequelize.query(maxConsumoSQL, { type: Sequelize.QueryTypes.SELECT }),
      sequelize.query(ultimaFacturaSQL, { type: Sequelize.QueryTypes.SELECT }),
      // Extra (Aqua Premium NE) ingresado manualmente desde el modal externo
      CottsaExtraMes.findOne({ where: { anio: anioNum, mes: mesNum }, raw: true }),
      // Huérfanos (reembolsos POS sin facturar en Odoo) — para que el total
      // de productos vendidos cuadre con el del dashboard.
      obtenerResumenReembolsosCOTTSA(anioNum, mesNum)
        .then(r => ({ total: r.huerfanosTotal || 0, cantidad: r.huerfanosCantidad || 0 }))
        .catch(() => ({ total: 0, cantidad: 0 })),
    ]);

    const extra = extraData
      ? {
          unidades: Number(extraData.unidades) || 0,
          dolares: Number(extraData.dolares) || 0,
          facturas: Number(extraData.facturas) || 0,
        }
      : { unidades: 0, dolares: 0, facturas: 0 };

    const mapConsumo = new Map(consumoData.map(r => [r.customer_code, r]));
    const mapMaxConsumo = new Map(maxConsumoData.map(r => [r.customer_code, r]));
    const mapUltimaFact = new Map(ultimasFacturas.map(r => [r.customer_code, r.ultima_factura]));

    const fmtFecha = (f) => {
      if (!f) return null;
      const d = new Date(f);
      if (isNaN(d.getTime())) return null;
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    };

    const nombreMes = (fecha) => {
      if (!fecha) return null;
      const meses = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
      return meses[new Date(fecha).getMonth()];
    };

    const resultado = clientes.map(c => {
      const consumo = mapConsumo.get(c.customer_code) || {};
      const maxC = mapMaxConsumo.get(c.customer_code) || {};
      const ultFact = mapUltimaFact.get(c.customer_code) || null;

      const consumoActual = Number(consumo.consumo_actual) || 0;
      const consumoAnterior = Number(consumo.consumo_anterior) || 0;
      const varAbs = consumoActual - consumoAnterior;
      const varPorc = consumoAnterior > 0
        ? (varAbs / consumoAnterior) * 100
        : consumoActual > 0 ? 100 : 0;

      return {
        codigo_cliente: c.customer_code,
        nombre_cliente: c.nombre_cliente,
        direccion_entrega: c.direccion_cliente,
        tipo_negocio: c.tipo_negocio || 'SIN CLASIFICAR',
        telefono_cliente: c.telefono_cliente || '—',
        latitud_cliente: c.latitud_direccion_cliente || '—',
        longitud_cliente: c.longitud_direccion_cliente || '—',
        cantidad_productos: Number(consumo.cantidad_actual) || 0,
        consumo_actual: Number(consumoActual.toFixed(2)),
        max_consumo: Number(maxC.consumo_mes || 0).toFixed(2),
        mes_max_consumo_nombre: nombreMes(maxC.mes),
        ultima_factura: fmtFecha(ultFact),
        ultima_visita: fmtFecha(ultFact),
        vsMesAnterior: {
          monto_anterior: consumoAnterior.toFixed(2),
          variacion_abs: varAbs.toFixed(2),
          variacion_porc: `${varPorc.toFixed(2)}%`,
        },
        tuvo_consumo: consumoActual > 0 ? 'Sí' : 'No',
      };
    });

    const conConsumo = resultado.filter(r => r.tuvo_consumo === 'Sí').length;

    const productosVendidos = await sequelize.query(`
  SELECT 
    dd.descripcion AS producto,

    SUM(
      CASE 
        WHEN f.tipo_documento = '(01) Invoice' THEN dd.cantidad
        WHEN f.tipo_documento = '(04) Credit Note' THEN -dd.cantidad
        ELSE 0
      END
    ) AS unidades_vendidas,

    SUM(
      CASE 
        WHEN f.tipo_documento = '(01) Invoice' THEN dd.total
        WHEN f.tipo_documento = '(04) Credit Note' THEN -dd.total
        ELSE 0
      END
    ) AS monto_usd

  FROM facturas f
  JOIN detalle_documento dd
    ON dd.documento_code = f.code

  WHERE f.company_id = ${COTTSA_COMPANY_ID}
    AND ${COTTSA_TODOS_FILTER}
    AND f.status IN (2,4,5)
    AND f.tipo_documento IN ('(01) Invoice','(04) Credit Note')
    AND f.fecha_entrega >= '${inicio}'
    AND f.fecha_entrega <  '${fin}'

  GROUP BY dd.descripcion
  ORDER BY unidades_vendidas DESC
`, { type: Sequelize.QueryTypes.SELECT });

    return res.json({
      clientes: resultado,
      resumen: {
        totalClientes: resultado.length,
        clientesConConsumo: conConsumo,
        clientesSinConsumo: resultado.length - conConsumo,
      },
      productosVendidos: dedupeProductosVendidos(productosVendidos),
      extra,
      huerfanos: huerfanosResumen,
    });

  } catch (error) {
    console.error('❌ ERROR CLIENTES COTTSA:', error);
    return res.status(500).json({ message: 'Error al obtener clientes COTTSA' });
  }
};

// ================================================================
// ENDPOINT DIAGNÓSTICO — comparar header total vs detalle total
// GET /api/COTTSA/diagnostico?anio=YYYY&mes=MM
// ================================================================
const diagnosticoCOTTSA = async (req, res) => {
  try {
    const { anio, mes } = req.query;
    const anioNum = parseInt(anio, 10);
    const mesNum = parseInt(mes, 10);

    const inicio = getFechaInicioMes(anioNum, mesNum);
    const fin = getFechaFinMes(anioNum, mesNum);

    const [porStatus, headerVsDetalle, porCompany] = await Promise.all([

      // ① Facturas por status (COTTSA)
      sequelize.query(`
        SELECT status,
               COUNT(*) AS cant,
               SUM(total) AS total_header
        FROM facturas
        WHERE company_id = ${COTTSA_COMPANY_ID}
          AND fecha_entrega >= '${inicio}'
          AND fecha_entrega < '${fin}'
        GROUP BY status
        ORDER BY status
      `, { type: Sequelize.QueryTypes.SELECT }),

      // ② Header vs Detalle (consistencia real)
      sequelize.query(`
        SELECT
          COUNT(DISTINCT f.code) AS facturas_con_detalle,
          SUM(f.total)           AS total_header,
          SUM(dd.total)          AS total_detalle,
          SUM(dd.cantidad)       AS unidades_detalle
        FROM facturas f
        JOIN detalle_documento dd 
          ON dd.documento_code = f.code
        WHERE f.company_id = ${COTTSA_COMPANY_ID}
          AND f.status IN (2,4,5)
          AND f.fecha_entrega >= '${inicio}'
          AND f.fecha_entrega < '${fin}'
      `, { type: Sequelize.QueryTypes.SELECT }),

      // ③ Distribución por empresa y estado (CORREGIDO)
      sequelize.query(`
        SELECT 
          company_id,
          status,
          COUNT(*) AS cant,
          SUM(total) AS total_header
        FROM facturas
        WHERE company_id = ${COTTSA_COMPANY_ID}
          AND fecha_entrega >= '${inicio}'
          AND fecha_entrega < '${fin}'
          AND status IN (2,4,5)
        GROUP BY company_id, status
        ORDER BY company_id, status
      `, { type: Sequelize.QueryTypes.SELECT }),

    ]);

    return res.json({
      periodo: `${anioNum}-${String(mesNum).padStart(2, '0')}`,
      porStatus,
      headerVsDetalle,
      porCompany
    });

  } catch (error) {
    console.error('❌ ERROR DIAGNÓSTICO COTTSA:', error);
    return res.status(500).json({ message: 'Error diagnóstico' });
  }
};

// ================================================================
// COTTSA — Datos externos (manualmente ingresados desde otro sistema)
// GET  /api/COTTSA/extra?anio=YYYY&mes=MM   → devuelve el registro (o 0s)
// PUT  /api/COTTSA/extra                    → upsert (anio, mes, unidades, dolares, facturas)
// ================================================================
const obtenerCottsaExtra = async (req, res) => {
  try {
    const anio = parseInt(req.query.anio, 10);
    const mes = parseInt(req.query.mes, 10);
    if (isNaN(anio) || isNaN(mes) || mes < 1 || mes > 12)
      return res.status(400).json({ error: 'Parámetros inválidos' });

    const reg = await CottsaExtraMes.findOne({ where: { anio, mes }, raw: true });
    return res.json({
      anio,
      mes,
      unidades: reg ? Number(reg.unidades) : 0,
      dolares: reg ? Number(reg.dolares) : 0,
      facturas: reg ? Number(reg.facturas) : 0,
      actualizado_por: reg ? reg.actualizado_por : null,
      updated_at: reg ? reg.updated_at : null,
    });
  } catch (err) {
    console.error('❌ obtenerCottsaExtra:', err);
    return res.status(500).json({ error: 'Error al obtener datos externos COTTSA' });
  }
};

const guardarCottsaExtra = async (req, res) => {
  try {
    const anio = parseInt(req.body.anio, 10);
    const mes = parseInt(req.body.mes, 10);
    const unidades = Number(req.body.unidades) || 0;
    const dolares = Number(req.body.dolares) || 0;
    const facturas = parseInt(req.body.facturas, 10) || 0;
    const actualizado_por = (req.user?.username || req.user?.email || null);

    if (isNaN(anio) || isNaN(mes) || mes < 1 || mes > 12)
      return res.status(400).json({ error: 'Parámetros inválidos' });
    if (unidades < 0 || dolares < 0 || facturas < 0)
      return res.status(400).json({ error: 'Los valores no pueden ser negativos' });

    const [reg, creado] = await CottsaExtraMes.findOrCreate({
      where: { anio, mes },
      defaults: { anio, mes, unidades, dolares, facturas, actualizado_por },
    });

    if (!creado) {
      reg.unidades = unidades;
      reg.dolares = dolares;
      reg.facturas = facturas;
      reg.actualizado_por = actualizado_por;
      await reg.save();
    }

    return res.json({
      anio,
      mes,
      unidades: Number(reg.unidades),
      dolares: Number(reg.dolares),
      facturas: Number(reg.facturas),
      actualizado_por: reg.actualizado_por,
      updated_at: reg.updated_at,
    });
  } catch (err) {
    console.error('❌ guardarCottsaExtra:', err);
    return res.status(500).json({ error: 'Error al guardar datos externos COTTSA' });
  }
};

// ================================================================
// ENDPOINT REEMBOLSOS HUÉRFANOS (POS sin facturar en Odoo)
// GET /api/COTTSA/reembolsos-huerfanos?anio=YYYY&mes=MM
//
// Lee de pos_orders local los pos.order de COTTSA con monto negativo
// (reembolsos) que quedaron sin account_move. El frontend usa esto
// para mostrar un banner de alerta en la tabla.
// ================================================================
const obtenerReembolsosHuerfanos = async (req, res) => {
  try {
    const { anio, mes } = req.query;

    if (!anio || !mes) {
      return res.status(400).json({ error: 'Debe enviar anio y mes' });
    }

    const anioNum = parseInt(anio, 10);
    const mesNum = parseInt(mes, 10);

    if (isNaN(anioNum) || isNaN(mesNum) || mesNum < 1 || mesNum > 12) {
      return res.status(400).json({ error: 'Parámetros inválidos' });
    }

    const { inicio, fin } = getRangoMesUTC(anioNum, mesNum);

    // Lee de pos_orders local — pos.order amount_total<0 sin account_move.
    const huerfanos = await sequelize.query(`
      SELECT odoo_id     AS id,
             name,
             pos_reference,
             state,
             amount_total,
             partner_id,
             partner_name,
             date_order
      FROM pos_orders
      WHERE company_id   = :companyId
        AND amount_total < 0
        AND account_move_id IS NULL
        AND date_order  >= :inicio
        AND date_order  <  :fin
      ORDER BY date_order DESC
    `, {
      replacements: { companyId: COTTSA_COMPANY_ID, inicio, fin },
      type: Sequelize.QueryTypes.SELECT,
    });

    const total = huerfanos.reduce(
      (sum, o) => sum + Math.abs(Number(o.amount_total) || 0),
      0
    );

    const reembolsos = huerfanos.map(o => {
      const rutaMatch = String(o.name || '').match(/RUTA\s*\d+(\.\d+)?/i);
      return {
        id: o.id,
        name: o.name,
        pos_reference: o.pos_reference,
        cliente: o.partner_name || '—',
        monto: Number((Math.abs(Number(o.amount_total) || 0)).toFixed(2)),
        fecha: o.date_order,
        ruta: rutaMatch ? rutaMatch[0].toUpperCase().replace(/\s+/g, ' ') : '—',
        estado: o.state,
      };
    });

    return res.json({
      cantidad: reembolsos.length,
      total: Number(total.toFixed(2)),
      reembolsos,
    });
  } catch (err) {
    console.error('❌ obtenerReembolsosHuerfanos (BD):', err);
    return res.status(500).json({
      error: 'Error al consultar reembolsos huérfanos',
      detalle: err?.message || String(err),
    });
  }
};

// ================================================================
// ENDPOINT POS DETALLE — todo lo que cae bajo "Kenny Navas"
// GET /api/COTTSA/pos-detalle?anio=YYYY&mes=MM
//
// Lee de pos_orders local TODOS los pos.order de COTTSA del período
// (Facts, NotCr, facturados y huérfanos) para mostrar en un modal
// el detalle completo del bloque POS - Kenny Navas.
// ================================================================
const obtenerPOSDetalleCOTTSA = async (req, res) => {
  try {
    const { anio, mes } = req.query;

    if (!anio || !mes) {
      return res.status(400).json({ error: 'Debe enviar anio y mes' });
    }

    const anioNum = parseInt(anio, 10);
    const mesNum = parseInt(mes, 10);

    if (isNaN(anioNum) || isNaN(mesNum) || mesNum < 1 || mesNum > 12) {
      return res.status(400).json({ error: 'Parámetros inválidos' });
    }

    const { inicio, fin } = getRangoMesUTC(anioNum, mesNum);

    // Estrategia (lectura BD):
    //  1) Traemos TODAS las pos.order de COTTSA con date_order en el mes
    //     desde pos_orders local. (Filtra por la fecha REAL del POS, así
    //     capturamos reembolsos facturados tarde con fecha distinta.)
    //  2) Cargamos los odoo_ids de los docs en BD que cuentan en Kenny Navas
    //     (POS Facts del bucket POS + TODAS las NotCr COTTSA), con rango
    //     amplio para no perder facturas con fecha_entrega corrida.
    //  3) Filtramos las pos.order a sólo las que pertenecen a Kenny Navas:
    //     - account_move_id IN (ids BD)              → reembolsos y ventas POS
    //     - account_move_id IS NULL AND monto < 0    → huérfanos (sin facturar)
    const allPosOrders = await sequelize.query(`
      SELECT odoo_id           AS id,
             name,
             pos_reference,
             date_order,
             amount_total,
             partner_id,
             partner_name,
             account_move_id,
             account_move_name,
             session_id,
             session_name,
             state
      FROM pos_orders
      WHERE company_id  = :companyId
        AND date_order >= :inicio
        AND date_order <  :fin
        AND state IN ('paid', 'invoiced', 'done')
      ORDER BY date_order DESC
    `, {
      replacements: { companyId: COTTSA_COMPANY_ID, inicio, fin },
      type: Sequelize.QueryTypes.SELECT,
    });

    // Cargar odoo_ids de docs Kenny Navas en BD (rango anual amplio para
    // capturar NotCr con fecha_entrega desfasada, ej. facturadas tarde).
    const inicioAnio = `${anioNum}-01-01 00:00:00`;
    const finAnio = `${anioNum + 1}-01-01 00:00:00`;
    const dbDocs = await sequelize.query(`
      SELECT f.odoo_id
      FROM facturas f
      WHERE f.company_id = ${COTTSA_COMPANY_ID}
        AND f.fecha_entrega >= '${inicioAnio}'
        AND f.fecha_entrega < '${finAnio}'
        AND f.status IN (2,4,5)
        AND (
          (f.tipo_documento = '(01) Invoice' AND ${COTTSA_POS_FILTER})
          OR f.tipo_documento = '(04) Credit Note'
        )
    `, { type: Sequelize.QueryTypes.SELECT });
    const kennyOdooIds = new Set(
      dbDocs.map(d => Number(d.odoo_id)).filter(n => Number.isFinite(n))
    );

    const posOrders = allPosOrders.filter(o => {
      const monto = Number(o.amount_total) || 0;
      const accMoveId = o.account_move_id != null ? Number(o.account_move_id) : null;

      // Reembolsos (negativos): siempre incluir. Cubre tanto los huérfanos
      // (sin account_move) como los facturados (con o sin odoo_id en BD).
      // Esto es importante porque las NotCr facturadas tarde pueden tener
      // odoo_id=null en BD si se sincronizaron antes del fix de odoo_id.
      if (monto < 0) return true;

      // Ventas (positivas): solo si su account_move está en bucket POS de BD.
      // Así evitamos traer ventas POS de OTROS cajeros (no Kenny Navas).
      return accMoveId && kennyOdooIds.has(accMoveId);
    });

    let totalFacts = 0;
    let totalNotCr = 0;
    let totalHuerfanos = 0;
    let cantFacturados = 0;
    let cantHuerfanos = 0;

    const items = posOrders.map(o => {
      const monto = Number(o.amount_total) || 0;
      const docName = o.account_move_name || null;
      const docId = o.account_move_id != null ? Number(o.account_move_id) : null;
      const cliente = o.partner_name || '—';
      const facturado = Boolean(docId);
      const sesion = o.session_name || null;

      // Identificar el tipo: si monto < 0 es reembolso (NotCr esperada),
      // si >= 0 es venta (Fact esperada)
      let tipo;
      if (monto < 0) {
        if (facturado) {
          totalNotCr += Math.abs(monto);
          cantFacturados++;
          tipo = 'NotCr';
        } else {
          totalHuerfanos += Math.abs(monto);
          cantHuerfanos++;
          tipo = 'NotCr (huérfano)';
        }
      } else {
        totalFacts += monto;
        if (facturado) cantFacturados++;
        tipo = 'Fact';
      }

      // Extraer ruta del nombre del POS (ej. "RUTA 131/7340 REEMBOLSO" → "RUTA 131")
      const rutaMatch = String(o.name || '').match(/RUTA\s*\d+(\.\d+)?/i);
      const ruta = rutaMatch ? rutaMatch[0].toUpperCase().replace(/\s+/g, ' ') : '—';

      return {
        id: o.id,
        caja: o.name,                    // "RUTA 131/7340 REEMBOLSO"
        pos_reference: o.pos_reference,  // "POS/32960"
        sesion,                           // "POS/32960" (también del session_id)
        ruta,                             // "RUTA 131"
        date_order: o.date_order,
        cliente,
        monto: Number(monto.toFixed(2)),
        documento: docName,               // "NotCr 001-027-000000930" o null
        tipo,                             // 'Fact' | 'NotCr' | 'NotCr (huérfano)'
        facturado,
        es_reembolso: monto < 0,
      };
    });

    const neto = totalFacts - totalNotCr - totalHuerfanos;

    return res.json({
      items,
      totales: {
        facts: Number(totalFacts.toFixed(2)),
        notcr: Number(totalNotCr.toFixed(2)),
        huerfanos: Number(totalHuerfanos.toFixed(2)),
        neto: Number(neto.toFixed(2)),
        cantidad_total: items.length,
        cantidad_facturados: cantFacturados,
        cantidad_huerfanos: cantHuerfanos,
      },
    });
  } catch (err) {
    console.error('❌ obtenerPOSDetalleCOTTSA:', err);
    return res.status(500).json({
      error: 'Error al consultar detalle POS',
      detalle: err?.message || String(err),
    });
  }
};

// ================================================================
// ENDPOINT DETALLE POR RUTA — lista los pos.order de una ruta específica
// (RUTA 113, RUTA 131, RUTA 132). Sirve para comparar contra el reporte
// "Análisis del TPV" de Odoo y detectar pedidos cruzados/faltantes.
// GET /api/COTTSA/ruta-pos-detalle?anio=YYYY&mes=MM&ruta=RUTA%20113
// ================================================================
const obtenerRutaPOSDetalleCOTTSA = async (req, res) => {
  try {
    const { anio, mes, ruta } = req.query;
    const anioNum = parseInt(anio, 10);
    const mesNum = parseInt(mes, 10);
    const rutaUp = String(ruta || '').toUpperCase().replace(/\s+/g, ' ').trim();

    if (isNaN(anioNum) || isNaN(mesNum) || mesNum < 1 || mesNum > 12 || !/^RUTA\s*\d+/.test(rutaUp)) {
      return res.status(400).json({ error: 'Parámetros inválidos (anio, mes, ruta)' });
    }

    const { inicio, fin } = getRangoMesUTC(anioNum, mesNum);

    // Lee de pos_orders local. Filtra ruta usando user_name (igual que original
    // que extraía RUTA xxx del user_id[1]). Mismo filtro de state que dashboard.
    const orders = await sequelize.query(`
      SELECT odoo_id           AS id,
             name,
             pos_reference,
             date_order,
             amount_total,
             partner_id,
             partner_name,
             user_id,
             user_name,
             session_id,
             session_name,
             config_id,
             config_name,
             account_move_id,
             account_move_name,
             state
      FROM pos_orders
      WHERE company_id  = :companyId
        AND date_order >= :inicio
        AND date_order <  :fin
        AND state IN ('paid', 'invoiced')
      ORDER BY date_order ASC
    `, {
      replacements: { companyId: COTTSA_COMPANY_ID, inicio, fin },
      type: Sequelize.QueryTypes.SELECT,
    });

    // Filtrar a la ruta solicitada por user_name (mismo criterio que el dashboard).
    const filtrados = orders.filter(o => {
      const m = String(o.user_name || '').match(/RUTA\s*\d+/i);
      const r = m ? m[0].toUpperCase().replace(/\s+/g, ' ') : null;
      return r === rutaUp;
    });

    const items = filtrados.map(o => {
      const monto = Number(o.amount_total) || 0;
      return {
        id: o.id,
        caja: o.name,
        pos_reference: o.pos_reference,
        sesion: o.session_name || null,
        cajero: o.user_name || null,
        config: o.config_name || null,
        date_order: o.date_order,
        cliente: o.partner_name || '—',
        monto: Number(monto.toFixed(2)),
        documento: o.account_move_name || null,
        state: o.state,
        facturado: o.account_move_id != null,
      };
    });

    const total = items.reduce((a, it) => a + (it.monto || 0), 0);

    return res.json({
      ruta: rutaUp,
      items,
      totales: {
        cantidad: items.length,
        total: Number(total.toFixed(2)),
      },
    });
  } catch (err) {
    console.error('❌ obtenerRutaPOSDetalleCOTTSA (BD):', err);
    return res.status(500).json({
      error: 'Error al consultar detalle por ruta',
      detalle: err?.message || String(err),
    });
  }
};

// ================================================================
// ENDPOINT DIAGNÓSTICO POS — para identificar por qué el dashboard
// no cuadra al 100% con el reporte "Análisis del TPV" de Odoo.
// Lista cada pos.order con todos los campos potenciales de agrupación
// para comparar manualmente contra el reporte.
// GET /api/COTTSA/diagnostico-pos?anio=YYYY&mes=MM
// ================================================================
const diagnosticoPOSCOTTSA = async (req, res) => {
  try {
    const anioNum = parseInt(req.query.anio, 10);
    const mesNum = parseInt(req.query.mes, 10);
    if (isNaN(anioNum) || isNaN(mesNum) || mesNum < 1 || mesNum > 12) {
      return res.status(400).json({ error: 'Parámetros inválidos' });
    }

    const { inicio, fin } = getRangoMesUTC(anioNum, mesNum);

    const orders = await sequelize.query(`
      SELECT odoo_id           AS id,
             name,
             date_order,
             amount_total,
             partner_id,
             partner_name,
             user_id,
             user_name,
             session_id,
             session_name,
             config_id,
             config_name,
             pos_reference,
             state,
             account_move_id,
             account_move_name
      FROM pos_orders
      WHERE company_id  = :companyId
        AND date_order >= :inicio
        AND date_order <  :fin
        AND state IN ('paid', 'invoiced', 'done')
      ORDER BY date_order ASC
    `, {
      replacements: { companyId: COTTSA_COMPANY_ID, inicio, fin },
      type: Sequelize.QueryTypes.SELECT,
    });

    const extraerRutaDe = (s) => {
      const m = String(s || '').match(/RUTA\s*\d+/i);
      return m ? m[0].toUpperCase().replace(/\s+/g, ' ') : null;
    };

    // Agrupación de prueba por cada candidato de campo.
    const buildBreakdown = (lista, extractor) => {
      const groups = {};
      for (const o of lista) {
        const key = extractor(o) || '<KENNY/SIN RUTA>';
        if (!groups[key]) groups[key] = { cant: 0, dolares: 0 };
        groups[key].cant += 1;
        groups[key].dolares += Number(o.amount_total) || 0;
      }
      return Object.entries(groups)
        .map(([k, v]) => ({ grupo: k, cant: v.cant, dolares: Number(v.dolares.toFixed(2)) }))
        .sort((a, b) => b.dolares - a.dolares);
    };

    const breakdowns = {
      por_session_id: buildBreakdown(orders, o => extraerRutaDe(o.session_name)),
      por_user_id:    buildBreakdown(orders, o => extraerRutaDe(o.user_name)),
      por_config_id:  buildBreakdown(orders, o => extraerRutaDe(o.config_name)),
      por_pos_name:   buildBreakdown(orders, o => extraerRutaDe(o.name)),
    };

    // Solo facturados: para validar la sospecha de "incluyendo no facturados".
    // Si Odoo solo cuenta los facturados, este desglose debería cuadrar.
    const soloFacturados = orders.filter(o =>
      o.state === 'invoiced' || o.account_move_id != null
    );
    const breakdownsFacturadas = {
      total: {
        cant: soloFacturados.length,
        dolares: Number(soloFacturados.reduce((a, o) => a + (Number(o.amount_total) || 0), 0).toFixed(2)),
      },
      por_session_id: buildBreakdown(soloFacturados, o => extraerRutaDe(o.session_name)),
    };

    // Distribución por estado (state) para detectar pedidos no facturados.
    const porState = {};
    for (const o of orders) {
      const k = o.state || '<null>';
      if (!porState[k]) porState[k] = { cant: 0, dolares: 0 };
      porState[k].cant += 1;
      porState[k].dolares += Number(o.amount_total) || 0;
    }

    return res.json({
      periodo: `${anioNum}-${String(mesNum).padStart(2, '0')}`,
      total_pedidos: orders.length,
      total_dolares: Number(orders.reduce((a, o) => a + (Number(o.amount_total) || 0), 0).toFixed(2)),
      por_state: Object.entries(porState).map(([k, v]) => ({
        state: k, cant: v.cant, dolares: Number(v.dolares.toFixed(2))
      })),
      breakdowns,
      solo_facturados: breakdownsFacturadas,
      muestra: orders.slice(0, 5).map(o => ({
        id: o.id,
        name: o.name,
        state: o.state,
        amount_total: o.amount_total,
        session_id: o.session_id ? [o.session_id, o.session_name] : false,
        user_id:    o.user_id    ? [o.user_id,    o.user_name]    : false,
        config_id:  o.config_id  ? [o.config_id,  o.config_name]  : false,
        partner_id: o.partner_id ? [o.partner_id, o.partner_name] : false,
        account_move: o.account_move_id ? [o.account_move_id, o.account_move_name] : false,
      })),
    });
  } catch (err) {
    console.error('❌ diagnosticoPOSCOTTSA (BD):', err);
    return res.status(500).json({ error: err?.message || String(err) });
  }
};

module.exports = {
  obtenerDashboardCOTTSA,
  obtenerDetalleRutaCOTTSA,
  obtenerClientesCOTTSA,
  diagnosticoCOTTSA,
  diagnosticoPOSCOTTSA,
  obtenerCottsaExtra,
  guardarCottsaExtra,
  obtenerReembolsosHuerfanos,
  obtenerPOSDetalleCOTTSA,
  obtenerRutaPOSDetalleCOTTSA,
  // Helpers reutilizados por el consolidado para que el card COTTSA cuadre
  // con el total mostrado en el dashboard descartable.
  obtenerVentasCOTTSAPorRuta,
  obtenerVentasPOSCOTTSA,
  obtenerResumenReembolsosCOTTSA,
  obtenerDatosCOTTSADesdeOdoo,
};