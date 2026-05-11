// pages/pagesCafe/DetalleClientesCafePage.tsx
import React, { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import * as XLSX from "xlsx";
import { BsDownload, BsCupHot } from "react-icons/bs";
import DashboardLayout from "../../layout/DashboardLayout";
import { Header } from "../../components/common/Header";
import { API_BASE_URL } from "../../config";

const fmt = (n: number) =>
  n.toLocaleString("es-EC", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const MESES = ["","Enero","Febrero","Marzo","Abril","Mayo","Junio",
  "Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];

type Cliente = {
  codigo_cliente: string | number;
  codigo_direccion: string | null;
  nombre_cliente: string;
  nombre_sucursal: string | null;
  direccion_entrega: string;
  tipo_negocio: string;
  telefono_cliente: string;
  latitud_cliente: string;
  longitud_cliente: string;
  cantidad_productos: number;
  consumo_actual: string;
  ultima_factura: string | null;
  tuvo_consumo: "Sí" | "No";
  vsMesAnterior: { monto_anterior: string; variacion_abs: string; variacion_porc: string };
};

type Resumen = { totalClientes: number; totalDirecciones: number; clientesConConsumo: number; clientesSinConsumo: number };
type Producto = { producto: string; unidades_vendidas: number; monto_usd: number };
type ProductoSucursal = { producto: string; unidades_vendidas: number; monto_usd: number };

type ClienteAgrupado = {
  codigo_cliente: string | number;
  nombre_cliente: string;
  tipo_negocio: string;
  num_sucursales: number;
  sucursales_con_consumo: number;
  cantidad_productos: number;
  consumo_actual: number;
  consumo_anterior: number;
  variacion_abs: number;
  variacion_porc: number;
  ultima_factura: string | null;
  tuvo_consumo: "Sí" | "No";
  sucursales: Cliente[];
};

const POR_PAGINA = 60;

const DetalleClientesCafePage: React.FC = () => {
  const { anio, mes } = useParams<{ anio: string; mes: string }>();
  const navigate = useNavigate();

  const [clientes,   setClientes]   = useState<Cliente[]>([]);
  const [resumen,    setResumen]    = useState<Resumen | null>(null);
  const [productos,  setProductos]  = useState<Producto[]>([]);
  const [cargando,   setCargando]   = useState(false);
  const [busqueda,   setBusqueda]   = useState("");
  const [filtro,     setFiltro]     = useState<"Todos" | "Sí" | "No">("Todos");
  const [pagina,     setPagina]     = useState(1);
  const [sortConfig, setSortConfig] = useState<{ key: keyof ClienteAgrupado; direction: "asc" | "desc" }>({ key: "consumo_actual", direction: "desc" });
  const [sortProd,   setSortProd]   = useState<{ key: keyof Producto | "precio_promedio"; direction: "asc" | "desc" }>({ key: "monto_usd", direction: "desc" });
  const [expanded,    setExpanded]    = useState<Set<string>>(new Set());
  const [expandedSuc, setExpandedSuc] = useState<Set<string>>(new Set());
  const [sucursalProds, setSucursalProds] = useState<Map<string, ProductoSucursal[] | undefined>>(new Map());

  if (!anio || !mes) return <div className="text-white p-10">Parámetros inválidos.</div>;

  const requestSort = (key: keyof ClienteAgrupado) => {
    const dir = sortConfig.key === key && sortConfig.direction === "desc" ? "asc" : "desc";
    setSortConfig({ key, direction: dir });
  };

  const sa = (k: keyof ClienteAgrupado) => sortConfig.key === k ? (sortConfig.direction === "asc" ? " ↑" : " ↓") : " ↕";

  const toggleExpand = (codigo: string | number) => {
    const k = String(codigo);
    setExpanded(prev => {
      const next = new Set(prev);
      next.has(k) ? next.delete(k) : next.add(k);
      return next;
    });
  };

  const toggleSucursal = async (s: Cliente) => {
    const key = `${s.codigo_cliente}__${s.codigo_direccion ?? ""}`;
    setExpandedSuc(prev => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
    if (!sucursalProds.has(key)) {
      setSucursalProds(prev => new Map(prev).set(key, undefined));
      try {
        const p = new URLSearchParams({
          anio: String(anio),
          mes: String(mes),
          customerCode: String(s.codigo_cliente),
        });
        if (s.codigo_direccion) p.set("addressCode", String(s.codigo_direccion));
        const r = await fetch(`${API_BASE_URL}/api/cafe/sucursal-productos?${p}`);
        const j = await r.json();
        setSucursalProds(prev => new Map(prev).set(key, j.ok ? (j.productos as ProductoSucursal[]) : []));
      } catch {
        setSucursalProds(prev => new Map(prev).set(key, []));
      }
    }
  };

  const requestSortProd = (key: keyof Producto | "precio_promedio") => {
    const dir = sortProd.key === key && sortProd.direction === "asc" ? "desc" : "asc";
    setSortProd({ key, direction: dir });
  };
  const saProd = (k: string) => sortProd.key === k ? (sortProd.direction === "asc" ? " ↑" : " ↓") : " ↕";

  const productosOrdenados = [...productos].sort((a, b) => {
    const get = (p: Producto) => {
      if (sortProd.key === "precio_promedio") {
        const u = Number(p.unidades_vendidas);
        return u > 0 ? Number(p.monto_usd) / u : 0;
      }
      const v = p[sortProd.key];
      return typeof v === "number" ? v : Number(v);
    };
    if (sortProd.key === "producto") {
      return sortProd.direction === "asc"
        ? String(a.producto).localeCompare(String(b.producto))
        : String(b.producto).localeCompare(String(a.producto));
    }
    const av = get(a), bv = get(b);
    return sortProd.direction === "asc" ? av - bv : bv - av;
  });

  useEffect(() => {
    setCargando(true);
    fetch(`${API_BASE_URL}/api/cafe/clientes?anio=${anio}&mes=${mes}`)
      .then(r => r.json())
      .then(data => {
        setClientes(data.clientes || []);
        setResumen(data.resumen);
        setProductos(data.productosVendidos || []);
        setPagina(1);
        setExpanded(new Set());
        setExpandedSuc(new Set());
        setSucursalProds(new Map());
      })
      .catch(console.error)
      .finally(() => setCargando(false));
  }, [anio, mes]);

  // Agrupar sucursales por codigo_cliente
  const clientesAgrupados = useMemo<ClienteAgrupado[]>(() => {
    const map = new Map<string, ClienteAgrupado>();
    for (const s of clientes) {
      const k = String(s.codigo_cliente);
      let g = map.get(k);
      if (!g) {
        g = {
          codigo_cliente: s.codigo_cliente,
          nombre_cliente: s.nombre_cliente,
          tipo_negocio: s.tipo_negocio,
          num_sucursales: 0,
          sucursales_con_consumo: 0,
          cantidad_productos: 0,
          consumo_actual: 0,
          consumo_anterior: 0,
          variacion_abs: 0,
          variacion_porc: 0,
          ultima_factura: null,
          tuvo_consumo: "No",
          sucursales: [],
        };
        map.set(k, g);
      }
      g.num_sucursales += 1;
      if (s.tuvo_consumo === "Sí") g.sucursales_con_consumo += 1;
      g.cantidad_productos += Number(s.cantidad_productos) || 0;
      g.consumo_actual     += Number(s.consumo_actual)      || 0;
      g.consumo_anterior   += Number(s.vsMesAnterior?.monto_anterior) || 0;
      if (s.ultima_factura && (!g.ultima_factura || s.ultima_factura > g.ultima_factura)) {
        g.ultima_factura = s.ultima_factura;
      }
      g.sucursales.push(s);
    }
    return Array.from(map.values()).map(g => {
      g.variacion_abs  = g.consumo_actual - g.consumo_anterior;
      g.variacion_porc = g.consumo_anterior > 0
        ? (g.variacion_abs / g.consumo_anterior) * 100
        : g.consumo_actual > 0 ? 100 : 0;
      g.tuvo_consumo = g.consumo_actual > 0 ? "Sí" : "No";
      return g;
    });
  }, [clientes]);

  const filtrados = useMemo(() => {
    const q = busqueda.toLowerCase();
    const arr = clientesAgrupados.filter(g => {
      if (filtro !== "Todos" && g.tuvo_consumo !== filtro) return false;
      if (!q) return true;
      return g.nombre_cliente?.toLowerCase().includes(q) ||
             String(g.codigo_cliente).toLowerCase().includes(q);
    });
    arr.sort((a, b) => {
      const av: any = a[sortConfig.key];
      const bv: any = b[sortConfig.key];
      if (typeof av === "number" && typeof bv === "number")
        return sortConfig.direction === "asc" ? av - bv : bv - av;
      return sortConfig.direction === "asc"
        ? String(av ?? "").localeCompare(String(bv ?? ""))
        : String(bv ?? "").localeCompare(String(av ?? ""));
    });
    return arr;
  }, [clientesAgrupados, busqueda, sortConfig, filtro]);

  const totalPags = Math.ceil(filtrados.length / POR_PAGINA);
  const paginados = filtrados.slice((pagina - 1) * POR_PAGINA, pagina * POR_PAGINA);

  const exportar = () => {
    const filas: any[] = [];
    let i = 0;
    filtrados.forEach(g => {
      g.sucursales.forEach(c => {
        i++;
        filas.push({
          "N°": i,
          Código: c.codigo_cliente,
          Cliente: c.nombre_cliente,
          "Cód. Dirección": c.codigo_direccion || "",
          Sucursal: c.nombre_sucursal || "",
          Dirección: c.direccion_entrega,
          "Tipo Negocio": c.tipo_negocio,
          Teléfono: c.telefono_cliente,
          Latitud: c.latitud_cliente,
          Longitud: c.longitud_cliente,
          "Cant. Actual": c.cantidad_productos,
          "Consumo Actual ($)": Number(c.consumo_actual),
          "VS Mes Ant": c.vsMesAnterior
            ? `${Number(c.vsMesAnterior.variacion_abs) > 0 ? "+" : ""}${Number(c.vsMesAnterior.variacion_abs).toFixed(2)} (${c.vsMesAnterior.variacion_porc})`
            : "",
          "Última Factura": c.ultima_factura || "—",
          "Tuvo Consumo": c.tuvo_consumo,
        });
      });
    });
    const ws = XLSX.utils.json_to_sheet(filas);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Cafe IIBC");
    XLSX.writeFile(wb, `clientes_cafe_iibc_${anio}_${mes}.xlsx`);
  };

  const Paginacion = () => totalPags > 1 ? (
    <div className="flex items-center justify-between px-4 py-3 border-t border-[#046C5E]/30 flex-wrap gap-2">
      <span className="text-xs text-gray-400">
        {(pagina - 1) * POR_PAGINA + 1}–{Math.min(pagina * POR_PAGINA, filtrados.length)} de {filtrados.length}
      </span>
      <div className="flex gap-1 flex-wrap">
        <button disabled={pagina === 1} onClick={() => setPagina(1)} className="px-2 py-1 text-xs rounded bg-[#014434] disabled:opacity-30 hover:bg-[#025940]">«</button>
        <button disabled={pagina === 1} onClick={() => setPagina(p => p - 1)} className="px-3 py-1 text-xs rounded bg-[#014434] disabled:opacity-30 hover:bg-[#025940]">‹ Ant</button>
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
              className={`px-3 py-1 text-xs rounded ${pagina === n ? "bg-emerald-600 font-bold" : "bg-[#014434] hover:bg-[#025940]"}`}>{n}</button>
          );
        })()}
        <button disabled={pagina === totalPags} onClick={() => setPagina(p => p + 1)} className="px-3 py-1 text-xs rounded bg-[#014434] disabled:opacity-30 hover:bg-[#025940]">Sig ›</button>
        <button disabled={pagina === totalPags} onClick={() => setPagina(totalPags)} className="px-2 py-1 text-xs rounded bg-[#014434] disabled:opacity-30 hover:bg-[#025940]">»</button>
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
            <h1 className="text-xl md:text-2xl font-bold tracking-tight">CAFÉ IIBC — Clientes</h1>
            <p className="text-xs text-gray-400">{MESES[Number(mes)]} {anio} · Facturación</p>
          </div>
          <button onClick={exportar}
            className="flex items-center gap-2 px-4 py-2 rounded-lg border border-[#0db48b]/60 bg-[#0db48b]/20 text-white font-semibold hover:bg-[#0db48b]/30 transition-all self-start sm:self-auto">
            <BsDownload size={16} /> Exportar Excel
          </button>
        </div>

        {/* Resumen */}
        {resumen && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 mb-6">
            {[
              { label: "Clientes únicos",  value: resumen.totalClientes,       color: "text-white" },
              { label: "Direcciones",       value: resumen.totalDirecciones,    color: "text-cyan-300" },
              { label: "Con consumo",       value: resumen.clientesConConsumo,  color: "text-green-400" },
              { label: "Sin consumo",       value: resumen.clientesSinConsumo,  color: "text-red-400" },
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
            <h2 className="text-sm font-bold uppercase tracking-wider text-cyan-300 px-4 py-3 border-b border-[#046C5E]/30">
              <BsCupHot className="inline mr-1.5 text-amber-400" size={13} /> Productos Vendidos
            </h2>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="bg-[#014434] text-[10px] uppercase text-green-300 select-none">
                    <th onClick={() => requestSortProd("producto")} className="px-4 py-3 text-left cursor-pointer hover:text-white transition-colors">
                      Producto<span className="ml-1 text-[#046C5E]">{saProd("producto")}</span>
                    </th>
                    <th onClick={() => requestSortProd("unidades_vendidas")} className="px-4 py-3 text-right cursor-pointer hover:text-white transition-colors">
                      Unidades<span className="ml-1 text-[#046C5E]">{saProd("unidades_vendidas")}</span>
                    </th>
                    <th onClick={() => requestSortProd("monto_usd")} className="px-4 py-3 text-right cursor-pointer hover:text-white transition-colors">
                      Dólares<span className="ml-1 text-[#046C5E]">{saProd("monto_usd")}</span>
                    </th>
                    <th onClick={() => requestSortProd("precio_promedio")} className="px-4 py-3 text-right cursor-pointer hover:text-white transition-colors">
                      Precio Promedio<span className="ml-1 text-[#046C5E]">{saProd("precio_promedio")}</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {productosOrdenados.map((p, idx) => {
                    const uni = Number(p.unidades_vendidas);
                    const usd = Number(p.monto_usd);
                    const prom = uni > 0 ? usd / uni : 0;
                    return (
                      <tr key={idx} className={`${idx % 2 === 0 ? "bg-[#013d32]" : "bg-[#014f3e]"} hover:bg-[#025940] transition-colors`}>
                        <td className="px-4 py-2">{p.producto}</td>
                        <td className="px-4 py-2 text-right text-cyan-400 font-semibold">{uni.toLocaleString("es-EC")}</td>
                        <td className="px-4 py-2 text-right text-blue-400 font-semibold">${fmt(usd)}</td>
                        <td className="px-4 py-2 text-right text-purple-400 font-semibold">${fmt(prom)}</td>
                      </tr>
                    );
                  })}
                  {(() => {
                    const totUni = productos.reduce((a, p) => a + Number(p.unidades_vendidas), 0);
                    const totUSD = productos.reduce((a, p) => a + Number(p.monto_usd), 0);
                    const promTotal = totUni > 0 ? totUSD / totUni : 0;
                    return (
                      <tr className="bg-[#014434] font-bold border-t border-[#046C5E]/30">
                        <td className="px-4 py-3 text-green-300 uppercase text-xs">Total</td>
                        <td className="px-4 py-3 text-right text-cyan-400">{totUni.toLocaleString("es-EC")}</td>
                        <td className="px-4 py-3 text-right text-blue-400">${fmt(totUSD)}</td>
                        <td className="px-4 py-3 text-right text-purple-300">${fmt(promTotal)}</td>
                      </tr>
                    );
                  })()}
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
            className="bg-[#046C5E] px-3 py-2 rounded-lg text-sm font-medium text-white">
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
          <div className="bg-gradient-to-br from-[#012E24] to-[#013d30] border border-[#046C5E]/40 rounded-2xl overflow-hidden mb-6 shadow-xl">

            {/* MOBILE: cards agrupadas */}
            <div className="md:hidden">
              {paginados.length === 0
                ? <p className="text-center text-gray-400 py-12 text-sm">No se encontraron clientes.</p>
                : <div className="space-y-3 p-3">
                    {paginados.map((g) => {
                      const sinConsumo = g.tuvo_consumo === "No";
                      const vsAnt = g.variacion_abs;
                      const isOpen = expanded.has(String(g.codigo_cliente));
                      return (
                        <div key={String(g.codigo_cliente)}
                          className="bg-gradient-to-br from-[#013d30] to-[#012E24] border border-[#046C5E]/40 rounded-xl overflow-hidden">
                          <div className="p-4 cursor-pointer" onClick={() => toggleExpand(g.codigo_cliente)}>
                            <div className="flex items-start justify-between mb-3">
                              <div className="flex-1 min-w-0 pr-2">
                                <div className="flex items-center gap-2 mb-0.5">
                                  <span className={`text-[10px] transition-transform duration-200 ${isOpen ? "rotate-90" : ""} text-white/40`}>▶</span>
                                  <p className="text-[11px] text-white/40 font-mono">{g.codigo_cliente}</p>
                                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-cyan-500/15 border border-cyan-500/30 text-cyan-300">
                                    {g.num_sucursales} sucursal{g.num_sucursales !== 1 ? "es" : ""}
                                  </span>
                                </div>
                                <p className="font-bold text-white text-sm truncate">{g.nombre_cliente}</p>
                              </div>
                              <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded border text-[10px] font-semibold shrink-0
                                ${sinConsumo ? "text-red-400 bg-red-500/15 border-red-500/30" : "text-green-400 bg-green-500/15 border-green-500/30"}`}>
                                <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${sinConsumo ? "bg-red-500" : "bg-green-500"}`}/>
                                {sinConsumo ? "Sin consumo" : "Activo"}
                              </span>
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                              <div className="text-center">
                                <p className="text-[9px] text-white/40 uppercase">Consumo</p>
                                <p className="text-sm font-bold text-blue-400">${fmt(g.consumo_actual)}</p>
                              </div>
                              <div className="text-center">
                                <p className="text-[9px] text-white/40 uppercase">VS Mes Ant</p>
                                <p className={`text-sm font-bold ${vsAnt >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                                  {vsAnt >= 0 ? "+" : ""}${fmt(Math.abs(vsAnt))}
                                </p>
                              </div>
                              <div className="text-center">
                                <p className="text-[9px] text-white/40 uppercase">Cant.</p>
                                <p className="text-sm font-bold text-green-400">{g.cantidad_productos}</p>
                              </div>
                              <div className="text-center">
                                <p className="text-[9px] text-white/40 uppercase">Tipo</p>
                                <p className="text-xs text-white/60 truncate">{g.tipo_negocio || "—"}</p>
                              </div>
                            </div>
                          </div>
                          {isOpen && (
                            <div className="border-t border-[#046C5E]/30 bg-[#011f17] p-2 space-y-2">
                              {g.sucursales.map(s => {
                                const sinC = s.tuvo_consumo === "No";
                                const vs = Number(s.vsMesAnterior?.variacion_abs ?? 0);
                                const sKey = `${s.codigo_cliente}__${s.codigo_direccion ?? ""}`;
                                const sucOpen = expandedSuc.has(sKey);
                                const prods = sucursalProds.get(sKey);
                                return (
                                  <div key={`${s.codigo_cliente}_${s.codigo_direccion}`}
                                    className="bg-[#012920] border border-[#046C5E]/20 rounded-lg overflow-hidden">
                                    <div className="p-3 cursor-pointer" onClick={() => toggleSucursal(s)}>
                                      <div className="flex items-start justify-between mb-2">
                                        <div className="flex-1 min-w-0 pr-2">
                                          <div className="flex items-center gap-2">
                                            <span className={`text-[9px] text-white/40 transition-transform ${sucOpen ? "rotate-90" : ""}`}>▶</span>
                                            <p className="text-[11px] text-cyan-500/70 font-mono">{s.codigo_direccion || "—"}</p>
                                          </div>
                                          <p className="text-xs font-semibold text-white truncate">{s.nombre_sucursal || "—"}</p>
                                          <p className="text-[11px] text-white/60 truncate">{s.direccion_entrega || "—"}</p>
                                        </div>
                                        <span className={`text-[9px] px-1.5 py-0.5 rounded border shrink-0
                                          ${sinC ? "text-red-400 bg-red-500/15 border-red-500/30" : "text-green-400 bg-green-500/15 border-green-500/30"}`}>
                                          {sinC ? "Sin consumo" : "Activo"}
                                        </span>
                                      </div>
                                      <div className="grid grid-cols-3 gap-2 text-[10px]">
                                        <div className="text-center">
                                          <p className="text-white/40 uppercase">Consumo</p>
                                          <p className="font-bold text-blue-400">${fmt(Number(s.consumo_actual))}</p>
                                        </div>
                                        <div className="text-center">
                                          <p className="text-white/40 uppercase">VS Ant</p>
                                          <p className={`font-bold ${vs >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                                            {vs >= 0 ? "+" : ""}${fmt(Math.abs(vs))}
                                          </p>
                                        </div>
                                        <div className="text-center">
                                          <p className="text-white/40 uppercase">Últ. Fact.</p>
                                          <p className="text-white/60">{s.ultima_factura ? new Date(s.ultima_factura).toLocaleDateString("es-EC") : "—"}</p>
                                        </div>
                                      </div>
                                    </div>
                                    {sucOpen && (
                                      <div className="border-t border-[#046C5E]/20 bg-[#010d0a] p-3">
                                        <p className="text-[10px] uppercase tracking-wider text-emerald-400/70 mb-2">Productos</p>
                                        {prods === undefined ? (
                                          <div className="flex justify-center py-2">
                                            <div className="animate-spin h-4 w-4 border-2 border-emerald-400/20 border-t-emerald-400 rounded-full" />
                                          </div>
                                        ) : prods.length === 0 ? (
                                          <p className="text-center text-white/30 italic py-2 text-[11px]">Sin productos en este período</p>
                                        ) : (
                                          <div className="space-y-1">
                                            {prods.map((p, pi) => (
                                              <div key={pi} className="flex justify-between items-center text-[11px] border-b border-[#046C5E]/10 pb-1">
                                                <span className="text-white/80 flex-1 truncate pr-2">{p.producto}</span>
                                                <span className="text-green-400 font-bold tabular-nums shrink-0 w-14 text-right">{Number(p.unidades_vendidas).toLocaleString("es-EC")}</span>
                                                <span className="text-blue-400 font-bold tabular-nums shrink-0 w-20 text-right">${fmt(Number(p.monto_usd))}</span>
                                              </div>
                                            ))}
                                            <div className="flex justify-between items-center text-[11px] font-bold pt-1">
                                              <span className="text-emerald-400/60 uppercase">{prods.length} producto{prods.length !== 1 ? "s" : ""}</span>
                                              <span className="text-green-400 tabular-nums w-14 text-right">
                                                {prods.reduce((a, p) => a + Number(p.unidades_vendidas), 0).toLocaleString("es-EC")}
                                              </span>
                                              <span className="text-blue-400 tabular-nums w-20 text-right">
                                                ${fmt(prods.reduce((a, p) => a + Number(p.monto_usd), 0))}
                                              </span>
                                            </div>
                                          </div>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
              }
            </div>

            {/* DESKTOP: tabla agrupada con sucursales expandibles */}
            <div className="hidden md:block overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="bg-[#014434] text-[10px] uppercase text-green-300 select-none">
                    <th className="px-3 py-3 text-left w-8"></th>
                    <th className="px-3 py-3 text-left">N°</th>
                    {([
                      ["Código",          "codigo_cliente"],
                      ["Cliente",         "nombre_cliente"],
                      ["Tipo Negocio",    "tipo_negocio"],
                      ["Cant. Actual",    "cantidad_productos"],
                      ["Consumo Actual",  "consumo_actual"],
                      ["VS Mes Ant",      "variacion_abs"],
                      ["Últ. Factura",    "ultima_factura"],
                      ["Estado",          "tuvo_consumo"],
                    ] as [string, keyof ClienteAgrupado][]).map(([label, key]) => (
                      <th key={key} onClick={() => requestSort(key)}
                        className="px-3 py-3 text-left cursor-pointer hover:text-white transition-colors whitespace-nowrap">
                        {label}<span className="ml-1 text-[#046C5E]">{sa(key)}</span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {paginados.length === 0
                    ? <tr><td colSpan={10} className="px-4 py-12 text-center text-gray-400 text-sm">No se encontraron clientes.</td></tr>
                    : paginados.map((g, idx) => {
                        const sinConsumo = g.tuvo_consumo === "No";
                        const vsAnt = g.variacion_abs;
                        const isOpen = expanded.has(String(g.codigo_cliente));
                        return (
                          <React.Fragment key={String(g.codigo_cliente)}>
                            <tr
                              onClick={() => toggleExpand(g.codigo_cliente)}
                              className={`transition-colors cursor-pointer ${idx % 2 === 0 ? "bg-[#013d32]" : "bg-[#014f3e]"} hover:bg-[#025940]`}>
                              <td className="px-3 py-2 text-center">
                                <span className={`inline-block text-[10px] text-white/60 transition-transform duration-200 ${isOpen ? "rotate-90" : ""}`}>▶</span>
                              </td>
                              <td className="px-3 py-2 text-white/30 text-xs">{(pagina - 1) * POR_PAGINA + idx + 1}</td>
                              <td className="px-3 py-2 font-mono text-xs text-white/40">{g.codigo_cliente}</td>
                              <td className="px-3 py-2">
                                <div className="flex items-center gap-2">
                                  <span className="font-semibold text-white">{g.nombre_cliente}</span>
                                  {g.num_sucursales > 1 && (
                                    <span
                                      title={`${g.sucursales_con_consumo} con consumo`}
                                      className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 whitespace-nowrap">
                                      {g.num_sucursales} suc.
                                    </span>
                                  )}
                                </div>
                              </td>
                              <td className="px-3 py-2 text-white/50 text-xs">{g.tipo_negocio || "—"}</td>
                              <td className="px-3 py-2 text-right text-green-400 font-semibold tabular-nums">{g.cantidad_productos}</td>
                              <td className="px-3 py-2 text-right font-bold text-white tabular-nums">${fmt(g.consumo_actual)}</td>
                              <td className={`px-3 py-2 text-right font-bold tabular-nums ${vsAnt >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                                {vsAnt >= 0 ? "+" : ""}${fmt(Math.abs(vsAnt))}
                                <span className="block text-[10px] opacity-70">
                                  {g.variacion_porc >= 0 ? "+" : ""}{g.variacion_porc.toFixed(2)}%
                                </span>
                              </td>
                              <td className="px-3 py-2 text-right text-white/40 text-xs whitespace-nowrap">
                                {g.ultima_factura ? new Date(g.ultima_factura).toLocaleDateString("es-EC") : "—"}
                              </td>
                              <td className="px-3 py-2 text-center">
                                <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded border text-[10px] font-semibold
                                  ${sinConsumo ? "text-red-400 bg-red-500/15 border-red-500/30" : "text-green-400 bg-green-500/15 border-green-500/30"}`}>
                                  <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${sinConsumo ? "bg-red-500" : "bg-green-500"}`}/>
                                  {sinConsumo ? "Sin consumo" : "Activo"}
                                </span>
                              </td>
                            </tr>
                            {isOpen && (
                              <tr className="bg-[#011f17]">
                                <td colSpan={10} className="p-0">
                                  <table className="w-full text-xs">
                                    <thead>
                                      <tr className="bg-[#012018] text-[10px] uppercase text-emerald-400/70">
                                        <th className="pl-12 pr-3 py-2 text-left">Cód. Dir.</th>
                                        <th className="px-3 py-2 text-left">Sucursal</th>
                                        <th className="px-3 py-2 text-left">Dirección</th>
                                        <th className="px-3 py-2 text-left">Teléfono</th>
                                        <th className="px-3 py-2 text-left">Lat / Lng</th>
                                        <th className="px-3 py-2 text-right">Cant.</th>
                                        <th className="px-3 py-2 text-right">Consumo</th>
                                        <th className="px-3 py-2 text-right">VS Mes Ant</th>
                                        <th className="px-3 py-2 text-right">Últ. Factura</th>
                                        <th className="px-3 py-2 text-center">Estado</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {g.sucursales.map((s, sidx) => {
                                        const sinC = s.tuvo_consumo === "No";
                                        const vs = Number(s.vsMesAnterior?.variacion_abs ?? 0);
                                        const hasCoords = s.latitud_cliente && s.longitud_cliente && s.latitud_cliente !== "—";
                                        const sKey = `${s.codigo_cliente}__${s.codigo_direccion ?? ""}`;
                                        const sucOpen = expandedSuc.has(sKey);
                                        const prods = sucursalProds.get(sKey);
                                        return (
                                          <React.Fragment key={`${s.codigo_cliente}_${s.codigo_direccion}_${sidx}`}>
                                            <tr
                                              onClick={() => toggleSucursal(s)}
                                              className={`border-t border-[#046C5E]/10 cursor-pointer hover:bg-[#01433a]/60 ${sidx % 2 === 0 ? "bg-[#012920]" : "bg-[#013025]"}`}>
                                              <td className="pl-12 pr-3 py-1.5 font-mono text-cyan-500/70">
                                                <span className={`inline-block mr-2 text-[9px] text-white/40 transition-transform duration-200 ${sucOpen ? "rotate-90" : ""}`}>▶</span>
                                                {s.codigo_direccion || "—"}
                                              </td>
                                              <td className="px-3 py-1.5 text-white/80 font-medium max-w-[200px]">
                                                <span title={s.nombre_sucursal || ""} className="line-clamp-2">{s.nombre_sucursal || "—"}</span>
                                              </td>
                                              <td className="px-3 py-1.5 text-white/70 max-w-[260px]">
                                                <span title={s.direccion_entrega} className="line-clamp-2">{s.direccion_entrega || "—"}</span>
                                              </td>
                                              <td className="px-3 py-1.5 text-white/50 whitespace-nowrap">{s.telefono_cliente || "—"}</td>
                                              <td className="px-3 py-1.5 text-white/40 whitespace-nowrap">
                                                {hasCoords
                                                  ? <a href={`https://maps.google.com/?q=${s.latitud_cliente},${s.longitud_cliente}`} target="_blank" rel="noreferrer"
                                                      onClick={(e) => e.stopPropagation()}
                                                      className="text-blue-400 hover:underline">Ver mapa</a>
                                                  : "—"}
                                              </td>
                                              <td className="px-3 py-1.5 text-right text-green-400 font-semibold tabular-nums">{s.cantidad_productos}</td>
                                              <td className="px-3 py-1.5 text-right font-bold text-white tabular-nums">${fmt(Number(s.consumo_actual))}</td>
                                              <td className={`px-3 py-1.5 text-right font-bold tabular-nums ${vs >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                                                {vs >= 0 ? "+" : ""}${fmt(Math.abs(vs))}
                                              </td>
                                              <td className="px-3 py-1.5 text-right text-white/40 whitespace-nowrap">
                                                {s.ultima_factura ? new Date(s.ultima_factura).toLocaleDateString("es-EC") : "—"}
                                              </td>
                                              <td className="px-3 py-1.5 text-center">
                                                <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded border text-[9px] font-semibold
                                                  ${sinC ? "text-red-400 bg-red-500/15 border-red-500/30" : "text-green-400 bg-green-500/15 border-green-500/30"}`}>
                                                  <span className={`w-1 h-1 rounded-full shrink-0 ${sinC ? "bg-red-500" : "bg-green-500"}`}/>
                                                  {sinC ? "Sin consumo" : "Activo"}
                                                </span>
                                              </td>
                                            </tr>
                                            {sucOpen && (
                                              <tr className="bg-[#010d0a]">
                                                <td colSpan={10} className="p-0 border-y border-[#046C5E]/20">
                                                  <div className="px-4 py-2 bg-[#011510]">
                                                    <p className="text-[10px] uppercase tracking-wider text-emerald-400/70">
                                                      Productos · {s.nombre_sucursal || s.codigo_direccion || s.nombre_cliente}
                                                    </p>
                                                  </div>
                                                  {prods === undefined ? (
                                                    <div className="flex justify-center py-3">
                                                      <div className="animate-spin h-4 w-4 border-2 border-emerald-400/20 border-t-emerald-400 rounded-full" />
                                                    </div>
                                                  ) : prods.length === 0 ? (
                                                    <p className="text-center text-white/30 italic py-3 text-xs">Sin productos en este período</p>
                                                  ) : (
                                                    <table className="w-full text-[11px]">
                                                      <thead>
                                                        <tr className="bg-[#011510] text-emerald-400/70 uppercase border-t border-[#046C5E]/20">
                                                          <th className="px-4 py-1.5 text-left font-semibold">Producto</th>
                                                          <th className="px-4 py-1.5 text-right font-semibold whitespace-nowrap">Unidades</th>
                                                          <th className="px-4 py-1.5 text-right font-semibold whitespace-nowrap">Ventas</th>
                                                        </tr>
                                                      </thead>
                                                      <tbody>
                                                        {prods.map((p, pi) => (
                                                          <tr key={pi} className={`border-t border-[#046C5E]/10 ${pi % 2 === 0 ? "bg-[#011a14]" : "bg-[#012018]"}`}>
                                                            <td className="px-4 py-1 text-white/80">{p.producto}</td>
                                                            <td className="px-4 py-1 text-right text-green-400 font-bold tabular-nums whitespace-nowrap">{Number(p.unidades_vendidas).toLocaleString("es-EC")}</td>
                                                            <td className="px-4 py-1 text-right text-blue-400 font-bold tabular-nums whitespace-nowrap">${fmt(Number(p.monto_usd))}</td>
                                                          </tr>
                                                        ))}
                                                      </tbody>
                                                      <tfoot>
                                                        <tr className="border-t border-[#046C5E]/30 bg-[#011510] font-bold">
                                                          <td className="px-4 py-1.5 text-emerald-400/60 uppercase text-[10px]">
                                                            {prods.length} producto{prods.length !== 1 ? "s" : ""}
                                                          </td>
                                                          <td className="px-4 py-1.5 text-right text-green-400 tabular-nums">
                                                            {prods.reduce((a, p) => a + Number(p.unidades_vendidas), 0).toLocaleString("es-EC")}
                                                          </td>
                                                          <td className="px-4 py-1.5 text-right text-blue-400 tabular-nums">
                                                            ${fmt(prods.reduce((a, p) => a + Number(p.monto_usd), 0))}
                                                          </td>
                                                        </tr>
                                                      </tfoot>
                                                    </table>
                                                  )}
                                                </td>
                                              </tr>
                                            )}
                                          </React.Fragment>
                                        );
                                      })}
                                    </tbody>
                                  </table>
                                </td>
                              </tr>
                            )}
                          </React.Fragment>
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

export default DetalleClientesCafePage;
