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

interface ClienteTipo {
  codigo_cliente: string;
  nombre_cliente: string;
  tipo_negocio: string;
  telefono: string;
  cantidad_actual: number;
  consumo_actual: number;
  consumo_anterior: number;
  ultima_factura: string | null;
  total_sucursales: number;
}

const POR_PAGINA = 60;

export default function VipClientesPorTipoPage() {
  const { tipo, anio, mes } = useParams<{ tipo: string; anio: string; mes: string }>();
  const navigate = useNavigate();
  const tipoDecoded = decodeURIComponent(tipo || "");

  const [clientes,   setClientes]   = useState<ClienteTipo[]>([]);
  const [cargando,   setCargando]   = useState(true);
  const [busqueda,   setBusqueda]   = useState("");
  const [filtro,     setFiltro]     = useState<"todos" | "con" | "sin">("todos");
  const [pagina,     setPagina]     = useState(1);
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: "asc" | "desc" }>({
    key: "consumo_actual", direction: "desc",
  });

  useEffect(() => {
    setCargando(true);
    fetch(`${API_BASE_URL}/api/botellones/vip-clientes-tipo?tipo=${encodeURIComponent(tipoDecoded)}&anio=${anio}&mes=${mes}`)
      .then(r => r.json())
      .then(data => setClientes(data.clientes || []))
      .catch(console.error)
      .finally(() => setCargando(false));
  }, [tipo, anio, mes]);

  const requestSort = (key: string) => {
    const dir = sortConfig.key === key && sortConfig.direction === "asc" ? "desc" : "asc";
    setSortConfig({ key, direction: dir });
    setClientes(prev => [...prev].sort((a, b) => {
      const av: any = key === "vsAnt"
        ? (Number((a as any).consumo_actual) - Number((a as any).consumo_anterior))
        : (a as any)[key];
      const bv: any = key === "vsAnt"
        ? (Number((b as any).consumo_actual) - Number((b as any).consumo_anterior))
        : (b as any)[key];
      const an = Number(String(av).replace(",",".")), bn = Number(String(bv).replace(",","."));
      if (Number.isFinite(an) && Number.isFinite(bn)) return dir === "asc" ? an - bn : bn - an;
      return dir === "asc" ? String(av).localeCompare(String(bv)) : String(bv).localeCompare(String(av));
    }));
  };
  const sa = (k: string) => sortConfig.key === k ? (sortConfig.direction === "asc" ? " ↑" : " ↓") : " ↕";

  const filtrados = clientes.filter(c => {
    const q = busqueda.toLowerCase();
    const matchQ = !q || c.nombre_cliente?.toLowerCase().includes(q) || c.codigo_cliente?.toLowerCase().includes(q);
    const matchF = filtro === "todos" ? true : filtro === "con"
      ? Number(c.consumo_actual) > 0
      : Number(c.consumo_actual) === 0;
    return matchQ && matchF;
  });
  const totalPags = Math.ceil(filtrados.length / POR_PAGINA);
  const paginados = filtrados.slice((pagina - 1) * POR_PAGINA, pagina * POR_PAGINA);

  const totalMonto   = filtrados.reduce((a, c) => a + Number(c.consumo_actual), 0);
  const totalAnt     = filtrados.reduce((a, c) => a + Number(c.consumo_anterior), 0);
  const totalUnid    = filtrados.reduce((a, c) => a + Number(c.cantidad_actual), 0);
  const conConsumo   = filtrados.filter(c => Number(c.consumo_actual) > 0).length;

  const exportar = () => {
    const datos = filtrados.map((c, i) => ({
      "N°": i + 1, Código: c.codigo_cliente, Cliente: c.nombre_cliente,
      "Tipo Negocio": c.tipo_negocio, Teléfono: c.telefono,
      "Sucursales": c.total_sucursales,
      "Cant. Actual": Number(c.cantidad_actual),
      "Consumo Actual ($)": Number(c.consumo_actual),
      "Consumo Anterior ($)": Number(c.consumo_anterior),
      "VS Mes Ant ($)": Number(c.consumo_actual) - Number(c.consumo_anterior),
      "Última Factura": c.ultima_factura || "—",
      "Estado": Number(c.consumo_actual) > 0 ? "Activo" : "Sin consumo",
    }));
    const ws = XLSX.utils.json_to_sheet(datos);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "VIP Clientes");
    XLSX.writeFile(wb, `vip_${tipoDecoded}_${anio}_${mes}.xlsx`);
  };

  const Paginacion = () => totalPags > 1 ? (
    <div className="flex items-center justify-between px-4 py-3 border-t border-[#046C5E]/30 flex-wrap gap-2">
      <span className="text-xs text-gray-400">
        {(pagina - 1) * POR_PAGINA + 1}–{Math.min(pagina * POR_PAGINA, filtrados.length)} de {filtrados.length}
      </span>
      <div className="flex gap-1 flex-wrap">
        <button disabled={pagina === 1} onClick={() => setPagina(1)}
          className="px-2 py-1 text-xs rounded bg-[#014434] disabled:opacity-30 hover:bg-[#016a57]">«</button>
        <button disabled={pagina === 1} onClick={() => setPagina(p => p - 1)}
          className="px-3 py-1 text-xs rounded bg-[#014434] disabled:opacity-30 hover:bg-[#016a57]">‹ Ant</button>
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
        <button disabled={pagina === totalPags} onClick={() => setPagina(p => p + 1)}
          className="px-3 py-1 text-xs rounded bg-[#014434] disabled:opacity-30 hover:bg-[#016a57]">Sig ›</button>
        <button disabled={pagina === totalPags} onClick={() => setPagina(totalPags)}
          className="px-2 py-1 text-xs rounded bg-[#014434] disabled:opacity-30 hover:bg-[#016a57]">»</button>
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
            <button onClick={() => navigate(-1)}
              className="text-xs text-gray-400 hover:text-white mb-1 flex items-center gap-1 transition">
              ← Volver a módulos
            </button>
            <h1 className="text-xl md:text-2xl font-bold tracking-tight">{tipoDecoded}</h1>
            <p className="text-xs text-gray-400">VIP Botellón · {MESES[Number(mes)]} {anio}</p>
          </div>
          <button onClick={exportar}
            className="flex items-center gap-2 px-4 py-2 rounded-lg border border-[#0db48b]/60 bg-[#0db48b]/20 text-white font-semibold hover:bg-[#0db48b]/30 transition-all self-start sm:self-auto">
            <BsDownload size={16} /> Exportar Excel
          </button>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          {[
            { label: "Total Clientes",  value: filtrados.length.toLocaleString("es-EC"),  color: "text-white"       },
            { label: "Con Consumo",     value: conConsumo.toLocaleString("es-EC"),         color: "text-emerald-400" },
            { label: "Unidades",        value: totalUnid.toLocaleString("es-EC"),          color: "text-blue-300"    },
            { label: "Dólares Actual",  value: `$${fmt(totalMonto)}`,                     color: "text-amber-300"   },
          ].map(k => (
            <div key={k.label}
              className="bg-gradient-to-br from-[#012E24] to-[#013d30] border border-[#046C5E]/40 rounded-xl p-3 text-center">
              <p className="text-[10px] uppercase tracking-widest text-gray-400 mb-1">{k.label}</p>
              <p className={`text-xl font-extrabold ${k.color}`}>{k.value}</p>
            </div>
          ))}
        </div>

        {/* VS Mes anterior */}
        {!cargando && totalAnt > 0 && (() => {
          const varAbs = totalMonto - totalAnt;
          return (
            <div className={`flex items-center gap-3 mb-5 px-4 py-3 rounded-xl border text-sm font-semibold
              ${varAbs >= 0
                ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-300"
                : "bg-red-500/10 border-red-500/30 text-red-300"}`}>
              <span>{varAbs >= 0 ? "▲" : "▼"}</span>
              <span>
                VS mes anterior: {varAbs >= 0 ? "+" : ""}${fmt(Math.abs(varAbs))}
                &nbsp;·&nbsp; Mes anterior: ${fmt(totalAnt)}
              </span>
            </div>
          );
        })()}

        {/* Filtros */}
        <div className="flex flex-wrap gap-3 mb-4">
          <div className="relative flex-1 min-w-[180px]">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none"
              fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 1 0 5 11a6 6 0 0 0 12 0z"/>
            </svg>
            <input type="text" placeholder="Buscar cliente o código…" value={busqueda}
              onChange={e => { setBusqueda(e.target.value); setPagina(1); }}
              className="bg-[#012E24] border border-[#046C5E] rounded-lg px-3 py-2 pl-9 text-sm text-white placeholder-gray-500 w-full focus:outline-none focus:border-emerald-500/60"/>
          </div>
          <select value={filtro} onChange={e => { setFiltro(e.target.value as any); setPagina(1); }}
            className="bg-[#046C5E] px-3 py-2 rounded-lg text-sm font-medium">
            <option value="todos">Todos</option>
            <option value="con">Con consumo</option>
            <option value="sin">Sin consumo</option>
          </select>
        </div>

        {/* Loading */}
        {cargando && (
          <div className="flex flex-col justify-center items-center py-32 gap-4">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-emerald-400" />
            <p className="text-gray-400 text-sm">Cargando clientes…</p>
          </div>
        )}

        {/* Tabla */}
        {!cargando && (
          <div className="bg-gradient-to-br from-[#012E24] to-[#013d30] border border-[#046C5E]/30 rounded-2xl overflow-hidden mb-6">

            {/* MOBILE: cards */}
            <div className="md:hidden divide-y divide-[#046C5E]/20">
              {paginados.length === 0
                ? <p className="text-center text-gray-400 py-12 text-sm">No se encontraron clientes.</p>
                : paginados.map((c, idx) => {
                    const sinConsumo = Number(c.consumo_actual) === 0;
                    const vsAnt = Number(c.consumo_actual) - Number(c.consumo_anterior);
                    return (
                      <div key={c.codigo_cliente}
                        onClick={() => navigate(`/vip-botellon/cliente/${encodeURIComponent(c.codigo_cliente)}/${anio}/${mes}`)}
                        className={`p-4 cursor-pointer ${sinConsumo ? "bg-red-900/30 border-l-4 border-red-500/60" : idx % 2 === 0 ? "bg-[#013d32]" : "bg-[#014f3e]"}`}>
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex-1 min-w-0">
                            <p className="font-bold text-white text-sm truncate">{c.nombre_cliente}</p>
                            <p className="text-[11px] text-gray-400 font-mono">{c.codigo_cliente}</p>
                          </div>
                          <span className={`ml-2 shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full
                            ${sinConsumo ? "bg-red-500/30 text-red-300" : "bg-green-500/30 text-green-300"}`}>
                            {sinConsumo ? "Sin consumo" : "Activo"}
                          </span>
                        </div>
                        <div className="grid grid-cols-3 gap-x-3 gap-y-1.5 text-xs">
                          <div>
                            <p className="text-[9px] text-gray-500 uppercase">Consumo</p>
                            <p className="text-white font-bold">${fmt(Number(c.consumo_actual))}</p>
                          </div>
                          <div>
                            <p className="text-[9px] text-gray-500 uppercase">VS Mes Ant</p>
                            <p className={`font-bold ${vsAnt >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                              {vsAnt >= 0 ? "+" : ""}${fmt(Math.abs(vsAnt))}
                            </p>
                          </div>
                          <div>
                            <p className="text-[9px] text-gray-500 uppercase">Sucursales</p>
                            <p className="text-blue-300 font-semibold">{Number(c.total_sucursales)}</p>
                          </div>
                        </div>
                        <p className="text-[10px] text-emerald-400 mt-2 text-right">Ver sucursales →</p>
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
                      ["Teléfono",       "telefono"],
                      ["Sucursales",     "total_sucursales"],
                      ["Cant. Actual",   "cantidad_actual"],
                      ["Consumo Actual", "consumo_actual"],
                      ["VS Mes Ant",     "vsAnt"],
                      ["Últ. Factura",   "ultima_factura"],
                      ["Estado",         "estado"],
                    ] as [string,string][]).map(([label, key]) => (
                      <th key={key} onClick={() => requestSort(key)}
                        className="px-3 py-3 text-left cursor-pointer hover:text-white transition-colors whitespace-nowrap">
                        {label}<span className="ml-1 text-[#046C5E]">{sa(key)}</span>
                      </th>
                    ))}
                    <th className="px-3 py-3 text-center">Detalle</th>
                  </tr>
                </thead>
                <tbody>
                  {paginados.length === 0
                    ? <tr><td colSpan={12} className="px-4 py-12 text-center text-gray-400 text-sm">No se encontraron clientes.</td></tr>
                    : paginados.map((c, idx) => {
                        const sinConsumo = Number(c.consumo_actual) === 0;
                        const vsAnt = Number(c.consumo_actual) - Number(c.consumo_anterior);
                        return (
                          <tr key={c.codigo_cliente}
                            className={`${sinConsumo ? "bg-[rgba(220,38,38,0.5)]" : idx % 2 === 0 ? "bg-[#013d32]" : "bg-[#014f3e]"} hover:bg-[#016a57] transition`}>
                            <td className="px-3 py-2 text-gray-400 text-xs">{(pagina - 1) * POR_PAGINA + idx + 1}</td>
                            <td className="px-3 py-2 font-mono text-xs text-gray-300">{c.codigo_cliente}</td>
                            <td className="px-3 py-2 font-semibold text-white">{c.nombre_cliente}</td>
                            <td className="px-3 py-2 text-gray-300 text-xs">{c.telefono || "—"}</td>
                            <td className="px-3 py-2 text-center text-blue-300 font-semibold">{Number(c.total_sucursales)}</td>
                            <td className="px-3 py-2 text-right text-blue-300 font-semibold">{Number(c.cantidad_actual).toLocaleString("es-EC")}</td>
                            <td className="px-3 py-2 text-right font-bold text-white">${fmt(Number(c.consumo_actual))}</td>
                            <td className={`px-3 py-2 text-right font-bold ${vsAnt >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                              {vsAnt >= 0 ? "+" : ""}${fmt(Math.abs(vsAnt))}
                            </td>
                            <td className="px-3 py-2 text-right text-gray-400 text-xs whitespace-nowrap">
                              {c.ultima_factura ? new Date(c.ultima_factura).toLocaleDateString("es-EC") : "—"}
                            </td>
                            <td className="px-3 py-2 text-center">
                              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full
                                ${sinConsumo ? "bg-red-500/30 text-red-300" : "bg-green-500/30 text-green-300"}`}>
                                {sinConsumo ? "Sin consumo" : "Activo"}
                              </span>
                            </td>
                            <td className="px-3 py-2 text-center">
                              <button
                                onClick={() => navigate(`/vip-botellon/cliente/${encodeURIComponent(c.codigo_cliente)}/${anio}/${mes}`)}
                                className="text-[10px] text-emerald-400 hover:text-white border border-emerald-400/30 hover:border-emerald-400 px-2 py-0.5 rounded transition">
                                Ver sucursales →
                              </button>
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
}
