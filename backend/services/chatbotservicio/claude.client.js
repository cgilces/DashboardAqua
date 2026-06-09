// services/chatbotservicio/claude.client.js
// Cliente único de Claude (Anthropic) para todo el chatbot del ERP Grupo Aqua.
// Reemplaza al cliente de OpenAI. Centraliza el modelo y un helper de chat
// equivalente a openai.chat.completions.create para minimizar cambios.

const Anthropic = require("@anthropic-ai/sdk");
require("dotenv").config();

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// Modelo configurable por .env. Por defecto Sonnet 4.6 (mejor relación
// calidad/costo para texto→SQL y respuestas). Para análisis más pesados se
// puede poner CLAUDE_MODEL=claude-opus-4-8 sin tocar código.
const CLAUDE_MODEL = process.env.CLAUDE_MODEL || "claude-sonnet-4-6";

// ───────────────────────────────────────────────────────────────────────────
// Sanitiza el historial al formato que exige la API de Claude:
// - los mensajes deben empezar SIEMPRE por un turno "user"
// - solo se permiten roles "user" / "assistant" (el system va aparte)
// ───────────────────────────────────────────────────────────────────────────
function sanitizarMensajes(mensajes) {
  const limpios = (mensajes || [])
    .filter((m) => m && (m.role === "user" || m.role === "assistant") && m.content != null)
    .map((m) => ({ role: m.role, content: String(m.content) }));

  // Eliminar mensajes "assistant" iniciales: Claude exige que el primero sea "user"
  while (limpios.length > 0 && limpios[0].role === "assistant") {
    limpios.shift();
  }
  return limpios;
}

// Extrae el texto plano concatenando los bloques de texto de la respuesta.
function extraerTexto(respuesta) {
  if (!respuesta || !Array.isArray(respuesta.content)) return "";
  return respuesta.content
    .filter((b) => b.type === "text")
    .map((b) => b.text)
    .join("")
    .trim();
}

// ───────────────────────────────────────────────────────────────────────────
// Helper de chat. Equivalente conceptual a openai.chat.completions.create,
// pero con la API de mensajes de Claude (el system prompt va como parámetro
// aparte, no como un mensaje más).
//
//   claudeChat({ system, messages, maxTokens, temperature })  -> string
//
//   - system:      string del prompt de sistema
//   - messages:    array [{ role: "user"|"assistant", content }]
//   - maxTokens:   tope de tokens de salida
//   - temperature: 0..1 (Sonnet 4.6 lo admite; se ignora en Opus 4.7/4.8)
// ───────────────────────────────────────────────────────────────────────────
async function claudeChat({ system, messages, maxTokens = 1000, temperature }) {
  const params = {
    model: CLAUDE_MODEL,
    max_tokens: maxTokens,
    messages: sanitizarMensajes(messages),
  };
  if (system) params.system = system;

  // Opus 4.7/4.8 rechazan temperature; Sonnet 4.6 sí la admite.
  // Solo la enviamos cuando el modelo no es de la familia Opus 4.7+.
  if (temperature != null && !/opus-4-(7|8)/.test(CLAUDE_MODEL)) {
    params.temperature = temperature;
  }

  const respuesta = await anthropic.messages.create(params);
  return extraerTexto(respuesta);
}

module.exports = { anthropic, CLAUDE_MODEL, claudeChat, extraerTexto };
