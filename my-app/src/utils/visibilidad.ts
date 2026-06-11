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

// Primer módulo al que debe entrar un no-admin según su canal (para la redirección
// post-login). Si no calza ningún canal, cae en Clientes (abierto a todos).
export function moduloInicial(rutas?: string[] | null): string {
  const canales = canalesDeUsuario(rutas);
  for (const [path, ch] of Object.entries(CANALES_POR_MODULO)) {
    if (ch.some((c) => canales.includes(c))) return path;
  }
  return "/dashboard/clientes";
}
