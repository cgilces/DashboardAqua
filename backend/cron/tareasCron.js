const cron = require('node-cron');
const fs = require('fs');
const path = require('path');
const { sincronizarVentasRango } = require('../services/sincronizacionService');

// 📂 Carpeta donde guardaremos logs
const logDir = path.join(__dirname, 'cronLog');

// Crear carpeta si no existe
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir);
}

// 📝 Función utilitaria para escribir log
function writeLog(message) {
  const fecha = new Date();

  const name = fecha.toISOString().slice(0, 10) + ".log";  // ej: 2025-11-27.log
  const logFile = path.join(logDir, name);

  const linea = `[${fecha.toLocaleString()}] ${message}\n`;
  fs.appendFileSync(logFile, linea);
}

// 🕑 CRON configurado para Ecuador: 02:00 AM todos los días
cron.schedule('0 2 * * *', async () => {
  writeLog("=== Inicio de ejecución del CRON ===");

  try {
    const hoy = new Date();
    const ayer = new Date();
    ayer.setDate(hoy.getDate() - 1);

    const startDate = ayer.toISOString().slice(0, 10); // yyyy-mm-dd
    const endDate = hoy.toISOString().slice(0, 10);    // yyyy-mm-dd

    writeLog(`Sincronizando rango: ${startDate} → ${endDate}`);

    await sincronizarVentasRango(startDate, endDate);

    writeLog("✔ Sincronización completada correctamente");
  } catch (error) {
    writeLog("✘ Error en sincronización: " + error.message);
  }

  writeLog("=== Fin de ejecución del CRON ===\n");
}, {
  timezone: "America/Guayaquil"
});

// Mensaje en consola
console.log("🟢 CRON inicializado (corre diario 02:00 AM hora Ecuador)");
