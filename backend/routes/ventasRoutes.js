// routes/ventasRoutes.js
const express = require('express');
const router = express.Router();
const ventasController = require('../controllers/ventasController');

// Ruta principal del dashboard
router.get('/dashboard', ventasController.obtenerDatosDashboard);

// 🆕 Ruta para obtener el detalle por vendedor (R1, R2, R3…)
router.get('/ruta/detalle', ventasController.obtenerDetalleRuta);

module.exports = router;
