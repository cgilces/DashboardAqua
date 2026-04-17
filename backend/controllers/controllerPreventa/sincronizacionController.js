// controllers/sincronizacionController.js
const sequelize = require("../../db");
const { sincronizarVentasRango, sincronizarDirecciones } = require("../../services/sincronizacionService");
const { sincronizarOdooCompletoRango }  = require("../../services/odooServicio/sincronizacionOdooService");
const syncState = require("./syncState");

// ================================================================
// GET /api/sync/last-sync
// ================================================================
const getLastSync = async (req, res) => {
  try {
    const result = await sequelize.query(
      "SELECT hasta_date FROM sincronizaciones_ventas ORDER BY fecha_sync DESC LIMIT 1",
      { type: sequelize.QueryTypes.SELECT }
    );

    if (result.length === 0) {
      return res.status(404).json({ error: "No se encontró una fecha de sincronización." });
    }

    const lastSyncDate  = result[0].hasta_date;
    const formattedDate = lastSyncDate
      ? new Date(lastSyncDate).toISOString().split("T")[0]
      : null;

    res.json({ lastSync: formattedDate });
  } catch (error) {
    console.error("Error al obtener la última fecha de sincronización:", error);
    res.status(500).json({
      error  : "Error al obtener la última fecha de sincronización",
      detalle: error.message,
    });
  }
};

// ================================================================
// GET /api/sync/sincronizar
// Dispara MobilVendor + Odoo en paralelo en background
// ================================================================
const sincronizarVentas = async (req, res) => {
  try {
    if (syncState.running) {
      return res.status(409).json({ error: "Ya existe una sincronización en curso" });
    }

    // ── Parsear fechas ──────────────────────────────────────────
    let { anio, mes, desde, hasta } = req.query;
    let startDate, endDate;

    if (desde && hasta) {
      startDate = desde;
      endDate   = hasta;
    } else if (anio && mes) {
      const anioNum = Number(anio);
      const mesNum  = Number(mes);
      if (!anioNum || !mesNum)
        return res.status(400).json({ error: "anio y mes deben ser numéricos" });

      const mesStr = String(mesNum).padStart(2, "0");
      startDate    = `${anioNum}-${mesStr}-01`;
      const lastDay = new Date(anioNum, mesNum, 0).getDate();
      endDate      = `${anioNum}-${mesStr}-${String(lastDay).padStart(2, "0")}`;
    } else {
      return res.status(400).json({ error: "Debe enviar anio&mes o desde&hasta" });
    }

    console.log(`\n🚀 [SYNC] Iniciando sincronización paralela ${startDate} → ${endDate}`);

    // ── Inicializar estado de progreso ──────────────────────────
    Object.assign(syncState, {
      running   : true,
      startDate,
      endDate,
      page      : 0,
      total     : 0,
      percent   : 0,
      error     : null,
      startedAt : new Date(),
      finishedAt: null,
      // Info adicional de cada fuente
      mobilvendor: { estado: "EN_PROCESO", errores: 0 },
      odoo       : { estado: "EN_PROCESO", errores: 0 },
    });

    // ── Ejecutar todo en background ────────────────
    (async () => {
      try {
        // FASE 1: MobilVendor + Odoo en paralelo (0% → 70%)
        syncState.percent = 5;
        const [resMV, resOdoo] = await Promise.allSettled([
          sincronizarVentasRango(startDate, endDate, syncState),
          sincronizarOdooCompletoRango(startDate, endDate),
        ]);

        // MobilVendor
        if (resMV.status === "fulfilled") {
          syncState.mobilvendor.estado  = "COMPLETADO";
          syncState.mobilvendor.errores = resMV.value?.erroresPorDocumento?.length ?? 0;
          console.log("✅ [MobilVendor] Sincronización finalizada");
        } else {
          syncState.mobilvendor.estado = "ERROR";
          syncState.mobilvendor.error  = resMV.reason?.message;
          console.error("❌ [MobilVendor] Error:", resMV.reason?.message);
        }

        // Odoo
        if (resOdoo.status === "fulfilled") {
          syncState.odoo.estado = "COMPLETADO";
          console.log("✅ [Odoo] Sincronización finalizada");
        } else {
          syncState.odoo.estado = "ERROR";
          syncState.odoo.error  = resOdoo.reason?.message;
          console.error("❌ [Odoo] Error:", resOdoo.reason?.message);
        }

        // FASE 2: Direcciones (70% → 95%)
        syncState.percent = 70;
        try {
          console.log("📍 [Direcciones] Iniciando sincronización de customer_addresses...");
          const resDirecciones = await sincronizarDirecciones();
          console.log(`✅ [Direcciones] Completa: ${resDirecciones.totalProcessed} procesadas, ${resDirecciones.totalErrors} errores`);
        } catch (errDir) {
          console.error("❌ [Direcciones] Error:", errDir.message);
        }

        // FASE 3: Finalizar
        const hayErrores =
          resMV.status === "rejected" || resOdoo.status === "rejected";

        syncState.running    = false;
        syncState.percent    = 100;
        syncState.finishedAt = new Date();
        syncState.error      = hayErrores
          ? "Una o más fuentes terminaron con errores. Revisar logs."
          : null;

        console.log(`\n📊 [SYNC] Resultado final:`);
        console.log(`   MobilVendor : ${syncState.mobilvendor.estado}`);
        console.log(`   Odoo        : ${syncState.odoo.estado}`);

      } catch (err) {
        syncState.running    = false;
        syncState.percent    = 0;
        syncState.finishedAt = new Date();
        syncState.error      = err.message;
        console.error("❌ [SYNC] Error global:", err.message);
      }
    })();

    // ── Respuesta inmediata ─────────────────────────────────────
    return res.json({
      mensaje: "Sincronización iniciada (MobilVendor + Odoo + Direcciones en paralelo)",
      rango  : { desde: startDate, hasta: endDate },
    });

  } catch (error) {
    console.error("❌ [SYNC CTRL]", error.message);
    res.status(500).json({ error: error.message });
  }
};

// ================================================================
// GET /api/sync/sincronizar-direcciones
// Sincroniza direcciones desde customer_addresses de MobilVendor
// ================================================================
const sincronizarDireccionesCtrl = async (req, res) => {
  try {
    console.log("\n🚀 [SYNC] Iniciando sincronización de direcciones...");

    // Ejecutar en background
    sincronizarDirecciones()
      .then((result) => {
        console.log(`✅ [Direcciones] Completa: ${result.totalProcessed} procesadas, ${result.totalErrors} errores`);
      })
      .catch((err) => {
        console.error("❌ [Direcciones] Error:", err.message);
      });

    return res.json({
      mensaje: "Sincronización de direcciones iniciada en background",
    });
  } catch (error) {
    console.error("❌ [SYNC DIRECCIONES]", error.message);
    res.status(500).json({ error: error.message });
  }
};

module.exports = { sincronizarVentas, getLastSync, sincronizarDireccionesCtrl };