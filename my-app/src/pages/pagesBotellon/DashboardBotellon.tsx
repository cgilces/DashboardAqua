import React, { useState, useEffect, useMemo } from "react";
import logo from "../../assets/imagen-botellon-v01.png";
import { useAuth } from "../../components/auth/AuthContext";
import DashboardLayout from "../../layout/DashboardLayout";
import { Header } from "../../components/common/Header";
import BotonActualizarSincronizacion from "../../components/elements/BotonActualizarSincronizacion";
import TablaVentasBase from "../../components/ComponentBotellon/TablaVentasBase";
import ResumenVentasCanalUSD from "../../components/ComponentBotellon/ResumenVentasCanalUSD";
import ChatFlotante from "../../components/elements/ChatFlotante";
import TablaVipBotellon from "../../components/ComponentBotellon/TablaVipBotellon";
import TablaDomicilioBotellon from "../../components/ComponentBotellon/TablaDomicilioBotellon";
import TablaEmpresasBotellon from "../../components/ComponentBotellon/TablaEmpresasBotellon";
import TablaQuitoBotellon from "../../components/ComponentBotellon/TablaQuitoBotellon";
import TablaWebsiteBotellon from "../../components/ComponentBotellon/TablaWebsiteBotellon";
import { API_BASE_URL } from "../../config";
import GraficoTendencia from "../../components/common/GraficoTendencia";


/* ================================
    MESES
================================ */
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

/* ================================
   SECCIONES BOTELLÓN
================================ */
const SECCIONES = [
  { key: "TIENDAS_VIP", titulo: "Tiendas VIP", excel: "tiendas_vip" },
  { key: "TIENDAS", titulo: "Tiendas", excel: "tiendas" },
  { key: "MAYORISTA", titulo: "Mayorista", excel: "mayorista" },
  { key: "RURAL", titulo: "Rural", excel: "rural" },
  { key: "TELEVENTA_VIP", titulo: "Televentas VIP", excel: "televentas_vip" },
];

