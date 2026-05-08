const express = require("express");
const router  = express.Router();

const {
  guardarMeta,
  listarMetas,
  editarMeta,
  eliminarMeta,
} = require("../../controllers/controllerPreventa/metasController");

const { importarMasivo } = require("../../controllers/controllerPreventa/metasImportController");

// const { verificarToken } = require("../../middlewares/auth.middleware"); // descomenta si usas JWT

router.post  ("/guardarmetas",      /* verificarToken, */ guardarMeta);
router.get   ("/listarmetas",       /* verificarToken, */ listarMetas);
router.put   ("/editarmeta",        /* verificarToken, */ editarMeta);
router.delete("/eliminarmeta",      /* verificarToken, */ eliminarMeta);
router.post  ("/importar-masivo",   /* verificarToken, */ importarMasivo);

module.exports = router;