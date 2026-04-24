import React, { useEffect, useState, useMemo, useCallback } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import DashboardLayout from "../../layout/DashboardLayout";
import { Header } from "../../components/common/Header";
import { API_BASE_URL } from "../../config";

// ─── Types ────────────────────────────────────────────────────────────────────
type Sucursal = {
  codigo_cliente:  string;
  codigo_sucursal: string;
  nombre_sucursal: string;
  calle1_direccion: string;
  seller_code:     string;
  tipo_negocio:    string;
  total_unidades:  number;
  total_ventas:    number;
  total_facturas:  number;
  ultima_compra?:  string;
  estado_cliente:  string;
  latitud?:        string;
  longitud?:       string;
  telefono?:       string;
};
type Producto = {
  nombre_producto: string;
  total_unidades:  number;
  total_ventas:    number;
};
type ProductoSucursal = {
  nombre_producto: string;
  total_unidades:  number;
  total_ventas:    number;
};
type SortDir = "asc" | "desc";

// ─── Constants ────────────────────────────────────────────────────────────────
const PAGE_SIZE = 50;

// ─── Helpers ──────────────────────────────────────────────────────────────────
const money    = (n = 0) =>
  Number(n).toLocaleString("es-EC", { style: "currency", currency: "USD" });
const fmtD     = (d: Date) => d.toISOString().slice(0, 10);
const isDateStr = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s);

/** Devuelve true sólo si lat/lng son valores numéricos válidos y distintos de 0. */
const hasCoords = (lat?: string | number | null, lng?: string | number | null) => {
  if (lat === null || lat === undefined || lat === "" ) return false;
  if (lng === null || lng === undefined || lng === "" ) return false;
  const nLat = Number(lat);
  const nLng = Number(lng);
  if (!Number.isFinite(nLat) || !Number.isFinite(nLng)) return false;
  if (nLat === 0 || nLng === 0) return false;
  return true;
};

const ESTADO_CFG: Record<string, { dot: string; badge: string; label: string }> = {
  ACTIVO:        { dot: "bg-green-500",  badge: "text-green-400 bg-green-500/15 border-green-500/30",    label: "Activo"      },
  RIESGO:        { dot: "bg-yellow-400", badge: "text-yellow-400 bg-yellow-400/15 border-yellow-400/30", label: "Riesgo"      },
  INACTIVO:      { dot: "bg-red-500",    badge: "text-red-400 bg-red-500/15 border-red-500/30",           label: "Inactivo"    },
  "SIN COMPRAS": { dot: "bg-gray-500",   badge: "text-gray-400 bg-gray-500/15 border-gray-500/30",        label: "Sin Compras" },
};
const estadoIcon = (e?: string) => {
  const cfg = ESTADO_CFG[e || ""] ?? {
    dot: "bg-gray-400",
    badge: "text-gray-400 bg-gray-500/15 border-gray-500/30",
    label: "—",
  };
  return (
    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded border text-[10px] font-semibold ${cfg.badge}`}>
      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${cfg.dot}`} />
      {cfg.label}
    </span>
  );
};

// ─── Period presets ───────────────────────────────────────────────────────────
const PRESETS = [
  { id: "hoy",     label: "Hoy"      },
  { id: "semana",  label: "Semana"   },
  { id: "mes",     label: "Este Mes" },
  { id: "mes_ant", label: "Mes Ant." },
  { id: "3m",      label: "3 Meses"  },
  { id: "todo",    label: "Todo"     },
];
function calcPreset(id: string): { desde: string; hasta: string } {
  if (id === "todo") return { desde: "", hasta: "" };
  const today = new Date();
  const hasta  = fmtD(today);
  switch (id) {
    case "hoy":    return { desde: hasta, hasta };
    case "semana": {
      const d = new Date(today);
      d.setDate(d.getDate() + (d.getDay() === 0 ? -6 : 1 - d.getDay()));
      return { desde: fmtD(d), hasta };
    }
    case "mes":
      return { desde: `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,"0")}-01`, hasta };
    case "mes_ant": {
      const y = today.getMonth() === 0 ? today.getFullYear()-1 : today.getFullYear();
      const m = today.getMonth() === 0 ? 12 : today.getMonth();
      return {
        desde: `${y}-${String(m).padStart(2,"0")}-01`,
        hasta: fmtD(new Date(today.getFullYear(), today.getMonth(), 0)),
      };
    }
    case "3m": {
      const d = new Date(today); d.setMonth(d.getMonth()-3);
      return { desde: fmtD(d), hasta };
    }
    default: return { desde: "", hasta: "" };
  }
}

