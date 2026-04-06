const express = require("express");
const router  = express.Router();
const { obtenerDashboardCafe, obtenerClientesCafe } = require("../../controllers/controllerCafe/cafeController");

router.get("/dashboard", obtenerDashboardCafe);
router.get("/clientes",  obtenerClientesCafe);

module.exports = router;
