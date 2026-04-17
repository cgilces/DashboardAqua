// controllers/controllerPreventa/detalleCanalController.js
// Portal de clientes por CANAL (VIP, DOMICILIO, EMPRESAS)
// El cliente pertenece al canal, no a una ruta específica.

const db        = require("../../db");
const Sequelize = require("sequelize");
const { QueryTypes } = require("sequelize");

// ================================================================
// RUTAS ODOO QUE FORMAN EL CANAL EMPRESAS
// ================================================================
const RUTAS_EMPRESAS = [
  "Carmen Garcia", "Estefania Flores", "Tamara Villacres",
  "RUTA E1", "RUTA E2", "RUTA E3", "RUTA E4", "RUTA E5",
  "RUTA E6", "RUTA E7", "RUTA E8", "RUTA E9", "RUTA E10",
  "RUTA EA1", "RUTA U2", "Distribucion OK/E",
];

// ================================================================
// HELPERS DE FECHA
// ================================================================
function getFechaInicioMes(anio, mes) {
  const d = new Date(Date.UTC(anio, mes - 1, 1));
  return d.toISOString().replace("T", " ").substring(0, 19);
}

function getFechaFinMes(anio, mes) {
  const d = new Date(Date.UTC(anio, mes, 1));
  return d.toISOString().replace("T", " ").substring(0, 19);
}

function getMesAnterior(anio, mes) {
  let a = anio, m = mes - 1;
  if (m === 0) { m = 12; a--; }
  return { anio: a, mes: m };
}

