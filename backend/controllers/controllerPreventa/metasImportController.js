const MetaPreventa = require("../../models/metaPreventa");
const { detectarSeccion, normalizarSeccion } = require("../../utils/detectarSeccionMetas");

const ANIO_MIN = 2020;
const ANIO_MAX = 2099;

const toNum = (v) => {
  if (v === null || v === undefined || v === "") return 0;
  const n = Number(String(v).replace(/,/g, ""));
  return Number.isFinite(n) ? n : NaN;
};

exports.importarMasivo = async (req, res) => {
  try {
    const items = Array.isArray(req.body?.items) ? req.body.items : null;
    if (!items || items.length === 0) {
      return res.status(400).json({ ok: false, message: "items requerido (array no vacío)" });
    }

    let creados = 0;
    let actualizados = 0;
    const errores = [];

    for (let i = 0; i < items.length; i++) {
      const fila = i + 2; // fila 1 = headers; las filas Excel empiezan en 1
      const it = items[i] || {};

      const codigo_ruta = String(it.codigo_ruta || "").trim().toUpperCase();
      const mes = parseInt(it.mes, 10);
      const anio = parseInt(it.anio, 10);
      const meta_unidades = toNum(it.meta_unidades);
      const meta_dolares = toNum(it.meta_dolares);

      if (!codigo_ruta) {
        errores.push({ fila, codigo_ruta: "", motivo: "CODIGO_RUTA vacío" });
        continue;
      }
      if (!Number.isInteger(mes) || mes < 1 || mes > 12) {
        errores.push({ fila, codigo_ruta, motivo: `MES inválido (${it.mes})` });
        continue;
      }
      if (!Number.isInteger(anio) || anio < ANIO_MIN || anio > ANIO_MAX) {
        errores.push({ fila, codigo_ruta, motivo: `AÑO inválido (${it.anio})` });
        continue;
      }
      if (!Number.isFinite(meta_unidades) || !Number.isFinite(meta_dolares)) {
        errores.push({ fila, codigo_ruta, motivo: "META_UNIDADES o META_USD no es numérico" });
        continue;
      }
      if (meta_unidades <= 0 && meta_dolares <= 0) {
        errores.push({ fila, codigo_ruta, motivo: "Ambas metas en 0/vacío — fila ignorada" });
        continue;
      }

      const seccionExplicita = it.seccion ? normalizarSeccion(it.seccion) : null;
      const seccion = seccionExplicita || detectarSeccion(codigo_ruta);

      try {
        const [, created] = await MetaPreventa.upsert({
          codigo_ruta,
          mes,
          anio,
          meta_unidades: Math.max(0, Math.round(meta_unidades)),
          meta_dolares: Math.max(0, meta_dolares),
          seccion,
        });
        if (created) creados++;
        else actualizados++;
      } catch (err) {
        errores.push({ fila, codigo_ruta, motivo: `Error BD: ${err?.message || err}` });
      }
    }

    return res.json({
      ok: true,
      total: items.length,
      creados,
      actualizados,
      errores,
    });
  } catch (error) {
    console.error("❌ Error importarMasivo metas:", error);
    return res.status(500).json({ ok: false, message: "Error interno", error: error?.message });
  }
};
