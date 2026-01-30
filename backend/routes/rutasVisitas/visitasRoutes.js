// routes/visitasRoutes.js
const express = require("express");
const router = express.Router();

const { obtenerDashboardVisitas,
     obtenerClientesNoVisitados
} = require("../../controllers/controllerVIsitas/visitasController");

router.get("/dashboard", obtenerDashboardVisitas);
router.get("/no-visitados", obtenerClientesNoVisitados);


module.exports = router;
