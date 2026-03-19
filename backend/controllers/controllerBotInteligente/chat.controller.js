// controllers/controllerBotInteligente/chat.controller.js
const { generarSQL }                           = require("../../services/chatbotservicio/openai.service");
const { ejecutarSQL }                          = require("../../services/chatbotservicio/query.service");
const { validarSQL, aplicarLimite }            = require("../../utils/sqlValidator");
const { detectarTipoReporte, generarPDF, construirConfigReporte } = require("../../services/chatbotservicio/reporte.service");
const { registrar: registrarAuditoria }        = require("../../services/chatbotservicio/auditoria.service");
const { construirResumenEstadistico }          = require("../../services/chatbotservicio/respuesta.service");

const OpenAI = require("openai");
const path   = require("path");
const fs     = require("fs");
const crypto = require("crypto");
require("dotenv").config();

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// ═══════════════════════════════════════════════════
// DIRECTORIO TEMPORAL DE PDFs
// ═══════════════════════════════════════════════════
const PDF_DIR = path.join(__dirname, "../../temp/reportes");
if (!fs.existsSync(PDF_DIR)) fs.mkdirSync(PDF_DIR, { recursive: true });

function limpiarPDFsViejos() {
  try {
    fs.readdirSync(PDF_DIR).forEach(archivo => {
      try {
        const ruta = path.join(PDF_DIR, archivo);
        if (Date.now() - fs.statSync(ruta).mtimeMs > 30 * 60 * 1000) fs.unlinkSync(ruta);
      } catch (e) {
        console.warn(`⚠️  No se pudo eliminar PDF temporal: ${archivo}`, e.message);
      }
    });
  } catch (e) {
    console.warn("⚠️  Error al limpiar directorio de PDFs:", e.message);
  }
}
limpiarPDFsViejos();

// ═══════════════════════════════════════════════════
// HISTORIAL DE CONVERSACIÓN POR USUARIO
// Guarda los últimos N turnos para dar contexto a la IA
// Se limpia si el usuario está inactivo por 30 minutos
// ═══════════════════════════════════════════════════
const MAX_TURNOS_HISTORIAL = 10; // últimos 10 mensajes (5 turnos usuario+bot)
const HISTORIAL_TTL_MS = 30 * 60 * 1000; // 30 minutos de inactividad
const historialSesiones = new Map(); // { usuario: { mensajes: [], ultimaActividad: timestamp } }

function getHistorial(usuario) {
  const sesion = historialSesiones.get(usuario);
  if (!sesion) return [];
  // Limpiar si expiró
  if (Date.now() - sesion.ultimaActividad > HISTORIAL_TTL_MS) {
    historialSesiones.delete(usuario);
    return [];
  }
  return sesion.mensajes;
}

function agregarAlHistorial(usuario, role, content) {
  const sesion = historialSesiones.get(usuario) || { mensajes: [], ultimaActividad: Date.now() };
  sesion.mensajes.push({ role, content });
  sesion.ultimaActividad = Date.now();
  // Mantener solo los últimos MAX_TURNOS_HISTORIAL mensajes
  if (sesion.mensajes.length > MAX_TURNOS_HISTORIAL) {
    sesion.mensajes = sesion.mensajes.slice(-MAX_TURNOS_HISTORIAL);
  }
  historialSesiones.set(usuario, sesion);
}

function limpiarHistorial(usuario) {
  historialSesiones.delete(usuario);
}

// Limpiar sesiones expiradas, rate limit y PDFs viejos cada 10 minutos
setInterval(() => {
  const ahora = Date.now();

  // Historial de conversación
  for (const [usuario, sesion] of historialSesiones) {
    if (ahora - sesion.ultimaActividad > HISTORIAL_TTL_MS) {
      historialSesiones.delete(usuario);
    }
  }

  // Rate limit map — limpiar entradas con más de 5 minutos de inactividad
  for (const [usuario, entry] of rateLimitMap) {
    if (ahora - entry.start > 5 * 60 * 1000) {
      rateLimitMap.delete(usuario);
    }
  }

  // PDFs temporales viejos
  limpiarPDFsViejos();
}, 10 * 60 * 1000);

// ═══════════════════════════════════════════════════
// CACHÉ DE ÚLTIMOS DATOS POR SESIÓN
// Guarda los datos de la última consulta SQL exitosa
// para reutilizarlos cuando el usuario pide el PDF
// sin volver a consultar la BD
// ═══════════════════════════════════════════════════
const ultimosDatosSesion = new Map(); // { usuario: { datos, pregunta, timestamp } }

function guardarUltimosDatos(usuario, datos, pregunta) {
  ultimosDatosSesion.set(usuario, {
    datos,
    pregunta,
    timestamp: Date.now(),
  });
}

function getUltimosDatos(usuario) {
  const entry = ultimosDatosSesion.get(usuario);
  if (!entry) return null;
  // Expirar si pasaron más de 30 minutos
  if (Date.now() - entry.timestamp > HISTORIAL_TTL_MS) {
    ultimosDatosSesion.delete(usuario);
    return null;
  }
  return entry;
}

// ═══════════════════════════════════════════════════
// CACHÉ EN MEMORIA (2 min, máx 100 entradas)
// ═══════════════════════════════════════════════════
const cache = new Map();
const CACHE_TTL_MS = 2 * 60 * 1000;
function getCacheKey(m, r, s) { return `${m.toLowerCase().trim()}::${r}::${s||""}`; }
function getFromCache(key) {
  const e = cache.get(key);
  if (!e) return null;
  if (Date.now() - e.timestamp > CACHE_TTL_MS) { cache.delete(key); return null; }
  return e.data;
}
function setCache(key, data) {
  if (cache.size >= 100) cache.delete(cache.keys().next().value);
  cache.set(key, { data, timestamp: Date.now() });
}

// ═══════════════════════════════════════════════════
// CORRECCIÓN PROGRAMÁTICA DE SQL INCORRECTO
// Si el LLM genera un JOIN con detalle_documento para
// una consulta de total monetario ("cuánto compró"),
// reconstruimos el SQL canónico directamente.
// ═══════════════════════════════════════════════════
const PATRON_TOTAL_MONETARIO = /cu[aá]nt[ao]s?\s+(compró?|vendi[oó]|gast[oó]|pag[oó]|factur[oó]|sum[oó])|total\s+(en\s+d[oó]lares?|de\s+ventas?|de\s+compras?|facturado)|monto\s+total\s+de\s+(compras?|ventas?)/i;

