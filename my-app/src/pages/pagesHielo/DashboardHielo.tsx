import React, { useState, useEffect } from "react";
import logo from "../../assets/imagen-hielo.png";
import DashboardLayout from "../../layout/DashboardLayout";
import KpisHielo from "../../components/ComponentHielo/KpisHielo";
import TablaHieloOdoo from "../../components/ComponentHielo/TablaHieloOdoo";
import BotonActualizarSincronizacion from "../../components/elements/BotonActualizarSincronizacion";
import { Header } from "../../components/common/Header";
import { useAuth } from "../../components/auth/AuthContext";
import { API_BASE_URL } from '../../config';

/* ============================
   MESES
============================ */
const meses = {
  Enero: "01", Febrero: "02", Marzo: "03", Abril: "04",
  Mayo: "05", Junio: "06", Julio: "07", Agosto: "08",
  Septiembre: "09", Octubre: "10", Noviembre: "11", Diciembre: "12",
};

const DashboardHielo: React.FC = () => {
  const { user } = useAuth();
  const isAdmin  = (user?.role ?? "").toUpperCase() === "ADMIN";

  const hoy        = new Date();
  const mesActual  = String(hoy.getMonth() + 1).padStart(2, "0");
  const anioActual = String(hoy.getFullYear());

  const [mesSeleccionado,  setMesSeleccionado]  = useState(
    localStorage.getItem("mesSeleccionadoHielo") ?? mesActual
  );
  const [anioSeleccionado, setAnioSeleccionado] = useState(
    localStorage.getItem("anioSeleccionadoHielo") ?? anioActual
  );

  const [kpisHielo,             setKpisHielo]             = useState<any | null>(null);
  const [comparativaMesAnterior, setComparativaMesAnterior] = useState<any | null>(null);
  const [tendencia6Meses,       setTendencia6Meses]       = useState<any[]>([]);
  const [loading, setLoading]   = useState<boolean>(true);
  const [error,   setError]     = useState<string | null>(null);
  const [proyeccionDolares,   setProyeccionDolares]   = useState<number>(0);
  const [proyeccionUnidades,  setProyeccionUnidades]  = useState<number>(0);

  /* ============================
     FETCH DATA
  ============================ */
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError(null);
      setProyeccionDolares(0);
      setProyeccionUnidades(0);
      setTendencia6Meses([]);
      try {
        const response = await fetch(
          `${API_BASE_URL}/api/hielo/dashboard?anio=${anioSeleccionado}&mes=${mesSeleccionado}`
        );
        if (!response.ok) throw new Error("Error al obtener los datos");
        const data = await response.json();
        console.log("📊 Fetch Response Hielo:", data);

        const resumenActual = data?.kpisGenerales?.resumenActual;
        if (resumenActual?.kpisGenerales) {
          const k = resumenActual.kpisGenerales;
          setKpisHielo({
            unidadesTotales            : k.unidadesTotales,
            montoTotal                 : k.montoTotal,
            metaMensualUnidades        : k.metaMensualUnidades,
            metaMensualDolares         : k.metaMensualDolares,
            cumplimientoUnidadesMensual: k.cumplimientoUnidadesMensual,
            cumplimientoUSDMensual     : k.cumplimientoUSDMensual,
          });
          setComparativaMesAnterior(resumenActual.comparativaMesAnterior ?? null);
        } else {
          setKpisHielo(null);
          setComparativaMesAnterior(null);
        }
        setTendencia6Meses(data?.tendencia6Meses ?? []);
      } catch (err: any) {
        console.error("❌ Error fetch Hielo:", err);
        setError(err.message || "Error desconocido");
        setKpisHielo(null);
        setComparativaMesAnterior(null);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [mesSeleccionado, anioSeleccionado]);

  useEffect(() => {
    localStorage.setItem("mesSeleccionadoHielo",  mesSeleccionado);
    localStorage.setItem("anioSeleccionadoHielo", anioSeleccionado);
  }, [mesSeleccionado, anioSeleccionado]);

  return (
    <DashboardLayout>
      <div className="main-content min-h-screen text-white px-4 md:px-10 py-4 md:py-6">
        <Header />

        {/* ============================
            HEADER
        ============================ */}
        <header className="flex flex-col gap-4 md:flex-row md:justify-between md:items-center mb-6 md:mb-10 border-b border-[#046C5E] pb-4 py-4 md:py-6">
          <div className="flex items-center gap-4">
            <img src={logo} className="h-14 w-auto transition-all duration-300" alt="Logo" />
            <div>
              <h1 className="text-xl md:text-3xl font-bold tracking-wide">DASHBOARD HIELO</h1>
              <p className="text-sm text-gray-300">Facturación por grupo comercial</p>
            </div>
          </div>

          <div className="flex justify-center w-full md:w-auto">
            <BotonActualizarSincronizacion />
          </div>

          <div className="flex items-center gap-3 w-full md:w-auto flex-wrap">
            <select
              className="bg-[#046C5E] text-white px-4 py-2 rounded-lg flex-1 min-w-[120px]"
              value={mesSeleccionado}
              onChange={(e) => setMesSeleccionado(e.target.value)}
            >
              {Object.entries(meses).map(([nombre, valor]) => (
                <option key={valor} value={valor}>{nombre}</option>
              ))}
            </select>
            <select
              className="bg-[#046C5E] text-white px-4 py-2 rounded-lg flex-1 min-w-[120px]"
              value={anioSeleccionado}
              onChange={(e) => setAnioSeleccionado(e.target.value)}
            >
              {Array.from({ length: 5 }, (_, i) => 2026 - i).map((anio) => (
                <option key={anio} value={anio}>{anio}</option>
              ))}
            </select>
          </div>
        </header>

        {/* ============================
            ESTADOS
        ============================ */}
        {loading && (
          <div className="flex flex-col justify-center items-center py-32 gap-4">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-emerald-400" />
          <p className="text-gray-400 text-sm">Cargando datos…</p>
        </div>
        )}
        {error && (
          <p className="text-red-400 text-center">Error: {error}</p>
        )}

        {/* ============================
            KPIs
        ============================ */}
        {!loading && !error && kpisHielo && (
          <KpisHielo
            kpis={kpisHielo}
            comparativa={comparativaMesAnterior}
            totalProyeccion={proyeccionDolares}
            totalProyeccionUnidades={proyeccionUnidades}
            esMesActual={mesSeleccionado === mesActual && anioSeleccionado === anioActual}
            tendencia6Meses={tendencia6Meses}
          />
        )}

     

        {/* ============================
            TABLA HIELO ODOO — solo ADMIN
        ============================ */}
        {isAdmin && (
          <TablaHieloOdoo
            anio={anioSeleccionado}
            mes={mesSeleccionado}
            onTotalesLoaded={(t) => {
              setProyeccionDolares(t.monto);
              setProyeccionUnidades(t.proyeccionUnidades);
            }}
          />
        )}




      </div>
    </DashboardLayout>
  );
};

export default DashboardHielo;