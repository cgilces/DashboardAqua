const {
  sincronizarOdooCompletoRango
} = require("../../services/odooServicio/sincronizacionOdooService");

exports.sincronizarOdoo = async (req, res) => {
  try {

    const { startDate, endDate } = req.body;

    if (!startDate || !endDate) {
      return res.status(400).json({
        message: "Debe enviar startDate y endDate"
      });
    }

    const resultado = await sincronizarOdooCompletoRango(
      startDate,
      endDate
    );

    res.json({
      success: true,
      data: resultado
    });

  } catch (error) {
    console.error("❌ Error sincronizando Odoo:", error);

    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};