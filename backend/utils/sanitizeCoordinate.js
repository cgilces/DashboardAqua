// utils/sanitizeCoordinate.js
// Compartido entre sincronizacionService.js (MobilVendor) y
// sincronizacionOdooService.js (Odoo) — ambas fuentes pueden traer
// coordenadas mal formadas (ej. sin punto decimal: -2196885 en vez de
// -2.196885), que desbordan las columnas DECIMAL(12,8) de la base
// (máximo 4 dígitos enteros) y tumban el chunk/documento completo.
// En vez de dejar pasar el valor corrupto, se descarta a NULL.
const sanitizeCoordinate = (value, tipo) => {
  if (value == null) return null;
  const num = parseFloat(value);
  if (!Number.isFinite(num)) return null;
  if (tipo === "lat" && (num < -90 || num > 90)) return null;
  if (tipo === "lon" && (num < -180 || num > 180)) return null;
  return Number(num.toFixed(8));
};

module.exports = { sanitizeCoordinate };
