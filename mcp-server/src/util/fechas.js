// src/util/fechas.js
// fecha_inicio/fecha_fin de las tools son fechas-calendario INCLUSIVAS
// (ej. "del 2026-08-01 al 2026-08-07" incluye todo el 7). Las queries
// filtran con `>= inicio AND < fin_exclusivo`, así que acá se calcula ese
// límite exclusivo (inicio del día siguiente a fecha_fin).
// Aritmética en UTC a propósito: son fechas-calendario puras (YYYY-MM-DD),
// no hay que involucrar la zona horaria del servidor para sumar un día.

const RE_FECHA = /^\d{4}-\d{2}-\d{2}$/;

function esFechaValida(fechaStr) {
  if (!RE_FECHA.test(fechaStr)) return false;
  const d = new Date(`${fechaStr}T00:00:00Z`);
  return !Number.isNaN(d.getTime());
}

function finExclusivo(fechaFinStr) {
  const d = new Date(`${fechaFinStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

function sumarDias(fechaStr, dias) {
  const d = new Date(`${fechaStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}

function diffDias(fechaInicioStr, fechaFinStr) {
  const a = new Date(`${fechaInicioStr}T00:00:00Z`);
  const b = new Date(`${fechaFinStr}T00:00:00Z`);
  return Math.round((b.getTime() - a.getTime()) / 86400000);
}

module.exports = { esFechaValida, finExclusivo, sumarDias, diffDias };