function corregirSQLTotalMonetario(pregunta, sql) {
  if (!PATRON_TOTAL_MONETARIO.test(pregunta)) return sql;
  if (!/detalle_documento/i.test(sql))        return sql;

  // Extraer nombre del cliente del ILIKE
  const mCliente = sql.match(/nombre_cliente\s+ILIKE\s+'%([^%']+)%'/i);
  if (!mCliente) return sql; // sin cliente identificable, no reconstruir

  const nombre = mCliente[1];

  // Extraer rango de fechas (soporta DATE(f.fecha_creacion) y f.fecha_creacion)
  const mDesde = sql.match(/fecha_creacion\)?\s*>=\s*'(\d{4}-\d{2}-\d{2})'/i);
  const mHasta = sql.match(/fecha_creacion\)?\s*<\s*'(\d{4}-\d{2}-\d{2})'/i);

  let filtroFecha = "";
  if (mDesde && mHasta) {
    filtroFecha = `  AND DATE(f.fecha_creacion) >= '${mDesde[1]}'\n  AND DATE(f.fecha_creacion) < '${mHasta[1]}'`;
  } else if (mDesde) {
    filtroFecha = `  AND DATE(f.fecha_creacion) >= '${mDesde[1]}'`;
  }

  // Extraer filtro de vendedor si existe (rol VENDEDOR)
  const mVendedor = sql.match(/f\.seller_code\s*=\s*'([^']+)'/i);
  const filtroVendedor = mVendedor ? `  AND f.seller_code = '${mVendedor[1]}'` : "";

  const sqlCanónico =
`SELECT COALESCE(SUM(f.total), 0) AS total_ventas
FROM facturas f
JOIN clientes c ON c.codigo_cliente = f.customer_code
WHERE (c.nombre_cliente ILIKE '%${nombre}%'
   OR c.nombre_comercial_cliente ILIKE '%${nombre}%')
${filtroFecha}${filtroVendedor ? "\n" + filtroVendedor : ""}`.trim();

  console.log("🔧 [correccion] SQL de total monetario usaba detalle_documento — reconstruyendo...");
  console.log("   SQL original  :", sql.replace(/\s+/g, " ").slice(0, 200));
  console.log("   SQL corregido :", sqlCanónico.replace(/\s+/g, " "));

  return sqlCanónico;
}

// ═══════════════════════════════════════════════════
// RATE LIMITING (20 msg/min por usuario)
// ═══════════════════════════════════════════════════
const rateLimitMap = new Map();
function checkRateLimit(usuario) {
  const now = Date.now();
  const entry = rateLimitMap.get(usuario) || { count: 0, start: now };
  if (now - entry.start > 60000) { rateLimitMap.set(usuario, { count: 1, start: now }); return true; }
  if (entry.count >= 20) return false;
  entry.count++;
  rateLimitMap.set(usuario, entry);
  return true;
}

// ═══════════════════════════════════════════════════
// CLASIFICADOR DE INTENCIÓN
// ═══════════════════════════════════════════════════
const PATRONES_CONVERSACIONAL = [
  /qu[eé]\s+(reporte|informe|pdf|consulta|puedo|puedes|sabe[sz]|hace[sn]?)/i,
  /c[oó]mo\s+(usar|funciona|pedir|generar|crear|hacer)/i,
  /qu[eé]\s+tipo[s]?\s+de\s+reporte/i,
  /qu[eé]\s+puedes?\s+(hacer|generar|mostrar|decirme)/i,
  /ayuda|help|opciones|menu|qu[eé]\s+haces?/i,
  /cu[aá]les?\s+(son\s+los\s+tipos|son\s+las\s+opciones|reportes|consultas|opciones)/i,
  /lista\s+de\s+reporte/i,
  /tipos?\s+de\s+reporte/i,
  /^(hola|buenos?\s+(d[ií]as?|tardes?|noches?)|hey|hi|saludos?)[\s!.]*$/i,
  /^(gracias|thank|perfecto|excelente|ok|okay|listo|entend[ií])[\s!.]*$/i,
  // Reconocimientos y respuestas de cierre adicionales
  /^(muchas?\s+gracias|de\s+nada|gracias\s+(un\s+)?(montonazo|cacharro|banda))[\s\w!.,]*$/i,
  /^(entendido|comprend[ío]|ya\s+(veo|entend[ií])|claro(\s+que\s+s[ií])?|exacto|así?\s+es)[\s!.,]*$/i,
  /^(genial|interesante|impresionante|fantástico|estupendo|qué?\s+bien|muy\s+bien)[\s\w!.,]*$/i,
  /^(no\s+(importa|es\s+necesario)|olvídalo?|déjalo?|no\s+gracias)[\s!.,]*$/i,
  /^(dale|va|bueno|correcto|confirmado|de\s+acuerdo|con\s+gusto)[\s!.,]*$/i,
];

const PALABRAS_CLAVE_SQL = new Set([
  "venta","vendio","vendido","factura","facturas","orden","consumo","monto","total","ingreso","recaudacion",
  "cliente","clientes","saldo","credito","negocio","direccion",
  "producto","productos","cantidad","categoria","precio","detalle",
  "ruta","rutas","preventas","televenta","vip","despacho","secuencia",
  "usuario","usuarios","vendedor","despachador","admin","rol",
  "visita","visitas","accion","ruptura","comentario",
  "hoy","ayer","semana","mes","año","fecha","rango","periodo",
  "sincronizacion","estado sync","registros sincronizados",
  "latitud","longitud","ubicacion","estado","activo","inactivo","proceso",
  "hielo","agua","botellon","botellones","galon","galones","pack","unidades",
  // Palabras de temporalidad/recencia que se pierden sin keywords de dominio
  "ultima","último","ultima factura","ultimo pedido","reciente","mas reciente","más reciente",
  "primer","primero","primera","ultimo mes","ultima semana",
  // Palabras de ranking/top
  "top","ranking","mejor","mejores","mas vendido","más vendido","mas vendidos","más vendidos",
  "mayor","mayores","menor","menores","mas alto","más alto","mas bajo","más bajo",
  "best","most","least","highest","lowest",
  // Palabras de resumen
  "cuanto","cuantos","cuánto","cuántos","cuantas","cuántas","promedio","average",
  "reporte ventas","reporte clientes","reporte productos","reporte visitas",
  "reporte ruta","reporte vendedor","reporte sincronizacion","generar reporte",
  "exportar","informe de","pdf de",
  // Análisis financiero y cartera
  "cartera","cartera vencida","deuda","deuda vencida","saldo pendiente","vencido","vencidas","cobrar",
  "cuentas por cobrar","mora","morosidad","credito pendiente",
  // Metas y cumplimiento
  "meta","metas","cumplimiento","avance","porcentaje meta","objetivo","cuanto falta",
  // Efectividad y cobertura
  "efectividad","cobertura","cobertura ruta","clientes sin visitar",
  "visitas con venta","conversion","eficiencia",
  // KPIs y resúmenes ejecutivos
  "kpi","indicadores","resumen ejecutivo","resumen del dia",
  // Comparativos
  "comparativo","comparar","diferencia","variacion","mes anterior","periodo anterior",
  // Clientes especiales
  "clientes sin comprar","clientes inactivos","clientes perdidos","clientes en riesgo",
  "nuevos clientes","primera compra","dias sin comprar",
  // Margen y rentabilidad
  "margen","rentabilidad","ganancia","utilidad",
  // Categorías
  "categoria","por categoria",
  // Vendedores sin ventas
  "sin ventas","vendedor sin venta","no vendio"
]);

