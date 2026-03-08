// services/chatbotservicio/generarRespuesta.js
const OpenAI = require("openai");
const config = require("../../db");

const openai = new OpenAI({
  apiKey: config.OPENAI_API_KEY,
});

// Si hay más de este número de filas se envía un resumen estadístico
// en lugar del JSON completo para no truncar el contexto del LLM
const MAX_FILAS_DETALLE = 50;

async function generarRespuesta(pregunta, datos) {
  if (!datos || datos.length === 0) {
    return "No existe información en la base de datos.";
  }

  const esVolumenGrande = datos.length > MAX_FILAS_DETALLE;

  const payload = esVolumenGrande
    ? construirResumenEstadistico(datos)
    : datos;

  const instruccion = esVolumenGrande
    ? `
Eres un asistente del ERP Grupo Aqua.
Los datos que recibes son un RESUMEN ESTADÍSTICO de ${datos.length} registros totales (no el listado completo).
Responde con cifras agregadas: totales, promedios, rangos.
NO digas "los primeros N registros", describe el conjunto completo.
No inventes datos que no estén en el resumen.
    `.trim()
    : `
Eres un asistente del ERP Grupo Aqua.
Responde únicamente con la información proporcionada.
No inventes datos.
    `.trim();

  const completion = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    temperature: 0.2,
    messages: [
      {
        role: "system",
        content: instruccion,
      },
      {
        role: "user",
        content: `Pregunta:\n${pregunta}\n\nDatos:\n${JSON.stringify(payload)}`,
      },
    ],
  });

  return completion.choices[0].message.content;
}

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
      .filter((v) => !isNaN(v) && isFinite(v) && v > 0);

    // Solo incluir si al menos el 30% de las filas tiene valor numérico válido
    if (valores.length >= totalFilas * 0.3) {
      const suma = valores.reduce((a, b) => a + b, 0);
      resumenNumerico[k] = {
        suma: Number(suma.toFixed(2)),
        promedio: Number((suma / valores.length).toFixed(2)),
        maximo: Number(Math.max(...valores).toFixed(2)),
        minimo: Number(Math.min(...valores).toFixed(2)),
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
    total_registros: totalFilas,
    rango_fechas: rangoFechas,
    resumen_numerico: resumenNumerico,
    distribucion_categorias: distribucion,
    muestra_primeros_5: datos.slice(0, 5),
    muestra_ultimos_5: datos.slice(-5),
  };
}

module.exports = { generarRespuesta };