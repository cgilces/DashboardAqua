module.exports = {
  running: false,
  startDate: null,
  endDate: null,
  percent: 0,          // valor MOSTRADO en la barra (sube suave hacia percentObjetivo)
  percentObjetivo: 0,  // avance REAL calculado por las fases
  error: null,
  startedAt: null,
  finishedAt: null,
  // Fracciones (0..1) de cada fuente en FASE 1 (corren en paralelo). El % de la
  // barra en FASE 1 es el PROMEDIO de ambas → avanza mientras cualquiera trabaje
  // y solo llega al tope cuando ambas terminan.
  mvFrac: 0,
  odooFrac: 0
};
