const {
    Orden,
    Factura,
    DetalleDocumento,
    // RutaPreventa,
    // ClienteVenta,
    MetaPreventa,
} = require("../../models");

const Sequelize = require("sequelize");
const Op = Sequelize.Op;
const { sequelize } = require('../../models');
const { getDiasHabilesTranscurridos, getDiasLaborablesMes } = require('../../utils/diasFestivos');

const RUTAS_ODOO_HIELO = [
  "Carmen Garcia", "Estefania Flores", "Tamara Villacres",
  "RUTA E1","RUTA E2","RUTA E3","RUTA E4","RUTA E5",
  "RUTA E6","RUTA E7","RUTA E8","RUTA E9","RUTA E10",
  "RUTA EA1", "RUTA U2", "Distribucion OK/E", "Domicilio",
];

const calcularKPIsMes = async (anioNum, mesNum) => {

  // ===============================
  // FECHAS MES ACTUAL
  // ===============================
  const hoyDate = new Date();
  const esMesActual = hoyDate.getFullYear() === anioNum && hoyDate.getMonth() + 1 === mesNum;

  const fechaInicioActual = `${anioNum}-${String(mesNum).padStart(2, "0")}-01 00:00:00`;

  let mesFin = mesNum + 1;
  let anioFin = anioNum;
  if (mesFin === 13) {
    mesFin = 1;
    anioFin++;
  }

  const fechaFinMes = `${anioFin}-${String(mesFin).padStart(2, "0")}-01 00:00:00`;
  // Para el mes actual cortamos en hoy 00:00:00, consistente con diasTranscurridos
  const fechaFinHoy = `${hoyDate.getFullYear()}-${String(hoyDate.getMonth() + 1).padStart(2, '0')}-${String(hoyDate.getDate()).padStart(2, '0')} 00:00:00`;
  const fechaFinActual = esMesActual ? fechaFinHoy : fechaFinMes;

  // ===============================
  // FECHAS MES ANTERIOR
  // ===============================
  let mesAnterior = mesNum - 1;
  let anioAnterior = anioNum;

  if (mesAnterior === 0) {
    mesAnterior = 12;
    anioAnterior--;
  }

  const fechaInicioAnterior = `${anioAnterior}-${String(mesAnterior).padStart(2, "0")}-01 00:00:00`;
  const fechaFinAnterior = fechaInicioActual;

  // ===============================
  // DÍAS HÁBILES
  // ===============================
  const diasTranscurridos = getDiasHabilesTranscurridos(anioNum, mesNum);
  const diasLaborablesMes = getDiasLaborablesMes(anioNum, mesNum);

  // ===============================
  // QUERY MES ACTUAL
  // ===============================
  const [actualSQL] = await sequelize.query(`
    SELECT
      SUM(dd.cantidad) AS unidades,
      SUM(dd.total) AS monto
    FROM facturas f
    JOIN detalle_documento dd ON f.code = dd.documento_code
    WHERE
      (f.seller_code ILIKE 'H%' OR f.seller_code IN ('10', 'h3'))
      AND f.status IN ('0','2','4','5')
      AND f.fecha_entrega >= '${fechaInicioActual}'
      AND f.fecha_entrega < '${fechaFinActual}';
  `);

  // ===============================
  // QUERY MES ANTERIOR
  // ===============================
  const [anteriorSQL] = await sequelize.query(`
    SELECT
      SUM(dd.cantidad) AS unidades,
      SUM(dd.total) AS monto
    FROM facturas f
    JOIN detalle_documento dd ON f.code = dd.documento_code
    WHERE
      (f.seller_code ILIKE 'H%' OR f.seller_code IN ('10', 'h3'))
      AND f.status IN ('0','2','4','5')
      AND f.fecha_entrega >= '${fechaInicioAnterior}'
      AND f.fecha_entrega < '${fechaFinAnterior}';
  `);

  // ===============================
  // NORMALIZAR VALORES
  // ===============================
  const unidadesActual = Number(actualSQL[0]?.unidades || 0);
  const montoActual    = Number(actualSQL[0]?.monto    || 0);

  const unidadesAnterior = Number(anteriorSQL[0]?.unidades || 0);
  const montoAnterior    = Number(anteriorSQL[0]?.monto    || 0);

  // ===============================
  // PROYECCIÓN
  // ===============================
  const proyeccionMonto    = esMesActual && diasTranscurridos > 0
    ? (montoActual    / diasTranscurridos) * diasLaborablesMes
    : montoActual;
  const proyeccionUnidades = esMesActual && diasTranscurridos > 0
    ? Math.round((unidadesActual / diasTranscurridos) * diasLaborablesMes)
    : unidadesActual;

  // ===============================
  // VARIACIONES (proyección vs mes anterior)
  // ===============================
  const variacionUnidadesAbs = proyeccionUnidades - unidadesAnterior;
  const variacionUnidadesPorc =
    unidadesAnterior > 0
      ? (variacionUnidadesAbs / unidadesAnterior) * 100
      : null;

  const variacionMontoAbs = proyeccionMonto - montoAnterior;
  const variacionMontoPorc =
    montoAnterior > 0
      ? (variacionMontoAbs / montoAnterior) * 100
      : null;

  // ===============================
  // METAS
  // ===============================
  const metaMensualUnidades = 200000;
  const metaMensualDolares  = 200000;

  const cumplimientoUnidadesMensual = (unidadesActual / metaMensualUnidades) * 100;
  const cumplimientoUSDMensual      = (montoActual    / metaMensualDolares)  * 100;

  // ===============================
  // RESPUESTA FINAL
  // ===============================
  return {
    kpisGenerales: {
      unidadesTotales: unidadesActual,
      montoTotal:      montoActual,
      proyeccionMonto:    Number(proyeccionMonto.toFixed(2)),
      proyeccionUnidades,
      metaMensualUnidades,
      metaMensualDolares,
      cumplimientoUnidadesMensual,
      cumplimientoUSDMensual
    },
    comparativaMesAnterior: {
      unidades: {
        anterior:     unidadesAnterior,
        actual:       unidadesActual,
        proyeccion:   proyeccionUnidades,
        variacionAbs: variacionUnidadesAbs,
        variacionPorc: variacionUnidadesPorc
      },
      monto: {
        anterior:     montoAnterior,
        actual:       montoActual,
        proyeccion:   Number(proyeccionMonto.toFixed(2)),
        variacionAbs: Number(variacionMontoAbs.toFixed(2)),
        variacionPorc: variacionMontoPorc
      }
    }
  };
};



