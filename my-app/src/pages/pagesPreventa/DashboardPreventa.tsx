import React, { useState, useEffect } from "react";
import logo from "../../assets/logo.png";

import RankingPreventas from "../../components/ComponentPreventa/RankingPreventas";
import TopClientes from "../../components/ComponentPreventa/TopClientes";
import RankingRutasR from "../../components/ComponentPreventa/RankingRutasR";

import DashboardLayout from "../../layout/DashboardLayout";
import GraficoVentaPorProducto from "../../components/ComponentPreventa/GraficoVentaPorProducto";

const meses: Record<string, number> = {
  Enero: 1,
  Febrero: 2,
  Marzo: 3,
  Abril: 4,
  Mayo: 5,
  Junio: 6,
  Julio: 7,
  Agosto: 8,
  Septiembre: 9,
  Octubre: 10,
  Noviembre: 11,
  Diciembre: 12,
};

export default function DashboardPreventa() {

  // ============================
  // 🔥 PRIMERA CARGA DEL MES / AÑO (localStorage o actuales)
  // ============================
  const hoy = new Date();
  const mesActual = hoy.getMonth() + 1;
  const anioActual = hoy.getFullYear();

  const mesGuardado = localStorage.getItem("mesSeleccionado");
  const anioGuardado = localStorage.getItem("anioSeleccionado");

  const [mesSeleccionado, setMesSeleccionado] = useState<string>(
    mesGuardado ?? mesActual.toString()
  );

  const [anioSeleccionado, setAnioSeleccionado] = useState<string>(
    anioGuardado ?? anioActual.toString()
  );

  const [datos, setDatos] = useState<any>(null);
  const [cargando, setCargando] = useState(false);

  const [topClientesState, setTopClientesState] = useState<any[]>([]);

  // ============================
  // 🔥 Fetch de datos backend
  // ============================
  const obtenerDatos = async (anio: number, mes: number) => {
    try {
      setCargando(true);
      const res = await fetch(
        `http://localhost:5000/api/ventas/dashboard?anio=${anio}&mes=${mes}`
      );
      const data = await res.json();

      console.log("🔥 Datos recibidos:", data);

      setDatos(data);
      setTopClientesState(data.topClientes || []);
    } catch (error) {
      console.error("❌ Error obteniendo datos:", error);
    } finally {
      setCargando(false);
    }
  };

  // ============================
  // 🔄 Cargar datos cuando mes o año cambien
  // ============================
  useEffect(() => {
    if (mesSeleccionado && anioSeleccionado) {
      obtenerDatos(parseInt(anioSeleccionado), parseInt(mesSeleccionado));
    }
  }, [mesSeleccionado, anioSeleccionado]);

  const kpis = datos?.kpisGenerales;
  const comp = datos?.comparativaMesAnterior;

  return (
    <DashboardLayout>
      <div className="main-content min-h-screen text-white font-sans px-10 py-6 bg-gradient-to-b from-[#012E24] to-[#014434]">

        {/* ========= HEADER SUPERIOR ========= */}
        <header className="flex justify-between items-center mb-10 border-b border-[#046C5E] pb-4">
          <div className="flex items-center gap-4">
            <img src={logo} alt="Logo" className="h-12 rounded-md" />
            <div>
              <h1 className="text-3xl font-bold tracking-wide">
                Dashboard de Preventas
              </h1>
              <p className="text-sm text-gray-300">
                Órdenes, clientes, productos y comparativas por mes
              </p>
            </div>
          </div>

          {/* ========= SELECTORES ========= */}
          <div className="flex items-center gap-3">

            {/* SELECT MES */}
            <select
              className="bg-[#046C5E] text-white px-4 py-2 rounded-lg shadow-sm hover:bg-[#058A73]"
              value={mesSeleccionado}
              onChange={(e) => {
                setMesSeleccionado(e.target.value);
                localStorage.setItem("mesSeleccionado", e.target.value);
              }}
            >
              {Object.entries(meses).map(([nombre, numero]) => (
                <option key={nombre} value={numero}>
                  {nombre}
                </option>
              ))}
            </select>

            {/* SELECT AÑO */}
            <select
              className="bg-[#046C5E] text-white px-4 py-2 rounded-lg shadow-sm hover:bg-[#058A73]"
              value={anioSeleccionado}
              onChange={(e) => {
                setAnioSeleccionado(e.target.value);
                localStorage.setItem("anioSeleccionado", e.target.value);
              }}
            >
              {Array.from({ length: 5 }, (_, i) => {
                const year = new Date().getFullYear() - i;
                return (
                  <option key={year} value={year}>
                    {year}
                  </option>
                );
              })}
            </select>
          </div>
        </header>

        {/* ========= ESTADOS ========= */}
        {cargando && (
          <p className="text-center text-gray-300 animate-pulse mb-6">
            Cargando datos desde el servidor...
          </p>
        )}

        {!cargando && !datos && (
          <p className="text-center text-gray-400">Cargando periodo seleccionado...</p>
        )}

        {/* ========= CONTENIDO PRINCIPAL ========= */}
        {datos && !cargando && kpis && (
          <>
            {/* TARJETAS PRINCIPALES */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">

              {/* CARD 1 - UNIDADES */}
              <div className="p-6 bg-[#01382D] rounded-xl shadow-lg">
                <h2 className="text-xl font-semibold mb-1">Unidades Vendidas</h2>
                <p className="text-5xl font-bold">{kpis.unidadesTotales.toLocaleString()}</p>
                <p className="text-gray-300 text-sm mb-4">
                  Periodo Ant{" "}
                  <span className={kpis.periodoAntUnidadesPorc >= 0 ? "text-green-400" : "text-red-400"}>
                    {kpis.periodoAntUnidadesPorc >= 0 ? "+" : ""}
                    {kpis.periodoAntUnidadesPorc?.toFixed(1)}%
                  </span>
                </p>

                {/* TARGET MENSUAL */}
                <p className="text-xs font-semibold text-gray-300 mb-1">
                  TARGET MENSUAL
                  <span className="float-right">{kpis.cumplimientoUnidadesMensual.toFixed(1)}%</span>
                </p>
                <div className="w-full h-3 bg-[#02483A] rounded-full mb-4">
                  <div
                    className="h-full bg-[#04C29B] rounded-full transition-all duration-700"
                    style={{ width: `${kpis.cumplimientoUnidadesMensual}%` }}
                  ></div>
                </div>

                {/* TARGET ANUAL */}
                <p className="text-xs font-semibold text-gray-300 mb-1">
                  TARGET ANUAL
                  <span className="float-right">{kpis.cumplimientoUnidadesAnual.toFixed(1)}%</span>
                </p>
                <div className="w-full h-3 bg-[#02483A] rounded-full">
                  <div
                    className="h-full bg-[#04C29B] rounded-full transition-all duration-700"
                    style={{ width: `${kpis.cumplimientoUnidadesAnual}%` }}
                  ></div>
                </div>
              </div>

              {/* CARD 2 - USD */}
              <div className="p-6 bg-[#01382D] rounded-xl shadow-lg">
                <h2 className="text-xl font-semibold mb-1">Ventas en USD</h2>
                <p className="text-5xl font-bold">
                  ${kpis.montoTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </p>

                <p className="text-gray-300 text-sm mb-4">
                  Periodo Ant{" "}
                  <span className={kpis.periodoAntMontoPorc >= 0 ? "text-green-400" : "text-red-400"}>
                    {kpis.periodoAntMontoPorc >= 0 ? "+" : ""}
                    {kpis.periodoAntMontoPorc?.toFixed(1)}%
                  </span>
                </p>

                {/* TARGET MENSUAL */}
                <p className="text-xs font-semibold text-gray-300 mb-1">
                  TARGET MENSUAL
                  <span className="float-right">{kpis.cumplimientoUSDMensual.toFixed(1)}%</span>
                </p>
                <div className="w-full h-3 bg-[#02483A] rounded-full mb-4">
                  <div
                    className="h-full bg-[#04C29B] rounded-full transition-all duration-700"
                    style={{ width: `${kpis.cumplimientoUSDMensual}%` }}
                  ></div>
                </div>

                {/* TARGET ANUAL */}
                <p className="text-xs font-semibold text-gray-300 mb-1">
                  TARGET ANUAL
                  <span className="float-right">{kpis.cumplimientoUSDAnual.toFixed(1)}%</span>
                </p>
                <div className="w-full h-3 bg-[#02483A] rounded-full">
                  <div
                    className="h-full bg-[#04C29B] rounded-full transition-all duration-700"
                    style={{ width: `${kpis.cumplimientoUSDAnual}%` }}
                  ></div>
                </div>
              </div>

              {/* CARD 3 - COMPARATIVA */}
              <div className="p-6 bg-[#01382D] rounded-xl shadow-lg">
                <h2 className="text-lg text-gray-200 font-semibold">Comparativa Mes Anterior</h2>

                <div className="text-gray-300 text-sm mt-3 leading-relaxed">

                  {/* UNIDADES */}
                  <p className="font-semibold text-gray-100 mb-1">Unidades:</p>
                  <p>Mes anterior: {comp.unidades.anterior.toLocaleString()}</p>
                  <p>Mes actual: {comp.unidades.actual.toLocaleString()}</p>
                  <p>
                    Variación:{" "}
                    <span
                      className={
                        comp.unidades.variacionAbs >= 0
                          ? "text-green-400 font-semibold"
                          : "text-red-400 font-semibold"
                      }
                    >
                      {comp.unidades.variacionAbs.toLocaleString()} (
                      {comp.unidades.variacionPorcentaje?.toFixed(2)}%)
                    </span>
                  </p>

                  {/* Monto */}
                  <p className="font-semibold text-gray-100 mt-4 mb-1">Monto USD:</p>
                  <p>
                    Mes anterior: $
                    {comp.monto.anterior.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </p>
                  <p>
                    Mes actual: $
                    {comp.monto.actual.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </p>
                  <p>
                    Variación:{" "}
                    <span
                      className={
                        comp.monto.variacionAbs >= 0
                          ? "text-green-400 font-semibold"
                          : "text-red-400 font-semibold"
                      }
                    >
                      +$
                      {comp.monto.variacionAbs.toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                      })}{" "}
                      ({comp.monto.variacionPorcentaje?.toFixed(2)}%)
                    </span>
                  </p>
                </div>
              </div>
            </div>

            {/* DOS TABLAS: RANKING PREVENTA Y R DESCARTABLE */}
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
              <div className="h-full flex flex-col">
                <RankingPreventas
                  datos={datos}
                  anio={anioSeleccionado}
                  mes={mesSeleccionado}
                />
              </div>

              <div className="grid grid-cols-1 gap-6">
                {/* Ranking Rutas R */}
                <div className="h-full flex flex-col">
                  <RankingRutasR
                    data={datos.rankingRutasR}
                    anio={anioSeleccionado}
                    mes={mesSeleccionado}
                  />
                </div>

                {/* GRAFICO VENTA POR PRODUCTO */}
                <div className="h-full flex flex-col">
                  <GraficoVentaPorProducto data={datos.ventaPorProducto} />
                </div>
              </div>


            </div>



            <br />
            <br></br>
            <TopClientes topClientes={topClientesState} />
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
