const { Router } = require("express");
const { chatHandler } = require("../../controllers/controllerBotInteligente/chat.controller");
const { verificarToken } = require("../../middleware/auth.middleware");

const router = Router();

router.post("/chat", verificarToken, chatHandler);

module.exports = router;