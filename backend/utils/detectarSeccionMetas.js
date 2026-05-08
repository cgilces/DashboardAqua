// Mapea un codigo_ruta al `seccion` que se debe guardar en metas_preventas
// para que el ranking correcto consuma la meta. Reglas alineadas con los
// filtros existentes en controllerBotellones/botellonesController.js y
// controllerCotxa/cotsaController.js.

const SECCIONES_VALIDAS = new Set([
  "PREVENTA",
  "TIENDAS_VIP",
  "TIENDAS",
  "MAYORISTA",
  "RURAL",
  "TELEVENTA_VIP",
]);

const COTTSA_RUTAS = new Set([
  "RUTA 113",
  "RUTA 131",
  "RUTA 132",
  "POS RUTA 113",
  "POS RUTA 131",
  "RUTA 132.1",
]);

function detectarSeccion(codigoRuta) {
  const cod = String(codigoRuta || "").trim().toUpperCase();
  if (!cod) return "PREVENTA";

  if (COTTSA_RUTAS.has(cod)) return "PREVENTA";
  if (cod === "148399") return "TELEVENTA_VIP";
  if (cod.startsWith("PVR")) return "PREVENTA";
  if (cod.startsWith("PV")) return "PREVENTA";
  if (cod.startsWith("TV")) return "TIENDAS_VIP";
  if (cod.startsWith("T")) return "TIENDAS";
  if (cod.startsWith("M")) return "MAYORISTA";
  if (cod.startsWith("R")) return "RURAL";

  return "PREVENTA";
}

function normalizarSeccion(valor) {
  const v = String(valor || "").trim().toUpperCase().replace(/\s+/g, "_");
  return SECCIONES_VALIDAS.has(v) ? v : null;
}

module.exports = { detectarSeccion, normalizarSeccion, SECCIONES_VALIDAS };
