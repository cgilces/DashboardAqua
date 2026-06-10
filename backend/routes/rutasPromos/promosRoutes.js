// routes/rutasPromos/promosRoutes.js
const express = require("express");
const router = express.Router();
const promos = require("../../controllers/controllerPromos/promosController");
const { verificarTokenOpcional } = require("../../middleware/auth.middleware");

// Dashboard combinado (ranking general + prendedores)
router.get("/dashboard", verificarTokenOpcional, promos.obtenerDashboard);

// Endpoints individuales
router.get("/ranking", verificarTokenOpcional, promos.obtenerRanking);
router.get("/prendedores", verificarTokenOpcional, promos.obtenerPrendedores);
router.get("/prendedor/:sellerCode", verificarTokenOpcional, promos.obtenerPorPrendedor);
router.get("/detalle/:promoCode", verificarTokenOpcional, promos.obtenerDetalle);

// Reporte "Promociones Utilizadas" (réplica dashboard86) + catálogo para el dropdown
router.get("/reporte", verificarTokenOpcional, promos.obtenerReporte);
router.get("/lista", verificarTokenOpcional, promos.obtenerListaPromos);

module.exports = router;
