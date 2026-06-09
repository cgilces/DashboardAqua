import { useState, useEffect } from "react";
import { RefreshCw } from "lucide-react";
import { API_BASE_URL } from "../../config";

const BotonRutasyDetalles = () => {
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [lastSyncDate, setLastSyncDate] = useState<string>("…");

  /* Última sincronización */
  useEffect(() => {
    fetch(`${API_BASE_URL}/api/sync/last-sync`)
      .then((res) => res.json())
      .then((data) => setLastSyncDate(data?.lastSync || "Sin sincronizar"))
      .catch(() => setLastSyncDate("—"));
  }, []);

  /* Ejecutar sincronización */
  const handleSync = async () => {
    setIsSyncing(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/visitas/sincronizarrutasydetalles`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      if (!res.ok) throw new Error("No se pudo iniciar la sincronización");
      alert("Se actualizaron las rutas y detalles. Refrescando pantalla…");
      window.location.reload();
    } catch (err: any) {
      console.error("❌ Error al sincronizar rutas y detalles:", err);
      alert("Error: " + err.message);
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <div className="flex flex-col items-center gap-1.5">
      <button
        onClick={handleSync}
        disabled={isSyncing}
        aria-busy={isSyncing}
        className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white
          bg-gradient-to-r from-[#0db48b] to-[#058A73] shadow-lg shadow-emerald-950/40 ring-1 ring-white/10
          hover:from-[#10c79a] hover:to-[#06a085] hover:-translate-y-0.5 active:translate-y-0
          transition-all duration-150 disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:translate-y-0"
      >
        <RefreshCw size={16} className={isSyncing ? "animate-spin" : ""} />
        {isSyncing ? "Sincronizando…" : "Sincronizar rutas y detalles"}
      </button>

      <span className="text-[11px] text-gray-400">
        Última: <strong className="font-medium text-emerald-300">{lastSyncDate}</strong>
      </span>
    </div>
  );
};

export default BotonRutasyDetalles;
