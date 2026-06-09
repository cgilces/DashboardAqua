// services/chatbotservicio/voz.service.js
// ════════════════════════════════════════════════════════════════════════════
// VOZ (Text-to-Speech) — Asistente Aqua "JARVIS" vía ElevenLabs
// Convierte el texto de una respuesta del chatbot en audio MP3.
//   - Voz y modelo configurables por .env (ELEVENLABS_VOICE_ID / ELEVENLABS_MODEL)
//   - Limpia markdown/emojis antes de hablar y limita longitud (control de costo)
// ════════════════════════════════════════════════════════════════════════════

const axios = require("axios");
require("dotenv").config();

const ELEVEN_KEY = process.env.ELEVENLABS_API_KEY;
// "Adam" — voz masculina grave, estilo asistente JARVIS. Cambiable por .env.
const VOICE_ID   = process.env.ELEVENLABS_VOICE_ID || "pNInz6obpgDQGcFmaJgB";
// multilingual v2 = pronuncia bien el español.
const MODEL_ID   = process.env.ELEVENLABS_MODEL || "eleven_multilingual_v2";

// Tope de caracteres a sintetizar (controla el consumo de créditos ElevenLabs).
const MAX_CHARS = 800;

// Quita markdown, viñetas, links y colapsa espacios para que la voz no lea símbolos.
function limpiarTexto(t) {
  let s = (t || "")
    .replace(/```[\s\S]*?```/g, " ")         // bloques de código
    .replace(/`([^`]+)`/g, "$1")             // código inline
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1"); // links markdown → solo el texto

  // Tablas, viñetas y separadores → frases legibles (sin leer "guion"/"barra").
  s = s.split(/\r?\n/).map((linea) => {
    let l = linea.trim();
    if (!l) return "";
    if (/^[|\-\s:]+$/.test(l) && /[-|]/.test(l)) return "";  // separador de tabla / "---"
    if (l.startsWith("|") || / \| /.test(l)) {                // fila de tabla
      const celdas = l.replace(/^\||\|$/g, "").split("|").map((c) => c.trim()).filter(Boolean);
      if (celdas.length === 2) return celdas.join(": ") + ".";
      if (celdas.length > 2)  return celdas.join(", ") + ".";
      return celdas.join(" ");
    }
    return l.replace(/^\s*[-•*]\s+/, "").replace(/^\s*\d+\.\s+/, "");
  }).filter(Boolean).join(". ");

  // Moneda y números legibles (evita "signo de dólares" y "coma" del decimal).
  s = s
    .replace(/\$\s?(\d[\d.,]*)/g, "$1 dolares")
    .replace(/(\d[\d.,]*)\s?(?:USD|usd)\b/g, "$1 dolares")
    .replace(/(\d)\.(?=\d{3}(\D|$))/g, "$1")     // miles
    .replace(/(\d)\.(?=\d{3}(\D|$))/g, "$1")
    .replace(/(\d+),(\d+)/g, "$1 con $2")        // decimal → "con"
    .replace(/(\d)\s?%/g, "$1 por ciento");

  // Guiones aislados y lista blanca: solo letras, números, espacios y puntuación.
  return s
    .replace(/(^|\s)[-–—]+(\s|$)/g, " ")
    .replace(/[^\p{L}\p{N}\s.,:;¿?¡!()%°-]/gu, " ") // elimina $, |, *, emojis, símbolos…
    .replace(/\s+([.,;:!?])/g, "$1")
    .replace(/\.\s*\./g, ".")
    .replace(/\s{2,}/g, " ")
    .trim()
    .slice(0, MAX_CHARS);
}

// Devuelve un Buffer MP3 con el texto hablado. Lanza si falla (el caller traduce el error).
async function sintetizarVoz(texto) {
  if (!ELEVEN_KEY) {
    const err = new Error("ELEVENLABS_API_KEY no configurada");
    err.code = "NO_KEY";
    throw err;
  }
  const limpio = limpiarTexto(texto);
  if (!limpio) {
    const err = new Error("Texto vacío tras limpieza");
    err.code = "EMPTY";
    throw err;
  }

  const url = `https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}?output_format=mp3_44100_128`;
  const resp = await axios.post(
    url,
    {
      text: limpio,
      model_id: MODEL_ID,
      voice_settings: {
        stability: 0.4,         // un poco más expresiva = más humana
        similarity_boost: 0.85,
        style: 0.35,            // más entonación natural
        use_speaker_boost: true,
      },
    },
    {
      headers: {
        "xi-api-key": ELEVEN_KEY,
        "Content-Type": "application/json",
        Accept: "audio/mpeg",
      },
      responseType: "arraybuffer",
      timeout: 30000,
    }
  );

  return Buffer.from(resp.data);
}

// Modelo de transcripción (Speech-to-Text) configurable por .env.
const STT_MODEL = process.env.ELEVENLABS_STT_MODEL || "scribe_v1";

// ── Transcribir audio (Speech-to-Text) con ElevenLabs ────────────────────────
// buffer = audio grabado (webm/ogg/mp3...). Devuelve el texto reconocido.
async function transcribirAudio(buffer, mimetype = "audio/webm") {
  if (!ELEVEN_KEY) {
    const err = new Error("ELEVENLABS_API_KEY no configurada");
    err.code = "NO_KEY";
    throw err;
  }
  if (!buffer || !buffer.length) {
    const err = new Error("Audio vacío");
    err.code = "EMPTY";
    throw err;
  }

  const form = new FormData();
  form.append("model_id", STT_MODEL);
  form.append("language_code", "spa"); // español
  form.append("file", new Blob([buffer], { type: mimetype }), "audio.webm");

  const resp = await axios.post("https://api.elevenlabs.io/v1/speech-to-text", form, {
    headers: { "xi-api-key": ELEVEN_KEY },
    timeout: 30000,
    maxBodyLength: Infinity,
    maxContentLength: Infinity,
  });

  return ((resp.data && resp.data.text) || "").trim();
}

module.exports = { sintetizarVoz, transcribirAudio, limpiarTexto, VOICE_ID, MODEL_ID, STT_MODEL };
