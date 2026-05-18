const express = require('express');
const router = express.Router();
const botellonesController = require('../../controllers/controllerBotellones/botellonesController');
const { verificarTokenOpcional } = require('../../middleware/auth.middleware');

router.get('/dashboard',              verificarTokenOpcional, botellonesController.obtenerDashboardBotellones);
router.get('/clientes-vip',           botellonesController.obtenerClientesVipBotellon);
router.get('/clientes-domicilio',     botellonesController.obtenerClientesDomicilioBotellon);
router.get('/empresas-consolidado',   verificarTokenOpcional, botellonesController.obtenerEmpresasConsolidado);
router.get('/clientes-empresas',      botellonesController.obtenerClientesEmpresasBotellon);
router.get('/vip-subcanales',              botellonesController.obtenerVipSubcanales);
router.get('/vip-clientes-tipo',           botellonesController.obtenerVipClientesPorTipo);
router.get('/vip-cliente-detalle',         botellonesController.obtenerVipDetalleCliente);
router.get('/vip-sucursal-productos',      botellonesController.obtenerVipProductosSucursal);
router.get('/empresas-subcanales',         botellonesController.obtenerEmpresasSubcanales);
router.get('/empresas-clientes-tipo',      botellonesController.obtenerEmpresasClientesPorTipo);
router.get('/empresas-cliente-detalle',    botellonesController.obtenerEmpresasDetalleCliente);
router.get('/empresas-sucursal-productos', botellonesController.obtenerEmpresasProductosSucursal);

// Quito / Website — canales independientes (MV + Odoo)
router.get('/quito-consolidado',   verificarTokenOpcional, botellonesController.obtenerQuitoConsolidado);
router.get('/clientes-quito',      botellonesController.obtenerClientesQuitoBotellon);
router.get('/website-consolidado', verificarTokenOpcional, botellonesController.obtenerWebsiteConsolidado);
router.get('/clientes-website',    botellonesController.obtenerClientesWebsiteBotellon);

// Vistas agregadas "todos los clientes" por grupo de rutas (MV)
router.get('/clientes-mayorista',   botellonesController.obtenerClientesMayoristaBotellon);
router.get('/clientes-tiendas',     botellonesController.obtenerClientesTiendasBotellon);
router.get('/clientes-tiendas-vip', botellonesController.obtenerClientesTiendasVipBotellon);
router.get('/clientes-rural',       botellonesController.obtenerClientesRuralBotellon);

module.exports = router;
