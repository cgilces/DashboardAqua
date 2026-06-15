// controllers/controllerPreventa/detalleCanalController.js
// Portal de clientes por CANAL (VIP, DOMICILIO, EMPRESAS)
// El cliente pertenece al canal, no a una ruta específica.

const db        = require("../../db");
const Sequelize = require("sequelize");
const { QueryTypes } = require("sequelize");
const { dedupeProductosVendidos } = require("../../utils/dedupeProductos");

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

  // VIP (V% en mobil) + ODOO Moderno — replica EXACTA de la tabla principal:
  //   facturas/ordenes WHERE seller_code ILIKE 'V%' AND status='2' AND fecha_creacion
  if (cup === "VIP") return {
    usaCombinado:      true,
    filtroMobilFact:   "f.seller_code ILIKE 'V%'",
    filtroMobilOrden:  "o.seller_code ILIKE 'V%'",
    statusMobilFact:   "('2')",
    statusMobilOrden:  "('2')",
    fechaMobilFact:    "f.fecha_creacion",
    fechaMobilOrden:   "o.fecha_creacion",
    incluyeOrdenesMobil: true,
    equipoOdoo:        "Moderno",
  };

  // DOMICILIO (A%) + ODOO Domicilio — replica EXACTA: solo facturas A% con status (2,4,5)
  if (cup === "DOMICILIO") return {
    usaCombinado:      true,
    filtroMobilFact:   "f.seller_code ILIKE 'A%'",
    filtroMobilOrden:  null,
    statusMobilFact:   "('2','4','5')",
    statusMobilOrden:  null,
    fechaMobilFact:    "COALESCE(f.fecha_entrega, f.fecha_creacion)",
    fechaMobilOrden:   null,
    incluyeOrdenesMobil: false,
    equipoOdoo:        "Domicilio",
  };

  // MAYORISTA (M%) — facturas M% + ordenes M% con status (2,4,5)
  if (cup === "MAYORISTA") return {
    tabla: "facturas",
    filtro:           "f.seller_code ILIKE 'M%'",
    filtroOrden:      "o.seller_code ILIKE 'M%'",
    statusFact:       "('2','4','5')",
    statusOrden:      "('2','4','5')",
    fechaFact:        "COALESCE(f.fecha_entrega, f.fecha_creacion)",
    fechaOrden:       "COALESCE(o.fecha_entrega, o.fecha_creacion)",
    incluyeOrdenes:   true,
    usaOrdenes:       false,
    usaOdoo:          false,
  };

  if (cup === "EMPRESAS") return { tabla: "ordenes", filtro: null, usaOrdenes: true, usaOdoo: false };

  // OTRO — el frontend clasifica como OTRO todo seller_code que no empiece por A/V/M.
  // El backend principal solo retorna sellers A%/V%/M%/'18', por lo que OTRO = seller_code '18'.
  // Aplica los mismos filtros que VIP (status='2', fecha_creacion, facturas + ordenes).
  if (cup === "OTRO") return {
    tabla: "facturas",
    filtro:           "f.seller_code = '18'",
    filtroOrden:      "o.seller_code = '18'",
    statusFact:       "('2')",
    statusOrden:      "('2')",
    fechaFact:        "f.fecha_creacion",
    fechaOrden:       "o.fecha_creacion",
    incluyeOrdenes:   true,
    usaOrdenes:       false,
    usaOdoo:          false,
  };

  // EMPRESAS (slug "empresas-odoo" del ranking principal)
  // Replica EXACTA de obtenerOdooDescartablePorCanal: suma 3 fuentes UNION ALL
  //   ① ORDENES ODOO equipo_ventas='Empresas' (type=2, status IN (2))
  //   ② ORDENES seller_code LIKE 'E%' (sin status/type)
  //   ③ FACTURAS seller_code LIKE 'E%' (sin status)
  // Todas con dd.codigo_categoria='7' y fecha_creacion en el rango.
  if (c === "empresas-odoo") return {
    usaEmpresasE: true,
  };

  // Canales ODOO (por equipo_ventas)
  const equipoVentas = ODOO_CANAL_MAP[c];
  if (equipoVentas) return { usaOrdenes: false, usaOdoo: true, equipoVentas };

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
      return res.status(400).json({ error: "Canal no válido. Use VIP, DOMICILIO, MAYORISTA, EMPRESAS, OTRO o un canal ODOO" });

    const inicio    = getFechaInicioMes(anioNum, mesNum);
    const fin       = getFechaFinMes(anioNum, mesNum);
    const antPer    = getMesAnterior(anioNum, mesNum);
    const antInicio = getFechaInicioMes(antPer.anio, antPer.mes);
    const antFin    = getFechaFinMes(antPer.anio, antPer.mes);

    let clientes = [];

    if (config.usaCombinado) {
      // ── Mobilvendor (V%/'18' o A%) + ODOO equivalente ────────────────────
      const filtroF      = config.filtroMobilFact;
      const filtroO      = config.filtroMobilOrden;
      const statusF      = config.statusMobilFact;
      const statusO      = config.statusMobilOrden;
      const fechaF       = config.fechaMobilFact;
      const fechaO       = config.fechaMobilOrden;
      const equipoVentas = config.equipoOdoo.replace(/'/g, "''");
      const incluyeOrd   = config.incluyeOrdenesMobil;

      // CTE direcciones activas (clientes con actividad desde mes anterior)
      // NOTA: facturas.customer_address_code es VARCHAR y ordenes.customer_address_code es INTEGER.
      // Casteamos a TEXT en ambos lados para que el UNION sea válido.
      const cteDirActivas = incluyeOrd
        ? `direcciones_activas AS (
            SELECT customer_code, customer_address_code FROM (
              SELECT DISTINCT f.customer_code, f.customer_address_code::text AS customer_address_code
              FROM facturas f
              WHERE ${filtroF} AND f.status IN ${statusF}
                AND ${fechaF} >= '${antInicio}' AND f.customer_address_code IS NOT NULL
              UNION
              SELECT DISTINCT o.customer_code, o.customer_address_code::text AS customer_address_code
              FROM ordenes o
              WHERE ${filtroO} AND o.status IN ${statusO}
                AND ${fechaO} >= '${antInicio}' AND o.customer_address_code IS NOT NULL
            ) u
          )`
        : `direcciones_activas AS (
            SELECT DISTINCT f.customer_code, f.customer_address_code::text AS customer_address_code
            FROM facturas f
            WHERE ${filtroF} AND f.status IN ${statusF}
              AND ${fechaF} >= '${antInicio}' AND f.customer_address_code IS NOT NULL
          )`;

      const cteConsumoActual = incluyeOrd
        ? `consumo_actual AS (
            SELECT customer_code, customer_address_code, SUM(unidades) AS unidades, SUM(monto) AS monto
            FROM (
              SELECT f.customer_code, f.customer_address_code::text AS customer_address_code, SUM(dd.cantidad) AS unidades, SUM(dd.total) AS monto
              FROM facturas f JOIN detalle_documento dd ON dd.documento_code = f.code
              WHERE ${filtroF} AND dd.codigo_categoria='7' AND f.status IN ${statusF}
                AND ${fechaF} >= '${inicio}' AND ${fechaF} < '${fin}'
              GROUP BY f.customer_code, f.customer_address_code
              UNION ALL
              SELECT o.customer_code, o.customer_address_code::text AS customer_address_code, SUM(dd.cantidad), SUM(dd.total)
              FROM ordenes o JOIN detalle_documento dd ON dd.documento_code = o.code
              WHERE ${filtroO} AND dd.codigo_categoria='7' AND o.status IN ${statusO}
                AND ${fechaO} >= '${inicio}' AND ${fechaO} < '${fin}'
              GROUP BY o.customer_code, o.customer_address_code
            ) u
            GROUP BY customer_code, customer_address_code
          )`
        : `consumo_actual AS (
            SELECT f.customer_code, f.customer_address_code::text AS customer_address_code, SUM(dd.cantidad) AS unidades, SUM(dd.total) AS monto
            FROM facturas f JOIN detalle_documento dd ON dd.documento_code = f.code
            WHERE ${filtroF} AND dd.codigo_categoria='7' AND f.status IN ${statusF}
              AND ${fechaF} >= '${inicio}' AND ${fechaF} < '${fin}'
            GROUP BY f.customer_code, f.customer_address_code
          )`;

      const cteConsumoAnterior = incluyeOrd
        ? `consumo_anterior AS (
            SELECT customer_code, customer_address_code, SUM(monto) AS monto
            FROM (
              SELECT f.customer_code, f.customer_address_code::text AS customer_address_code, SUM(dd.total) AS monto
              FROM facturas f JOIN detalle_documento dd ON dd.documento_code = f.code
              WHERE ${filtroF} AND dd.codigo_categoria='7' AND f.status IN ${statusF}
                AND ${fechaF} >= '${antInicio}' AND ${fechaF} < '${antFin}'
              GROUP BY f.customer_code, f.customer_address_code
              UNION ALL
              SELECT o.customer_code, o.customer_address_code::text AS customer_address_code, SUM(dd.total)
              FROM ordenes o JOIN detalle_documento dd ON dd.documento_code = o.code
              WHERE ${filtroO} AND dd.codigo_categoria='7' AND o.status IN ${statusO}
                AND ${fechaO} >= '${antInicio}' AND ${fechaO} < '${antFin}'
              GROUP BY o.customer_code, o.customer_address_code
            ) u
            GROUP BY customer_code, customer_address_code
          )`
        : `consumo_anterior AS (
            SELECT f.customer_code, f.customer_address_code::text AS customer_address_code, SUM(dd.total) AS monto
            FROM facturas f JOIN detalle_documento dd ON dd.documento_code = f.code
            WHERE ${filtroF} AND dd.codigo_categoria='7' AND f.status IN ${statusF}
              AND ${fechaF} >= '${antInicio}' AND ${fechaF} < '${antFin}'
            GROUP BY f.customer_code, f.customer_address_code
          )`;

      const cteUltimaCompra = incluyeOrd
        ? `ultima_compra AS (
            SELECT customer_code, customer_address_code, MAX(ultima) AS ultima
            FROM (
              SELECT f.customer_code, f.customer_address_code::text AS customer_address_code, MAX(${fechaF}) AS ultima
              FROM facturas f WHERE ${filtroF} AND f.status IN ${statusF}
              GROUP BY f.customer_code, f.customer_address_code
              UNION ALL
              SELECT o.customer_code, o.customer_address_code::text AS customer_address_code, MAX(${fechaO})
              FROM ordenes o WHERE ${filtroO} AND o.status IN ${statusO}
              GROUP BY o.customer_code, o.customer_address_code
            ) u
            GROUP BY customer_code, customer_address_code
          )`
        : `ultima_compra AS (
            SELECT f.customer_code, f.customer_address_code::text AS customer_address_code, MAX(${fechaF}) AS ultima
            FROM facturas f WHERE ${filtroF} AND f.status IN ${statusF}
            GROUP BY f.customer_code, f.customer_address_code
          )`;

      const sqlMobil = `
        WITH ${cteDirActivas},
        ${cteConsumoActual},
        ${cteConsumoAnterior},
        ${cteUltimaCompra}
        SELECT
          da.customer_code, da.customer_address_code,
          dc.descripcion_direccion_cliente   AS descripcion_direccion,
          c.nombre_cliente,
          c.identificacion_cliente,
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
            AND o.type = 2 AND o.status IN (2)
            AND o.fecha_creacion >= '${antInicio}'
        ),
        consumo_actual AS (
          SELECT o.customer_code, o.customer_address_code,
            SUM(dd.cantidad) AS unidades, SUM(dd.total) AS monto
          FROM ordenes o
          JOIN detalle_documento dd ON dd.documento_code = o.code
          WHERE o.origen_sistema = 'ODOO'
            AND o.equipo_ventas  = '${equipoVentas}'
            AND o.type = 2 AND o.status IN (2)
            AND dd.codigo_categoria = '7'
            AND o.fecha_creacion >= '${inicio}' AND o.fecha_creacion < '${fin}'
          GROUP BY o.customer_code, o.customer_address_code
        ),
        consumo_anterior AS (
          SELECT o.customer_code, o.customer_address_code, SUM(dd.total) AS monto
          FROM ordenes o
          JOIN detalle_documento dd ON dd.documento_code = o.code
          WHERE o.origen_sistema = 'ODOO'
            AND o.equipo_ventas  = '${equipoVentas}'
            AND o.type = 2 AND o.status IN (2)
            AND dd.codigo_categoria = '7'
            AND o.fecha_creacion >= '${antInicio}' AND o.fecha_creacion < '${antFin}'
          GROUP BY o.customer_code, o.customer_address_code
        ),
        ultima_compra AS (
          SELECT o.customer_code, o.customer_address_code, MAX(o.fecha_creacion) AS ultima
          FROM ordenes o
          WHERE o.origen_sistema = 'ODOO'
            AND o.equipo_ventas  = '${equipoVentas}'
            AND o.type = 2 AND o.status IN (2)
          GROUP BY o.customer_code, o.customer_address_code
        )
        SELECT
          cc.customer_code, cc.customer_address_code,
          COALESCE(dc.descripcion_direccion_cliente, dc2.descripcion_direccion_cliente) AS descripcion_direccion,
          c.nombre_cliente,
          c.identificacion_cliente,
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
                                          AND ca.customer_address_code IS NOT DISTINCT FROM cc.customer_address_code
        LEFT JOIN consumo_anterior cp     ON cp.customer_code = cc.customer_code
                                          AND cp.customer_address_code IS NOT DISTINCT FROM cc.customer_address_code
        LEFT JOIN ultima_compra    uc     ON uc.customer_code = cc.customer_code
                                          AND uc.customer_address_code IS NOT DISTINCT FROM cc.customer_address_code
        ORDER BY consumo_actual DESC;
      `;

      const [clientesMobil, clientesOdoo] = await Promise.all([
        db.query(sqlMobil, { type: QueryTypes.SELECT }),
        db.query(sqlOdoo,  { type: QueryTypes.SELECT }),
      ]);
      clientes = [...clientesMobil, ...clientesOdoo];

    } else if (config.usaEmpresasE) {
      // ── EMPRESAS — réplica EXACTA del ranking principal (obtenerOdooDescartablePorCanal)
      // Suma 3 fuentes: ORDENES ODOO equipo='Empresas' + ORDENES seller E% + FACTURAS seller E%
      const sql = `
        WITH direcciones_activas AS (
          SELECT DISTINCT customer_code, customer_address_code FROM (
            SELECT f.customer_code, f.customer_address_code::text AS customer_address_code
            FROM facturas f JOIN detalle_documento dd ON dd.documento_code = f.code
            WHERE f.seller_code LIKE 'E%' AND dd.codigo_categoria = '7'
              AND f.fecha_creacion >= '${antInicio}'
              AND f.customer_address_code IS NOT NULL
            UNION ALL
            SELECT o.customer_code, o.customer_address_code::text
            FROM ordenes o JOIN detalle_documento dd ON dd.documento_code = o.code
            WHERE o.seller_code LIKE 'E%' AND dd.codigo_categoria = '7'
              AND o.fecha_creacion >= '${antInicio}'
              AND o.customer_address_code IS NOT NULL
            UNION ALL
            SELECT o.customer_code, o.customer_address_code::text
            FROM ordenes o JOIN detalle_documento dd ON dd.documento_code = o.code
            WHERE o.origen_sistema = 'ODOO' AND o.equipo_ventas = 'Empresas'
              AND o.type = 2 AND o.status IN (2)
              AND dd.codigo_categoria = '7'
              AND o.fecha_creacion >= '${antInicio}'
              AND o.customer_address_code IS NOT NULL
          ) u
        ),
        consumo_actual AS (
          SELECT customer_code, customer_address_code,
            SUM(unidades) AS unidades, SUM(monto) AS monto
          FROM (
            SELECT f.customer_code, f.customer_address_code::text AS customer_address_code,
              SUM(dd.cantidad) AS unidades, SUM(dd.total) AS monto
            FROM facturas f JOIN detalle_documento dd ON dd.documento_code = f.code
            WHERE f.seller_code LIKE 'E%' AND dd.codigo_categoria = '7'
              AND f.fecha_creacion >= '${inicio}' AND f.fecha_creacion < '${fin}'
            GROUP BY f.customer_code, f.customer_address_code
            UNION ALL
            SELECT o.customer_code, o.customer_address_code::text,
              SUM(dd.cantidad), SUM(dd.total)
            FROM ordenes o JOIN detalle_documento dd ON dd.documento_code = o.code
            WHERE o.seller_code LIKE 'E%' AND dd.codigo_categoria = '7'
              AND o.fecha_creacion >= '${inicio}' AND o.fecha_creacion < '${fin}'
            GROUP BY o.customer_code, o.customer_address_code
            UNION ALL
            SELECT o.customer_code, o.customer_address_code::text,
              SUM(dd.cantidad), SUM(dd.total)
            FROM ordenes o JOIN detalle_documento dd ON dd.documento_code = o.code
            WHERE o.origen_sistema = 'ODOO' AND o.equipo_ventas = 'Empresas'
              AND o.type = 2 AND o.status IN (2)
              AND dd.codigo_categoria = '7'
              AND o.fecha_creacion >= '${inicio}' AND o.fecha_creacion < '${fin}'
            GROUP BY o.customer_code, o.customer_address_code
          ) u
          GROUP BY customer_code, customer_address_code
        ),
        consumo_anterior AS (
          SELECT customer_code, customer_address_code, SUM(monto) AS monto
          FROM (
            SELECT f.customer_code, f.customer_address_code::text AS customer_address_code,
              SUM(dd.total) AS monto
            FROM facturas f JOIN detalle_documento dd ON dd.documento_code = f.code
            WHERE f.seller_code LIKE 'E%' AND dd.codigo_categoria = '7'
              AND f.fecha_creacion >= '${antInicio}' AND f.fecha_creacion < '${antFin}'
            GROUP BY f.customer_code, f.customer_address_code
            UNION ALL
            SELECT o.customer_code, o.customer_address_code::text, SUM(dd.total)
            FROM ordenes o JOIN detalle_documento dd ON dd.documento_code = o.code
            WHERE o.seller_code LIKE 'E%' AND dd.codigo_categoria = '7'
              AND o.fecha_creacion >= '${antInicio}' AND o.fecha_creacion < '${antFin}'
            GROUP BY o.customer_code, o.customer_address_code
            UNION ALL
            SELECT o.customer_code, o.customer_address_code::text, SUM(dd.total)
            FROM ordenes o JOIN detalle_documento dd ON dd.documento_code = o.code
            WHERE o.origen_sistema = 'ODOO' AND o.equipo_ventas = 'Empresas'
              AND o.type = 2 AND o.status IN (2)
              AND dd.codigo_categoria = '7'
              AND o.fecha_creacion >= '${antInicio}' AND o.fecha_creacion < '${antFin}'
            GROUP BY o.customer_code, o.customer_address_code
          ) u
          GROUP BY customer_code, customer_address_code
        ),
        ultima_compra AS (
          SELECT customer_code, customer_address_code, MAX(ultima) AS ultima
          FROM (
            SELECT f.customer_code, f.customer_address_code::text AS customer_address_code,
              MAX(f.fecha_creacion) AS ultima
            FROM facturas f WHERE f.seller_code LIKE 'E%'
            GROUP BY f.customer_code, f.customer_address_code
            UNION ALL
            SELECT o.customer_code, o.customer_address_code::text, MAX(o.fecha_creacion)
            FROM ordenes o WHERE o.seller_code LIKE 'E%'
            GROUP BY o.customer_code, o.customer_address_code
            UNION ALL
            SELECT o.customer_code, o.customer_address_code::text, MAX(o.fecha_creacion)
            FROM ordenes o
            WHERE o.origen_sistema = 'ODOO' AND o.equipo_ventas = 'Empresas'
              AND o.type = 2 AND o.status IN (2)
            GROUP BY o.customer_code, o.customer_address_code
          ) u
          GROUP BY customer_code, customer_address_code
        )
        SELECT
          da.customer_code, da.customer_address_code,
          COALESCE(dc.descripcion_direccion_cliente, dc2.descripcion_direccion_cliente) AS descripcion_direccion,
          c.nombre_cliente,
          c.identificacion_cliente,
          tn.descripcion                    AS tipo_negocio,
          COALESCE(dc.calle1_direccion_cliente, dc2.calle1_direccion_cliente)   AS direccion_entrega,
          COALESCE(dc.telefono_direccion_cliente, dc2.telefono_direccion_cliente) AS telefono,
          COALESCE(dc.latitud_direccion_cliente, dc2.latitud_direccion_cliente)   AS latitud,
          COALESCE(dc.longitud_direccion_cliente, dc2.longitud_direccion_cliente) AS longitud,
          COALESCE(ca.monto,    0)           AS consumo_actual,
          COALESCE(ca.unidades, 0)           AS unidades_actual,
          COALESCE(cp.monto,    0)           AS consumo_anterior,
          uc.ultima                          AS ultima_compra
        FROM direcciones_activas da
        LEFT JOIN clientes c              ON c.codigo_cliente  = da.customer_code
        LEFT JOIN tipos_negocio tn        ON tn.codigo         = c.codigo_tipo_negocio
        LEFT JOIN direcciones_clientes dc ON dc.codigo_direccion_cliente = da.customer_address_code
                                          AND dc.codigo_cliente = da.customer_code
        LEFT JOIN (
          SELECT DISTINCT ON (codigo_cliente)
            codigo_cliente, descripcion_direccion_cliente,
            calle1_direccion_cliente, telefono_direccion_cliente,
            latitud_direccion_cliente, longitud_direccion_cliente
          FROM direcciones_clientes
          ORDER BY codigo_cliente
        ) dc2 ON dc2.codigo_cliente = da.customer_code
        LEFT JOIN consumo_actual   ca     ON ca.customer_code           = da.customer_code
                                          AND ca.customer_address_code   = da.customer_address_code
        LEFT JOIN consumo_anterior cp     ON cp.customer_code           = da.customer_code
                                          AND cp.customer_address_code   = da.customer_address_code
        LEFT JOIN ultima_compra    uc     ON uc.customer_code           = da.customer_code
                                          AND uc.customer_address_code   = da.customer_address_code
        ORDER BY consumo_actual DESC;
      `;

      clientes = await db.query(sql, { type: QueryTypes.SELECT });

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
            AND o.status IN (2)
            AND o.fecha_creacion >= '${antInicio}'
        ),
        consumo_actual AS (
          SELECT o.customer_code, o.customer_address_code,
            SUM(dd.cantidad) AS unidades,
            SUM(dd.total)    AS monto
          FROM ordenes o
          JOIN detalle_documento dd ON dd.documento_code = o.code
          WHERE o.origen_sistema = 'ODOO'
            AND o.equipo_ventas  = '${equipoVentas}'
            AND o.type   = 2
            AND o.status IN (2)
            AND dd.codigo_categoria = '7'
            AND o.fecha_creacion >= '${inicio}' AND o.fecha_creacion < '${fin}'
          GROUP BY o.customer_code, o.customer_address_code
        ),
        consumo_anterior AS (
          SELECT o.customer_code, o.customer_address_code,
            SUM(dd.total) AS monto
          FROM ordenes o
          JOIN detalle_documento dd ON dd.documento_code = o.code
          WHERE o.origen_sistema = 'ODOO'
            AND o.equipo_ventas  = '${equipoVentas}'
            AND o.type   = 2
            AND o.status IN (2)
            AND dd.codigo_categoria = '7'
            AND o.fecha_creacion >= '${antInicio}' AND o.fecha_creacion < '${antFin}'
          GROUP BY o.customer_code, o.customer_address_code
        ),
        ultima_compra AS (
          SELECT o.customer_code, o.customer_address_code, MAX(o.fecha_creacion) AS ultima
          FROM ordenes o
          WHERE o.origen_sistema = 'ODOO'
            AND o.equipo_ventas  = '${equipoVentas}'
            AND o.type = 2 AND o.status IN (2)
          GROUP BY o.customer_code, o.customer_address_code
        )
        SELECT
          cc.customer_code,
          cc.customer_address_code,
          COALESCE(dc.descripcion_direccion_cliente, dc2.descripcion_direccion_cliente) AS descripcion_direccion,
          c.nombre_cliente,
          c.identificacion_cliente,
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
                                          AND ca.customer_address_code IS NOT DISTINCT FROM cc.customer_address_code
        LEFT JOIN consumo_anterior cp     ON cp.customer_code  = cc.customer_code
                                          AND cp.customer_address_code IS NOT DISTINCT FROM cc.customer_address_code
        LEFT JOIN ultima_compra    uc     ON uc.customer_code  = cc.customer_code
                                          AND uc.customer_address_code IS NOT DISTINCT FROM cc.customer_address_code
        ORDER BY consumo_actual DESC;
      `;

      clientes = await db.query(sql, { type: QueryTypes.SELECT });

    } else if (!config.usaOrdenes) {
      // ── MAYORISTA / OTRO — fuente: facturas (+ órdenes si aplica) ────────
      const filtroF    = config.filtro;
      const filtroO    = config.filtroOrden;
      const statusF    = config.statusFact      || "('0','2','4','5')";
      const statusO    = config.statusOrden     || "('0','2','4','5')";
      const fechaF     = config.fechaFact       || "f.fecha_entrega";
      const fechaO     = config.fechaOrden      || "o.fecha_entrega";
      const incluyeOrd = !!config.incluyeOrdenes;

      // Cast a TEXT en customer_address_code para que UNION con ordenes (INTEGER) sea válido
      const cteDirActivas = incluyeOrd
        ? `direcciones_activas AS (
            SELECT customer_code, customer_address_code FROM (
              SELECT DISTINCT f.customer_code, f.customer_address_code::text AS customer_address_code
              FROM facturas f
              WHERE ${filtroF} AND f.status IN ${statusF}
                AND ${fechaF} >= '${antInicio}' AND f.customer_address_code IS NOT NULL
              UNION
              SELECT DISTINCT o.customer_code, o.customer_address_code::text AS customer_address_code
              FROM ordenes o
              WHERE ${filtroO} AND o.status IN ${statusO}
                AND ${fechaO} >= '${antInicio}' AND o.customer_address_code IS NOT NULL
            ) u
          )`
        : `direcciones_activas AS (
            SELECT DISTINCT f.customer_code, f.customer_address_code::text AS customer_address_code
            FROM facturas f
            WHERE ${filtroF} AND f.status IN ${statusF}
              AND ${fechaF} >= '${antInicio}' AND f.customer_address_code IS NOT NULL
          )`;

      const cteConsumoActual = incluyeOrd
        ? `consumo_actual AS (
            SELECT customer_code, customer_address_code, SUM(unidades) AS unidades, SUM(monto) AS monto
            FROM (
              SELECT f.customer_code, f.customer_address_code::text AS customer_address_code, SUM(dd.cantidad) AS unidades, SUM(dd.total) AS monto
              FROM facturas f JOIN detalle_documento dd ON dd.documento_code = f.code
              WHERE ${filtroF} AND dd.codigo_categoria='7' AND f.status IN ${statusF}
                AND ${fechaF} >= '${inicio}' AND ${fechaF} < '${fin}'
              GROUP BY f.customer_code, f.customer_address_code
              UNION ALL
              SELECT o.customer_code, o.customer_address_code::text AS customer_address_code, SUM(dd.cantidad), SUM(dd.total)
              FROM ordenes o JOIN detalle_documento dd ON dd.documento_code = o.code
              WHERE ${filtroO} AND dd.codigo_categoria='7' AND o.status IN ${statusO}
                AND ${fechaO} >= '${inicio}' AND ${fechaO} < '${fin}'
              GROUP BY o.customer_code, o.customer_address_code
            ) u
            GROUP BY customer_code, customer_address_code
          )`
        : `consumo_actual AS (
            SELECT f.customer_code, f.customer_address_code::text AS customer_address_code, SUM(dd.cantidad) AS unidades, SUM(dd.total) AS monto
            FROM facturas f JOIN detalle_documento dd ON dd.documento_code = f.code
            WHERE ${filtroF} AND dd.codigo_categoria='7' AND f.status IN ${statusF}
              AND ${fechaF} >= '${inicio}' AND ${fechaF} < '${fin}'
            GROUP BY f.customer_code, f.customer_address_code
          )`;

      const cteConsumoAnterior = incluyeOrd
        ? `consumo_anterior AS (
            SELECT customer_code, customer_address_code, SUM(monto) AS monto
            FROM (
              SELECT f.customer_code, f.customer_address_code::text AS customer_address_code, SUM(dd.total) AS monto
              FROM facturas f JOIN detalle_documento dd ON dd.documento_code = f.code
              WHERE ${filtroF} AND dd.codigo_categoria='7' AND f.status IN ${statusF}
                AND ${fechaF} >= '${antInicio}' AND ${fechaF} < '${antFin}'
              GROUP BY f.customer_code, f.customer_address_code
              UNION ALL
              SELECT o.customer_code, o.customer_address_code::text AS customer_address_code, SUM(dd.total)
              FROM ordenes o JOIN detalle_documento dd ON dd.documento_code = o.code
              WHERE ${filtroO} AND dd.codigo_categoria='7' AND o.status IN ${statusO}
                AND ${fechaO} >= '${antInicio}' AND ${fechaO} < '${antFin}'
              GROUP BY o.customer_code, o.customer_address_code
            ) u
            GROUP BY customer_code, customer_address_code
          )`
        : `consumo_anterior AS (
            SELECT f.customer_code, f.customer_address_code::text AS customer_address_code, SUM(dd.total) AS monto
            FROM facturas f JOIN detalle_documento dd ON dd.documento_code = f.code
            WHERE ${filtroF} AND dd.codigo_categoria='7' AND f.status IN ${statusF}
              AND ${fechaF} >= '${antInicio}' AND ${fechaF} < '${antFin}'
            GROUP BY f.customer_code, f.customer_address_code
          )`;

      const cteUltimaCompra = incluyeOrd
        ? `ultima_compra AS (
            SELECT customer_code, customer_address_code, MAX(ultima) AS ultima
            FROM (
              SELECT f.customer_code, f.customer_address_code::text AS customer_address_code, MAX(${fechaF}) AS ultima
              FROM facturas f WHERE ${filtroF} AND f.status IN ${statusF}
              GROUP BY f.customer_code, f.customer_address_code
              UNION ALL
              SELECT o.customer_code, o.customer_address_code::text AS customer_address_code, MAX(${fechaO})
              FROM ordenes o WHERE ${filtroO} AND o.status IN ${statusO}
              GROUP BY o.customer_code, o.customer_address_code
            ) u
            GROUP BY customer_code, customer_address_code
          )`
        : `ultima_compra AS (
            SELECT f.customer_code, f.customer_address_code::text AS customer_address_code, MAX(${fechaF}) AS ultima
            FROM facturas f WHERE ${filtroF} AND f.status IN ${statusF}
            GROUP BY f.customer_code, f.customer_address_code
          )`;

      const sql = `
        WITH ${cteDirActivas},
        ${cteConsumoActual},
        ${cteConsumoAnterior},
        ${cteUltimaCompra}
        SELECT
          da.customer_code,
          da.customer_address_code,
          dc.descripcion_direccion_cliente   AS descripcion_direccion,
          c.nombre_cliente,
          c.identificacion_cliente,
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
          SELECT o.customer_code, o.customer_address_code,
            SUM(dd.cantidad) AS unidades,
            SUM(dd.total)    AS monto
          FROM ordenes o
          JOIN detalle_documento dd ON dd.documento_code = o.code
          WHERE o.type = 2
            AND o.status IN (2, 4, 5)
            AND dd.codigo_categoria = '7'
            AND o.seller_nombre IN (${rutasEsc})
            AND o.fecha_creacion >= '${inicio}' AND o.fecha_creacion < '${fin}'
          GROUP BY o.customer_code, o.customer_address_code
        ),
        consumo_anterior AS (
          SELECT o.customer_code, o.customer_address_code,
            SUM(dd.total) AS monto
          FROM ordenes o
          JOIN detalle_documento dd ON dd.documento_code = o.code
          WHERE o.type = 2
            AND o.status IN (2, 4, 5)
            AND dd.codigo_categoria = '7'
            AND o.seller_nombre IN (${rutasEsc})
            AND o.fecha_creacion >= '${antInicio}' AND o.fecha_creacion < '${antFin}'
          GROUP BY o.customer_code, o.customer_address_code
        ),
        ultima_compra AS (
          SELECT o.customer_code, o.customer_address_code, MAX(o.fecha_creacion) AS ultima
          FROM ordenes o
          WHERE o.type = 2 AND o.status IN (2, 4, 5)
            AND o.seller_nombre IN (${rutasEsc})
          GROUP BY o.customer_code, o.customer_address_code
        )
        SELECT
          cc.customer_code,
          cc.customer_address_code,
          COALESCE(dc.descripcion_direccion_cliente, dc2.descripcion_direccion_cliente) AS descripcion_direccion,
          c.nombre_cliente,
          c.identificacion_cliente,
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
                                          AND ca.customer_address_code IS NOT DISTINCT FROM cc.customer_address_code
        LEFT JOIN consumo_anterior cp     ON cp.customer_code  = cc.customer_code
                                          AND cp.customer_address_code IS NOT DISTINCT FROM cc.customer_address_code
        LEFT JOIN ultima_compra    uc     ON uc.customer_code  = cc.customer_code
                                          AND uc.customer_address_code IS NOT DISTINCT FROM cc.customer_address_code
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
        identificacion_cliente: c.identificacion_cliente || null,
        tipo_negocio          : c.tipo_negocio     || "SIN CLASIFICAR",
        descripcion_direccion : c.descripcion_direccion || null,
        direccion_entrega     : c.direccion_entrega || "—",
        telefono              : c.telefono         || "—",
        latitud               : c.latitud          || null,
        longitud              : c.longitud         || null,
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
      const filtroF      = config.filtroMobilFact;
      const filtroO      = config.filtroMobilOrden;
      const statusF      = config.statusMobilFact;
      const statusO      = config.statusMobilOrden;
      const fechaF       = config.fechaMobilFact;
      const fechaO       = config.fechaMobilOrden;
      const equipoVentas = config.equipoOdoo.replace(/'/g, "''");

      const sqlProdMobilFact = `
        SELECT COALESCE(dd.descripcion, 'SIN DESCRIPCIÓN') AS producto,
               SUM(dd.cantidad) AS unidades_vendidas,
               SUM(dd.total)    AS monto_usd
        FROM facturas f
        JOIN detalle_documento dd ON dd.documento_code = f.code
        WHERE ${filtroF}
          AND dd.codigo_categoria = '7'
          AND f.status IN ${statusF}
          AND ${fechaF} >= '${inicio}' AND ${fechaF} < '${fin}'
        GROUP BY COALESCE(dd.descripcion, 'SIN DESCRIPCIÓN')
      `;
      const sqlProdMobilOrden = config.incluyeOrdenesMobil ? `
        SELECT COALESCE(dd.descripcion, 'SIN DESCRIPCIÓN') AS producto,
               SUM(dd.cantidad) AS unidades_vendidas,
               SUM(dd.total)    AS monto_usd
        FROM ordenes o
        JOIN detalle_documento dd ON dd.documento_code = o.code
        WHERE ${filtroO}
          AND dd.codigo_categoria = '7'
          AND o.status IN ${statusO}
          AND ${fechaO} >= '${inicio}' AND ${fechaO} < '${fin}'
        GROUP BY COALESCE(dd.descripcion, 'SIN DESCRIPCIÓN')
      ` : null;
      const sqlProdOdoo = `
        SELECT COALESCE(dd.descripcion, 'SIN DESCRIPCIÓN') AS producto,
               SUM(dd.cantidad) AS unidades_vendidas,
               SUM(dd.total)    AS monto_usd
        FROM ordenes o
        JOIN detalle_documento dd ON dd.documento_code = o.code
        WHERE o.origen_sistema = 'ODOO'
          AND o.equipo_ventas  = '${equipoVentas}'
          AND o.type = 2 AND o.status IN (2)
          AND dd.codigo_categoria = '7'
          AND o.fecha_creacion >= '${inicio}' AND o.fecha_creacion < '${fin}'
        GROUP BY COALESCE(dd.descripcion, 'SIN DESCRIPCIÓN')
      `;
      const queries = [
        db.query(sqlProdMobilFact, { type: QueryTypes.SELECT }),
        db.query(sqlProdOdoo,      { type: QueryTypes.SELECT }),
      ];
      if (sqlProdMobilOrden) queries.push(db.query(sqlProdMobilOrden, { type: QueryTypes.SELECT }));
      const resultados = await Promise.all(queries);
      // Fusionar por nombre de producto
      const mapaProds = {};
      resultados.flat().forEach((p) => {
        if (!mapaProds[p.producto]) {
          mapaProds[p.producto] = { producto: p.producto, unidades_vendidas: 0, monto_usd: 0 };
        }
        mapaProds[p.producto].unidades_vendidas += Number(p.unidades_vendidas) || 0;
        mapaProds[p.producto].monto_usd         += Number(p.monto_usd) || 0;
      });
      productosVendidos = Object.values(mapaProds).sort((a, b) => b.unidades_vendidas - a.unidades_vendidas);
    } else if (config.usaEmpresasE) {
      // EMPRESAS — 3 fuentes: ODOO equipo='Empresas' + ORDENES E% + FACTURAS E%
      const sqlProdFactE = `
        SELECT COALESCE(dd.descripcion, 'SIN DESCRIPCIÓN') AS producto,
               SUM(dd.cantidad) AS unidades_vendidas,
               SUM(dd.total)    AS monto_usd
        FROM facturas f JOIN detalle_documento dd ON dd.documento_code = f.code
        WHERE f.seller_code LIKE 'E%' AND dd.codigo_categoria = '7'
          AND f.fecha_creacion >= '${inicio}' AND f.fecha_creacion < '${fin}'
        GROUP BY COALESCE(dd.descripcion, 'SIN DESCRIPCIÓN')
      `;
      const sqlProdOrdenE = `
        SELECT COALESCE(dd.descripcion, 'SIN DESCRIPCIÓN') AS producto,
               SUM(dd.cantidad) AS unidades_vendidas,
               SUM(dd.total)    AS monto_usd
        FROM ordenes o JOIN detalle_documento dd ON dd.documento_code = o.code
        WHERE o.seller_code LIKE 'E%' AND dd.codigo_categoria = '7'
          AND o.fecha_creacion >= '${inicio}' AND o.fecha_creacion < '${fin}'
        GROUP BY COALESCE(dd.descripcion, 'SIN DESCRIPCIÓN')
      `;
      const sqlProdOdoo = `
        SELECT COALESCE(dd.descripcion, 'SIN DESCRIPCIÓN') AS producto,
               SUM(dd.cantidad) AS unidades_vendidas,
               SUM(dd.total)    AS monto_usd
        FROM ordenes o JOIN detalle_documento dd ON dd.documento_code = o.code
        WHERE o.origen_sistema = 'ODOO' AND o.equipo_ventas = 'Empresas'
          AND o.type = 2 AND o.status IN (2)
          AND dd.codigo_categoria = '7'
          AND o.fecha_creacion >= '${inicio}' AND o.fecha_creacion < '${fin}'
        GROUP BY COALESCE(dd.descripcion, 'SIN DESCRIPCIÓN')
      `;
      const resultados = await Promise.all([
        db.query(sqlProdFactE,  { type: QueryTypes.SELECT }),
        db.query(sqlProdOrdenE, { type: QueryTypes.SELECT }),
        db.query(sqlProdOdoo,   { type: QueryTypes.SELECT }),
      ]);
      const mapaProds = {};
      resultados.flat().forEach((p) => {
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
          AND o.status IN (2)
          AND dd.codigo_categoria = '7'
          AND o.fecha_creacion >= '${inicio}' AND o.fecha_creacion < '${fin}'
        GROUP BY COALESCE(dd.descripcion, 'SIN DESCRIPCIÓN')
        ORDER BY unidades_vendidas DESC
      `;
      productosVendidos = await db.query(sqlProd, { type: QueryTypes.SELECT });
    } else if (!config.usaOrdenes) {
      const filtroF    = config.filtro;
      const filtroO    = config.filtroOrden;
      const statusF    = config.statusFact   || "('0','2','4','5')";
      const statusO    = config.statusOrden  || "('0','2','4','5')";
      const fechaF     = config.fechaFact    || "f.fecha_entrega";
      const fechaO     = config.fechaOrden   || "o.fecha_entrega";
      const incluyeOrd = !!config.incluyeOrdenes;

      const sqlProdFact = `
        SELECT COALESCE(dd.descripcion, 'SIN DESCRIPCIÓN') AS producto,
               SUM(dd.cantidad) AS unidades_vendidas,
               SUM(dd.total)    AS monto_usd
        FROM facturas f
        JOIN detalle_documento dd ON dd.documento_code = f.code
        WHERE ${filtroF}
          AND dd.codigo_categoria = '7'
          AND f.status IN ${statusF}
          AND ${fechaF} >= '${inicio}' AND ${fechaF} < '${fin}'
        GROUP BY COALESCE(dd.descripcion, 'SIN DESCRIPCIÓN')
      `;
      const sqlProdOrden = incluyeOrd ? `
        SELECT COALESCE(dd.descripcion, 'SIN DESCRIPCIÓN') AS producto,
               SUM(dd.cantidad) AS unidades_vendidas,
               SUM(dd.total)    AS monto_usd
        FROM ordenes o
        JOIN detalle_documento dd ON dd.documento_code = o.code
        WHERE ${filtroO}
          AND dd.codigo_categoria = '7'
          AND o.status IN ${statusO}
          AND ${fechaO} >= '${inicio}' AND ${fechaO} < '${fin}'
        GROUP BY COALESCE(dd.descripcion, 'SIN DESCRIPCIÓN')
      ` : null;

      const queries = [db.query(sqlProdFact, { type: QueryTypes.SELECT })];
      if (sqlProdOrden) queries.push(db.query(sqlProdOrden, { type: QueryTypes.SELECT }));
      const resultados = await Promise.all(queries);
      const mapaProds = {};
      resultados.flat().forEach((p) => {
        if (!mapaProds[p.producto]) {
          mapaProds[p.producto] = { producto: p.producto, unidades_vendidas: 0, monto_usd: 0 };
        }
        mapaProds[p.producto].unidades_vendidas += Number(p.unidades_vendidas) || 0;
        mapaProds[p.producto].monto_usd         += Number(p.monto_usd) || 0;
      });
      productosVendidos = Object.values(mapaProds).sort((a, b) => b.unidades_vendidas - a.unidades_vendidas);
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

    // ── Totales "oficiales" que cuadran con el ranking principal ──────────
    // Para EMPRESAS se replica EXACTAMENTE obtenerOdooDescartablePorCanal
    // (ROUND per customer_code + ::bigint per customer_code + UNION ALL 3 fuentes).
    let totalesCanal = {
      unidades: Number(clientesEnriquecidos.reduce((a, c) => a + c.unidades_actual, 0).toFixed(2)),
      dolares : Number(totalConsumo.toFixed(2)),
    };
    if (config.usaEmpresasE) {
      const sqlTotales = `
        SELECT
          COALESCE(SUM(unidades_por_cliente), 0) AS unidades,
          COALESCE(SUM(dolares_por_cliente),  0) AS dolares
        FROM (
          -- ① ODOO equipo_ventas='Empresas'
          SELECT
            COALESCE(SUM(dd.cantidad), 0)::bigint AS unidades_por_cliente,
            ROUND(SUM(dd.total)::NUMERIC, 2)      AS dolares_por_cliente
          FROM ordenes o JOIN detalle_documento dd ON dd.documento_code = o.code
          WHERE o.origen_sistema = 'ODOO' AND o.equipo_ventas = 'Empresas'
            AND o.type = 2 AND o.status IN (2)
            AND dd.codigo_categoria = '7'
            AND o.fecha_creacion >= '${inicio}' AND o.fecha_creacion < '${fin}'
          GROUP BY o.equipo_ventas, o.customer_code
          UNION ALL
          -- ② Órdenes seller_code LIKE 'E%'
          SELECT
            COALESCE(SUM(dd.cantidad), 0)::bigint,
            ROUND(SUM(dd.total)::NUMERIC, 2)
          FROM ordenes o JOIN detalle_documento dd ON dd.documento_code = o.code
          WHERE o.seller_code LIKE 'E%' AND dd.codigo_categoria = '7'
            AND o.fecha_creacion >= '${inicio}' AND o.fecha_creacion < '${fin}'
          GROUP BY o.customer_code
          UNION ALL
          -- ③ Facturas seller_code LIKE 'E%'
          SELECT
            COALESCE(SUM(dd.cantidad), 0)::bigint,
            ROUND(SUM(dd.total)::NUMERIC, 2)
          FROM facturas f JOIN detalle_documento dd ON dd.documento_code = f.code
          WHERE f.seller_code LIKE 'E%' AND dd.codigo_categoria = '7'
            AND f.fecha_creacion >= '${inicio}' AND f.fecha_creacion < '${fin}'
          GROUP BY f.customer_code
        ) sub
      `;
      const [row] = await db.query(sqlTotales, { type: QueryTypes.SELECT });
      totalesCanal = {
        unidades: Number(row?.unidades ?? 0),
        dolares : Number(Number(row?.dolares ?? 0).toFixed(2)),
      };
    }

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
      totalesCanal,
      clientes        : clientesEnriquecidos,
      productosVendidos: dedupeProductosVendidos(productosVendidos),
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
    // - Canal EMPRESAS E% (config.usaEmpresasE): facturas + ordenes seller_code LIKE 'E%'
    // - Canal combinado (config.usaCombinado): depende del param fuente
    // - Canal EMPRESAS legacy (config.usaOrdenes): ordenes con seller_nombre
    // - Resto: facturas
    const esOdoo      = config.usaOdoo || fuente === "odoo";
    const esEmpresasE = !!config.usaEmpresasE;
    const esEmpresas  = !!config.usaOrdenes;

    if (esEmpresasE) {
      // EMPRESAS — 3 fuentes: FACTURAS E% + ORDENES E% + ORDENES ODOO equipo='Empresas'
      const addrClauseF = addrEsc ? `AND f.customer_address_code = '${addrEsc}'` : "";
      const addrClauseO = addrEsc ? `AND o.customer_address_code::text = '${addrEsc}'` : "";
      const sqlFactE = `
        SELECT COALESCE(dd.descripcion, 'SIN DESCRIPCIÓN') AS producto,
               SUM(dd.cantidad) AS unidades_vendidas,
               SUM(dd.total)    AS monto_usd
        FROM facturas f JOIN detalle_documento dd ON dd.documento_code = f.code
        WHERE f.seller_code LIKE 'E%' AND dd.codigo_categoria = '7'
          AND f.customer_code = '${codEsc}' ${addrClauseF}
          AND f.fecha_creacion >= '${inicio}' AND f.fecha_creacion < '${fin}'
        GROUP BY COALESCE(dd.descripcion, 'SIN DESCRIPCIÓN')
      `;
      const sqlOrdenE = `
        SELECT COALESCE(dd.descripcion, 'SIN DESCRIPCIÓN') AS producto,
               SUM(dd.cantidad) AS unidades_vendidas,
               SUM(dd.total)    AS monto_usd
        FROM ordenes o JOIN detalle_documento dd ON dd.documento_code = o.code
        WHERE o.seller_code LIKE 'E%' AND dd.codigo_categoria = '7'
          AND o.customer_code = '${codEsc}' ${addrClauseO}
          AND o.fecha_creacion >= '${inicio}' AND o.fecha_creacion < '${fin}'
        GROUP BY COALESCE(dd.descripcion, 'SIN DESCRIPCIÓN')
      `;
      const sqlOrdenOdoo = `
        SELECT COALESCE(dd.descripcion, 'SIN DESCRIPCIÓN') AS producto,
               SUM(dd.cantidad) AS unidades_vendidas,
               SUM(dd.total)    AS monto_usd
        FROM ordenes o JOIN detalle_documento dd ON dd.documento_code = o.code
        WHERE o.origen_sistema = 'ODOO' AND o.equipo_ventas = 'Empresas'
          AND o.type = 2 AND o.status IN (2)
          AND dd.codigo_categoria = '7'
          AND o.customer_code = '${codEsc}' ${addrClauseO}
          AND o.fecha_creacion >= '${inicio}' AND o.fecha_creacion < '${fin}'
        GROUP BY COALESCE(dd.descripcion, 'SIN DESCRIPCIÓN')
      `;
      const resultados = await Promise.all([
        db.query(sqlFactE,     { type: QueryTypes.SELECT }),
        db.query(sqlOrdenE,    { type: QueryTypes.SELECT }),
        db.query(sqlOrdenOdoo, { type: QueryTypes.SELECT }),
      ]);
      const mapaProds = {};
      resultados.flat().forEach((p) => {
        if (!mapaProds[p.producto]) {
          mapaProds[p.producto] = { producto: p.producto, unidades_vendidas: 0, monto_usd: 0 };
        }
        mapaProds[p.producto].unidades_vendidas += Number(p.unidades_vendidas) || 0;
        mapaProds[p.producto].monto_usd         += Number(p.monto_usd) || 0;
      });
      productos = Object.values(mapaProds).sort((a, b) => b.unidades_vendidas - a.unidades_vendidas);
    } else if (esOdoo) {
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
          AND o.type = 2 AND o.status IN (2)
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
      // Mobilvendor: facturas (+ órdenes si aplica) por customer_code + customer_address_code
      const filtroF = config.filtroMobilFact || config.filtro || "1=1";
      const filtroO = config.filtroMobilOrden || config.filtroOrden;
      const statusF = config.statusMobilFact || config.statusFact || "('0','2','4','5')";
      const statusO = config.statusMobilOrden || config.statusOrden || "('0','2','4','5')";
      const fechaF  = config.fechaMobilFact  || config.fechaFact  || "f.fecha_entrega";
      const fechaO  = config.fechaMobilOrden || config.fechaOrden || "o.fecha_entrega";
      const incluyeOrd = !!(config.incluyeOrdenesMobil || config.incluyeOrdenes);

      const sqlFact = `
        SELECT COALESCE(dd.descripcion, 'SIN DESCRIPCIÓN') AS producto,
               SUM(dd.cantidad) AS unidades_vendidas,
               SUM(dd.total)    AS monto_usd
        FROM facturas f
        JOIN detalle_documento dd ON dd.documento_code = f.code
        WHERE ${filtroF}
          AND f.customer_code         = '${codEsc}'
          AND f.customer_address_code = '${addrEsc}'
          AND dd.codigo_categoria = '7'
          AND f.status IN ${statusF}
          AND ${fechaF} >= '${inicio}' AND ${fechaF} < '${fin}'
        GROUP BY COALESCE(dd.descripcion, 'SIN DESCRIPCIÓN')
      `;
      const sqlOrden = (incluyeOrd && filtroO) ? `
        SELECT COALESCE(dd.descripcion, 'SIN DESCRIPCIÓN') AS producto,
               SUM(dd.cantidad) AS unidades_vendidas,
               SUM(dd.total)    AS monto_usd
        FROM ordenes o
        JOIN detalle_documento dd ON dd.documento_code = o.code
        WHERE ${filtroO}
          AND o.customer_code         = '${codEsc}'
          AND o.customer_address_code = '${addrEsc}'
          AND dd.codigo_categoria = '7'
          AND o.status IN ${statusO}
          AND ${fechaO} >= '${inicio}' AND ${fechaO} < '${fin}'
        GROUP BY COALESCE(dd.descripcion, 'SIN DESCRIPCIÓN')
      ` : null;

      const queries = [db.query(sqlFact, { type: QueryTypes.SELECT })];
      if (sqlOrden) queries.push(db.query(sqlOrden, { type: QueryTypes.SELECT }));
      const resultados = await Promise.all(queries);
      const mapaProds = {};
      resultados.flat().forEach((p) => {
        if (!mapaProds[p.producto]) {
          mapaProds[p.producto] = { producto: p.producto, unidades_vendidas: 0, monto_usd: 0 };
        }
        mapaProds[p.producto].unidades_vendidas += Number(p.unidades_vendidas) || 0;
        mapaProds[p.producto].monto_usd         += Number(p.monto_usd) || 0;
      });
      productos = Object.values(mapaProds).sort((a, b) => b.unidades_vendidas - a.unidades_vendidas);
    }

    return res.json({
      ok: true,
      productos: dedupeProductosVendidos(productos).map(p => ({
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
