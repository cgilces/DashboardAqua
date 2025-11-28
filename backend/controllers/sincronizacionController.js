// controllers/sincronizacionController.js
const { sincronizarVentasRango } = require("../services/sincronizacionService");

const sincronizarVentas = async (req, res) => {
  try {
    let { anio, mes, desde, hasta } = req.query;

    let startDate;
    let endDate;

    if (desde && hasta) {
      startDate = desde;
      endDate = hasta;
    } else if (anio && mes) {
      const anioNum = Number(anio);
      const mesNum = Number(mes);

      if (!anioNum || !mesNum) {
        return res
          .status(400)
          .json({ error: "anio y mes deben ser numéricos cuando no se envía desde/hasta" });
      }

      const mesStr = String(mesNum).padStart(2, "0");
      startDate = `${anioNum}-${mesStr}-01`;

      // último día del mes
      const lastDay = new Date(anioNum, mesNum, 0).getDate();
      endDate = `${anioNum}-${mesStr}-${String(lastDay).padStart(2, "0")}`;
    } else {
      return res.status(400).json({
        error:
          "Debe enviar anio & mes, o bien desde & hasta. Ej: ?anio=2025&mes=1 o ?desde=2025-01-01&hasta=2025-01-31",
      });
    }

    console.log(`🌐 [SYNC CTRL] Solicitando sincronización ${startDate} → ${endDate}`);

    const resultado = await sincronizarVentasRango(startDate, endDate);

    res.json({
      mensaje: "Sincronización ejecutada correctamente",
      rango: { desde: startDate, hasta: endDate },
      ...resultado,
    });
  } catch (error) {
    console.error("❌ [SYNC CTRL] Error:", error.message);
    res.status(500).json({ error: "Error interno al sincronizar", detalle: error.message });
  }
};

module.exports = {
  sincronizarVentas,
};
