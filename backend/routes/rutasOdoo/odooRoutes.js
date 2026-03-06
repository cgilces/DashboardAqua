const express = require("express");
const router = express.Router();

const {
  sincronizarOdoo
} = require("../../controllers/controllerOdoo/odooController");

// POST /api/odoo/sync
router.post("/sync", sincronizarOdoo);

module.exports = router;