const INTENCION = {
  CONVERSACIONAL: "conversacional",
  REPORTE_PDF:    "reporte_pdf",
  CONSULTA_SQL:   "consulta_sql",
  DESCONOCIDO:    "desconocido",
};

// Palabras que indican corrección/continuación de contexto
const PATRONES_CORRECCION = [
  /^(perd[oó]n|disculpa|corrig[eo]|quise\s+decir|me\s+equivoqu[eé]|en\s+realidad|mejor\s+dicho)/i,
  /^(no[,\s]+quiero|en\s+cambio|sino|pero\s+el|el\s+d[ií]a|la\s+fecha|del\s+mes|del\s+a[ñn]o)/i,
  /^\d{1,2}\s+de\s+\w+/i,
  /^(el\s+)?\d{1,2}[\/-]\d{1,2}([\/-]\d{2,4})?$/i,
  // Fragmentos que completan una pregunta anterior
  /^del\s+\w+/i,           // "del tia", "del cliente X"
  /^de\s+(la|el|los|las)\s+\w+/i,
  /^con\s+(fecha|el|la)/i,
];

// Patrones de verificación: el usuario duda del resultado y pide confirmar,
// o pregunta por el origen de un valor ya dado.
// En estos casos se reutilizan los datos ya obtenidos en lugar de generar nuevo SQL.
const PATRONES_VERIFICACION = [
  /est[aá]s?\s+seguro/i,
  /verifica(\s+(bien|de\s+nuevo|eso|el\s+dato))?/i,
  /conf[íi]rm[ao](me)?(\s+(el\s+dato|eso|el\s+resultado))?/i,
  /es\s+(correcto|exacto|cierto|eso)/i,
  /^(seguro|correcto|exacto)\??[\s!.]*$/i,
  /revisa(\s+(bien|de\s+nuevo))?/i,
  /comprueba/i,
  /por\s+qu[eé]\s+(me\s+(diste|dijiste|daba[sz]?)|ten[ií]a[sz]?)\s+otro/i,
  // Preguntas sobre el origen/fuente de un valor ya dado
  /de\s+d[oó]nde?\s+(sale|viene|sac[ao]|obtuv)/i,
  /c[oó]mo\s+(calculaste|obtuviste|sacaste|llegaste)/i,
  /por\s+qu[eé]\s+(dices?|me\s+dices?|dijiste|sale|aparece|figura)\s+.*(valor|total|monto|dato|cifra|n[uú]mero)/i,
  /c[oó]mo\s+es\s+posible\s+que/i,
  /eso\s+no\s+(coincide|cuadra|bate)/i,
  /los\s+n[uú]meros?\s+no\s+(coinciden|cuadran|baten)/i,
  /hay\s+una?\s+diferencia/i,
  /y\s+entonces\s+de\s+d[oó]nde/i,
];

// Patrones que piden PDF explícitamente (incluso sin "reporte" completo)
const PATRONES_PEDIR_PDF = [
  /dame\s+(el\s+)?(pdf|reporte)/i,
  /gen[eé]ra?(me)?\s+(el\s+)?(pdf|reporte)/i,
  /me\s+puedes?\s+gen[eé]ra?r?\s+(el\s+)?(pdf|reporte)/i,
  /pu[eé]des?\s+gen[eé]ra?(me)?\s+(el\s+)?(pdf|reporte)/i,
  /quiero\s+(el\s+)?(pdf|reporte)/i,
  /exporta?(me)?\s+(el\s+)?pdf/i,
  /descarga?(me)?\s+(el\s+)?pdf/i,
  /necesito\s+(el\s+)?(pdf|reporte)/i,
  /haz(me)?\s+(el\s+)?(pdf|reporte)/i,
  /crea(me)?\s+(el\s+)?(pdf|reporte)/i,
  /manda(me)?\s+(el\s+)?(pdf|reporte)/i,
  /muestra(me)?\s+(el\s+)?(pdf|reporte)/i,
  /^(el\s+)?pdf[\s!.]*$/i,
  /^reporte[\s!.]*$/i,
  /pdf\s*$/i,
  /reporte\s*$/i,
];

// Detecta si el mensaje contiene criterios de datos concretos
// (fecha, nombre de cliente, ruta, etc.) además de pedir el PDF
function tienecriteriosDatos(texto) {
  const t = texto.toLowerCase();
  return (
    /\d{1,2}\s+de\s+\w+/.test(t) ||          // "3 de febrero"
    /\d{4}/.test(t) ||                         // año "2026"
    /\d{1,2}\/\d{1,2}/.test(t) ||             // "03/02"
    /hoy|ayer|semana|mes|enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre/.test(t) ||
    /cliente|tia|supermaxi|coral|aki|ruta|vendedor|producto/.test(t)
  );
}

