// utils/visibilidad.ts
// ════════════════════════════════════════════════════════════════════════════
// VISIBILIDAD POR ROL / CANAL (frontend) — espejo de backend/utils/visibilidadRutas.js
//
//   - ADMIN      → ve todo.
//   - SUPERVISOR → ve los módulos de su(s) CANAL(es); datos = tabla general del canal.
//   - VENDEDOR   → ve los módulos de su(s) canal(es); datos = solo su ruta.
//   - Clientes   → abierto a todos.
//
// Canal = letras iniciales del código de ruta (T1→T, TV1→TV, PV9→PV, H3→H).
// ════════════════════════════════════════════════════════════════════════════

export function canalDeRuta(code: string): string {
  const s = String(code ?? "").trim().toUpperCase();
  const m = s.match(/^[A-Z]+/);
  return m ? m[0] : s;
}

export function canalesDeUsuario(rutas?: string[] | null): string[] {
  if (!Array.isArray(rutas)) return [];
  return Array.from(new Set(rutas.map(canalDeRuta).filter(Boolean)));
}

// Canales que pertenecen a cada módulo del menú (para mostrar/ocultar y redirigir).
// ⚠️ CONFIRMAR CON NEGOCIO: algunos prefijos (TV, M, R) podrían pertenecer a más de
//    un módulo. Ajustar aquí cuando el usuario aclare el mapeo (Plus/Café/Visitas).
export const CANALES_POR_MODULO: Record<string, string[]> = {
  "/dashboard/botellon": ["T"],
  "/dashboard/preventa": ["TV", "PV", "R", "A", "M", "V"], // descartable + preventa
  "/dashboard/hielo": ["H"],
};

// Catálogo de módulos que el ADMIN puede conceder/quitar a un usuario desde la UI
// (CreacionUsuario). USUARIOS no se incluye: la gestión de usuarios es solo ADMIN.
export const MODULOS_ASIGNABLES: { path: string; label: string }[] = [
  { path: "/dashboard/consolidado", label: "Consolidado" },
  { path: "/dashboard/botellon", label: "Botellón" },
  { path: "/dashboard/preventa", label: "Descartable / Preventa" },
  { path: "/dashboard/hielo", label: "Hielo" },
  { path: "/dashboard/plus", label: "Plus" },
  { path: "/dashboard/cafe", label: "Café" },
  { path: "/dashboard/promociones", label: "Promociones" },
  { path: "/dashboard/rutas-visitas", label: "Visitas Rutas" },
  { path: "/dashboard/clientes", label: "Clientes" },
];

// Secciones seleccionables dentro de cada módulo (submenú de privilegios).
// Si un módulo no aparece aquí, no tiene sub-secciones → concederlo = ver todo.
// Si se concede el módulo pero NO se marca ninguna sección → también ve todo.
export const SECCIONES_POR_MODULO: Record<string, { key: string; label: string }[]> = {
  "/dashboard/botellon": [
    { key: "TIENDAS", label: "Tiendas (T)" },
    { key: "TIENDAS_VIP", label: "Tiendas VIP (TV)" },
    { key: "MAYORISTA", label: "Mayorista (M)" },
    { key: "RURAL", label: "Rural (R)" },
    { key: "DOMICILIO", label: "Domicilio (A)" },
    { key: "EMPRESAS", label: "Empresas (E)" },
    { key: "QUITO", label: "Quito (U)" },
    { key: "VIP", label: "VIP" },
    { key: "TELEVENTA_VIP", label: "Televenta VIP" },
    { key: "WEBSITE", label: "Website" },
  ],
  "/dashboard/preventa": [
    { key: "TIENDAS", label: "Tiendas / Preventa (PV, TV)" },
    { key: "RURAL", label: "Rural (R)" },
    { key: "DOMICILIO", label: "Domicilio (A)" },
    { key: "MAYORISTA", label: "Mayorista (M)" },
    { key: "VIP", label: "VIP (V)" },
  ],
};

// Primer módulo al que debe entrar un no-admin según su canal (para la redirección
// post-login). Si no calza ningún canal, cae en Clientes (abierto a todos).
export function moduloInicial(rutas?: string[] | null): string {
  const canales = canalesDeUsuario(rutas);
  for (const [path, ch] of Object.entries(CANALES_POR_MODULO)) {
    if (ch.some((c) => canales.includes(c))) return path;
  }
  return "/dashboard/clientes";
}
