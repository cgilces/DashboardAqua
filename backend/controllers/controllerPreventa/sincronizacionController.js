// controllers/sincronizacionController.js
const sequelize = require("../../db");  // Importar la conexión sequelize
const { sincronizarVentasRango } = require("../../services/sincronizacionService");
const syncState = require("./syncState");



// Función para obtener la última fecha de sincronización
const getLastSync = async (req, res) => {
  try {
    // Realizar la consulta SQL para obtener la última fecha de sincronización
    const result = await sequelize.query('SELECT hasta_date FROM sincronizaciones_ventas ORDER BY fecha_sync DESC LIMIT 1', {
      type: sequelize.QueryTypes.SELECT
    });

    // Verificar si se obtuvieron resultados
    if (result.length === 0) {
      return res.status(404).json({ error: "No se encontró una fecha de sincronización." });
    }

    // Extraer la fecha de sincronización
    const lastSyncDate = result[0].hasta_date;
    console.log("Fecha de sincronización obtenida:", lastSyncDate);  // Verificar el valor

    // Formatear la fecha a formato ISO (YYYY-MM-DDTHH:mm:ss.sssZ)
    const formattedDate = lastSyncDate ? new Date(lastSyncDate).toISOString().split('T')[0] : null;  // Obtener solo la fecha sin la hora

    // Devolver la respuesta en formato legible (solo la fecha)
    res.json({
      lastSync: formattedDate,
    });
  } catch (error) {
    console.error('Error al obtener la última fecha de sincronización:', error);
    res.status(500).json({ error: "Error al obtener la última fecha de sincronización", detalle: error.message });
  }
};



// const sincronizarVentas = async (req, res) => {
//   try {
//     let { anio, mes, desde, hasta } = req.query;

//     let startDate;
//     let endDate;

//     if (desde && hasta) {
//       startDate = desde;
//       endDate = hasta;
//     } else if (anio && mes) {
//       const anioNum = Number(anio);
//       const mesNum = Number(mes);

//       if (!anioNum || !mesNum) {
//         return res
//           .status(400)
//           .json({ error: "anio y mes deben ser numéricos cuando no se envía desde/hasta" });
//       }

//       const mesStr = String(mesNum).padStart(2, "0");
//       startDate = `${anioNum}-${mesStr}-01`;

//       // último día del mes
//       const lastDay = new Date(anioNum, mesNum, 0).getDate();
//       endDate = `${anioNum}-${mesStr}-${String(lastDay).padStart(2, "0")}`;
//     } else {
//       return res.status(400).json({
//         error:
//           "Debe enviar anio & mes, o bien desde & hasta. Ej: ?anio=2025&mes=1 o ?desde=2025-01-01&hasta=2025-01-31",
//       });
//     }

//     console.log(`🌐 [SYNC CTRL] Solicitando sincronización ${startDate} → ${endDate}`);

//     const resultado = await sincronizarVentasRango(startDate, endDate);

//     res.json({
//       mensaje: "Sincronización ejecutada correctamente",
//       rango: { desde: startDate, hasta: endDate },
//       ...resultado,
//     });
//   } catch (error) {
//     console.error("❌ [SYNC CTRL] Error:", error.message);
//     res.status(500).json({ error: "Error interno al sincronizar", detalle: error.message });
//   }
// };



const sincronizarVentas = async (req, res) => {
  try {
    if (syncState.running) {
      return res.status(409).json({
        error: "Ya existe una sincronización en curso"
      });
    }

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
        return res.status(400).json({
          error: "anio y mes deben ser numéricos"
        });
      }

      const mesStr = String(mesNum).padStart(2, "0");
      startDate = `${anioNum}-${mesStr}-01`;
      const lastDay = new Date(anioNum, mesNum, 0).getDate();
      endDate = `${anioNum}-${mesStr}-${String(lastDay).padStart(2, "0")}`;
    } else {
      return res.status(400).json({
        error: "Debe enviar anio&mes o desde&hasta"
      });
    }

    console.log(`🚀 [SYNC] Iniciando sincronización ${startDate} → ${endDate}`);

    // Inicializar estado
    syncState.running = true;
    syncState.startDate = startDate;
    syncState.endDate = endDate;
    syncState.page = 0;
    syncState.total = 0;
    syncState.error = null;
    syncState.startedAt = new Date();
    syncState.finishedAt = null;

    // 🔥 Ejecutar en background
    sincronizarVentasRango(startDate, endDate, syncState)
      .then(() => {
        syncState.running = false;
        syncState.finishedAt = new Date();
        console.log("✅ [SYNC] Sincronización finalizada");
      })
      .catch(err => {
        syncState.running = false;
        syncState.error = err.message;
        console.error("❌ [SYNC] Error:", err.message);
      });

    // RESPUESTA INMEDIATA
    res.json({
      mensaje: "Sincronización iniciada",
      rango: { desde: startDate, hasta: endDate }
    });

  } catch (error) {
    console.error("❌ [SYNC CTRL]", error.message);
    res.status(500).json({ error: error.message });
  }
};


module.exports = {
  sincronizarVentas,
  getLastSync
};
