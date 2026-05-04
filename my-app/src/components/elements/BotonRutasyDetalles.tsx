import React, { useState, useEffect } from "react";
import { API_BASE_URL } from '../../config';

// URL para la sincronización

const BotonRutasyDetalles = () => {
  /* =====================================================
   * 🔄 Estados principales
   * ===================================================== */
  const [progress, setProgress] = useState<number>(0);
  const [isSyncing, setIsSyncing] = useState<boolean>(false); // Estado para gestionar la sincronización

  /* =====================================================
   * 📥 Última sincronización
   * ===================================================== */
  const [lastSyncDate, setLastSyncDate] = useState("");

  useEffect(() => {
    console.log("📥 Cargando última fecha de sincronización...");

    fetch(`${API_BASE_URL}/api/sync/last-sync`)
      .then(res => res.json())
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
   * 🚀 Ejecutar sincronización
   * ===================================================== */
  const handleSync = async () => {
    console.log("🚀 Iniciando sincronización");
    setIsSyncing(true); // Inicia la sincronización, deshabilitando el botón

    try {
      setProgress(0);

      // Llamar a la URL de sincronización con las fechas
      const url = `${API_BASE_URL}/api/visitas/sincronizarrutasydetalles`;
      console.log("🔗 URL sincronización:", url);

      // Cambiar a POST
      const res = await fetch(url, {
        method: 'POST',  // Cambiado de GET a POST
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!res.ok) {
        throw new Error("No se pudo iniciar la sincronización");
      }

      console.log("🚀 Sincronización iniciada correctamente");
      alert("Se han actualizado las rutas y detalles, refrescar pantalla..");  // Mensaje de éxito
      window.location.reload(); // Recarga la página para reflejar los cambios
    } catch (err: any) {
      console.error("❌ Error al iniciar sincronización:", err);
      setProgress(0);
      alert("Error: " + err.message);
    } finally {
      setIsSyncing(false); // Finaliza la sincronización, habilitando el botón
    }
  };

  /* =====================================================
   * 🖥️ Render
   * ===================================================== */
  return (
    <div className="text-center">
      <div className="text-sm text-gray-500 mb-4 text-center">
        Última sincronización: <strong>{lastSyncDate}</strong>
      </div>

      <div className="text-center">
        {/* Mostrar spinner de carga durante la sincronización */}
        {isSyncing && (
          <div className="flex items-center justify-center space-x-2">
            <div className="spinner-border" role="status">
              <span className="sr-only">Actualizando...</span>
            </div>
            <span className="text-[#0db48b] font-semibold">Actualizando...</span>
          </div>
        )}

        {/* Si no está sincronizando, mostrar el botón */}
        {!isSyncing && (
          <button
            onClick={handleSync}
            className="px-6 py-3 rounded-xl shadow-lg font-medium transition
              bg-[#0db48b] text-white hover:bg-[#058A73] disabled:bg-gray-400 disabled:cursor-not-allowed"
          >
            Sincronizar <br></br> Rutas y Detalles
          </button>
        )}
      </div>

      <style>{`
        /* Estilo para el spinner (círculo giratorio) */
        .spinner-border {
          width: 3rem;
          height: 3rem;
          border: 0.25em solid #f3f3f3;
          border-top: 0.25em solid #0db48b;
          border-radius: 50%;
          animation: spin 1s linear infinite;
        }

        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};

export default BotonRutasyDetalles;
