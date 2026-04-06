const express = require("express");
const router = express.Router();

const {  sincronizarOdoo } = require("../../controllers/controllerOdoo/odooController");
const { obtenerVentasDescartableOdoo, obtenerClientesDescartableOdoo } = require("../../controllers/controllerOdoo/ventasDescartableOdooController");
const { obtenerVentasBotellonOdoo } = require("../../controllers/controllerOdoo/ventasBotellonesOdooController");
const { obtenerVentasHielo, obtenerClientesHieloOdoo } = require("../../controllers/controllerOdoo/ventasHieloController");


// POST /api/odoo/sync
router.post("/sync", sincronizarOdoo);


router.get("/descartable-odoo", obtenerVentasDescartableOdoo);
router.get("/clientes", obtenerClientesDescartableOdoo);
router.get("/botellon-odoo", obtenerVentasBotellonOdoo);
router.get("/hielo", obtenerVentasHielo);
router.get("/hielo-clientes", obtenerClientesHieloOdoo);


module.exports = router;