// ─── Sort helper ──────────────────────────────────────────────────────────────
function useSortTable<T extends Record<string, any>>(items: T[]) {
  const [sortKey, setSortKey] = useState<keyof T | "">("");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const sorted = useMemo(() => {
    if (!sortKey) return items;
    return [...items].sort((a, b) => {
      const av = a[sortKey]; const bv = b[sortKey];
      if (typeof av === "number" && typeof bv === "number")
        return sortDir === "asc" ? av - bv : bv - av;
      return sortDir === "asc"
        ? String(av ?? "").localeCompare(String(bv ?? ""))
        : String(bv ?? "").localeCompare(String(av ?? ""));
    });
  }, [items, sortKey, sortDir]);

  const handleSort = (col: keyof T) => {
    setSortDir(prev => sortKey === col && prev === "desc" ? "asc" : "desc");
    setSortKey(col);
  };

  const Th = ({ label, col, align = "left" }: { label: string; col: keyof T; align?: string }) => (
    <th onClick={() => handleSort(col)}
      className={`px-3 py-3 text-${align} cursor-pointer hover:text-white whitespace-nowrap select-none transition-colors`}>
      {label}
      <span className="ml-1 opacity-50 text-[10px]">
        {sortKey === col ? (sortDir === "asc" ? "↑" : "↓") : "↕"}
      </span>
    </th>
  );

  return { sorted, Th };
}

// ─── Pagination controls ──────────────────────────────────────────────────────
function Pagination({
  page, totalPages, onChange,
}: { page: number; totalPages: number; onChange: (p: number) => void }) {
  if (totalPages <= 1) return null;

  const pages: (number | "…")[] = [];
  if (totalPages <= 7) {
    for (let i = 1; i <= totalPages; i++) pages.push(i);
  } else {
    pages.push(1);
    if (page > 3) pages.push("…");
    for (let i = Math.max(2, page - 1); i <= Math.min(totalPages - 1, page + 1); i++) pages.push(i);
    if (page < totalPages - 2) pages.push("…");
    pages.push(totalPages);
  }

  const btn = "w-8 h-8 flex items-center justify-center rounded-lg text-xs font-medium transition-all";

  return (
    <div className="flex items-center justify-between gap-2 px-4 py-3 border-t border-[#046C5E]/40">
      <span className="text-xs text-white/30 hidden sm:block">
        Página {page} de {totalPages}
      </span>
      <div className="flex items-center gap-1 mx-auto sm:mx-0">
        <button
          onClick={() => onChange(page - 1)} disabled={page === 1}
          className={`${btn} border border-[#046C5E] bg-[#014434] text-white/50 disabled:opacity-25 hover:border-emerald-500/60 hover:text-white`}>
          ‹
        </button>
        {pages.map((p, i) =>
          p === "…"
            ? <span key={`e${i}`} className="w-8 text-center text-white/30 text-xs">…</span>
            : <button key={p} onClick={() => onChange(p as number)}
                className={`${btn} border ${
                  p === page
                    ? "bg-emerald-600 border-emerald-500 text-white shadow-[0_0_8px_rgba(16,185,129,0.3)]"
                    : "border-[#046C5E] bg-[#014434] text-white/50 hover:border-emerald-500/60 hover:text-white"
                }`}>{p}</button>
        )}
        <button
          onClick={() => onChange(page + 1)} disabled={page === totalPages}
          className={`${btn} border border-[#046C5E] bg-[#014434] text-white/50 disabled:opacity-25 hover:border-emerald-500/60 hover:text-white`}>
          ›
        </button>
      </div>
    </div>
  );
}