function formatFecha(fecha) {
  if (!fecha) return null;
  const d = new Date(fecha);
  if (isNaN(d.getTime())) return null;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// ================================================================
// CANALES ODOO: equipo_ventas → URL slug
// ================================================================
const ODOO_CANAL_MAP = {
  "moderno":        "Moderno",
  "distribuidores": "Distribuidores",
  "quito":          "Quito",
  "empresas-odoo":  "Empresas",
  "domicilio-odoo": "Domicilio",
};

// ================================================================
// LÓGICA POR CANAL
// ================================================================
// VIP       → facturas WHERE seller_code ILIKE 'V%'
// DOMICILIO → facturas WHERE seller_code ILIKE 'A%'
// MAYORISTA → facturas/ordenes WHERE seller_code ILIKE 'M%'
// EMPRESAS  → ordenes WHERE type=2 AND seller_nombre IN (...)
// ODOO      → ordenes WHERE origen_sistema='ODOO' AND equipo_ventas=X
function getFiltroCanal(canal) {
  const c   = canal.toLowerCase();
  const cup = canal.toUpperCase();

  if (cup === "VIP")       return { usaCombinado: true, filtroMobil: "f.seller_code ILIKE 'V%'", equipoOdoo: "Moderno" };
  if (cup === "DOMICILIO") return { usaCombinado: true, filtroMobil: "f.seller_code ILIKE 'A%'", equipoOdoo: "Domicilio" };
  if (cup === "MAYORISTA") return { tabla: "facturas", filtro: "f.seller_code ILIKE 'M%'", usaOrdenes: false, usaOdoo: false };
  if (cup === "EMPRESAS")  return { tabla: "ordenes",  filtro: null, usaOrdenes: true,  usaOdoo: false };

  // Canales ODOO (por equipo_ventas)
  const equipoVentas = ODOO_CANAL_MAP[c];
  if (equipoVentas)        return { usaOrdenes: false, usaOdoo: true, equipoVentas };

  return null;
}

// ================================================================
// ENDPOINT PRINCIPAL
// GET /api/ventas/detalle-canal/:canal/:anio/:mes
// ================================================================
const obtenerClientesCanal = async (req, res) => {
  try {
    const { canal, anio, mes } = req.params;
    if (!canal || !anio || !mes)
      return res.status(400).json({ error: "Debe enviar /canal/anio/mes" });

    const anioNum = parseInt(anio, 10);
    const mesNum  = parseInt(mes,  10);
    if (isNaN(anioNum) || isNaN(mesNum) || mesNum < 1 || mesNum > 12)
      return res.status(400).json({ error: "Parámetros inválidos" });

    const config = getFiltroCanal(canal);
    if (!config)
      return res.status(400).json({ error: "Canal no válido. Use VIP, DOMICILIO o EMPRESAS" });

    const inicio    = getFechaInicioMes(anioNum, mesNum);
    const fin       = getFechaFinMes(anioNum, mesNum);
    const antPer    = getMesAnterior(anioNum, mesNum);
    const antInicio = getFechaInicioMes(antPer.anio, antPer.mes);
    const antFin    = getFechaFinMes(antPer.anio, antPer.mes);

    let clientes = [];

    if (config.usaCombinado) {
      // ── DOMICILIO combinado: Mobilvendor (A%) + ODOO Domicilio ───────────
      const filtro      = config.filtroMobil;
      const equipoVentas = config.equipoOdoo.replace(/'/g, "''");

      const sqlMobil = `
        WITH direcciones_activas AS (
          SELECT DISTINCT f.customer_code, f.customer_address_code
          FROM facturas f
          WHERE ${filtro}
            AND f.status IN ('0','2','4','5')
            AND f.fecha_entrega >= '${antInicio}'
            AND f.customer_address_code IS NOT NULL
        ),
        consumo_actual AS (
          SELECT f.customer_code, f.customer_address_code,
            SUM(dd.cantidad) AS unidades, SUM(dd.total) AS monto
          FROM facturas f
          JOIN detalle_documento dd ON dd.documento_code = f.code
          WHERE ${filtro}
            AND dd.codigo_categoria = '7'
            AND f.status IN ('0','2','4','5')
            AND f.fecha_entrega >= '${inicio}' AND f.fecha_entrega < '${fin}'
          GROUP BY f.customer_code, f.customer_address_code
        ),
        consumo_anterior AS (
          SELECT f.customer_code, f.customer_address_code, SUM(dd.total) AS monto
          FROM facturas f
          JOIN detalle_documento dd ON dd.documento_code = f.code
          WHERE ${filtro}
            AND dd.codigo_categoria = '7'
            AND f.status IN ('0','2','4','5')
            AND f.fecha_entrega >= '${antInicio}' AND f.fecha_entrega < '${antFin}'
          GROUP BY f.customer_code, f.customer_address_code
        ),
        ultima_compra AS (
          SELECT f.customer_code, f.customer_address_code, MAX(f.fecha_entrega) AS ultima
          FROM facturas f
          WHERE ${filtro} AND f.status IN ('0','2','4','5')
          GROUP BY f.customer_code, f.customer_address_code
        )
        SELECT
          da.customer_code, da.customer_address_code,
          dc.descripcion_direccion_cliente   AS descripcion_direccion,
          c.nombre_cliente,
          tn.descripcion                    AS tipo_negocio,
          dc.calle1_direccion_cliente        AS direccion_entrega,
          dc.telefono_direccion_cliente      AS telefono,
          dc.latitud_direccion_cliente       AS latitud,
          dc.longitud_direccion_cliente      AS longitud,
          COALESCE(ca.monto,    0)           AS consumo_actual,
          COALESCE(ca.unidades, 0)           AS unidades_actual,
          COALESCE(cp.monto,    0)           AS consumo_anterior,
          uc.ultima                          AS ultima_compra,
          'mobilvendor'                      AS fuente
        FROM direcciones_activas da
        LEFT JOIN clientes c              ON c.codigo_cliente           = da.customer_code
        LEFT JOIN tipos_negocio tn        ON tn.codigo                  = c.codigo_tipo_negocio
        LEFT JOIN direcciones_clientes dc ON dc.codigo_direccion_cliente = da.customer_address_code
                                          AND dc.codigo_cliente = da.customer_code
        LEFT JOIN consumo_actual   ca     ON ca.customer_code = da.customer_code AND ca.customer_address_code = da.customer_address_code
        LEFT JOIN consumo_anterior cp     ON cp.customer_code = da.customer_code AND cp.customer_address_code = da.customer_address_code
        LEFT JOIN ultima_compra    uc     ON uc.customer_code = da.customer_code AND uc.customer_address_code = da.customer_address_code
        ORDER BY consumo_actual DESC;
      `;

      const sqlOdoo = `
        WITH clientes_canal AS (
          SELECT DISTINCT o.customer_code, o.customer_address_code
          FROM ordenes o
          WHERE o.origen_sistema = 'ODOO'
            AND o.equipo_ventas  = '${equipoVentas}'
            AND o.type = 2 AND o.status IN (2, 4, 5)
            AND o.fecha_creacion >= '${antInicio}'
        ),
        consumo_actual AS (
          SELECT o.customer_code,
            SUM(dd.cantidad) AS unidades, SUM(dd.total) AS monto
          FROM ordenes o
          JOIN detalle_documento dd ON dd.documento_code = o.code
          WHERE o.origen_sistema = 'ODOO'
            AND o.equipo_ventas  = '${equipoVentas}'
            AND o.type = 2 AND o.status IN (2, 4, 5)
            AND dd.codigo_categoria = '7'
            AND o.fecha_creacion >= '${inicio}' AND o.fecha_creacion < '${fin}'
          GROUP BY o.customer_code
        ),
        consumo_anterior AS (
          SELECT o.customer_code, SUM(dd.total) AS monto
          FROM ordenes o
          JOIN detalle_documento dd ON dd.documento_code = o.code
          WHERE o.origen_sistema = 'ODOO'
            AND o.equipo_ventas  = '${equipoVentas}'
            AND o.type = 2 AND o.status IN (2, 4, 5)
            AND dd.codigo_categoria = '7'
            AND o.fecha_creacion >= '${antInicio}' AND o.fecha_creacion < '${antFin}'
          GROUP BY o.customer_code
        ),
        ultima_compra AS (
          SELECT o.customer_code, MAX(o.fecha_creacion) AS ultima
          FROM ordenes o
          WHERE o.origen_sistema = 'ODOO'
            AND o.equipo_ventas  = '${equipoVentas}'
            AND o.type = 2 AND o.status IN (2, 4, 5)
          GROUP BY o.customer_code
        )
        SELECT
          cc.customer_code, cc.customer_address_code,
          COALESCE(dc.descripcion_direccion_cliente, dc2.descripcion_direccion_cliente) AS descripcion_direccion,
          c.nombre_cliente,
          tn.descripcion                    AS tipo_negocio,
          COALESCE(dc.calle1_direccion_cliente, dc2.calle1_direccion_cliente)   AS direccion_entrega,
          COALESCE(dc.telefono_direccion_cliente, dc2.telefono_direccion_cliente) AS telefono,
          COALESCE(dc.latitud_direccion_cliente, dc2.latitud_direccion_cliente)   AS latitud,
          COALESCE(dc.longitud_direccion_cliente, dc2.longitud_direccion_cliente) AS longitud,
          COALESCE(ca.monto,    0)           AS consumo_actual,
          COALESCE(ca.unidades, 0)           AS unidades_actual,
          COALESCE(cp.monto,    0)           AS consumo_anterior,
          uc.ultima                          AS ultima_compra,
          'odoo'                             AS fuente
        FROM clientes_canal cc
        LEFT JOIN clientes c              ON c.codigo_cliente  = cc.customer_code
        LEFT JOIN tipos_negocio tn        ON tn.codigo         = c.codigo_tipo_negocio
        LEFT JOIN direcciones_clientes dc ON dc.codigo_direccion_cliente = cc.customer_address_code::text
                                          AND dc.codigo_cliente = cc.customer_code
        LEFT JOIN (
          SELECT DISTINCT ON (codigo_cliente)
            codigo_cliente, descripcion_direccion_cliente, calle1_direccion_cliente, telefono_direccion_cliente,
            latitud_direccion_cliente, longitud_direccion_cliente
          FROM direcciones_clientes ORDER BY codigo_cliente
        ) dc2 ON dc2.codigo_cliente = cc.customer_code
        LEFT JOIN consumo_actual   ca     ON ca.customer_code = cc.customer_code
        LEFT JOIN consumo_anterior cp     ON cp.customer_code = cc.customer_code
        LEFT JOIN ultima_compra    uc     ON uc.customer_code = cc.customer_code
        ORDER BY consumo_actual DESC;
      `;

      const [clientesMobil, clientesOdoo] = await Promise.all([
        db.query(sqlMobil, { type: QueryTypes.SELECT }),
        db.query(sqlOdoo,  { type: QueryTypes.SELECT }),
      ]);
      clientes = [...clientesMobil, ...clientesOdoo];

    } else if (config.usaOdoo) {
      // ── Canales ODOO — fuente: ordenes WHERE origen_sistema='ODOO' ─
      const equipoVentas = config.equipoVentas.replace(/'/g, "''");

      const sql = `
        WITH clientes_canal AS (
          SELECT DISTINCT o.customer_code, o.customer_address_code
          FROM ordenes o
          WHERE o.origen_sistema = 'ODOO'
            AND o.equipo_ventas  = '${equipoVentas}'
            AND o.type   = 2
            AND o.status IN (2, 4, 5)
            AND o.fecha_creacion >= '${antInicio}'
        ),
        consumo_actual AS (
          SELECT o.customer_code,
            SUM(dd.cantidad) AS unidades,
            SUM(dd.total)    AS monto
          FROM ordenes o
          JOIN detalle_documento dd ON dd.documento_code = o.code
          WHERE o.origen_sistema = 'ODOO'
            AND o.equipo_ventas  = '${equipoVentas}'
            AND o.type   = 2
            AND o.status IN (2, 4, 5)
            AND dd.codigo_categoria = '7'
            AND o.fecha_creacion >= '${inicio}' AND o.fecha_creacion < '${fin}'
          GROUP BY o.customer_code
        ),
        consumo_anterior AS (
          SELECT o.customer_code,
            SUM(dd.total) AS monto
          FROM ordenes o
          JOIN detalle_documento dd ON dd.documento_code = o.code
          WHERE o.origen_sistema = 'ODOO'
            AND o.equipo_ventas  = '${equipoVentas}'
            AND o.type   = 2
            AND o.status IN (2, 4, 5)
            AND dd.codigo_categoria = '7'
            AND o.fecha_creacion >= '${antInicio}' AND o.fecha_creacion < '${antFin}'
          GROUP BY o.customer_code
        ),
        ultima_compra AS (
          SELECT o.customer_code, MAX(o.fecha_creacion) AS ultima
          FROM ordenes o
          WHERE o.origen_sistema = 'ODOO'
            AND o.equipo_ventas  = '${equipoVentas}'
            AND o.type = 2 AND o.status IN (2, 4, 5)
          GROUP BY o.customer_code
        )
        SELECT
          cc.customer_code,
          cc.customer_address_code,
          COALESCE(dc.descripcion_direccion_cliente, dc2.descripcion_direccion_cliente) AS descripcion_direccion,
          c.nombre_cliente,
          tn.descripcion                    AS tipo_negocio,
          COALESCE(dc.calle1_direccion_cliente, dc2.calle1_direccion_cliente)   AS direccion_entrega,
          COALESCE(dc.telefono_direccion_cliente, dc2.telefono_direccion_cliente) AS telefono,
          COALESCE(dc.latitud_direccion_cliente, dc2.latitud_direccion_cliente)   AS latitud,
          COALESCE(dc.longitud_direccion_cliente, dc2.longitud_direccion_cliente) AS longitud,
          COALESCE(ca.monto,    0)           AS consumo_actual,
          COALESCE(ca.unidades, 0)           AS unidades_actual,
          COALESCE(cp.monto,    0)           AS consumo_anterior,
          uc.ultima                          AS ultima_compra
        FROM clientes_canal cc
        LEFT JOIN clientes c              ON c.codigo_cliente  = cc.customer_code
        LEFT JOIN tipos_negocio tn        ON tn.codigo         = c.codigo_tipo_negocio
        LEFT JOIN direcciones_clientes dc ON dc.codigo_direccion_cliente = cc.customer_address_code::text
                                          AND dc.codigo_cliente = cc.customer_code
        LEFT JOIN (
          SELECT DISTINCT ON (codigo_cliente)
            codigo_cliente, descripcion_direccion_cliente,
            calle1_direccion_cliente, telefono_direccion_cliente,
            latitud_direccion_cliente, longitud_direccion_cliente
          FROM direcciones_clientes
          ORDER BY codigo_cliente
        ) dc2 ON dc2.codigo_cliente = cc.customer_code
        LEFT JOIN consumo_actual   ca     ON ca.customer_code  = cc.customer_code
        LEFT JOIN consumo_anterior cp     ON cp.customer_code  = cc.customer_code
        LEFT JOIN ultima_compra    uc     ON uc.customer_code  = cc.customer_code
        ORDER BY consumo_actual DESC;
      `;

      clientes = await db.query(sql, { type: QueryTypes.SELECT });

    } else if (!config.usaOrdenes) {
      // ── VIP o DOMICILIO — fuente: facturas ────────────────────
      const filtro = config.filtro;

      const sql = `
        WITH direcciones_activas AS (
          -- Una fila por (cliente, dirección) que tuvo actividad desde el mes anterior
          SELECT DISTINCT f.customer_code, f.customer_address_code
          FROM facturas f
          WHERE ${filtro}
            AND f.status IN ('0','2','4','5')
            AND f.fecha_entrega >= '${antInicio}'
            AND f.customer_address_code IS NOT NULL
        ),
        consumo_actual AS (
          SELECT f.customer_code, f.customer_address_code,
            SUM(dd.cantidad) AS unidades,
            SUM(dd.total)    AS monto
          FROM facturas f
          JOIN detalle_documento dd ON dd.documento_code = f.code
          WHERE ${filtro}
            AND dd.codigo_categoria = '7'
            AND f.status IN ('0','2','4','5')
            AND f.fecha_entrega >= '${inicio}' AND f.fecha_entrega < '${fin}'
          GROUP BY f.customer_code, f.customer_address_code
        ),
        consumo_anterior AS (
          SELECT f.customer_code, f.customer_address_code,
            SUM(dd.total) AS monto
          FROM facturas f
          JOIN detalle_documento dd ON dd.documento_code = f.code
          WHERE ${filtro}
            AND dd.codigo_categoria = '7'
            AND f.status IN ('0','2','4','5')
            AND f.fecha_entrega >= '${antInicio}' AND f.fecha_entrega < '${antFin}'
          GROUP BY f.customer_code, f.customer_address_code
        ),
        ultima_compra AS (
          SELECT f.customer_code, f.customer_address_code,
                 MAX(f.fecha_entrega) AS ultima
          FROM facturas f
          WHERE ${filtro} AND f.status IN ('0','2','4','5')
          GROUP BY f.customer_code, f.customer_address_code
        )
        SELECT
          da.customer_code,
          da.customer_address_code,
          dc.descripcion_direccion_cliente   AS descripcion_direccion,
          c.nombre_cliente,
          tn.descripcion                    AS tipo_negocio,
          dc.calle1_direccion_cliente        AS direccion_entrega,
          dc.telefono_direccion_cliente      AS telefono,
          dc.latitud_direccion_cliente       AS latitud,
          dc.longitud_direccion_cliente      AS longitud,
          COALESCE(ca.monto,    0)           AS consumo_actual,
          COALESCE(ca.unidades, 0)           AS unidades_actual,
          COALESCE(cp.monto,    0)           AS consumo_anterior,
          uc.ultima                          AS ultima_compra
        FROM direcciones_activas da
        LEFT JOIN clientes c           ON c.codigo_cliente           = da.customer_code
        LEFT JOIN tipos_negocio tn     ON tn.codigo                  = c.codigo_tipo_negocio
        LEFT JOIN direcciones_clientes dc ON dc.codigo_direccion_cliente = da.customer_address_code
                                          AND dc.codigo_cliente = da.customer_code
        LEFT JOIN consumo_actual   ca  ON ca.customer_code           = da.customer_code
                                      AND ca.customer_address_code   = da.customer_address_code
        LEFT JOIN consumo_anterior cp  ON cp.customer_code           = da.customer_code
                                      AND cp.customer_address_code   = da.customer_address_code
        LEFT JOIN ultima_compra    uc  ON uc.customer_code           = da.customer_code
                                      AND uc.customer_address_code   = da.customer_address_code
        ORDER BY consumo_actual DESC;
      `;

      clientes = await db.query(sql, { type: QueryTypes.SELECT });

    } else {
      // ── EMPRESAS — fuente: ordenes type=2 ────────────────────
      const rutasEsc = RUTAS_EMPRESAS.map(r => `'${r.replace(/'/g, "''")}'`).join(", ");

      const sql = `
        WITH clientes_canal AS (
          SELECT DISTINCT o.customer_code, o.customer_address_code
          FROM ordenes o
          WHERE o.type = 2
            AND o.status IN (2, 4, 5)
            AND o.seller_nombre IN (${rutasEsc})
            AND o.fecha_creacion >= '${antInicio}'
        ),
        consumo_actual AS (
          SELECT o.customer_code,
            SUM(dd.cantidad) AS unidades,
            SUM(dd.total)    AS monto
          FROM ordenes o
          JOIN detalle_documento dd ON dd.documento_code = o.code
          WHERE o.type = 2
            AND o.status IN (2, 4, 5)
            AND dd.codigo_categoria = '7'
            AND o.seller_nombre IN (${rutasEsc})
            AND o.fecha_creacion >= '${inicio}' AND o.fecha_creacion < '${fin}'
          GROUP BY o.customer_code
        ),
        consumo_anterior AS (
          SELECT o.customer_code,
            SUM(dd.total) AS monto
          FROM ordenes o
          JOIN detalle_documento dd ON dd.documento_code = o.code
          WHERE o.type = 2
            AND o.status IN (2, 4, 5)
            AND dd.codigo_categoria = '7'
            AND o.seller_nombre IN (${rutasEsc})
            AND o.fecha_creacion >= '${antInicio}' AND o.fecha_creacion < '${antFin}'
          GROUP BY o.customer_code
        ),
        ultima_compra AS (
          SELECT o.customer_code, MAX(o.fecha_creacion) AS ultima
          FROM ordenes o
          WHERE o.type = 2 AND o.status IN (2, 4, 5)
            AND o.seller_nombre IN (${rutasEsc})
          GROUP BY o.customer_code
        )
        SELECT
          cc.customer_code,
          cc.customer_address_code,
          COALESCE(dc.descripcion_direccion_cliente, dc2.descripcion_direccion_cliente) AS descripcion_direccion,
          c.nombre_cliente,
          tn.descripcion   AS tipo_negocio,
          COALESCE(dc.calle1_direccion_cliente, dc2.calle1_direccion_cliente)   AS direccion_entrega,
          COALESCE(dc.telefono_direccion_cliente, dc2.telefono_direccion_cliente) AS telefono,
          COALESCE(dc.latitud_direccion_cliente, dc2.latitud_direccion_cliente)   AS latitud,
          COALESCE(dc.longitud_direccion_cliente, dc2.longitud_direccion_cliente) AS longitud,
          COALESCE(ca.monto,    0) AS consumo_actual,
          COALESCE(ca.unidades, 0) AS unidades_actual,
          COALESCE(cp.monto,    0) AS consumo_anterior,
          uc.ultima                  AS ultima_compra
        FROM clientes_canal cc
        LEFT JOIN clientes c              ON c.codigo_cliente  = cc.customer_code
        LEFT JOIN tipos_negocio tn        ON tn.codigo         = c.codigo_tipo_negocio
        LEFT JOIN direcciones_clientes dc ON dc.codigo_direccion_cliente = cc.customer_address_code::text
                                          AND dc.codigo_cliente = cc.customer_code
        LEFT JOIN (
          SELECT DISTINCT ON (codigo_cliente)
            codigo_cliente, descripcion_direccion_cliente,
            calle1_direccion_cliente, telefono_direccion_cliente,
            latitud_direccion_cliente, longitud_direccion_cliente
          FROM direcciones_clientes
          ORDER BY codigo_cliente
        ) dc2 ON dc2.codigo_cliente = cc.customer_code
        LEFT JOIN consumo_actual   ca     ON ca.customer_code  = cc.customer_code
        LEFT JOIN consumo_anterior cp     ON cp.customer_code  = cc.customer_code
        LEFT JOIN ultima_compra    uc     ON uc.customer_code  = cc.customer_code
        ORDER BY consumo_actual DESC;
      `;

      clientes = await db.query(sql, { type: QueryTypes.SELECT });
    }

    // ── Enriquecer + calcular rotación ──────────────────────────
    const hoy = new Date();
    const hace30 = new Date(hoy);
    hace30.setDate(hoy.getDate() - 30);

    const clientesEnriquecidos = clientes.map(c => {
      const actual   = Number(c.consumo_actual)   || 0;
      const anterior = Number(c.consumo_anterior) || 0;
      const varAbs   = actual - anterior;
      const varPorc  = anterior > 0 ? (varAbs / anterior) * 100 : null;

      const ultimaCompraDate = c.ultima_compra ? new Date(c.ultima_compra) : null;
      const rotando = ultimaCompraDate ? ultimaCompraDate >= hace30 : false;

      return {
        customer_code         : c.customer_code,
        customer_address_code : c.customer_address_code || null,
        nombre_cliente        : c.nombre_cliente   || "SIN NOMBRE",
        tipo_negocio          : c.tipo_negocio     || "SIN CLASIFICAR",
        direccion_entrega     : c.direccion_entrega || "—",
        telefono              : c.telefono         || "—",
        consumo_actual        : Number(actual.toFixed(2)),
        unidades_actual       : Number(c.unidades_actual) || 0,
        consumo_anterior      : Number(anterior.toFixed(2)),
        variacion_abs         : Number(varAbs.toFixed(2)),
        variacion_porc        : varPorc !== null ? Number(varPorc.toFixed(2)) : null,
        ultima_compra         : formatFecha(c.ultima_compra),
        rotando,
        fuente                : c.fuente || null,
      };
    });

    // ── Productos vendidos del mes ───────────────────────────────
    let productosVendidos = [];
    if (config.usaCombinado) {
      const filtro       = config.filtroMobil;
      const equipoVentas = config.equipoOdoo.replace(/'/g, "''");
      const sqlProdMobil = `
        SELECT COALESCE(dd.descripcion, 'SIN DESCRIPCIÓN') AS producto,
               SUM(dd.cantidad) AS unidades_vendidas,
               SUM(dd.total)    AS monto_usd
        FROM facturas f
        JOIN detalle_documento dd ON dd.documento_code = f.code
        WHERE ${filtro}
          AND dd.codigo_categoria = '7'
          AND f.status IN ('0','2','4','5')
          AND f.fecha_entrega >= '${inicio}' AND f.fecha_entrega < '${fin}'
        GROUP BY COALESCE(dd.descripcion, 'SIN DESCRIPCIÓN')
      `;
      const sqlProdOdoo = `
        SELECT COALESCE(dd.descripcion, 'SIN DESCRIPCIÓN') AS producto,
               SUM(dd.cantidad) AS unidades_vendidas,
               SUM(dd.total)    AS monto_usd
        FROM ordenes o
        JOIN detalle_documento dd ON dd.documento_code = o.code
        WHERE o.origen_sistema = 'ODOO'
          AND o.equipo_ventas  = '${equipoVentas}'
          AND o.type = 2 AND o.status IN (2, 4, 5)
          AND dd.codigo_categoria = '7'
          AND o.fecha_creacion >= '${inicio}' AND o.fecha_creacion < '${fin}'
        GROUP BY COALESCE(dd.descripcion, 'SIN DESCRIPCIÓN')
      `;
      const [prodsMobil, prodsOdoo] = await Promise.all([
        db.query(sqlProdMobil, { type: QueryTypes.SELECT }),
        db.query(sqlProdOdoo,  { type: QueryTypes.SELECT }),
      ]);
      // Fusionar por nombre de producto
      const mapaProds = {};
      [...prodsMobil, ...prodsOdoo].forEach((p) => {
        if (!mapaProds[p.producto]) {
          mapaProds[p.producto] = { producto: p.producto, unidades_vendidas: 0, monto_usd: 0 };
        }
        mapaProds[p.producto].unidades_vendidas += Number(p.unidades_vendidas) || 0;
        mapaProds[p.producto].monto_usd         += Number(p.monto_usd) || 0;
      });
      productosVendidos = Object.values(mapaProds).sort((a, b) => b.unidades_vendidas - a.unidades_vendidas);
    } else if (config.usaOdoo) {
      const equipoVentas = config.equipoVentas.replace(/'/g, "''");
      const sqlProd = `
        SELECT COALESCE(dd.descripcion, 'SIN DESCRIPCIÓN') AS producto,
               SUM(dd.cantidad) AS unidades_vendidas,
               SUM(dd.total)    AS monto_usd
        FROM ordenes o
        JOIN detalle_documento dd ON dd.documento_code = o.code
        WHERE o.origen_sistema = 'ODOO'
          AND o.equipo_ventas  = '${equipoVentas}'
          AND o.type   = 2
          AND o.status IN (2, 4, 5)
          AND dd.codigo_categoria = '7'
          AND o.fecha_creacion >= '${inicio}' AND o.fecha_creacion < '${fin}'
        GROUP BY COALESCE(dd.descripcion, 'SIN DESCRIPCIÓN')
        ORDER BY unidades_vendidas DESC
      `;
      productosVendidos = await db.query(sqlProd, { type: QueryTypes.SELECT });
    } else if (!config.usaOrdenes) {
      const filtro = config.filtro;
      const sqlProd = `
        SELECT COALESCE(dd.descripcion, 'SIN DESCRIPCIÓN') AS producto,
               SUM(dd.cantidad) AS unidades_vendidas,
               SUM(dd.total)    AS monto_usd
        FROM facturas f
        JOIN detalle_documento dd ON dd.documento_code = f.code
        WHERE ${filtro}
          AND dd.codigo_categoria = '7'
          AND f.status IN ('0','2','4','5')
          AND f.fecha_entrega >= '${inicio}' AND f.fecha_entrega < '${fin}'
        GROUP BY COALESCE(dd.descripcion, 'SIN DESCRIPCIÓN')
        ORDER BY unidades_vendidas DESC
      `;
      productosVendidos = await db.query(sqlProd, { type: QueryTypes.SELECT });
    } else {
      const rutasEsc = RUTAS_EMPRESAS.map(r => `'${r.replace(/'/g, "''")}'`).join(", ");
      const sqlProd = `
        SELECT COALESCE(dd.descripcion, 'SIN DESCRIPCIÓN') AS producto,
               SUM(dd.cantidad) AS unidades_vendidas,
               SUM(dd.total)    AS monto_usd
        FROM ordenes o
        JOIN detalle_documento dd ON dd.documento_code = o.code
        WHERE o.type = 2
          AND o.status IN (2, 4, 5)
          AND dd.codigo_categoria = '7'
          AND o.seller_nombre IN (${rutasEsc})
          AND o.fecha_creacion >= '${inicio}' AND o.fecha_creacion < '${fin}'
        GROUP BY COALESCE(dd.descripcion, 'SIN DESCRIPCIÓN')
        ORDER BY unidades_vendidas DESC
      `;
      productosVendidos = await db.query(sqlProd, { type: QueryTypes.SELECT });
    }

    const totalClientes       = new Set(clientesEnriquecidos.map(c => c.customer_code)).size;
    const clientesConConsumo  = new Set(clientesEnriquecidos.filter(c => c.consumo_actual > 0).map(c => c.customer_code)).size;
    const clientesSinConsumo  = totalClientes - clientesConConsumo;
    const totalConsumo        = clientesEnriquecidos.reduce((a, c) => a + c.consumo_actual, 0);
    const totalAnterior       = clientesEnriquecidos.reduce((a, c) => a + c.consumo_anterior, 0);

    return res.json({
      canal      : canal.toUpperCase(),
      anio       : anioNum,
      mes        : mesNum,
      resumen    : {
        totalClientes,
        clientesConConsumo,
        clientesSinConsumo,
        totalConsumo   : Number(totalConsumo.toFixed(2)),
        totalAnterior  : Number(totalAnterior.toFixed(2)),
        variacion_abs  : Number((totalConsumo - totalAnterior).toFixed(2)),
      },
      clientes        : clientesEnriquecidos,
      productosVendidos,
    });

  } catch (error) {
    console.error("❌ ERROR detalle-canal:", error);
    return res.status(500).json({ error: "Error al obtener clientes del canal", detalle: error.message });
  }
};

// ================================================================
// ENDPOINT: Productos por sucursal (dirección de entrega)
// GET /api/ventas/productos-sucursal/:canal/:anio/:mes
//   ?customerCode=...  &addressCode=...  &fuente=mobilvendor|odoo
// ================================================================
const obtenerProductosSucursal = async (req, res) => {
  try {
    const { canal, anio, mes } = req.params;
    const { customerCode, addressCode, fuente } = req.query;

    if (!canal || !anio || !mes || !customerCode)
      return res.status(400).json({ error: "Faltan parámetros" });

    const anioNum = parseInt(anio, 10);
    const mesNum  = parseInt(mes,  10);
    const inicio  = getFechaInicioMes(anioNum, mesNum);
    const fin     = getFechaFinMes(anioNum, mesNum);

    const config = getFiltroCanal(canal);
    if (!config)
      return res.status(400).json({ error: "Canal no válido" });

    const codEsc  = customerCode.replace(/'/g, "''");
    const addrEsc = addressCode ? addressCode.replace(/'/g, "''") : null;

    let productos = [];

    // Determinar fuente de datos:
    // - Canal ODOO puro (config.usaOdoo): ordenes con equipo_ventas
    // - Canal combinado (config.usaCombinado): depende del param fuente
    // - Canal EMPRESAS (config.usaOrdenes): ordenes con seller_nombre
    // - Resto: facturas
    const esOdoo     = config.usaOdoo || fuente === "odoo";
    const esEmpresas = !!config.usaOrdenes;

    if (esOdoo) {
      // ODOO: buscar por customer_code en ordenes con equipo_ventas
      const equipoVentas = (config.equipoOdoo || config.equipoVentas || "").replace(/'/g, "''");
      const sql = `
        SELECT COALESCE(dd.descripcion, 'SIN DESCRIPCIÓN') AS producto,
               SUM(dd.cantidad) AS unidades_vendidas,
               SUM(dd.total)    AS monto_usd
        FROM ordenes o
        JOIN detalle_documento dd ON dd.documento_code = o.code
        WHERE o.origen_sistema = 'ODOO'
          AND o.equipo_ventas  = '${equipoVentas}'
          AND o.customer_code  = '${codEsc}'
          AND o.type = 2 AND o.status IN (2, 4, 5)
          AND dd.codigo_categoria = '7'
          AND o.fecha_creacion >= '${inicio}' AND o.fecha_creacion < '${fin}'
        GROUP BY COALESCE(dd.descripcion, 'SIN DESCRIPCIÓN')
        ORDER BY unidades_vendidas DESC
      `;
      productos = await db.query(sql, { type: QueryTypes.SELECT });
    } else if (esEmpresas) {
      // EMPRESAS: buscar en ordenes con seller_nombre
      const rutasEsc = RUTAS_EMPRESAS.map(r => `'${r.replace(/'/g, "''")}'`).join(", ");
      const sql = `
        SELECT COALESCE(dd.descripcion, 'SIN DESCRIPCIÓN') AS producto,
               SUM(dd.cantidad) AS unidades_vendidas,
               SUM(dd.total)    AS monto_usd
        FROM ordenes o
        JOIN detalle_documento dd ON dd.documento_code = o.code
        WHERE o.type = 2 AND o.status IN (2, 4, 5)
          AND o.seller_nombre IN (${rutasEsc})
          AND o.customer_code  = '${codEsc}'
          AND dd.codigo_categoria = '7'
          AND o.fecha_creacion >= '${inicio}' AND o.fecha_creacion < '${fin}'
        GROUP BY COALESCE(dd.descripcion, 'SIN DESCRIPCIÓN')
        ORDER BY unidades_vendidas DESC
      `;
      productos = await db.query(sql, { type: QueryTypes.SELECT });
    } else {
      // Mobilvendor: buscar por customer_code + customer_address_code en facturas
      const filtroCanal = config.filtroMobil || config.filtro || "1=1";
      const sql = `
        SELECT COALESCE(dd.descripcion, 'SIN DESCRIPCIÓN') AS producto,
               SUM(dd.cantidad) AS unidades_vendidas,
               SUM(dd.total)    AS monto_usd
        FROM facturas f
        JOIN detalle_documento dd ON dd.documento_code = f.code
        WHERE ${filtroCanal}
          AND f.customer_code         = '${codEsc}'
          AND f.customer_address_code = '${addrEsc}'
          AND dd.codigo_categoria = '7'
          AND f.status IN ('0','2','4','5')
          AND f.fecha_entrega >= '${inicio}' AND f.fecha_entrega < '${fin}'
        GROUP BY COALESCE(dd.descripcion, 'SIN DESCRIPCIÓN')
        ORDER BY unidades_vendidas DESC
      `;
      productos = await db.query(sql, { type: QueryTypes.SELECT });
    }

    return res.json({
      ok: true,
      productos: productos.map(p => ({
        producto:          p.producto,
        unidades_vendidas: Number(p.unidades_vendidas) || 0,
        monto_usd:         Number(p.monto_usd)         || 0,
      })),
    });

  } catch (error) {
    console.error("❌ ERROR productos-sucursal:", error);
    return res.status(500).json({ error: "Error al obtener productos", detalle: error.message });
  }
};

module.exports = { obtenerClientesCanal, obtenerProductosSucursal };
