// routes/ventasRoutes.js
const express = require('express');
const router = express.Router();
const ventasController = require('../controllers/ventasController');

// Ruta para obtener los datos del dashboard de ventas
router.get('/dashboard', ventasController.obtenerDatosDashboard);
// router.get("/detalle-ruta", ventasController.obtenerDetalleRuta);  // 🆕 NUEVA


module.exports = router;
