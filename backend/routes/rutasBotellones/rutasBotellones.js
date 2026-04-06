const express = require('express');
const router = express.Router();
const botellonesController = require('../../controllers/controllerBotellones/botellonesController');
<<<<<<< HEAD
const { verificarTokenOpcional } = require('../../middleware/auth.middleware');

router.get('/dashboard',              verificarTokenOpcional, botellonesController.obtenerDashboardBotellones);
router.get('/clientes-vip',           botellonesController.obtenerClientesVipBotellon);
router.get('/clientes-domicilio',     botellonesController.obtenerClientesDomicilioBotellon);
router.get('/empresas-consolidado',   verificarTokenOpcional, botellonesController.obtenerEmpresasConsolidado);
=======

router.get('/dashboard',              botellonesController.obtenerDashboardBotellones);
router.get('/clientes-vip',           botellonesController.obtenerClientesVipBotellon);
router.get('/clientes-domicilio',     botellonesController.obtenerClientesDomicilioBotellon);
router.get('/empresas-consolidado',   botellonesController.obtenerEmpresasConsolidado);
>>>>>>> 3e145c1ea3658674e887177a34c1260b43081e2c
router.get('/clientes-empresas',      botellonesController.obtenerClientesEmpresasBotellon);
router.get('/vip-subcanales',              botellonesController.obtenerVipSubcanales);
router.get('/vip-clientes-tipo',           botellonesController.obtenerVipClientesPorTipo);
router.get('/vip-cliente-detalle',         botellonesController.obtenerVipDetalleCliente);
router.get('/empresas-subcanales',         botellonesController.obtenerEmpresasSubcanales);
router.get('/empresas-clientes-tipo',      botellonesController.obtenerEmpresasClientesPorTipo);
router.get('/empresas-cliente-detalle',    botellonesController.obtenerEmpresasDetalleCliente);

module.exports = router;