// Función para obtener metas históricas
const metaHistoricaHielo = async () => {
    try {
        const [resultados] = await sequelize.query(`
            WITH ventas_hielo_mensual AS (
                SELECT
                    f.seller_code AS usuario,
                    DATE_TRUNC('month', f.fecha_entrega) AS mes,
                    SUM(dd.total) AS total_usd
                FROM facturas f
                JOIN detalle_documento dd
                    ON dd.documento_code = f.code
                WHERE
                    (f.seller_code ILIKE 'H%' OR f.seller_code IN ('10', 'h3'))
                    AND f.status IN (0,2,3,4,5)
                GROUP BY
                    f.seller_code,
                    DATE_TRUNC('month', f.fecha_entrega)
            ),
            ranking_hielo AS (
                SELECT
                    usuario,
                    mes,
                    total_usd,
                    RANK() OVER (
                        PARTITION BY usuario
                        ORDER BY total_usd DESC
                    ) AS rk
                FROM ventas_hielo_mensual
            )
            SELECT
                usuario,
                total_usd AS meta_historica_usd,
                mes AS mes_meta_historica
            FROM ranking_hielo
            WHERE rk = 1
            ORDER BY usuario;
        `);

        return resultados;
        console.log("✅ Meta histórica USD de Hielo obtenida exitosamente.",resultados);
    } catch (error) {
        console.error("❌ Error obteniendo meta histórica USD de Hielo:", error);
        throw error;
    }
};




