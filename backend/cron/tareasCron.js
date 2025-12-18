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

// 🕑 CRON configurado para Ecuador: Ejecutar a las 12:00 AM y 11:59 PM todos los días
cron.schedule('0 0 * * *', async () => {  // 12:00 AM
  writeLog("=== Inicio de ejecución del CRON (12:00 AM) ===");

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

  writeLog("=== Fin de ejecución del CRON (12:00 AM) ===\n");
}, {
  timezone: "America/Guayaquil"
});

cron.schedule('59 23 * * *', async () => {  // 11:59 PM
  writeLog("=== Inicio de ejecución del CRON (11:59 PM) ===");

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

  writeLog("=== Fin de ejecución del CRON (11:59 PM) ===\n");
}, {
  timezone: "America/Guayaquil"
});

// Mensaje en consola
console.log("🟢 CRON inicializado (corre diario a las 12:00 AM y 11:59 PM hora Ecuador)");
