const express = require("express");
const router  = express.Router();
const { chatHandler, descargarReporteHandler, limpiarHistorialHandler } = require("../../controllers/controllerBotInteligente/chat.controller");
const { verificarToken } = require("../../middleware/auth.middleware");

router.post("/chat",           verificarToken, chatHandler);
router.get("/reporte/:filename", verificarToken, descargarReporteHandler);
router.post("/limpiar",        verificarToken, limpiarHistorialHandler); // ← limpia historial
module.exports = router;