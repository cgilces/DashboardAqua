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

const calcularKPIsMes = async (anioNum, mesNum) => {

  // ===============================
  // FECHAS MES ACTUAL
  // ===============================
  const fechaInicioActual = `${anioNum}-${String(mesNum).padStart(2, "0")}-01 00:00:00`;

  let mesFin = mesNum + 1;
  let anioFin = anioNum;
  if (mesFin === 13) {
    mesFin = 1;
    anioFin++;
  }

  const fechaFinActual = `${anioFin}-${String(mesFin).padStart(2, "0")}-01 00:00:00`;

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
      AND f.status IN ('2','4','5')
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
      AND f.status IN ('2','4','5')
      AND f.fecha_entrega >= '${fechaInicioAnterior}'
      AND f.fecha_entrega < '${fechaFinAnterior}';
  `);

  // ===============================
  // NORMALIZAR VALORES
  // ===============================
  const unidadesActual = Number(actualSQL[0]?.unidades || 0);
  const montoActual = Number(actualSQL[0]?.monto || 0);

  const unidadesAnterior = Number(anteriorSQL[0]?.unidades || 0);
  const montoAnterior = Number(anteriorSQL[0]?.monto || 0);

  // ===============================
  // VARIACIONES
  // ===============================
  const variacionUnidadesAbs = unidadesActual - unidadesAnterior;
  const variacionUnidadesPorc =
    unidadesAnterior > 0
      ? (variacionUnidadesAbs / unidadesAnterior) * 100
      : null;

  const variacionMontoAbs = montoActual - montoAnterior;
  const variacionMontoPorc =
    montoAnterior > 0
      ? (variacionMontoAbs / montoAnterior) * 100
      : null;

  // ===============================
  // METAS
  // ===============================
  const metaMensualUnidades = 200000;
  const metaMensualDolares = 200000;

  const cumplimientoUnidadesMensual =
    (unidadesActual / metaMensualUnidades) * 100;

  const cumplimientoUSDMensual =
    (montoActual / metaMensualDolares) * 100;

  // ===============================
  // RESPUESTA FINAL
  // ===============================
  return {
    kpisGenerales: {
      unidadesTotales: unidadesActual,
      montoTotal: montoActual,
      metaMensualUnidades,
      metaMensualDolares,
      cumplimientoUnidadesMensual,
      cumplimientoUSDMensual
    },
    comparativaMesAnterior: {
      unidades: {
        anterior: unidadesAnterior,
        actual: unidadesActual,
        variacionAbs: variacionUnidadesAbs,
        variacionPorc: variacionUnidadesPorc
      },
      monto: {
        anterior: montoAnterior,
        actual: montoActual,
        variacionAbs: variacionMontoAbs,
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
                    AND f.status IN (2, 4, 5)
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

// ======================================================
//  DÍAS HÁBILES TRANSCURRIDOS (L–S) DEL MES
// ======================================================
const getDiasHabilesTranscurridos = (anio, mes, festivos = []) => {
  const hoy = new Date();
  const ayer = new Date(hoy);
  ayer.setDate(hoy.getDate() - 1);

  let ultimoDia = new Date(anio, mes, 0).getDate();

  // Si es el mes actual, contar solo hasta ayer
  if (
    ayer.getFullYear() === anio &&
    ayer.getMonth() + 1 === mes
  ) {
    ultimoDia = ayer.getDate();
  }

  let habiles = 0;

  for (let d = 1; d <= ultimoDia; d++) {
    const fecha = new Date(anio, mes - 1, d);
    const diaSemana = fecha.getDay(); // 0 domingo

    const esFestivo = festivos.some(f =>
      f.getDate() === fecha.getDate() &&
      f.getMonth() === fecha.getMonth() &&
      f.getFullYear() === fecha.getFullYear()
    );

    // ✅ lunes a sábado
    if (diaSemana !== 0 && !esFestivo) {
      habiles++;
    }
  }

  return habiles;
};

// Festivos (definidos por las fechas)
const festivos = [
  // 2025
  new Date(2025, 0, 1),    // 1 enero 2025 - Año Nuevo
  new Date(2025, 4, 1),    // 1 mayo 2025 - Día del Trabajo
  new Date(2025, 11, 25),  // 25 diciembre 2025 - Navidad

  // 2026
  new Date(2026, 0, 1),    // 1 enero 2026 - Año Nuevo
  new Date(2026, 1, 16),   // 16 febrero 2026 - Carnaval (lunes)
  new Date(2026, 1, 17),   // 17 febrero 2026 - Carnaval (martes)
  new Date(2026, 3, 2),    // 2 abril 2026 - Jueves Santo
  new Date(2026, 3, 3),    // 3 abril 2026 - Viernes Santo
  new Date(2026, 4, 1),    // 1 mayo 2026 - Día del Trabajo
  new Date(2026, 7, 10),   // 10 agosto 2026 - Primer Grito de Independencia
  new Date(2026, 9, 9),    // 9 octubre 2026 - Independencia de Guayaquil
  new Date(2026, 10, 2),   // 2 noviembre 2026 - Día de los Difuntos
  new Date(2026, 10, 3),   // 3 noviembre 2026 - Independencia de Cuenca
  new Date(2026, 11, 6),   // 6 diciembre 2026 - Fundación de Quito (local)
  new Date(2026, 11, 25)   // 25 diciembre 2026 - Navidad
];


// ===============================
//  DÍAS LABORABLES DEL MES (L–S)
// ===============================
const getDiasLaborablesMes = (anio, mes, festivos = []) => {
  const diasEnMes = new Date(anio, mes, 0).getDate();
  let laborables = 0;

  for (let d = 1; d <= diasEnMes; d++) {
    const fecha = new Date(anio, mes - 1, d);
    const diaSemana = fecha.getDay(); // 0 = domingo, 6 = sábado

    const esFestivo = festivos.some(f =>
      f.getDate() === fecha.getDate() &&
      f.getMonth() === fecha.getMonth() &&
      f.getFullYear() === fecha.getFullYear()
    );

    // ❌ solo se excluye domingo y feriados
    if (diaSemana !== 0 && !esFestivo) {
      laborables++;
    }
  }

  return laborables;
};



const usuariosVentasHielo = async (anioNum, mesNum) => {

  // ============================
  // FECHAS MES ACTUAL
  // ============================
  const fechaInicioStr = `${anioNum}-${String(mesNum).padStart(2, '0')}-01 00:00:00`;
  let mesFin = mesNum + 1;
  let anioFin = anioNum;
  if (mesFin === 13) {
    mesFin = 1;
    anioFin++;
  }
  const fechaFinStr = `${anioFin}-${String(mesFin).padStart(2, "0")}-01 00:00:00`;

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
  const diasTranscurridos = getDiasHabilesTranscurridos(anioNum, mesNum, festivos);
  const diasLaborablesMes = getDiasLaborablesMes(anioNum, mesNum, festivos);

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
      AND f.status IN ('2','4','5')
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
      AND f.status IN ('2','4','5')
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

    const variacionAbs = actual - anterior;
    const variacionPorc =
      anterior > 0 ? (variacionAbs / anterior) * 100 : null;

    //  PROYECCIÓN
    const proyeccion =
      diasTranscurridos > 0
        ? (actual / diasTranscurridos) * diasLaborablesMes
        : 0;

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

        // ============================
        // KPIs GENERALES
        // ============================
        const resumenActual = await calcularKPIsMes(anioNum, mesNum);

        // ============================
        // VENTAS POR USUARIO
        // ============================
        const resumenVentasUsuario = await usuariosVentasHielo(anioNum, mesNum);

        // ============================
        // META HISTÓRICA
        // ============================
        const metasHistoricas = await metaHistoricaHielo();

        // ============================
        // UNIÓN FINAL
        // ============================
        const resumenUsuariosVentasHielo = resumenVentasUsuario.map((u) => {
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

        return res.status(200).json({
            kpisGenerales: {
                resumenActual,
            },
            resumenUsuariosVentasHielo,
        });

    } catch (error) {
        console.error("❌ Error al obtener los KPIs de Hielo:", error);
        return res.status(500).json({
            message: "Error al obtener los KPIs de Hielo",
        });
    }
};


module.exports = dasboardventasHielo;
