// pages/pagesCafe/DashboardCafe.tsx
import React, { useState, useEffect } from "react";
import DashboardLayout from "../../layout/DashboardLayout";
import TablaCafe from "../../components/ComponentCafe/TablaCafe";
import BotonActualizarSincronizacion from "../../components/elements/BotonActualizarSincronizacion";
import { Header } from "../../components/common/Header";
import { BsCupHot } from "react-icons/bs";
import { Calendar } from "lucide-react";

const meses = {
  Enero: "01", Febrero: "02", Marzo: "03", Abril: "04",
  Mayo: "05", Junio: "06", Julio: "07", Agosto: "08",
  Septiembre: "09", Octubre: "10", Noviembre: "11", Diciembre: "12",
};

const hoy = new Date();
const mesActual  = String(hoy.getMonth() + 1).padStart(2, "0");
const anioActual = String(hoy.getFullYear());

const DashboardCafe: React.FC = () => {
  const [mesSeleccionado,  setMesSeleccionado]  = useState(
    localStorage.getItem("mesSeleccionadoCafe") ?? mesActual
  );
  const [anioSeleccionado, setAnioSeleccionado] = useState(
    localStorage.getItem("anioSeleccionadoCafe") ?? anioActual
  );

  useEffect(() => {
    localStorage.setItem("mesSeleccionadoCafe",  mesSeleccionado);
    localStorage.setItem("anioSeleccionadoCafe", anioSeleccionado);
  }, [mesSeleccionado, anioSeleccionado]);

  return (
    <DashboardLayout>
      <div className="main-content min-h-screen text-white px-4 md:px-10 py-4 md:py-6">
        <Header />

        {/* ── HEADER ─────────────────────────────────────────────── */}
        <header className="flex flex-col gap-4 md:flex-row md:justify-between md:items-center mb-6 md:mb-10 border-b border-[#046C5E] pb-4 py-4 md:py-6">
          <div className="flex items-center gap-4">
            <div className="h-14 w-14 rounded-xl bg-[#014434] border border-[#046C5E] flex items-center justify-center">
              <BsCupHot size={28} className="text-amber-400" />
            </div>
            <div>
              <h1 className="text-xl md:text-3xl font-bold tracking-wide">DASHBOARD CAFÉ</h1>
              <p className="text-sm text-gray-300">IIBC S.A. — Facturación</p>
            </div>
          </div>

          <div className="flex justify-center w-full md:w-auto">
            <BotonActualizarSincronizacion />
          </div>

          <div className="flex items-center gap-3 w-full md:w-auto flex-wrap">
            <div className="relative flex-1 min-w-[120px]">
              <Calendar size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/60 pointer-events-none" />
              <select
                className="bg-[#046C5E] text-white pl-9 pr-4 py-2 rounded-lg w-full appearance-none"
                value={mesSeleccionado}
                onChange={(e) => setMesSeleccionado(e.target.value)}
              >
                {Object.entries(meses).map(([nombre, valor]) => (
                  <option key={valor} value={valor}>{nombre}</option>
                ))}
              </select>
            </div>
            <div className="relative flex-1 min-w-[120px]">
              <Calendar size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/60 pointer-events-none" />
              <select
                className="bg-[#046C5E] text-white pl-9 pr-4 py-2 rounded-lg w-full appearance-none"
                value={anioSeleccionado}
                onChange={(e) => setAnioSeleccionado(e.target.value)}
              >
                {Array.from({ length: 5 }, (_, i) => 2026 - i).map((anio) => (
                  <option key={anio} value={anio}>{anio}</option>
                ))}
              </select>
            </div>
          </div>
        </header>

        {/* ── TABLA + KPIs ───────────────────────────────────────── */}
        <TablaCafe
          anio={anioSeleccionado}
          mes={mesSeleccionado}
        />
      </div>
    </DashboardLayout>
  );
};

export default DashboardCafe;
