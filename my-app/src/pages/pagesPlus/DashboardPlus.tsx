import React, { useState, useEffect, useMemo } from "react";
import { Calendar } from "lucide-react";
import logo from "../../assets/icono-plus.png";
import DashboardLayout from "../../layout/DashboardLayout";
import KpisPlus from "../../components/ComponentPlus/KpisPlus";
import TablaPlusOdoo from "../../components/ComponentPlus/TablaPlusOdoo";
import BotonActualizarSincronizacion from "../../components/elements/BotonActualizarSincronizacion";
import { Header } from "../../components/common/Header";
import { useAuth } from "../../components/auth/AuthContext";
import { API_BASE_URL } from '../../config';

const meses = {
  Enero: "01", Febrero: "02", Marzo: "03", Abril: "04",
  Mayo: "05", Junio: "06", Julio: "07", Agosto: "08",
  Septiembre: "09", Octubre: "10", Noviembre: "11", Diciembre: "12",
};

const DashboardPlus: React.FC = () => {
  const { user } = useAuth();
  const isAdmin = (user?.role ?? "").toUpperCase() === "ADMIN";

  const hoy        = new Date();
  const mesActual  = String(hoy.getMonth() + 1).padStart(2, "0");
  const anioActual = String(hoy.getFullYear());

  const [mesSeleccionado,  setMesSeleccionado]  = useState(
    localStorage.getItem("mesSeleccionadoPlus") ?? mesActual
  );
  const [anioSeleccionado, setAnioSeleccionado] = useState(
    localStorage.getItem("anioSeleccionadoPlus") ?? anioActual
  );

  const [kpisPlus,              setKpisPlus]              = useState<any | null>(null);
  const [comparativaMesAnterior, setComparativaMesAnterior] = useState<any | null>(null);
  const [tendencia6Meses,       setTendencia6Meses]       = useState<any[]>([]);
  const [loading, setLoading]   = useState<boolean>(true);
  const [error,   setError]     = useState<string | null>(null);
  const [proyeccionDolares,         setProyeccionDolares]         = useState<number>(0);
  const [proyeccionUnidades,        setProyeccionUnidades]        = useState<number>(0);
  const [realDolares,               setRealDolares]               = useState<number>(0);
  const [realUnidades,              setRealUnidades]              = useState<number>(0);
  const [mesAnteriorCombinado,      setMesAnteriorCombinado]      = useState<number>(0);
  const [mesAnteriorCombinadoUnid,  setMesAnteriorCombinadoUnid]  = useState<number>(0);

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
          `${API_BASE_URL}/api/plus/dashboard?anio=${anioSeleccionado}&mes=${mesSeleccionado}`,
          { headers: token ? { Authorization: `Bearer ${token}` } : {} }
        );
        if (!response.ok) throw new Error("Error al obtener los datos");
        const data = await response.json();

        const resumenActual = data?.kpisGenerales?.resumenActual;
        if (resumenActual?.kpisGenerales) {
          const k = resumenActual.kpisGenerales;
          setKpisPlus({
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
          setKpisPlus(null);
          setComparativaMesAnterior(null);
        }
        setTendencia6Meses(data?.tendencia6Meses ?? []);
      } catch (err: any) {
        console.error("Error fetch Plus:", err);
        setError(err.message || "Error desconocido");
        setKpisPlus(null);
        setComparativaMesAnterior(null);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [mesSeleccionado, anioSeleccionado]);

  useEffect(() => {
    localStorage.setItem("mesSeleccionadoPlus",  mesSeleccionado);
    localStorage.setItem("anioSeleccionadoPlus", anioSeleccionado);
  }, [mesSeleccionado, anioSeleccionado]);

  const tendenciaFinal = useMemo(() => {
    if (!tendencia6Meses.length || !kpisPlus) return tendencia6Meses;
    const montoRealFinal    = realDolares  || kpisPlus.montoTotal;
    const unidadesRealFinal = realUnidades || kpisPlus.unidadesTotales;
    return tendencia6Meses.map((d: any) =>
      d.mes === Number(mesSeleccionado) && d.anio === Number(anioSeleccionado)
        ? { ...d, dolares: montoRealFinal, proyeccion: proyeccionDolares, unidades: unidadesRealFinal }
        : d
    );
  }, [tendencia6Meses, kpisPlus, realDolares, realUnidades, proyeccionDolares, mesSeleccionado, anioSeleccionado]);

  const comparativaCorregida = useMemo(() => {
    if (!comparativaMesAnterior || !kpisPlus) return comparativaMesAnterior;

    const proyDolares  = proyeccionDolares  || kpisPlus.proyeccionMonto  || (realDolares  || kpisPlus.montoTotal);
    const proyUnidades = proyeccionUnidades || kpisPlus.proyeccionUnidades || (realUnidades || kpisPlus.unidadesTotales);

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
        actual:        realDolares  || kpisPlus.montoTotal,
        proyeccion:    proyDolares,
        variacionAbs:  varAbsDolares,
        variacionPorc: varPorcDolares,
      },
      unidades: {
        ...comparativaMesAnterior.unidades,
        anterior:      anteriorUnidades,
        actual:        realUnidades || kpisPlus.unidadesTotales,
        proyeccion:    proyUnidades,
        variacionAbs:  varAbsUnidades,
        variacionPorc: varPorcUnidades,
      },
    };
  }, [comparativaMesAnterior, kpisPlus, realDolares, realUnidades, proyeccionDolares, proyeccionUnidades, mesAnteriorCombinado, mesAnteriorCombinadoUnid]);

  return (
    <DashboardLayout>
      <div className="main-content min-h-screen text-white px-4 md:px-10 py-4 md:py-6">
        <Header />

        <header className="flex flex-col gap-4 md:flex-row md:justify-between md:items-center mb-6 md:mb-10 border-b border-[#046C5E] pb-4 py-4 md:py-6">
          <div className="flex items-center gap-4">
            <img src={logo} className="h-14 w-auto transition-all duration-300" alt="Logo" />
            <div>
              <h1 className="text-xl md:text-3xl font-bold tracking-wide flex items-center gap-2">
                DASHBOARD PLUS
              </h1>
              <p className="text-sm text-gray-300">Facturación por grupo comercial</p>
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

        {loading && (
          <div className="flex flex-col justify-center items-center py-32 gap-4">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-emerald-400" />
            <p className="text-gray-400 text-sm">Cargando datos…</p>
          </div>
        )}
        {error && (
          <p className="text-red-400 text-center">Error: {error}</p>
        )}

        {!loading && !error && kpisPlus && (
          <KpisPlus
            kpis={{
              ...kpisPlus,
              montoTotal:      realDolares  || kpisPlus.montoTotal,
              unidadesTotales: realUnidades || kpisPlus.unidadesTotales,
            }}
            comparativa={comparativaCorregida}
            totalProyeccion={proyeccionDolares || kpisPlus.proyeccionMonto || 0}
            totalProyeccionUnidades={proyeccionUnidades || kpisPlus.proyeccionUnidades || 0}
            esMesActual={mesSeleccionado === mesActual && anioSeleccionado === anioActual}
            tendencia6Meses={tendenciaFinal}
            anioFiltro={Number(anioSeleccionado)}
            mesFiltro={Number(mesSeleccionado)}
          />
        )}

        <TablaPlusOdoo
          anio={anioSeleccionado}
          mes={mesSeleccionado}
          onTotalesLoaded={(t) => {
            setProyeccionDolares(t.monto);
            setProyeccionUnidades(t.proyeccionUnidades);
            setRealDolares(t.montoReal);
            setRealUnidades(t.unidades);
            setMesAnteriorCombinado(t.mesAnterior);
            setMesAnteriorCombinadoUnid(t.mesAnteriorUnidades);
          }}
        />

      </div>
    </DashboardLayout>
  );
};

export default DashboardPlus;
