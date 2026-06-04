const express = require('express');
const router = express.Router();
const { login, solicitarCodigo, confirmarRegistro } = require('../../controllers/controllerLogin/loginController');

router.post('/inicio', login);
router.post('/registro/solicitar-codigo', solicitarCodigo);
router.post('/registro/confirmar', confirmarRegistro);

module.exports = router;
