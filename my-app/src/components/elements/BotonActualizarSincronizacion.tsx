import React, { useState, useEffect } from "react";
// import { API_URL } from '../../c';

const API_URL =
  // import.meta.env.VITE_API_URL ||
  "http://localhost:5000";

const BotonActualizarSincronizacion = () => {
  /* =====================================================
   * 🔄 Estados principales
   * ===================================================== */
  const [isSyncing, setIsSyncing] = useState(false);
  const [progress, setProgress] = useState<number>(0);
  const [lastSyncDate, setLastSyncDate] = useState("");

  /* =====================================================
   * 📅 Modal y fechas
   * ===================================================== */
  const [openModal, setOpenModal] = useState(false);
  const [fechaInicio, setFechaInicio] = useState("");
  const [fechaFin, setFechaFin] = useState("");

  /* =====================================================
   * 📥 Última sincronización
   * ===================================================== */
  useEffect(() => {
    console.log("📥 Cargando última fecha de sincronización...");

    fetch(`${API_URL}/api/sync/last-sync`)
      .then(res => {
        console.log("📥 Respuesta last-sync:", res.status);
        return res.json();
      })
      .then(data => {
        console.log("📥 Datos last-sync:", data);
        setLastSyncDate(data?.lastSync || "No se ha sincronizado aún");
      })
      .catch(err => {
        console.error("❌ Error obteniendo last-sync:", err);
        setLastSyncDate("Error al obtener fecha");
      });
  }, []);

  /* =====================================================
   * 🔁 Polling de estado
   * ===================================================== */
  useEffect(() => {
    if (!isSyncing) {
      console.log("⏸️ Polling detenido (isSyncing = false)");
      return;
    }

    console.log("▶️ Polling iniciado...");
    const startTime = Date.now();

    const interval = setInterval(async () => {
      try {
        console.log("🔄 Consultando /api/sync/status...");

        const res = await fetch(`${API_URL}/api/sync/status`);
        console.log("🔄 Status HTTP:", res.status);

        if (!res.ok) return;

        const data = await res.json();
        console.log("📊 Estado sincronización:", data);

        setProgress(data.percent ?? 0);

        // ⏱️ Timeout máximo
        if (Date.now() - startTime > 20 * 60 * 1000) {
          console.warn("⏱️ Timeout alcanzado (20 min)");
          clearInterval(interval);
          setIsSyncing(false);
          alert("⚠️ La sincronización está tardando más de lo esperado.");
          return;
        }

        // ✅ Finalización
        if (!data.running && data.finishedAt) {
          console.log("✅ Sincronización finalizada:", data.finishedAt);

          clearInterval(interval);
          setIsSyncing(false);
          setProgress(100);

          console.log("📥 Actualizando last-sync después de finalizar...");
          const last = await fetch(`${API_URL}/api/sync/last-sync`);
          const lastData = await last.json();
          console.log("📥 Nuevo last-sync:", lastData);

          setLastSyncDate(lastData?.lastSync || "");

          setTimeout(() => {
            console.log("🔄 Recargando pantalla...");
            alert("✅ Sincronización completada, Actualizar");
            window.location.reload();
          }, 800);
        }
      } catch (err) {
        console.error("❌ Error consultando estado:", err);
      }
    }, 4000);

    return () => {
      console.log("🧹 Limpiando intervalo de polling");
      clearInterval(interval);
    };
  }, [isSyncing]);

  /* =====================================================
   * 🚀 Ejecutar sincronización
   * ===================================================== */
  const handleSync = async () => {
    console.log("🚀 Click en Sincronizar");
    console.log("📅 Fecha inicio:", fechaInicio);
    console.log("📅 Fecha fin:", fechaFin);

    if (!fechaInicio || !fechaFin) {
      console.warn("⚠️ Fechas incompletas");
      alert("Selecciona ambas fechas");
      return;
    }

    if (fechaInicio > fechaFin) {
      console.warn("⚠️ Fecha inicio mayor que fecha fin");
      alert("La fecha inicio no puede ser mayor a la fecha fin");
      return;
    }

    try {
      setOpenModal(false);
      setIsSyncing(true);
      setProgress(0);

      const url = `${API_URL}/api/sync/sincronizar?desde=${fechaInicio}&hasta=${fechaFin}`;
      console.log("🔗 URL sincronización:", url);

      const res = await fetch(url);
      console.log("🚀 Respuesta iniciar sync:", res.status);

      if (!res.ok) {
        throw new Error("No se pudo iniciar la sincronización");
      }

      console.log("🚀 Sincronización iniciada correctamente");
    } catch (err: any) {
      console.error("❌ Error al iniciar sincronización:", err);
      setIsSyncing(false);
      setProgress(0);
      alert("❌ Error: " + err.message);
    }
  };

  /* =====================================================
   * 🖥️ Render
   * ===================================================== */
  return (
    <>
      <div className="text-center">
        <div className="text-sm text-gray-500 mb-4 text-center">
          Última sincronización: <strong>{lastSyncDate}</strong>
        </div>

        <div className="text-center">
          <button
            onClick={() => {
              console.log("🟢 Abriendo modal de fechas");
              setOpenModal(true);
            }}
            disabled={isSyncing}
            className={`px-6 py-3 rounded-xl shadow-lg font-medium transition
              ${isSyncing
                ? "bg-gray-400 cursor-not-allowed"
                : "bg-[#0db48b] text-white hover:bg-[#058A73]"
              }`}
          >
            {isSyncing ? "Sincronizando..." : "Actualizar Sincronización"}
          </button>
        </div>

        {isSyncing && (
          <div className="mb-3">
            <div className="text-sm mb-1">
              Sincronizando... {progress}%
            </div>
            <div className="w-full bg-gray-200 rounded">
              <div
                className="bg-[#6BAF8E] h-2 rounded-full transition-all"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        )}

        {openModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
            <div className="bg-[#162B25] rounded-2xl shadow-xl w-full max-w-md p-6 animate-fade-in">
              <h2 className="text-lg font-semibold mb-4 text-white">
                Seleccionar rango de sincronización
              </h2>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm text-white mb-1">
                    Fecha inicio
                  </label>
                  <input
                    type="date"
                    value={fechaInicio}
                    onChange={(e) => {
                      console.log("📅 Cambio fecha inicio:", e.target.value);
                      setFechaInicio(e.target.value);
                    }}
                    className="w-full border rounded-lg px-3 py-2 text-black bg-white focus:ring-2 focus:ring-[#0db48b]"
                  />
                </div>

                <div>
                  <label className="block text-sm text-white mb-1">
                    Fecha fin
                  </label>
                  <input
                    type="date"
                    value={fechaFin}
                    onChange={(e) => {
                      console.log("📅 Cambio fecha fin:", e.target.value);
                      setFechaFin(e.target.value);
                    }}
                    className="w-full border rounded-lg px-3 py-2 text-black bg-white focus:ring-2 focus:ring-[#0db48b]"
                  />
                </div>
              </div>

              <div className="mt-6 flex justify-end gap-3">
                <button
                  onClick={() => {
                    console.log("❌ Modal cancelado");
                    setOpenModal(false);
                  }}
                  className="px-4 py-2 rounded-lg bg-[#BEDACC] text-black font-semibold hover:bg-[#A8C9B7]"
                >
                  Cancelar
                </button>

                <button
                  onClick={handleSync}
                  className="px-4 py-2 rounded-lg bg-[#6BAF8E] text-black font-semibold hover:bg-[#5FA381]"
                >
                  Sincronizar
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
};

export default BotonActualizarSincronizacion;
