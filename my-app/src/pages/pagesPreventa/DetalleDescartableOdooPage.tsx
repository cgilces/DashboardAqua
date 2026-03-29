import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import * as XLSX from "xlsx";
import { BsDownload } from "react-icons/bs";
import DashboardLayout from "../../layout/DashboardLayout";
import { Header } from "../../components/common/Header";
import { API_BASE_URL } from "../../config";

const fmt = (n: number) =>
  n.toLocaleString("es-EC", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const MESES = ["","Enero","Febrero","Marzo","Abril","Mayo","Junio",
  "Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];

type Cliente = {
  codigo_cliente: string | number;
  nombre_cliente: string;
  direccion_entrega: string;
  tipo_negocio: string;
  telefono_cliente: string;
  latitud_cliente: string;
  longitud_cliente: string;
  cantidad_productos: number;
  consumo_actual: string;
  max_consumo: string;
  mes_max_consumo_nombre: string | null;
  ultima_visita: string | null;
  ultima_factura: string | null;
  tuvo_consumo: "Sí" | "No";
  vsMesAnterior: { monto_anterior: string; variacion_abs: string; variacion_porc: string };
};

type Resumen = { totalClientes: number; clientesConConsumo: number; clientesSinConsumo: number };

type Producto = { producto: string; unidades_vendidas: number; monto_usd: number };

const POR_PAGINA = 60;

const DetalleDescartableOdooPage: React.FC = () => {
  const { anio, mes } = useParams<{ anio: string; mes: string }>();
  const navigate = useNavigate();

  const [clientes,   setClientes]   = useState<Cliente[]>([]);
  const [resumen,    setResumen]    = useState<Resumen | null>(null);
  const [productos,  setProductos]  = useState<Producto[]>([]);
  const [cargando,   setCargando]   = useState(false);
  const [busqueda,   setBusqueda]   = useState("");
  const [filtro,     setFiltro]     = useState<"Todos" | "Sí" | "No">("Todos");
  const [pagina,     setPagina]     = useState(1);
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: "asc" | "desc" }>({ key: "codigo_cliente", direction: "asc" });

  if (!anio || !mes) return <div className="text-white p-10">Parámetros inválidos.</div>;

  const requestSort = (key: string) => {
    const dir = sortConfig.key === key && sortConfig.direction === "asc" ? "desc" : "asc";
    setSortConfig({ key, direction: dir });
    setClientes(prev => [...prev].sort((a, b) => {
      const av: any = key === "vsMesAnterior" ? Number((a as any).vsMesAnterior?.variacion_abs) || 0 : (a as any)[key];
      const bv: any = key === "vsMesAnterior" ? Number((b as any).vsMesAnterior?.variacion_abs) || 0 : (b as any)[key];
      const an = Number(String(av).replace(",", ".")), bn = Number(String(bv).replace(",", "."));
      if (Number.isFinite(an) && Number.isFinite(bn)) return dir === "asc" ? an - bn : bn - an;
      return dir === "asc" ? String(av).localeCompare(String(bv)) : String(bv).localeCompare(String(av));
    }));
  };

  const sa = (k: string) => sortConfig.key === k ? (sortConfig.direction === "asc" ? " ↑" : " ↓") : " ↕";

  useEffect(() => {
    setCargando(true);
    fetch(`${API_BASE_URL}/api/odoo/clientes?anio=${anio}&mes=${mes}`)
      .then(r => r.json())
      .then(data => {
        let lista = data.clientes || [];
        if (filtro !== "Todos") lista = lista.filter((c: Cliente) => c.tuvo_consumo === filtro);
        setClientes(lista);
        setResumen(data.resumen);
        setProductos(data.productosVendidos || []);
        setPagina(1);
      })
      .catch(console.error)
      .finally(() => setCargando(false));
  }, [anio, mes, filtro]);

  const filtrados = clientes.filter(c => {
    const q = busqueda.toLowerCase();
    return !q || c.nombre_cliente?.toLowerCase().includes(q) || String(c.codigo_cliente).toLowerCase().includes(q);
  });
  const totalPags = Math.ceil(filtrados.length / POR_PAGINA);
  const paginados = filtrados.slice((pagina - 1) * POR_PAGINA, pagina * POR_PAGINA);

  const exportar = () => {
    const datos = filtrados.map((c, i) => ({
      "N°": i + 1, Código: c.codigo_cliente, Cliente: c.nombre_cliente,
      Dirección: c.direccion_entrega, "Tipo Negocio": c.tipo_negocio,
      Teléfono: c.telefono_cliente, Latitud: c.latitud_cliente, Longitud: c.longitud_cliente,
      "Cant. Actual": c.cantidad_productos, "Consumo Actual ($)": Number(c.consumo_actual),
      "Max Consumo ($)": Number(c.max_consumo),
      "VS Mes Ant": c.vsMesAnterior
        ? `${Number(c.vsMesAnterior.variacion_abs) > 0 ? "+" : ""}${Number(c.vsMesAnterior.variacion_abs).toFixed(2)} (${c.vsMesAnterior.variacion_porc})`
        : "",
      "Última Factura": c.ultima_factura || "—", "Tuvo Consumo": c.tuvo_consumo,
    }));
    const ws = XLSX.utils.json_to_sheet(datos);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Descartable Odoo");
    XLSX.writeFile(wb, `clientes_descartable_odoo_${anio}_${mes}.xlsx`);
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
            pages.push(1);
            if (pagina > 3) pages.push("...");
            for (let i = Math.max(2, pagina - 1); i <= Math.min(totalPags - 1, pagina + 1); i++) pages.push(i);
            if (pagina < totalPags - 2) pages.push("...");
            pages.push(totalPags);
          }
          return pages.map((n, i) =>
            n === "..." ? <span key={`d${i}`} className="px-1 py-1 text-xs text-gray-400">…</span> :
            <button key={`p${i}`} onClick={() => setPagina(n)}
              className={`px-3 py-1 text-xs rounded ${pagina === n ? "bg-emerald-600 font-bold" : "bg-[#014434] hover:bg-[#016a57]"}`}>{n}</button>
          );
        })()}
        <button disabled={pagina === totalPags} onClick={() => setPagina(p => p + 1)} className="px-3 py-1 text-xs rounded bg-[#014434] disabled:opacity-30 hover:bg-[#016a57]">Sig ›</button>
        <button disabled={pagina === totalPags} onClick={() => setPagina(totalPags)} className="px-2 py-1 text-xs rounded bg-[#014434] disabled:opacity-30 hover:bg-[#016a57]">»</button>
      </div>
    </div>
  ) : null;

  return (
    <DashboardLayout>
      <div className="main-content min-h-screen text-white px-4 md:px-8 py-4 md:py-6">
        <Header />

        {/* Cabecera */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-6 border-b border-[#046C5E]/50 pb-4">
          <div>
            <button onClick={() => navigate(-1)} className="text-xs text-gray-400 hover:text-white mb-1 flex items-center gap-1 transition">
              ← Volver
            </button>
            <h1 className="text-xl md:text-2xl font-bold tracking-tight">DESCARTABLE ODOO — Clientes</h1>
            <p className="text-xs text-gray-400">{MESES[Number(mes)]} {anio}</p>
          </div>
          <button onClick={exportar}
            className="flex items-center gap-2 px-4 py-2 rounded-lg border border-[#0db48b]/60 bg-[#0db48b]/20 text-white font-semibold hover:bg-[#0db48b]/30 transition-all self-start sm:self-auto">
            <BsDownload size={16} /> Exportar Excel
          </button>
        </div>

        {/* Resumen */}
        {resumen && (
          <div className="grid grid-cols-3 gap-3 md:gap-4 mb-6">
            {[
              { label: "Total clientes", value: resumen.totalClientes, color: "text-white" },
              { label: "Con consumo",    value: resumen.clientesConConsumo,  color: "text-green-400" },
              { label: "Sin consumo",    value: resumen.clientesSinConsumo,  color: "text-red-400"   },
            ].map(k => (
              <div key={k.label} className="bg-gradient-to-br from-[#012E24] to-[#013d30] border border-[#046C5E]/40 rounded-xl p-3 md:p-4 text-center">
                <p className="text-[10px] uppercase tracking-widest text-gray-400 mb-1">{k.label}</p>
                <p className={`text-2xl md:text-3xl font-extrabold ${k.color}`}>{k.value}</p>
              </div>
            ))}
          </div>
        )}

        {/* Productos Vendidos */}
        {productos.length > 0 && (
          <div className="bg-gradient-to-br from-[#012E24] to-[#013d30] border border-[#046C5E]/30 rounded-2xl overflow-hidden mb-6">
            <h2 className="text-sm font-bold uppercase tracking-wider text-green-300 px-4 py-3 border-b border-[#046C5E]/30">
              Productos Vendidos
            </h2>
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
                      <td className="px-4 py-2">{p.producto}</td>
                      <td className="px-4 py-2 text-right text-green-400 font-semibold">{Number(p.unidades_vendidas).toLocaleString("es-EC")}</td>
                      <td className="px-4 py-2 text-right text-blue-400 font-semibold">${fmt(Number(p.monto_usd))}</td>
                    </tr>
                  ))}
                  <tr className="bg-[#014434] font-bold border-t border-[#046C5E]/30">
                    <td className="px-4 py-3 text-green-300 uppercase text-xs">Total</td>
                    <td className="px-4 py-3 text-right text-green-400">{productos.reduce((a, p) => a + Number(p.unidades_vendidas), 0).toLocaleString("es-EC")}</td>
                    <td className="px-4 py-3 text-right text-blue-400">${fmt(productos.reduce((a, p) => a + Number(p.monto_usd), 0))}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Filtros */}
        <div className="flex flex-wrap gap-3 mb-4">
          <div className="relative flex-1 min-w-[180px]">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 1 0 5 11a6 6 0 0 0 12 0z"/>
            </svg>
            <input type="text" placeholder="Buscar cliente o código…" value={busqueda}
              onChange={e => { setBusqueda(e.target.value); setPagina(1); }}
              className="bg-[#012E24] border border-[#046C5E] rounded-lg px-3 py-2 pl-9 text-sm text-white placeholder-gray-500 w-full focus:outline-none focus:border-emerald-500/60"/>
          </div>
          <select value={filtro} onChange={e => { setFiltro(e.target.value as any); setPagina(1); }}
            className="bg-[#046C5E] px-3 py-2 rounded-lg text-sm font-medium">
            <option value="Todos">Todos</option>
            <option value="Sí">Con consumo</option>
            <option value="No">Sin consumo</option>
          </select>
        </div>

        {/* Loading */}
        {cargando && (
          <div className="flex flex-col justify-center items-center py-32 gap-4">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-emerald-400" />
            <p className="text-gray-400 text-sm">Cargando datos…</p>
          </div>
        )}

        {/* Tabla / Cards */}
        {!cargando && (
          <div className="bg-gradient-to-br from-[#012E24] to-[#013d30] border border-[#046C5E]/30 rounded-2xl overflow-hidden mb-6">

            {/* ── MOBILE: cards ── */}
            <div className="md:hidden divide-y divide-[#046C5E]/20">
              {paginados.length === 0
                ? <p className="text-center text-gray-400 py-12 text-sm">No se encontraron clientes.</p>
                : paginados.map((c, idx) => {
                    const sinConsumo = c.tuvo_consumo === "No";
                    const vsAnt = Number(c.vsMesAnterior?.variacion_abs ?? 0);
                    return (
                      <div key={c.codigo_cliente}
                        className={`p-4 ${sinConsumo ? "bg-red-900/30 border-l-4 border-red-500/60" : idx % 2 === 0 ? "bg-[#013d32]" : "bg-[#014f3e]"}`}>
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
                              {c.vsMesAnterior?.variacion_porc && <span className="ml-1 opacity-70 text-[10px]">({c.vsMesAnterior.variacion_porc})</span>}
                            </p>
                          </div>
                          <div>
                            <p className="text-[10px] text-gray-500 uppercase tracking-wide">Cant. Actual</p>
                            <p className="text-blue-300 font-semibold">{c.cantidad_productos}</p>
                          </div>
                          <div>
                            <p className="text-[10px] text-gray-500 uppercase tracking-wide">Max Consumo</p>
                            <p className="text-amber-300 font-semibold">${fmt(Number(c.max_consumo))}</p>
                          </div>
                          <div>
                            <p className="text-[10px] text-gray-500 uppercase tracking-wide">Tipo Negocio</p>
                            <p className="text-gray-300 truncate">{c.tipo_negocio || "—"}</p>
                          </div>
                          <div>
                            <p className="text-[10px] text-gray-500 uppercase tracking-wide">Teléfono</p>
                            <p className="text-gray-300">{c.telefono_cliente || "—"}</p>
                          </div>
                        </div>
                        <div className="flex items-center justify-between mt-1">
                          {c.direccion_entrega
                            ? <p className="text-[11px] text-gray-500 truncate flex-1">📍 {c.direccion_entrega}</p>
                            : <span />}
                          <p className="text-[10px] text-gray-500 shrink-0 ml-2">
                            {c.ultima_factura ? new Date(c.ultima_factura).toLocaleDateString("es-EC") : "—"}
                          </p>
                        </div>
                      </div>
                    );
                  })
              }
            </div>

            {/* ── DESKTOP: tabla ── */}
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
                    ? <tr><td colSpan={14} className="px-4 py-12 text-center text-gray-400 text-sm">No se encontraron clientes.</td></tr>
                    : paginados.map((c, idx) => {
                        const sinConsumo = c.tuvo_consumo === "No";
                        const vsAnt = Number(c.vsMesAnterior?.variacion_abs ?? 0);
                        return (
                          <tr key={c.codigo_cliente}
                            className={`${sinConsumo ? "bg-[rgba(220,38,38,0.5)]" : idx % 2 === 0 ? "bg-[#013d32]" : "bg-[#014f3e]"} hover:bg-[#016a57] transition`}>
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
                            <td className="px-3 py-2 text-right text-gray-400 text-xs whitespace-nowrap">
                              {c.ultima_factura ? new Date(c.ultima_factura).toLocaleDateString("es-EC") : "—"}
                            </td>
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
        )}
      </div>
    </DashboardLayout>
  );
};

export default DetalleDescartableOdooPage;
