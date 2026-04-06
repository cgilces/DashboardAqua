const express = require('express');
const router  = express.Router();
const { obtenerDashboardConsolidado } = require('../../controllers/controllerConsolidado/consolidadoController');

router.get('/dashboard', obtenerDashboardConsolidado);

module.exports = router;
