import React, { useState, useEffect } from "react";
import logo from "../../assets/imagen-botellon-v01.png";
import { useAuth } from "../../components/auth/AuthContext";
import DashboardLayout from "../../layout/DashboardLayout";
import { Header } from "../../components/common/Header";
import KpisBotellones from "../../components/ComponentBotellon/KpisBotellones";
import TablaResumenBotellones from "../../components/ComponentBotellon/TablaResumenBotellones";
import BotonActualizarSincronizacion from "../../components/elements/BotonActualizarSincronizacion";

const meses: Record<string, number> = {
  Enero: 1, Febrero: 2, Marzo: 3, Abril: 4,
  Mayo: 5, Junio: 6, Julio: 7, Agosto: 8,
  Septiembre: 9, Octubre: 10, Noviembre: 11, Diciembre: 12,
};

export default function DashboardBotellon() {
  const hoy = new Date();
  const mesActual = hoy.getMonth() + 1;
  const anioActual = hoy.getFullYear();

  // Verificamos si hay un valor guardado en localStorage y usamos el año y mes actual como valores por defecto.
  const mesGuardado = localStorage.getItem("mesSeleccionado");
  const anioGuardado = localStorage.getItem("anioSeleccionado");

  const [mesSeleccionado, setMesSeleccionado] = useState<string>(
    mesGuardado ?? mesActual.toString() // Usa mes actual si no hay guardado
  );
  const [anioSeleccionado, setAnioSeleccionado] = useState<string>(
    anioGuardado ?? anioActual.toString() // Usa año actual si no hay guardado
  );

  const [datos, setDatos] = useState<any>(null);
  const [cargando, setCargando] = useState(false);

  const { user } = useAuth();
  const isAdmin = user?.role === "ADMIN";

  useEffect(() => {
    cargarDatos();
  }, [anioSeleccionado, mesSeleccionado]);

  const cargarDatos = async () => {
    try {
      setCargando(true);
      const res = await fetch(
        `http://localhost:5000/api/botellones/dashboard?anio=${anioSeleccionado}&mes=${mesSeleccionado}`
      );
      const data = await res.json();
      console.log("Datos botellones:", data);

      setDatos(data);
    } catch (e) {
      console.error(e);
    } finally {
      setCargando(false);
    }
  };

  // Guardar cambios en localStorage
  useEffect(() => {
    localStorage.setItem("mesSeleccionado", mesSeleccionado);
    localStorage.setItem("anioSeleccionado", anioSeleccionado);
  }, [mesSeleccionado, anioSeleccionado]);

  return (
    <DashboardLayout>
      <div className="main-content min-h-screen text-white font-sans px-10 py-6 bg-gradient-to-b from-[#012E24] to-[#014434]">
        <Header />
        {/* HEADER */}
        <header className="flex flex-col sm:flex-row justify-between items-center mb-10 border-b border-[#046C5E] pb-4 py-6">
          <div className="flex items-center gap-4">
            <img src={logo}   className="h-16 w-auto transition-all duration-300" alt="Logo" />
            <div>
              <h1 className="text-3xl font-bold tracking-wide">
                Dashboard Botellones
              </h1>
              <p className="text-sm text-gray-300">
                Órdenes + Facturas por grupo comercial
              </p>
            </div>
          </div>

             {/* Botón de actualización de sincronización - Centrado en dispositivos móviles */}
          <div className="flex justify-center w-full sm:w-auto mt-4 sm:mt-0">
            <BotonActualizarSincronizacion />
          </div>

          <div className="flex items-center gap-3">
            <select
              className="bg-[#046C5E] text-white px-4 py-2 rounded-lg shadow-sm hover:bg-[#058A73] focus:outline-none transition"
              value={mesSeleccionado}
              onChange={(e) => setMesSeleccionado(e.target.value)}
            >
              {Object.entries(meses).map(([n, v]) => (
                <option key={n} value={v}>{n}</option>
              ))}
            </select>

            <select
              className="bg-[#046C5E] px-4 py-2 rounded-lg"
              value={anioSeleccionado}
              onChange={(e) => setAnioSeleccionado(e.target.value)}
            >
              {Array.from({ length: 5 }, (_, i) => 2026 - i).map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>
        </header>

        {cargando && <p className="text-center">Cargando…</p>}

        {datos?.kpisBotellones && (
          <KpisBotellones
            kpis={datos.kpisBotellones}
            comparativa={datos.comparativaMesAnterior}
          />
        )}

        {datos?.botellones && !cargando && (
          <>
            <TablaResumenBotellones
              botellones={datos.botellones}
              anio={Number(anioSeleccionado)}
              mes={Number(mesSeleccionado)}
            />
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
