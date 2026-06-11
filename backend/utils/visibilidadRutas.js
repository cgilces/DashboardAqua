// utils/visibilidadRutas.js
// ════════════════════════════════════════════════════════════════════════════
// VISIBILIDAD POR ROL / CANAL (fuente única de verdad del filtrado por ruta)
//
//   - ADMIN      → ve TODO (sin filtro).
//   - SUPERVISOR → ve TODO el/los CANAL(es) de sus rutas asignadas (tabla general
//                  del canal). Basta una ruta asignada de un canal para ver todo
//                  ese canal. Canal = letras iniciales del código (T1→T, TV1→TV).
//   - VENDEDOR   → ve SOLO su(s) ruta(s) exactas.
//
// Se usa en los controladores que devuelven datos por ruta para no duplicar la
// lógica ni que se desincronice entre módulos.
// ════════════════════════════════════════════════════════════════════════════
"use strict";

// Canal de una ruta = sus letras iniciales en mayúscula.
//   "T1"→"T", "T10"→"T", "TV1"→"TV", "PV9"→"PV", "R4"→"R", "H3"→"H".
// Así "T" y "TV" quedan como canales distintos.
function canalDeRuta(code) {
  const s = String(code == null ? "" : code).trim().toUpperCase();
  const m = s.match(/^[A-Z]+/);
  return m ? m[0] : s;
}

const norm = (code) => String(code == null ? "" : code).trim().toUpperCase();

// Construye el filtro de visibilidad a partir de req.user (token decodificado).
// Devuelve siempre un objeto con:
//   - rol        : rol normalizado
//   - restringe  : false para ADMIN (no filtrar); true para SUPERVISOR/VENDEDOR
//   - permite(c) : predicado boolean para un código de ruta/vendedor 'c'
//   - canales    : (SUPERVISOR) lista de canales visibles
//   - rutas      : (VENDEDOR) lista de rutas exactas visibles
function filtroVisibilidad(user) {
  const rol = norm(user && user.rol);
  const rutas = Array.isArray(user && user.rutas_asignadas)
    ? user.rutas_asignadas.map(norm).filter(Boolean)
    : [];

  // ADMIN → todo
  if (rol === "ADMIN") {
    return { rol, restringe: false, permite: () => true };
  }

  // SUPERVISOR → todo el canal de sus rutas
  if (rol === "SUPERVISOR") {
    const canales = new Set(rutas.map(canalDeRuta).filter(Boolean));
    return {
      rol,
      restringe: true,
      canales: [...canales],
      permite: (code) => canales.has(canalDeRuta(code)),
    };
  }

  // VENDEDOR (y cualquier otro rol) → solo sus rutas exactas
  const set = new Set(rutas);
  return {
    rol,
    restringe: true,
    rutas: [...set],
    permite: (code) => set.has(norm(code)),
  };
}

module.exports = { canalDeRuta, filtroVisibilidad };
