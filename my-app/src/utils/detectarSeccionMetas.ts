// Mapea un codigo_ruta a la `seccion` que se debe guardar en metas_preventas
// para que el ranking correcto consuma la meta. Espejo de
// backend/utils/detectarSeccionMetas.js — mantener ambos sincronizados.

export const SECCIONES_VALIDAS = [
  "PREVENTA",
  "TIENDAS_VIP",
  "TIENDAS",
  "MAYORISTA",
  "RURAL",
  "TELEVENTA_VIP",
] as const;

export type Seccion = typeof SECCIONES_VALIDAS[number];

const COTTSA_RUTAS = new Set([
  "RUTA 113",
  "RUTA 131",
  "RUTA 132",
  "POS RUTA 113",
  "POS RUTA 131",
  "RUTA 132.1",
]);

export function detectarSeccion(codigoRuta: string): Seccion {
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

export function normalizarSeccion(valor: unknown): Seccion | null {
  const v = String(valor || "").trim().toUpperCase().replace(/\s+/g, "_");
  return (SECCIONES_VALIDAS as readonly string[]).includes(v) ? (v as Seccion) : null;
}
