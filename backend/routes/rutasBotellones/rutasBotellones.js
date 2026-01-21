const express = require('express');
const router = express.Router();
const botellonesController = require('../../controllers/controllerBotellones/botellonesController');
// const clientesBotellonController = require('../../controllers/controllerBotellones/clientesBotellonController');

// Ruta principal del dashboard
router.get('/dashboard', botellonesController.obtenerDashboardBotellones);
// router.get("/clientes/:ruta/:anio/:mes", clientesBotellonController.obtenerClientesBotellon);



module.exports = router;
