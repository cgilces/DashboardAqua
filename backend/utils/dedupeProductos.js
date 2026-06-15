// utils/dedupeProductos.js
// ════════════════════════════════════════════════════════════════════════════
// Deduplicación de "Productos Vendidos" en TODO el dashboard.
//
// Problema: la columna detalle_documento.descripcion a veces trae el código del
// producto como prefijo ("[28] BOTELLÓN 20L AQUA PREMIUM") y a veces no
// ("BOTELLÓN 20L AQUA PREMIUM"). Como las consultas agrupan por descripcion,
// el MISMO producto aparece en dos filas. Este helper normaliza el nombre
// (quita el prefijo "[NN] ") y suma los duplicados en un solo ítem.
//
// El precio promedio se recalcula (dólares ÷ unidades) si la fila lo trae;
// en muchas tablas el precio se calcula en el frontend, así que basta con
// sumar unidades y dólares.
// ════════════════════════════════════════════════════════════════════════════

// Posibles nombres de campo según el módulo (botellón, preventa, descartable…).
const KEYS_NOMBRE   = ["producto", "descripcion", "nombre_producto", "nombre"];
const KEYS_UNIDADES = ["unidades", "unidades_vendidas", "cantidad", "cantidad_total", "total_unidades"];
const KEYS_DOLARES  = ["dolares", "monto_usd", "monto", "monto_total", "total_producto", "total_ventas", "ventas_total", "total_dolares", "total"];
const KEYS_PRECIO   = ["precio", "precio_promedio", "precioPromedio"];

/**
 * Quita el prefijo de código "[NN] " del inicio del nombre y recorta espacios.
 * "[28] BOTELLÓN 20L" -> "BOTELLÓN 20L" · "BOTELLÓN 20L" -> "BOTELLÓN 20L"
 * @param {*} nombre
 * @returns {*} el nombre limpio (o el valor original si no es texto)
 */
function limpiarNombreProducto(nombre) {
  if (nombre == null) return nombre;
  return String(nombre).replace(/^\s*\[[^\]]+\]\s*/, "").trim();
}

const aNum = (v) => {
  const n = Number(v);
  return isNaN(n) ? 0 : n;
};

/**
 * Fusiona filas de productos duplicados por su nombre normalizado.
 * Conserva los nombres de campo originales de cada fila.
 * @param {Array<Object>} filas
 * @returns {Array<Object>} filas deduplicadas (mismo shape, sin duplicados)
 */
function dedupeProductosVendidos(filas) {
  if (!Array.isArray(filas) || filas.length === 0) return filas;

  const muestra   = filas[0] || {};
  const keyNombre = KEYS_NOMBRE.find((k) => k in muestra);
  if (!keyNombre) return filas; // sin campo de nombre, nada que deduplicar

  const keysUnidades = KEYS_UNIDADES.filter((k) => k in muestra);
  const keysDolares  = KEYS_DOLARES.filter((k) => k in muestra);
  const keysPrecio   = KEYS_PRECIO.filter((k) => k in muestra);

  const mapa = new Map();
  for (const fila of filas) {
    const nombre = limpiarNombreProducto(fila[keyNombre]);
    const clave  = String(nombre).toUpperCase();

    if (!mapa.has(clave)) {
      mapa.set(clave, { ...fila, [keyNombre]: nombre });
      continue;
    }
    const acc = mapa.get(clave);
    for (const k of keysUnidades) acc[k] = aNum(acc[k]) + aNum(fila[k]);
    for (const k of keysDolares)  acc[k] = aNum(acc[k]) + aNum(fila[k]);
  }

  const resultado = Array.from(mapa.values());

  // Recalcular precio promedio (dólares ÷ unidades) solo si la fila lo trae.
  if (keysPrecio.length && keysUnidades.length && keysDolares.length) {
    for (const r of resultado) {
      const u = aNum(r[keysUnidades[0]]);
      const d = aNum(r[keysDolares[0]]);
      r[keysPrecio[0]] = u > 0 ? d / u : 0;
    }
  }

  return resultado;
}

module.exports = { limpiarNombreProducto, dedupeProductosVendidos };
