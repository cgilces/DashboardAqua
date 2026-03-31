const express = require('express');
const router = express.Router();
const botellonesController = require('../../controllers/controllerBotellones/botellonesController');

router.get('/dashboard',              botellonesController.obtenerDashboardBotellones);
router.get('/clientes-vip',           botellonesController.obtenerClientesVipBotellon);
router.get('/clientes-domicilio',     botellonesController.obtenerClientesDomicilioBotellon);
router.get('/empresas-consolidado',   botellonesController.obtenerEmpresasConsolidado);
router.get('/clientes-empresas',      botellonesController.obtenerClientesEmpresasBotellon);
router.get('/vip-subcanales',              botellonesController.obtenerVipSubcanales);
router.get('/vip-clientes-tipo',           botellonesController.obtenerVipClientesPorTipo);
router.get('/vip-cliente-detalle',         botellonesController.obtenerVipDetalleCliente);
router.get('/empresas-subcanales',         botellonesController.obtenerEmpresasSubcanales);
router.get('/empresas-clientes-tipo',      botellonesController.obtenerEmpresasClientesPorTipo);
router.get('/empresas-cliente-detalle',    botellonesController.obtenerEmpresasDetalleCliente);

module.exports = router;
