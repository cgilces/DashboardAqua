import { useState } from "react";
import { History, CalendarRange } from "lucide-react";
import { API_BASE_URL } from "../../config";

const BotonHistorialRutas = () => {
  const [isSyncing, setIsSyncing] = useState(false);
  const [openModal, setOpenModal] = useState(false);
  const [fechaInicio, setFechaInicio] = useState("");
  const [fechaFin, setFechaFin] = useState("");

  /* Ejecutar sincronización */
  const handleSync = async () => {
    if (!fechaInicio || !fechaFin) {
      alert("Selecciona ambas fechas");
      return;
    }
    if (fechaInicio > fechaFin) {
      alert("La fecha inicio no puede ser mayor a la fecha fin");
      return;
    }

    try {
      setOpenModal(false);
      setIsSyncing(true);

      const res = await fetch(`${API_BASE_URL}/api/visitas/historialvisitas`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filter: { start_date: fechaInicio, end_date: fechaFin } }),
      });

      if (!res.ok) throw new Error("Error al sincronizar");
      alert("Sincronización completada");
    } catch (err: any) {
      alert("Error: " + err.message);
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <>
      <div className="flex flex-col items-center gap-1.5">
        <button
          onClick={() => setOpenModal(true)}
          disabled={isSyncing}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white
            bg-gradient-to-r from-[#0db48b] to-[#058A73] shadow-lg shadow-emerald-950/40 ring-1 ring-white/10
            hover:from-[#10c79a] hover:to-[#06a085] hover:-translate-y-0.5 active:translate-y-0
            transition-all duration-150 disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:translate-y-0"
        >
          <History size={16} />
          Sincronizar historial
        </button>

        <span className="text-[11px] text-gray-400">Por rango de fechas</span>
      </div>

      {/* ── MODAL FECHAS ── */}
      {openModal && (
        <div
          className="fixed inset-0 z-40 flex items-center justify-center bg-black/50 backdrop-blur-sm"
          onClick={() => setOpenModal(false)}
        >
          <div
            className="bg-[#162B25] border border-[#046C5E] rounded-2xl shadow-xl w-full max-w-md p-6 animate-fade-in"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-lg font-semibold mb-1 text-white flex items-center gap-2">
              <CalendarRange size={20} className="text-emerald-300" />
              Sincronizar historial de visitas
            </h2>
            <p className="text-sm text-gray-400 mb-5">Elige el rango de fechas a procesar.</p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs uppercase tracking-wide text-emerald-300 mb-1">
                  Fecha inicio
                </label>
                <input
                  type="date"
                  value={fechaInicio}
                  onChange={(e) => setFechaInicio(e.target.value)}
                  className="w-full rounded-lg px-3 py-2 text-black bg-white outline-none focus:ring-2 focus:ring-emerald-400"
                />
              </div>

              <div>
                <label className="block text-xs uppercase tracking-wide text-emerald-300 mb-1">
                  Fecha fin
                </label>
                <input
                  type="date"
                  value={fechaFin}
                  onChange={(e) => setFechaFin(e.target.value)}
                  className="w-full rounded-lg px-3 py-2 text-black bg-white outline-none focus:ring-2 focus:ring-emerald-400"
                />
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => setOpenModal(false)}
                className="px-4 py-2 rounded-lg font-semibold text-gray-200 bg-white/5 ring-1 ring-white/15 hover:bg-white/10 transition"
              >
                Cancelar
              </button>

              <button
                onClick={handleSync}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg font-semibold text-white
                  bg-gradient-to-r from-[#0db48b] to-[#058A73] hover:from-[#10c79a] hover:to-[#06a085] transition"
              >
                <History size={16} />
                Sincronizar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── OVERLAY CARGANDO ── */}
      {isSyncing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
          <div className="bg-[#162B25] border border-[#046C5E] rounded-2xl shadow-2xl p-10 w-[420px] flex flex-col items-center gap-6">
            <div className="w-16 h-16 border-4 border-[#0db48b]/30 border-t-[#0db48b] rounded-full animate-spin" />

            <div className="text-center">
              <p className="text-lg font-semibold text-white">Sincronizando historial…</p>
              <p className="text-sm text-gray-400 mt-1">Procesando información, por favor espere</p>
            </div>

            <div className="w-full h-3 bg-[#0db48b]/20 rounded-full overflow-hidden relative">
              <div className="absolute inset-0 shimmer-bar" />
            </div>
          </div>
        </div>
      )}

      <style>
        {`
          .shimmer-bar {
            background: linear-gradient(
              90deg,
              rgba(255,255,255,0.1) 0%,
              rgba(255,255,255,0.5) 50%,
              rgba(255,255,255,0.1) 100%
            );
            animation: shimmer 1.5s infinite;
          }
          @keyframes shimmer {
            0% { transform: translateX(-100%); }
            100% { transform: translateX(100%); }
          }
        `}
      </style>
    </>
  );
};

export default BotonHistorialRutas;
