// routes/ventasRoutes.js
const express = require('express');
const router = express.Router();
const ventasController = require('../../controllers/controllerPreventa/ventasController');
<<<<<<< HEAD
const { verificarTokenOpcional } = require('../../middleware/auth.middleware');

// Ruta principal del dashboard
router.get('/dashboard', verificarTokenOpcional, ventasController.obtenerDatosDashboard);
=======

// Ruta principal del dashboard
router.get('/dashboard', ventasController.obtenerDatosDashboard);
>>>>>>> 3e145c1ea3658674e887177a34c1260b43081e2c

// 🆕 Ruta para obtener el detalle por vendedor (R1, R2, R3…)
router.get('/ruta/detalle', ventasController.obtenerDetalleRuta);

module.exports = router;