function clasificarIntencion(mensaje, historial = []) {
  const texto = mensaje.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const esPedidoPDF = PATRONES_PEDIR_PDF.some(p => p.test(mensaje.trim()));

  // ── 1. Pide PDF + tiene criterios propios → REPORTE_PDF directo ─────
  //    Ej: "muestrame el reporte de ventas del 3 de febrero 2026 dame el pdf"
  if (esPedidoPDF && tienecriteriosDatos(texto)) {
    console.log("📄 PDF con criterios propios en el mensaje");
    return INTENCION.REPORTE_PDF;
  }

  // ── 2. Pide PDF sin criterios → reusar datos del turno anterior ──────
  //    Ej: "dame el pdf", "me puedes generar el pdf"
  if (esPedidoPDF) {
    if (historial.length > 0) {
      console.log("📄 Solicitud PDF — reutilizando contexto del historial");
      return INTENCION.REPORTE_PDF;
    }
    // Sin historial y sin criterios: pedir que especifique
    return INTENCION.DESCONOCIDO;
  }

  // ── 3. ¿Es corrección/fragmento con historial? ──────────────────────
  if (historial.length > 0 && PATRONES_CORRECCION.some(p => p.test(mensaje.trim()))) {
    console.log("🔄 Corrección/fragmento detectado — usando historial");
    return INTENCION.CONSULTA_SQL;
  }

  // ── 4. Reporte PDF por keywords sin "pdf" explícito ─────────────────
  //    Ej: "reporte ventas hoy", "reporte por ruta"
  if (detectarTipoReporte(mensaje)) return INTENCION.REPORTE_PDF;

  // ── 5. Consulta SQL por keywords — antes que conversacional ─────────
  // Así "cuáles son los clientes activos" → SQL y no conversacional
  for (const p of PALABRAS_CLAVE_SQL) {
    if (texto.includes(p)) return INTENCION.CONSULTA_SQL;
  }

  // ── 6. Conversacional puro (solo si no hay keywords de negocio) ──────
  if (PATRONES_CONVERSACIONAL.some(p => p.test(mensaje))) return INTENCION.CONVERSACIONAL;

  // ── 7. Mensaje corto con historial → continuación ───────────────────
  if (historial.length > 0 && mensaje.trim().split(" ").length <= 8) {
    console.log("🔄 Mensaje corto con historial — continuación SQL");
    return INTENCION.CONSULTA_SQL;
  }

  return INTENCION.DESCONOCIDO;
}

// ═══════════════════════════════════════════════════
// RESPUESTA CONVERSACIONAL (con historial)
// ═══════════════════════════════════════════════════
async function respuestaConversacional(mensaje, usuario, historial) {
  const systemPrompt = {
    role: "system",
    content: `Eres el asistente virtual del ERP Grupo Aqua. Eres amigable, profesional y conversacional.

Puedes ayudar con:

📊 CONSULTAS EN TIEMPO REAL (responde en el chat):
- Ventas del día, semana o mes
- Clientes con mayor consumo  
- Productos más vendidos
- Estado de rutas y vendedores
- Historial de visitas
- Sincronizaciones

📄 REPORTES PDF (se generan y descargan):
- "reporte ventas hoy" → Ventas del día
- "reporte ventas semana" → Ventas semanal  
- "reporte ventas mes" → Ventas mensual
- "reporte por ruta" → Por ruta
- "reporte por vendedor" → Por vendedor
- "top productos" → Productos más vendidos
- "top clientes" → Mejores clientes
- "reporte visitas" → Historial de visitas
- "reporte sincronizacion" → Sincronizaciones

Cuando saluden, saluda cordialmente e invita a consultar.
Cuando agradezcan, responde brevemente y ofrece más ayuda.
Nunca menciones SQL, tablas ni términos técnicos.
Responde siempre en español. Máximo 3 párrafos cortos.`
  };

  const completion = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    temperature: 0.6,
    max_tokens: 600,
    messages: [
      systemPrompt,
      ...historial,                        // ← contexto previo
      { role: "user", content: mensaje }
    ]
  });
  return completion.choices[0].message.content.trim();
}

// ═══════════════════════════════════════════════════
// CONSTRUIR PREGUNTA CON CONTEXTO PARA SQL/PDF
// Combina el mensaje actual con el historial cuando es
// una corrección, fragmento o solicitud de PDF contextual
// ═══════════════════════════════════════════════════
function construirPreguntaConContexto(mensaje, historial, intencion) {
  if (historial.length === 0) return mensaje;

  // Buscar el último mensaje del usuario que contiene keywords de negocio.
  // Esto evita perder el contexto cuando hay mensajes intermedios sin datos de dominio
  // (ej: "estas seguro verifica bien" entre "cuanto vendio ROSADO este mes" y "en total")
  const mensajesUser = historial.filter(m => m.role === "user");
  const ultimoUserConKeywords = [...mensajesUser].reverse().find(m => {
    const t = m.content.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    return [...PALABRAS_CLAVE_SQL].some(k => t.includes(k));
  });
  const ultimoUser = ultimoUserConKeywords || [...historial].reverse().find(m => m.role === "user");

  if (!ultimoUser) return mensaje;

  const esFragmento =
    PATRONES_CORRECCION.some(p => p.test(mensaje.trim())) ||
    mensaje.trim().split(" ").length <= 8;

  const esPedidoPDF = PATRONES_PEDIR_PDF.some(p => p.test(mensaje.trim()));

  // Si pide PDF → construir pregunta de reporte completa con contexto
  if (esPedidoPDF || intencion === INTENCION.REPORTE_PDF) {
    // Usar solo mensajes con keywords para no contaminar con verificaciones o saludos
    const contextoCompleto = mensajesUser
      .filter(m => {
        const t = m.content.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        return [...PALABRAS_CLAVE_SQL].some(k => t.includes(k));
      })
      .map(m => m.content)
      .join(" | ");
    const base = contextoCompleto || mensajesUser.map(m => m.content).join(" | ");
    const combinada = `Genera un reporte PDF con los siguientes criterios de la conversación: ${base}. Solicitud actual: ${mensaje}`;
    console.log(`📄 Pregunta PDF con contexto: "${combinada}"`);
    return combinada;
  }

  // Si es fragmento/corrección → combinar con el último mensaje sustantivo de negocio
  if (esFragmento) {
    const combinada = `${ultimoUser.content} — aclaración del usuario: "${mensaje}"`;
    console.log(`🔄 Pregunta combinada con base "${ultimoUser.content}": "${combinada}"`);
    return combinada;
  }

  return mensaje;
}

