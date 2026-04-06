// services/chatbotservicio/respuesta.service.js
// Utilidades para preprocesar datos grandes antes de enviarlos al LLM

/**
 * Para datasets grandes genera estadísticas agregadas + muestra representativa.
 * Esto evita que el LLM reciba un JSON de miles de filas y lo trunque o ignore.
 *
 * @param {Array<Object>} datos
 * @returns {Object}
 */
function construirResumenEstadistico(datos) {
  const totalFilas = datos.length;
  const claves = Object.keys(datos[0] || {});

  // Detectar y sumar columnas numéricas relevantes
  const resumenNumerico = {};
  claves.forEach((k) => {
    const valores = datos
      .map((d) => Number(d[k]))
      .filter((v) => !isNaN(v) && isFinite(v));

    // Solo incluir si al menos el 30% de las filas tiene valor numérico válido
    if (valores.length >= totalFilas * 0.3) {
      const suma = valores.reduce((a, b) => a + b, 0);
      resumenNumerico[k] = {
        suma:             Number(suma.toFixed(2)),
        promedio:         valores.length > 0 ? Number((suma / valores.length).toFixed(2)) : 0,
        maximo:           valores.length > 0 ? Number(Math.max(...valores).toFixed(2)) : 0,
        minimo:           valores.length > 0 ? Number(Math.min(...valores).toFixed(2)) : 0,
        conteo_con_valor: valores.length,
      };
    }
  });

  // Detectar valores únicos en columnas de texto clave (vendedor, ruta, estado_pago, etc.)
  const COLUMNAS_CATEGORICAS = [
    "seller_code", "route_code", "estado_pago",
    "tipo_documento", "origen_sistema", "accion",
  ];
  const distribucion = {};
  claves
    .filter((k) => COLUMNAS_CATEGORICAS.includes(k))
    .forEach((k) => {
      const conteo = {};
      datos.forEach((d) => {
        const v = d[k] != null ? String(d[k]) : "(vacío)";
        conteo[v] = (conteo[v] || 0) + 1;
      });
      distribucion[k] = conteo;
    });

  // Rango de fechas si existe fecha_creacion
  let rangoFechas = null;
  if (datos[0]?.fecha_creacion) {
    const fechas = datos
      .map((d) => new Date(d.fecha_creacion))
      .filter((f) => !isNaN(f));
    if (fechas.length) {
      rangoFechas = {
        desde: new Date(Math.min(...fechas)).toISOString().slice(0, 10),
        hasta: new Date(Math.max(...fechas)).toISOString().slice(0, 10),
      };
    }
  }

  return {
    total_registros:          totalFilas,
    rango_fechas:             rangoFechas,
    resumen_numerico:         resumenNumerico,
    distribucion_categorias:  distribucion,
    muestra_primeros_5:       datos.slice(0, 5),
    muestra_ultimos_5:        datos.slice(-5),
  };
}

module.exports = { construirResumenEstadistico };