const usuariosVentasHielo = async (anioNum, mesNum) => {

  // ============================
  // FECHAS MES ACTUAL
  // ============================
  const hoyDate = new Date();
  const esMesActualHielo = hoyDate.getFullYear() === anioNum && hoyDate.getMonth() + 1 === mesNum;

  const fechaInicioStr = `${anioNum}-${String(mesNum).padStart(2, '0')}-01 00:00:00`;
  let mesFin = mesNum + 1;
  let anioFin = anioNum;
  if (mesFin === 13) {
    mesFin = 1;
    anioFin++;
  }
  const fechaFinMes = `${anioFin}-${String(mesFin).padStart(2, "0")}-01 00:00:00`;
  // Para el mes actual cortamos en hoy 00:00:00, consistente con diasTranscurridos
  const fechaFinHoy = `${hoyDate.getFullYear()}-${String(hoyDate.getMonth() + 1).padStart(2, '0')}-${String(hoyDate.getDate()).padStart(2, '0')} 00:00:00`;
  const fechaFinStr = esMesActualHielo ? fechaFinHoy : fechaFinMes;

  // ============================
  // FECHAS MES ANTERIOR
  // ============================
  const fechaAnt = new Date(anioNum, mesNum - 1, 1);
  fechaAnt.setMonth(fechaAnt.getMonth() - 1);

  const anioAnt = fechaAnt.getFullYear();
  const mesAnt = fechaAnt.getMonth() + 1;

  const fechaInicioAntStr = `${anioAnt}-${String(mesAnt).padStart(2, '0')}-01 00:00:00`;
  const fechaFinAntStr = `${anioNum}-${String(mesNum).padStart(2, '0')}-01 00:00:00`;

  // ============================
  // 🔢 DÍAS HÁBILES / LABORABLES
  // ============================
  const diasTranscurridos = getDiasHabilesTranscurridos(anioNum, mesNum);
  const diasLaborablesMes = getDiasLaborablesMes(anioNum, mesNum);

  // ============================
  // MES ACTUAL
  // ============================
  const [actualSQL] = await sequelize.query(`
    SELECT
      f.seller_code AS usuario,
      COALESCE(SUM(dd.cantidad), 0) AS cantidad,
      COALESCE(SUM(dd.total), 0) AS total
    FROM facturas f
    LEFT JOIN detalle_documento dd
      ON f.code = dd.documento_code
    WHERE
      (f.seller_code ILIKE 'H%' OR f.seller_code IN ('10', 'h3'))
      AND f.status IN ('0','2','4','5')
      AND f.fecha_entrega >= '${fechaInicioStr}'
      AND f.fecha_entrega < '${fechaFinStr}'
    GROUP BY f.seller_code
    ORDER BY f.seller_code;
  `);
  // ============================
  // MES ANTERIOR
  // ============================
  const [anteriorSQL] = await sequelize.query(`
    SELECT
      f.seller_code AS usuario,
      COALESCE(SUM(dd.total), 0) AS total_anterior
    FROM facturas f
    LEFT JOIN detalle_documento dd
      ON f.code = dd.documento_code
    WHERE
      (f.seller_code ILIKE 'H%' OR f.seller_code IN ('10', 'h3'))
      AND f.status IN ('0','2','4','5')
      AND f.fecha_entrega >= '${fechaInicioAntStr}'
      AND f.fecha_entrega < '${fechaFinAntStr}'
    GROUP BY f.seller_code;
  `);

  // ============================
  // MAPA MES ANTERIOR
  // ============================
  const mapAnterior = {};
  anteriorSQL.forEach(r => {
    mapAnterior[r.usuario] = Number(r.total_anterior) || 0;
  });

  // ============================
  // ARMADO FINAL
  // ============================
  return actualSQL.map(row => {
    const actual = Number(row.total);
    const anterior = mapAnterior[row.usuario] || 0;

    //  PROYECCIÓN
    const proyeccion = esMesActualHielo && diasTranscurridos > 0
      ? (actual / diasTranscurridos) * diasLaborablesMes
      : actual;

    // Variación: proyección vs mes anterior
    const variacionAbs = proyeccion - anterior;
    const variacionPorc =
      anterior > 0 ? (variacionAbs / anterior) * 100 : null;

    return {
      usuario: row.usuario,
      cantidadVendida: Number(row.cantidad),
      totalConIVA: actual,

      proyeccion: Number(proyeccion.toFixed(2)),

      vsMesAnterior: {
        monto_anterior: anterior,
        variacion_abs: Number(variacionAbs.toFixed(2)),
        variacion_porc: variacionPorc !== null
          ? Number(variacionPorc.toFixed(2))
          : null
      }
    };
  });
};




