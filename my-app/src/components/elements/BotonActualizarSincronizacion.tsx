import React, { useState, useEffect } from "react";
import toast from "react-hot-toast";


// 🔹 BASE DINÁMICA (LOCAL / PRODUCCIÓN)
const API_BASE =
  // import.meta.env.VITE_API_URL || 
  "http://localhost:5000";

const BotonActualizarSincronizacion = () => {
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncDate, setLastSyncDate] = useState("");
  const [progress, setProgress] = useState<number>(0);

  // 🔹 Última sincronización
  useEffect(() => {
    fetch(`${API_BASE}/api/sync/last-sync`)
      .then(res => res.json())
      .then(data => {
        setLastSyncDate(data.lastSync || "No se ha sincronizado aún");
      })
      .catch(() => {
        setLastSyncDate("Error al obtener fecha de sincronización");
      });
  }, []);

  // 🔹 Polling de estado
  useEffect(() => {
    if (!isSyncing) return;

    const startTime = Date.now();
    let lastPercent = 0;

    const interval = setInterval(async () => {
      try {
        const res = await fetch(`${API_BASE}/api/sync/status`);
        const data = await res.json();

        const percent = data.percent ?? 0;
        setProgress(percent);

        // ⏱️ timeout máximo (20 min)
        if (Date.now() - startTime > 20 * 60 * 1000) {
          clearInterval(interval);
          setIsSyncing(false);
          alert(
            "⚠️ La sincronización está tardando más de lo esperado.\nPuedes refrescar más tarde para ver el resultado."
          );
          return;
        }

        //  CONDICIÓN SEGURA DE FIN
        if (data.running === false && data.finishedAt) {
          clearInterval(interval);
          setIsSyncing(false);
          setProgress(100);

          const last = await fetch(`${API_BASE}/api/sync/last-sync`);
          const lastData = await last.json();
          setLastSyncDate(lastData.lastSync || "");

          setTimeout(() => {
            alert(" Actualización exitosa. La pantalla se refrescará.");
            window.location.reload();
          }, 800);

          return;
        }

        lastPercent = percent;
      } catch (err) {
        console.error("Error consultando estado:", err);
        //  NO rompemos el polling por un error puntual
      }
    }, 4000); // ⏳ más relajado para producción

    return () => clearInterval(interval);
  }, [isSyncing]);


  // 🔹 Iniciar sincronización
  const handleSync = async () => {
    try {
      setIsSyncing(true);
      setProgress(0);

      const today = new Date();
      const startDate = new Date(
        today.getFullYear(),
        today.getMonth(),
        1
      ).toISOString().split("T")[0];

      const endDate = new Date(
        today.getFullYear(),
        today.getMonth(),
        today.getDate() - 1
      ).toISOString().split("T")[0];

      const res = await fetch(
        `${API_BASE}/api/sync/sincronizar?desde=${startDate}&hasta=${endDate}`
      );

      if (!res.ok) {
        throw new Error("No se pudo iniciar la sincronización");
      }
    } catch (error: any) {
      setIsSyncing(false);
      setProgress(0);
      alert("Error al iniciar sincronización: " + error.message);
    }
  };

  return (
    <div className="text-center">
      <div className="text-sm text-gray-500 mb-3">
        Última sincronización: {lastSyncDate}
      </div>

      {isSyncing && (
        <div className="mb-3">
          <div className="text-sm mb-1">
            Sincronizando... {progress}%
          </div>
          <div className="w-full bg-gray-200 rounded">
            <div
              className="bg-[#0db48b] h-2 rounded transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}

      <button
        onClick={handleSync}
        disabled={isSyncing}
        className={`bg-[#0db48b] px-6 py-3 rounded-lg shadow-lg transition-all
          ${isSyncing ? "opacity-60 cursor-not-allowed" : "hover:bg-[#058A73]"}`}
      >
        {isSyncing ? "Sincronizando..." : "Actualizar Sincronización"}
      </button>
    </div>
  );
};

export default BotonActualizarSincronizacion;
