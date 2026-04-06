import React, { useEffect, useState } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import * as XLSX from "xlsx";
import { BsDownload } from "react-icons/bs";
import DashboardLayout from "../../layout/DashboardLayout";
import { Header } from "../../components/common/Header";
import { API_BASE_URL } from "../../config";

const fmt    = (v: number) => v.toLocaleString("es-EC", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtInt = (v: number) => v.toLocaleString("es-EC");

const MESES = ["","Enero","Febrero","Marzo","Abril","Mayo","Junio",
  "Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];

type LocationState = {
  objetivo_gerencia?: number; objetivo_gerencia_unidades?: number;
  proyeccion?: number; monto?: number; meta?: number;
};

const POR_PAGINA = 60;

const DetallePreventasPage: React.FC = () => {
  const { ruta, anio, mes } = useParams();
  const navigate  = useNavigate();
  const location  = useLocation();
  const state     = (location.state || {}) as LocationState;

  const objetivo    = Number(state.objetivo_gerencia)          || 0;
  const objUnidades = Number(state.objetivo_gerencia_unidades) || 0;
  const proyeccion  = Number(state.proyeccion)                 || 0;
  const monto       = Number(state.monto)                      || 0;
  const metaVendedor = Number(state.meta)                      || 0;
  const faltaUSD    = objetivo > 0 ? objetivo - proyeccion : 0;
  const porcObj     = objetivo > 0 ? (proyeccion / objetivo) * 100 : null;
  const superado    = faltaUSD <= 0;

  const [productos,       setProductos]       = useState<any[]>([]);
  const [resumenClientes, setResumenClientes] = useState<any>(null);
  const [clientesRuta,    setClientesRuta]    = useState<any[]>([]);
  const [cargando,        setCargando]        = useState(false);
  const [filtroConsumo,   setFiltroConsumo]   = useState("Todos");
  const [busqueda,        setBusqueda]        = useState("");
  const [pagina,          setPagina]          = useState(1);
  const [sortConfig,      setSortConfig]      = useState<{ key: string; direction: "asc" | "desc" }>({ key: "codigo_cliente", direction: "asc" });

  if (!ruta || !anio || !mes)
    return <div className="text-white p-10">Parámetros inválidos en la ruta</div>;

  const requestSort = (key: string) => {
    const dir = sortConfig.key === key && sortConfig.direction === "asc" ? "desc" : "asc";
    setSortConfig({ key, direction: dir });
    setClientesRuta(prev => [...prev].sort((a, b) => {
      const av: any = key === "vsMesAnterior" ? Number(a?.vsMesAnterior?.variacion_abs) || 0 : a[key];
      const bv: any = key === "vsMesAnterior" ? Number(b?.vsMesAnterior?.variacion_abs) || 0 : b[key];
      const an = Number(String(av).replace(",", ".")), bn = Number(String(bv).replace(",", "."));
      if (Number.isFinite(an) && Number.isFinite(bn)) return dir === "asc" ? an - bn : bn - an;
      return dir === "asc" ? String(av).localeCompare(String(bv)) : String(bv).localeCompare(String(av));
    }));
  };

  const sa = (k: string) => sortConfig.key === k ? (sortConfig.direction === "asc" ? " ↑" : " ↓") : " ↕";

  useEffect(() => {
    setCargando(true);
    fetch(`${API_BASE_URL}/api/ventas/detalle-ruta/${ruta}/${anio}/${mes}`)
      .then(r => r.json())
      .then(data => {
        let clientes = data.clientesRuta || [];
        if (filtroConsumo !== "Todos") clientes = clientes.filter((c: any) => c.tuvo_consumo === filtroConsumo);
        setClientesRuta(clientes);
        setProductos((data.productosVendidos || []).map((p: any) => ({
          descripcion: p.producto, unidades: Number(p.unidades_vendidas), monto: Number(p.monto_usd),
        })));
        setResumenClientes(data.resumenClientes);
        setPagina(1);
      })
      .finally(() => setCargando(false));
  }, [ruta, anio, mes, filtroConsumo]);

  const filtrados = clientesRuta.filter(c =>
    String(c?.nombre_cliente || "").toLowerCase().includes(busqueda.toLowerCase())
  );
  const totalPags  = Math.ceil(filtrados.length / POR_PAGINA);
  const paginados  = filtrados.slice((pagina - 1) * POR_PAGINA, pagina * POR_PAGINA);

  const exportar = () => {
    if (!clientesRuta.length) return;
    const datos = clientesRuta.map(c => ({
      Código: c.codigo_cliente, Cliente: c.nombre_cliente,
      Dirección: c.direccion_entrega ?? "", "Tipo Negocio": c.tipo_negocio ?? "",
      Teléfono: c.telefono_cliente ?? "", Latitud: c.latitud_cliente ?? "", Longitud: c.longitud_cliente ?? "",
      "Cantidad Actual": Number(c.cantidad_productos || 0),
      "Consumo Actual($)": Number(c.consumo_actual || 0), "Max Consumo($)": Number(c.max_consumo || 0),
      "VS MES ANT": c.vsMesAnterior ? `${c.vsMesAnterior.variacion_abs > 0 ? "+" : ""}${Number(c.vsMesAnterior.variacion_abs || 0).toFixed(2)} (${c.vsMesAnterior.variacion_porc})` : "",
      "Última Visita": c.ultima_visita ?? "—", "Última Factura": c.ultima_factura ?? "—",
      "Tuvo Consumo": c.tuvo_consumo,
    }));
    const ws = XLSX.utils.json_to_sheet(datos);
    XLSX.utils.sheet_add_aoa(ws, [[`CLIENTES DE RUTA - ${ruta?.toUpperCase()} - ${mes}/${anio}`]], { origin: "A1" });
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "ClientesRuta");
    XLSX.writeFile(wb, `clientes_ruta_${ruta?.toUpperCase()}_${mes}_${anio}.xlsx`, { compression: true });
  };

  const Paginacion = () => totalPags > 1 ? (
    <div className="flex items-center justify-between px-4 py-3 border-t border-[#046C5E]/30 flex-wrap gap-2">
      <span className="text-xs text-gray-400">
        {(pagina - 1) * POR_PAGINA + 1}–{Math.min(pagina * POR_PAGINA, filtrados.length)} de {filtrados.length}
      </span>
      <div className="flex gap-1 flex-wrap">
        <button disabled={pagina === 1} onClick={() => setPagina(1)} className="px-2 py-1 text-xs rounded bg-[#014434] disabled:opacity-30 hover:bg-[#016a57]">«</button>
        <button disabled={pagina === 1} onClick={() => setPagina(p => p - 1)} className="px-3 py-1 text-xs rounded bg-[#014434] disabled:opacity-30 hover:bg-[#016a57]">‹ Ant</button>
        {(() => {
          const pages: any[] = [];
          if (totalPags <= 5) { for (let i = 1; i <= totalPags; i++) pages.push(i); }
          else {
            pages.push(1); if (pagina > 3) pages.push("...");
            for (let i = Math.max(2, pagina - 1); i <= Math.min(totalPags - 1, pagina + 1); i++) pages.push(i);
            if (pagina < totalPags - 2) pages.push("..."); pages.push(totalPags);
          }
          return pages.map((n, i) =>
            n === "..." ? <span key={`d${i}`} className="px-1 text-xs text-gray-400">…</span> :
            <button key={`p${i}`} onClick={() => setPagina(n)}
              className={`px-3 py-1 text-xs rounded ${pagina === n ? "bg-emerald-600 font-bold" : "bg-[#014434] hover:bg-[#016a57]"}`}>{n}</button>
          );
        })()}
        <button disabled={pagina === totalPags} onClick={() => setPagina(p => p + 1)} className="px-3 py-1 text-xs rounded bg-[#014434] disabled:opacity-30 hover:bg-[#016a57]">Sig ›</button>
        <button disabled={pagina === totalPags} onClick={() => setPagina(totalPags)} className="px-2 py-1 text-xs rounded bg-[#014434] disabled:opacity-30 hover:bg-[#016a57]">»</button>
      </div>
    </div>
  ) : null;

  if (cargando)
    return (
      <DashboardLayout>
        <div className="flex flex-col justify-center items-center py-32 gap-4">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-emerald-400"/>
          <p>Cargando datos de {ruta}…</p>
        </div>
      </DashboardLayout>
    );

  return (
    <DashboardLayout>
      <div className="main-content min-h-screen text-white px-4 md:px-8 py-4 md:py-6">
        <Header />

        {/* Cabecera */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-6 border-b border-[#046C5E]/50 pb-4">
          <div>
            <button onClick={() => navigate(-1)} className="text-xs text-gray-400 hover:text-white mb-1 flex items-center gap-1 transition">← Volver</button>
            <h1 className="text-xl md:text-2xl font-bold tracking-tight">Ruta {ruta?.toUpperCase()} — Clientes</h1>
            <p className="text-xs text-gray-400">{MESES[Number(mes)]} {anio}</p>
          </div>
          <button onClick={exportar}
            className="flex items-center gap-2 px-4 py-2 rounded-lg border border-[#0db48b]/60 bg-[#0db48b]/20 text-white font-semibold hover:bg-[#0db48b]/30 transition-all self-start sm:self-auto">
            <BsDownload size={16} /> Exportar Excel
          </button>
        </div>

        {/* Card Objetivo Gerencia */}
        {objetivo > 0 && (
          <div className="mb-6 p-5 rounded-2xl border border-amber-500/30 bg-gradient-to-br from-[#1a1200]/80 to-[#012a20]/80 shadow-xl">
            <div className="flex items-center gap-2 mb-5">
              <div className="w-1 h-6 rounded-full bg-gradient-to-b from-amber-400 to-yellow-600"/>
              <h2 className="text-base font-bold text-amber-300 uppercase tracking-wider">Objetivo de Gerencia — {ruta}</h2>
              <span className="ml-auto text-xs text-white/30 font-mono">{mes}/{anio}</span>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-5">
              <div className="rounded-xl bg-white/5 border border-amber-500/20 p-4">
                <p className="text-[10px] font-bold uppercase tracking-widest text-amber-400/70 mb-1">Objetivo USD</p>
                <p className="text-xl font-bold text-amber-300">${fmt(objetivo)}</p>
                {objUnidades > 0 && <p className="text-xs text-white/40 mt-0.5">{fmtInt(objUnidades)} unidades</p>}
              </div>
              <div className="rounded-xl bg-white/5 border border-blue-500/20 p-4">
                <p className="text-[10px] font-bold uppercase tracking-widest text-blue-400/70 mb-1">Proyección</p>
                <p className="text-xl font-bold text-blue-300">${fmt(proyeccion)}</p>
                <p className="text-xs text-white/40 mt-0.5">Venta actual: ${fmt(monto)}</p>
              </div>
              <div className={`rounded-xl bg-white/5 border p-4 ${superado ? "border-green-500/30" : "border-red-500/30"}`}>
                <p className="text-[10px] font-bold uppercase tracking-widest mb-1 text-white/40">{superado ? "Superado en" : "Falta alcanzar"}</p>
                <p className={`text-xl font-bold ${superado ? "text-green-400" : "text-red-400"}`}>{superado ? "+" : "−"}${fmt(Math.abs(faltaUSD))}</p>
                {!superado && metaVendedor > 0 && <p className="text-xs text-white/40 mt-0.5">Meta vendedor: ${fmt(metaVendedor)}</p>}
              </div>
              <div className="rounded-xl bg-white/5 border border-white/10 p-4 flex flex-col justify-between">
                <p className="text-[10px] font-bold uppercase tracking-widest text-white/40 mb-2">Cumplimiento</p>
                <div>
                  <div className="w-full h-2.5 rounded-full bg-white/10 mb-2 overflow-hidden">
                    <div className={`h-full rounded-full transition-all ${porcObj! >= 100 ? "bg-green-400" : porcObj! >= 80 ? "bg-yellow-400" : "bg-red-400"}`}
                      style={{ width: `${Math.min(porcObj ?? 0, 100)}%` }}/>
                  </div>
                  <p className={`text-2xl font-extrabold ${porcObj! >= 100 ? "text-green-400" : porcObj! >= 80 ? "text-yellow-400" : "text-red-400"}`}>
                    {porcObj !== null ? `${porcObj.toFixed(1)}%` : "—"}
                  </p>
                </div>
              </div>
            </div>
            <div className={`rounded-xl px-4 py-3 text-sm font-semibold border ${superado ? "bg-green-500/10 border-green-500/25 text-green-300" : porcObj! >= 80 ? "bg-yellow-500/10 border-yellow-500/25 text-yellow-300" : "bg-red-500/10 border-red-500/25 text-red-300"}`}>
              {superado ? `✓ ${ruta} superó el objetivo. Proyección ${porcObj!.toFixed(1)}% del objetivo.`
                : porcObj! >= 80 ? `⚡ ${ruta} está cerca del objetivo. Faltan $${fmt(faltaUSD)}.`
                : `⚠ ${ruta} necesita $${fmt(faltaUSD)} adicionales (${(porcObj ?? 0).toFixed(1)}% alcanzado).`}
            </div>
          </div>
        )}

        {/* Resumen clientes */}
        {resumenClientes && (
          <div className="grid grid-cols-3 gap-3 md:gap-4 mb-6">
            {[
              { label: "Clientes asignados", value: resumenClientes.totalClientesRuta,  color: "text-white"      },
              { label: "Con consumo",         value: resumenClientes.clientesConConsumo, color: "text-green-400" },
              { label: "Sin consumo",         value: resumenClientes.clientesSinConsumo, color: "text-red-400"   },
            ].map(k => (
              <div key={k.label} className="bg-gradient-to-br from-[#012E24] to-[#013d30] border border-[#046C5E]/40 rounded-xl p-3 md:p-4 text-center">
                <p className="text-[10px] uppercase tracking-widest text-gray-400 mb-1">{k.label}</p>
                <p className={`text-2xl md:text-3xl font-extrabold ${k.color}`}>{k.value}</p>
              </div>
            ))}
          </div>
        )}

        {/* Productos vendidos */}
        {productos.length > 0 && (
          <div className="bg-gradient-to-br from-[#012E24] to-[#013d30] border border-[#046C5E]/30 rounded-2xl overflow-hidden mb-6">
            <h2 className="text-sm font-bold uppercase tracking-wider text-green-300 px-4 py-3 border-b border-[#046C5E]/30">Productos Vendidos</h2>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="bg-[#014434] text-[10px] uppercase text-green-300">
                    <th className="px-4 py-3 text-left">Producto</th>
                    <th className="px-4 py-3 text-right">Unidades</th>
                    <th className="px-4 py-3 text-right">Dólares</th>
                  </tr>
                </thead>
                <tbody>
                  {productos.map((p, idx) => (
                    <tr key={idx} className={`${idx % 2 === 0 ? "bg-[#013d32]" : "bg-[#014f3e]"} hover:bg-[#016a57] transition`}>
                      <td className="px-4 py-2">{p.descripcion}</td>
                      <td className="px-4 py-2 text-right text-green-400 font-semibold">{p.unidades.toLocaleString("es-EC")}</td>
                      <td className="px-4 py-2 text-right text-blue-400 font-semibold">${fmt(p.monto)}</td>
                    </tr>
                  ))}
                  <tr className="bg-[#014434] font-bold border-t border-[#046C5E]/30">
                    <td className="px-4 py-3 text-green-300 uppercase text-xs">Total</td>
                    <td className="px-4 py-3 text-right text-green-400">{productos.reduce((a, p) => a + p.unidades, 0).toLocaleString("es-EC")}</td>
                    <td className="px-4 py-3 text-right text-blue-400">${fmt(productos.reduce((a, p) => a + p.monto, 0))}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Filtros clientes */}
        <div className="flex flex-wrap gap-3 mb-4">
          <div className="relative flex-1 min-w-[180px]">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 1 0 5 11a6 6 0 0 0 12 0z"/>
            </svg>
            <input type="text" placeholder="Buscar cliente…" value={busqueda}
              onChange={e => { setBusqueda(e.target.value); setPagina(1); }}
              className="bg-[#012E24] border border-[#046C5E] rounded-lg px-3 py-2 pl-9 text-sm text-white placeholder-gray-500 w-full focus:outline-none focus:border-emerald-500/60"/>
          </div>
          <select value={filtroConsumo} onChange={e => { setFiltroConsumo(e.target.value); setPagina(1); }}
            className="bg-[#046C5E] px-3 py-2 rounded-lg text-sm font-medium">
            <option value="Todos">Todos</option>
            <option value="Sí">Con consumo</option>
            <option value="No">Sin consumo</option>
          </select>
        </div>

        {/* Tabla / Cards clientes */}
        <div className="bg-gradient-to-br from-[#012E24] to-[#013d30] border border-[#046C5E]/30 rounded-2xl overflow-hidden mb-6">
          <div className="flex items-center justify-between px-4 py-3 border-b border-[#046C5E]/30">
            <h2 className="text-sm font-bold uppercase tracking-wider text-green-300">Clientes de Ruta</h2>
            <span className="text-xs text-gray-400">{filtrados.length} clientes</span>
          </div>

          {/* MOBILE: cards */}
          <div className="md:hidden divide-y divide-[#046C5E]/20">
            {paginados.length === 0
              ? <p className="text-center text-gray-400 py-12 text-sm">Sin clientes.</p>
              : paginados.map((c, idx) => {
                  const sinConsumo = c.tuvo_consumo === "No";
                  const vsAnt = Number(c.vsMesAnterior?.variacion_abs ?? 0);
                  return (
                    <div key={idx} className={`p-4 ${sinConsumo ? "bg-red-900/30 border-l-4 border-red-500/60" : idx % 2 === 0 ? "bg-[#013d32]" : "bg-[#014f3e]"}`}>
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex-1 min-w-0">
                          <p className="font-bold text-white text-sm truncate">{c.nombre_cliente}</p>
                          <p className="text-[11px] text-gray-400 font-mono mt-0.5">{c.codigo_cliente}</p>
                        </div>
                        <span className={`ml-2 shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full ${sinConsumo ? "bg-red-500/30 text-red-300" : "bg-green-500/30 text-green-300"}`}>
                          {sinConsumo ? "Sin consumo" : "Activo"}
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs mb-2">
                        <div>
                          <p className="text-[10px] text-gray-500 uppercase tracking-wide">Consumo Actual</p>
                          <p className="text-white font-bold">${fmt(Number(c.consumo_actual))}</p>
                        </div>
                        <div>
                          <p className="text-[10px] text-gray-500 uppercase tracking-wide">VS Mes Ant</p>
                          <p className={`font-bold ${vsAnt >= 0 ? "text-green-400" : "text-red-400"}`}>
                            {vsAnt >= 0 ? "+" : ""}${fmt(Math.abs(vsAnt))}
                          </p>
                        </div>
                        <div>
                          <p className="text-[10px] text-gray-500 uppercase tracking-wide">Cant. Actual</p>
                          <p className="text-blue-300 font-semibold">{c.cantidad_productos}</p>
                        </div>
                        <div>
                          <p className="text-[10px] text-gray-500 uppercase tracking-wide">Teléfono</p>
                          <p className="text-gray-300">{c.telefono_cliente || "—"}</p>
                        </div>
                        <div>
                          <p className="text-[10px] text-gray-500 uppercase tracking-wide">Última Visita</p>
                          <p className="text-gray-300 text-[11px]">{c.ultima_visita || "—"}</p>
                        </div>
                        <div>
                          <p className="text-[10px] text-gray-500 uppercase tracking-wide">Última Factura</p>
                          <p className="text-gray-300 text-[11px]">{c.ultima_factura || "—"}</p>
                        </div>
                      </div>
                      {c.direccion_entrega && <p className="text-[11px] text-gray-500 truncate mt-1">📍 {c.direccion_entrega}</p>}
                    </div>
                  );
                })
            }
          </div>

          {/* DESKTOP: tabla */}
          <div className="hidden md:block overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="bg-[#014434] text-[10px] uppercase text-green-300 select-none">
                  <th className="px-3 py-3 text-left">N°</th>
                  {([
                    ["Código",         "codigo_cliente"],
                    ["Cliente",        "nombre_cliente"],
                    ["Dirección",      "direccion_entrega"],
                    ["Tipo Negocio",   "tipo_negocio"],
                    ["Teléfono",       "telefono_cliente"],
                    ["Latitud",        "latitud_cliente"],
                    ["Longitud",       "longitud_cliente"],
                    ["Cant. Actual",   "cantidad_productos"],
                    ["Consumo Actual", "consumo_actual"],
                    ["Max Consumo",    "max_consumo"],
                    ["VS Mes Ant",     "vsMesAnterior"],
                    ["Últ. Visita",    "ultima_visita"],
                    ["Últ. Factura",   "ultima_factura"],
                    ["Estado",         "tuvo_consumo"],
                  ] as [string,string][]).map(([label, key]) => (
                    <th key={key} onClick={() => requestSort(key)}
                      className="px-3 py-3 text-left cursor-pointer hover:text-white transition-colors whitespace-nowrap">
                      {label}<span className="ml-1 text-[#046C5E]">{sa(key)}</span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {paginados.length === 0
                  ? <tr><td colSpan={15} className="px-4 py-12 text-center text-gray-400 text-sm">Sin clientes.</td></tr>
                  : paginados.map((c, idx) => {
                      const sinConsumo = c.tuvo_consumo === "No";
                      const vsAnt = Number(c.vsMesAnterior?.variacion_abs ?? 0);
                      return (
                        <tr key={idx} className={`${sinConsumo ? "bg-[rgba(220,38,38,0.5)]" : idx % 2 === 0 ? "bg-[#013d32]" : "bg-[#014f3e]"} hover:bg-[#016a57] transition`}>
                          <td className="px-3 py-2 text-gray-400 text-xs">{(pagina - 1) * POR_PAGINA + idx + 1}</td>
                          <td className="px-3 py-2 font-mono text-xs text-gray-300">{c.codigo_cliente}</td>
                          <td className="px-3 py-2 font-semibold text-white">{c.nombre_cliente}</td>
                          <td className="px-3 py-2 text-gray-300 max-w-[160px]">
                            <span title={c.direccion_entrega} className="line-clamp-2 text-xs">{c.direccion_entrega || "—"}</span>
                          </td>
                          <td className="px-3 py-2 text-gray-300 text-xs">{c.tipo_negocio || "—"}</td>
                          <td className="px-3 py-2 text-gray-300 text-xs whitespace-nowrap">{c.telefono_cliente || "—"}</td>
                          <td className="px-3 py-2 text-gray-400 text-xs">{c.latitud_cliente || "—"}</td>
                          <td className="px-3 py-2 text-gray-400 text-xs">{c.longitud_cliente || "—"}</td>
                          <td className="px-3 py-2 text-right text-blue-300 font-semibold">{c.cantidad_productos}</td>
                          <td className="px-3 py-2 text-right font-bold text-white">${fmt(Number(c.consumo_actual))}</td>
                          <td className="px-3 py-2 text-right">
                            <span className="text-amber-300 font-semibold">${fmt(Number(c.max_consumo))}</span>
                            {c.mes_max_consumo_nombre && <span className="block text-[10px] text-gray-400">{c.mes_max_consumo_nombre}</span>}
                          </td>
                          <td className={`px-3 py-2 text-right font-bold ${vsAnt >= 0 ? "text-green-400" : "text-red-400"}`}>
                            {vsAnt >= 0 ? "+" : ""}${fmt(Math.abs(vsAnt))}
                            {c.vsMesAnterior?.variacion_porc && <span className="block text-[10px] opacity-70">{c.vsMesAnterior.variacion_porc}</span>}
                          </td>
                          <td className="px-3 py-2 text-right text-gray-400 text-xs whitespace-nowrap">{c.ultima_visita || "—"}</td>
                          <td className="px-3 py-2 text-right text-gray-400 text-xs whitespace-nowrap">{c.ultima_factura || "—"}</td>
                          <td className="px-3 py-2 text-center">
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${sinConsumo ? "bg-red-500/30 text-red-300" : "bg-green-500/30 text-green-300"}`}>
                              {sinConsumo ? "Sin consumo" : "Activo"}
                            </span>
                          </td>
                        </tr>
                      );
                    })
                }
              </tbody>
            </table>
          </div>

          <Paginacion />
        </div>
      </div>
    </DashboardLayout>
  );
};

export default DetallePreventasPage;
