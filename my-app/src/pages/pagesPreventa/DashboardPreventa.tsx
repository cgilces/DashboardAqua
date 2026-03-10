import React, { useState, useEffect } from "react";
import logo from "../../assets/logo.png";
import { useAuth } from "../../components/auth/AuthContext";
import RankingPreventas from "../../components/ComponentPreventa/RankingPreventas";
import TopClientes from "../../components/ComponentPreventa/TopClientes";
import RankingRutasR from "../../components/ComponentPreventa/RankingRutasR";
import DashboardLayout from "../../layout/DashboardLayout";
import GraficoVentaPorProducto from "../../components/ComponentPreventa/GraficoVentaPorProducto";
import CostoPromedioProductos from "../../components/ComponentPreventa/CostoPromedioProductos";
import { Header } from "../../components/common/Header";
import BotonActualizarSincronizacion from "../../components/elements/BotonActualizarSincronizacion";
import RankingDescartablePorCanal from "../../components/ComponentPreventa/RankingDescartablePorCanal";
import TablaDescartableOdoo from "../../components/ComponentPreventa/TablaDescartableOdoo";
import { API_BASE_URL } from '../../config';

const meses: Record<any, number> = {
  Enero: 1, Febrero: 2, Marzo: 3, Abril: 4,
  Mayo: 5, Junio: 6, Julio: 7, Agosto: 8,
  Septiembre: 9, Octubre: 10, Noviembre: 11, Diciembre: 12,
};

