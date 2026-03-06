const MetaPreventa = require("../../models/metaPreventa");

// ─── POST: Crear meta ────────────────────────────────────────────
exports.guardarMeta = async (req, res) => {
  try {
    const { preventa, meta_unidades, meta_dolares, mes, anio } = req.body;

    if (!preventa || !mes || !anio || !meta_unidades || !meta_dolares) {
      return res.status(400).json({ ok: false, message: "Todos los campos son obligatorios" });
    }

    const codigoRuta = preventa.toUpperCase();

    const [meta, created] = await MetaPreventa.upsert({
      codigo_ruta:   codigoRuta,
      mes,
      anio,
      meta_unidades,
      meta_dolares,
    });

    res.json({
      ok: true,
      created,
      message: created ? "Meta creada correctamente" : "Meta actualizada exitosamente",
      meta,
    });
  } catch (error) {
    console.error("❌ Error al guardar meta:", error);
    res.status(500).json({ ok: false, message: "Error interno del servidor", error: error?.message });
  }
};

// ─── GET: Listar todas las metas ─────────────────────────────────
exports.listarMetas = async (req, res) => {
  try {
    const metas = await MetaPreventa.findAll({
      order: [["anio", "DESC"], ["mes", "DESC"], ["codigo_ruta", "ASC"]],
    });
    res.json({ ok: true, metas });
  } catch (error) {
    console.error("❌ Error al listar metas:", error);
    res.status(500).json({ ok: false, message: "Error al obtener metas", error: error.message });
  }
};

// ─── PUT: Editar meta por ruta + mes + año ───────────────────────
exports.editarMeta = async (req, res) => {
  try {
    const { preventa, meta_unidades, meta_dolares, mes, anio } = req.body;

    // Validaciones
    if (!preventa || !mes || !anio) {
      return res.status(400).json({
        ok: false,
        message: "preventa, mes y anio son obligatorios para identificar la meta",
      });
    }
    if (!meta_unidades && !meta_dolares) {
      return res.status(400).json({
        ok: false,
        message: "Debes enviar meta_unidades o meta_dolares para actualizar",
      });
    }

    const codigoRuta = preventa.toUpperCase();

    // Buscar por la clave natural: ruta + mes + año
    const meta = await MetaPreventa.findOne({
      where: { codigo_ruta: codigoRuta, mes, anio },
    });

    if (!meta) {
      return res.status(404).json({
        ok: false,
        message: `No existe una meta para la ruta "${codigoRuta}" en ${mes}/${anio}`,
      });
    }

    // Actualizar solo los campos que llegaron
    const campos = {};
    if (meta_unidades !== undefined) campos.meta_unidades = meta_unidades;
    if (meta_dolares  !== undefined) campos.meta_dolares  = meta_dolares;

    await meta.update(campos);

    res.json({
      ok:      true,
      message: `Meta de ${codigoRuta} — ${mes}/${anio} actualizada correctamente`,
      meta,
    });
  } catch (error) {
    console.error("❌ Error al editar meta:", error);
    res.status(500).json({ ok: false, message: "Error interno del servidor", error: error?.message });
  }
};

// ─── DELETE: Eliminar meta por ruta + mes + año ──────────────────
exports.eliminarMeta = async (req, res) => {
  try {
    const { preventa, mes, anio } = req.body;

    if (!preventa || !mes || !anio) {
      return res.status(400).json({
        ok: false,
        message: "preventa, mes y anio son obligatorios",
      });
    }

    const codigoRuta = preventa.toUpperCase();

    const meta = await MetaPreventa.findOne({
      where: { codigo_ruta: codigoRuta, mes, anio },
    });

    if (!meta) {
      return res.status(404).json({
        ok: false,
        message: `No existe una meta para "${codigoRuta}" en ${mes}/${anio}`,
      });
    }

    await meta.destroy();
    res.json({ ok: true, message: "Meta eliminada correctamente" });
  } catch (error) {
    console.error("❌ Error al eliminar meta:", error);
    res.status(500).json({ ok: false, message: "Error interno del servidor", error: error?.message });
  }
};