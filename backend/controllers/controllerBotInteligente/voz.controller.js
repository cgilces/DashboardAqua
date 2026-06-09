// controllers/controllerBotInteligente/voz.controller.js
// ════════════════════════════════════════════════════════════════════════════
// Endpoint de voz del Asistente Aqua: POST /api/bot/voz  { texto } -> audio/mpeg
// Aislado de chat.controller.js. Usa voz.service (ElevenLabs).
// ════════════════════════════════════════════════════════════════════════════

const { sintetizarVoz, transcribirAudio } = require("../../services/chatbotservicio/voz.service");

async function vozHandler(req, res) {
  try {
    const { texto } = req.body || {};
    if (!texto || !texto.toString().trim()) {
      return res.status(400).json({ error: "El parámetro 'texto' es obligatorio." });
    }
    if (texto.length > 2000) {
      return res.status(400).json({ error: "Texto demasiado largo para sintetizar." });
    }

    const audio = await sintetizarVoz(texto);

    res.setHeader("Content-Type", "audio/mpeg");
    res.setHeader("Content-Length", audio.length);
    res.setHeader("Cache-Control", "no-store");
    return res.send(audio);
  } catch (err) {
    // Si el error viene de ElevenLabs, el cuerpo puede ser un arraybuffer.
    let detalle = err.message;
    if (err.response?.data) {
      try { detalle = Buffer.from(err.response.data).toString("utf8").slice(0, 300); } catch {}
    }
    const status = err.response?.status;
    console.error("❌ ERROR voz TTS:", status || err.code || "", detalle);

    if (err.code === "NO_KEY") {
      return res.status(503).json({ error: "La voz no está configurada (falta ELEVENLABS_API_KEY)." });
    }
    if (/quota_exceeded|exceeds your quota/i.test(detalle)) {
      return res.status(402).json({ error: "ElevenLabs: créditos agotados.", code: "quota_exceeded" });
    }
    if (status === 401) return res.status(502).json({ error: "ElevenLabs: API key inválida." });
    if (status === 422) return res.status(502).json({ error: "ElevenLabs: voz o modelo no válido." });
    if (status === 429) return res.status(502).json({ error: "ElevenLabs: límite o cuota alcanzada." });
    return res.status(502).json({ error: "No se pudo generar el audio." });
  }
}

// ── POST /api/bot/transcribir  (audio binario) -> { texto } ─────────────────
// Recibe el audio grabado (express.raw) y lo transcribe con ElevenLabs STT.
async function transcribirHandler(req, res) {
  try {
    const buffer = req.body;
    if (!Buffer.isBuffer(buffer) || buffer.length === 0) {
      return res.status(400).json({ error: "No se recibió audio." });
    }
    if (buffer.length > 24 * 1024 * 1024) {
      return res.status(413).json({ error: "Audio demasiado grande." });
    }
    const mimetype = req.headers["content-type"] || "audio/webm";
    const texto = await transcribirAudio(buffer, mimetype);
    return res.json({ texto });
  } catch (err) {
    let detalle = err.message;
    try {
      detalle = typeof err.response?.data === "object"
        ? JSON.stringify(err.response.data).slice(0, 300)
        : String(err.response?.data || err.message).slice(0, 300);
    } catch {}
    const status = err.response?.status;
    console.error("❌ ERROR STT:", status || err.code || "", detalle);

    if (err.code === "NO_KEY") return res.status(503).json({ error: "La voz no está configurada." });
    if (/quota_exceeded|exceeds your quota/i.test(detalle)) {
      return res.status(402).json({ error: "ElevenLabs: créditos agotados.", code: "quota_exceeded" });
    }
    if (status === 401) return res.status(502).json({ error: "ElevenLabs: API key inválida." });
    if (status === 429) return res.status(502).json({ error: "ElevenLabs: límite o cuota alcanzada." });
    return res.status(502).json({ error: "No se pudo transcribir el audio." });
  }
}

module.exports = { vozHandler, transcribirHandler };
