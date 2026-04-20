// pages/pagesCafe/DashboardCafe.tsx
import React, { useState, useEffect } from "react";
import DashboardLayout from "../../layout/DashboardLayout";
import TablaCafe from "../../components/ComponentCafe/TablaCafe";
import BotonActualizarSincronizacion from "../../components/elements/BotonActualizarSincronizacion";
import { Header } from "../../components/common/Header";
import { BsCupHot } from "react-icons/bs";

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
      <div className="main-content min-h-screen text-white px-2 sm:px-4 md:px-10 py-3 md:py-6">
        <Header />

        {/* ── HEADER ─────────────────────────────────────────────── */}
        <header className="flex flex-col gap-3 sm:gap-4 lg:flex-row lg:justify-between lg:items-center mb-5 sm:mb-6 md:mb-10 border-b border-[#046C5E] pb-4 pt-4 md:pt-6">
          <div className="flex items-center gap-3 sm:gap-4 min-w-0">
            <div className="h-10 w-10 sm:h-12 sm:w-12 md:h-14 md:w-14 rounded-xl bg-[#014434] border border-[#046C5E] flex items-center justify-center flex-shrink-0">
              <BsCupHot className="text-amber-400 w-5 h-5 sm:w-6 sm:h-6 md:w-7 md:h-7" />
            </div>
            <div className="min-w-0">
              <h1 className="text-lg sm:text-xl md:text-2xl lg:text-3xl font-bold tracking-wide leading-tight">DASHBOARD CAFÉ</h1>
              <p className="text-xs sm:text-sm text-gray-300 truncate">IIBC S.A. — Facturación Odoo</p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 w-full lg:w-auto lg:items-center">
            <BotonActualizarSincronizacion />

            <div className="flex gap-2 sm:gap-3 w-full sm:w-auto">
              <select
                className="bg-[#046C5E] text-white px-3 sm:px-4 py-2 rounded-lg flex-1 sm:flex-initial sm:min-w-[130px] text-sm"
                value={mesSeleccionado}
                onChange={(e) => setMesSeleccionado(e.target.value)}
              >
                {Object.entries(meses).map(([nombre, valor]) => (
                  <option key={valor} value={valor}>{nombre}</option>
                ))}
              </select>
              <select
                className="bg-[#046C5E] text-white px-3 sm:px-4 py-2 rounded-lg flex-1 sm:flex-initial sm:min-w-[100px] text-sm"
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
