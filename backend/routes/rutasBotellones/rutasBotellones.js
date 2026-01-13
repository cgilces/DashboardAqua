const express = require('express');
const router = express.Router();
const botellonesController = require('../../controllers/controllerBotellones/botellonesController');
const clientesBotellonController = require('../../controllers/controllerBotellones/clientesBotellonController');

// Ruta principal del dashboard
router.get('/dashboard', botellonesController.obtenerDashboardBotellones);
router.get("/clientes", clientesBotellonController.obtenerClientesBotellon);
// 🆕 Ruta para obtener el detalle por vendedor (R1, R2, R3…)
// router.get('/ruta/detalle', ventasController.obtenerDetalleRuta);

module.exports = router;
