const MetaPreventa = require("../models/metaPreventa");

//Metodo Post
exports.guardarMeta = async (req, res) => {
  try {
    const { preventa, meta_unidades, meta_dolares, mes, anio } = req.body;

    if (!preventa || !mes || !anio || !meta_unidades || !meta_dolares) {
      return res.status(400).json({
        ok: false,
        message: "Todos los campos son obligatorios",
      });
    }

    const codigoRuta = preventa.toUpperCase();

    // Inserta o actualiza automáticamente
    const [meta, created] = await MetaPreventa.upsert({
      codigo_ruta: codigoRuta,
      mes,
      anio,
      meta_unidades,
      meta_dolares,
    });

    res.json({
      ok: true,
      created,
      message: created
        ? "Meta creada correctamente"
        : "Meta actualizada exitosamente",
      meta,
    });
  } catch (error) {
    console.error("❌ Error al guardar meta:", error);

    res.status(500).json({
      ok: false,
      message: "Error interno del servidor",
      error: error?.message,
    });
  }
};


//Metodo Get
exports.listarMetas = async (req, res) => {
  try {
    const metas = await MetaPreventa.findAll({
      order: [
        ["anio", "DESC"],
        ["mes", "DESC"],
        ["codigo_ruta", "ASC"]
      ]
    });

    res.json({
      ok: true,
      metas
    });

  } catch (error) {
    console.error("❌ Error al listar metas:", error);
    res.status(500).json({
      ok: false,
      message: "Error al obtener metas",
      error: error.message
    });
  }
};
