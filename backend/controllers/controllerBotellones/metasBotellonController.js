const MetaPreventa = require("../../models/metaPreventa");

// ─── POST: Crear/actualizar meta ─────────────────────────────────
exports.guardarMeta = async (req, res) => {
  try {
    const { codigo_ruta, seccion, meta_unidades, meta_dolares, mes, anio } = req.body;

    if (!codigo_ruta || !seccion || !mes || !anio || meta_unidades == null || meta_dolares == null) {
      return res.status(400).json({ ok: false, message: "Todos los campos son obligatorios" });
    }

    const [meta, created] = await MetaPreventa.upsert({
      codigo_ruta:   codigo_ruta.toUpperCase(),
      seccion:       seccion.toUpperCase(),
      mes:           Number(mes),
      anio:          Number(anio),
      meta_unidades: Number(meta_unidades),
      meta_dolares:  Number(meta_dolares),
    });

    res.json({
      ok: true,
      created,
      message: created ? "Meta creada correctamente" : "Meta actualizada exitosamente",
      meta,
    });
  } catch (error) {
    console.error("❌ Error al guardar meta botellón:", error);
    res.status(500).json({ ok: false, message: "Error interno del servidor", error: error?.message });
  }
};

// ─── GET: Listar metas por seccion ───────────────────────────────
exports.listarMetas = async (req, res) => {
  try {
    const seccion = req.query.seccion?.toUpperCase();
    const where = seccion ? { seccion } : {};

    const metas = await MetaPreventa.findAll({
      where,
      order: [["anio", "DESC"], ["mes", "DESC"], ["codigo_ruta", "ASC"]],
    });
    res.json({ ok: true, metas });
  } catch (error) {
    console.error("❌ Error al listar metas botellón:", error);
    res.status(500).json({ ok: false, message: "Error al obtener metas", error: error.message });
  }
};

// ─── PUT: Editar meta ────────────────────────────────────────────
exports.editarMeta = async (req, res) => {
  try {
    const { codigo_ruta, seccion, meta_unidades, meta_dolares, mes, anio } = req.body;

    if (!codigo_ruta || !seccion || !mes || !anio) {
      return res.status(400).json({ ok: false, message: "codigo_ruta, seccion, mes y anio son obligatorios" });
    }

    const meta = await MetaPreventa.findOne({
      where: {
        codigo_ruta: codigo_ruta.toUpperCase(),
        seccion:     seccion.toUpperCase(),
        mes:         Number(mes),
        anio:        Number(anio),
      },
    });

    if (!meta) {
      return res.status(404).json({ ok: false, message: `No existe meta para "${codigo_ruta}" en ${mes}/${anio}` });
    }

    const campos = {};
    if (meta_unidades != null) campos.meta_unidades = Number(meta_unidades);
    if (meta_dolares  != null) campos.meta_dolares  = Number(meta_dolares);
    await meta.update(campos);

    res.json({ ok: true, message: "Meta actualizada correctamente", meta });
  } catch (error) {
    console.error("❌ Error al editar meta botellón:", error);
    res.status(500).json({ ok: false, message: "Error interno del servidor", error: error?.message });
  }
};

// ─── DELETE: Eliminar meta ───────────────────────────────────────
exports.eliminarMeta = async (req, res) => {
  try {
    const { codigo_ruta, seccion, mes, anio } = req.body;

    if (!codigo_ruta || !seccion || !mes || !anio) {
      return res.status(400).json({ ok: false, message: "codigo_ruta, seccion, mes y anio son obligatorios" });
    }

    const meta = await MetaPreventa.findOne({
      where: {
        codigo_ruta: codigo_ruta.toUpperCase(),
        seccion:     seccion.toUpperCase(),
        mes:         Number(mes),
        anio:        Number(anio),
      },
    });

    if (!meta) {
      return res.status(404).json({ ok: false, message: `No existe meta para "${codigo_ruta}" en ${mes}/${anio}` });
    }

    await meta.destroy();
    res.json({ ok: true, message: "Meta eliminada correctamente" });
  } catch (error) {
    console.error("❌ Error al eliminar meta botellón:", error);
    res.status(500).json({ ok: false, message: "Error interno del servidor", error: error?.message });
  }
};
