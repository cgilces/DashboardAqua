const express = require("express");
const router = express.Router();
const plusController = require('../../controllers/controllerPlus/plusController');
const { verificarTokenOpcional } = require('../../middleware/auth.middleware');

router.get('/dashboard', verificarTokenOpcional, plusController);

module.exports = router;
