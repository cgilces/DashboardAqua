const express = require("express");
const router = express.Router();
const hieloController = require('../../controllers/controllerHielo/hieloController');
<<<<<<< HEAD
const { verificarTokenOpcional } = require('../../middleware/auth.middleware');

// Ruta para obtener los KPIs de Hielo
router.get('/dashboard', verificarTokenOpcional, hieloController);
=======

// Ruta para obtener los KPIs de Hielo
router.get('/dashboard', hieloController);
>>>>>>> 3e145c1ea3658674e887177a34c1260b43081e2c

module.exports = router;
