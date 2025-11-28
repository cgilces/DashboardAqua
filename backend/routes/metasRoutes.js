const express = require("express");
const router = express.Router();
const { guardarMeta, listarMetas } = require("../controllers/metasController");

router.post("/guardarmetas", guardarMeta);
router.get("/listarmetas", listarMetas);

module.exports = router;
