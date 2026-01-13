const express = require("express");
const router = express.Router();
const hieloController = require('../../controllers/controllerHielo/hieloController');

// Ruta para obtener los KPIs de Hielo
router.get('/dashboard', hieloController);

module.exports = router;
