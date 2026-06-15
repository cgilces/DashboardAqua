const db = require("../../db");
const Sequelize = require("sequelize");
const { dedupeProductosVendidos } = require("../../utils/dedupeProductos");

/* ========================================================
   🧩 HELPERS
======================================================== */

// Filtro por tipo de producto (líquido / envase / todo)
function normalizarTipoProducto(raw) {
  const v = String(raw || "").toLowerCase().trim();
  if (v === "liquido" || v === "líquido") return "liquido";
  if (v === "envase") return "envase";
  return "todo";
}

// Fragmento SQL para filas con dd.descripcion_categoria = 'BOTELLÓN'
function buildFiltroProductoBotellon(tipoProducto, alias = "dd") {
  if (tipoProducto === "liquido")
    return ` AND ${alias}.descripcion NOT ILIKE '%ENVASE%' AND ${alias}.descripcion NOT ILIKE '%PET%' `;
  if (tipoProducto === "envase")
    return ` AND (${alias}.descripcion ILIKE '%ENVASE%' OR ${alias}.descripcion ILIKE '%PET%') `;
  return "";
}

// Reemplazo del predicado IN ('BOTELLÓN','SUSCRIPCION') con el filtro aplicado.
// SUSCRIPCION es 100% líquido → se incluye en liquido/todo y se excluye en envase.
function buildFiltroBotellonOSuscripcion(tipoProducto, alias = "dd") {
  if (tipoProducto === "liquido")
    return `((${alias}.descripcion_categoria = 'BOTELLÓN' AND ${alias}.descripcion NOT ILIKE '%ENVASE%' AND ${alias}.descripcion NOT ILIKE '%PET%') OR ${alias}.descripcion_categoria = 'SUSCRIPCION')`;
  if (tipoProducto === "envase")
    return `(${alias}.descripcion_categoria = 'BOTELLÓN' AND (${alias}.descripcion ILIKE '%ENVASE%' OR ${alias}.descripcion ILIKE '%PET%'))`;
  return `${alias}.descripcion_categoria IN ('BOTELLÓN', 'SUSCRIPCION')`;
}

// Formatear fecha YYYY-MM-DD
function formatFecha(fecha) {
  if (!fecha) return null;
  const d = new Date(fecha);
  if (isNaN(d.getTime())) return null;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
}

// Rango seguro UTC para PostgreSQL (MES ACTUAL)
function obtenerRangoFechasPG(anio, mes) {
  const inicio = new Date(Date.UTC(anio, mes - 1, 1));
  const fin = new Date(Date.UTC(anio, mes, 1));

  return {
    fInicio: inicio.toISOString().replace("T", " ").substring(0, 19),
    fFin: fin.toISOString().replace("T", " ").substring(0, 19),
  };
}

// 🔹 RANGO MES ANTERIOR REAL
function obtenerRangoMesAnterior(anio, mes) {
  const fecha = new Date(Date.UTC(anio, mes - 2, 1));
  const inicio = new Date(Date.UTC(fecha.getFullYear(), fecha.getMonth(), 1));
  const fin = new Date(Date.UTC(fecha.getFullYear(), fecha.getMonth() + 1, 1));

  return {
    inicio: inicio.toISOString().replace("T", " ").substring(0, 19),
    fin: fin.toISOString().replace("T", " ").substring(0, 19),
  };
}

/* ========================================================
    CONTROLADOR BOTELLÓN
======================================================== */

