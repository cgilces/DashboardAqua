const express = require("express");
const router  = express.Router();
const { chatHandler, descargarReporteHandler, limpiarHistorialHandler } = require("../../controllers/controllerBotInteligente/chat.controller");
const { bienvenidaHandler } = require("../../controllers/controllerBotInteligente/bienvenida.controller");
const { vozHandler, transcribirHandler } = require("../../controllers/controllerBotInteligente/voz.controller");
const { verificarToken } = require("../../middleware/auth.middleware");

router.post("/chat",           verificarToken, chatHandler);
router.get("/reporte/:filename", verificarToken, descargarReporteHandler);
router.post("/limpiar",        verificarToken, limpiarHistorialHandler); // ← limpia historial
router.get("/bienvenida",      verificarToken, bienvenidaHandler);       // ← saludo dinámico al login
router.post("/voz",            verificarToken, vozHandler);              // ← TTS ElevenLabs (voz JARVIS)
router.post("/transcribir",    verificarToken,                          // ← STT ElevenLabs (micrófono)
  express.raw({ type: () => true, limit: "25mb" }), transcribirHandler);
module.exports = router;