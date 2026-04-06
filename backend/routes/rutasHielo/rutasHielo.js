const express = require("express");
const router = express.Router();
const hieloController = require('../../controllers/controllerHielo/hieloController');
const { verificarTokenOpcional } = require('../../middleware/auth.middleware');

// Ruta para obtener los KPIs de Hielo
router.get('/dashboard', verificarTokenOpcional, hieloController);

module.exports = router;
