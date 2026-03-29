// controllers/controllerCafe/cafeController.js
// Ventas de CAFÉ — Empresa IIBC S.A.
// Fuente única: facturas Odoo (company_id = 4)

const Sequelize = require("sequelize");
const { sequelize } = require("../../models");
const { getDiasHabilesTranscurridos, getDiasLaborablesMes } = require("../../utils/diasFestivos");

// ================================================================
// HELPERS DE FECHA
// ================================================================
function getFechaInicioMes(anio, mes) {
  return `${anio}-${String(mes).padStart(2, "0")}-01 00:00:00`;
}

function getFechaFinMes(anio, mes) {
  let mesFin = mes + 1, anioFin = anio;
  if (mesFin === 13) { mesFin = 1; anioFin++; }
  return `${anioFin}-${String(mesFin).padStart(2, "0")}-01 00:00:00`;
}

const getFechaFinQuery = (anio, mes) => getFechaFinMes(anio, mes);

// ================================================================
// QUERY TOTALES CAFÉ (solo facturas Odoo company_id=4)
// ================================================================
const queryTotalesCafe = async (inicio, fin) => {
  const [row] = await sequelize.query(
    `SELECT
       SUM(dd.cantidad)                  AS unidades,
       SUM(dd.total)                     AS dolares,
       COUNT(DISTINCT f.code)            AS cant_facturas,
       COUNT(DISTINCT f.customer_code)   AS cant_clientes
     FROM facturas f
     JOIN detalle_documento dd ON dd.documento_code = f.code
     WHERE f.company_id = 4
       AND f.status IN ('2','4','5')
       AND f.fecha_creacion >= :inicio
       AND f.fecha_creacion <  :fin`,
    { replacements: { inicio, fin }, type: Sequelize.QueryTypes.SELECT }
  );
  return {
    unidades:     Number(row?.unidades     || 0),
    dolares:      Number(row?.dolares      || 0),
    cant_facturas:Number(row?.cant_facturas|| 0),
    cant_clientes:Number(row?.cant_clientes|| 0),
  };
};

// ================================================================
// QUERY VENTAS POR RUTA / VENDEDOR
// ================================================================
const queryVentasPorRuta = async (inicio, fin) => {
  return sequelize.query(`
    SELECT
      COALESCE(f.route_code, f.seller_code, 'SIN RUTA') AS ruta,
      SUM(dd.cantidad)                AS unidades,
      SUM(dd.total)                   AS dolares,
      COUNT(DISTINCT f.code)          AS cant_facturas,
      COUNT(DISTINCT f.customer_code) AS cant_clientes
    FROM facturas f
    JOIN detalle_documento dd ON dd.documento_code = f.code
    WHERE f.company_id = 4
      AND f.status IN ('2','4','5')
      AND f.fecha_creacion >= :inicio
      AND f.fecha_creacion <  :fin
    GROUP BY COALESCE(f.route_code, f.seller_code, 'SIN RUTA')
    ORDER BY dolares DESC
  `, { replacements: { inicio, fin }, type: Sequelize.QueryTypes.SELECT });
};

// ================================================================
// TENDENCIA 6 MESES CAFÉ
// ================================================================
const tendencia6MesesCafe = async (anioNum, mesNum) => {
  const NOMBRES = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
  let mesInicio = mesNum - 5, anioInicio = anioNum;
  while (mesInicio <= 0) { mesInicio += 12; anioInicio--; }
  const inicio6 = getFechaInicioMes(anioInicio, mesInicio);
  let mesFin = mesNum + 1, anioFin = anioNum;
  if (mesFin === 13) { mesFin = 1; anioFin++; }
  const fin6 = `${anioFin}-${String(mesFin).padStart(2,'0')}-01 00:00:00`;

  const rows = await sequelize.query(`
    SELECT DATE_TRUNC('month', f.fecha_creacion) AS mes_periodo,
           SUM(dd.total)    AS dolares,
           SUM(dd.cantidad) AS unidades
    FROM facturas f
    JOIN detalle_documento dd ON dd.documento_code = f.code
    WHERE f.company_id = 4
      AND f.status IN ('2','4','5')
      AND f.fecha_creacion >= :inicio6
      AND f.fecha_creacion <  :fin6
    GROUP BY DATE_TRUNC('month', f.fecha_creacion)
    ORDER BY mes_periodo
  `, { replacements: { inicio6, fin6 }, type: Sequelize.QueryTypes.SELECT });

  const hoy = new Date();
  return rows.map(r => {
    const d        = new Date(r.mes_periodo);
    const mes      = d.getMonth() + 1;
    const anio     = d.getFullYear();
    const dolares  = Number(Number(r.dolares  || 0).toFixed(2));
    const unidades = Number(r.unidades || 0);
    const esCurrent = anio === hoy.getFullYear() && mes === hoy.getMonth() + 1;
    const diasT = esCurrent ? getDiasHabilesTranscurridos(anio, mes) : 0;
    const diasL = esCurrent ? getDiasLaborablesMes(anio, mes) : 0;
    const proyeccion = esCurrent && diasT > 0
      ? Number(((dolares / diasT) * diasL).toFixed(2))
      : dolares;
    return { label: NOMBRES[d.getMonth()], anio, mes, dolares, unidades, proyeccion };
  });
};

