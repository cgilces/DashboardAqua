import React, { useEffect, useMemo, useState, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import * as XLSX from "xlsx";
import { BsDownload } from "react-icons/bs";
import { X, Users, CalendarDays } from "lucide-react";
import DashboardLayout from "../../layout/DashboardLayout";
import { Header } from "../../components/common/Header";
import { API_BASE_URL } from "../../config";
import AlertasRecuperacion from "../../components/ComponentClientes/AlertasRecuperacion";
import DeclieveConsumo from "../../components/ComponentClientes/DeclieveConsumo";
import ClientesNuevos from "../../components/ComponentClientes/ClientesNuevos";
import RecoveryRate from "../../components/ComponentClientes/RecoveryRate";
import SaludRutas from "../../components/ComponentClientes/SaludRutas";
import MapaClientes from "../../components/ComponentClientes/MapaClientes";

// ─── Types ────────────────────────────────────────────────────────────────────
// Una fila por empresa (ya agrupado por el backend)
type EmpresaRow = {
  group_key: string;
  ruc: string;
  company_id: string;
  descripcion_company: string;
  nombre_cliente: string;
  num_sucursales: number;
  total_ventas: number;
  total_unidades: number;
  total_facturas: number;
  ultima_compra?: string;
  estado_cliente: string;
  tipo_pago: string;
  tiene_credito: boolean;
  tipo_negocio: string;
  vendedores: string;
};
type SortCol = "nombre" | "ruc" | "estado_cliente" | "compania" | "unidades" | "dolares" | "facturas" | "tipo_negocio" | "tipo_pago" | "ultima_compra" | "";
type SortDir = "asc" | "desc";

// ─── Constants ────────────────────────────────────────────────────────────────
const PAGE_SIZE = 100;
const ESTADO_PRIO: Record<string, number> = { ACTIVO: 4, RIESGO: 3, INACTIVO: 2, "SIN COMPRAS": 1 };

// ─── Helpers ──────────────────────────────────────────────────────────────────
const money  = (n = 0) => Number(n).toLocaleString("es-EC", { style: "currency", currency: "USD" });
const fmtD   = (d: Date) => d.toISOString().slice(0, 10);
const isDate = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s);

