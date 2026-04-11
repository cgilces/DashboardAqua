const express = require("express");
const router  = express.Router();

const {
  getCobranza,
  getEficienciaVendedores,
  getClientesRiesgo,
  getMetasVsReal,
  getMargenCanal,
  getKpisEjecutivos,
  getTopProductos,
  getClientesNuevosVsRecurrentes,
  getProyeccion,
  getRankingClientes,
} = require("../../controllers/controllerGerencia/gerenciaController");

// GET /api/gerencia/kpis?anio=2026&mes=4
router.get("/kpis", getKpisEjecutivos);

// GET /api/gerencia/cobranza?anio=2026&mes=4
router.get("/cobranza", getCobranza);

// GET /api/gerencia/vendedores?anio=2026&mes=4
router.get("/vendedores", getEficienciaVendedores);

// GET /api/gerencia/clientes-riesgo
router.get("/clientes-riesgo", getClientesRiesgo);

// GET /api/gerencia/metas?anio=2026&mes=4
router.get("/metas", getMetasVsReal);

// GET /api/gerencia/margen?anio=2026&mes=4
router.get("/margen", getMargenCanal);

// GET /api/gerencia/top-productos?anio=2026&mes=4&limite=20
router.get("/top-productos", getTopProductos);

// GET /api/gerencia/clientes-nuevos?anio=2026&mes=4
router.get("/clientes-nuevos", getClientesNuevosVsRecurrentes);

// GET /api/gerencia/proyeccion?anio=2026&mes=4
router.get("/proyeccion", getProyeccion);

// GET /api/gerencia/ranking-clientes?anio=2026&mes=4&limite=25
router.get("/ranking-clientes", getRankingClientes);

module.exports = router;