// ================================================================
// ENDPOINT PRINCIPAL — GET /api/cafe/dashboard?anio=YYYY&mes=MM
// ================================================================
const obtenerDashboardCafe = async (req, res) => {
  try {
    const { anio, mes } = req.query;
    if (!anio || !mes)
      return res.status(400).json({ error: "Debe enviar ?anio=YYYY&mes=MM" });

    const anioNum = parseInt(anio, 10);
    const mesNum  = parseInt(mes,  10);
    if (isNaN(anioNum) || isNaN(mesNum) || mesNum < 1 || mesNum > 12)
      return res.status(400).json({ error: "Parámetros anio/mes inválidos." });

    const hoy = new Date();
    const esMesActual = anioNum === hoy.getFullYear() && mesNum === hoy.getMonth() + 1;

    const inicio     = getFechaInicioMes(anioNum, mesNum);
    const fin        = await getFechaFinQuery(anioNum, mesNum);

    let mesPrev = mesNum - 1, anioPrev = anioNum;
    if (mesPrev === 0) { mesPrev = 12; anioPrev--; }
    const inicioPrev = getFechaInicioMes(anioPrev, mesPrev);
    const finPrev    = getFechaFinMes(anioPrev, mesPrev);

    const diasTranscurridos = getDiasHabilesTranscurridos(anioNum, mesNum);
    const diasLaborablesMes = getDiasLaborablesMes(anioNum, mesNum);

    const [actual, anterior, rutasActual, tendencia6Meses] = await Promise.all([
      queryTotalesCafe(inicio, fin),
      queryTotalesCafe(inicioPrev, finPrev),
      queryVentasPorRuta(inicio, fin),
      tendencia6MesesCafe(anioNum, mesNum),
    ]);

    const proyeccionDolares = esMesActual && diasTranscurridos > 0
      ? (actual.dolares  / diasTranscurridos) * diasLaborablesMes
      : actual.dolares;

    const proyeccionUnidades = esMesActual && diasTranscurridos > 0
      ? (actual.unidades / diasTranscurridos) * diasLaborablesMes
      : actual.unidades;

    const varDolaresAbs  = actual.dolares  - anterior.dolares;
    const varDolaresPorc = anterior.dolares > 0
      ? (varDolaresAbs / anterior.dolares) * 100
      : null;

    const varUnidadesAbs  = actual.unidades  - anterior.unidades;
    const varUnidadesPorc = anterior.unidades > 0
      ? (varUnidadesAbs / anterior.unidades) * 100
      : null;

    const rutas = rutasActual.map(r => ({
      ruta:          r.ruta,
      unidades:      Number(r.unidades)      || 0,
      dolares:       Number(Number(r.dolares).toFixed(2)),
      cant_facturas: Number(r.cant_facturas) || 0,
      cant_clientes: Number(r.cant_clientes) || 0,
    }));

    return res.status(200).json({
      periodo: { anio: anioNum, mes: mesNum, esMesActual },
      fechas:  { inicio, fin, inicioPrev, finPrev },
      dias:    { transcurridos: diasTranscurridos, laborables: diasLaborablesMes },
      totales: {
        unidades:            actual.unidades,
        dolares:             Number(actual.dolares.toFixed(2)),
        proyeccion_unidades: Number(proyeccionUnidades.toFixed(0)),
        proyeccion_dolares:  Number(proyeccionDolares.toFixed(2)),
        cant_facturas:       actual.cant_facturas,
        cant_clientes:       actual.cant_clientes,
        mes_anterior: {
          unidades: anterior.unidades,
          dolares:  Number(anterior.dolares.toFixed(2)),
        },
        variacion_dolares: {
          abs:        Number(varDolaresAbs.toFixed(2)),
          porcentaje: varDolaresPorc !== null ? Number(varDolaresPorc.toFixed(2)) : null,
        },
        variacion_unidades: {
          abs:        Number(varUnidadesAbs.toFixed(0)),
          porcentaje: varUnidadesPorc !== null ? Number(varUnidadesPorc.toFixed(2)) : null,
        },
      },
      rutas,
      tendencia6Meses,
    });

  } catch (error) {
    console.error("❌ ERROR dashboard café:", error);
    return res.status(500).json({ message: "Error al obtener datos café", detalle: error.message });
  }
};

