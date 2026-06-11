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
    return { rol, restringe: false, permite: () => true, permiteCanal: () => true };
  }

  // Canales del usuario (derivados de sus rutas) — sirve para gatear módulos/grupos.
  const canales = new Set(rutas.map(canalDeRuta).filter(Boolean));
  // ¿El usuario puede ver este canal? (mismo criterio para SUPERVISOR y VENDEDOR:
  // un grupo/tabla del canal de alguna de sus rutas).
  const permiteCanal = (canal) => canales.has(canalDeRuta(canal));

  // SUPERVISOR → todo el canal de sus rutas (filas = todo el canal)
  if (rol === "SUPERVISOR") {
    return {
      rol,
      restringe: true,
      canales: [...canales],
      permite: (code) => canales.has(canalDeRuta(code)),
      permiteCanal,
    };
  }

  // VENDEDOR (y cualquier otro rol) → solo sus rutas exactas (pero el GRUPO de su
  // canal sí aplica; dentro se filtra a su(s) ruta(s)).
  const set = new Set(rutas);
  return {
    rol,
    restringe: true,
    rutas: [...set],
    canales: [...canales],
    permite: (code) => set.has(norm(code)),
    permiteCanal,
  };
}

// ════════════════════════════════════════════════════════════════════════════
// VISIBILIDAD POR MÓDULO / SECCIÓN (privilegios finos desde la UI)
//
// Por usuario se guardan:
//   - modulos_permitidos: string[]            → qué módulos abre.
//   - modulo_secciones:   { [modulo]: string[] } → qué secciones ve por módulo.
//
// Reglas (precedencia) para un módulo dado:
//   1) ADMIN                              → ve TODO.
//   2) modulo_secciones[modulo] con items → solo esas secciones.
//   3) módulo en modulos_permitidos       → ve TODO el módulo (concedido sin filtro).
//   4) si no hay nada explícito           → default por CANAL de las rutas.
// ════════════════════════════════════════════════════════════════════════════
function permisosModulo(user, modulePath) {
  const rol = norm(user && user.rol);
  if (rol === "ADMIN") return { modo: "todo" };

  const modulos = Array.isArray(user && user.modulos_permitidos) ? user.modulos_permitidos : [];
  const secMap = (user && user.modulo_secciones) || {};
  const secs = Array.isArray(secMap[modulePath]) ? secMap[modulePath] : [];

  if (secs.length) return { modo: "secciones", secciones: new Set(secs) };
  if (modulos.includes(modulePath)) return { modo: "todo" };
  return { modo: "canal" };
}

// ¿Puede el usuario ver esta sección del módulo? `canal` = canal de ruta de la
// sección (para el fallback por canal). `seccionKey` = clave de la sección.
function permiteSeccion(user, modulePath, seccionKey, canal) {
  const pm = permisosModulo(user, modulePath);
  if (pm.modo === "todo") return true;
  if (pm.modo === "secciones") return pm.secciones.has(seccionKey);
  // modo "canal" → auto-scope por el canal de las rutas asignadas
  return filtroVisibilidad(user).permiteCanal(canal);
}

module.exports = { canalDeRuta, filtroVisibilidad, permisosModulo, permiteSeccion };