// ═══════════════════════════════════════════════════
// RESPUESTA SIN DATOS — mensaje contextual e inteligente
// No dice "verifica los criterios" sino explica que no
// hay registros para lo consultado
// ═══════════════════════════════════════════════════
async function generarRespuestaSinDatos(pregunta, historial) {
  const completion = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    temperature: 0.4,
    max_tokens: 200,
    messages: [
      {
        role: "system",
        content: `Eres el asistente del ERP Grupo Aqua. El usuario hizo una consulta válida sobre el sistema pero la base de datos no devolvió ningún registro.

Tu tarea: redactar UN mensaje corto (máximo 2 oraciones) explicando de forma natural que no hay datos para ese criterio específico.

Reglas:
- Menciona específicamente qué se buscó (fecha, cliente, ruta, etc.) si está claro en la pregunta.
- NUNCA digas "verifica los criterios" ni "intenta de nuevo" ni sugieras que el usuario cometió un error.
- El tono debe ser informativo y amigable: simplemente no hay información registrada para ese período o criterio.
- No menciones SQL, tablas ni términos técnicos.
- Responde en español.

Ejemplos:
  Pregunta: "ventas del 4 de marzo 2026"
  Respuesta: "No hay ventas registradas para el 4 de marzo de 2026 en el sistema."

  Pregunta: "clientes de la ruta PV1 hoy"
  Respuesta: "No se encontraron clientes activos en la ruta PV1 para el día de hoy."

  Pregunta: "facturas del cliente AKI en febrero"
  Respuesta: "No hay facturas registradas para el cliente AKI durante el mes de febrero."`
      },
      ...historial.slice(-4),
      { role: "user", content: pregunta }
    ]
  });
  return completion.choices[0].message.content.trim();
}


async function generarRespuestaHumana(pregunta, datos, historial) {
  // Para datasets grandes usamos un resumen estadístico en lugar de truncar.
  // EXCEPCIÓN: si los datos parecen ser detalle agrupado de productos (tienen campo producto/descripcion
  // y monto_total), mostramos todos ya que el GROUP BY ya los consolidó.
  // Solo evitar resumen estadístico cuando los datos son claramente un listado de productos
  // agrupados (tienen alias "producto" o "nombre_producto" del GROUP BY)
  // No incluir "descripcion" porque es un campo genérico que aparece en muchas tablas
  const tieneCampoProducto = datos.length > 0 &&
    Object.keys(datos[0]).some(k => ["producto", "nombre_producto"].includes(k.toLowerCase()));
  const esVolumenGrande = datos.length > 50 && !tieneCampoProducto;

  const contenidoDatos  = esVolumenGrande
    ? construirResumenEstadistico(datos)
    : datos;
  const notaVolumen = esVolumenGrande
    ? `\n\nNOTA IMPORTANTE: Los datos son un RESUMEN ESTADÍSTICO de ${datos.length} registros totales (no el listado completo). Describe cifras agregadas (totales, promedios, rangos máximos/mínimos). NO digas "los primeros N registros" — describe el conjunto completo.`
    : datos.length > 50 && tieneCampoProducto
    ? `\n\nNOTA: Se muestran ${datos.length} productos consolidados. Presenta la lista completa ordenada por monto de mayor a menor.`
    : "";

  const systemPrompt = {
    role: "system",
    content: `Eres el asistente de inteligencia de negocios del ERP Grupo Aqua, integrado en un dashboard de análisis operacional.
Tu única tarea es transformar los resultados de consultas a la base de datos en respuestas claras, profesionales y estructuradas.

## REGLAS DE ORO

1. NUNCA inventes, asumas ni estimes cifras. Si el dato no está en los resultados, no lo menciones.
2. NUNCA muestres JSON, SQL, nombres de columnas técnicas ni términos de base de datos.
3. Basa TODAS las conclusiones exclusivamente en los datos recibidos.
4. Si los resultados están vacíos o son nulos, indica claramente que no hay información disponible para ese criterio.
5. Mantén coherencia con el hilo de la conversación anterior.
6. CRITICO — Totales de líneas de producto vs totales de factura:
   Cuando los datos muestran líneas de detalle de productos (descripcion, cantidad, monto_total por producto),
   el total_unidades y monto_total son POR PRODUCTO, no el total general del cliente.
   NUNCA digas "el total del cliente en ese periodo fue $X" usando la suma de líneas de producto,
   ya que ese valor puede diferir del total de facturas (que incluye impuestos, envíos, etc.).
   En este caso, presenta SOLO los productos con sus cantidades y montos individuales.
   Si el usuario preguntó antes por el total en dólares, NO lo contradiga con un total de líneas.

## FORMATO NUMÉRICO

Usa siempre formato hispano: punto para miles, coma para decimales.
Ejemplos: 1.250,50 — 34.800,00 — 150

## FORMATO DE RESPUESTA SEGÚN TIPO DE CONSULTA

### Rankings (top productos, top vendedores, top rutas, más vendido, etc.)

Presenta SIEMPRE como lista numerada ordenada de mayor a menor según el dato principal.
Incluye el valor relevante junto a cada ítem (cantidad, monto, etc.).

Ejemplo de formato correcto:
─────────────────────────────
Productos más vendidos este mes:

1. Botellón Aqua Premium 20L — 4.320 unidades
2. Botellón Aqua 20L — 2.180 unidades
3. Hielo 5kg — 980 unidades
─────────────────────────────

### Consultas de cliente o ruta específica

Presenta los datos del cliente/ruta claramente: nombre, totales, estado.

### KPIs / métricas únicas

Responde en una oración directa con el valor exacto.
Ejemplo: "El total de ventas del día de hoy es $12.450,30."

### Tablas o listados generales

Usa listas con viñetas si hay múltiples registros sin jerarquía clara.

## REGLAS PARA PREGUNTAS DE NEGOCIO FRECUENTES

- "¿Cuál es el producto más vendido?" → El primer registro en los resultados ES el más vendido (la consulta ya viene ordenada DESC). Repórtalo exactamente como aparece. NUNCA reordenes ni cambies el orden.
- "Top productos / Top clientes / Top vendedores" → Lista numerada siguiendo el ORDEN EXACTO de los registros recibidos (posición 1 = primer registro, posición 2 = segundo, etc.). No reordenes por tu cuenta.
- "¿Qué vendedor vendió más?" → Toma el primer registro del resultado. Si tiene seller_code en lugar de nombre, preséntalo como código de vendedor.
- "Ventas por ruta / canal" → Agrupa y presenta por ruta/canal con sus totales siguiendo el orden del resultado.
- "¿Cuál fue la última factura?" → El primer registro del resultado ES la última (más reciente). Muestra código, cliente, fecha y monto.

## MANEJO DE DATOS INCOMPLETOS

- Si los resultados están truncados (más de 50 registros), agrégalo al final:
  "ℹ️ Se muestran los primeros 50 resultados de un total de [N]."
- Si algún campo está vacío, null o "null" como texto, omítelo completamente en la respuesta.
- Si seller_code aparece sin nombre del vendedor, preséntalo como "Vendedor [código]".
- Si un monto es 0 o null, no lo menciones a menos que sea relevante para la consulta.
- NUNCA muestres corchetes, llaves, comillas, ni ningún símbolo técnico de JSON en la respuesta.

## TONO

Cordial, conciso y ejecutivo. Máximo 3-4 párrafos o la lista numerada cuando aplique.
Responde siempre en español.`
  };

  const completion = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    temperature: 0.3,
    max_tokens: 1000,
    messages: [
      systemPrompt,
      ...historial,   // ← contexto de la conversación
      {
        role: "user",
        content: `Pregunta: ${pregunta}${notaVolumen}\n\nResultados:\n${JSON.stringify(contenidoDatos)}`
      }
    ]
  });
  return completion.choices[0].message.content.trim();
}