// ─── Sub-tabla de productos por sucursal ──────────────────────────────────────
function ProdsSucursal({ prods }: { prods: ProductoSucursal[] | undefined }) {
  if (prods === undefined)
    return (
      <div className="flex justify-center items-center py-6">
        <div className="animate-spin h-5 w-5 border-2 border-emerald-400/20 border-t-emerald-400 rounded-full" />
      </div>
    );
  if (prods.length === 0)
    return <p className="text-center text-white/30 italic py-5 text-xs">Sin productos en este período</p>;

  const totalU = prods.reduce((a, p) => a + p.total_unidades, 0);
  const totalV = prods.reduce((a, p) => a + p.total_ventas, 0);

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="bg-[#011f17] text-emerald-400/70 uppercase tracking-wider">
            <th className="px-5 md:px-8 py-2 text-left font-semibold">Producto</th>
            <th className="px-3 py-2 text-right font-semibold whitespace-nowrap">Unidades</th>
            <th className="px-3 md:px-5 py-2 text-right font-semibold whitespace-nowrap">Ventas</th>
          </tr>
        </thead>
        <tbody>
          {prods.map((p, pi) => (
            <tr key={pi}
              className={`border-t border-[#046C5E]/10 ${pi % 2 === 0 ? "bg-[#012920]" : "bg-[#013025]"}`}>
              <td className="px-5 md:px-8 py-1.5 text-white/70 font-medium">{p.nombre_producto}</td>
              <td className="px-3 py-1.5 text-right text-green-400 font-bold tabular-nums">
                {p.total_unidades.toLocaleString("es-EC")}
              </td>
              <td className="px-3 md:px-5 py-1.5 text-right text-blue-400 font-bold tabular-nums">
                {money(p.total_ventas)}
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="border-t border-[#046C5E]/30 bg-[#012018] font-bold">
            <td className="px-5 md:px-8 py-2 text-emerald-400/60 text-[11px] uppercase">
              {prods.length} producto{prods.length !== 1 ? "s" : ""}
            </td>
            <td className="px-3 py-2 text-right text-green-400 tabular-nums">
              {totalU.toLocaleString("es-EC")}
            </td>
            <td className="px-3 md:px-5 py-2 text-right text-blue-400 tabular-nums">
              {money(totalV)}
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function EmpresaDetalle() {
  const { ruc }  = useParams<{ ruc: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const companyId = searchParams.get("company_id") || "";

  // Period filter
  const [activePreset, setActivePreset] = useState("mes");
  const [sfDesde, setSfDesde]           = useState(() => calcPreset("mes").desde);
  const [sfHasta, setSfHasta]           = useState(() => calcPreset("mes").hasta);
  const [draftDesde, setDraftDesde]     = useState(() => calcPreset("mes").desde);
  const [draftHasta, setDraftHasta]     = useState(() => calcPreset("mes").hasta);

  // Data
  const [nombre,              setNombre]              = useState("");
  const [descripcionCompany,  setDescripcionCompany]  = useState("");
  const [totales,    setTotales]    = useState({ unidades: 0, ventas: 0, facturas: 0 });
  const [sucursales, setSucursales] = useState<Sucursal[]>([]);
  const [productos,  setProductos]  = useState<Producto[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [fetching,   setFetching]   = useState(false);

  // Expand por sucursal
  const [expanded,      setExpanded]      = useState<Set<string>>(new Set());
  const [sucursalProds, setSucursalProds] = useState<Map<string, ProductoSucursal[]>>(new Map());

  // Buscador sucursales
  const [sucSearch, setSucSearch] = useState("");

  // Paginación sucursales
  const [sucPage, setSucPage] = useState(1);

  // Sort tables
  const { sorted: sucSorted, Th: SucTh } = useSortTable(sucursales);
  const { sorted: prodSorted, Th: ProdTh } = useSortTable(productos);

  // Filtrar por búsqueda
  const sucFiltered = useMemo(() => {
    const q = sucSearch.trim().toLowerCase();
    if (!q) return sucSorted;
    return sucSorted.filter(s =>
      s.codigo_sucursal.toLowerCase().includes(q) ||
      s.nombre_sucursal.toLowerCase().includes(q)
    );
  }, [sucSorted, sucSearch]);

  // Paginación calculada
  const sucTotalPages = Math.max(1, Math.ceil(sucFiltered.length / PAGE_SIZE));
  const safePage      = Math.min(sucPage, sucTotalPages);
  const sucPageData   = sucFiltered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  // Reset página cuando cambia el orden o búsqueda
  useEffect(() => { setSucPage(1); }, [sucSorted, sucSearch]);

  // ── Fetch principal ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (!ruc) return;
    const ctrl = new AbortController();
    const cargar = async () => {
      sucursales.length > 0 ? setFetching(true) : setLoading(true);
      // Limpiar expand al cambiar período
      setExpanded(new Set());
      setSucursalProds(new Map());
      setSucPage(1);
      try {
        const p = new URLSearchParams();
        if (sfDesde && sfHasta) { p.set("desde", sfDesde); p.set("hasta", sfHasta); }
        if (companyId) p.set("company_id", companyId);
        const url = `${API_BASE_URL}/api/dashboard-clientes/empresa/${encodeURIComponent(ruc)}?${p}`;
        const res  = await fetch(url, { signal: ctrl.signal });
        const json = await res.json();
        if (!json.ok) throw new Error(json.message);
        setNombre(json.nombre);
        setDescripcionCompany(json.descripcion_company || "");
        setTotales(json.totales);
        setSucursales(json.sucursales.map((s: any): Sucursal => ({
          codigo_cliente:  s.codigo_cliente,
          codigo_sucursal: s.codigo_sucursal ?? s.customer_address_code ?? "",
          nombre_sucursal: s.nombre_sucursal ?? "",
          calle1_direccion: s.calle1_direccion ?? "",
          seller_code:     s.seller_code ?? "-",
          tipo_negocio:    s.tipo_negocio ?? "SIN CLASIFICAR",
          total_unidades:  Number(s.total_unidades || 0),
          total_ventas:    Number(s.total_ventas   || 0),
          total_facturas:  Number(s.total_facturas || 0),
          ultima_compra:   s.ultima_compra,
          estado_cliente:  s.estado_cliente ?? "SIN COMPRAS",
          latitud:         s.latitud ?? "",
          longitud:        s.longitud ?? "",
          telefono:        s.telefono ?? "",
        })));
        setProductos(json.productos.map((p: any): Producto => ({
          nombre_producto: p.nombre_producto,
          total_unidades:  Number(p.total_unidades || 0),
          total_ventas:    Number(p.total_ventas   || 0),
        })));
      } catch (err: any) {
        if (err?.name === "AbortError") return;
      } finally {
        setLoading(false);
        setFetching(false);
      }
    };
    cargar();
    return () => ctrl.abort();
  }, [ruc, sfDesde, sfHasta, companyId]);

  // ── Toggle expand sucursal ──────────────────────────────────────────────────
  const toggleSucursal = useCallback(async (s: Sucursal) => {
    const key = `${s.codigo_cliente}-${s.codigo_sucursal}`;
    setExpanded(prev => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
    if (!sucursalProds.has(key)) {
      // Insertar placeholder undefined para mostrar spinner
      setSucursalProds(prev => new Map(prev).set(key, undefined as any));
      try {
        const p = new URLSearchParams();
        if (sfDesde && sfHasta) { p.set("desde", sfDesde); p.set("hasta", sfHasta); }
        const url = `${API_BASE_URL}/api/dashboard-clientes/sucursal-productos/${encodeURIComponent(s.codigo_cliente)}/${encodeURIComponent(s.codigo_sucursal)}?${p}`;
        const res  = await fetch(url);
        const json = await res.json();
        setSucursalProds(prev => new Map(prev).set(key,
          json.ok
            ? json.productos.map((p: any): ProductoSucursal => ({
                nombre_producto: p.nombre_producto,
                total_unidades:  Number(p.total_unidades || 0),
                total_ventas:    Number(p.total_ventas   || 0),
              }))
            : []
        ));
      } catch {
        setSucursalProds(prev => new Map(prev).set(key, []));
      }
    }
  }, [sucursalProds, sfDesde, sfHasta]);

  // ── Actions ─────────────────────────────────────────────────────────────────
  const applyPreset = (id: string) => {
    const { desde, hasta } = calcPreset(id);
    setActivePreset(id);
    setDraftDesde(desde); setDraftHasta(hasta);
    setSfDesde(desde);    setSfHasta(hasta);
  };
  const applyCustomDates = () => {
    if (isDateStr(draftDesde) && isDateStr(draftHasta)) {
      setActivePreset("");
      setSfDesde(draftDesde); setSfHasta(draftHasta);
    }
  };

  // ── Totals ───────────────────────────────────────────────────────────────────
  const totalProd   = prodSorted.reduce((a, p) => a + p.total_ventas, 0);
  const labelPeriod = sfDesde && sfHasta
    ? sfDesde === sfHasta ? sfDesde : `${sfDesde} → ${sfHasta}`
    : "Histórico";

  // ── Loading ──────────────────────────────────────────────────────────────────
  if (loading)
    return (
      <DashboardLayout>
        <div className="flex flex-col justify-center items-center py-32 gap-4">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-emerald-400"/>
          <p className="text-gray-400 text-sm">Cargando empresa…</p>
        </div>
      </DashboardLayout>
    );

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <DashboardLayout>
      <div className="main-content min-h-screen text-white px-4 md:px-10 py-4 md:py-6">
        <Header/>

        {/* Back + title */}
        <div className="flex items-start gap-4 mb-6">
          <button onClick={() => navigate(-1)}
            className="flex items-center gap-1.5 text-sm text-white/50 hover:text-white transition-colors mt-1 shrink-0">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7"/>
            </svg>
            Volver
          </button>
          <div className="flex-1 min-w-0">
            <h1 className="text-lg md:text-2xl font-bold leading-tight">{nombre}</h1>
            <div className="flex flex-wrap items-center gap-3 mt-1">
              <span className="text-xs font-mono text-white/40">RUC: {ruc}</span>
              {descripcionCompany && (
                <span className="text-xs text-emerald-300/70 font-medium">{descripcionCompany}</span>
              )}
              {fetching && (
                <span className="flex items-center gap-1.5 text-xs text-emerald-400">
                  <span className="w-3 h-3 border-2 border-emerald-400/20 border-t-emerald-400 rounded-full animate-spin"/>
                  Actualizando…
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Period filter */}
        <div className="bg-[#013d32] border border-[#046C5E]/60 rounded-2xl p-4 mb-6">
          <p className="text-[10px] text-white/40 uppercase tracking-widest font-semibold mb-3">Período</p>
          <div className="flex flex-wrap gap-2 mb-3">
            {PRESETS.map(pr => (
              <button key={pr.id} onClick={() => applyPreset(pr.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                  activePreset === pr.id
                    ? "bg-emerald-600 border-emerald-500 text-white shadow-[0_0_8px_rgba(16,185,129,0.3)]"
                    : "bg-[#014434] border-[#046C5E] text-white/60 hover:text-white hover:border-emerald-500/50"
                }`}>{pr.label}</button>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <span className="text-xs text-white/40">Desde</span>
              <input type="date" value={draftDesde}
                onChange={e => { setDraftDesde(e.target.value); setActivePreset(""); }}
                className="bg-[#014434] border border-[#046C5E] rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-emerald-500/60 [color-scheme:dark]"/>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-white/40">Hasta</span>
              <input type="date" value={draftHasta}
                onChange={e => { setDraftHasta(e.target.value); setActivePreset(""); }}
                className="bg-[#014434] border border-[#046C5E] rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-emerald-500/60 [color-scheme:dark]"/>
            </div>
            <button onClick={applyCustomDates}
              disabled={!isDateStr(draftDesde) || !isDateStr(draftHasta)}
              className="px-4 py-1.5 bg-emerald-700 rounded-lg text-sm font-medium text-white disabled:opacity-30 hover:bg-emerald-600 transition-all">
              Aplicar
            </button>
          </div>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {[
            { label: "Sucursales", value: sucursales.length,                        color: "text-white"     },
            { label: "Unidades",   value: totales.unidades.toLocaleString("es-EC"), color: "text-green-400" },
            { label: "Ventas",     value: money(totales.ventas),                    color: "text-blue-400"  },
            { label: "Facturas",   value: totales.facturas.toLocaleString("es-EC"), color: "text-cyan-400"  },
          ].map(k => (
            <div key={k.label} className="bg-[#013d32] border border-[#046C5E] p-4 rounded-lg">
              <p className="text-xs text-gray-400">{k.label}</p>
              <h2 className={`text-xl md:text-2xl font-bold ${k.color}`}>{k.value}</h2>
              <p className="text-[10px] text-white/30 mt-1">{labelPeriod}</p>
            </div>
          ))}
        </div>

        {/* ── PRODUCTOS VENDIDOS ────────────────────────────────────────────── */}
        <div className="mb-8">
          <h2 className="text-sm font-bold uppercase tracking-widest text-white/50 mb-3">
            Productos Vendidos · {prodSorted.length}
          </h2>

          {prodSorted.length === 0 ? (
            <div className="text-center text-white/30 italic py-10 bg-[#013d32] rounded-2xl border border-[#046C5E]/40">
              Sin productos en el período seleccionado
            </div>
          ) : (
            <div className="rounded-2xl overflow-hidden border border-[#046C5E]/40 shadow-xl">
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead className="bg-[#014434] text-green-300 uppercase text-xs">
                    <tr>
                      <th className="px-3 py-3 text-center w-10">#</th>
                      <ProdTh label="Producto"  col="nombre_producto"/>
                      <ProdTh label="Unidades"  col="total_unidades"  align="right"/>
                      <ProdTh label="Ventas"    col="total_ventas"    align="right"/>
                      <th className="px-3 py-3 text-right text-xs">Precio Promedio</th>
                      <th className="px-3 py-3 text-right text-xs">% Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {prodSorted.map((p, idx) => {
                      const prom = p.total_unidades > 0 ? p.total_ventas / p.total_unidades : 0;
                      return (
                        <tr key={`${p.nombre_producto}-${idx}`}
                          className={`transition-colors ${idx % 2 === 0 ? "bg-[#013d32]" : "bg-[#014f3e]"}`}>
                          <td className="px-3 py-2 text-center text-white/40 text-xs">{idx + 1}</td>
                          <td className="px-3 py-2 font-medium">{p.nombre_producto}</td>
                          <td className="px-3 py-2 text-right text-green-400 font-bold tabular-nums">
                            {p.total_unidades.toLocaleString("es-EC")}
                          </td>
                          <td className="px-3 py-2 text-right text-blue-400 font-bold tabular-nums">
                            {money(p.total_ventas)}
                          </td>
                          <td className="px-3 py-2 text-right text-purple-400 font-bold tabular-nums">
                            {money(prom)}
                          </td>
                          <td className="px-3 py-2 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <div className="w-20 bg-white/10 rounded-full h-1.5 overflow-hidden">
                                <div
                                  className="bg-emerald-400 h-full rounded-full"
                                  style={{ width: `${totalProd > 0 ? (p.total_ventas / totalProd) * 100 : 0}%` }}
                                />
                              </div>
                              <span className="text-white/50 text-xs w-10 text-right">
                                {totalProd > 0 ? ((p.total_ventas / totalProd) * 100).toFixed(1) : "0.0"}%
                              </span>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot className="bg-[#014434] border-t border-[#046C5E] font-bold">
                    {(() => {
                      const totUni = prodSorted.reduce((a, p) => a + p.total_unidades, 0);
                      const promTotal = totUni > 0 ? totalProd / totUni : 0;
                      return (
                        <tr>
                          <td colSpan={2} className="px-3 py-3 text-green-300">TOTAL</td>
                          <td className="px-3 py-3 text-right text-green-400 tabular-nums">
                            {totUni.toLocaleString("es-EC")}
                          </td>
                          <td className="px-3 py-3 text-right text-blue-400 tabular-nums">{money(totalProd)}</td>
                          <td className="px-3 py-3 text-right text-purple-300 tabular-nums">{money(promTotal)}</td>
                          <td className="px-3 py-3 text-right text-white/40 text-xs">100%</td>
                        </tr>
                      );
                    })()}
                  </tfoot>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* ── SUCURSALES ────────────────────────────────────────────────────── */}
        <div>
          <div className="flex flex-col items-center gap-3 mb-4">
            <h2 className="text-sm font-bold uppercase tracking-widest text-white/50">
              Sucursales · {sucFiltered.length}{sucSearch && ` / ${sucSorted.length}`}
            </h2>
            <div className="relative w-full max-w-lg">
              <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-white/30 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M11 19a8 8 0 100-16 8 8 0 000 16z"/>
              </svg>
              <input
                type="text"
                value={sucSearch}
                onChange={e => setSucSearch(e.target.value)}
                placeholder="Buscar por código o dirección..."
                className="w-full bg-[#014434] border border-[#046C5E] rounded-xl pl-11 pr-4 py-2.5 text-sm text-white placeholder-white/30 focus:outline-none focus:border-emerald-500/60 transition-colors"
              />
            </div>
            {sucTotalPages > 1 && (
              <span className="text-xs text-white/30">
                {(safePage - 1) * PAGE_SIZE + 1}–{Math.min(safePage * PAGE_SIZE, sucFiltered.length)} de {sucFiltered.length}
              </span>
            )}
          </div>

          {/* ── Mobile cards ──────────────────────────────────────────────── */}
          <div className="md:hidden space-y-3">
            {sucPageData.map(s => {
              const key       = `${s.codigo_cliente}-${s.codigo_sucursal}`;
              const isOpen    = expanded.has(key);
              const prods     = sucursalProds.get(key);
              return (
                <div key={key}
                  className="bg-gradient-to-br from-[#013d30] to-[#012E24] border border-[#046C5E]/40 rounded-xl overflow-hidden">
                  {/* Cabecera de la card — clicable */}
                  <div className="p-4 cursor-pointer" onClick={() => toggleSucursal(s)}>
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1 min-w-0 pr-2">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className={`text-[10px] transition-transform duration-200 ${isOpen ? "rotate-90" : ""} text-white/40`}>▶</span>
                          <p className="text-[10px] font-mono text-white/40">{s.codigo_sucursal}</p>
                        </div>
                        <p className="text-sm font-medium text-white/80 truncate">
                          {s.nombre_sucursal || s.calle1_direccion || "—"}
                        </p>
                        {s.telefono && (
                          <a
                            href={`tel:${s.telefono}`}
                            onClick={(e) => e.stopPropagation()}
                            className="text-[10px] text-blue-400 hover:underline mt-0.5 inline-block"
                          >
                            📞 {s.telefono}
                          </a>
                        )}
                      </div>
                      {estadoIcon(s.estado_cliente)}
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <div className="text-center">
                        <p className="text-[9px] text-white/40 uppercase">Unidades</p>
                        <p className="text-sm font-bold text-green-400">{s.total_unidades.toLocaleString("es-EC")}</p>
                      </div>
                      <div className="text-center">
                        <p className="text-[9px] text-white/40 uppercase">Ventas</p>
                        <p className="text-sm font-bold text-blue-400">{money(s.total_ventas)}</p>
                      </div>
                      <div className="text-center">
                        <p className="text-[9px] text-white/40 uppercase">Facturas</p>
                        <p className="text-sm font-bold">{s.total_facturas}</p>
                      </div>
                    </div>
                    <div className="mt-2 flex items-center justify-between text-[10px] text-white/40 gap-2">
                      <span className="truncate">{s.tipo_negocio}</span>
                      {hasCoords(s.latitud, s.longitud) ? (
                        <a
                          href={`https://maps.google.com/?q=${s.latitud},${s.longitud}`}
                          target="_blank"
                          rel="noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="text-[10px] text-blue-400 hover:underline border border-blue-400/30 px-2 py-0.5 rounded whitespace-nowrap shrink-0"
                        >
                          📍 Mapa
                        </a>
                      ) : (
                        <span className="text-[10px] text-white/30 italic whitespace-nowrap shrink-0">Sin información</span>
                      )}
                      <span className="shrink-0">{s.ultima_compra ? new Date(s.ultima_compra).toLocaleDateString("es-EC") : "—"}</span>
                    </div>
                  </div>
                  {/* Detalle productos expandido — mobile */}
                  {isOpen && (
                    <div className="border-t border-[#046C5E]/30 bg-[#011f17]">
                      <ProdsSucursal prods={prods} />
                    </div>
                  )}
                </div>
              );
            })}

            {/* Paginación mobile */}
            {sucTotalPages > 1 && (
              <div className="flex items-center justify-center pt-2">
                <Pagination page={safePage} totalPages={sucTotalPages} onChange={p => { setSucPage(p); setExpanded(new Set()); }} />
              </div>
            )}
          </div>

          {/* ── Desktop table ─────────────────────────────────────────────── */}
          <div className="hidden md:block rounded-2xl overflow-hidden border border-[#046C5E]/40 shadow-xl">
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-[#014434] text-green-300 uppercase text-xs">
                  <tr>
                    <th className="px-3 py-3 text-left whitespace-nowrap w-10">#</th>
                    <SucTh label="Cód. Sucursal"      col="codigo_sucursal"/>
                    <SucTh label="Dirección / Nombre" col="nombre_sucursal"/>
                    <th className="px-3 py-3 text-left whitespace-nowrap">Teléfono</th>
                    <SucTh label="Tipo Negocio"        col="tipo_negocio"/>
                    <SucTh label="Estado"              col="estado_cliente" align="center"/>
                    <SucTh label="Unidades"            col="total_unidades" align="right"/>
                    <SucTh label="Ventas"              col="total_ventas"   align="right"/>
                    <SucTh label="Facturas"            col="total_facturas" align="right"/>
                    <SucTh label="Última Compra"       col="ultima_compra"  align="right"/>
                    <th className="px-3 py-3 text-center whitespace-nowrap">Mapa</th>
                  </tr>
                </thead>
                <tbody>
                  {sucPageData.length === 0 ? (
                    <tr>
                      <td colSpan={11} className="px-4 py-10 text-center text-white/30 italic">
                        Sin actividad en el período seleccionado
                      </td>
                    </tr>
                  ) : sucPageData.map((s, idx) => {
                    const key      = `${s.codigo_cliente}-${s.codigo_sucursal}`;
                    const isOpen   = expanded.has(key);
                    const prods    = sucursalProds.get(key);
                    const globalN  = (safePage - 1) * PAGE_SIZE + idx + 1;
                    const rowBg    = idx % 2 === 0 ? "bg-[#013d32]" : "bg-[#014f3e]";

                    return (
                      <React.Fragment key={key}>
                        {/* Fila principal */}
                        <tr onClick={() => toggleSucursal(s)}
                          className={`cursor-pointer transition-colors ${rowBg} hover:bg-[#025940] group`}>
                          {/* # con flecha */}
                          <td className="px-3 py-2 text-xs text-white/40 w-10">
                            <span className="inline-flex items-center gap-1.5 select-none">
                              <span className={`text-[10px] text-emerald-400/60 transition-transform duration-200 inline-block ${isOpen ? "rotate-90" : ""}`}>
                                ▶
                              </span>
                              <span className="text-white/30">{globalN}</span>
                            </span>
                          </td>
                          <td className="px-3 py-2 font-mono text-xs text-white/50">{s.codigo_sucursal}</td>
                          <td className="px-3 py-2 text-xs text-white/80 max-w-[220px]">
                            <span className="truncate block" title={s.nombre_sucursal}>
                              {s.nombre_sucursal || s.calle1_direccion || <span className="text-white/30 italic">—</span>}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-white/70 text-xs whitespace-nowrap">
                            {s.telefono
                              ? <a href={`tel:${s.telefono}`} onClick={(e) => e.stopPropagation()} className="hover:text-blue-400 hover:underline">{s.telefono}</a>
                              : <span className="text-white/30">—</span>}
                          </td>
                          <td className="px-3 py-2 text-white/60 text-xs">{s.tipo_negocio}</td>
                          <td className="px-3 py-2 text-center">{estadoIcon(s.estado_cliente)}</td>
                          <td className="px-3 py-2 text-right text-green-400 font-bold tabular-nums">
                            {s.total_unidades.toLocaleString("es-EC")}
                          </td>
                          <td className="px-3 py-2 text-right text-blue-400 font-bold tabular-nums">
                            {money(s.total_ventas)}
                          </td>
                          <td className="px-3 py-2 text-right text-white/70 tabular-nums">{s.total_facturas}</td>
                          <td className="px-3 py-2 text-right text-white/60 text-xs whitespace-nowrap">
                            {s.ultima_compra ? new Date(s.ultima_compra).toLocaleDateString("es-EC") : "—"}
                          </td>
                          <td className="px-3 py-2 text-center" onClick={(e) => e.stopPropagation()}>
                            {hasCoords(s.latitud, s.longitud)
                              ? <a href={`https://maps.google.com/?q=${s.latitud},${s.longitud}`}
                                  target="_blank" rel="noreferrer"
                                  className="text-[10px] text-blue-400 hover:underline border border-blue-400/30 px-2 py-0.5 rounded whitespace-nowrap">
                                  📍 Mapa
                                </a>
                              : <span className="text-[10px] text-white/40 italic whitespace-nowrap">Sin información</span>
                            }
                          </td>
                        </tr>

                        {/* Fila expandida — productos de la sucursal */}
                        {isOpen && (
                          <tr>
                            <td colSpan={11} className="p-0 border-b border-[#046C5E]/20">
                              <div className="bg-[#011f17] border-l-2 border-emerald-500/40">
                                {/* Encabezado de la sucursal expandida */}
                                <div className="flex items-center gap-3 px-5 py-2 border-b border-[#046C5E]/20">
                                  <span className="text-[10px] text-emerald-400/60 uppercase tracking-widest font-semibold">
                                    Productos · {s.nombre_sucursal || s.codigo_sucursal}
                                  </span>
                                </div>
                                <ProdsSucursal prods={prods} />
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
                <tfoot className="bg-[#014434] border-t border-[#046C5E] font-bold text-sm">
                  <tr>
                    <td colSpan={6} className="px-3 py-3 text-green-300">
                      TOTAL · {sucFiltered.length} sucursales / direcciones
                    </td>
                    <td className="px-3 py-3 text-right text-green-400 tabular-nums">
                      {sucSorted.reduce((a, s) => a + s.total_unidades, 0).toLocaleString("es-EC")}
                    </td>
                    <td className="px-3 py-3 text-right text-blue-400 tabular-nums">
                      {money(sucSorted.reduce((a, s) => a + s.total_ventas, 0))}
                    </td>
                    <td className="px-3 py-3 text-right text-white/70 tabular-nums">
                      {sucSorted.reduce((a, s) => a + s.total_facturas, 0).toLocaleString("es-EC")}
                    </td>
                    <td/>
                    <td/>
                  </tr>
                </tfoot>
              </table>
            </div>

            {/* Paginación desktop */}
            <Pagination
              page={safePage}
              totalPages={sucTotalPages}
              onChange={p => { setSucPage(p); setExpanded(new Set()); }}
            />
          </div>
        </div>

      </div>
    </DashboardLayout>
  );
}
