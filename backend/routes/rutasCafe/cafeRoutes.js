const express = require("express");
const router  = express.Router();
const { obtenerDashboardCafe, obtenerClientesCafe, obtenerProductosSucursalCafe } = require("../../controllers/controllerCafe/cafeController");

router.get("/dashboard",          obtenerDashboardCafe);
router.get("/clientes",           obtenerClientesCafe);
router.get("/sucursal-productos", obtenerProductosSucursalCafe);

module.exports = router;