// ================================================================
// TENDENCIA 6 MESES (MV facturas H* + Odoo ordenes cat 28)
// ================================================================
const tendencia6MesesHielo = async (anioNum, mesNum) => {
  const NOMBRES_MESES = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];

  // Calcular rango: 12 meses hacia atrás hasta el mes actual
  let mesInicio = mesNum - 11, anioInicio = anioNum;
  while (mesInicio <= 0) { mesInicio += 12; anioInicio--; }

  const inicio6 = `${anioInicio}-${String(mesInicio).padStart(2,'0')}-01 00:00:00`;
  let mesFin = mesNum + 1, anioFin = anioNum;
  if (mesFin === 13) { mesFin = 1; anioFin++; }
  const fin6 = `${anioFin}-${String(mesFin).padStart(2,'0')}-01 00:00:00`;

  const placeholders = RUTAS_ODOO_HIELO.map((_, i) => `:ruta${i}`).join(', ');
  const bindings = {};
  RUTAS_ODOO_HIELO.forEach((r, i) => { bindings[`ruta${i}`] = r; });
  bindings.inicio6 = inicio6;
  bindings.fin6 = fin6;

  const rows = await sequelize.query(`
    SELECT mes_periodo, SUM(dolares) AS dolares, SUM(unidades) AS unidades
    FROM (
      SELECT DATE_TRUNC('month', f.fecha_entrega) AS mes_periodo,
             SUM(dd.total) AS dolares, SUM(dd.cantidad) AS unidades
      FROM facturas f
      JOIN detalle_documento dd ON dd.documento_code = f.code
      WHERE (f.seller_code ILIKE 'H%' OR f.seller_code IN ('10','h3'))
        AND f.status IN ('0','2','4','5')
        AND f.fecha_entrega >= :inicio6 AND f.fecha_entrega < :fin6
      GROUP BY DATE_TRUNC('month', f.fecha_entrega)

      UNION ALL

      SELECT DATE_TRUNC('month', o.fecha_creacion) AS mes_periodo,
             SUM(dd.total) AS dolares, SUM(dd.cantidad) AS unidades
      FROM ordenes o
      JOIN detalle_documento dd ON dd.documento_code = o.code
      WHERE o.type = 2 AND o.status IN (2,4,5)
        AND dd.codigo_categoria = '28'
        AND o.seller_nombre IN (${placeholders})
        AND o.fecha_creacion >= :inicio6 AND o.fecha_creacion < :fin6
      GROUP BY DATE_TRUNC('month', o.fecha_creacion)
    ) combinado
    GROUP BY mes_periodo
    ORDER BY mes_periodo
  `, { replacements: bindings, type: Sequelize.QueryTypes.SELECT });

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
    return { label: NOMBRES_MESES[d.getMonth()], anio, mes, dolares, unidades, proyeccion };
  });
};

const dasboardventasHielo = async (req, res) => {
    try {
        const { anio, mes } = req.query;

        if (!anio || !mes) {
            return res.status(400).json({
                error: "Debe enviar los parámetros ?anio=YYYY&mes=MM",
            });
        }

        const anioNum = parseInt(anio, 10);
        const mesNum = parseInt(mes, 10);

        console.log("📅 Fechas:", anioNum, mesNum);

        // ── Filtro por rutas si VENDEDOR ──────────────────────────────
        const rutasPermitidas = req.user?.rol === 'VENDEDOR' && Array.isArray(req.user.rutas_asignadas) && req.user.rutas_asignadas.length > 0
          ? req.user.rutas_asignadas.map(r => r.toUpperCase())
          : null;

        // ============================
        // KPIs + TENDENCIA en paralelo
        // ============================
        const [resumenActual, resumenVentasUsuario, metasHistoricas, tendencia6Meses] = await Promise.all([
          calcularKPIsMes(anioNum, mesNum),
          usuariosVentasHielo(anioNum, mesNum),
          metaHistoricaHielo(),
          tendencia6MesesHielo(anioNum, mesNum),
        ]);

        // ============================
        // UNIÓN FINAL
        // ============================
        let resumenUsuariosVentasHielo = resumenVentasUsuario.map((u) => {
            const meta = metasHistoricas.find(
                (m) => m.usuario === u.usuario
            );

            return {
                ...u,
                meta: {
                    meta_historica: meta?.meta_historica_usd ?? 0,
                    mes_mayor_consumo: meta?.mes_meta_historica ?? null,
                },
            };
        });

        // ── Filtrar por rutas asignadas si VENDEDOR ───────────────────
        if (rutasPermitidas) {
          resumenUsuariosVentasHielo = resumenUsuariosVentasHielo.filter(u =>
            rutasPermitidas.includes((u.usuario || '').toUpperCase())
          );
        }

        return res.status(200).json({
            kpisGenerales: {
                resumenActual,
            },
            resumenUsuariosVentasHielo,
            tendencia6Meses,
        });

    } catch (error) {
        console.error("❌ Error al obtener los KPIs de Hielo:", error);
        return res.status(500).json({
            message: "Error al obtener los KPIs de Hielo",
        });
    }
};


module.exports = dasboardventasHielo;
