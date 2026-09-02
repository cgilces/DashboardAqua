// src/tools/proyeccionMensual.js
// Proyección de venta mensual (run-rate), reusando la MISMA fórmula y las
// MISMAS funciones de días hábiles que ya usa el dashboard en producción
// (botellón, café, hielo, plus, preventa, cotsa, etc. — todas comparten esta
// fórmula, ver backend/utils/diasFestivos.js):
//
//   proyeccion = esMesActual && diasTranscurridos > 0
//     ? (montoActual / diasTranscurridos) * diasLaborablesMes
//     : montoActual   // mes cerrado: no se proyecta, se muestra el real
//
// "días hábiles" = lunes a sábado, excluyendo feriados nacionales — PERO un
// feriado del calendario estático no se asume "no laborable" a ciegas: para
// un día YA PASADO se verifica si hubo venta real ese día (el negocio puede
// trabajar un feriado — ej. 2026-08-10, Primer Grito de Independencia,
// tuvo 1,628 documentos, prácticamente un día normal). Para un día FUTURO
// del mes en curso no hay forma de saber de antemano si se va a trabajar —
// cae al calendario estático como fallback (limitación conocida, ver
// TODO.md). Ver `esDiaHabilReal` en diasFestivos.js para el detalle.
//
// La copia de esa lógica vive en mcp-server/src/util/diasFestivos.js —
// test/diasFestivos-sync.test.js falla si esa copia se desincroniza del
// backend. El archivo se mantiene sin imports de base de datos a propósito
// (para poder ser un diff byte a byte limpio) — la consulta de "¿hubo venta
// real este día?" se inyecta desde acá.
const { z } = require("zod");
const { pool } = require("../db");
const { GRUPOS_VALIDOS, CATEGORIAS_VALIDAS, CATEGORIA_PREVENTA } = require("../sql/clasificacion");
const { totalesGrupo, totalesPreventa } = require("./ventasPorGrupo");
const { getDiasHabilesTranscurridosReal, getDiasLaborablesMesReal } = require("../util/diasFestivos");

// Umbral mínimo de documentos (facturas + órdenes, toda la empresa, sin
// filtrar por status) para considerar que un feriado SÍ se trabajó.
// Calibrado con datos reales: un domingo (día genuinamente cerrado) muestra
// hasta ~160 documentos de ruido residual, un feriado NO trabajado (ej.
// 2026-01-01) mostró 223, mientras que TODOS los feriados confirmados como
// trabajados en 2025-2026 mostraron 1,165+ (un día normal ronda 1,500-2,200).
// 500 queda cómodo en la brecha — más de 2x el feriado no trabajado más alto
// visto, menos de un tercio del piso de los feriados sí trabajados.
const UMBRAL_DIA_HABIL_REAL = 500;

async function huboVentaReal(fecha) {
  const fechaStr = `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, "0")}-${String(fecha.getDate()).padStart(2, "0")}`;
  const { rows } = await pool.query(
    `SELECT
       (SELECT COUNT(*) FROM facturas WHERE fecha_creacion::date = $1::date) +
       (SELECT COUNT(*) FROM ordenes  WHERE fecha_creacion::date = $1::date) AS total`,
    [fechaStr]
  );
  return Number(rows[0].total) >= UMBRAL_DIA_HABIL_REAL;
}

const inputSchema = {
  anio: z.number().int().min(2020).max(2100).optional(),
  mes: z.number().int().min(1).max(12).optional(),
  grupo: z.enum(GRUPOS_VALIDOS).optional(),
  categoria: z.enum(CATEGORIAS_VALIDAS).optional(),
};

function pad2(n) {
  return String(n).padStart(2, "0");
}

// Igual convención que botellonesController.obtenerGrupoBotellon: si es el
// mes en curso, el corte de datos "actuales" es HOY 00:00:00 (exclusivo) —
// o sea hasta el cierre de ayer, la misma ventana que getDiasHabilesTranscurridos
// cuenta como "transcurrida". Si el mes ya cerró, se usa el mes completo.
function rangoMes(anio, mes) {
  const hoy = new Date();
  const esMesActual = hoy.getFullYear() === anio && hoy.getMonth() + 1 === mes;

  const inicio = `${anio}-${pad2(mes)}-01 00:00:00`;

  const anioSig = mes === 12 ? anio + 1 : anio;
  const mesSig = mes === 12 ? 1 : mes + 1;
  const finMesCompleto = `${anioSig}-${pad2(mesSig)}-01 00:00:00`;

  const finHoy = `${hoy.getFullYear()}-${pad2(hoy.getMonth() + 1)}-${pad2(hoy.getDate())} 00:00:00`;

  return {
    inicio,
    fin: esMesActual ? finHoy : finMesCompleto,
    esMesActual,
  };
}

async function totalesDelMes({ grupo, categoria, inicioTs, finTs }) {
  if (grupo) {
    const { totales } = grupo === "PREVENTA"
      ? await totalesPreventa(inicioTs, finTs, categoria)
      : await totalesGrupo(grupo, inicioTs, finTs, categoria);
    return totales;
  }

  // Sin grupo: total de la empresa — suma de todos los grupos válidos,
  // incluido PREVENTA (que no comparte el CASE genérico de los demás).
  const gruposNoPreventa = GRUPOS_VALIDOS.filter((g) => g !== "PREVENTA");
  const resultados = await Promise.all([
    ...gruposNoPreventa.map((g) => totalesGrupo(g, inicioTs, finTs, categoria)),
    totalesPreventa(inicioTs, finTs, categoria),
  ]);
  return resultados.reduce(
    (acc, r) => {
      acc.unidades += r.totales.unidades;
      acc.dolares += r.totales.dolares;
      return acc;
    },
    { unidades: 0, dolares: 0 }
  );
}

async function proyeccionMensual({ anio, mes, grupo, categoria } = {}) {
  const hoy = new Date();
  const anioReal = anio ?? hoy.getFullYear();
  const mesReal = mes ?? hoy.getMonth() + 1;

  const { inicio, fin, esMesActual } = rangoMes(anioReal, mesReal);

  const totales = await totalesDelMes({ grupo, categoria, inicioTs: inicio, finTs: fin });

  const diasTranscurridos = await getDiasHabilesTranscurridosReal(anioReal, mesReal, huboVentaReal);
  const diasTotalesMes = await getDiasLaborablesMesReal(anioReal, mesReal, huboVentaReal);

  const proyeccionDolares =
    esMesActual && diasTranscurridos > 0
      ? (totales.dolares / diasTranscurridos) * diasTotalesMes
      : totales.dolares;
  const proyeccionUnidades =
    esMesActual && diasTranscurridos > 0
      ? (totales.unidades / diasTranscurridos) * diasTotalesMes
      : totales.unidades;

  return {
    anio: anioReal,
    mes: mesReal,
    grupo: grupo || null,
    categoria: grupo === "PREVENTA" ? categoria || CATEGORIA_PREVENTA : categoria || null,
    es_mes_actual: esMesActual,
    dolares_actual: Number(totales.dolares.toFixed(2)),
    unidades_actual: totales.unidades,
    dias_habiles_transcurridos: diasTranscurridos,
    dias_habiles_totales_mes: diasTotalesMes,
    proyeccion_dolares: Number(proyeccionDolares.toFixed(2)),
    proyeccion_unidades: Math.round(proyeccionUnidades),
  };
}

module.exports = { proyeccionMensual, inputSchema, rangoMes };
