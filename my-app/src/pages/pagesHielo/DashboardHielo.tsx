import React, { useState, useEffect, useMemo } from "react";
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
  const [loadingOdoo, setLoadingOdoo] = useState<boolean>(false);
  const [error,   setError]     = useState<string | null>(null);
  const [proyeccionDolares,         setProyeccionDolares]         = useState<number>(0);
  const [proyeccionUnidades,        setProyeccionUnidades]        = useState<number>(0);
  const [realDolares,               setRealDolares]               = useState<number>(0);
  const [realUnidades,              setRealUnidades]              = useState<number>(0);
  const [mesAnteriorCombinado,      setMesAnteriorCombinado]      = useState<number>(0);
  const [mesAnteriorCombinadoUnid,  setMesAnteriorCombinadoUnid]  = useState<number>(0);

  /* ============================
     FETCH DATA
  ============================ */
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError(null);
      setProyeccionDolares(0);
      setProyeccionUnidades(0);
      setRealDolares(0);
      setRealUnidades(0);
      setMesAnteriorCombinado(0);
      setMesAnteriorCombinadoUnid(0);
      setTendencia6Meses([]);
      try {
        const token = localStorage.getItem('app_token');
        const response = await fetch(
          `${API_BASE_URL}/api/hielo/dashboard?anio=${anioSeleccionado}&mes=${mesSeleccionado}`,
          { headers: token ? { Authorization: `Bearer ${token}` } : {} }
        );
        if (!response.ok) throw new Error("Error al obtener los datos");
        const data = await response.json();
        console.log(" Fetch Response Hielo:", data);

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
            proyeccionMonto            : k.proyeccionMonto,
            proyeccionUnidades         : k.proyeccionUnidades,
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

  const tendenciaFinal = useMemo(() => {
    if (!tendencia6Meses.length || !kpisHielo) return tendencia6Meses;
    const montoRealFinal    = realDolares  || kpisHielo.montoTotal;
    const unidadesRealFinal = realUnidades || kpisHielo.unidadesTotales;
    return tendencia6Meses.map((d: any) =>
      d.mes === Number(mesSeleccionado) && d.anio === Number(anioSeleccionado)
        ? { ...d, dolares: montoRealFinal, proyeccion: proyeccionDolares, unidades: unidadesRealFinal }
        : d
    );
  }, [tendencia6Meses, kpisHielo, realDolares, realUnidades, proyeccionDolares, mesSeleccionado, anioSeleccionado]);

  const comparativaCorregida = useMemo(() => {
    if (!comparativaMesAnterior || !kpisHielo) return comparativaMesAnterior;

    // Proyección: Odoo si disponible, si no el cálculo del backend KPI
    const proyDolares  = proyeccionDolares  || kpisHielo.proyeccionMonto  || (realDolares  || kpisHielo.montoTotal);
    const proyUnidades = proyeccionUnidades || kpisHielo.proyeccionUnidades || (realUnidades || kpisHielo.unidadesTotales);

    // Mes anterior: usar el combinado (MV + Odoo) cuando la tabla Odoo ya cargó,
    // de lo contrario usar el valor del backend KPI (solo MV)
    const anteriorDolares  = mesAnteriorCombinado  > 0 ? mesAnteriorCombinado  : Number(comparativaMesAnterior.monto?.anterior    ?? 0);
    const anteriorUnidades = mesAnteriorCombinadoUnid > 0 ? mesAnteriorCombinadoUnid : Number(comparativaMesAnterior.unidades?.anterior ?? 0);

    const varAbsDolares   = proyDolares  - anteriorDolares;
    const varPorcDolares  = anteriorDolares  !== 0 ? (varAbsDolares  / anteriorDolares)  * 100 : 0;

    const varAbsUnidades  = proyUnidades - anteriorUnidades;
    const varPorcUnidades = anteriorUnidades !== 0 ? (varAbsUnidades / anteriorUnidades) * 100 : 0;

    return {
      ...comparativaMesAnterior,
      monto: {
        ...comparativaMesAnterior.monto,
        anterior:      anteriorDolares,
        actual:        realDolares  || kpisHielo.montoTotal,
        proyeccion:    proyDolares,
        variacionAbs:  varAbsDolares,
        variacionPorc: varPorcDolares,
      },
      unidades: {
        ...comparativaMesAnterior.unidades,
        anterior:      anteriorUnidades,
        actual:        realUnidades || kpisHielo.unidadesTotales,
        proyeccion:    proyUnidades,
        variacionAbs:  varAbsUnidades,
        variacionPorc: varPorcUnidades,
      },
    };
  }, [comparativaMesAnterior, kpisHielo, realDolares, realUnidades, proyeccionDolares, proyeccionUnidades, mesAnteriorCombinado, mesAnteriorCombinadoUnid]);

  return (
    <DashboardLayout>
      <div className="main-content min-h-screen text-white px-2 sm:px-4 md:px-10 py-3 md:py-6">
        <Header />

        {/* ============================
            HEADER
        ============================ */}
        <header className="flex flex-col gap-3 sm:gap-4 lg:flex-row lg:justify-between lg:items-center mb-5 sm:mb-6 md:mb-10 border-b border-[#046C5E] pb-4 pt-4 md:pt-6">
          <div className="flex items-center gap-3 sm:gap-4 min-w-0">
            <img src={logo} className="h-10 sm:h-12 md:h-14 w-auto flex-shrink-0 transition-all duration-300" alt="Logo" />
            <div className="min-w-0">
              <h1 className="text-lg sm:text-xl md:text-2xl lg:text-3xl font-bold tracking-wide leading-tight">DASHBOARD HIELO</h1>
              <p className="text-xs sm:text-sm text-gray-300 truncate">Facturación por grupo comercial</p>
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

        {/* ============================
            ESTADOS
        ============================ */}
        {(loading || loadingOdoo) && (
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
        {!loading && !loadingOdoo && !error && kpisHielo && (
          <KpisHielo
            kpis={{
              ...kpisHielo,
              montoTotal:      realDolares  || kpisHielo.montoTotal,
              unidadesTotales: realUnidades || kpisHielo.unidadesTotales,
            }}
            comparativa={comparativaCorregida}
            totalProyeccion={proyeccionDolares || kpisHielo.proyeccionMonto || 0}
            totalProyeccionUnidades={proyeccionUnidades || kpisHielo.proyeccionUnidades || 0}
            esMesActual={mesSeleccionado === mesActual && anioSeleccionado === anioActual}
            tendencia6Meses={tendenciaFinal}
            anioFiltro={Number(anioSeleccionado)}
            mesFiltro={Number(mesSeleccionado)}
          />
        )}



        {/* ============================
            TABLA HIELO ODOO — solo ADMIN
        ============================ */}
        {isAdmin && (
          <TablaHieloOdoo
            anio={anioSeleccionado}
            mes={mesSeleccionado}
            onLoadingChange={setLoadingOdoo}
            onTotalesLoaded={(t) => {
              setProyeccionDolares(t.monto);
              setProyeccionUnidades(t.proyeccionUnidades);
              setRealDolares(t.montoReal);
              setRealUnidades(t.unidades);
              setMesAnteriorCombinado(t.mesAnterior);
              setMesAnteriorCombinadoUnid(t.mesAnteriorUnidades);
            }}
          />
        )}




      </div>
    </DashboardLayout>
  );
};

export default DashboardHielo;