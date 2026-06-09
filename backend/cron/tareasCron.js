// cron/tareasCron.js
// Sincronización automática: 12:00 AM y 12:00 PM (America/Guayaquil)
// Cubre: MobilVendor, Odoo, Rutas y Historial de Visitas

const cron = require('node-cron');
const fs   = require('fs');
const path = require('path');

const { sincronizarVentasRango, sincronizarPromociones } = require('../services/sincronizacionService');
const { sincronizarOdooCompletoRango } = require('../services/odooServicio/sincronizacionOdooService');
const { sincronizarRutasYDetalles }    = require('../services/syncRouteDetailsService');
const { obtenerHistorialDeUsuarios }   = require('../services/syncHistorialVisitasService');

// ================================================================
// LOGGING
// ================================================================
const LOG_DIR = path.join(__dirname, 'cronLog');
if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR, { recursive: true });

function getLogFile() {
  // Un archivo por día en zona horaria Ecuador
  const fecha = new Date()
    .toLocaleDateString('en-CA', { timeZone: 'America/Guayaquil' }); // "YYYY-MM-DD"
  return path.join(LOG_DIR, `${fecha}.log`);
}

function log(msg, nivel = 'INFO') {
  const ts   = new Date().toLocaleString('es-EC', { timeZone: 'America/Guayaquil' });
  const linea = `[${ts}] [${nivel.padEnd(5)}] ${msg}\n`;
  process.stdout.write(linea);
  try { fs.appendFileSync(getLogFile(), linea); } catch (_) { /* no bloquear si hay error de I/O */ }
}

// ================================================================
// LOCK — evita ejecuciones concurrentes
// ================================================================
let isRunning = false;

// ================================================================
// HELPERS DE FECHA  (yyyy-mm-dd, hora Ecuador)
// ================================================================
function fechaStr(offset = 0) {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return d.toLocaleDateString('en-CA', { timeZone: 'America/Guayaquil' });
}

// ================================================================
// NÚCLEO DE SINCRONIZACIÓN
// label     → texto identificador en logs
// startDate → fecha inicio yyyy-mm-dd
// endDate   → fecha fin   yyyy-mm-dd
// ================================================================
async function ejecutarSincronizacion(label, startDate, endDate) {
  if (isRunning) {
    log(`[${label}] Otra sincronización en curso — ejecución omitida`, 'WARN');
    return;
  }

  isRunning = true;
  const inicio = Date.now();

  log('='.repeat(65));
  log(`[${label}] Rango: ${startDate} → ${endDate}`);
  log('='.repeat(65));

  const resultados = {
    mobilvendor : null,
    odoo        : null,
    rutas       : null,
    visitas     : null,
    promos      : null,
  };

  // ── 1. MobilVendor + Odoo en paralelo ───────────────────────
  log('[MV + Odoo] Iniciando sincronización paralela...');

  const [resMV, resOdoo] = await Promise.allSettled([
    sincronizarVentasRango(startDate, endDate),
    sincronizarOdooCompletoRango(startDate, endDate),
  ]);

  if (resMV.status === 'fulfilled') {
    const errDoc = resMV.value?.erroresPorDocumento?.length ?? 0;
    resultados.mobilvendor = `OK${errDoc > 0 ? ` (${errDoc} errores de documento)` : ''}`;
    log(`[MobilVendor] ${resultados.mobilvendor}`);
  } else {
    resultados.mobilvendor = `ERROR: ${resMV.reason?.message ?? 'desconocido'}`;
    log(`[MobilVendor] ${resultados.mobilvendor}`, 'ERROR');
  }

  if (resOdoo.status === 'fulfilled') {
    resultados.odoo = 'OK';
    log('[Odoo]        OK');
  } else {
    resultados.odoo = `ERROR: ${resOdoo.reason?.message ?? 'desconocido'}`;
    log(`[Odoo]        ${resultados.odoo}`, 'ERROR');
  }

  // ── 2. Rutas ─────────────────────────────────────────────────
  log('[Rutas] Iniciando sincronización...');
  try {
    await sincronizarRutasYDetalles();
    resultados.rutas = 'OK';
    log('[Rutas]       OK');
  } catch (e) {
    resultados.rutas = `ERROR: ${e.message ?? 'desconocido'}`;
    log(`[Rutas]       ${resultados.rutas}`, 'ERROR');
  }

  // ── 3. Historial de visitas ──────────────────────────────────
  log('[Visitas] Iniciando sincronización...');
  try {
    await obtenerHistorialDeUsuarios(startDate, endDate);
    resultados.visitas = 'OK';
    log('[Visitas]     OK');
  } catch (e) {
    resultados.visitas = `ERROR: ${e.message ?? 'desconocido'}`;
    log(`[Visitas]     ${resultados.visitas}`, 'ERROR');
  }

  // ── 4. Promociones (maestro MobilVendor) ─────────────────────
  log('[Promos] Iniciando sincronización...');
  try {
    await sincronizarPromociones();
    resultados.promos = 'OK';
    log('[Promos]      OK');
  } catch (e) {
    resultados.promos = `ERROR: ${e.message ?? 'desconocido'}`;
    log(`[Promos]      ${resultados.promos}`, 'ERROR');
  }

  // ── Resumen final ────────────────────────────────────────────
  const duracion   = ((Date.now() - inicio) / 1000).toFixed(1);
  const hayErrores = Object.values(resultados).some(v => v && v.startsWith('ERROR'));

  log('-'.repeat(65));
  log(`[${label}] Finalizado en ${duracion}s — ${hayErrores ? 'CON ERRORES' : 'TODO OK'}`);
  log(`  MobilVendor : ${resultados.mobilvendor}`);
  log(`  Odoo        : ${resultados.odoo}`);
  log(`  Rutas       : ${resultados.rutas}`);
  log(`  Visitas     : ${resultados.visitas}`);
  log(`  Promos      : ${resultados.promos}`);
  log('='.repeat(65) + '\n');

  isRunning = false;
}

// ================================================================
// CRON 1 — 12:00 AM (medianoche)
// Sincroniza ayer + hoy: captura el día anterior completo y el
// inicio del día actual
// ================================================================
cron.schedule('0 0 * * *', async () => {
  await ejecutarSincronizacion('CRON 12:00 AM', fechaStr(-1), fechaStr(0));
}, { timezone: 'America/Guayaquil' });

// ================================================================
// CRON 2 — 12:00 PM (mediodía)
// Sincroniza solo el día en curso: actualización intradiaria
// ================================================================
cron.schedule('0 12 * * *', async () => {
  await ejecutarSincronizacion('CRON 12:00 PM', fechaStr(0), fechaStr(0));
}, { timezone: 'America/Guayaquil' });

log('CRON inicializado — ejecuciones diarias: 12:00 AM y 12:00 PM (America/Guayaquil)');