// ═══════════════════════════════════════════════════
// REINTENTO AUTOMÁTICO SQL
// ═══════════════════════════════════════════════════
function esErrorConexionDB(error) {
  const msg = (error?.parent?.message || error?.message || "").toLowerCase();
  return (
    msg.includes("econnrefused") || msg.includes("etimedout") ||
    msg.includes("enotfound") || msg.includes("connect") ||
    error?.name === "SequelizeConnectionError" ||
    error?.name === "SequelizeConnectionRefusedError" ||
    error?.name === "SequelizeHostNotFoundError"
  );
}

async function ejecutarConReintento(mensaje, rol, seller_code, sql) {
  try {
    return await ejecutarSQL(sql);
  } catch (sqlError) {
    // Si es un error de conexión, no tiene sentido reintentar con SQL diferente
    if (esErrorConexionDB(sqlError)) throw sqlError;

    const mensajeError = sqlError.parent?.message || sqlError.message || "Error";
    console.warn("⚠️  SQL falló, reintentando...", mensajeError);
    let sqlCorregido;
    try {
      sqlCorregido = await generarSQL(mensaje, rol, seller_code, sql, mensajeError);
    } catch { throw new Error("NO_REGENERAR"); }
    if (!validarSQL(sqlCorregido)) throw new Error("SQL_INVALIDO");
    sqlCorregido = aplicarLimite(sqlCorregido, 200);
    try {
      const datos = await ejecutarSQL(sqlCorregido);
      console.log("✅ Reintento exitoso");
      return datos;
    } catch (retryErr) {
      if (esErrorConexionDB(retryErr)) throw retryErr;
      throw new Error("REINTENTO_FALLIDO");
    }
  }
}

// ═══════════════════════════════════════════════════
// HANDLER: Descargar PDF
// ═══════════════════════════════════════════════════
async function descargarReporteHandler(req, res) {
  const { filename } = req.params;
  if (!filename || !/^reporte_[a-f0-9]+\.pdf$/.test(filename)) {
    return res.status(400).json({ error: "Archivo inválido" });
  }
  const filePath = path.join(PDF_DIR, filename);
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: "Reporte no encontrado o expirado (30 min)" });
  }
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  fs.createReadStream(filePath).pipe(res);
}