export default function DashboardPreventa() {
  const hoy = new Date();
  const mesActual = hoy.getMonth() + 1;
  const anioActual = hoy.getFullYear();

  const mesGuardado = localStorage.getItem("mesSeleccionado");
  const anioGuardado = localStorage.getItem("anioSeleccionado");

  const [mesSeleccionado, setMesSeleccionado] = useState<any>(mesGuardado ?? mesActual.toString());
  const [anioSeleccionado, setAnioSeleccionado] = useState<any>(anioGuardado ?? anioActual.toString());
  const [datos, setDatos] = useState<any>(null);
  const [cargando, setCargando] = useState(false);
  const [topClientesState, setTopClientesState] = useState<any[]>([]);

  useEffect(() => {
    if (mesSeleccionado && anioSeleccionado)
      obtenerDatos(parseInt(anioSeleccionado), parseInt(mesSeleccionado));
  }, [mesSeleccionado, anioSeleccionado]);

  useEffect(() => {
    localStorage.setItem("mesSeleccionado", mesSeleccionado);
    localStorage.setItem("anioSeleccionado", anioSeleccionado);
  }, [mesSeleccionado, anioSeleccionado]);

  const obtenerDatos = async (anio: number, mes: number) => {
    try {
      setCargando(true);
      const res = await fetch(`${API_BASE_URL}/api/ventas/dashboard?anio=${anio}&mes=${mes}`);
      const data = await res.json();
      setDatos(data);
      setTopClientesState(data.topClientes || []);
    } catch (error) {
      console.error("Error obteniendo los datos", error);
    } finally {
      setCargando(false);
    }
  };

  const kpis = datos?.kpisGenerales;
  const resumenVentasPorCanal = datos?.resumenVentasPorCanal || {};

  const { user } = useAuth();
  const rol = (user?.role ?? "").toUpperCase();
  const isAdmin = rol === "ADMIN";
  const isSupervisor = rol === "SUPERVISOR";
  const isVendedor = rol === "VENDEDOR";

  const puedeVerRanking = isAdmin || isSupervisor || isVendedor;
  const soloAdmin = isAdmin;

  const agruparCanal = (items: any[], campoMonto: "monto" | "dolares") =>
    items.reduce((acc, item) => {
      acc.unidades += Number(item.unidades || 0);
      acc.monto += Number(item.proyeccion || 0);
      if (item.vsMesAnterior) {
        acc.mesAnterior += Number(item.vsMesAnterior.monto_anterior || 0);
        acc.variacionAbs += Number(item.vsMesAnterior.variacion_abs || 0);
      }
      return acc;
    }, { unidades: 0, monto: 0, mesAnterior: 0, variacionAbs: 0 });

  const resumirDescartablePorCanal = (ventas: any) => {
    let monto = 0, unidades = 0, mesAnterior = 0;
    Object.values(ventas || {}).forEach((v: any) => {
      monto += Number(v.dolares || 0);
      unidades += Number(v.unidades || 0);
      mesAnterior += Number(v.vsMesAnterior?.monto_anterior || 0);
    });
    const variacionAbs = monto - mesAnterior;
    const variacionPorc = mesAnterior > 0 ? (variacionAbs / mesAnterior) * 100 : 0;
    return { monto, unidades, mesAnterior, variacionAbs, variacionPorc };
  };

  return (
    <DashboardLayout>
      <div className="main-content min-h-screen text-white px-10 py-6">
        <Header />

        <header className="flex flex-col sm:flex-row justify-between items-center mb-10 border-b border-[#046C5E] pb-4 py-6">
          <div className="flex items-center gap-4">
            <img src={logo} className="h-14 w-auto transition-all duration-300" alt="Logo" />
            <h1 className="text-3xl font-bold tracking-wide">DASHBOARD DESCARTABLE</h1>
          </div>

          <div className="flex justify-center w-full sm:w-auto mt-4 sm:mt-0">
            {isAdmin && <BotonActualizarSincronizacion />}
          </div>

          <div className="flex gap-3 items-center">
            <select className="bg-[#046C5E] px-4 py-2 rounded-lg" value={mesSeleccionado}
              onChange={e => setMesSeleccionado(e.target.value)}>
              {Object.entries(meses).map(([n, v]) => (
                <option key={n} value={v}>{n}</option>
              ))}
            </select>
            <select className="bg-[#046C5E] px-4 py-2 rounded-lg" value={anioSeleccionado}
              onChange={e => setAnioSeleccionado(e.target.value)}>
              {Array.from({ length: 5 }, (_, i) => {
                const y = new Date().getFullYear() - i;
                return <option key={y} value={y}>{y}</option>;
              })}
            </select>
          </div>
        </header>

        {cargando && <p className="text-center animate-pulse">Cargando datos…</p>}

        {datos && !cargando && kpis && (
          <>
            {/* ── Cards canal — solo ADMIN ── */}
            {isAdmin && resumenVentasPorCanal && (
              <div className="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-6 mb-10">
                {Object.values(resumenVentasPorCanal)
                  .filter((canal: any) => canal.monto > 0 || canal.unidades > 0)
                  .map((canal: any) => (
                    <div key={canal.canal} className="bg-[#012E24] border border-[#046C5E] rounded-xl p-4">
                      <p className="uppercase mb-1 font-bold text-base md:text-xs text-blue-300 text-center md:text-left">
                        {canal.canal}
                      </p>
                      <p className="text-2xl font-bold">
                        <span className="text-sm text-gray-400 mr-1">Proyección:</span>
                        ${canal.monto.toLocaleString("es-EC", { minimumFractionDigits: 2 })}
                      </p>
                      <p className="text-xs text-gray-300">
                        Mes anterior: ${canal.mesAnterior.toLocaleString("es-EC", { minimumFractionDigits: 2 })}
                      </p>
                      <p className={`text-xs font-semibold ${canal.variacionAbs >= 0 ? "text-green-400" : "text-red-400"}`}>
                        Variación: {canal.variacionAbs.toLocaleString("es-EC", { minimumFractionDigits: 2 })}{" "}
                        ({(canal.variacionPorc || 0).toFixed(1)}%)
                      </p>
                      <p className="text-xs text-gray-300 mt-1">
                        Unidades: {canal.unidades.toLocaleString("es-EC")}
                      </p>
                    </div>
                  ))}
              </div>
            )}


            {/* ── NUEVO: Tabla rutas Odoo descartable ── */}
            <TablaDescartableOdoo
              anio={anioSeleccionado}
              mes={mesSeleccionado}
            />

            {/* ── RankingPreventas — ADMIN + SUPERVISOR + VENDEDOR ── */}
            {puedeVerRanking && (
              <RankingPreventas
                datos={datos}
                anio={anioSeleccionado}
                mes={mesSeleccionado}
              />
            )}

            {/* ── RankingRutasR — ADMIN + SUPERVISOR + VENDEDOR ── */}
            {puedeVerRanking && (
              <RankingRutasR
                data={datos.rankingRutasR}
                anio={anioSeleccionado}
                mes={mesSeleccionado}
              />
            )}

            {/* ── Resto — solo ADMIN ── */}
            {isAdmin && (
              <>
                <RankingDescartablePorCanal
                  data={datos.ventasDescartablePorCanal}
                  anio={anioSeleccionado}
                  mes={mesSeleccionado}
                />



                <CostoPromedioProductos data={datos.precioPromedioTabla} />
                <GraficoVentaPorProducto data={datos.ventaPorProducto} />
                <TopClientes topClientes={topClientesState} />
              </>
            )}
          </>
        )}
      </div>
    </DashboardLayout>
  );
}