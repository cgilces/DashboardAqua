import React, { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import * as XLSX from "xlsx";
import { BsDownload } from "react-icons/bs";
import { MapPin } from "lucide-react";
import DashboardLayout from "../../layout/DashboardLayout";
import { Header } from "../../components/common/Header";
import { API_BASE_URL } from "../../config";

const fmt = (n: number) =>
  n.toLocaleString("es-EC", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const fmtFecha = (s: string | null | undefined): string => {
  if (!s) return "—";
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (!m) return s;
  return `${parseInt(m[3], 10)}/${parseInt(m[2], 10)}/${m[1]}`;
};

const MESES = ["","Enero","Febrero","Marzo","Abril","Mayo","Junio",
  "Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];

type Direccion = {
  codigo_cliente:    string | number;
  codigo_direccion:  string | null;
  nombre_cliente:    string;
  identificacion_cliente?: string | null;
  tipo_identificacion_cliente?: string | null;
  direccion_entrega: string;
  descripcion_direccion_cliente?: string;
  tipo_negocio:      string;
  telefono_cliente:  string;
  latitud_cliente:   string;
  longitud_cliente:  string;
  cantidad_productos: number;
  consumo_actual:    string;
  ultima_factura:    string | null;
  tuvo_consumo:      "Sí" | "No";
  vsMesAnterior:     { monto_anterior: string; variacion_abs: string; variacion_porc: string };
};

type ClienteAgrupado = {
  codigo_cliente:   string | number;
  nombre_cliente:   string;
  identificacion_cliente?: string | null;
  tipo_identificacion_cliente?: string | null;
  tipo_negocio:     string;
  telefono_cliente: string;
  consumo_actual:   number;
  consumo_anterior: number;
  cantidad_productos: number;
  variacion_abs:    number;
  variacion_porc:   number | null;
  ultima_factura:   string | null;
  total_direcciones: number;
  tuvo_consumo:     "Sí" | "No";
};

type Producto = { producto: string; unidades_vendidas: number; monto_usd: number };
type Resumen  = { totalClientes: number; totalDirecciones: number; clientesConConsumo: number; clientesSinConsumo: number };

const POR_PAGINA = 60;

const DetallePlusOdooPage: React.FC = () => {
  const { anio, mes } = useParams<{ anio: string; mes: string }>();
  const navigate = useNavigate();

  if (!anio || !mes) return <div className="text-white p-10">Parámetros inválidos.</div>;

  const [todasDirecciones, setTodasDirecciones] = useState<Direccion[]>([]);
  const [resumen,          setResumen]           = useState<Resumen | null>(null);
  const [productosGlobal,  setProductosGlobal]   = useState<Producto[]>([]);
  const [cargando,         setCargando]          = useState(false);

  const [clienteSeleccionado, setClienteSeleccionado] = useState<string | null>(null);
  const [clienteNombre,       setClienteNombre]       = useState<string>("");
  const [clienteIdentificacion, setClienteIdentificacion] = useState<string>("");

  const [expandedDir,    setExpandedDir]    = useState<Set<string>>(new Set());
  const [productosDirCache, setProductosDirCache] = useState<Map<string, Producto[] | undefined>>(new Map());

  const [busqueda,   setBusqueda]   = useState("");
  const [busquedaDir, setBusquedaDir] = useState("");
  const [filtro,     setFiltro]     = useState<"Todos" | "Sí" | "No">("Todos");
  const [pagina,     setPagina]     = useState(1);
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: "asc" | "desc" }>({
    key: "consumo_actual", direction: "desc",
  });
  const [sortDirConfig, setSortDirConfig] = useState<{ key: string; direction: "asc" | "desc" }>({
    key: "consumo_actual", direction: "desc",
  });

  useEffect(() => {
    setCargando(true);
    setClienteSeleccionado(null);
    setExpandedDir(new Set());
    setProductosDirCache(new Map());
    fetch(`${API_BASE_URL}/api/odoo/plus-clientes?anio=${anio}&mes=${mes}`)
      .then(r => r.json())
      .then(data => {
        const direcciones = (data.clientes || []).map((d: any) => ({
          ...d,
          descripcion_direccion_cliente: d.descripcion_direccion_cliente ?? d.direccion_entrega
        }));
        setTodasDirecciones(direcciones);
        setResumen(data.resumen || null);
        setProductosGlobal(data.productosVendidos || []);
        setPagina(1);
      })
      .catch(console.error)
      .finally(() => setCargando(false));
  }, [anio, mes]);

  const clientesAgrupados = useMemo((): ClienteAgrupado[] => {
    const mapa: Record<string, ClienteAgrupado> = {};
    todasDirecciones.forEach(d => {
      const key = String(d.codigo_cliente);
      if (!mapa[key]) {
        mapa[key] = {
          codigo_cliente:    d.codigo_cliente,
          nombre_cliente:    d.nombre_cliente,
          identificacion_cliente: d.identificacion_cliente || null,
          tipo_identificacion_cliente: d.tipo_identificacion_cliente || null,
          tipo_negocio:      d.tipo_negocio,
          telefono_cliente:  d.telefono_cliente,
          consumo_actual:    0,
          consumo_anterior:  0,
          cantidad_productos: 0,
          variacion_abs:     0,
          variacion_porc:    null,
          ultima_factura:    null,
          total_direcciones: 0,
          tuvo_consumo:      "No",
        };
      }
      const g = mapa[key];
      g.consumo_actual    += Number(d.consumo_actual)               || 0;
      g.consumo_anterior  += Number(d.vsMesAnterior?.monto_anterior) || 0;
      g.cantidad_productos += Number(d.cantidad_productos)           || 0;
      g.total_direcciones  += 1;
      if (d.tuvo_consumo === "Sí") g.tuvo_consumo = "Sí";
      if (d.ultima_factura && (!g.ultima_factura || d.ultima_factura > g.ultima_factura))
        g.ultima_factura = d.ultima_factura;
    });
    return Object.values(mapa).map(g => ({
      ...g,
      variacion_abs:  g.consumo_actual - g.consumo_anterior,
      variacion_porc: g.consumo_anterior > 0
        ? Number(((g.consumo_actual - g.consumo_anterior) / g.consumo_anterior * 100).toFixed(1))
        : null,
    })).sort((a, b) => b.consumo_actual - a.consumo_actual);
  }, [todasDirecciones]);

  const direccionesCliente = useMemo((): Direccion[] => {
    if (!clienteSeleccionado) return [];
    let lista = todasDirecciones.filter(d => String(d.codigo_cliente) === clienteSeleccionado);
    const q = busquedaDir.trim().toLowerCase();
    if (q) {
      lista = lista.filter(d => {
        const desc = (d.descripcion_direccion_cliente || d.direccion_entrega || "").toLowerCase();
        const cod  = String(d.codigo_direccion || "").toLowerCase();
        return desc.includes(q) || cod.includes(q);
      });
    }
    const { key, direction } = sortDirConfig;
    const getVal = (x: Direccion): any => {
      if (key === "variacion_abs")                 return Number(x.vsMesAnterior?.variacion_abs) || 0;
      if (key === "descripcion_direccion_cliente") return x.descripcion_direccion_cliente || x.direccion_entrega || "";
      return (x as any)[key] ?? "";
    };
    return [...lista].sort((a, b) => {
      const av = getVal(a), bv = getVal(b);
      const an = Number(av), bn = Number(bv);
      const esNum = av !== "" && bv !== "" && Number.isFinite(an) && Number.isFinite(bn);
      if (esNum) return direction === "asc" ? an - bn : bn - an;
      return direction === "asc"
        ? String(av).localeCompare(String(bv))
        : String(bv).localeCompare(String(av));
    });
  }, [todasDirecciones, clienteSeleccionado, busquedaDir, sortDirConfig]);

  const requestSortDir = (key: string) => {
    const dir = sortDirConfig.key === key && sortDirConfig.direction === "desc" ? "asc" : "desc";
    setSortDirConfig({ key, direction: dir });
  };
  const saDir = (k: string) => sortDirConfig.key === k ? (sortDirConfig.direction === "asc" ? " ↑" : " ↓") : " ↕";

  const toggleDir = async (d: Direccion) => {
    const key = d.codigo_direccion || String(d.codigo_cliente);
    setExpandedDir(prev => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
    if (!productosDirCache.has(key)) {
      setProductosDirCache(prev => new Map(prev).set(key, undefined));
      try {
        const params = new URLSearchParams({ anio, mes, customerCode: String(d.codigo_cliente) });
        if (d.codigo_direccion) params.set("addressCode", d.codigo_direccion);
        const res  = await fetch(`${API_BASE_URL}/api/odoo/plus-productos-direccion?${params}`);
        const json = await res.json();
        setProductosDirCache(prev => new Map(prev).set(key, json.ok ? json.productos : []));
      } catch {
        setProductosDirCache(prev => new Map(prev).set(key, []));
      }
    }
  };

  const requestSort = (key: string) => {
    const dir = sortConfig.key === key && sortConfig.direction === "asc" ? "desc" : "asc";
    setSortConfig({ key, direction: dir });
  };
  const sa = (k: string) => sortConfig.key === k ? (sortConfig.direction === "asc" ? " ↑" : " ↓") : " ↕";

  const filtrados = useMemo(() => {
    let lista = clientesAgrupados;
    if (filtro !== "Todos") lista = lista.filter(c => c.tuvo_consumo === filtro);
    const q = busqueda.toLowerCase();
    if (q) lista = lista.filter(c =>
      c.nombre_cliente?.toLowerCase().includes(q) || String(c.codigo_cliente).toLowerCase().includes(q)
    );
    return [...lista].sort((a, b) => {
      const av: any = (a as any)[sortConfig.key] ?? 0;
      const bv: any = (b as any)[sortConfig.key] ?? 0;
      const an = Number(av), bn = Number(bv);
      if (Number.isFinite(an) && Number.isFinite(bn))
        return sortConfig.direction === "asc" ? an - bn : bn - an;
      return sortConfig.direction === "asc"
        ? String(av).localeCompare(String(bv))
        : String(bv).localeCompare(String(av));
    });
  }, [clientesAgrupados, filtro, busqueda, sortConfig]);

  const totalPags = Math.ceil(filtrados.length / POR_PAGINA);
  const paginados = filtrados.slice((pagina - 1) * POR_PAGINA, pagina * POR_PAGINA);

  const exportar = () => {
    if (clienteSeleccionado) {
      const datos = direccionesCliente.map((d, i) => ({
        "N°": i + 1,
        Código: d.codigo_cliente,
        "Cód. Dirección": d.codigo_direccion || "—",
        Dirección: d.direccion_entrega,
        "Tipo Negocio": d.tipo_negocio,
        Teléfono: d.telefono_cliente,
        "Cant. Productos": d.cantidad_productos,
        "Consumo Actual ($)": Number(d.consumo_actual),
        "Consumo Anterior ($)": Number(d.vsMesAnterior?.monto_anterior || 0),
        "VS Mes Ant ($)": Number(d.vsMesAnterior?.variacion_abs || 0),
        "Última Factura": d.ultima_factura || "—",
        Estado: d.tuvo_consumo === "Sí" ? "Activo" : "Sin consumo",
      }));
      const ws = XLSX.utils.json_to_sheet(datos);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Direcciones");
      XLSX.writeFile(wb, `plus_${clienteNombre}_${anio}_${mes}.xlsx`);
    } else {
      const datos = filtrados.map((c, i) => ({
        "N°": i + 1,
        Código: c.codigo_cliente,
        Cliente: c.nombre_cliente,
        "Tipo Negocio": c.tipo_negocio,
        Teléfono: c.telefono_cliente,
        Direcciones: c.total_direcciones,
        "Cant. Productos": c.cantidad_productos,
        "Consumo Actual ($)": c.consumo_actual,
        "VS Mes Ant ($)": c.variacion_abs,
        "Última Factura": c.ultima_factura || "—",
        Estado: c.tuvo_consumo === "Sí" ? "Activo" : "Sin consumo",
      }));
      const ws = XLSX.utils.json_to_sheet(datos);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Clientes Plus");
      XLSX.writeFile(wb, `clientes_plus_odoo_${anio}_${mes}.xlsx`);
    }
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
            pages.push(1); if (pagina > 3) pages.push("...");
            for (let i = Math.max(2, pagina - 1); i <= Math.min(totalPags - 1, pagina + 1); i++) pages.push(i);
            if (pagina < totalPags - 2) pages.push("..."); pages.push(totalPags);
          }
          return pages.map((n, i) =>
            n === "..." ? <span key={`d${i}`} className="px-1 text-xs text-gray-400">…</span> :
            <button key={`p${i}`} onClick={() => setPagina(n)}
              className={`px-3 py-1 text-xs rounded ${pagina === n ? "bg-emerald-600 font-bold" : "bg-[#014434] hover:bg-[#025940]"}`}>{n}</button>
          );
        })()}
        <button disabled={pagina === totalPags} onClick={() => setPagina(p => p + 1)} className="px-3 py-1 text-xs rounded bg-[#014434] disabled:opacity-30 hover:bg-[#025940]">Sig ›</button>
        <button disabled={pagina === totalPags} onClick={() => setPagina(totalPags)} className="px-2 py-1 text-xs rounded bg-[#014434] disabled:opacity-30 hover:bg-[#025940]">»</button>
      </div>
    </div>
  ) : null;

  const totalMonto   = filtrados.reduce((a, c) => a + c.consumo_actual, 0);
  const totalAnt     = filtrados.reduce((a, c) => a + c.consumo_anterior, 0);

  return (
    <DashboardLayout>
      <div className="main-content min-h-screen text-white px-4 md:px-8 py-4 md:py-6">
        <Header />

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-6 border-b border-[#046C5E]/50 pb-4">
          <div>
            <button
              onClick={() => {
                if (clienteSeleccionado !== null) {
                  setClienteSeleccionado(null); setClienteNombre(""); setClienteIdentificacion(""); setBusqueda(""); setBusquedaDir(""); setFiltro("Todos"); setPagina(1);
                  setExpandedDir(new Set()); setProductosDirCache(new Map());
                } else {
                  navigate(-1);
                }
              }}
              className="text-xs text-gray-400 hover:text-white mb-1 flex items-center gap-1 transition">
              ← {clienteSeleccionado ? "Volver a clientes" : "Volver"}
            </button>
            <h1 className="text-xl md:text-2xl font-bold tracking-tight flex items-center gap-5 flex-wrap">
              <span>{clienteSeleccionado ? clienteNombre : "PLUS — Clientes"}</span>
              {clienteSeleccionado && (
                <span className="inline-flex items-center px-4 py-1.5 rounded-full text-base md:text-lg font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 whitespace-nowrap tracking-wide">
                  Plus
                </span>
              )}
            </h1>
            {clienteSeleccionado && clienteIdentificacion && (
              <p className="text-xs text-emerald-300/80 mt-0.5">
                Identificacion: <span className="text-sm font-mono text-white">{clienteIdentificacion}</span>
              </p>
            )}
            <p className="text-xs text-gray-400">
              {MESES[Number(mes)]} {anio}
              {clienteSeleccionado && " · Direcciones de entrega"}
            </p>
          </div>
          <button onClick={exportar}
            className="flex items-center gap-2 px-4 py-2 rounded-lg border border-[#0db48b]/60 bg-[#0db48b]/20 text-white font-semibold hover:bg-[#0db48b]/30 transition-all self-start sm:self-auto">
            <BsDownload size={16} /> Exportar Excel
          </button>
        </div>

        {!clienteSeleccionado && resumen && (
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

        {!clienteSeleccionado && !cargando && totalAnt > 0 && (() => {
          const varAbs = totalMonto - totalAnt;
          return (
            <div className={`flex items-center gap-3 mb-5 px-4 py-3 rounded-xl border text-sm font-semibold
              ${varAbs >= 0 ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-300" : "bg-red-500/10 border-red-500/30 text-red-300"}`}>
              <span>{varAbs >= 0 ? "▲" : "▼"}</span>
              <span>VS mes anterior: {varAbs >= 0 ? "+" : ""}${fmt(Math.abs(varAbs))} &nbsp;·&nbsp; Mes anterior: ${fmt(totalAnt)}</span>
            </div>
          );
        })()}

        {!clienteSeleccionado && productosGlobal.length > 0 && (
          <div className="bg-gradient-to-br from-[#012E24] to-[#013d30] border border-[#046C5E]/40 rounded-2xl overflow-hidden mb-6 shadow-xl">
            <h2 className="text-sm font-bold uppercase tracking-wider text-emerald-300/70 px-4 py-3 border-b border-[#046C5E]/30">
              Productos Vendidos
            </h2>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="bg-[#014434] text-[10px] uppercase text-green-300">
                    <th className="px-4 py-3 text-left">Producto</th>
                    <th className="px-4 py-3 text-right">Unidades</th>
                    <th className="px-4 py-3 text-right">Ventas</th>
                    <th className="px-4 py-3 text-right">Precio Promedio</th>
                  </tr>
                </thead>
                <tbody>
                  {productosGlobal.map((p, idx) => {
                    const uni = Number(p.unidades_vendidas);
                    const usd = Number(p.monto_usd);
                    const prom = uni > 0 ? usd / uni : 0;
                    return (
                      <tr key={idx} className={`${idx % 2 === 0 ? "bg-[#013d32]" : "bg-[#014f3e]"} hover:bg-[#025940] transition-colors`}>
                        <td className="px-4 py-2 text-white/80">{p.producto}</td>
                        <td className="px-4 py-2 text-right text-green-400 font-semibold tabular-nums">{uni.toLocaleString("es-EC")}</td>
                        <td className="px-4 py-2 text-right text-blue-400 font-semibold tabular-nums">${fmt(usd)}</td>
                        <td className="px-4 py-2 text-right text-purple-400 font-semibold tabular-nums">${fmt(prom)}</td>
                      </tr>
                    );
                  })}
                  {(() => {
                    const totUni = productosGlobal.reduce((a, p) => a + Number(p.unidades_vendidas), 0);
                    const totUSD = productosGlobal.reduce((a, p) => a + Number(p.monto_usd), 0);
                    const promTotal = totUni > 0 ? totUSD / totUni : 0;
                    return (
                      <tr className="bg-[#014434] font-bold border-t border-[#046C5E]/30">
                        <td className="px-4 py-3 text-emerald-300/70 uppercase text-[11px]">Total</td>
                        <td className="px-4 py-3 text-right text-green-400 tabular-nums">{totUni.toLocaleString("es-EC")}</td>
                        <td className="px-4 py-3 text-right text-blue-400 tabular-nums">${fmt(totUSD)}</td>
                        <td className="px-4 py-3 text-right text-purple-300 tabular-nums">${fmt(promTotal)}</td>
                      </tr>
                    );
                  })()}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {!clienteSeleccionado && (
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
              <option value="Todos">Todos</option>
              <option value="Sí">Con consumo</option>
              <option value="No">Sin consumo</option>
            </select>
          </div>
        )}

        {cargando && (
          <div className="flex flex-col justify-center items-center py-32 gap-4">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-emerald-400" />
            <p className="text-gray-400 text-sm">Cargando datos…</p>
          </div>
        )}

        {!cargando && !clienteSeleccionado && (
          <div className="bg-gradient-to-br from-[#012E24] to-[#013d30] border border-[#046C5E]/40 rounded-2xl overflow-hidden mb-6 shadow-xl">

            <div className="md:hidden">
              {filtrados.length === 0
                ? <p className="text-center text-gray-400 py-12 text-sm">No se encontraron clientes.</p>
                : <div className="space-y-3 p-3">
                    {paginados.map(c => {
                      const sinConsumo = c.tuvo_consumo === "No";
                      return (
                        <div key={String(c.codigo_cliente)}
                          onClick={() => { setClienteSeleccionado(String(c.codigo_cliente)); setClienteNombre(c.nombre_cliente); setClienteIdentificacion(c.identificacion_cliente || ""); setBusquedaDir(""); setExpandedDir(new Set()); setProductosDirCache(new Map()); }}
                          className="bg-gradient-to-br from-[#013d30] to-[#012E24] border border-[#046C5E]/40 rounded-xl overflow-hidden cursor-pointer hover:border-emerald-500/40 transition-colors">
                          <div className="p-4">
                            <div className="flex items-start justify-between mb-3">
                              <div className="flex-1 min-w-0 pr-2">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <p className="font-bold text-white text-sm truncate">{c.nombre_cliente}</p>
                                  {c.total_direcciones > 1 && (
                                    <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 whitespace-nowrap">
                                      {c.total_direcciones} suc.
                                    </span>
                                  )}
                                </div>
                                <p className="text-[11px] text-white/40 font-mono mt-0.5">{c.codigo_cliente}</p>
                              </div>
                              <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded border text-[10px] font-semibold shrink-0
                                ${sinConsumo ? "text-red-400 bg-red-500/15 border-red-500/30" : "text-green-400 bg-green-500/15 border-green-500/30"}`}>
                                <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${sinConsumo ? "bg-red-500" : "bg-green-500"}`}/>
                                {sinConsumo ? "Sin consumo" : "Activo"}
                              </span>
                            </div>
                            <div className="grid grid-cols-2 gap-2 text-center">
                              <div>
                                <p className="text-[9px] text-white/40 uppercase">Consumo</p>
                                <p className="text-sm font-bold text-blue-400">${fmt(c.consumo_actual)}</p>
                              </div>
                              <div>
                                <p className="text-[9px] text-white/40 uppercase">VS Ant</p>
                                <p className={`text-sm font-bold ${c.variacion_abs >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                                  {c.variacion_abs >= 0 ? "+" : ""}${fmt(Math.abs(c.variacion_abs))}
                                </p>
                              </div>
                            </div>
                            <p className="text-[10px] text-emerald-400/60 mt-3 text-right">Ver direcciones →</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
              }
            </div>

            <div className="hidden md:block overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="bg-[#014434] text-[10px] uppercase text-green-300 select-none align-middle">
                    <th className="px-3 py-3 text-left">N°</th>
                    {([
                      ["Código",         "codigo_cliente"],
                      ["Cliente",        "nombre_cliente"],
                      ["Tipo Negocio",   "tipo_negocio"],
                      ["Teléfono",       "telefono_cliente"],
                      ["Cant. Prod.",    "cantidad_productos"],
                      ["Consumo Actual", "consumo_actual"],
                      ["VS Mes Ant",     "variacion_abs"],
                      ["Últ. Factura",   "ultima_factura"],
                      ["Estado",         "tuvo_consumo"],
                    ] as [string,string][]).map(([label, key]) => (
                      <th key={key} onClick={() => requestSort(key)}
                        className={`px-3 py-3 cursor-pointer hover:text-white transition-colors whitespace-nowrap ${key === "cantidad_productos" || key === "consumo_actual" || key === "variacion_abs" || key === "ultima_factura" ? "text-right" : key === "tuvo_consumo" ? "text-center" : "text-left"}`}>
                        {label}<span className="ml-1 text-[#046C5E]">{sa(key)}</span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {paginados.length === 0
                    ? <tr><td colSpan={10} className="px-4 py-12 text-center text-gray-400 text-sm">No se encontraron clientes.</td></tr>
                    : paginados.map((c, idx) => {
                        const sinConsumo = c.tuvo_consumo === "No";
                        return (
                          <tr key={String(c.codigo_cliente)}
                            onClick={() => { setClienteSeleccionado(String(c.codigo_cliente)); setClienteNombre(c.nombre_cliente); setClienteIdentificacion(c.identificacion_cliente || ""); setBusquedaDir(""); setExpandedDir(new Set()); setProductosDirCache(new Map()); }}
                            className={`cursor-pointer transition-colors align-middle ${idx % 2 === 0 ? "bg-[#013d32]" : "bg-[#014f3e]"} hover:bg-[#025940]`}>
                            <td className="px-3 py-2 text-white/30 text-xs">{(pagina - 1) * POR_PAGINA + idx + 1}</td>
                            <td className="px-3 py-2 font-mono text-xs text-white/40">{c.codigo_cliente}</td>
                            <td className="px-3 py-2 font-semibold text-white">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span>{c.nombre_cliente}</span>
                                {c.total_direcciones > 1 && (
                                  <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 whitespace-nowrap">
                                    {c.total_direcciones} suc.
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="px-3 py-2 text-white/50 text-xs">{c.tipo_negocio || "—"}</td>
                            <td className="px-3 py-2 text-white/50 text-xs">{c.telefono_cliente || "—"}</td>
                            <td className="px-3 py-2 text-right text-green-400 font-semibold tabular-nums">{c.cantidad_productos.toLocaleString("es-EC")}</td>
                            <td className="px-3 py-2 text-right font-bold text-white tabular-nums">${fmt(c.consumo_actual)}</td>
                            <td className={`px-3 py-2 text-right font-bold tabular-nums ${c.variacion_abs >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                              {c.variacion_abs >= 0 ? "+" : ""}${fmt(Math.abs(c.variacion_abs))}
                            </td>
                            <td className="px-3 py-2 text-right text-white/40 text-xs whitespace-nowrap">
                              {fmtFecha(c.ultima_factura)}
                            </td>
                            <td className="px-3 py-2 text-center">
                              <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded border text-[10px] font-semibold
                                ${sinConsumo ? "text-red-400 bg-red-500/15 border-red-500/30" : "text-green-400 bg-green-500/15 border-green-500/30"}`}>
                                <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${sinConsumo ? "bg-red-500" : "bg-green-500"}`}/>
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

        {!cargando && clienteSeleccionado !== null && (
          <>
          <div className="flex flex-wrap gap-3 mb-4">
            <div className="relative flex-1 min-w-[180px]">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none"
                fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 1 0 5 11a6 6 0 0 0 12 0z"/>
              </svg>
              <input type="text" placeholder="Buscar dirección de sucursal…" value={busquedaDir}
                onChange={e => setBusquedaDir(e.target.value)}
                className="bg-[#012E24] border border-[#046C5E] rounded-lg px-3 py-2 pl-9 text-sm text-white placeholder-gray-500 w-full focus:outline-none focus:border-emerald-500/60"/>
            </div>
          </div>
          <div className="bg-gradient-to-br from-[#012E24] to-[#013d30] border border-[#046C5E]/40 rounded-2xl overflow-hidden mb-6 shadow-xl">

            <div className="md:hidden">
              {direccionesCliente.length === 0
                ? <p className="text-center text-gray-400 py-12 text-sm">Sin direcciones.</p>
                : <div className="space-y-3 p-3">
                    {direccionesCliente.map(d => {
                      const key        = d.codigo_direccion || String(d.codigo_cliente);
                      const isExpanded = expandedDir.has(key);
                      const prods      = productosDirCache.get(key);
                      const sinConsumo = d.tuvo_consumo === "No";
                      const vsAnt      = Number(d.vsMesAnterior?.variacion_abs ?? 0);
                      const dirLabel   = d.direccion_entrega || d.codigo_direccion || String(d.codigo_cliente);
                      return (
                        <div key={key}
                          className="bg-gradient-to-br from-[#013d30] to-[#012E24] border border-[#046C5E]/40 rounded-xl overflow-hidden">
                          <div className="p-4 cursor-pointer" onClick={() => toggleDir(d)}>
                            <div className="flex items-start justify-between mb-3">
                              <div className="flex-1 min-w-0 pr-2">
                                <div className="flex items-center gap-2 mb-0.5">
                                  <span className={`text-[10px] transition-transform duration-200 inline-block ${isExpanded ? "rotate-90" : ""} text-white/40`}>▶</span>
                                  <p className="text-[10px] font-mono text-white/40">{d.codigo_direccion || "—"}</p>
                                </div>
                                <p className="text-sm font-medium text-white/80 truncate">{(d.descripcion_direccion_cliente || d.direccion_entrega) || "Sin dirección"}</p>
                              </div>
                              <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded border text-[10px] font-semibold shrink-0
                                ${sinConsumo ? "text-red-400 bg-red-500/15 border-red-500/30" : "text-green-400 bg-green-500/15 border-green-500/30"}`}>
                                <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${sinConsumo ? "bg-red-500" : "bg-green-500"}`}/>
                                {sinConsumo ? "Sin consumo" : "Activa"}
                              </span>
                            </div>
                            <div className="grid grid-cols-3 gap-2 text-center">
                              <div>
                                <p className="text-[9px] text-white/40 uppercase">Consumo</p>
                                <p className="text-sm font-bold text-blue-400">${fmt(Number(d.consumo_actual))}</p>
                              </div>
                              <div>
                                <p className="text-[9px] text-white/40 uppercase">VS Ant</p>
                                <p className={`text-sm font-bold ${vsAnt >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                                  {vsAnt >= 0 ? "+" : ""}${fmt(Math.abs(vsAnt))}
                                </p>
                              </div>
                              <div>
                                <p className="text-[9px] text-white/40 uppercase">Unidades</p>
                                <p className="text-sm font-bold text-green-400">{d.cantidad_productos}</p>
                              </div>
                            </div>
                            {d.ultima_factura && (
                              <div className="mt-2 text-right text-[10px] text-white/40">
                                Últ. compra: {fmtFecha(d.ultima_factura)}
                              </div>
                            )}
                          </div>
                          {isExpanded && (
                            <div className="border-t border-[#046C5E]/30 bg-[#011f17]">
                              <div className="flex items-center gap-3 px-5 py-2 border-b border-[#046C5E]/20">
                                <span className="text-[10px] text-emerald-400/60 uppercase tracking-widest font-semibold">
                                  Productos · {dirLabel}
                                </span>
                              </div>
                              {prods === undefined
                                ? <div className="flex justify-center py-4">
                                    <div className="animate-spin h-5 w-5 border-2 border-emerald-400/20 border-t-emerald-400 rounded-full"/>
                                  </div>
                                : prods.length === 0
                                  ? <p className="text-center text-gray-500 italic py-4 text-xs">Sin productos</p>
                                  : <div className="overflow-x-auto">
                                      <table className="w-full text-xs">
                                        <thead>
                                          <tr className="bg-[#012920] text-emerald-400/70 uppercase tracking-wider">
                                            <th className="px-5 py-2 text-left font-semibold">Producto</th>
                                            <th className="px-3 py-2 text-right font-semibold">Und.</th>
                                            <th className="px-4 py-2 text-right font-semibold">Ventas</th>
                                          </tr>
                                        </thead>
                                        <tbody>
                                          {prods.map((p, pi) => (
                                            <tr key={pi} className={`border-t border-[#046C5E]/10 ${pi % 2 === 0 ? "bg-[#012920]" : "bg-[#013025]"}`}>
                                              <td className="px-5 py-1.5 text-white/70">{p.producto || "—"}</td>
                                              <td className="px-3 py-1.5 text-right text-green-400 font-bold tabular-nums">{Number(p.unidades_vendidas).toLocaleString("es-EC")}</td>
                                              <td className="px-4 py-1.5 text-right text-blue-400 font-bold tabular-nums">${fmt(Number(p.monto_usd))}</td>
                                            </tr>
                                          ))}
                                        </tbody>
                                        <tfoot>
                                          <tr className="border-t border-[#046C5E]/30 bg-[#012018] font-bold">
                                            <td className="px-5 py-2 text-emerald-400/60 text-[11px] uppercase">{prods.length} producto{prods.length !== 1 ? "s" : ""}</td>
                                            <td className="px-3 py-2 text-right text-green-400 tabular-nums">{prods.reduce((a,p)=>a+Number(p.unidades_vendidas),0).toLocaleString("es-EC")}</td>
                                            <td className="px-4 py-2 text-right text-blue-400 tabular-nums">${fmt(prods.reduce((a,p)=>a+Number(p.monto_usd),0))}</td>
                                          </tr>
                                        </tfoot>
                                      </table>
                                    </div>
                              }
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
              }
            </div>

            <div className="hidden md:block overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="bg-[#014434] text-[10px] uppercase text-green-300 select-none">
                    <th className="px-3 py-3 text-left w-10">N°</th>
                    {([
                      ["Cód. Dirección", "codigo_direccion",              "text-left"],
                      ["Dirección",      "descripcion_direccion_cliente", "text-left"],
                      ["Tipo Negocio",   "tipo_negocio",                  "text-left"],
                      ["Teléfono",       "telefono_cliente",              "text-left"],
                      ["Unidades",       "cantidad_productos",            "text-right"],
                      ["Consumo",        "consumo_actual",                "text-right"],
                      ["VS Ant",         "variacion_abs",                 "text-right"],
                      ["Últ. Factura",   "ultima_factura",                "text-right"],
                    ] as [string, string, string][]).map(([label, key, align]) => (
                      <th key={key} onClick={() => requestSortDir(key)}
                        className={`px-3 py-3 cursor-pointer hover:text-white transition-colors whitespace-nowrap ${align}`}>
                        {label}<span className="ml-1 text-[#046C5E]">{saDir(key)}</span>
                      </th>
                    ))}
                    <th className="px-3 py-3 text-center">Mapa</th>
                    <th onClick={() => requestSortDir("tuvo_consumo")}
                      className="px-3 py-3 text-center cursor-pointer hover:text-white transition-colors whitespace-nowrap">
                      Estado<span className="ml-1 text-[#046C5E]">{saDir("tuvo_consumo")}</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {direccionesCliente.length === 0
                    ? <tr><td colSpan={11} className="px-4 py-12 text-center text-gray-400 text-sm">Sin direcciones.</td></tr>
                    : direccionesCliente.map((d, idx) => {
                        const key        = d.codigo_direccion || String(d.codigo_cliente);
                        const isExpanded = expandedDir.has(key);
                        const prods      = productosDirCache.get(key);
                        const sinConsumo = d.tuvo_consumo === "No";
                        const vsAnt      = Number(d.vsMesAnterior?.variacion_abs ?? 0);
                        const rowBg      = idx % 2 === 0 ? "bg-[#013d32]" : "bg-[#014f3e]";
                        const dirLabel   = d.direccion_entrega || d.codigo_direccion || String(d.codigo_cliente);
                        const globalN    = idx + 1;
                        return (
                          <React.Fragment key={key}>
                            <tr onClick={() => toggleDir(d)}
                              className={`cursor-pointer transition-colors ${rowBg} hover:bg-[#025940] group`}>
                              <td className="px-3 py-2 text-xs text-white/40 w-10">
                                <span className="inline-flex items-center gap-1.5 select-none">
                                  <span className={`text-[10px] text-emerald-400/60 transition-transform duration-200 inline-block ${isExpanded ? "rotate-90" : ""}`}>▶</span>
                                  <span className="text-white/30">{globalN}</span>
                                </span>
                              </td>
                              <td className="px-3 py-2 font-mono text-xs text-white/40">{d.codigo_direccion || "—"}</td>
                              <td className="px-3 py-2 text-white/80 max-w-[200px]">
                                <span className="line-clamp-2 text-xs">{(d.descripcion_direccion_cliente || d.direccion_entrega) || "Sin dirección"}</span>
                              </td>
                              <td className="px-3 py-2 text-white/50 text-xs">{d.tipo_negocio || "—"}</td>
                              <td className="px-3 py-2 text-white/50 text-xs whitespace-nowrap">{d.telefono_cliente || "—"}</td>
                              <td className="px-3 py-2 text-right text-green-400 font-semibold tabular-nums">{d.cantidad_productos.toLocaleString("es-EC")}</td>
                              <td className="px-3 py-2 text-right font-bold text-white tabular-nums">${fmt(Number(d.consumo_actual))}</td>
                              <td className={`px-3 py-2 text-right font-bold tabular-nums ${vsAnt >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                                {vsAnt >= 0 ? "+" : ""}${fmt(Math.abs(vsAnt))}
                              </td>
                              <td className="px-3 py-2 text-right text-white/40 text-xs whitespace-nowrap">
                                {fmtFecha(d.ultima_factura)}
                              </td>
                              <td className="px-3 py-2 text-center">
                                {d.latitud_cliente && d.latitud_cliente !== "—" && d.longitud_cliente && d.longitud_cliente !== "—"
                                  ? <a href={`https://maps.google.com/?q=${d.latitud_cliente},${d.longitud_cliente}`}
                                      target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()}
                                      className="text-[10px] text-blue-400/70 hover:text-blue-400 border border-blue-400/20 px-2 py-0.5 rounded inline-flex items-center">
                                      <MapPin size={10} />
                                    </a>
                                  : <span className="text-white/40 text-[10px] italic whitespace-nowrap">Sin información</span>
                                }
                              </td>
                              <td className="px-3 py-2 text-center">
                                <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded border text-[10px] font-semibold
                                  ${sinConsumo ? "text-red-400 bg-red-500/15 border-red-500/30" : "text-green-400 bg-green-500/15 border-green-500/30"}`}>
                                  <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${sinConsumo ? "bg-red-500" : "bg-green-500"}`}/>
                                  {sinConsumo ? "Sin consumo" : "Activa"}
                                </span>
                              </td>
                            </tr>
                            {isExpanded && (
                              <tr>
                                <td colSpan={11} className="p-0 border-b border-[#046C5E]/20">
                                  <div className="bg-[#011f17] border-l-2 border-emerald-500/40">
                                    <div className="flex items-center gap-3 px-5 py-2 border-b border-[#046C5E]/20">
                                      <span className="text-[10px] text-emerald-400/60 uppercase tracking-widest font-semibold">
                                        Productos · {dirLabel}
                                      </span>
                                    </div>
                                    {prods === undefined
                                      ? <div className="flex justify-center py-4">
                                          <div className="animate-spin h-5 w-5 border-2 border-emerald-400/20 border-t-emerald-400 rounded-full"/>
                                        </div>
                                      : prods.length === 0
                                        ? <p className="text-center text-gray-500 italic py-4 text-xs">Sin productos</p>
                                        : <div className="overflow-x-auto">
                                            <table className="w-full text-xs">
                                              <thead>
                                                <tr className="bg-[#012920] text-emerald-400/70 uppercase tracking-wider">
                                                  <th className="px-5 py-2 text-left font-semibold">Producto</th>
                                                  <th className="px-3 py-2 text-right font-semibold">Unidades</th>
                                                  <th className="px-4 py-2 text-right font-semibold">Ventas</th>
                                                </tr>
                                              </thead>
                                              <tbody>
                                                {prods.map((p, pi) => (
                                                  <tr key={pi} className={`border-t border-[#046C5E]/10 ${pi % 2 === 0 ? "bg-[#012920]" : "bg-[#013025]"}`}>
                                                    <td className="px-5 py-1.5 text-white/70">{p.producto || "—"}</td>
                                                    <td className="px-3 py-1.5 text-right text-green-400 font-bold tabular-nums">{Number(p.unidades_vendidas).toLocaleString("es-EC")}</td>
                                                    <td className="px-4 py-1.5 text-right text-blue-400 font-bold tabular-nums">${fmt(Number(p.monto_usd))}</td>
                                                  </tr>
                                                ))}
                                              </tbody>
                                              <tfoot>
                                                <tr className="border-t border-[#046C5E]/30 bg-[#012018] font-bold">
                                                  <td className="px-5 py-2 text-emerald-400/60 text-[11px] uppercase">{prods.length} producto{prods.length !== 1 ? "s" : ""}</td>
                                                  <td className="px-3 py-2 text-right text-green-400 tabular-nums">{prods.reduce((a,p)=>a+Number(p.unidades_vendidas),0).toLocaleString("es-EC")}</td>
                                                  <td className="px-4 py-2 text-right text-blue-400 tabular-nums">${fmt(prods.reduce((a,p)=>a+Number(p.monto_usd),0))}</td>
                                                </tr>
                                              </tfoot>
                                            </table>
                                          </div>
                                    }
                                  </div>
                                </td>
                              </tr>
                            )}
                          </React.Fragment>
                        );
                      })
                  }
                </tbody>
                {direccionesCliente.length > 1 && (
                  <tfoot>
                    <tr className="bg-[#014434] border-t border-[#046C5E]/30 font-bold text-green-300 text-xs uppercase">
                      <td colSpan={5} className="px-3 py-3">Total · {direccionesCliente.length} dirección{direccionesCliente.length !== 1 ? "es" : ""}</td>
                      <td className="px-3 py-3 text-right text-green-400 tabular-nums">
                        {direccionesCliente.reduce((a,d)=>a+Number(d.cantidad_productos),0).toLocaleString("es-EC")}
                      </td>
                      <td className="px-3 py-3 text-right text-white tabular-nums">
                        ${fmt(direccionesCliente.reduce((a,d)=>a+Number(d.consumo_actual),0))}
                      </td>
                      <td colSpan={4}/>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>

          </div>
          </>
        )}
      </div>
    </DashboardLayout>
  );
};

export default DetallePlusOdooPage;
