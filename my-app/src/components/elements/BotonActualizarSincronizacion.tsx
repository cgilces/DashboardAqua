import React, { useState, useEffect } from 'react';

const BotonActualizarSincronizacion = () => {
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncDate, setLastSyncDate] = useState(""); // Estado para almacenar la última fecha de sincronización

  // Obtener la última fecha de sincronización al cargar el componente
  useEffect(() => {
    const fetchLastSyncDate = async () => {
      try {
        // Realizar la petición al backend para obtener la última fecha de sincronización
        const response = await fetch('http://localhost:5000/api/sync/last-sync');
        const data = await response.json();

        // Verificar si la respuesta tiene el campo 'lastSync' y actualizar el estado
        if (data.lastSync) {
          setLastSyncDate(data.lastSync); // Actualizar con la fecha de sincronización recibida
        } else {
          setLastSyncDate('No se ha sincronizado aún');
        }
      } catch (error) {
        console.error("Error al obtener la última fecha de sincronización:", error);
        setLastSyncDate('Error al obtener fecha de sincronización');
      }
    };

    // Llamada para obtener la última sincronización
    fetchLastSyncDate();
  }, []); // Se ejecuta solo una vez al montar el componente

  const handleSync = async () => {
    setIsSyncing(true); // Establecer el estado de sincronización a 'en proceso'
    console.log('Iniciando sincronización...');

    // Obtener la fecha actual
    const today = new Date();
    console.log('Fecha actual:', today);

    // Obtener la fecha del día anterior
    const lastSyncDate = new Date(today);
    lastSyncDate.setDate(today.getDate() - 1); // Restar un día
    lastSyncDate.setHours(23, 59, 59, 999); // Establecer la hora a 11:59:59.999 PM

    // Formatear las fechas en formato YYYY-MM-DD
    const startDate = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0]; // Primer día del mes
    const endDate = lastSyncDate.toISOString().split('T')[0]; // Día anterior a las 11:59 p.m.

    console.log('Fecha de inicio del mes:', startDate);
    console.log('Fecha de fin (día anterior a las 11:59 p.m.):', endDate);

    // Realizar la petición a la API para sincronizar
    try {
      console.log(`Haciendo petición a la API: http://localhost:5000/api/sync/sincronizar?desde=${startDate}&hasta=${endDate}`);
      const response = await fetch(`http://localhost:5000/api/sync/sincronizar?desde=${startDate}&hasta=${endDate}`);
      const data = await response.json();

      console.log('Respuesta de la API:', data);

      if (response.ok) {
        console.log('Sincronización completada con éxito');
        alert("Sincronización completada");

        // Actualizar la última fecha de sincronización con la fecha de 'endDate' de la respuesta
        setLastSyncDate(data.endDate); // Usar 'endDate' de la respuesta
      } else {
        throw new Error("Error en la sincronización");
      }
    } catch (error: any) {
      console.error('Error en la sincronización:', error);
      alert("Hubo un error al sincronizar: " + error.message);
    } finally {
      setIsSyncing(false); // Restablecer el estado de sincronización
      console.log('Sincronización finalizada');
    }
  };

  return (
    <div>
      {/* Mostrar la última fecha de sincronización */}
      <div className="text-center text-sm text-gray-500 mb-4">
        {`Última fecha de sincronización fue: ${lastSyncDate}`}
      </div>

      {/* Botón para iniciar la sincronización */}
      <button 
        onClick={handleSync} 
        disabled={isSyncing} // Deshabilitar el botón durante la sincronización
        className={`bg-[#0db48b] hover:bg-[#0aa77e] px-6 py-3 rounded-lg shadow-lg transition-all hover:bg-[#058A73] focus:outline-none ${isSyncing ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'}`}
      >
        {isSyncing ? 'Sincronizando...' : 'Actualizar Sincronización'}
      </button>
    </div>
  );
};

export default BotonActualizarSincronizacion;
