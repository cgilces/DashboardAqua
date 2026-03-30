import React, { useState, useEffect, useMemo } from "react";
import GraficoTendencia from "../../components/common/GraficoTendencia";
import logo from "../../assets/logo.png";
import { useAuth } from "../../components/auth/AuthContext";
import RankingPreventas from "../../components/ComponentPreventa/RankingPreventas";
import TopClientes from "../../components/ComponentPreventa/TopClientes";
import RankingRutasR from "../../components/ComponentPreventa/RankingRutasR";
import DashboardLayout from "../../layout/DashboardLayout";
import GraficoVentaPorProducto from "../../components/ComponentPreventa/GraficoVentaPorProducto";
import CostoPromedioProductos from "../../components/ComponentPreventa/CostoPromedioProductos";
import { Header } from "../../components/common/Header";
import { useNavigate } from "react-router-dom";
import BotonActualizarSincronizacion from "../../components/elements/BotonActualizarSincronizacion";
import RankingDescartablePorCanal from "../../components/ComponentPreventa/RankingDescartablePorCanal";
import TablaDescartableOdoo from "../../components/ComponentPreventa/TablaDescartableOdoo";
import { API_BASE_URL } from '../../config';
import TablaCotsa from "../../components/ComponentPreventa/TablaCotsa";


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
  const [cotsaCard,  setCotsaCard]  = useState<any>(null);
  const [odooCard,   setOdooCard]   = useState<any>(null);
  const [tendencia6Meses, setTendencia6Meses] = useState<any[]>([]);

  useEffect(() => {
    if (mesSeleccionado && anioSeleccionado) {
      setCotsaCard(null);
      setOdooCard(null);
      obtenerDatos(parseInt(anioSeleccionado), parseInt(mesSeleccionado));
    }
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
      setTendencia6Meses(data.tendencia6Meses ?? []);
    } catch (error) {
      console.error("Error obteniendo los datos", error);
    } finally {
      setCargando(false);
    }
  };

  const kpis = datos?.kpisGenerales;
  const resumenVentasPorCanal = datos?.resumenVentasPorCanal || {};

  const totalDescartable = useMemo(() => {
    const canales = Object.values(datos?.resumenVentasPorCanal || {}) as any[];
    if (canales.length === 0 && !cotsaCard && !odooCard) return null;

    let totalUnidades = 0, totalMonto = 0, totalMontoReal = 0, totalUnidadesAnterior = 0;

    canales.forEach((c: any) => {
      totalUnidades         += Number(c.unidades         || 0);
      totalMonto            += Number(c.monto            || 0);
      totalMontoReal        += Number(c.montoReal        || 0);
      totalUnidadesAnterior += Number(c.unidadesAnterior || 0);
    });
    if (cotsaCard) {
      totalUnidades         += Number(cotsaCard.unidades         || 0);
      totalMonto            += Number(cotsaCard.monto            || 0);
      totalMontoReal        += Number(cotsaCard.montoReal ?? cotsaCard.monto ?? 0);
      totalUnidadesAnterior += Number(cotsaCard.unidadesAnterior || 0);
    }
    if (odooCard) {
      totalUnidades         += Number(odooCard.unidades         || 0);
      totalMonto            += Number(odooCard.monto            || 0);
      totalMontoReal        += Number(odooCard.montoReal ?? odooCard.monto ?? 0);
      totalUnidadesAnterior += Number(odooCard.unidadesAnterior || 0);
    }

    // Mes anterior: usar tendencia6Meses como fuente de verdad — ya agrega
    // TODOS los canales completos (TIENDAS, RURAL, DOMICILIO, VIP, MAYORISTA, COTSA, ODOO)
    const mesPrevNum  = Number(mesSeleccionado) > 1 ? Number(mesSeleccionado) - 1 : 12;
    const anioPrevNum = Number(mesSeleccionado) > 1 ? Number(anioSeleccionado)   : Number(anioSeleccionado) - 1;
    const puntoPrev   = tendencia6Meses.find((d: any) => d.mes === mesPrevNum && d.anio === anioPrevNum);
    const totalMesAnterior = puntoPrev ? Number(puntoPrev.dolares) : 0;

    const totalVarAbsUnidades = totalUnidades - totalUnidadesAnterior;
    const totalVariacionAbs   = totalMontoReal - totalMesAnterior;
    const totalVariacionPorc  = totalMesAnterior > 0 ? (totalVariacionAbs / totalMesAnterior) * 100 : 0;
    const totalVarPorcUnidades = totalUnidadesAnterior > 0 ? (totalVarAbsUnidades / totalUnidadesAnterior) * 100 : 0;

    return {
      totalUnidades, totalMonto, totalMontoReal, totalMesAnterior, totalVariacionAbs, totalVariacionPorc,
      totalUnidadesAnterior, totalVarAbsUnidades, totalVarPorcUnidades,
    };
  }, [datos, cotsaCard, odooCard, tendencia6Meses, mesSeleccionado, anioSeleccionado]);

  const navigate = useNavigate();
  const [seccionActiva, setSeccionActiva] = useState<string | null>(null);

  const activarSeccion = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
    setSeccionActiva(id);
    setTimeout(() => setSeccionActiva(null), 3000);
  };

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
      <div className="main-content min-h-screen text-white px-4 md:px-10 py-4 md:py-6">
        <Header />

        <header className="flex flex-col gap-4 md:flex-row md:justify-between md:items-center mb-6 md:mb-10 border-b border-[#046C5E] pb-4 py-4 md:py-6">
          <div className="flex items-center gap-4">
            <img src={logo} className="h-14 w-auto transition-all duration-300" alt="Logo" />
            <h1 className="text-xl md:text-3xl font-bold tracking-wide">DASHBOARD DESCARTABLE</h1>
          </div>

          <div className="flex justify-center w-full md:w-auto">
            {isAdmin && <BotonActualizarSincronizacion />}
          </div>

          <div className="flex gap-3 w-full md:w-auto flex-wrap items-center">
            <select className="bg-[#046C5E] px-4 py-2 rounded-lg flex-1 min-w-[120px]" value={mesSeleccionado}
              onChange={e => setMesSeleccionado(e.target.value)}>
              {Object.entries(meses).map(([n, v]) => (
                <option key={n} value={v}>{n}</option>
              ))}
            </select>
            <select className="bg-[#046C5E] px-4 py-2 rounded-lg flex-1 min-w-[120px]" value={anioSeleccionado}
              onChange={e => setAnioSeleccionado(e.target.value)}>
              {Array.from({ length: 5 }, (_, i) => {
                const y = new Date().getFullYear() - i;
                return <option key={y} value={y}>{y}</option>;
              })}
            </select>
          </div>
        </header>

        {cargando && (
          <div className="flex flex-col justify-center items-center py-32 gap-4">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-emerald-400" />
            <p className="text-gray-400 text-sm">Cargando datos…</p>
          </div>
        )}

        {datos && !cargando && kpis && (
          <>
            {/* ── Gráfico tendencia ── */}
            {tendencia6Meses.length > 0 && (() => {
              // Sobrescribir el mes seleccionado con los valores exactos del card Total Descartable
              const tendenciaFinal = totalDescartable
                ? tendencia6Meses.map((d: any) =>
                    d.mes === Number(mesSeleccionado) && d.anio === Number(anioSeleccionado)
                      ? { ...d, dolares: totalDescartable.totalMontoReal, proyeccion: totalDescartable.totalMonto }
                      : d
                  )
                : tendencia6Meses;
              return <GraficoTendencia datos={tendenciaFinal} subtitulo="Preventa" anioFiltro={Number(anioSeleccionado)} mesFiltro={Number(mesSeleccionado)} />;
            })()}

            {/* ── Tarjeta Total Descartable ── */}
            {isAdmin && totalDescartable && (() => {
              const esMesActual = mesActual === parseInt(mesSeleccionado) && anioActual === parseInt(anioSeleccionado);
              return (
              <div className="mb-8">
                <h3 className="text-sm text-emerald-300 mb-4 uppercase px-2 tracking-wider">
                  Total Descartable
                </h3>
                <div className="flex justify-center">
                  <div className="min-w-0 w-full max-w-sm bg-gradient-to-br from-[#012E24] to-[#014034] border border-[#046C5E]/40 rounded-2xl p-5 shadow-lg text-center">
                    <p className="uppercase tracking-wider text-xs text-blue-300 font-semibold mb-1">
                      {esMesActual ? "Proyección $" : "Total Dólares"}
                    </p>
                    <p className="font-bold text-white text-2xl md:text-3xl leading-none mb-1 break-all">
                      ${totalDescartable.totalMonto.toLocaleString("es-EC", { minimumFractionDigits: 2 })}
                    </p>
                    {esMesActual && (
                      <p className="text-xs text-gray-400 mb-3">
                        Real: ${totalDescartable.totalMontoReal.toLocaleString("es-EC", { minimumFractionDigits: 2 })}
                      </p>
                    )}
                    <div className="border-t border-[#046C5E]/30 pt-2 space-y-1">
                      <p className="text-xs text-gray-400">Mes anterior</p>
                      <p className="text-white font-semibold text-sm">
                        ${totalDescartable.totalMesAnterior.toLocaleString("es-EC", { minimumFractionDigits: 2 })}
                      </p>
                      <div className="flex justify-center">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold border ${
                            totalDescartable.totalVariacionAbs >= 0
                              ? "text-emerald-400 border-emerald-400/20 bg-emerald-400/10"
                              : "text-red-400 border-red-400/20 bg-red-400/10"
                          }`}
                        >
                          {totalDescartable.totalVariacionAbs >= 0 ? "▲" : "▼"}
                          ${Math.abs(totalDescartable.totalVariacionAbs).toLocaleString("es-EC", { minimumFractionDigits: 2 })}
                          <span className="opacity-90">({totalDescartable.totalVariacionPorc.toFixed(1)}%)</span>
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              );
            })()}

            {/* ── Cards canal — solo ADMIN ── */}
            {isAdmin && resumenVentasPorCanal && (
              <div className="mb-10">
                <h3 className="text-xs text-gray-400 uppercase tracking-widest mb-4 px-1">
                  Resumen por canal
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  {[
                    ...Object.values(resumenVentasPorCanal).filter((c: any) => c.monto > 0 || c.unidades > 0),
                    ...(cotsaCard ? [cotsaCard] : []),
                    ...(odooCard  ? [odooCard]  : []),
                  ].map((canal: any) => {
                    const positivo = canal.variacionAbs >= 0;
                    const esCotsa = canal.canal === "COTSA - AGUA OK";
                    const esOdoo  = canal.canal === "EMPRESA DESCARTABLE ODOO";
                    const esClickable = true;

                    const handleCardClick = () => {
                      if (esCotsa)
                        navigate(`/cotsa/clientes/${anioSeleccionado}/${mesSeleccionado}`);
                      else if (esOdoo)
                        navigate(`/descartable-odoo/clientes/${anioSeleccionado}/${mesSeleccionado}`);
                      else if (canal.canal === "RURAL")
                        activarSeccion("seccion-ranking-rutas-r");
                      else if (["DOMICILIO", "MAYORISTA", "VIP"].includes(canal.canal))
                        activarSeccion("seccion-ranking-descartable");
                      else
                        activarSeccion("seccion-ranking-preventas");
                    };

                    return (
                      <div
                        key={canal.canal}
                        onClick={handleCardClick}
                        className={`bg-gradient-to-br from-[#012E24] to-[#013d30] border border-[#046C5E]/60 rounded-2xl p-5 flex flex-col gap-3 shadow-md hover:shadow-lg hover:border-emerald-400/60 hover:scale-[1.02] transition-all duration-200 cursor-pointer`}
                      >
                        {/* Nombre canal */}
                        <div className="flex items-center justify-between">
                          <p className="text-[11px] font-bold uppercase tracking-widest text-blue-300 truncate">
                            {canal.canal}
                          </p>
                          <span className="text-[10px] text-gray-400 italic shrink-0 ml-1">
                            {esCotsa || esOdoo ? "Ver clientes →" : "Ver tabla ↓"}
                          </span>
                        </div>

                        {/* Proyección (izq) + Unidades (der) */}
                        <div className="flex items-end justify-between">
                          <div>
                            <p className="text-[10px] text-gray-400 uppercase tracking-wide mb-0.5">Proyección</p>
                            <p className="text-2xl font-extrabold text-white leading-tight break-all">
                              ${canal.monto.toLocaleString("es-EC", { minimumFractionDigits: 2 })}
                            </p>
                            {canal.montoReal != null && canal.montoReal !== canal.monto && (
                              <p className="text-[10px] text-gray-400 mt-0.5">
                                Real: ${canal.montoReal.toLocaleString("es-EC", { minimumFractionDigits: 2 })}
                              </p>
                            )}
                          </div>
                          <div className="flex flex-col items-end">
                            <span className="text-[10px] text-gray-400 uppercase tracking-wide">Unidades</span>
                            <span className="text-sm font-semibold text-green-300">
                              {canal.unidades.toLocaleString("es-EC")}
                            </span>
                          </div>
                        </div>

                        <div className="border-t border-[#046C5E]/30" />

                        {/* Mes anterior + variación compacto */}
                        <div className={`flex items-center justify-between rounded-lg px-3 py-1.5 border ${
                          positivo
                            ? "bg-green-500/10 border-green-500/25"
                            : "bg-red-500/10 border-red-500/25"
                        }`}>
                          <div className="flex flex-col leading-tight">
                            <span className="text-[9px] text-gray-400 uppercase tracking-wide">Mes anterior</span>
                            <span className="text-sm font-semibold text-gray-200">
                              ${canal.mesAnterior.toLocaleString("es-EC", { minimumFractionDigits: 2 })}
                            </span>
                          </div>
                          <div className={`flex flex-col items-end leading-tight ${positivo ? "text-green-400" : "text-red-400"}`}>
                            <span className="text-xs font-bold">
                              {positivo ? "▲" : "▼"} ${Math.abs(canal.variacionAbs).toLocaleString("es-EC", { minimumFractionDigits: 2 })}
                            </span>
                            <span className="text-[10px] opacity-80">({(canal.variacionPorc || 0).toFixed(1)}%)</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

           

            {/* ── RankingPreventas — ADMIN + SUPERVISOR + VENDEDOR ── */}
            {puedeVerRanking && (
              <div
                id="seccion-ranking-preventas"
                className={`rounded-xl transition-all duration-500 ${
                  seccionActiva === "seccion-ranking-preventas"
                    ? "ring-2 ring-emerald-400 shadow-[0_0_20px_rgba(52,211,153,0.35)]"
                    : ""
                }`}
              >
                <RankingPreventas
                  datos={datos}
                  anio={anioSeleccionado}
                  mes={mesSeleccionado}
                />
              </div>
            )}

            {/* ── RankingRutasR — ADMIN + SUPERVISOR + VENDEDOR ── */}
            {puedeVerRanking && (
              <div
                id="seccion-ranking-rutas-r"
                className={`rounded-xl transition-all duration-500 ${
                  seccionActiva === "seccion-ranking-rutas-r"
                    ? "ring-2 ring-emerald-400 shadow-[0_0_20px_rgba(52,211,153,0.35)]"
                    : ""
                }`}
              >
                <RankingRutasR
                  data={datos.rankingRutasR}
                  anio={anioSeleccionado}
                  mes={mesSeleccionado}
                />
              </div>
            )}


             {/* ── Tabla COTSA  nueva ──────────────────────────── */}
            <TablaCotsa
              anio={anioSeleccionado}
              mes={mesSeleccionado}
              onTotalesLoaded={setCotsaCard}
            />


            {/* ── NUEVO: Tabla rutas Odoo descartable ── */}
            <TablaDescartableOdoo
              anio={anioSeleccionado}
              mes={mesSeleccionado}
              onTotalesLoaded={setOdooCard}
            />

            {/* ── Resto — solo ADMIN ── */}
            {isAdmin && (
              <>
                <div
                  id="seccion-ranking-descartable"
                  className={`rounded-xl transition-all duration-500 ${
                    seccionActiva === "seccion-ranking-descartable"
                      ? "ring-2 ring-emerald-400 shadow-[0_0_20px_rgba(52,211,153,0.35)]"
                      : ""
                  }`}
                >
                  <RankingDescartablePorCanal
                    data={datos.ventasDescartablePorCanal}
                    anio={anioSeleccionado}
                    mes={mesSeleccionado}
                  />
                </div>



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