// ═══════════════════════════════════════════════════
// HANDLER PRINCIPAL
// ═══════════════════════════════════════════════════
async function chatHandler(req, res) {
  const inicio = Date.now();
  console.log("----- INICIO CHAT HANDLER -----");

  try {
    const { mensaje } = req.body;
    const { usuario, rol, seller_code } = req.user;

    console.log(`Usuario: ${usuario} | Rol: ${rol} | Mensaje: "${mensaje}"`);

    // ── Validaciones ───────────────────────────────
    if (!mensaje?.trim()) return res.status(400).json({ respuesta: "El mensaje no puede estar vacío." });
    if (mensaje.length > 500) return res.status(400).json({ respuesta: "Mensaje demasiado largo. Máximo 500 caracteres." });
    if (!checkRateLimit(usuario)) return res.status(429).json({ respuesta: "Demasiadas consultas. Espera un momento." });

    // ── Obtener historial del usuario ──────────────
    const historial = getHistorial(usuario);
    console.log(`💬 Historial: ${historial.length} mensajes previos`);

    // ── Clasificar intención (con contexto) ────────
    const intencion = clasificarIntencion(mensaje, historial);
    console.log(`🎯 Intención: ${intencion}`);

    // ════════════════════════════════════════════════
    // RAMA: CONVERSACIONAL
    // ════════════════════════════════════════════════
    if (intencion === INTENCION.CONVERSACIONAL) {
      const respuesta = await respuestaConversacional(mensaje, usuario, historial);
      // Guardar en historial
      agregarAlHistorial(usuario, "user", mensaje);
      agregarAlHistorial(usuario, "assistant", respuesta);
      console.log(`✅ Conversacional (${Date.now() - inicio}ms)`);
      return res.json({ respuesta });
    }

    // ════════════════════════════════════════════════
    // RAMA: DESCONOCIDO (sin historial)
    // ════════════════════════════════════════════════
    if (intencion === INTENCION.DESCONOCIDO) {
      // Si pide PDF sin contexto, dar una guía útil
      const esPedidoPDF = PATRONES_PEDIR_PDF.some(p => p.test(mensaje.trim()));
      const respuesta = esPedidoPDF
        ? "Para generar el reporte necesito saber qué datos incluir. Por ejemplo: \"reporte de ventas de hoy\", \"reporte del cliente TIA de marzo\" o \"reporte por ruta\"."
        : "No estoy seguro de entender tu consulta. Puedo ayudarte con ventas, clientes, productos, rutas, visitas y reportes. ¿Podrías indicar qué información necesitas?";
      agregarAlHistorial(usuario, "user", mensaje);
      agregarAlHistorial(usuario, "assistant", respuesta);
      return res.json({ respuesta });
    }

    // ── Construir pregunta con contexto (si es corrección o PDF contextual) ──
    const preguntaFinal = construirPreguntaConContexto(mensaje, historial, intencion);

    // ════════════════════════════════════════════════
    // RAMA A: GENERAR PDF
    // ════════════════════════════════════════════════
    if (intencion === INTENCION.REPORTE_PDF) {
      const esPedidoPDF   = PATRONES_PEDIR_PDF.some(p => p.test(mensaje.trim()));
      const tieneCriterios = tienecriteriosDatos(mensaje.toLowerCase());
      const datosPrevios  = getUltimosDatos(usuario);

      let datos     = null;
      let origenDatos = "bd";

      // ── Caso 1: pide PDF sin criterios propios → reusar datos del turno anterior
      if (esPedidoPDF && !tieneCriterios && datosPrevios) {
        datos = datosPrevios.datos;
        origenDatos = "cache_sesion";
        console.log(`♻️  Reutilizando ${datos.length} registros de sesión para el PDF`);
      }

      // ── Caso 2: tiene sus propios criterios (o no hay datos previos) → consultar BD
      if (!datos) {
        // Limpiar la pregunta: quitar la parte "dame el pdf / muestrame el pdf / necesito el reporte"
        // para que la IA genere SQL limpio sobre los criterios reales
        const preguntaSQL = mensaje
          .replace(/[,.]?\s*(y\s+)?(necesito|quiero|haz(me)?|crea(me)?|manda(me)?|exporta(me)?|descarga(me)?|muestra(me)?|dame|gen[eé]ra?(me)?|pu[eé]des?\s+gen[eé]ra?(me)?|me\s+puedes?\s+gen[eé]ra?r?)\s+(el\s+)?(pdf|reporte)/gi, "")
          .replace(/\s+/g, " ").trim() || preguntaFinal;

        console.log(`🔍 Pregunta SQL limpia para PDF: "${preguntaSQL}"`);

        let sql = await generarSQL(preguntaSQL, rol, seller_code);
        console.log("🧠 SQL para PDF:", sql);

        if (/^SELECT\s+1\s+WHERE\s+(FALSE|1\s*=\s*0|0\s*=\s*1)/i.test(sql.trim())) {
          const respuesta = "No logré interpretar esa consulta para el reporte. ¿Podrías indicar el cliente, la ruta o el período?";
          agregarAlHistorial(usuario, "user", mensaje);
          agregarAlHistorial(usuario, "assistant", respuesta);
          return res.json({ respuesta });
        }

        if (!validarSQL(sql)) {
          const respuesta = "Esa consulta no puede procesarse para el reporte. Intenta con una pregunta diferente.";
          agregarAlHistorial(usuario, "user", mensaje);
          agregarAlHistorial(usuario, "assistant", respuesta);
          return res.json({ respuesta });
        }
        sql = aplicarLimite(sql, 1000);

        try {
          datos = await ejecutarConReintento(preguntaSQL, rol, seller_code, sql);
          // Auditar la consulta ejecutada (no bloqueante)
          registrarAuditoria(usuario, rol, mensaje, sql, datos.length, Date.now() - inicio).catch(() => {});
        } catch (err) {
          const respuesta =
            err.message === "NO_REGENERAR"      ? "No pude procesar esa consulta para el reporte." :
            err.message === "SQL_INVALIDO"       ? "Esa consulta no puede procesarse para el reporte." :
            err.message === "REINTENTO_FALLIDO"  ? "No logré obtener los datos. Intenta indicar el cliente, ruta o fecha exacta." :
            (() => { throw err; })();
          agregarAlHistorial(usuario, "user", mensaje);
          agregarAlHistorial(usuario, "assistant", respuesta);
          return res.json({ respuesta });
        }
      }

      if (!datos || datos.length === 0) {
        const respuesta = await generarRespuestaSinDatos(preguntaFinal, historial);
        agregarAlHistorial(usuario, "user", mensaje);
        agregarAlHistorial(usuario, "assistant", respuesta);
        return res.json({ respuesta });
      }

      const tipoReporte = detectarTipoReporte(preguntaFinal) || detectarTipoReporte(mensaje) || "generico";
      console.log(`📄 PDF tipo: ${tipoReporte} — ${datos.length} registros (origen: ${origenDatos})`);

      // ── Transformación especial para KPI: una fila horizontal → filas indicador/valor
      let datosParaPDF = datos;
      if (tipoReporte === "kpi_dia" && datos.length > 0) {
        const LABELS_KPI = {
          ventas_dia:          "Ventas del Día ($)",
          facturas_dia:        "Facturas Emitidas",
          clientes_facturados: "Clientes Facturados",
          visitas_dia:         "Visitas Realizadas",
          clientes_visitados:  "Clientes Visitados",
        };
        datosParaPDF = Object.entries(datos[0]).map(([key, val]) => ({
          indicador: LABELS_KPI[key] || key.replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase()),
          valor:     val != null ? String(val) : "-",
        }));
      }

      const config = construirConfigReporte(tipoReporte, datosParaPDF, usuario);
      const pdfBuffer = await generarPDF(config);
      const filename = `reporte_${crypto.randomBytes(8).toString("hex")}.pdf`;
      const filePath = path.join(PDF_DIR, filename);
      fs.writeFileSync(filePath, pdfBuffer);
      setTimeout(() => { try { fs.unlinkSync(filePath); } catch {} }, 30 * 60 * 1000);

      const respuesta = `✅ Reporte **${config.titulo}** generado con **${datos.length} registros**. Haz clic para descargarlo.`;
      agregarAlHistorial(usuario, "user", mensaje);
      agregarAlHistorial(usuario, "assistant", respuesta);

      return res.json({
        respuesta,
        esPDF: true,
        pdfUrl: `/api/bot/reporte/${filename}`,
        pdfNombre: `${config.titulo.replace(/\s+/g, "_")}.pdf`,
        totalRegistros: datos.length,
      });
    }

    // ── Verificación: el usuario duda del resultado o pregunta por el origen de un valor ──
    // En lugar de generar un SQL diferente que puede dar otro número,
    // se reutilizan los datos ya obtenidos y se reconfirma la respuesta.
    const esVerificacion = PATRONES_VERIFICACION.some(p => p.test(mensaje));
    const datosCacheados = getUltimosDatos(usuario);
    if (esVerificacion && historial.length > 0) {
      if (datosCacheados && datosCacheados.datos.length > 0) {
        // Tenemos datos previos → reconfirmar con los mismos datos
        console.log(`✅ Verificación detectada — reusando ${datosCacheados.datos.length} registros previos`);
        const respuestaVerif = await generarRespuestaHumana(datosCacheados.pregunta, datosCacheados.datos, historial);
        const confirmacion = `He recalculado el resultado con los mismos datos obtenidos. ${respuestaVerif}`;
        agregarAlHistorial(usuario, "user", mensaje);
        agregarAlHistorial(usuario, "assistant", confirmacion);
        return res.json({ respuesta: confirmacion });
      } else {
        // La consulta anterior no devolvió datos — aclarar en lugar de generar SQL nuevo
        console.log("⚠️  Verificación sin datos previos — explicando que no hubo resultados");
        const ultimaRespBot = [...historial].reverse().find(m => m.role === "assistant");
        const aclaracion = ultimaRespBot
          ? `La consulta anterior no encontró registros en la base de datos, por eso no hay valores que mostrar. ¿Podrías reformular la pregunta con otros criterios?`
          : `No tengo resultados previos que verificar. ¿Podrías repetir la consulta?`;
        agregarAlHistorial(usuario, "user", mensaje);
        agregarAlHistorial(usuario, "assistant", aclaracion);
        return res.json({ respuesta: aclaracion });
      }
    }

    // ── Caché (solo consultas normales sin corrección) ──
    const cacheKey = getCacheKey(preguntaFinal, rol, seller_code);
    if (intencion === INTENCION.CONSULTA_SQL && preguntaFinal === mensaje) {
      const cached = getFromCache(cacheKey);
      if (cached) {
        console.log(`⚡ Caché (${Date.now() - inicio}ms)`);
        agregarAlHistorial(usuario, "user", mensaje);
        agregarAlHistorial(usuario, "assistant", cached);
        return res.json({ respuesta: cached, fromCache: true });
      }
    }

    // ── 1️⃣  Generar SQL ───────────────────────────
    let sql = await generarSQL(preguntaFinal, rol, seller_code);
    sql = corregirSQLTotalMonetario(preguntaFinal, sql); // 🔧 corrección programática
    console.log("🧠 SQL:", sql);
    if (/^SELECT\s+1\s+WHERE\s+(FALSE|1\s*=\s*0|0\s*=\s*1)/i.test(sql.trim())) {
      const respuesta = "No logré interpretar esa consulta. ¿Podrías darme más detalles, como el nombre del cliente, la ruta o el período?";
      agregarAlHistorial(usuario, "user", mensaje);
      agregarAlHistorial(usuario, "assistant", respuesta);
      return res.json({ respuesta });
    }

    // ── 2️⃣  Validar ───────────────────────────────
    if (!validarSQL(sql)) {
      const respuesta = "Esa consulta no puede procesarse. Intenta con una pregunta diferente.";
      agregarAlHistorial(usuario, "user", mensaje);
      agregarAlHistorial(usuario, "assistant", respuesta);
      return res.json({ respuesta });
    }

    // ── 3️⃣  Límite ────────────────────────────────
    sql = aplicarLimite(sql, 5000);

    // ── 4️⃣  Ejecutar ──────────────────────────────
    let datos;
    try {
      datos = await ejecutarConReintento(preguntaFinal, rol, seller_code, sql);
      // Auditar la consulta ejecutada (no bloqueante)
      registrarAuditoria(usuario, rol, mensaje, sql, datos.length, Date.now() - inicio).catch(() => {});
    } catch (err) {
      const respuesta =
        err.message === "NO_REGENERAR"      ? "No pude interpretar esa consulta. ¿Podrías reformularla con más detalle?" :
        err.message === "SQL_INVALIDO"      ? "Esa consulta no puede procesarse. Intenta con una pregunta diferente." :
        err.message === "REINTENTO_FALLIDO" ? "No logré obtener los datos. Intenta indicar el nombre exacto del cliente, la ruta o la fecha." :
        (() => { throw err; })();
      agregarAlHistorial(usuario, "user", mensaje);
      agregarAlHistorial(usuario, "assistant", respuesta);
      return res.json({ respuesta });
    }

    console.log("📊 Registros:", datos?.length ?? 0);

    if (!datos || datos.length === 0) {
      // Generar mensaje contextual según lo que el usuario preguntó
      const respuesta = await generarRespuestaSinDatos(preguntaFinal, historial);
      agregarAlHistorial(usuario, "user", mensaje);
      agregarAlHistorial(usuario, "assistant", respuesta);
      return res.json({ respuesta });
    }

    // ── Guardar datos en sesión para PDF futuro ────
    guardarUltimosDatos(usuario, datos, preguntaFinal);

    // ════════════════════════════════════════════════
    // RAMA B: RESPUESTA NORMAL
    // ════════════════════════════════════════════════
    const respuestaHumana = await generarRespuestaHumana(preguntaFinal, datos, historial);

    if (preguntaFinal === mensaje) setCache(cacheKey, respuestaHumana);
    agregarAlHistorial(usuario, "user", mensaje);
    agregarAlHistorial(usuario, "assistant", respuestaHumana);

    console.log(`✅ Listo (${Date.now() - inicio}ms)`);
    return res.json({ respuesta: respuestaHumana });

  } catch (error) {
    console.error("❌ ERROR:", error);

    // Detectar errores de conexión a la base de datos o a la API
    const msg = (error.message || "").toLowerCase();
    const isDbError =
      msg.includes("connect") || msg.includes("connection") ||
      msg.includes("econnrefused") || msg.includes("etimedout") ||
      msg.includes("enotfound") || msg.includes("sequelize") ||
      error.name === "SequelizeConnectionError" ||
      error.name === "SequelizeConnectionRefusedError" ||
      error.name === "SequelizeHostNotFoundError";

    const isApiError =
      msg.includes("openai") || msg.includes("api key") ||
      msg.includes("rate limit") || msg.includes("quota") ||
      error.status === 429 || error.status === 503;

    if (isDbError) {
      return res.status(500).json({
        respuesta: "Hubo un problema temporal al conectar con el servidor de datos. Por favor intenta de nuevo en unos segundos.",
      });
    }
    if (isApiError) {
      return res.status(500).json({
        respuesta: "El servicio de análisis está temporalmente saturado. Por favor intenta de nuevo en un momento.",
      });
    }

    return res.status(500).json({ respuesta: "Ocurrió un error interno. Por favor intenta de nuevo." });
  }
}

// Handler para limpiar historial manualmente (útil para logout)
async function limpiarHistorialHandler(req, res) {
  const { usuario } = req.user;
  limpiarHistorial(usuario);
  return res.json({ ok: true, mensaje: "Historial de conversación limpiado." });
}

module.exports = { chatHandler, descargarReporteHandler, limpiarHistorialHandler };