const express = require("express");
const router = express.Router();

const {  sincronizarOdoo } = require("../../controllers/controllerOdoo/odooController");
const { obtenerVentasDescartableOdoo } = require("../../controllers/controllerOdoo/ventasDescartableOdooController");
const { obtenerVentasBotellonOdoo } = require("../../controllers/controllerOdoo/ventasBotellonesOdooController");
const { obtenerVentasHielo } = require("../../controllers/controllerOdoo/ventasHieloController");


// POST /api/odoo/sync
router.post("/sync", sincronizarOdoo);


router.get("/descartable-odoo", obtenerVentasDescartableOdoo);
router.get("/botellon-odoo", obtenerVentasBotellonOdoo);
router.get("/hielo", obtenerVentasHielo);


module.exports = router;