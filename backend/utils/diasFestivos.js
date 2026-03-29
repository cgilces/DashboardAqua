// ============================================================
// utils/diasFestivos.js
// Días festivos nacionales de Ecuador — 2025 y 2026
// Fuente: Viceministerio de Turismo / Ministerio del Trabajo
//         Registro Oficial Ecuador / Decreto Ejecutivo 249
// Última actualización: 2026
// ============================================================

const festivos = [

  // ─────────────────────────────────────────
  // 2025
  // ─────────────────────────────────────────
  new Date(2025,  0,  1),  // 01 Ene — Año Nuevo
  new Date(2025,  2,  3),  // 03 Mar — Carnaval (lunes)
  new Date(2025,  2,  4),  // 04 Mar — Carnaval (martes)
  new Date(2025,  3, 17),  // 17 Abr — Jueves Santo
  new Date(2025,  3, 18),  // 18 Abr — Viernes Santo
  new Date(2025,  4,  1),  // 01 May — Día del Trabajo
  new Date(2025,  4, 26),  // 26 May — Batalla de Pichincha [May 24 = sábado → traslado lun]
  new Date(2025,  7, 11),  // 11 Ago — Primer Grito Independencia [Ago 10 = dom → traslado lun]
  new Date(2025,  9,  9),  // 09 Oct — Independencia de Guayaquil
  new Date(2025, 10,  3),  // 03 Nov — Día de los Difuntos [Nov 2 = dom → traslado lun]
  new Date(2025, 10,  4),  // 04 Nov — Independencia de Cuenca [traslado mar]
  new Date(2025, 11,  8),  // 08 Dic — Inmaculada Concepción
  new Date(2025, 11, 25),  // 25 Dic — Navidad

  // ─────────────────────────────────────────
  // 2026 — Feriados Nacionales Obligatorios
  // Fuente oficial: Viceministerio de Turismo
  // y Decreto Ejecutivo 249 (17-dic-2025)
  // ─────────────────────────────────────────

  // ENERO
  new Date(2026,  0,  1),  // 01 Ene — Año Nuevo (inamovible)
  new Date(2026,  0,  2),  // 02 Ene — Feriado adicional NO recuperable (Decreto Ejecutivo 249)

  // FEBRERO
  new Date(2026,  1, 16),  // 16 Feb — Carnaval (lunes, inamovible)
  new Date(2026,  1, 17),  // 17 Feb — Carnaval (martes, inamovible)

  // ABRIL
  // new Date(2026,  3,  2),  // 02 Abr — Jueves Santo (NO es feriado nacional obligatorio en 2026)
  new Date(2026,  3,  3),  // 03 Abr — Viernes Santo (Pascua: 05 Abr)

  // MAYO
  new Date(2026,  4,  1),  // 01 May — Día del Trabajo (viernes)
  new Date(2026,  4, 25),  // 25 May — Batalla de Pichincha [May 24 = dom → traslado lun]

  // AGOSTO
  new Date(2026,  7, 10),  // 10 Ago — Primer Grito de Independencia (lunes)

  // OCTUBRE
  new Date(2026,  9,  9),  // 09 Oct — Independencia de Guayaquil (viernes)

  // NOVIEMBRE
  new Date(2026, 10,  2),  // 02 Nov — Día de los Difuntos (lunes)
  new Date(2026, 10,  3),  // 03 Nov — Independencia de Cuenca (martes)

  // DICIEMBRE
  new Date(2026, 11,  7),  // 07 Dic — Fundación de Quito [Dic 6 = dom → traslado lun]
  new Date(2026, 11,  8),  // 08 Dic — Inmaculada Concepción (martes)
  new Date(2026, 11, 25),  // 25 Dic — Navidad (viernes, inamovible)

];

// ─────────────────────────────────────────
// Verifica si una fecha es festivo nacional
// ─────────────────────────────────────────
function esFestivo(fecha) {
  return festivos.some(f =>
    f.getDate()     === fecha.getDate()  &&
    f.getMonth()    === fecha.getMonth() &&
    f.getFullYear() === fecha.getFullYear()
  );
}

// ─────────────────────────────────────────
// Días hábiles transcurridos en el mes
// (lunes–sábado, excluyendo festivos)
// Cuenta hasta ayer si es el mes actual
// ─────────────────────────────────────────
function getDiasHabilesTranscurridos(anio, mes) {
  const hoy  = new Date();
  const ayer = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate() - 1);
  let ultimoDia = new Date(anio, mes, 0).getDate();
  if (ayer.getFullYear() === anio && ayer.getMonth() + 1 === mes)
    ultimoDia = ayer.getDate();

  let habiles = 0;
  for (let d = 1; d <= ultimoDia; d++) {
    const f = new Date(anio, mes - 1, d);
    if (f.getDay() !== 0 && !esFestivo(f)) habiles++;
  }
  return habiles;
}

// ─────────────────────────────────────────
// Días laborables totales del mes
// (lunes–sábado, excluyendo festivos)
// ─────────────────────────────────────────
function getDiasLaborablesMes(anio, mes) {
  const diasEnMes = new Date(anio, mes, 0).getDate();
  let laborables = 0;
  for (let d = 1; d <= diasEnMes; d++) {
    const f = new Date(anio, mes - 1, d);
    if (f.getDay() !== 0 && !esFestivo(f)) laborables++;
  }
  return laborables;
}

// ─────────────────────────────────────────
// Versión unificada (compatibilidad con consolidadoController)
// soloTranscurridos = true  → días hábiles hasta ayer
// soloTranscurridos = false → días hábiles totales del mes
// ─────────────────────────────────────────
function getDiasHabiles(anio, mes, soloTranscurridos = false) {
  return soloTranscurridos
    ? getDiasHabilesTranscurridos(anio, mes)
    : getDiasLaborablesMes(anio, mes);
}

module.exports = {
  festivos,
  esFestivo,
  getDiasHabilesTranscurridos,
  getDiasLaborablesMes,
  getDiasHabiles,
};