const express = require('express');
const router = express.Router();
const botellonesController = require('../../controllers/controllerBotellones/botellonesController');

router.get('/dashboard',              botellonesController.obtenerDashboardBotellones);
router.get('/clientes-vip',           botellonesController.obtenerClientesVipBotellon);
router.get('/clientes-domicilio',     botellonesController.obtenerClientesDomicilioBotellon);
router.get('/empresas-consolidado',   botellonesController.obtenerEmpresasConsolidado);
router.get('/clientes-empresas',      botellonesController.obtenerClientesEmpresasBotellon);

module.exports = router;
