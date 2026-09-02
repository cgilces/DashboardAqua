// utils/sanitizeCoordinate.js
// Compartido entre sincronizacionService.js (MobilVendor) y
// sincronizacionOdooService.js (Odoo) — ambas fuentes pueden traer
// coordenadas mal formadas (ej. sin punto decimal: -2196885 en vez de
// -2.196885), que desbordan las columnas DECIMAL(12,8) de la base
// (máximo 4 dígitos enteros) y tumban el chunk/documento completo.
// En vez de dejar pasar el valor corrupto, se descarta a NULL.
//
// Los límites usados (lat ±90, lon ±180) son los límites geográficos REALES
// del planeta, no un margen arbitrario — una latitud no puede exceder ±90 ni
// una longitud ±180 sin importar el país. Un margen más ancho (ej. ±1000)
// dejaría pasar corrupción real (una "latitud" de 500 es imposible, pero
// pasaría un filtro de ±1000 sin problema).
const sanitizeCoordinate = (value, tipo) => {
  if (value == null) return null;
  const num = parseFloat(value);
  if (!Number.isFinite(num)) return null;
  if (tipo === "lat" && (num < -90 || num > 90)) return null;
  if (tipo === "lon" && (num < -180 || num > 180)) return null;
  return Number(num.toFixed(8));
};

module.exports = { sanitizeCoordinate };
