import React, { useState, useEffect } from "react";
import logo from "../../assets/imagen-hielo.png";
import DashboardLayout from "../../layout/DashboardLayout";
import ResumenVentasHielo from "../../components/ComponentHielo/ResumenVentasHielo";
import KpisHielo from "../../components/ComponentHielo/KpisHielo";
import BotonActualizarSincronizacion from "../../components/elements/BotonActualizarSincronizacion";
import { Header } from "../../components/common/Header";
// import { API_URL } from "../../config/api";


/* ============================
   MESES
============================ */
const meses = {
  Enero: "01",
  Febrero: "02",
  Marzo: "03",
  Abril: "04",
  Mayo: "05",
  Junio: "06",
  Julio: "07",
  Agosto: "08",
  Septiembre: "09",
  Octubre: "10",
  Noviembre: "11",
  Diciembre: "12",
};

const DashboardHielo: React.FC = () => {
  const [mesSeleccionado, setMesSeleccionado] = useState(meses.Enero);
  const [anioSeleccionado, setAnioSeleccionado] = useState("2026");

  const [resumenUsuariosVentasHielo, setResumenUsuariosVentasHielo] =
    useState<any[]>([]);

  const totalProyeccion = resumenUsuariosVentasHielo.reduce(
    (acc, r) => acc + Number(r.proyeccion || 0),
    0
  );


  const [kpisHielo, setKpisHielo] = useState<any | null>(null);
  const [comparativaMesAnterior, setComparativaMesAnterior] =
    useState<any | null>(null);

  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  /* ============================
     FETCH DATA
  ============================ */
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch(
          `http://localhost:5000/api/hielo/dashboard?anio=${anioSeleccionado}&mes=${mesSeleccionado}`
          // `${API_URL}/api/hielo/dashboard?anio=${anioSeleccionado}&mes=${mesSeleccionado}`


        );

        if (!response.ok) {
          throw new Error("Error al obtener los datos");
        }

        const data = await response.json();
        console.log("📊 Fetch Response Hielo:", data);

        /* ============================
           TABLA RESUMEN
        ============================ */
        setResumenUsuariosVentasHielo(
          data?.resumenUsuariosVentasHielo ?? []
        );

        /* ============================
           KPIs + COMPARATIVA
        ============================ */
        const resumenActual =
          data?.kpisGenerales?.resumenActual;

        if (resumenActual?.kpisGenerales) {
          const k = resumenActual.kpisGenerales;

          setKpisHielo({
            unidadesTotales: k.unidadesTotales,
            montoTotal: k.montoTotal,

            metaMensualUnidades: k.metaMensualUnidades,
            metaMensualDolares: k.metaMensualDolares,

            cumplimientoUnidadesMensual: k.cumplimientoUnidadesMensual,
            cumplimientoUSDMensual: k.cumplimientoUSDMensual,
          });

          setComparativaMesAnterior(
            resumenActual.comparativaMesAnterior ?? null
          );
        } else {
          setKpisHielo(null);
          setComparativaMesAnterior(null);
        }
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

  return (
    <DashboardLayout>
      <div className="main-content min-h-screen text-white px-10 py-6">
        <Header />
        {
        /* ============================
           HEADER
        ============================ */}
        <header className="flex flex-col sm:flex-row justify-between items-center mb-10 border-b border-[#046C5E] pb-4 py-6">
          <div className="flex items-center gap-4">
            <img src={logo}
              className="h-14 w-auto transition-all duration-300"
              alt="Logo" />
            <div>
              <h1 className="text-3xl font-bold tracking-wide">
                DASHBOARD HIELO
              </h1>
              <p className="text-sm text-gray-300">
                Facturación por grupo comercial
              </p>
            </div>
          </div>

          {/* Botón de actualización de sincronización - Centrado en dispositivos móviles */}
          <div className="flex justify-center w-full sm:w-auto mt-4 sm:mt-0">
            <BotonActualizarSincronizacion />
          </div>

          <div className="flex items-center gap-3">
            <select
              className="bg-[#046C5E] text-white px-4 py-2 rounded-lg"
              value={mesSeleccionado}
              onChange={(e) => setMesSeleccionado(e.target.value)}
            >
              {Object.entries(meses).map(([nombre, valor]) => (
                <option key={valor} value={valor}>
                  {nombre}
                </option>
              ))}
            </select>

            <select
              className="bg-[#046C5E] text-white px-4 py-2 rounded-lg"
              value={anioSeleccionado}
              onChange={(e) => setAnioSeleccionado(e.target.value)}
            >
              {Array.from({ length: 5 }, (_, i) => 2026 - i).map((anio) => (
                <option key={anio} value={anio}>
                  {anio}
                </option>
              ))}
            </select>
          </div>
        </header>





        {/* ============================
           ESTADOS
        ============================ */}
        {loading && (
          <p className="text-gray-300 text-center">Cargando datos…</p>
        )}

        {error && (
          <p className="text-red-400 text-center">
            Error: {error}
          </p>
        )}

        {/* ============================
           KPIs
        ============================ */}
        {!loading && !error && kpisHielo && (
          <KpisHielo
            kpis={kpisHielo}
            comparativa={comparativaMesAnterior}
            totalProyeccion={totalProyeccion}
          />

        )}

        {/* ============================
           TABLA RESUMEN
        ============================ */}
        {!loading && !error && (
          <ResumenVentasHielo
            data={resumenUsuariosVentasHielo}
            anio={anioSeleccionado}
            mes={mesSeleccionado}
          />
        )}
      </div>
    </DashboardLayout>
  );
};

export default DashboardHielo;
