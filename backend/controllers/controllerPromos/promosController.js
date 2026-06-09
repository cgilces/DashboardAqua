// controllers/controllerPromos/promosController.js
// API de analítica de promociones (ranking general, por prendedor, ficha).
"use strict";

const {
  rankingGeneral,
  rankingPrendedores,
  promosPorPrendedor,
  detallePromo,
} = require("../../services/promosDashboard.service");

// GET /api/promos/dashboard?anio=&mes=&limit=
// Devuelve el ranking general + ranking de prendedores en una sola llamada.
async function obtenerDashboard(req, res) {
  try {
    const { anio, mes, limit } = req.query;
    const [promos, prendedores] = await Promise.all([
      rankingGeneral({ anio, mes, limit }),
      rankingPrendedores({ anio, mes }),
    ]);
    res.json({ anio: anio || null, mes: mes || null, promos, prendedores });
  } catch (err) {
    console.error("❌ [Promos] dashboard:", err.message);
    res.status(500).json({ error: "No se pudo cargar el dashboard de promociones." });
  }
}

// GET /api/promos/ranking?anio=&mes=&limit=
async function obtenerRanking(req, res) {
  try {
    const { anio, mes, limit } = req.query;
    res.json(await rankingGeneral({ anio, mes, limit }));
  } catch (err) {
    console.error("❌ [Promos] ranking:", err.message);
    res.status(500).json({ error: "No se pudo cargar el ranking de promociones." });
  }
}

// GET /api/promos/prendedores?anio=&mes=
async function obtenerPrendedores(req, res) {
  try {
    const { anio, mes, limit } = req.query;
    res.json(await rankingPrendedores({ anio, mes, limit }));
  } catch (err) {
    console.error("❌ [Promos] prendedores:", err.message);
    res.status(500).json({ error: "No se pudo cargar el ranking de prendedores." });
  }
}

// GET /api/promos/prendedor/:sellerCode?anio=&mes=
async function obtenerPorPrendedor(req, res) {
  try {
    const { sellerCode } = req.params;
    const { anio, mes } = req.query;
    res.json(await promosPorPrendedor({ sellerCode, anio, mes }));
  } catch (err) {
    console.error("❌ [Promos] por prendedor:", err.message);
    res.status(500).json({ error: "No se pudo cargar las promos del prendedor." });
  }
}

// GET /api/promos/detalle/:promoCode?anio=&mes=
async function obtenerDetalle(req, res) {
  try {
    const { promoCode } = req.params;
    const { anio, mes } = req.query;
    res.json(await detallePromo({ promoCode, anio, mes }));
  } catch (err) {
    console.error("❌ [Promos] detalle:", err.message);
    res.status(500).json({ error: "No se pudo cargar la ficha de la promoción." });
  }
}

module.exports = {
  obtenerDashboard,
  obtenerRanking,
  obtenerPrendedores,
  obtenerPorPrendedor,
  obtenerDetalle,
};
