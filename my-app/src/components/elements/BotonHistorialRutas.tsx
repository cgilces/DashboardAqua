import React, { useState } from "react";

const API_URL = "http://localhost:5000";

const BotonHistorialRutas = () => {
  /* ===============================
     🔄 ESTADOS
  =============================== */
  const [isSyncing, setIsSyncing] = useState(false);
  const [openModal, setOpenModal] = useState(false);
  const [fechaInicio, setFechaInicio] = useState("");
  const [fechaFin, setFechaFin] = useState("");

  /* ===============================
     🚀 EJECUTAR SINCRONIZACIÓN
  =============================== */
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

      const res = await fetch(`${API_URL}/api/visitas/historialvisitas`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          filter: { start_date: fechaInicio, end_date: fechaFin },
        }),
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
      <div className="text-center">
        <div className="text-sm text-gray-500 mb-4">
          Historial Visitas
        </div>

        <button
          onClick={() => setOpenModal(true)}
          disabled={isSyncing}
          className={`px-6 py-3 rounded-xl shadow-lg font-medium transition
            ${isSyncing
              ? "bg-gray-400 cursor-not-allowed"
              : "bg-[#0db48b] text-white hover:bg-[#058A73]"}`}
        >
          Sincronizar
          <br />
          Historial Visitas
        </button>
      </div>

      {/* ===============================
         📅 MODAL FECHAS
      =============================== */}
      {openModal && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-[#162B25] rounded-2xl shadow-xl w-full max-w-md p-6 animate-fade-in">
            <h2 className="text-lg font-semibold mb-4 text-white">
              Rango de sincronización visitas
            </h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm text-white mb-1">
                  Fecha inicio
                </label>
                <input
                  type="date"
                  value={fechaInicio}
                  onChange={(e) => setFechaInicio(e.target.value)}
                  className="w-full border rounded-lg px-3 py-2 text-black bg-white"
                />
              </div>

              <div>
                <label className="block text-sm text-white mb-1">
                  Fecha fin
                </label>
                <input
                  type="date"
                  value={fechaFin}
                  onChange={(e) => setFechaFin(e.target.value)}
                  className="w-full border rounded-lg px-3 py-2 text-black bg-white"
                />
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => setOpenModal(false)}
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

      {/* ===============================
         ⏳ OVERLAY CARGANDO PROFESIONAL
      =============================== */}
      {isSyncing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
          <div className="bg-[#162B25] rounded-2xl shadow-2xl p-10 w-[420px] flex flex-col items-center gap-6">

            {/* Spinner */}
            <div className="w-16 h-16 border-4 border-[#0db48b]/30 border-t-[#0db48b] rounded-full animate-spin"></div>

            {/* Texto */}
            <div className="text-center">
              <p className="text-lg font-semibold text-white">
                Sincronizando historial...
              </p>
              <p className="text-sm text-gray-400 mt-1">
                Procesando información, por favor espere
              </p>
            </div>

            {/* Barra shimmer animada */}
            <div className="w-full h-3 bg-[#0db48b]/20 rounded-full overflow-hidden relative">
              <div className="absolute inset-0 shimmer-bar"></div>
            </div>

          </div>
        </div>
      )}

      {/* ===============================
         ✨ ANIMACIÓN SHIMMER
      =============================== */}
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