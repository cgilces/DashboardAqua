// routes/ventasRoutes.js
const express = require('express');
const router = express.Router();
const ventasController = require('../../controllers/controllerPreventa/ventasController');
const { verificarTokenOpcional } = require('../../middleware/auth.middleware');

// Ruta principal del dashboard
router.get('/dashboard', verificarTokenOpcional, ventasController.obtenerDatosDashboard);

// 🆕 Ruta para obtener el detalle por vendedor (R1, R2, R3…)
router.get('/ruta/detalle', ventasController.obtenerDetalleRuta);

module.exports = router;