const obtenerDetalleRuta = async (req, res) => {
  console.log("▶️ [detalleBotellon] Params:", req.params);

  try {
    const { ruta, anio, mes } = req.params;
    const tipoProducto = normalizarTipoProducto(req.query.tipoProducto);

    if (!ruta || !anio || !mes) {
      return res.status(400).json({ error: "Debe enviar /ruta/anio/mes" });
    }

    const anioNum = parseInt(anio);
    const mesNum = parseInt(mes);

    if (isNaN(anioNum) || isNaN(mesNum) || mesNum < 1 || mesNum > 12) {
      return res.status(400).json({ error: "Mes o año inválido" });
    }

    const { fInicio, fFin } = obtenerRangoFechasPG(anioNum, mesNum);
    const { inicio: antInicio, fin: antFin } = obtenerRangoMesAnterior(anioNum, mesNum);

    const rutaUpper = ruta.trim().toUpperCase();

    const filtroDD = buildFiltroProductoBotellon(tipoProducto, "dd");
    const filtroBotellonOSusc = buildFiltroBotellonOSuscripcion(tipoProducto, "dd");

    /* ========================================================
        CLIENTES ASIGNADOS A LA RUTA
    ======================================================== */

    const clientesRutaSQL = `
                      SELECT DISTINCT
                              cuv.codigo_cliente,
                              cv.nombre_cliente,
                              cv.codigo_tipo_negocio,
                              tn.descripcion AS tipo_negocio,
                              dc.codigo_direccion_cliente,
                              dc.calle1_direccion_cliente AS direccion_cliente,
                              dc.telefono_direccion_cliente,
                              dc.latitud_direccion_cliente,
                              dc.longitud_direccion_cliente,
                              cuv.seller_code
                          FROM public.clientes_usuarios_ventas cuv
                          LEFT JOIN public.clientes cv 
                              ON cv.codigo_cliente = cuv.codigo_cliente
                          LEFT JOIN public.tipos_negocio tn
                              ON tn.codigo = cv.codigo_tipo_negocio
                          LEFT JOIN public.direcciones_clientes dc 
                              ON dc.codigo_cliente = cv.codigo_cliente
                          WHERE UPPER(TRIM(cuv.seller_code)) = :ruta
                          ORDER BY cv.nombre_cliente;

                        `;

    const clientesRuta = await db.query(clientesRutaSQL, {
      replacements: { ruta },  // 'ruta' es el parámetro que se pasa a la consulta
      type: db.QueryTypes.SELECT,
    });





    /* ========================================================
       2️⃣ CLIENTES CON CONSUMO EN EL MES ACTUAL
    ======================================================== */

    const clientesConConsumoSQL = `
  SELECT DISTINCT customer_code
  FROM (

      -- FACTURAS
      SELECT f.customer_code
      FROM facturas f
      JOIN detalle_documento dd
        ON dd.documento_code = f.code
      WHERE UPPER(TRIM(f.seller_code)) = :ruta
        AND f.status = 2
        AND ${filtroBotellonOSusc}
        AND f.fecha_creacion >= :inicio
        AND f.fecha_creacion <  :fin

      UNION

      -- ORDENES
      SELECT o.customer_code
      FROM ordenes o
      JOIN detalle_documento dd
        ON dd.documento_code = o.code
      WHERE UPPER(TRIM(o.seller_code)) = :ruta
        AND o.status = 2
        AND dd.descripcion_categoria = 'BOTELLÓN'
        ${filtroDD}
        AND o.fecha_creacion >= :inicio
        AND o.fecha_creacion <  :fin

  ) AS movimientos
`;

    const clientesConConsumoRows = await db.query(clientesConConsumoSQL, {
      replacements: {
        ruta: rutaUpper,
        inicio: fInicio,
        fin: fFin
      },
      type: db.QueryTypes.SELECT,
    });

    const clientesConConsumo = new Set(
      clientesConConsumoRows.map((c) => c.customer_code)
    );

    /* ========================================================
       3️⃣ CONSUMO ACTUAL VS MES ANTERIOR REAL  (por sucursal)
       Agrupado por customer_address_code RAW. Se incluyen
       facturas + órdenes de TODOS los orígenes (MOBILVENDOR y ODOO),
       comparando seller_code normalizado (UPPER+TRIM).
    ======================================================== */
    const consumoSQL = `
SELECT
    mov.customer_code,
    mov.customer_address_code,
    SUM(
        CASE
            WHEN mov.fecha_creacion >= :inicio
             AND mov.fecha_creacion <  :fin
            THEN mov.total ELSE 0
        END
    ) AS consumo_actual,
    SUM(
        CASE
            WHEN mov.fecha_creacion >= :antInicio
             AND mov.fecha_creacion <  :antFin
            THEN mov.total ELSE 0
        END
    ) AS consumo_anterior
FROM (

    SELECT f.customer_code,
           f.customer_address_code::text AS customer_address_code,
           f.fecha_creacion,
           dd.total
    FROM facturas f
    JOIN detalle_documento dd ON dd.documento_code = f.code
    WHERE UPPER(TRIM(f.seller_code)) = :ruta
      AND f.status = 2
      AND ${filtroBotellonOSusc}

    UNION ALL

    SELECT o.customer_code,
           o.customer_address_code::text AS customer_address_code,
           o.fecha_creacion,
           dd.total
    FROM ordenes o
    JOIN detalle_documento dd ON dd.documento_code = o.code
    WHERE UPPER(TRIM(o.seller_code)) = :ruta
      AND o.status = 2
      AND dd.descripcion_categoria = 'BOTELLÓN'
      ${filtroDD}

) mov
GROUP BY mov.customer_code, mov.customer_address_code
`;

    const consumoData = await db.query(consumoSQL, {
      replacements: {
        ruta: rutaUpper,
        inicio: fInicio,
        fin: fFin,
        antInicio,
        antFin,
      },
      type: db.QueryTypes.SELECT,
    });



    /* ========================================================
    CONSUMO MÁXIMO ANUAL BOTELLÓN
======================================================== */

    const fechaInicioAnio = `${anioNum}-01-01 00:00:00`;
    const fechaFinAnio = `${anioNum + 1}-01-01 00:00:00`;

    const consumoMaximoAnualSQL = `
WITH movimientos AS (

    SELECT f.customer_code, f.fecha_creacion, dd.total
    FROM facturas f
    JOIN detalle_documento dd ON dd.documento_code = f.code
    WHERE f.seller_code = :ruta
      AND f.status = 2
      AND ${filtroBotellonOSusc}
      AND f.fecha_creacion >= :inicioAnio
      AND f.fecha_creacion <  :finAnio

    UNION ALL

    SELECT o.customer_code, o.fecha_creacion, dd.total
    FROM ordenes o
    JOIN detalle_documento dd ON dd.documento_code = o.code
    WHERE o.seller_code = :ruta
      AND o.status = 2
      AND o.origen_sistema = 'MOBILVENDOR'
      AND dd.descripcion_categoria = 'BOTELLÓN'
      ${filtroDD}
      AND o.fecha_creacion >= :inicioAnio
      AND o.fecha_creacion <  :finAnio
),

consumo_mensual AS (
    SELECT
        customer_code,
        DATE_TRUNC('month', fecha_creacion) AS mes,
        SUM(total) AS consumo_mes
    FROM movimientos
    GROUP BY customer_code, DATE_TRUNC('month', fecha_creacion)
)

SELECT DISTINCT ON (customer_code)
    customer_code,
    consumo_mes,
    mes
FROM consumo_mensual
ORDER BY customer_code, consumo_mes DESC
`;

    const consumoMaximoAnual = await db.query(consumoMaximoAnualSQL, {
      replacements: {
        ruta: rutaUpper,
        inicioAnio: fechaInicioAnio,
        finAnio: fechaFinAnio,
      },
      type: db.QueryTypes.SELECT,
    });

    const mapMaxConsumoAnual = new Map(
      consumoMaximoAnual.map(c => [
        c.customer_code,
        {
          monto: Number(c.consumo_mes) || 0,
          mes: c.mes
        }
      ])
    );

    const meses = [
      "Enero", "Febrero", "Marzo", "Abril",
      "Mayo", "Junio", "Julio", "Agosto",
      "Septiembre", "Octubre", "Noviembre", "Diciembre"
    ];








    /* ========================================================
       4️ PRODUCTOS VENDIDOS
       (Mismos filtros que la tabla principal de botellonesController:
        status = 2, descripcion_categoria = 'BOTELLÓN',
        ordenes MOBILVENDOR, rango por fecha_creacion)
    ======================================================== */
    const productosVendidosSQL = `
SELECT
    mov.descripcion AS producto,
    SUM(mov.cantidad) AS unidades_vendidas,
    SUM(mov.total)    AS monto_usd
FROM (

    /* ===== ORDENES ===== */
    SELECT dd.descripcion, dd.cantidad, dd.total
    FROM ordenes o
    JOIN detalle_documento dd ON dd.documento_code = o.code
    WHERE o.seller_code = :ruta
      AND o.status = 2
      AND o.origen_sistema = 'MOBILVENDOR'
      AND dd.descripcion_categoria = 'BOTELLÓN'
      ${filtroDD}
      AND o.fecha_creacion >= :inicio
      AND o.fecha_creacion <  :fin

    UNION ALL

    /* ===== FACTURAS ===== */
    SELECT dd.descripcion, dd.cantidad, dd.total
    FROM facturas f
    JOIN detalle_documento dd ON dd.documento_code = f.code
    WHERE f.seller_code = :ruta
      AND f.status = 2
      AND ${filtroBotellonOSusc}
      AND f.fecha_creacion >= :inicio
      AND f.fecha_creacion <  :fin

) mov
GROUP BY mov.descripcion
ORDER BY unidades_vendidas DESC
`;

    const productosVendidos = await db.query(productosVendidosSQL, {
      replacements: { ruta: rutaUpper, inicio: fInicio, fin: fFin },
      type: db.QueryTypes.SELECT,
    });

    /* ========================================================
       5️⃣ CANTIDAD BOTELLONES POR SUCURSAL (raw customer_address_code)
    ======================================================== */
    const cantidadPorClienteSQL = `
SELECT
    mov.customer_code,
    mov.customer_address_code,
    SUM(mov.cantidad) AS unidades_botellon
FROM (

    SELECT f.customer_code,
           f.customer_address_code::text AS customer_address_code,
           dd.cantidad,
           f.fecha_creacion
    FROM facturas f
    JOIN detalle_documento dd ON dd.documento_code = f.code
    WHERE f.seller_code = :ruta
      AND f.status = 2
      AND ${filtroBotellonOSusc}

    UNION ALL

    SELECT o.customer_code,
           o.customer_address_code::text AS customer_address_code,
           dd.cantidad,
           o.fecha_creacion
    FROM ordenes o
    JOIN detalle_documento dd ON dd.documento_code = o.code
    WHERE o.seller_code = :ruta
      AND o.status = 2
      AND o.origen_sistema = 'MOBILVENDOR'
      AND dd.descripcion_categoria = 'BOTELLÓN'
      ${filtroDD}

) mov
WHERE mov.fecha_creacion >= :inicio
  AND mov.fecha_creacion <  :fin
GROUP BY mov.customer_code, mov.customer_address_code
`;

    const cantidadPorCliente = await db.query(cantidadPorClienteSQL, {
      replacements: { ruta: rutaUpper, inicio: fInicio, fin: fFin },
      type: db.QueryTypes.SELECT,
    });

    /* ========================================================
       RESOLUCIÓN POR CLIENTE → SUCURSAL
       Estrategia:
        - Cliente con sucursales en direcciones_clientes → 1 fila por sucursal.
        - Ventas con customer_address_code que no resuelve a ninguna
          sucursal se acumulan en la sucursal de MAYOR consumo del
          cliente (la "principal"), evitando filas duplicadas.
        - Cliente sin direcciones registradas → 1 fila con placeholder.
    ======================================================== */

    const clientesAsignados = clientesRuta.map((c) => c.codigo_cliente);
    const clientesConVentas = Array.from(
      new Set([
        ...consumoData.map((c) => c.customer_code),
        ...cantidadPorCliente.map((c) => c.customer_code),
      ])
    ).filter(Boolean);
    const clientesRelevantes = Array.from(
      new Set([...clientesAsignados, ...clientesConVentas])
    );

    // Direcciones de TODOS los clientes relevantes (asignados + con ventas).
    let direccionesTodas = [];
    if (clientesRelevantes.length > 0) {
      direccionesTodas = await db.query(
        `SELECT codigo_cliente,
                codigo_direccion_cliente,
                id_direccion_cliente::text AS id_direccion_cliente,
                descripcion_direccion_cliente,
                calle1_direccion_cliente,
                telefono_direccion_cliente,
                latitud_direccion_cliente,
                longitud_direccion_cliente
           FROM direcciones_clientes
          WHERE codigo_cliente IN (:codigos)
          ORDER BY codigo_cliente, id_direccion_cliente`,
        {
          replacements: { codigos: clientesRelevantes },
          type: db.QueryTypes.SELECT,
        }
      );
    }

    // Info básica de clientes con ventas pero SIN asignación en cuv.
    const clientesNoAsignados = clientesRelevantes.filter(
      (c) => !clientesAsignados.includes(c)
    );
    let infoClientesNoAsignados = [];
    if (clientesNoAsignados.length > 0) {
      infoClientesNoAsignados = await db.query(
        `SELECT cv.codigo_cliente,
                cv.nombre_cliente,
                cv.codigo_tipo_negocio,
                tn.descripcion AS tipo_negocio
           FROM clientes cv
           LEFT JOIN tipos_negocio tn ON tn.codigo = cv.codigo_tipo_negocio
          WHERE cv.codigo_cliente IN (:codigos)`,
        {
          replacements: { codigos: clientesNoAsignados },
          type: db.QueryTypes.SELECT,
        }
      );
    }
    const mapInfoExtra = new Map(
      infoClientesNoAsignados.map((c) => [c.codigo_cliente, c])
    );

    // Agrupar direcciones por cliente + índice de lookup (codigo / id).
    const direccionesPorCliente = new Map();
    const indiceDirPorCliente = new Map();
    for (const d of direccionesTodas) {
      if (!direccionesPorCliente.has(d.codigo_cliente)) {
        direccionesPorCliente.set(d.codigo_cliente, []);
        indiceDirPorCliente.set(d.codigo_cliente, {
          byCodigo: new Map(),
          byId: new Map(),
        });
      }
      direccionesPorCliente.get(d.codigo_cliente).push(d);
      const idx = indiceDirPorCliente.get(d.codigo_cliente);
      if (d.codigo_direccion_cliente != null) {
        idx.byCodigo.set(String(d.codigo_direccion_cliente).trim(), d);
      }
      if (d.id_direccion_cliente != null) {
        idx.byId.set(String(d.id_direccion_cliente).trim(), d);
      }
    }

    const resolverCodigoDir = (cli, addrCode) => {
      if (addrCode == null) return null;
      const key = String(addrCode).trim();
      const idx = indiceDirPorCliente.get(cli);
      if (!idx) return null;
      return (
        idx.byCodigo.get(key)?.codigo_direccion_cliente ||
        idx.byId.get(key)?.codigo_direccion_cliente ||
        null
      );
    };

    const claveCliDir = (cli, dir) => `${cli ?? ""}__${dir ?? ""}`;

    // Acumular consumo por sucursal resuelta y huérfanos por cliente.
    const consumoPorSucursal = new Map();
    const cantidadPorSucursal = new Map();
    const orphansPorCliente = new Map();

    const initOrphan = () => ({
      consumo_actual: 0,
      consumo_anterior: 0,
      cantidad: 0,
    });

    for (const r of consumoData) {
      const codigoDir = resolverCodigoDir(r.customer_code, r.customer_address_code);
      const actual = Number(r.consumo_actual) || 0;
      const anterior = Number(r.consumo_anterior) || 0;
      if (codigoDir) {
        const k = claveCliDir(r.customer_code, codigoDir);
        const prev = consumoPorSucursal.get(k) || { consumo_actual: 0, consumo_anterior: 0 };
        prev.consumo_actual += actual;
        prev.consumo_anterior += anterior;
        consumoPorSucursal.set(k, prev);
      } else {
        const prev = orphansPorCliente.get(r.customer_code) || initOrphan();
        prev.consumo_actual += actual;
        prev.consumo_anterior += anterior;
        orphansPorCliente.set(r.customer_code, prev);
      }
    }

    for (const r of cantidadPorCliente) {
      const codigoDir = resolverCodigoDir(r.customer_code, r.customer_address_code);
      const cant = Number(r.unidades_botellon) || 0;
      if (codigoDir) {
        const k = claveCliDir(r.customer_code, codigoDir);
        cantidadPorSucursal.set(k, (cantidadPorSucursal.get(k) || 0) + cant);
      } else {
        const prev = orphansPorCliente.get(r.customer_code) || initOrphan();
        prev.cantidad += cant;
        orphansPorCliente.set(r.customer_code, prev);
      }
    }

    /* ----------------------------------------------------------
       FUSIÓN DE CLIENTES DUPLICADOS POR NOMBRE
       Un cliente con ventas pero SIN sucursales en direcciones_clientes
       que tenga exactamente el mismo nombre que otro cliente CON
       sucursales se considera un "phantom": sus ventas se redirigen
       al cliente principal (la sucursal de mayor consumo).
    ---------------------------------------------------------- */
    const norm = (s) =>
      String(s || "").trim().toUpperCase().replace(/\s+/g, " ");

    const nombreToPrincipal = new Map();
    for (const cli of clientesRelevantes) {
      const sucs = direccionesPorCliente.get(cli) || [];
      if (sucs.length === 0) continue;
      const asig = clientesRuta.find((c) => c.codigo_cliente === cli);
      const huerf = mapInfoExtra.get(cli);
      const nombre = norm(asig?.nombre_cliente || huerf?.nombre_cliente);
      if (!nombre) continue;
      if (!nombreToPrincipal.has(nombre)) {
        nombreToPrincipal.set(nombre, cli);
      } else {
        // Nombre ambiguo (>1 cliente con sucursales): marcamos null para NO fusionar.
        nombreToPrincipal.set(nombre, null);
      }
    }

    const phantomRedirect = new Map();
    for (const cli of clientesRelevantes) {
      const sucs = direccionesPorCliente.get(cli) || [];
      if (sucs.length > 0) continue;
      const asig = clientesRuta.find((c) => c.codigo_cliente === cli);
      const huerf = mapInfoExtra.get(cli);
      const nombre = norm(asig?.nombre_cliente || huerf?.nombre_cliente);
      if (!nombre) continue;
      const principal = nombreToPrincipal.get(nombre);
      if (principal && principal !== cli) {
        phantomRedirect.set(cli, principal);
      }
    }

    // Mover huérfanos del phantom al cliente principal.
    for (const [phantom, principal] of phantomRedirect.entries()) {
      const op = orphansPorCliente.get(phantom);
      if (!op) continue;
      const acc = orphansPorCliente.get(principal) || initOrphan();
      acc.consumo_actual += op.consumo_actual;
      acc.consumo_anterior += op.consumo_anterior;
      acc.cantidad += op.cantidad;
      orphansPorCliente.set(principal, acc);
      orphansPorCliente.delete(phantom);
    }

    // Lista de clientes a renderizar (sin phantoms).
    const clientesARenderizar = clientesRelevantes.filter(
      (c) => !phantomRedirect.has(c)
    );

    // Para cada cliente con huérfanos, elegir la sucursal de mayor consumo_actual.
    const orphanTargetCodigoPorCliente = new Map();
    for (const cli of orphansPorCliente.keys()) {
      const sucursales = direccionesPorCliente.get(cli) || [];
      if (sucursales.length === 0) continue;
      let best = sucursales[0];
      let bestAmount = -1;
      for (const s of sucursales) {
        const k = claveCliDir(cli, s.codigo_direccion_cliente);
        const amt = consumoPorSucursal.get(k)?.consumo_actual || 0;
        if (amt > bestAmount) {
          bestAmount = amt;
          best = s;
        }
      }
      orphanTargetCodigoPorCliente.set(cli, best.codigo_direccion_cliente);
    }

    // Construir lista final (1 fila por sucursal real del cliente).
    const clientesRutaCombinado = [];
    for (const cli of clientesARenderizar) {
      const sucursales = direccionesPorCliente.get(cli) || [];
      const asignado = clientesRuta.find((c) => c.codigo_cliente === cli);
      const huerfano = mapInfoExtra.get(cli);
      const nombre_cliente =
        asignado?.nombre_cliente || huerfano?.nombre_cliente || cli;
      const codigo_tipo_negocio =
        asignado?.codigo_tipo_negocio || huerfano?.codigo_tipo_negocio || null;
      const tipo_negocio =
        asignado?.tipo_negocio || huerfano?.tipo_negocio || "SIN CLASIFICAR";
      const seller_code = asignado?.seller_code || rutaUpper;
      const orphan = orphansPorCliente.get(cli) || initOrphan();
      const orphanTarget = orphanTargetCodigoPorCliente.get(cli);

      if (sucursales.length === 0) {
        clientesRutaCombinado.push({
          codigo_cliente: cli,
          nombre_cliente,
          codigo_tipo_negocio,
          tipo_negocio,
          seller_code,
          codigo_direccion_cliente: null,
          direccion_cliente: "Sin sucursal registrada",
          telefono_direccion_cliente: null,
          latitud_direccion_cliente: null,
          longitud_direccion_cliente: null,
          _consumo_actual: orphan.consumo_actual,
          _consumo_anterior: orphan.consumo_anterior,
          _cantidad: orphan.cantidad,
        });
        continue;
      }

      for (const s of sucursales) {
        const k = claveCliDir(cli, s.codigo_direccion_cliente);
        const cs = consumoPorSucursal.get(k) || { consumo_actual: 0, consumo_anterior: 0 };
        const ct = cantidadPorSucursal.get(k) || 0;
        const isTarget = orphanTarget === s.codigo_direccion_cliente;
        clientesRutaCombinado.push({
          codigo_cliente: cli,
          nombre_cliente,
          codigo_tipo_negocio,
          tipo_negocio,
          seller_code,
          codigo_direccion_cliente: s.codigo_direccion_cliente,
          direccion_cliente:
            s.calle1_direccion_cliente ||
            s.descripcion_direccion_cliente ||
            `Dir. ${s.codigo_direccion_cliente}`,
          telefono_direccion_cliente: s.telefono_direccion_cliente,
          latitud_direccion_cliente: s.latitud_direccion_cliente,
          longitud_direccion_cliente: s.longitud_direccion_cliente,
          _consumo_actual:
            cs.consumo_actual + (isTarget ? orphan.consumo_actual : 0),
          _consumo_anterior:
            cs.consumo_anterior + (isTarget ? orphan.consumo_anterior : 0),
          _cantidad: ct + (isTarget ? orphan.cantidad : 0),
        });
      }
    }

    /* ========================================================
       6️⃣ ÚLTIMA VISITA / FACTURA  (filtradas por seller_code)
    ======================================================== */
    const ultimasVisitas = await db.query(`
SELECT customer_code, MAX(fecha) AS ultima_visita
FROM (
    SELECT customer_code, fecha_entrega AS fecha
    FROM facturas
    WHERE UPPER(TRIM(seller_code)) = :ruta AND status = 2
    UNION ALL
    SELECT customer_code, fecha_entrega AS fecha
    FROM ordenes
    WHERE UPPER(TRIM(seller_code)) = :ruta AND status = 2
) mov
GROUP BY customer_code
`, {
      replacements: { ruta: rutaUpper },
      type: db.QueryTypes.SELECT,
    });

    const ultimasFacturas = await db.query(
      `SELECT customer_code,
              MAX(COALESCE(fecha_autorizacion, fecha_entrega, fecha_creacion)) AS ultima_factura
         FROM facturas
        WHERE UPPER(TRIM(seller_code)) = :ruta AND status = 2
        GROUP BY customer_code;`,
      {
        replacements: { ruta: rutaUpper },
        type: db.QueryTypes.SELECT,
      }
    );

    const mapUltimaVisita = new Map(
      ultimasVisitas.map((v) => [v.customer_code, v.ultima_visita])
    );
    const mapUltimaFactura = new Map(
      ultimasFacturas.map((v) => [v.customer_code, v.ultima_factura])
    );

    /* ========================================================
        ARMADO FINAL
    ======================================================== */
    const clientesRutaFinal = clientesRutaCombinado.map((c) => {
      const actual = Number(c._consumo_actual || 0);
      const anterior = Number(c._consumo_anterior || 0);

      const variacionAbs = actual - anterior;

      let variacionPorc = 0;
      if (anterior > 0) {
        variacionPorc = (variacionAbs / anterior) * 100;
      } else if (actual > 0) {
        variacionPorc = 100;
      }

      const maxData = mapMaxConsumoAnual.get(c.codigo_cliente) || {
        monto: 0,
        mes: null
      };

      const mesNumero = maxData.mes
        ? new Date(maxData.mes).getUTCMonth()
        : null;

      const mesNombre = mesNumero !== null
        ? meses[mesNumero]
        : null;




      return {
        codigo_cliente: c.codigo_cliente,
        nombre_cliente: c.nombre_cliente,
        direccion_cliente: c.direccion_cliente,
        codigo_tipo_negocio: c.codigo_tipo_negocio || null,
        tipo_negocio: c.tipo_negocio || "SIN CLASIFICAR",
        telefono_direccion_cliente: c.telefono_direccion_cliente,
        latitud_direccion_cliente: c.latitud_direccion_cliente,  // Latitud
        longitud_direccion_cliente: c.longitud_direccion_cliente,  // Longitud
        codigo_direccion_cliente: c.codigo_direccion_cliente,  // Código dirección
        ultima_visita: formatFecha(
          mapUltimaVisita.get(c.codigo_cliente)
        ),
        ultima_factura: formatFecha(
          mapUltimaFactura.get(c.codigo_cliente)
        ),

        consumo_actual: actual.toFixed(2),

        max_consumo: maxData.monto.toFixed(2),
        mes_max_consumo: mesNumero !== null ? mesNumero + 1 : null,
        mes_max_consumo_nombre: mesNombre,


        vsMesAnterior: {
          monto_anterior: Number(anterior.toFixed(2)),
          variacion_abs: Number(variacionAbs.toFixed(2)),
          variacion_porc: `${variacionPorc.toFixed(2)}%`,
        },

        tuvo_consumo: (Number(c._cantidad) || 0) > 0 || actual > 0 ? "Sí" : "No",

        cantidad_botellon: Number(c._cantidad || 0),
      };
    });


    // Clientes únicos asignados a la ruta (no filas por sucursal).
    const clientesAsignadosUnicos = Array.from(
      new Set(clientesRuta.map((c) => c.codigo_cliente))
    );
    const totalAsignados = clientesAsignadosUnicos.length;
    const conConsumo = clientesAsignadosUnicos.filter((cli) =>
      clientesConConsumo.has(String(cli).trim())
    ).length;

    return res.json({
      ruta: rutaUpper,
      anio: anioNum,
      mes: mesNum,
      rangoFechas: { inicio: fInicio, fin: fFin },
      resumenClientes: {
        totalClientesRuta: totalAsignados,
        clientesConConsumo: conConsumo,
        clientesSinConsumo: totalAsignados - conConsumo,
      },
      productosVendidos: dedupeProductosVendidos(productosVendidos),
      clientesRuta: clientesRutaFinal,
    });
  } catch (error) {
    console.error("❌ [detalleBotellon] Error:", error);
    return res.status(500).json({
      error: "Error al obtener detalle de ruta botellón",
      detalle: error.message,
    });
  }
};

module.exports = {
  obtenerDetalleRuta,
};