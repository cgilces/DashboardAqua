const express = require('express');
const router = express.Router();
const { login } = require('../../controllers/controllerLogin/loginController');

router.post('/inicio', login);

module.exports = router;