// ================================================================
// ENDPOINT CLIENTES — GET /api/cafe/clientes?anio=YYYY&mes=MM
// ================================================================
const obtenerClientesCafe = async (req, res) => {
  try {
    const { anio, mes } = req.query;
    if (!anio || !mes)
      return res.status(400).json({ error: "Debe enviar ?anio=YYYY&mes=MM" });

    const anioNum = parseInt(anio, 10);
    const mesNum  = parseInt(mes,  10);
    if (isNaN(anioNum) || isNaN(mesNum) || mesNum < 1 || mesNum > 12)
      return res.status(400).json({ error: "Parámetros inválidos" });

    const inicio    = getFechaInicioMes(anioNum, mesNum);
    const fin       = await getFechaFinQuery(anioNum, mesNum);

    let mesPrev = mesNum - 1, anioPrev = anioNum;
    if (mesPrev === 0) { mesPrev = 12; anioPrev--; }
    const antInicio = getFechaInicioMes(anioPrev, mesPrev);
    const antFin    = getFechaFinMes(anioPrev, mesPrev);

    const inicioAnio = `${anioNum}-01-01 00:00:00`;
    const finAnio    = `${anioNum + 1}-01-01 00:00:00`;

    const R = { inicio, fin, antInicio, antFin, inicioAnio, finAnio };

    // ── 1. Clientes únicos del año ────────────────────────────────
    const clientesSQL = `
      SELECT DISTINCT ON (f.customer_code, f.customer_address_code)
        f.customer_code,
        f.customer_address_code,
        c.nombre_cliente,
        tn.descripcion                                              AS tipo_negocio,
        COALESCE(dc.calle1_direccion_cliente, c.direccion_cliente) AS direccion_entrega,
        COALESCE(dc.telefono_direccion_cliente, c.telefono_cliente)AS telefono_cliente,
        dc.latitud_direccion_cliente                               AS latitud_cliente,
        dc.longitud_direccion_cliente                              AS longitud_cliente
      FROM facturas f
      LEFT JOIN clientes c              ON c.codigo_cliente = f.customer_code
      LEFT JOIN tipos_negocio tn        ON tn.codigo = c.codigo_tipo_negocio
      LEFT JOIN direcciones_clientes dc ON dc.codigo_direccion_cliente::TEXT = f.customer_address_code
      WHERE f.company_id = 4
        AND f.status IN ('2','4','5')
        AND f.fecha_creacion >= :inicioAnio
        AND f.fecha_creacion <  :finAnio
      ORDER BY f.customer_code, f.customer_address_code, c.nombre_cliente
    `;

    // ── 2. Consumo actual / anterior ──────────────────────────────
    const consumoSQL = `
      SELECT f.customer_code, f.customer_address_code,
        SUM(CASE WHEN f.fecha_creacion >= :inicio    AND f.fecha_creacion < :fin    THEN dd.total    ELSE 0 END) AS consumo_actual,
        SUM(CASE WHEN f.fecha_creacion >= :antInicio AND f.fecha_creacion < :antFin THEN dd.total    ELSE 0 END) AS consumo_anterior,
        SUM(CASE WHEN f.fecha_creacion >= :inicio    AND f.fecha_creacion < :fin    THEN dd.cantidad ELSE 0 END) AS cantidad_actual
      FROM facturas f
      JOIN detalle_documento dd ON dd.documento_code = f.code
      WHERE f.company_id = 4 AND f.status IN ('2','4','5')
      GROUP BY f.customer_code, f.customer_address_code
    `;

    // ── 3. Máximo consumo mensual del año ─────────────────────────
    const maxConsumoSQL = `
      WITH cm AS (
        SELECT f.customer_code, f.customer_address_code,
               DATE_TRUNC('month', f.fecha_creacion) AS mes,
               SUM(dd.total) AS consumo_mes
        FROM facturas f
        JOIN detalle_documento dd ON dd.documento_code = f.code
        WHERE f.company_id = 4 AND f.status IN ('2','4','5')
          AND f.fecha_creacion >= :inicioAnio AND f.fecha_creacion < :finAnio
        GROUP BY f.customer_code, f.customer_address_code, DATE_TRUNC('month', f.fecha_creacion)
      )
      SELECT DISTINCT ON (customer_code, customer_address_code)
        customer_code, customer_address_code, mes, consumo_mes
      FROM cm
      ORDER BY customer_code, customer_address_code, consumo_mes DESC
    `;

    // ── 4. Última fecha de factura ────────────────────────────────
    const ultimaSQL = `
      SELECT customer_code, customer_address_code, MAX(fecha_creacion) AS ultima_factura
      FROM facturas
      WHERE company_id = 4 AND status IN ('2','4','5')
      GROUP BY customer_code, customer_address_code
    `;

    // ── 5. Productos vendidos ─────────────────────────────────────
    const productosSQL = `
      SELECT dd.descripcion AS producto,
             SUM(dd.cantidad) AS unidades_vendidas,
             SUM(dd.total)    AS monto_usd
      FROM facturas f
      JOIN detalle_documento dd ON dd.documento_code = f.code
      WHERE f.company_id = 4 AND f.status IN ('2','4','5')
        AND f.fecha_creacion >= :inicio AND f.fecha_creacion < :fin
      GROUP BY dd.descripcion
      ORDER BY unidades_vendidas DESC
    `;

    const [clientes, consumoData, maxConsumoData, ultimaData, productosVendidos] = await Promise.all([
      sequelize.query(clientesSQL,   { replacements: R, type: Sequelize.QueryTypes.SELECT }),
      sequelize.query(consumoSQL,    { replacements: R, type: Sequelize.QueryTypes.SELECT }),
      sequelize.query(maxConsumoSQL, { replacements: R, type: Sequelize.QueryTypes.SELECT }),
      sequelize.query(ultimaSQL,     { replacements: R, type: Sequelize.QueryTypes.SELECT }),
      sequelize.query(productosSQL,  { replacements: R, type: Sequelize.QueryTypes.SELECT }),
    ]);

    const clave = (r) => `${r.customer_code}__${r.customer_address_code ?? ""}`;

    const mapConsumo    = new Map(consumoData.map(r    => [clave(r), r]));
    const mapMaxConsumo = new Map(maxConsumoData.map(r  => [clave(r), r]));
    const mapUltima     = new Map(ultimaData.map(r      => [clave(r), r.ultima_factura]));

    const fmtFecha = (f) => {
      if (!f) return null;
      const d = new Date(f);
      if (isNaN(d.getTime())) return null;
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    };
    const nombreMes = (fecha) => {
      if (!fecha) return null;
      const M = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];
      return M[new Date(fecha).getMonth()];
    };

    const resultado = clientes.map(c => {
      const k = clave(c);
      const consumo  = mapConsumo.get(k)    || {};
      const maxC     = mapMaxConsumo.get(k) || {};
      const ultFecha = mapUltima.get(k)     || null;

      const consumoActual   = Number(consumo.consumo_actual)   || 0;
      const consumoAnterior = Number(consumo.consumo_anterior) || 0;
      const varAbs  = consumoActual - consumoAnterior;
      const varPorc = consumoAnterior > 0
        ? (varAbs / consumoAnterior) * 100
        : consumoActual > 0 ? 100 : 0;

      return {
        codigo_cliente:         c.customer_code,
        codigo_direccion:       c.customer_address_code || null,
        nombre_cliente:         c.nombre_cliente,
        direccion_entrega:      c.direccion_entrega,
        tipo_negocio:           c.tipo_negocio || "SIN CLASIFICAR",
        telefono_cliente:       c.telefono_cliente || "—",
        latitud_cliente:        c.latitud_cliente  || "—",
        longitud_cliente:       c.longitud_cliente || "—",
        cantidad_productos:     Number(consumo.cantidad_actual) || 0,
        consumo_actual:         consumoActual.toFixed(2),
        max_consumo:            Number(maxC.consumo_mes || 0).toFixed(2),
        mes_max_consumo_nombre: nombreMes(maxC.mes),
        ultima_factura:         fmtFecha(ultFecha),
        vsMesAnterior: {
          monto_anterior: consumoAnterior.toFixed(2),
          variacion_abs:  varAbs.toFixed(2),
          variacion_porc: `${varPorc.toFixed(2)}%`,
        },
        tuvo_consumo: consumoActual > 0 ? "Sí" : "No",
      };
    });

    const conConsumo     = resultado.filter(r => r.tuvo_consumo === "Sí").length;
    const clientesUnicos = new Set(resultado.map(r => r.codigo_cliente)).size;

    return res.json({
      clientes: resultado,
      resumen: {
        totalClientes:      clientesUnicos,
        totalDirecciones:   resultado.length,
        clientesConConsumo: conConsumo,
        clientesSinConsumo: resultado.length - conConsumo,
      },
      productosVendidos,
    });

  } catch (error) {
    console.error("❌ ERROR CLIENTES CAFÉ:", error);
    return res.status(500).json({ message: "Error al obtener clientes café", detalle: error.message });
  }
};

module.exports = { obtenerDashboardCafe, obtenerClientesCafe };