const ESTADO_CFG: Record<string, { dot: string; badge: string; label: string }> = {
  ACTIVO:        { dot: "bg-green-500",  badge: "text-green-400 bg-green-500/15 border-green-500/30",    label: "Activo"      },
  RIESGO:        { dot: "bg-yellow-400", badge: "text-yellow-400 bg-yellow-400/15 border-yellow-400/30", label: "Riesgo"      },
  INACTIVO:      { dot: "bg-red-500",    badge: "text-red-400 bg-red-500/15 border-red-500/30",           label: "Inactivo"    },
  "SIN COMPRAS": { dot: "bg-gray-500",   badge: "text-gray-400 bg-gray-500/15 border-gray-500/30",        label: "Sin Compras" },
};
const estadoIcon = (e?: string) => {
  const cfg = ESTADO_CFG[e || ""] ?? { dot: "bg-gray-400", badge: "text-gray-400 bg-gray-500/15 border-gray-500/30", label: "—" };
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
];
function calcPreset(id: string): { desde: string; hasta: string } {
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

// ─── MultiSelect (dropdown con búsqueda + checkboxes) ────────────────────────
type MultiSelectOpt = { value: string; label: string; hint?: string };
function MultiSelect({
  options, selected, onToggle, placeholder, emptyLabel, className = "",
}: {
  options:   MultiSelectOpt[];
  selected:  string[];
  onToggle:  (v: string) => void;
  placeholder: string;
  emptyLabel:  string;
  className?:  string;
}) {
  const [open, setOpen]   = useState(false);
  const [query, setQuery] = useState("");
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onDoc = (ev: MouseEvent) => {
      if (!wrapRef.current?.contains(ev.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const q = query.trim().toLowerCase();
  const filtered = useMemo(
    () => (q ? options.filter(o => o.label.toLowerCase().includes(q) || (o.hint ?? "").toLowerCase().includes(q)) : options).slice(0, 500),
    [options, q]
  );

  const label = selected.length === 0
    ? placeholder
    : selected.length === 1
      ? (options.find(o => o.value === selected[0])?.label ?? selected[0])
      : `${selected.length} seleccionados`;

  return (
    <div ref={wrapRef} className={`relative ${className}`}>
      <button type="button" onClick={() => setOpen(o => !o)}
        className="w-full bg-[#014434] border border-[#046C5E] rounded-lg px-3 py-2 text-sm text-white text-left focus:outline-none focus:border-emerald-500/60 flex items-center justify-between gap-2">
        <span className={`truncate ${selected.length ? "" : "text-white/40"}`}>{label}</span>
        <svg className={`w-4 h-4 shrink-0 transition-transform ${open ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7"/>
        </svg>
      </button>
      {open && (
        <div className="absolute z-30 mt-1 w-full bg-[#014434] border border-[#046C5E] rounded-lg shadow-2xl max-h-80 overflow-hidden flex flex-col">
          <div className="p-2 border-b border-[#046C5E]/40">
            <input autoFocus value={query} onChange={e => setQuery(e.target.value)}
              placeholder="Buscar..."
              className="w-full bg-[#012E24] border border-[#046C5E]/60 rounded px-2 py-1 text-sm text-white placeholder-white/30 focus:outline-none focus:border-emerald-500/60"/>
          </div>
          <div className="overflow-y-auto flex-1">
            {filtered.length === 0 ? (
              <p className="text-center text-white/40 text-xs py-4">{emptyLabel}</p>
            ) : filtered.map(o => {
              const checked = selected.includes(o.value);
              return (
                <label key={o.value}
                  className={`flex items-start gap-2 px-3 py-1.5 cursor-pointer text-xs hover:bg-[#025940] ${checked ? "bg-emerald-500/10" : ""}`}>
                  <input type="checkbox" checked={checked} onChange={() => onToggle(o.value)}
                    className="mt-0.5 accent-emerald-500 shrink-0"/>
                  <div className="flex-1 min-w-0">
                    <p className="text-white/90 truncate">{o.label}</p>
                    {o.hint && <p className="text-[10px] text-white/40 truncate">{o.hint}</p>}
                  </div>
                </label>
              );
            })}
          </div>
          {selected.length > 0 && (
            <div className="border-t border-[#046C5E]/40 px-2 py-1.5 flex items-center justify-between text-[11px]">
              <span className="text-emerald-300">{selected.length} seleccionados</span>
              <button type="button" onClick={() => selected.forEach(onToggle)}
                className="text-white/60 hover:text-red-400 transition-colors">Limpiar</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function DashboardClientesTabla() {
  const navigate = useNavigate();

  // Server-side filters → causan re-fetch
  const [sfDesde,    setSfDesde]    = useState("");
  const [sfHasta,    setSfHasta]    = useState("");
  const [sfProductos,  setSfProductos]  = useState<string[]>([]);
  const [sfCategorias, setSfCategorias] = useState<string[]>([]);
  const [draftDesde,    setDraftDesde]    = useState("");
  const [draftHasta,    setDraftHasta]    = useState("");

  // Catálogo de productos (para poblar selects)
  const [catalogo, setCatalogo] = useState<{ productos: { descripcion: string; categoria: string; usos: number }[]; categorias: string[] }>({ productos: [], categorias: [] });
  const [catalogoLoading, setCatalogoLoading] = useState(false);

  // Clientes seleccionados (por group_key) para consolidado y exportación
  const [seleccionados, setSeleccionados] = useState<Set<string>>(new Set());

  // Client-side filters (instantáneos, sin re-fetch)
  const [fEstados,     setFEstados]     = useState<string[]>([]);
  const [fTipoPago,    setFTipoPago]    = useState<string[]>([]);
  const [fTipoNegocio, setFTipoNegocio] = useState("");
  const [fVendedor,    setFVendedor]    = useState("");
  const [fCompania,    setFCompania]    = useState("");
  const [inputQuery,   setInputQuery]   = useState("");

  // UI
  const [filtersOpen,  setFiltersOpen]  = useState(false);
  const [activePreset, setActivePreset] = useState("");

  // Data — el backend ya devuelve filas agrupadas por empresa
  const [empresas,       setEmpresas]       = useState<EmpresaRow[]>([]);
  const [initialLoading, setInitialLoading] = useState(true);
  const [isFetching,     setIsFetching]     = useState(false);

  // Sort & page
  const [page,    setPage]    = useState(1);
  const [sortKey, setSortKey] = useState<SortCol>("dolares");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  // ── Fetch ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    const ctrl = new AbortController();
    const cargar = async () => {
      empresas.length > 0 ? setIsFetching(true) : setInitialLoading(true);
      try {
        const p = new URLSearchParams();
        if (sfDesde && sfHasta) { p.set("desde", sfDesde); p.set("hasta", sfHasta); }
        if (sfProductos.length)  p.set("productos",  sfProductos.join("|||"));
        if (sfCategorias.length) p.set("categorias", sfCategorias.join("|||"));
        const res  = await fetch(`${API_BASE_URL}/api/dashboard-clientes/resumen?${p}`, { signal: ctrl.signal });
        const json = await res.json();
        if (!json.ok) throw new Error();
        // El backend devuelve filas ya agrupadas por empresa
        setEmpresas((json.data || []).map((r: any): EmpresaRow => ({
          group_key:           r.group_key            ?? r.ruc ?? "",
          ruc:                 r.ruc                  ?? "",
          company_id:          r.company_id           ?? "0",
          descripcion_company: r.descripcion_company  ?? "SIN COMPAÑÍA",
          nombre_cliente:      r.nombre_cliente       ?? "-",
          num_sucursales:      Number(r.num_sucursales || 1),
          total_ventas:        Number(r.total_ventas   || 0),
          total_unidades:      Number(r.total_unidades || 0),
          total_facturas:      Number(r.total_facturas || 0),
          ultima_compra:       r.ultima_compra,
          estado_cliente:      r.estado_cliente       ?? "SIN COMPRAS",
          tipo_pago:           r.tipo_pago            ?? "CONTADO",
          tiene_credito:       Boolean(r.tiene_credito),
          tipo_negocio:        r.tipo_negocio         ?? "SIN CLASIFICAR",
          vendedores:          r.vendedores           ?? "-",
        })));
      } catch (err: any) {
        if (err?.name === "AbortError") return;
        setEmpresas([]);
      } finally {
        setInitialLoading(false);
        setIsFetching(false);
      }
    };
    cargar();
    return () => ctrl.abort();
  }, [sfDesde, sfHasta, sfProductos, sfCategorias]);

  // ── Fetch catálogo de productos ───────────────────────────────────────────
  useEffect(() => {
    const ctrl = new AbortController();
    const cargarCatalogo = async () => {
      setCatalogoLoading(true);
      try {
        const p = new URLSearchParams();
        if (sfDesde && sfHasta) { p.set("desde", sfDesde); p.set("hasta", sfHasta); }
        const res  = await fetch(`${API_BASE_URL}/api/dashboard-clientes/catalogo-productos?${p}`, { signal: ctrl.signal });
        const json = await res.json();
        if (json.ok) setCatalogo({ productos: json.productos || [], categorias: json.categorias || [] });
      } catch (err: any) {
        if (err?.name !== "AbortError") setCatalogo({ productos: [], categorias: [] });
      } finally {
        setCatalogoLoading(false);
      }
    };
    cargarCatalogo();
    return () => ctrl.abort();
  }, [sfDesde, sfHasta]);

  // ── Actions ───────────────────────────────────────────────────────────────
  const applyPreset = (id: string) => {
    const { desde, hasta } = calcPreset(id);
    setActivePreset(id); setDraftDesde(desde); setDraftHasta(hasta);
    setSfDesde(desde); setSfHasta(hasta); setPage(1);
  };
  const applyCustomDates = () => {
    if (isDate(draftDesde) && isDate(draftHasta)) {
      setActivePreset(""); setSfDesde(draftDesde); setSfHasta(draftHasta);
      setPage(1);
    }
  };
  const clearDates = () => {
    setActivePreset(""); setDraftDesde(""); setDraftHasta("");
    setSfDesde(""); setSfHasta(""); setPage(1);
  };
  const toggleEstado   = (e: string) => { setFEstados(p => p.includes(e) ? p.filter(x=>x!==e) : [...p,e]); setPage(1); };
  const toggleTipoPago = (t: string) => { setFTipoPago(p => p.includes(t) ? p.filter(x=>x!==t) : [...p,t]); setPage(1); };
  const toggleProducto  = (d: string) => { setSfProductos(p  => p.includes(d) ? p.filter(x=>x!==d) : [...p,d]);  setPage(1); };
  const toggleCategoria = (c: string) => { setSfCategorias(p => p.includes(c) ? p.filter(x=>x!==c) : [...p,c]); setPage(1); };
  const clearAllFilters = () => {
    clearDates(); setSfProductos([]); setSfCategorias([]);
    setFEstados([]); setFTipoPago([]); setFTipoNegocio(""); setFVendedor(""); setFCompania("");
    setInputQuery(""); setSeleccionados(new Set()); setPage(1);
  };
  const navigateToEmpresa = (e: EmpresaRow) => {
    const companyParam = e.company_id && e.company_id !== '0' ? `?company_id=${e.company_id}` : '';
    if (e.ruc) {
      navigate(`/dashboard/empresa/${encodeURIComponent(e.ruc)}${companyParam}`);
    } else {
      // Sin RUC: navegar usando el codigo_cliente (antes del :: en group_key)
      const key = e.group_key.split('::')[0];
      navigate(`/dashboard/empresa/${encodeURIComponent(key)}${companyParam}`);
    }
  };

  // ── Sort ──────────────────────────────────────────────────────────────────
  const handleSort = useCallback((col: SortCol) => {
    setSortDir(prev => sortKey === col && prev === "desc" ? "asc" : "desc");
    setSortKey(col); setPage(1);
  }, [sortKey]);

  // ── Derived options para filtros ──────────────────────────────────────────
  const tiposNegocioOpts = useMemo(() => {
    const set = new Set<string>();
    for (const e of empresas) {
      // tipo_negocio puede ser "A / B / C" (concatenado del backend)
      e.tipo_negocio.split(" / ").forEach(t => { if (t && t !== "SIN CLASIFICAR") set.add(t); });
    }
    return [...set].sort();
  }, [empresas]);

  const vendedoresOpts = useMemo(() => {
    const set = new Set<string>();
    for (const e of empresas) {
      e.vendedores.split(", ").forEach(v => { if (v && v !== "-") set.add(v); });
    }
    return [...set].sort();
  }, [empresas]);

  const companiasOpts = useMemo(() => {
    const set = new Set<string>();
    for (const e of empresas) {
      if (e.descripcion_company && e.descripcion_company !== "SIN COMPAÑÍA") set.add(e.descripcion_company);
    }
    return [...set].sort();
  }, [empresas]);

  // ── Client-side filter ────────────────────────────────────────────────────
  const filteredData = useMemo(() => {
    let data = [...empresas];
    if (inputQuery.trim()) {
      const q = inputQuery.trim().toLowerCase();
      data = data.filter(r =>
        r.nombre_cliente?.toLowerCase().includes(q) ||
        r.ruc?.toLowerCase().includes(q)            ||
        r.descripcion_company?.toLowerCase().includes(q) ||
        r.vendedores?.toLowerCase().includes(q)
      );
    }
    if (fEstados.length)  data = data.filter(r => fEstados.includes(r.estado_cliente || ""));
    if (fTipoPago.length) data = data.filter(r => fTipoPago.includes(r.tipo_pago || ""));
    // tipo_negocio puede ser "A / B" → incluye si alguno de los tipos coincide
    if (fTipoNegocio) data = data.filter(r => r.tipo_negocio.split(" / ").includes(fTipoNegocio));
    // vendedores puede ser "VND01, VND02" → incluye si alguno coincide
    if (fVendedor)    data = data.filter(r => r.vendedores.split(", ").includes(fVendedor));
    // compañía
    if (fCompania)    data = data.filter(r => r.descripcion_company === fCompania);
    return data;
  }, [empresas, inputQuery, fEstados, fTipoPago, fTipoNegocio, fVendedor, fCompania]);

  useEffect(() => { setPage(1); }, [inputQuery, fEstados, fTipoPago, fTipoNegocio, fVendedor, fCompania]);

  // ── Sort sobre filteredData ───────────────────────────────────────────────
  const sortedData = useMemo((): EmpresaRow[] => {
    const data = [...filteredData];
    if (sortKey) {
      data.sort((a, b) => {
        let av: any, bv: any;
        switch (sortKey) {
          case "dolares":        av = a.total_ventas;   bv = b.total_ventas;   break;
          case "unidades":       av = a.total_unidades; bv = b.total_unidades; break;
          case "facturas":       av = a.total_facturas; bv = b.total_facturas; break;
          case "nombre":         av = a.nombre_cliente; bv = b.nombre_cliente; break;
          case "ruc":            av = a.ruc;            bv = b.ruc;            break;
          case "compania":       av = a.descripcion_company; bv = b.descripcion_company; break;
          case "ultima_compra":  av = a.ultima_compra || ""; bv = b.ultima_compra || ""; break;
          case "estado_cliente": av = ESTADO_PRIO[a.estado_cliente]||0; bv = ESTADO_PRIO[b.estado_cliente]||0; break;
          case "tipo_negocio":   av = a.tipo_negocio;   bv = b.tipo_negocio;   break;
          case "tipo_pago":      av = a.tipo_pago;      bv = b.tipo_pago;      break;
          default:               av = a.total_ventas;   bv = b.total_ventas;
        }
        if (typeof av === "number" && typeof bv === "number")
          return sortDir === "asc" ? av - bv : bv - av;
        return sortDir === "asc"
          ? String(av ?? "").localeCompare(String(bv ?? ""))
          : String(bv ?? "").localeCompare(String(av ?? ""));
      });
    } else {
      data.sort((a, b) => b.total_ventas - a.total_ventas);
    }
    return data;
  }, [filteredData, sortKey, sortDir]);

  // ── Pagination ────────────────────────────────────────────────────────────
  const totalPages = Math.max(1, Math.ceil(sortedData.length / PAGE_SIZE));
  const pageData   = sortedData.slice((page-1)*PAGE_SIZE, page*PAGE_SIZE);

  // ── KPIs (sobre datos filtrados, nivel empresa) ───────────────────────────
  const kpiVentas  = filteredData.reduce((a, r) => a + r.total_ventas,   0);
  const kpiFact    = filteredData.reduce((a, r) => a + r.total_facturas,  0);
  const kpiTicket  = kpiFact > 0 ? kpiVentas / kpiFact : 0;
  const kpiCredito = filteredData.filter(r => r.tiene_credito).length;
  const kpiActivos = filteredData.filter(r => r.estado_cliente === "ACTIVO").length;

  // ── Active filters count ──────────────────────────────────────────────────
  const activeCount = [
    sfDesde && sfHasta, sfProductos.length > 0, sfCategorias.length > 0,
    fEstados.length > 0, fTipoPago.length > 0,
    fTipoNegocio, fVendedor, fCompania,
  ].filter(Boolean).length;

  // ── Page numbers ──────────────────────────────────────────────────────────
  const pageNumbers = useMemo(() => {
    const delta = 2; const range: (number|"...")[] = [];
    const left = Math.max(2, page-delta); const right = Math.min(totalPages-1, page+delta);
    range.push(1);
    if (left > 2)             range.push("...");
    for (let i=left; i<=right; i++) range.push(i);
    if (right < totalPages-1) range.push("...");
    if (totalPages > 1)       range.push(totalPages);
    return range;
  }, [page, totalPages]);

  // ── Arrow helper ──────────────────────────────────────────────────────────
  const Arr = ({ col }: { col: SortCol }) => (
    <span className="ml-1 opacity-50 text-[10px]">
      {sortKey === col ? (sortDir === "asc" ? "↑" : "↓") : "↕"}
    </span>
  );
  const Th = ({ label, col, align="left" }: { label: string; col: SortCol; align?: "left"|"right"|"center" }) => (
    <th onClick={() => handleSort(col)}
      className={`px-3 py-3 text-${align} cursor-pointer hover:text-white whitespace-nowrap select-none transition-colors`}>
      {label}<Arr col={col}/>
    </th>
  );

  // ── Chip helper ───────────────────────────────────────────────────────────
  const Chip = ({ label, onRemove }: { label: string; onRemove: () => void }) => (
    <span className="inline-flex items-center gap-1 px-2 py-1 bg-emerald-600/20 border border-emerald-500/40 rounded-full text-xs text-emerald-300 shrink-0">
      {label}
      <button onClick={onRemove} className="ml-0.5 hover:text-white transition-colors leading-none"><X size={12} /></button>
    </span>
  );

  // ── Selección multi-cliente ───────────────────────────────────────────────
  const toggleSeleccion = (key: string) => {
    setSeleccionados(prev => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };
  const toggleSeleccionarPagina = () => {
    setSeleccionados(prev => {
      const next   = new Set(prev);
      const todos  = pageData.every(r => next.has(r.group_key));
      if (todos) pageData.forEach(r => next.delete(r.group_key));
      else       pageData.forEach(r => next.add(r.group_key));
      return next;
    });
  };
  const limpiarSeleccion = () => setSeleccionados(new Set());

  // Datos para exportar / resumen seleccionados
  const clientesSeleccionados = useMemo(
    () => filteredData.filter(r => seleccionados.has(r.group_key)),
    [filteredData, seleccionados]
  );
  const resumenSel = useMemo(() => ({
    ventas:   clientesSeleccionados.reduce((a, r) => a + r.total_ventas,    0),
    unidades: clientesSeleccionados.reduce((a, r) => a + r.total_unidades,  0),
    facturas: clientesSeleccionados.reduce((a, r) => a + r.total_facturas,  0),
    activos:  clientesSeleccionados.filter(r => r.estado_cliente === "ACTIVO").length,
  }), [clientesSeleccionados]);

  // ── Exportar a Excel ──────────────────────────────────────────────────────
  const exportarExcel = () => {
    const data = seleccionados.size > 0 ? clientesSeleccionados : filteredData;
    if (!data.length) return;
    const rows = data.map((r, i) => ({
      "N°":             i + 1,
      "RUC / Cédula":   r.ruc || "",
      "Cliente":        r.nombre_cliente,
      "Compañía":       r.descripcion_company,
      "Estado":         r.estado_cliente,
      "Tipo Negocio":   r.tipo_negocio,
      "Tipo Pago":      r.tipo_pago,
      "Sucursales":     r.num_sucursales,
      "Unidades":       r.total_unidades,
      "Ventas USD":     r.total_ventas,
      "Facturas":       r.total_facturas,
      "Última Compra":  r.ultima_compra || "",
      "Vendedores":     r.vendedores,
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Clientes");
    const hoy   = new Date().toISOString().slice(0,10);
    const marca = seleccionados.size > 0 ? `seleccionados_${seleccionados.size}` : "filtrados";
    XLSX.writeFile(wb, `clientes_${marca}_${hoy}.xlsx`);
  };

  // ── Loading ───────────────────────────────────────────────────────────────
  if (initialLoading)
    return (
      <DashboardLayout>
        <div className="flex flex-col justify-center items-center py-32 gap-4">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-emerald-400"/>
          <p className="text-gray-400 text-sm">Cargando datos…</p>
        </div>
      </DashboardLayout>
    );

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <DashboardLayout>
      <div className="main-content min-h-screen text-white px-2 sm:px-4 md:px-10 py-3 md:py-6">
        <Header/>

        {/* Title */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-5 sm:mb-6 gap-3 pt-4 sm:pt-0">
          <div className="flex items-center gap-3 flex-wrap min-w-0">
            <h1 className="text-lg sm:text-xl md:text-2xl lg:text-3xl font-bold tracking-wide leading-tight flex items-center gap-2">
              <Users className="text-emerald-400" size={28} />
              DASHBOARD CLIENTES
            </h1>
            {isFetching && (
              <span className="flex items-center gap-2 text-xs sm:text-sm text-emerald-400">
                <span className="w-4 h-4 border-2 border-emerald-400/20 border-t-emerald-400 rounded-full animate-spin"/>
                Actualizando…
              </span>
            )}
          </div>
          <button onClick={exportarExcel}
            disabled={filteredData.length === 0}
            className="flex items-center justify-center gap-2 px-4 py-2 rounded-lg border border-[#0db48b]/60 bg-[#0db48b]/20 text-white font-semibold hover:bg-[#0db48b]/30 active:scale-[0.98] transition-all disabled:opacity-40 disabled:cursor-not-allowed w-full sm:w-auto">
            <BsDownload size={16}/>
            <span className="whitespace-nowrap text-sm">
              Exportar{seleccionados.size > 0 ? ` (${seleccionados.size})` : filteredData.length !== empresas.length ? " filtrados" : ""}
            </span>
          </button>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
          {[
            { label: "Clientes",         value: filteredData.length.toLocaleString("es-EC"), color: "text-white"      },
            { label: "Activos",          value: kpiActivos.toLocaleString("es-EC"),           color: "text-green-400"  },
            { label: "Ventas Totales",   value: money(kpiVentas),                             color: "text-blue-400"   },
            { label: "Ticket Promedio",  value: money(kpiTicket),                             color: "text-cyan-400"   },
            { label: "Clientes Crédito", value: kpiCredito.toLocaleString("es-EC"),           color: "text-yellow-400" },
          ].map(k => (
            <div key={k.label} className="bg-[#013d32] border border-[#046C5E] p-4 rounded-lg">
              <p className="text-xs text-gray-400">{k.label}</p>
              <h2 className={`text-xl md:text-2xl font-bold ${k.color}`}>{k.value}</h2>
            </div>
          ))}
        </div>

        {/* Alertas de recuperación de clientes inactivos (consumo = 0) */}
        <AlertasRecuperacion />

        {/* Módulo 2: detector de declive de consumo activo (siguen comprando pero menos) */}
        <DeclieveConsumo />

        {/* Módulo 1: clientes nuevos por canal */}
        <ClientesNuevos />

        {/* Salud por ruta: nuevos vs perdidos */}
        <SaludRutas />

        {/* Mapa geográfico de clientes */}
        <MapaClientes />

        {/* Recovery rate por vendedor (analítica de gestión) */}
        <RecoveryRate />

        {/* Filter toggle + chips */}
        <div className="flex flex-wrap items-center gap-2 mb-4">
          <button onClick={() => setFiltersOpen(o => !o)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg border text-sm font-medium transition-all shrink-0 ${
              filtersOpen || activeCount > 0
                ? "bg-emerald-600/20 border-emerald-500 text-emerald-300"
                : "bg-[#013d32] border-[#046C5E] text-white/60 hover:text-white hover:border-emerald-500/50"
            }`}>
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round"
                d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2a1 1 0 01-.293.707L13 13.414V19a1 1 0 01-.553.894l-4 2A1 1 0 017 21v-7.586L3.293 6.707A1 1 0 013 6V4z"/>
            </svg>
            Filtros
            {activeCount > 0 && (
              <span className="bg-emerald-500 text-white text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
                {activeCount}
              </span>
            )}
          </button>
          {sfDesde && sfHasta && (
            <Chip label={sfDesde === sfHasta ? sfDesde : `${sfDesde} → ${sfHasta}`} onRemove={clearDates}/>
          )}
          {sfProductos.map(p  => <Chip key={`p-${p}`}  label={`Prod: ${p}`} onRemove={() => toggleProducto(p)}/>)}
          {sfCategorias.map(c => <Chip key={`c-${c}`}  label={`Cat: ${c}`}  onRemove={() => toggleCategoria(c)}/>)}
          {fEstados.map(e => <Chip key={e} label={ESTADO_CFG[e]?.label ?? e} onRemove={() => toggleEstado(e)}/>)}
          {fTipoPago.map(t => <Chip key={t} label={t} onRemove={() => toggleTipoPago(t)}/>)}
          {fTipoNegocio && <Chip label={fTipoNegocio} onRemove={() => setFTipoNegocio("")}/>}
          {fVendedor    && <Chip label={`Vend: ${fVendedor}`} onRemove={() => setFVendedor("")}/>}
          {fCompania    && <Chip label={`Comp: ${fCompania}`} onRemove={() => setFCompania("")}/>}
          {activeCount > 0 && (
            <button onClick={clearAllFilters}
              className="text-xs text-white/30 hover:text-red-400 transition-colors underline underline-offset-2 shrink-0">
              Limpiar todo
            </button>
          )}
        </div>

        {/* Filter panel */}
        {filtersOpen && (
          <div className="bg-[#013d32] border border-[#046C5E]/60 rounded-2xl p-4 md:p-6 mb-6 space-y-5">
            {/* Período */}
            <div>
              <p className="text-[10px] text-white/40 uppercase tracking-widest font-semibold mb-3">Período</p>
              <div className="flex flex-wrap gap-2 mb-3">
                {PRESETS.map(pr => (
                  <button key={pr.id} onClick={() => applyPreset(pr.id)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                      activePreset === pr.id
                        ? "bg-emerald-600 border-emerald-500 text-white"
                        : "bg-[#014434] border-[#046C5E] text-white/60 hover:text-white hover:border-emerald-500/50"
                    }`}>{pr.label}</button>
                ))}
                {(sfDesde || sfHasta) && (
                  <button onClick={clearDates}
                    className="px-3 py-1.5 rounded-lg text-xs border border-red-500/30 text-red-400 hover:bg-red-500/10 transition-all">
                    Quitar fechas
                  </button>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-white/40">Desde</span>
                  <div className="relative">
                    <CalendarDays size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-white/50 pointer-events-none" />
                    <input type="date" value={draftDesde}
                      onChange={e => { setDraftDesde(e.target.value); setActivePreset(""); }}
                      className="bg-[#014434] border border-[#046C5E] rounded-lg pl-8 pr-3 py-1.5 text-sm text-white focus:outline-none focus:border-emerald-500/60 [color-scheme:dark]"/>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-white/40">Hasta</span>
                  <div className="relative">
                    <CalendarDays size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-white/50 pointer-events-none" />
                    <input type="date" value={draftHasta}
                      onChange={e => { setDraftHasta(e.target.value); setActivePreset(""); }}
                      className="bg-[#014434] border border-[#046C5E] rounded-lg pl-8 pr-3 py-1.5 text-sm text-white focus:outline-none focus:border-emerald-500/60 [color-scheme:dark]"/>
                  </div>
                </div>
                <button onClick={applyCustomDates}
                  disabled={!isDate(draftDesde) || !isDate(draftHasta)}
                  className="px-4 py-1.5 bg-emerald-700 rounded-lg text-sm font-medium text-white disabled:opacity-30 hover:bg-emerald-600 transition-all">
                  Aplicar rango
                </button>
              </div>
            </div>
            <div className="h-px bg-[#046C5E]/30"/>

            {/* Estado */}
            <div>
              <p className="text-[10px] text-white/40 uppercase tracking-widest font-semibold mb-3">Estado del cliente</p>
              <div className="flex flex-wrap gap-2">
                {Object.entries(ESTADO_CFG).map(([key, cfg]) => (
                  <button key={key} onClick={() => toggleEstado(key)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                      fEstados.includes(key) ? `${cfg.badge} border-current` : "bg-[#014434] border-[#046C5E] text-white/50 hover:text-white hover:border-white/20"
                    }`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`}/>{cfg.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="h-px bg-[#046C5E]/30"/>

            {/* Tipo pago */}
            <div>
              <p className="text-[10px] text-white/40 uppercase tracking-widest font-semibold mb-3">Tipo de pago</p>
              <div className="flex gap-2">
                {["CREDITO","CONTADO"].map(t => (
                  <button key={t} onClick={() => toggleTipoPago(t)}
                    className={`px-4 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                      fTipoPago.includes(t) ? "bg-yellow-500/20 border-yellow-500 text-yellow-300" : "bg-[#014434] border-[#046C5E] text-white/50 hover:text-white hover:border-yellow-500/40"
                    }`}>{t}</button>
                ))}
              </div>
            </div>
            <div className="h-px bg-[#046C5E]/30"/>

            {/* Dropdowns */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="text-[10px] text-white/40 uppercase tracking-widest font-semibold block mb-2">Compañía</label>
                <select value={fCompania} onChange={e => { setFCompania(e.target.value); setPage(1); }}
                  className="w-full bg-[#014434] border border-[#046C5E] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500/60">
                  <option value="">Todas las compañías</option>
                  {companiasOpts.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="text-[10px] text-white/40 uppercase tracking-widest font-semibold block mb-2">Tipo de negocio</label>
                <select value={fTipoNegocio} onChange={e => { setFTipoNegocio(e.target.value); setPage(1); }}
                  className="w-full bg-[#014434] border border-[#046C5E] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500/60">
                  <option value="">Todos los tipos</option>
                  {tiposNegocioOpts.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label className="text-[10px] text-white/40 uppercase tracking-widest font-semibold block mb-2">Vendedor</label>
                <select value={fVendedor} onChange={e => { setFVendedor(e.target.value); setPage(1); }}
                  className="w-full bg-[#014434] border border-[#046C5E] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500/60">
                  <option value="">Todos los vendedores</option>
                  {vendedoresOpts.map(v => <option key={v} value={v}>{v}</option>)}
                </select>
              </div>
            </div>

            <div className="h-px bg-[#046C5E]/30"/>

            {/* Producto comprado + Categoría */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-[10px] text-white/40 uppercase tracking-widest font-semibold block mb-2">
                  Producto comprado {catalogoLoading && <span className="ml-2 text-emerald-400 normal-case">cargando…</span>}
                </label>
                <MultiSelect
                  options={catalogo.productos.map(p => ({ value: p.descripcion, label: p.descripcion, hint: p.categoria }))}
                  selected={sfProductos}
                  onToggle={toggleProducto}
                  placeholder="Todos los productos"
                  emptyLabel="Sin productos"
                />
                <p className="text-[10px] text-white/30 mt-1">Filtra clientes que compraron alguno de estos productos</p>
              </div>
              <div>
                <label className="text-[10px] text-white/40 uppercase tracking-widest font-semibold block mb-2">Categoría de producto</label>
                <MultiSelect
                  options={catalogo.categorias.map(c => ({ value: c, label: c || "SIN CATEGORÍA" }))}
                  selected={sfCategorias}
                  onToggle={toggleCategoria}
                  placeholder="Todas las categorías"
                  emptyLabel="Sin categorías"
                />
                <p className="text-[10px] text-white/30 mt-1">Filtra clientes que compraron productos de esas categorías</p>
              </div>
            </div>
          </div>
        )}

        {/* Búsqueda + contador */}
        <div className="flex flex-wrap items-center gap-3 mb-6">
          <div className="relative w-full md:w-96">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40 pointer-events-none"
              fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 1 0 5 11a6 6 0 0 0 12 0z"/>
            </svg>
            <input value={inputQuery} onChange={e => setInputQuery(e.target.value)}
              placeholder="Buscar por nombre, RUC o compañía..."
              className="w-full rounded-lg bg-[#013d32] border border-[#046C5E] pl-9 pr-8 py-2 text-sm text-white placeholder-white/30 focus:outline-none focus:border-emerald-500/60"/>
            {inputQuery && (
              <button onClick={() => setInputQuery("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-white/30 hover:text-white"><X size={14} /></button>
            )}
          </div>
          <span className="text-sm text-white/40">
            {filteredData.length === empresas.length
              ? `${empresas.length.toLocaleString("es-EC")} clientes`
              : `${filteredData.length.toLocaleString("es-EC")} de ${empresas.length.toLocaleString("es-EC")} clientes`}
          </span>
        </div>

        {/* ── Panel consolidado de clientes seleccionados ───────────────── */}
        {seleccionados.size > 0 && (
          <div className="mb-6 bg-gradient-to-br from-emerald-900/30 to-[#013d30] border border-emerald-500/40 rounded-2xl p-4 md:p-5">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
              <div>
                <p className="text-xs uppercase tracking-widest text-emerald-300 font-semibold">
                  Consolidado — {seleccionados.size} cliente{seleccionados.size !== 1 ? "s" : ""} seleccionado{seleccionados.size !== 1 ? "s" : ""}
                </p>
                <p className="text-[11px] text-white/40 mt-0.5">Totales combinados de los clientes marcados en la tabla</p>
              </div>
              <button onClick={limpiarSeleccion}
                className="text-xs text-white/60 hover:text-red-400 transition-colors underline underline-offset-2">
                Limpiar selección
              </button>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="bg-black/25 rounded-xl p-3 text-center">
                <p className="text-[10px] text-white/40 uppercase">Ventas Totales</p>
                <p className="text-xl font-bold text-blue-400">{money(resumenSel.ventas)}</p>
              </div>
              <div className="bg-black/25 rounded-xl p-3 text-center">
                <p className="text-[10px] text-white/40 uppercase">Unidades</p>
                <p className="text-xl font-bold text-green-400">{resumenSel.unidades.toLocaleString("es-EC")}</p>
              </div>
              <div className="bg-black/25 rounded-xl p-3 text-center">
                <p className="text-[10px] text-white/40 uppercase">Facturas</p>
                <p className="text-xl font-bold text-white">{resumenSel.facturas.toLocaleString("es-EC")}</p>
              </div>
              <div className="bg-black/25 rounded-xl p-3 text-center">
                <p className="text-[10px] text-white/40 uppercase">Activos</p>
                <p className="text-xl font-bold text-emerald-400">{resumenSel.activos}</p>
              </div>
            </div>
          </div>
        )}

        {/* ── MOBILE CARDS ─────────────────────────────────────────────── */}
        <div className="md:hidden space-y-3">
          {pageData.length === 0 ? (
            <div className="text-center text-white/30 italic py-10">No se encontraron clientes</div>
          ) : pageData.map((e, idx) => {
            const globalIdx = (page-1)*PAGE_SIZE + idx + 1;
            const checked   = seleccionados.has(e.group_key);
            return (
              <div key={e.group_key} onClick={() => navigateToEmpresa(e)}
                className={`bg-gradient-to-br rounded-2xl p-4 cursor-pointer active:scale-[0.98] transition-all shadow-lg border ${checked ? "from-emerald-900/40 to-[#012E24] border-emerald-500/50" : "from-[#013d30] to-[#012E24] border-[#046C5E]/40"}`}>
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="flex items-start gap-2 flex-1 min-w-0">
                    <input type="checkbox" checked={checked}
                      onClick={ev => ev.stopPropagation()}
                      onChange={() => toggleSeleccion(e.group_key)}
                      className="mt-1 accent-emerald-500 cursor-pointer"/>
                    <div className="flex-1 min-w-0">
                      <span className="text-[10px] text-white/40 font-mono"># {globalIdx}</span>
                      <p className="text-sm font-bold text-white leading-tight">{e.nombre_cliente}</p>
                      <p className="text-[10px] text-white/40 font-mono mt-0.5">{e.ruc || "Sin RUC"}</p>
                      <p className="text-[10px] text-emerald-300/60 mt-0.5">{e.descripcion_company}</p>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    {estadoIcon(e.estado_cliente)}
                    {e.num_sucursales > 1 && (
                      <span className="text-[10px] text-emerald-400 font-semibold">
                        {e.num_sucursales} sucursales
                      </span>
                    )}
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div className="bg-black/20 rounded-xl p-2 text-center">
                    <p className="text-[9px] text-white/40 uppercase mb-0.5">Unidades</p>
                    <p className="text-sm font-bold text-green-400">{e.total_unidades.toLocaleString("es-EC")}</p>
                  </div>
                  <div className="bg-black/20 rounded-xl p-2 text-center">
                    <p className="text-[9px] text-white/40 uppercase mb-0.5">Ventas</p>
                    <p className="text-sm font-bold text-blue-400">{money(e.total_ventas)}</p>
                  </div>
                  <div className="bg-black/20 rounded-xl p-2 text-center">
                    <p className="text-[9px] text-white/40 uppercase mb-0.5">Facturas</p>
                    <p className="text-sm font-bold text-white">{e.total_facturas}</p>
                  </div>
                </div>
              </div>
            );
          })}
          {/* Mobile pagination */}
          {totalPages > 1 && (
            <div className="border-t border-[#046C5E]/30 pt-4 pb-2">
              <div className="flex justify-center items-center gap-2 flex-wrap">
                <button onClick={() => setPage(1)} disabled={page===1} className="px-3 py-2 bg-[#014434] rounded-lg disabled:opacity-30 hover:bg-[#025f4b] text-sm">«</button>
                <button onClick={() => setPage(p=>Math.max(1,p-1))} disabled={page===1} className="px-3 py-2 bg-[#014434] rounded-lg disabled:opacity-30 hover:bg-[#025f4b] text-sm">‹</button>
                {pageNumbers.map((n,i) => n==="..." ? <span key={`dm-${i}`} className="px-1 text-white/30 text-sm">…</span> : (
                  <button key={n} onClick={() => setPage(n as number)}
                    className={`px-3 py-2 rounded-lg text-sm ${page===n?"bg-emerald-600 font-bold":"bg-[#014434] hover:bg-[#025f4b]"}`}>{n}</button>
                ))}
                <button onClick={() => setPage(p=>Math.min(totalPages,p+1))} disabled={page>=totalPages} className="px-3 py-2 bg-[#014434] rounded-lg disabled:opacity-30 hover:bg-[#025f4b] text-sm">›</button>
                <button onClick={() => setPage(totalPages)} disabled={page>=totalPages} className="px-3 py-2 bg-[#014434] rounded-lg disabled:opacity-30 hover:bg-[#025f4b] text-sm">»</button>
              </div>
              <p className="text-center text-xs text-white/30 mt-2">Pág {page}/{totalPages} — {filteredData.length.toLocaleString("es-EC")} clientes</p>
            </div>
          )}
        </div>

        {/* ── DESKTOP TABLE ────────────────────────────────────────────── */}
        <div className="hidden md:block rounded-2xl overflow-hidden border border-[#046C5E]/40 shadow-xl bg-gradient-to-b from-[#013d30] to-[#012E24]">
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-[#014434] text-green-300 uppercase text-xs">
                <tr>
                  <th className="px-3 py-3 text-center w-10">
                    <input type="checkbox"
                      checked={pageData.length > 0 && pageData.every(r => seleccionados.has(r.group_key))}
                      onChange={toggleSeleccionarPagina}
                      className="accent-emerald-500 cursor-pointer"
                      title="Seleccionar toda la página"/>
                  </th>
                  <th className="px-3 py-3 text-center w-10">#</th>
                  <Th label="RUC / Cédula"  col="ruc"/>
                  <Th label="Cliente"        col="nombre"/>
                  <Th label="Estado"         col="estado_cliente" align="center"/>
                  <Th label="Compañía"       col="compania"/>
                  <Th label="Unidades"       col="unidades"       align="right"/>
                  <Th label="Ventas"         col="dolares"        align="right"/>
                  <Th label="Facturas"       col="facturas"       align="right"/>
                  <Th label="Tipo Negocio"   col="tipo_negocio"/>
                  <Th label="Pago"           col="tipo_pago"/>
                  <Th label="Última Compra"  col="ultima_compra"  align="right"/>
                </tr>
              </thead>
              <tbody>
                {pageData.length === 0 ? (
                  <tr>
                    <td colSpan={12} className="px-4 py-10 text-center text-white/30 italic">
                      No se encontraron clientes con los filtros aplicados
                    </td>
                  </tr>
                ) : pageData.map((e, idx) => {
                  const globalIdx = (page-1)*PAGE_SIZE + idx + 1;
                  const multi     = e.num_sucursales > 1;
                  const checked   = seleccionados.has(e.group_key);
                  return (
                    <tr key={e.group_key}
                      onClick={() => navigateToEmpresa(e)}
                      className={`cursor-pointer transition-colors ${checked ? "bg-emerald-600/20 hover:bg-emerald-600/30" : idx % 2 === 0 ? "bg-[#013d32] hover:bg-[#025940]" : "bg-[#014f3e] hover:bg-[#025940]"}`}>
                      <td className="px-3 py-2 text-center" onClick={ev => { ev.stopPropagation(); toggleSeleccion(e.group_key); }}>
                        <input type="checkbox" checked={checked} onChange={() => toggleSeleccion(e.group_key)}
                          onClick={ev => ev.stopPropagation()}
                          className="accent-emerald-500 cursor-pointer"/>
                      </td>
                      <td className="px-3 py-2 text-center">
                        <span className="font-bold text-gray-300 text-xs">{globalIdx}</span>
                      </td>
                      <td className="px-3 py-2 font-mono text-xs text-white/60">
                        {e.ruc || <span className="text-white/20">—</span>}
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{e.nombre_cliente}</span>
                          {multi && (
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 whitespace-nowrap">
                              {e.num_sucursales} suc.
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-3 py-2 text-center">{estadoIcon(e.estado_cliente)}</td>
                      <td className="px-3 py-2 text-white/60 text-xs">{e.descripcion_company}</td>
                      <td className="px-3 py-2 text-right text-green-400 font-bold">{e.total_unidades.toLocaleString("es-EC")}</td>
                      <td className="px-3 py-2 text-right text-blue-400 font-bold">{money(e.total_ventas)}</td>
                      <td className="px-3 py-2 text-right text-white/70">{e.total_facturas}</td>
                      <td className="px-3 py-2 text-white/70 text-xs">{e.tipo_negocio}</td>
                      <td className="px-3 py-2 font-semibold text-yellow-300/80 text-xs">{e.tipo_pago}</td>
                      <td className="px-3 py-2 text-right text-white/70 text-xs">
                        {e.ultima_compra ? new Date(e.ultima_compra).toLocaleDateString("es-EC") : "-"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot className="bg-[#014434] font-bold border-t border-[#046C5E]">
                <tr>
                  <td colSpan={6} className="px-3 py-3 text-green-300">
                    TOTAL — {filteredData.length.toLocaleString("es-EC")} clientes
                    {filteredData.length !== empresas.length &&
                      ` (de ${empresas.length.toLocaleString("es-EC")})`}
                  </td>
                  <td className="px-3 py-3 text-right text-green-400">
                    {filteredData.reduce((a,r) => a+r.total_unidades, 0).toLocaleString("es-EC")}
                  </td>
                  <td className="px-3 py-3 text-right text-blue-400">{money(kpiVentas)}</td>
                  <td className="px-3 py-3 text-right text-white/70">{kpiFact.toLocaleString("es-EC")}</td>
                  <td/><td/><td/>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Desktop pagination */}
          {totalPages > 1 && (
            <div className="border-t border-[#046C5E]/30 px-4 py-3">
              <div className="flex justify-center items-center gap-2 flex-wrap">
                <button onClick={() => setPage(1)} disabled={page===1} className="px-3 py-2 bg-[#014434] rounded-lg disabled:opacity-30 hover:bg-[#025f4b] text-sm">«</button>
                <button onClick={() => setPage(p=>Math.max(1,p-1))} disabled={page===1} className="px-3 py-2 bg-[#014434] rounded-lg disabled:opacity-30 hover:bg-[#025f4b] text-sm">‹ Anterior</button>
                {pageNumbers.map((n,i) => n==="..." ? (
                  <span key={`dd-${i}`} className="px-2 text-white/30">…</span>
                ) : (
                  <button key={n} onClick={() => setPage(n as number)}
                    className={`px-3 py-2 rounded-lg text-sm ${page===n?"bg-emerald-600 text-white font-bold":"bg-[#014434] hover:bg-[#025f4b]"}`}>{n}</button>
                ))}
                <button onClick={() => setPage(p=>Math.min(totalPages,p+1))} disabled={page>=totalPages} className="px-3 py-2 bg-[#014434] rounded-lg disabled:opacity-30 hover:bg-[#025f4b] text-sm">Siguiente ›</button>
                <button onClick={() => setPage(totalPages)} disabled={page>=totalPages} className="px-3 py-2 bg-[#014434] rounded-lg disabled:opacity-30 hover:bg-[#025f4b] text-sm">»</button>
                <span className="text-sm text-white/40 ml-2">
                  Pág {page}/{totalPages} — {((page-1)*PAGE_SIZE)+1}–{Math.min(page*PAGE_SIZE, filteredData.length)} de {filteredData.length.toLocaleString("es-EC")}
                </span>
              </div>
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