export default function DashboardBotellon() {
  const hoy = new Date();
  const mesActual = hoy.getMonth() + 1;
  const anioActual = hoy.getFullYear();

  const [mesSeleccionado, setMesSeleccionado] = useState(
    localStorage.getItem("mesSeleccionadoBotellon") ?? mesActual.toString()
  );
  const [anioSeleccionado, setAnioSeleccionado] = useState(
    localStorage.getItem("anioSeleccionadoBotellon") ?? anioActual.toString()
  );
  const [tipoProducto, setTipoProducto] = useState<"todo" | "liquido" | "envase">(
    (localStorage.getItem("tipoProductoBotellon") as "todo" | "liquido" | "envase") ?? "todo"
  );

  const [botellones, setBotellones] = useState<any>(null);
  const [empresasData, setEmpresasData] = useState<any>(null);
  const [quitoData, setQuitoData] = useState<any>(null);
  const [websiteData, setWebsiteData] = useState<any>(null);
  const [tendencia6Meses, setTendencia6Meses] = useState<any[]>([]);
  const [cargando, setCargando] = useState(false);
  const [cargandoEmpresas, setCargandoEmpresas] = useState(false);
  const [mostrarTablas, setMostrarTablas] = useState(false);
  const [seccionActiva, setSeccionActiva] = useState<string | null>(null);

  const activarSeccion = (canal: string) => {
    setSeccionActiva(canal);
    setTimeout(() => setSeccionActiva(null), 3000);
  };

  const { user } = useAuth();
  const isAdmin = user?.role === "ADMIN";

  useEffect(() => {
    cargarDashboard();
  }, [anioSeleccionado, mesSeleccionado, tipoProducto]);

  const cargarDashboard = async () => {
    try {
      setCargando(true);
      setCargandoEmpresas(true);
      setBotellones(null);
      setEmpresasData(null);
      setQuitoData(null);
      setWebsiteData(null);
      setTendencia6Meses([]);
      setMostrarTablas(false);

      const token = localStorage.getItem('app_token');
      const authHeaders = token ? { Authorization: `Bearer ${token}` } : {};
      const qsBase = `anio=${anioSeleccionado}&mes=${mesSeleccionado}&tipoProducto=${tipoProducto}`;
      const [resDash, resEmp, resQuito, resWeb] = await Promise.all([
        fetch(`${API_BASE_URL}/api/botellones/dashboard?${qsBase}`, { headers: authHeaders }),
        fetch(`${API_BASE_URL}/api/botellones/empresas-consolidado?${qsBase}`, { headers: authHeaders }),
        fetch(`${API_BASE_URL}/api/botellones/quito-consolidado?${qsBase}`, { headers: authHeaders }),
        fetch(`${API_BASE_URL}/api/botellones/website-consolidado?${qsBase}`, { headers: authHeaders }),
      ]);

      const jsonDash = await resDash.json();
      const jsonEmp = await resEmp.json();
      const jsonQuito = await resQuito.json();
      const jsonWeb = await resWeb.json();

      setBotellones(jsonDash.botellones);
      setEmpresasData(jsonEmp);
      setQuitoData(jsonQuito);
      setWebsiteData(jsonWeb);
      setTendencia6Meses(jsonDash.tendencia6Meses ?? []);
    } catch (error) {
      console.error("Error cargando dashboard botellones", error);
    } finally {
      setCargando(false);
      setCargandoEmpresas(false);
    }
  };

  useEffect(() => {
    localStorage.setItem("mesSeleccionadoBotellon", mesSeleccionado);
    localStorage.setItem("anioSeleccionadoBotellon", anioSeleccionado);
    localStorage.setItem("tipoProductoBotellon", tipoProducto);
  }, [mesSeleccionado, anioSeleccionado, tipoProducto]);

  useEffect(() => {
    if (botellones) {
      const t = setTimeout(() => setMostrarTablas(true), 50);
      return () => clearTimeout(t);
    }
  }, [botellones]);

  const resumenTotal = useMemo(() => {
    if (!botellones) return null;
    let totalUnidades = 0;
    let totalDolares = 0;
    let totalProyeccionUnidades = 0;
    let totalProyeccionDolares = 0;
    let totalUnidadesAnteriorFuentes = 0;
    let totalDolaresAnteriorFuentes = 0;

    SECCIONES.forEach((s) => {
      const total = botellones[s.key]?.total;
      const detalle = botellones[s.key]?.detalle || [];
      const mesAnterior = total?.mesAnterior;

      totalUnidades += total?.unidades ?? 0;
      totalDolares += total?.dolares ?? 0;
      totalUnidadesAnteriorFuentes += mesAnterior?.unidades ?? 0;
      totalDolaresAnteriorFuentes += mesAnterior?.dolares ?? 0;
      totalProyeccionUnidades += detalle.reduce(
        (acc: number, item: any) => acc + Number(item.proyeccion?.unidades || 0), 0
      );
      totalProyeccionDolares += detalle.reduce(
        (acc: number, item: any) => acc + Number(item.proyeccion?.dolares || 0), 0
      );
    });

    // Incluir VIP, DOMICILIO, EMPRESAS, QUITO y WEBSITE en el total
    [botellones.VIP, botellones.DOMICILIO, empresasData, quitoData, websiteData].forEach((src) => {
      if (!src) return;
      const total = src.total;
      const detalle = src.detalle || [];
      const mesAnterior = total?.mesAnterior;
      totalUnidades += total?.unidades ?? 0;
      totalDolares += total?.dolares ?? 0;
      totalUnidadesAnteriorFuentes += mesAnterior?.unidades ?? 0;
      totalDolaresAnteriorFuentes += mesAnterior?.dolares ?? 0;
      totalProyeccionUnidades += detalle.reduce(
        (acc: number, item: any) => acc + Number(item.proyeccion?.unidades || 0), 0
      );
      totalProyeccionDolares += detalle.reduce(
        (acc: number, item: any) => acc + Number(item.proyeccion?.dolares || 0), 0
      );
    });

    // Mes anterior: usar la suma de los valores reales por grupo (fuente de verdad del backend)
    const totalDolaresAnterior = totalDolaresAnteriorFuentes;
    const totalUnidadesAnterior = totalUnidadesAnteriorFuentes;

    const varAbsUnidades = totalProyeccionUnidades - totalUnidadesAnterior;
    const varPorcUnidades =
      totalUnidadesAnterior !== 0 ? (varAbsUnidades / totalUnidadesAnterior) * 100 : 0;
    const varAbsDolares = totalProyeccionDolares - totalDolaresAnterior;
    const varPorcDolares =
      totalDolaresAnterior !== 0 ? (varAbsDolares / totalDolaresAnterior) * 100 : 0;

    return {
      totalUnidades,
      totalDolares,
      totalProyeccionUnidades,
      totalProyeccionDolares,
      totalUnidadesAnterior,
      totalDolaresAnterior,
      varAbsUnidades,
      varPorcUnidades,
      varAbsDolares,
      varPorcDolares,
    };
  }, [botellones, empresasData, quitoData, websiteData]);

  const resumenVentasUSD = useMemo(() => {
    if (!botellones) return null;

    const toEntry = (lowerKey: string, data: any) => {
      if (!data) return null;
      const total = data.total;
      const detalle = data.detalle || [];
      const mesAnterior = total?.mesAnterior;
      return [
        lowerKey,
        {
          monto: total?.dolares ?? 0,
          proyeccion: detalle.reduce((acc: number, item: any) => acc + Number(item.proyeccion?.dolares || 0), 0),
          proyeccion_unidades: detalle.reduce((acc: number, item: any) => acc + Number(item.proyeccion?.unidades || 0), 0),
          unidades: total?.unidades ?? 0,
          vsMesAnterior: {
            monto_anterior: mesAnterior?.dolares ?? 0,
            variacion_abs: mesAnterior?.variacionAbs ?? 0,
            variacion_porc: mesAnterior?.variacionPorc ?? 0,
            unidades: mesAnterior?.unidades ?? 0,
            variacionAbsUnidades: mesAnterior?.variacionAbsUnidades ?? 0,
            variacionPorcUnidades: mesAnterior?.variacionPorcUnidades ?? 0,
          },
        },
      ];
    };

    const seccionEntries = SECCIONES.map((s) =>
      toEntry(s.key.toLowerCase(), botellones[s.key])
    ).filter(Boolean) as [string, any][];

    const extraEntries = [
      toEntry('vip', botellones.VIP),
      toEntry('domicilio', botellones.DOMICILIO),
      toEntry('empresas', empresasData),
      toEntry('quito', quitoData),
      toEntry('website', websiteData),
    ].filter(Boolean) as [string, any][];

    return Object.fromEntries([...seccionEntries, ...extraEntries]);
  }, [botellones, empresasData, quitoData, websiteData]);

  return (
    <DashboardLayout>
      <div className="main-content min-h-screen text-white px-4 md:px-10 py-4 md:py-6">
        <Header />

        {/* ── Header ── */}
        <header className="flex flex-col gap-4 md:flex-row md:justify-between md:items-center mb-6 md:mb-10 border-b border-[#046C5E] pb-4 py-4 md:py-6">
          <div className="flex items-center gap-4">
            <img
              src={logo}
              className="h-16 w-auto transition-all duration-300"
              alt="Logo"
            />

            <div>
              <h1 className="text-xl md:text-3xl font-bold tracking-wide whitespace-nowrap">
                DASHBOARD BOTELLÓN
              </h1>

              <p className="text-sm text-gray-300 whitespace-nowrap">
                Órdenes + Facturas por grupo comercial
              </p>
            </div>
          </div>

          {isAdmin && <BotonActualizarSincronizacion />}

          <div className="flex flex-col gap-1 w-full md:w-auto">
            <label className="text-[10px] uppercase tracking-widest text-emerald-300/80 px-1">
              Tipo de producto
            </label>

            <select
              className={`px-4 py-2 rounded-xl border font-medium transition-all duration-200 min-w-[180px] shadow-sm focus:outline-none focus:ring-2 focus:ring-emerald-400/40 ${tipoProducto === "liquido"
                ? "bg-blue-600/20 border-blue-400/40 text-blue-100 hover:bg-blue-600/30"
                : tipoProducto === "envase"
                  ? "bg-amber-600/20 border-amber-400/40 text-amber-100 hover:bg-amber-600/30"
                  : "bg-[#046C5E]/90 border-[#046C5E] text-white hover:bg-[#035c50]"
                }`}
              value={tipoProducto}
              onChange={(e) =>
                setTipoProducto(e.target.value as "todo" | "liquido" | "envase")
              }
              title="Filtrar todas las tablas por tipo de producto"
            >
              <option value="todo" className="text-black bg-white">
                Todo
              </option>
              <option value="liquido" className="text-black bg-white">
                Líquido
              </option>
              <option value="envase" className="text-black bg-white">
                Envase
              </option>
            </select>
          </div>

          <div className="flex gap-3 w-full md:w-auto flex-wrap">
            <select className="bg-[#046C5E] px-4 py-2 rounded-lg flex-1 min-w-[120px]" value={mesSeleccionado}
              onChange={(e) => setMesSeleccionado(e.target.value)}>
              {Object.entries(meses).map(([nombre, valor]) => (
                <option key={valor} value={valor}>{nombre}</option>
              ))}
            </select>
            <select className="bg-[#046C5E] px-4 py-2 rounded-lg flex-1 min-w-[120px]" value={anioSeleccionado}
              onChange={(e) => setAnioSeleccionado(e.target.value)}>
              {Array.from({ length: 5 }, (_, i) => anioActual + 1 - i).map((anio) => (
                <option key={anio} value={anio}>{anio}</option>
              ))}
            </select>
          </div>
        </header>

        {/* ── Spinner unificado ── */}
        {(cargando || cargandoEmpresas) && (
          <div className="flex flex-col justify-center items-center py-32 gap-4">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-emerald-400" />
            <p className="text-gray-400 text-sm">Cargando datos del dashboard…</p>
          </div>
        )}

        {/* ── Gráfico tendencia ── */}
        {!cargando && !cargandoEmpresas && tendencia6Meses.length > 0 && (() => {
          const tendenciaFinal = resumenTotal
            ? tendencia6Meses.map((d: any) =>
              d.mes === Number(mesSeleccionado) && d.anio === Number(anioSeleccionado)
                ? { ...d, dolares: resumenTotal.totalDolares, proyeccion: resumenTotal.totalProyeccionDolares }
                : d
            )
            : tendencia6Meses;
          return <GraficoTendencia datos={tendenciaFinal} subtitulo="MobilVendor + Odoo" anioFiltro={Number(anioSeleccionado)} mesFiltro={Number(mesSeleccionado)} />;
        })()}

        {/* ── Tarjeta Total Botellones ── */}
        {!cargando && !cargandoEmpresas && isAdmin && resumenTotal && (() => {
          const esMesActual = Number(mesSeleccionado) === mesActual && Number(anioSeleccionado) === anioActual;
          return (
            <div className="mb-8">
              <h3 className="text-sm text-emerald-300 mb-4 uppercase px-2 tracking-wider">
                Total Botellones
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 sm:max-w-2xl mx-auto w-full">

                {/* TOTAL UNIDADES */}
                <div className="min-w-0 bg-gradient-to-br from-[#012E24] to-[#014034] border border-[#046C5E]/40 rounded-2xl p-5 shadow-lg text-center">
                  <p className="uppercase tracking-wider text-xs text-blue-300 font-semibold mb-1">
                    {esMesActual ? "Proyección Unidades" : "Total Unidades"}
                  </p>
                  <p className="font-bold text-white text-2xl md:text-3xl leading-none mb-3 break-all">
                    {Math.round(resumenTotal.totalProyeccionUnidades).toLocaleString("es-EC")}
                  </p>
                  {esMesActual && (
                    <p className="text-xs text-gray-400 mb-2">
                      Real: {resumenTotal.totalUnidades.toLocaleString("es-EC")}
                    </p>
                  )}
                  <div className="border-t border-[#046C5E]/30 pt-2 space-y-1">
                    <p className="text-xs text-gray-400">Mes anterior</p>
                    <p className="text-white font-semibold text-sm">
                      {resumenTotal.totalUnidadesAnterior.toLocaleString("es-EC")} Uni
                    </p>
                    <div className="flex justify-center">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold border ${resumenTotal.varAbsUnidades >= 0
                          ? "text-emerald-400 border-emerald-400/20 bg-emerald-400/10"
                          : "text-red-400 border-red-400/20 bg-red-400/10"
                          }`}
                      >
                        {resumenTotal.varAbsUnidades >= 0 ? "▲" : "▼"}
                        {Math.round(Math.abs(resumenTotal.varAbsUnidades)).toLocaleString("es-EC")}
                        <span className="opacity-90">({resumenTotal.varPorcUnidades.toFixed(1)}%)</span>
                      </span>
                    </div>
                  </div>
                </div>

                {/* TOTAL DÓLARES */}
                <div className="min-w-0 bg-gradient-to-br from-[#012E24] to-[#014034] border border-[#046C5E]/40 rounded-2xl p-5 shadow-lg text-center">
                  <p className="uppercase tracking-wider text-xs text-blue-300 font-semibold mb-1">
                    {esMesActual ? "Proyección Dólares $" : "Total Dólares"}
                  </p>
                  <p className="font-bold text-white text-2xl md:text-3xl leading-none mb-3 break-all">
                    ${resumenTotal.totalProyeccionDolares.toLocaleString("es-EC", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </p>
                  {esMesActual && (
                    <p className="text-xs text-gray-400 mb-2">
                      Real: ${resumenTotal.totalDolares.toLocaleString("es-EC", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </p>
                  )}
                  <div className="border-t border-[#046C5E]/30 pt-2 space-y-1">
                    <p className="text-xs text-gray-400">Mes anterior</p>
                    <p className="text-white font-semibold text-sm">
                      ${resumenTotal.totalDolaresAnterior.toLocaleString("es-EC", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </p>
                    <div className="flex justify-center">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold border ${resumenTotal.varAbsDolares >= 0
                          ? "text-emerald-400 border-emerald-400/20 bg-emerald-400/10"
                          : "text-red-400 border-red-400/20 bg-red-400/10"
                          }`}
                      >
                        {resumenTotal.varAbsDolares >= 0 ? "▲" : "▼"}
                        ${Math.abs(resumenTotal.varAbsDolares).toLocaleString("es-EC", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        <span className="opacity-90">({resumenTotal.varPorcDolares.toFixed(1)}%)</span>
                      </span>
                    </div>
                  </div>
                </div>

              </div>
            </div>
          );
        })()}

        {/* ── Resumen USD ── */}
        {!cargando && !cargandoEmpresas && isAdmin && resumenVentasUSD && (
          <ResumenVentasCanalUSD
            titulo="Ventas USD Botellón"
            canales={[
              "vip", "domicilio", "empresas",
              "tiendas_vip", "tiendas", "mayorista", "rural", "quito", "televenta_vip",
            ]}
            data={resumenVentasUSD}
            anio={anioSeleccionado}
            mes={mesSeleccionado}
            rutasCanales={{
              vip: "/vip-botellon/clientes",
              domicilio: "/domicilio-botellon/clientes",
              empresas: "/empresas-botellon/clientes",
            }}
            scrollTargets={{
              tiendas_vip: "seccion-tiendas_vip",
              tiendas: "seccion-tiendas",
              mayorista: "seccion-mayorista",
              rural: "seccion-rural",
              quito: "seccion-quito",
              televenta_vip: "seccion-televenta_vip",
            }}
            onScrollClick={activarSeccion}
          />
        )}

        {/* ── Canales + Tablas MobilVendor (solo cuando ambas fuentes están listas) ── */}
        {!cargando && !cargandoEmpresas && botellones && (
          <>
            {/* Canal VIP */}
            {botellones.VIP && (
              <TablaVipBotellon
                anio={anioSeleccionado}
                mes={mesSeleccionado}
                datos={botellones.VIP}
                esMesActual={
                  Number(anioSeleccionado) === new Date().getFullYear() &&
                  Number(mesSeleccionado) === new Date().getMonth() + 1
                }
              />
            )}

            {/* Canal Domicilio */}
            {botellones.DOMICILIO && (
              <TablaDomicilioBotellon
                anio={anioSeleccionado}
                mes={mesSeleccionado}
                datos={botellones.DOMICILIO}
                esMesActual={
                  Number(anioSeleccionado) === new Date().getFullYear() &&
                  Number(mesSeleccionado) === new Date().getMonth() + 1
                }
              />
            )}

            {/* Canal Empresas */}
            <TablaEmpresasBotellon
              anio={anioSeleccionado}
              mes={mesSeleccionado}
              datos={empresasData}
              esMesActual={
                Number(anioSeleccionado) === new Date().getFullYear() &&
                Number(mesSeleccionado) === new Date().getMonth() + 1
              }
            />

            {/* Canal Quito */}
            <TablaQuitoBotellon
              anio={anioSeleccionado}
              mes={mesSeleccionado}
              datos={quitoData}
              esMesActual={
                Number(anioSeleccionado) === new Date().getFullYear() &&
                Number(mesSeleccionado) === new Date().getMonth() + 1
              }
            />

            {/* Tablas MobilVendor */}
            {mostrarTablas &&
              SECCIONES.map((s) => {
                const detalle = botellones?.[s.key]?.detalle ?? [];
                const detalleFiltrado = detalle.filter(
                  (r: any) =>
                    r.unidades > 0 ||
                    r.dolares > 0 ||
                    (r.proyeccion?.dolares || 0) > 0 ||
                    (r.proyeccion?.unidades || 0) > 0
                );
                if (detalleFiltrado.length === 0) return null;
                const SECCIONES_METAS: Record<string, string> = {
                  TIENDAS_VIP: "TIENDAS_VIP",
                  TIENDAS: "TIENDAS",
                  MAYORISTA: "MAYORISTA",
                  RURAL: "RURAL",
                };
                const esActiva = seccionActiva === s.key.toLowerCase();
                return (
                  <div
                    key={s.key}
                    id={`seccion-${s.key.toLowerCase()}`}
                    className={`rounded-xl transition-all duration-500 ${esActiva
                      ? "ring-2 ring-emerald-400 shadow-[0_0_20px_rgba(52,211,153,0.35)]"
                      : ""
                      }`}
                  >
                    <TablaVentasBase
                      titulo={s.titulo}
                      data={detalleFiltrado}
                      nombreHojaExcel={s.titulo}
                      nombreArchivoExcel={s.excel}
                      anio={anioSeleccionado}
                      mes={mesSeleccionado}
                      seccionMetas={SECCIONES_METAS[s.key]}
                    />
                  </div>
                );
              })}
          </>
        )}

        <ChatFlotante />
      </div>
    </DashboardLayout>
  );
}
