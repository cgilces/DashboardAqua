const express = require("express");
const router  = express.Router();
const ctrl    = require("../../controllers/controllerBotellones/metasBotellonController");

router.post  ("/guardarmeta",  ctrl.guardarMeta);
router.get   ("/listarmetas",  ctrl.listarMetas);
router.put   ("/editarmeta",   ctrl.editarMeta);
router.delete("/eliminarmeta", ctrl.eliminarMeta);

module.exports = router;
