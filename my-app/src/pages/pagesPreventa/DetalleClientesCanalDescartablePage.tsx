import React, { useEffect, useState, useMemo } from "react";
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

const getDireccionLabel = (desc?: string | null, calle?: string | null) => {
  if (desc && desc.trim() !== "" && desc.toLowerCase() !== "delivery") return desc;
  return calle || "—";
};

const hasCoords = (lat?: string | number | null, lng?: string | number | null) => {
  if (lat == null || lat === "") return false;
  if (lng == null || lng === "") return false;
  const nLat = Number(lat), nLng = Number(lng);
  return Number.isFinite(nLat) && Number.isFinite(nLng) && nLat !== 0 && nLng !== 0;
};

const CANAL_LABELS: Record<string, string> = {
  domicilio:        "Domicilio",
  vip:              "VIP",
  mayorista:        "Mayorista",
  empresas:         "Empresas",
  moderno:          "Moderno",
  distribuidores:   "Distribuidores",
  quito:            "Quito",
  "empresas-odoo":  "Empresas",
  "domicilio-odoo": "Domicilio",
};

interface Cliente {
  customer_code: string;
  customer_address_code: string | null;
  descripcion_direccion: string | null;
  nombre_cliente: string;
  identificacion_cliente?: string | null;
  direccion_entrega: string;
  tipo_negocio: string;
  telefono: string;
  consumo_actual: number;
  unidades_actual: number;
  consumo_anterior: number;
  variacion_abs: number;
  variacion_porc: number | null;
  ultima_compra: string | null;
  latitud?: string | number | null;
  longitud?: string | number | null;
  rotando: boolean;
  fuente?: string | null;
}

interface Resumen {
  totalClientes: number;
  clientesConConsumo: number;
  clientesSinConsumo: number;
}

interface TotalesCanal {
  unidades: number;
  dolares: number;
}

interface Producto {
  producto: string;
  unidades_vendidas: number;
  monto_usd: number;
}

interface ClienteAgrupado {
  customer_code: string;
  nombre_cliente: string;
  identificacion_cliente?: string | null;
  tipo_negocio: string;
  telefono: string;
  consumo_actual: number;
  unidades_actual: number;
  consumo_anterior: number;
  variacion_abs: number;
  variacion_porc: number | null;
  ultima_compra: string | null;
  total_sucursales: number;
  fuente?: string | null;
}

const POR_PAGINA = 60;

// ── Tarjeta por tipo de negocio ───────────────────────────────────────────────
interface TipoCard {
  tipo: string;
  total: number;
  conConsumo: number;
  unidades: number;
  monto: number;
  anterior: number;
}

// tipo_negocio con nombres de canales no deben aparecer como cards de tipo
const TIPOS_EXCLUIDOS = new Set(["DOMICILIO", "TIENDAS", "VIP", "EMPRESAS", "MAYORISTA", "MODERNO", "DISTRIBUIDORES"]);

function buildTipoCards(clientes: Cliente[]): TipoCard[] {
  type Acc = TipoCard & { codigos: Set<string>; codigosConsumo: Set<string> };
  const mapa: Record<string, Acc> = {};
  clientes.forEach(c => {
    const t = c.tipo_negocio || "SIN CLASIFICAR";
    if (TIPOS_EXCLUIDOS.has(t.toUpperCase())) return;
    if (!mapa[t]) mapa[t] = { tipo: t, total: 0, conConsumo: 0, unidades: 0, monto: 0, anterior: 0, codigos: new Set(), codigosConsumo: new Set() };
    mapa[t].codigos.add(c.customer_code);
    if (c.consumo_actual > 0) mapa[t].codigosConsumo.add(c.customer_code);
    mapa[t].unidades    += Number(c.unidades_actual   || 0);
    mapa[t].monto       += Number(c.consumo_actual    || 0);
    mapa[t].anterior    += Number(c.consumo_anterior  || 0);
  });
  return Object.values(mapa)
    .map(m => ({ tipo: m.tipo, total: m.codigos.size, conConsumo: m.codigosConsumo.size, unidades: m.unidades, monto: m.monto, anterior: m.anterior }))
    .sort((a, b) => b.monto - a.monto);
}

export default function DetalleClientesCanalDescartablePage() {
  const { canal, anio, mes } = useParams<{ canal: string; anio: string; mes: string }>();
  const navigate = useNavigate();

  const [clientes,  setClientes]  = useState<Cliente[]>([]);
  const [resumen,   setResumen]   = useState<Resumen | null>(null);
  const [productos, setProductos] = useState<Producto[]>([]);
  const [totalesCanal, setTotalesCanal] = useState<TotalesCanal | null>(null);
  const [cargando,  setCargando]  = useState(true);
  const [busqueda,  setBusqueda]  = useState("");
  const [filtro,    setFiltro]    = useState<"todos" | "con" | "sin">("todos");
  const [pagina,    setPagina]    = useState(1);
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: "asc" | "desc" }>({
    key: "consumo_actual", direction: "desc",
  });
  // null = vista cards (VIP); string = tipo seleccionado; "TODOS" = lista completa
  const [tipoSeleccionado,    setTipoSeleccionado]    = useState<string | null>(null);
  // null = ambas fuentes; "mobilvendor" | "odoo" = filtro por canal
  const [fuenteSeleccionada,  setFuenteSeleccionada]  = useState<string | null>(null);
  // null = lista agrupada; string = customer_code seleccionado (vista sucursales)
  const [clienteSeleccionado, setClienteSeleccionado] = useState<string | null>(null);
  const [clienteNombre,       setClienteNombre]       = useState<string>("");
  const [clienteIdentificacion, setClienteIdentificacion] = useState<string>("");
  // Expand productos por sucursal
  const [expandedSuc,    setExpandedSuc]    = useState<Set<string>>(new Set());
  const [productosSuc,   setProductosSuc]   = useState<Map<string, Producto[]>>(new Map());

  const esVip = canal?.toLowerCase() === "vip";

  const requestSort = (key: string) => {
    const dir = sortConfig.key === key && sortConfig.direction === "asc" ? "desc" : "asc";
    setSortConfig({ key, direction: dir });
  };

  const applySortFn = <T,>(arr: T[]): T[] => {
    const { key, direction: dir } = sortConfig;
    return [...arr].sort((a, b) => {
      if (key === "_estado") {
        const av = Number((a as any).consumo_actual) > 0 ? 1 : 0;
        const bv = Number((b as any).consumo_actual) > 0 ? 1 : 0;
        return dir === "asc" ? av - bv : bv - av;
      }
      if (key === "_fuente") {
        const av = String((a as any).fuente ?? "");
        const bv = String((b as any).fuente ?? "");
        return dir === "asc" ? av.localeCompare(bv) : bv.localeCompare(av);
      }
      const av: any = (a as any)[key];
      const bv: any = (b as any)[key];
      const an = Number(String(av ?? "").replace(",",".")),
            bn = Number(String(bv ?? "").replace(",","."));
      if (Number.isFinite(an) && Number.isFinite(bn)) return dir === "asc" ? an - bn : bn - an;
      return dir === "asc" ? String(av).localeCompare(String(bv)) : String(bv).localeCompare(String(av));
    });
  };

  const sa = (k: string) => sortConfig.key === k ? (sortConfig.direction === "asc" ? " ↑" : " ↓") : " ↕";

  useEffect(() => {
    setCargando(true);
    setTipoSeleccionado(null);
    setFuenteSeleccionada(null);
    setClienteSeleccionado(null);
    setExpandedSuc(new Set());
    setProductosSuc(new Map());
    fetch(`${API_BASE_URL}/api/ventas/detalle-canal/${canal}/${anio}/${mes}`)
      .then(r => r.json())
      .then(data => {
        setClientes(data.clientes || []);
        setResumen(data.resumen || null);
        setProductos(data.productosVendidos || []);
        setTotalesCanal(data.totalesCanal || null);
      })
      .catch(console.error)
      .finally(() => setCargando(false));
  }, [canal, anio, mes]);

  // ── Toggle expand productos de sucursal ──────────────────────────────────
  const toggleSucursal = async (s: Cliente, rowKey: string) => {
    setExpandedSuc(prev => {
      const next = new Set(prev);
      next.has(rowKey) ? next.delete(rowKey) : next.add(rowKey);
      return next;
    });
    if (!productosSuc.has(rowKey)) {
      setProductosSuc(prev => new Map(prev).set(rowKey, undefined as any)); // spinner
      try {
        const params = new URLSearchParams({ customerCode: s.customer_code });
        if (s.customer_address_code) params.set("addressCode", s.customer_address_code);
        if (s.fuente) params.set("fuente", s.fuente);
        const url = `${API_BASE_URL}/api/ventas/productos-sucursal/${canal}/${anio}/${mes}?${params}`;
        const res  = await fetch(url);
        const json = await res.json();
        setProductosSuc(prev => new Map(prev).set(rowKey, json.ok ? json.productos : []));
      } catch {
        setProductosSuc(prev => new Map(prev).set(rowKey, []));
      }
    }
  };

  // Clientes filtrados por fuente (VIP: Mobilvendor o ODOO Moderno)
  const clientesPorFuente = useMemo(() => {
    if (!esVip || !fuenteSeleccionada) return clientes;
    return clientes.filter(c => c.fuente === fuenteSeleccionada);
  }, [clientes, esVip, fuenteSeleccionada]);

  // Clientes de la vista actual (todos o filtrado por tipo)
  const clientesVista = useMemo(() => {
    if (!esVip || tipoSeleccionado === null || tipoSeleccionado === "TODOS") return clientesPorFuente;
    return clientesPorFuente.filter(c => (c.tipo_negocio || "SIN CLASIFICAR") === tipoSeleccionado);
  }, [clientesPorFuente, tipoSeleccionado, esVip]);

  const tipoCards = useMemo(() => buildTipoCards(clientesPorFuente), [clientesPorFuente]);

  // Detectar si hay ambas fuentes (para mostrar selector de canal en VIP)
  const fuentesDisponibles = useMemo(() => {
    if (!esVip) return [];
    const fuentes = new Set(clientes.map(c => c.fuente).filter(Boolean));
    return Array.from(fuentes) as string[];
  }, [clientes, esVip]);

  // ── Agrupación por customer_code (1 fila por cliente) ───────────────────
  const clientesAgrupados = useMemo((): ClienteAgrupado[] => {
    const mapa: Record<string, ClienteAgrupado> = {};
    clientesVista.forEach(c => {
      if (!mapa[c.customer_code]) {
        mapa[c.customer_code] = {
          customer_code:   c.customer_code,
          nombre_cliente:  c.nombre_cliente,
          identificacion_cliente: c.identificacion_cliente || null,
          tipo_negocio:    c.tipo_negocio,
          telefono:        c.telefono,
          consumo_actual:  0,
          unidades_actual: 0,
          consumo_anterior:0,
          variacion_abs:   0,
          variacion_porc:  null,
          ultima_compra:   null,
          total_sucursales:0,
          fuente:          c.fuente,
        };
      }
      const g = mapa[c.customer_code];
      g.consumo_actual   += Number(c.consumo_actual   || 0);
      g.unidades_actual  += Number(c.unidades_actual  || 0);
      g.consumo_anterior += Number(c.consumo_anterior || 0);
      g.total_sucursales += 1;
      if (c.ultima_compra && (!g.ultima_compra || c.ultima_compra > g.ultima_compra))
        g.ultima_compra = c.ultima_compra;
    });
    const result = Object.values(mapa).map(g => ({
      ...g,
      variacion_abs:  g.consumo_actual - g.consumo_anterior,
      variacion_porc: g.consumo_anterior > 0
        ? Number(((g.consumo_actual - g.consumo_anterior) / g.consumo_anterior * 100).toFixed(1))
        : null,
    }));
    return applySortFn(result);
  }, [clientesVista, sortConfig]);

  // ── Sucursales del cliente seleccionado ──────────────────────────────────
  const sucursalesVista = useMemo(() => {
    if (!clienteSeleccionado) return [] as Cliente[];
    return applySortFn(clientes.filter(c => c.customer_code === clienteSeleccionado));
  }, [clientes, clienteSeleccionado, sortConfig]);

  // ── Filtrado y paginación ─────────────────────────────────────────────────
  // Vista sucursales (cliente seleccionado)
  const filtradosSuc = sucursalesVista.filter(c => {
    const q = busqueda.toLowerCase();
    return (!q || c.nombre_cliente?.toLowerCase().includes(q) || c.customer_code?.toLowerCase().includes(q))
      && (filtro === "todos" ? true : filtro === "con" ? c.consumo_actual > 0 : c.consumo_actual === 0);
  });

  // Vista lista agrupada
  const filtradosAgrp = clientesAgrupados.filter(c => {
    const q = busqueda.toLowerCase();
    return (!q || c.nombre_cliente?.toLowerCase().includes(q) || c.customer_code?.toLowerCase().includes(q))
      && (filtro === "todos" ? true : filtro === "con" ? c.consumo_actual > 0 : c.consumo_actual === 0);
  });

  const filtrados  = clienteSeleccionado ? filtradosSuc  : filtradosAgrp;
  const totalPags  = Math.ceil(filtrados.length / POR_PAGINA);
  const paginados  = filtrados.slice((pagina - 1) * POR_PAGINA, pagina * POR_PAGINA);

  const exportar = () => {
    const datos = clienteSeleccionado
      ? filtradosSuc.map((c, i) => ({
          "N°": i + 1,
          Código: c.customer_code,
          "Dirección Código": c.customer_address_code || "—",
          Cliente: c.nombre_cliente,
          "Tipo Negocio": c.tipo_negocio,
          Dirección: getDireccionLabel(c.descripcion_direccion, c.direccion_entrega),
          Teléfono: c.telefono,
          Unidades: c.unidades_actual,
          "Consumo Actual ($)": c.consumo_actual,
          "Consumo Anterior ($)": c.consumo_anterior,
          "Variación ($)": c.variacion_abs,
          "Última Compra": c.ultima_compra || "—",
          Estado: c.consumo_actual > 0 ? "Activo" : "Sin consumo",
        }))
      : filtradosAgrp.map((c, i) => ({
          "N°": i + 1,
          Código: c.customer_code,
          Cliente: c.nombre_cliente,
          "Tipo Negocio": c.tipo_negocio,
          Teléfono: c.telefono,
          Sucursales: c.total_sucursales,
          Unidades: c.unidades_actual,
          "Consumo Actual ($)": c.consumo_actual,
          "Consumo Anterior ($)": c.consumo_anterior,
          "Variación ($)": c.variacion_abs,
          "Última Compra": c.ultima_compra || "—",
          Estado: c.consumo_actual > 0 ? "Activo" : "Sin consumo",
        }));
    const ws = XLSX.utils.json_to_sheet(datos);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, `${CANAL_LABELS[canal!] ?? canal} Descartable`);
    XLSX.writeFile(wb, `clientes_${canal}_descartable_${anio}_${mes}.xlsx`);
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
            <button key={`p${n}`} onClick={() => setPagina(n)}
              className={`px-3 py-1 text-xs rounded ${pagina === n ? "bg-emerald-600 font-bold" : "bg-[#014434] hover:bg-[#025940]"}`}>{n}</button>
          );
        })()}
        <button disabled={pagina === totalPags} onClick={() => setPagina(p => p + 1)} className="px-3 py-1 text-xs rounded bg-[#014434] disabled:opacity-30 hover:bg-[#025940]">Sig ›</button>
        <button disabled={pagina === totalPags} onClick={() => setPagina(totalPags)} className="px-2 py-1 text-xs rounded bg-[#014434] disabled:opacity-30 hover:bg-[#025940]">»</button>
      </div>
    </div>
  ) : null;

  const canalLabel = CANAL_LABELS[canal?.toLowerCase() ?? ""] ?? canal;

  // Totales: preferimos los "oficiales" del backend (totalesCanal) que cuadran
  // con el ranking principal. Fallback: suma de clientes.
  const sumaMontoClientes = clientes.reduce((a, c) => a + c.consumo_actual,   0);
  const sumaUndsClientes  = clientes.reduce((a, c) => a + c.unidades_actual,  0);
  const totalMontoVip   = totalesCanal ? totalesCanal.dolares  : sumaMontoClientes;
  const totalUndsVip    = totalesCanal ? totalesCanal.unidades : sumaUndsClientes;
  const totalAntVip     = clientes.reduce((a, c) => a + c.consumo_anterior, 0);
  const varAbsVip       = totalMontoVip - totalAntVip;

  return (
    <DashboardLayout>
      <div className="main-content min-h-screen text-white px-4 md:px-8 py-4 md:py-6">
        <Header />

        {/* Cabecera */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-6 border-b border-[#046C5E]/50 pb-4">
          <div>
            {/* Botón volver: sucursales → lista → tipo cards → fuente cards → atrás */}
            <button
              onClick={() => {
                if (clienteSeleccionado !== null) {
                  setClienteSeleccionado(null); setClienteIdentificacion(""); setBusqueda(""); setFiltro("todos"); setPagina(1);
                } else if (esVip && tipoSeleccionado !== null) {
                  setTipoSeleccionado(null); setBusqueda(""); setFiltro("todos"); setPagina(1);
                } else if (esVip && fuenteSeleccionada !== null) {
                  setFuenteSeleccionada(null); setBusqueda(""); setFiltro("todos"); setPagina(1);
                } else {
                  navigate(-1);
                }
              }}
              className="text-xs text-gray-400 hover:text-white mb-1 flex items-center gap-1 transition"
            >
              ←{" "}
              {clienteSeleccionado !== null
                ? "Volver a clientes"
                : esVip && tipoSeleccionado !== null
                ? (fuenteSeleccionada ? "Volver a tipos" : "Volver a fuentes")
                : esVip && fuenteSeleccionada !== null
                ? "Volver a fuentes"
                : "Volver"}
            </button>
            <h1 className="text-xl md:text-2xl font-bold tracking-tight">
              {clienteSeleccionado !== null
                ? clienteNombre
                : <>Clientes {canalLabel} — Descartable
                    {esVip && fuenteSeleccionada && (
                      <span className="ml-2 text-base font-normal text-emerald-300">
                        · {fuenteSeleccionada === "odoo" ? "Moderno" : "VIP"}
                      </span>
                    )}
                    {esVip && tipoSeleccionado && tipoSeleccionado !== "TODOS" && (
                      <span className="ml-2 text-base font-normal text-emerald-300">· {tipoSeleccionado}</span>
                    )}
                  </>
              }
            </h1>
            {clienteSeleccionado !== null && clienteIdentificacion && (
              <p className="text-xs text-emerald-300/80 mt-0.5">
                Identificacion: <span className="text-sm font-mono text-white">{clienteIdentificacion}</span>
              </p>
            )}
            <p className="text-xs text-gray-400">
              {MESES[Number(mes)]} {anio}
              {clienteSeleccionado !== null && " · Sucursales / Direcciones de entrega"}
              {!clienteSeleccionado && esVip && tipoSeleccionado === null && !fuenteSeleccionada && " · Selecciona una fuente para ver sus clientes"}
              {!clienteSeleccionado && esVip && tipoSeleccionado === null && fuenteSeleccionada && " · Selecciona un tipo de negocio"}
            </p>
          </div>
          <button onClick={exportar}
            className="flex items-center gap-2 px-4 py-2 rounded-lg border border-[#0db48b]/60 bg-[#0db48b]/20 text-white font-semibold hover:bg-[#0db48b]/30 transition-all self-start sm:self-auto">
            <BsDownload size={16} /> Exportar Excel
          </button>
        </div>

        {/* KPIs globales */}
        {resumen && (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-6">
            {[
              { label: "Total clientes",  value: resumen.totalClientes.toLocaleString("es-EC"),       color: "text-white"     },
              { label: "Con consumo",     value: resumen.clientesConConsumo.toLocaleString("es-EC"),  color: "text-green-400" },
              { label: "Sin consumo",     value: resumen.clientesSinConsumo.toLocaleString("es-EC"),  color: "text-red-400"   },
              { label: "Unidades",        value: totalUndsVip.toLocaleString("es-EC", { minimumFractionDigits: 0, maximumFractionDigits: 2 }), color: "text-blue-300" },
              { label: "Dólares",         value: `$${fmt(totalMontoVip)}`,                            color: "text-amber-300" },
            ].map(k => (
              <div key={k.label} className="bg-gradient-to-br from-[#012E24] to-[#013d30] border border-[#046C5E]/40 rounded-xl p-3 md:p-4 text-center">
                <p className="text-[10px] uppercase tracking-widest text-gray-400 mb-1">{k.label}</p>
                <p className={`text-xl font-extrabold ${k.color}`}>{k.value}</p>
              </div>
            ))}
          </div>
        )}

        {/* VS Mes anterior — solo VIP en vista de cards */}
        {esVip && tipoSeleccionado === null && !cargando && totalAntVip > 0 && (
          <div className={`flex items-center gap-3 mb-6 px-4 py-3 rounded-xl border text-sm font-semibold
            ${varAbsVip >= 0 ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-300" : "bg-red-500/10 border-red-500/30 text-red-300"}`}>
            <span className="text-base">{varAbsVip >= 0 ? "▲" : "▼"}</span>
            <span>
              VS mes anterior: {varAbsVip >= 0 ? "+" : ""}${fmt(Math.abs(varAbsVip))}
              &nbsp;·&nbsp;Mes anterior: ${fmt(totalAntVip)}
            </span>
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
                    <th className="px-4 py-3 text-right">Precio Promedio</th>
                  </tr>
                </thead>
                <tbody>
                  {productos.map((p, idx) => {
                    const uni = Number(p.unidades_vendidas);
                    const usd = Number(p.monto_usd);
                    const prom = uni > 0 ? usd / uni : 0;
                    return (
                      <tr key={idx} className={`${idx % 2 === 0 ? "bg-[#013d32]" : "bg-[#014f3e]"} hover:bg-[#025940] transition`}>
                        <td className="px-4 py-2">{p.producto || <em className="text-gray-400 text-xs">Sin descripción</em>}</td>
                        <td className="px-4 py-2 text-right text-green-400 font-semibold">{uni.toLocaleString("es-EC")}</td>
                        <td className="px-4 py-2 text-right text-blue-400 font-semibold">${fmt(usd)}</td>
                        <td className="px-4 py-2 text-right text-purple-400 font-semibold">${fmt(prom)}</td>
                      </tr>
                    );
                  })}
                  <tr className="bg-[#014434] font-bold border-t border-[#046C5E]/30">
                    <td className="px-4 py-3 text-green-300 uppercase text-xs">Total</td>
                    <td className="px-4 py-3 text-right text-green-400">
                      {totalUndsVip.toLocaleString("es-EC", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
                    </td>
                    <td className="px-4 py-3 text-right text-blue-400">
                      ${fmt(totalMontoVip)}
                    </td>
                    <td className="px-4 py-3 text-right text-purple-300">
                      ${fmt(totalUndsVip > 0 ? totalMontoVip / totalUndsVip : 0)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Loading */}
        {cargando && (
          <div className="flex flex-col justify-center items-center py-32 gap-4">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-emerald-400" />
            <p className="text-gray-400 text-sm">Cargando datos…</p>
          </div>
        )}

        {/* ══ VIP: Cards por tipo de negocio ══════════════════════════════════ */}
        {!cargando && esVip && tipoSeleccionado === null && (
          <>
            {tipoCards.length === 0 && fuentesDisponibles.length <= 1 ? (
              <p className="text-center text-gray-400 py-16 text-sm">No se encontraron datos para este período.</p>
            ) : (
              <>
                {/* Botón ver todos */}
                <div className="flex justify-end mb-4">
                  <button
                    onClick={() => { setTipoSeleccionado("TODOS"); setPagina(1); }}
                    className="text-xs text-gray-400 hover:text-white border border-[#046C5E]/40 px-3 py-1.5 rounded-lg transition"
                  >
                    Ver todos los clientes →
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5 mb-8">
                  {/* Cards de fuente (Mobilvendor VIP / ODOO Moderno) — solo al nivel top */}
                  {fuentesDisponibles.length > 1 && !fuenteSeleccionada && [
                    { fuente: "mobilvendor", label: "VIP",     badge: "Preventa", borderClass: "border-blue-500/40 hover:border-blue-400/70",   badgeClass: "bg-blue-500/20 text-blue-300 border-blue-500/40" },
                    { fuente: "odoo",        label: "Moderno", badge: "Externo",  borderClass: "border-purple-500/40 hover:border-purple-400/70", badgeClass: "bg-purple-500/20 text-purple-300 border-purple-500/40" },
                  ].map(({ fuente, label, badge, borderClass, badgeClass }) => {
                    const cls      = clientes.filter(c => c.fuente === fuente);
                    const monto    = cls.reduce((a, c) => a + c.consumo_actual,   0);
                    const anterior = cls.reduce((a, c) => a + c.consumo_anterior, 0);
                    const unds     = cls.reduce((a, c) => a + c.unidades_actual,  0);
                    const codigosUnicos = new Set(cls.map(c => c.customer_code));
                    const codigosConConsumo = new Set(cls.filter(c => c.consumo_actual > 0).map(c => c.customer_code));
                    const totalClientes = codigosUnicos.size;
                    const activos  = codigosConConsumo.size;
                    const sinConsumo = totalClientes - activos;
                    const varMonto = monto - anterior;
                    return (
                      <div
                        key={fuente}
                        onClick={() => { setFuenteSeleccionada(fuente); setBusqueda(""); setFiltro("todos"); setPagina(1); }}
                        className={`cursor-pointer bg-gradient-to-br from-[#012E24] to-[#014034]
                          border ${borderClass} rounded-2xl p-5 shadow-lg flex flex-col gap-3
                          hover:scale-[1.02] transition-all duration-200`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className={`inline-block px-2 py-0.5 rounded text-[9px] font-bold border ${badgeClass}`}>{badge}</span>
                            <p className="text-sm font-bold text-white leading-tight">{label}</p>
                          </div>
                          <span className="shrink-0 text-[10px] text-gray-400 italic mt-0.5">Ver clientes →</span>
                        </div>

                        <div className="grid grid-cols-3 gap-2 text-center">
                          <div>
                            <p className="text-[9px] text-gray-500 uppercase tracking-wide">Total</p>
                            <p className="text-white font-bold text-base">{totalClientes.toLocaleString("es-EC")}</p>
                          </div>
                          <div>
                            <p className="text-[9px] text-gray-500 uppercase tracking-wide">Activos</p>
                            <p className="text-emerald-400 font-bold text-base">{activos.toLocaleString("es-EC")}</p>
                          </div>
                          <div>
                            <p className="text-[9px] text-gray-500 uppercase tracking-wide">Sin consumo</p>
                            <p className="text-red-400 font-bold text-base">{sinConsumo.toLocaleString("es-EC")}</p>
                          </div>
                        </div>

                        <div className="border-t border-[#046C5E]/30" />

                        <div>
                          <p className="text-[9px] text-gray-500 uppercase tracking-wide mb-1">Dólares Actual</p>
                          <p className="text-amber-300 font-extrabold text-lg">${fmt(monto)}</p>
                        </div>

                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-[9px] text-gray-500 uppercase tracking-wide">Mes anterior</p>
                            <p className="text-gray-300 text-sm font-semibold">${fmt(anterior)}</p>
                          </div>
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold border
                            ${varMonto >= 0
                              ? "text-emerald-400 border-emerald-400/20 bg-emerald-400/10"
                              : "text-red-400 border-red-400/20 bg-red-400/10"}`}>
                            {varMonto >= 0 ? "▲" : "▼"} ${fmt(Math.abs(varMonto))}
                          </span>
                        </div>

                        <div className="flex items-center justify-between border-t border-[#046C5E]/20 pt-2">
                          <p className="text-[9px] text-gray-500 uppercase tracking-wide">Unidades</p>
                          <p className="text-blue-300 font-bold">{unds.toLocaleString("es-EC")}</p>
                        </div>
                      </div>
                    );
                  })}

                  {/* Tipo cards — dentro de una fuente, o cuando solo hay una fuente disponible */}
                  {(fuentesDisponibles.length <= 1 || fuenteSeleccionada) && tipoCards.map(t => {
                    const sinConsumo = t.total - t.conConsumo;
                    const varMonto   = t.monto - t.anterior;
                    return (
                      <div
                        key={t.tipo}
                        onClick={() => { setTipoSeleccionado(t.tipo); setBusqueda(""); setFiltro("todos"); setPagina(1); }}
                        className="cursor-pointer bg-gradient-to-br from-[#012E24] to-[#014034]
                          border border-[#046C5E]/40 rounded-2xl p-5 shadow-lg flex flex-col gap-3
                          hover:border-emerald-400/60 hover:scale-[1.02] transition-all duration-200"
                      >
                        {/* Encabezado */}
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-sm font-bold text-white leading-tight">{t.tipo}</p>
                          <span className="shrink-0 text-[10px] text-gray-400 italic mt-0.5">Ver clientes →</span>
                        </div>

                        {/* Clientes */}
                        <div className="grid grid-cols-3 gap-2 text-center">
                          <div>
                            <p className="text-[9px] text-gray-500 uppercase tracking-wide">Total</p>
                            <p className="text-white font-bold text-base">{t.total.toLocaleString("es-EC")}</p>
                          </div>
                          <div>
                            <p className="text-[9px] text-gray-500 uppercase tracking-wide">Activos</p>
                            <p className="text-emerald-400 font-bold text-base">{t.conConsumo.toLocaleString("es-EC")}</p>
                          </div>
                          <div>
                            <p className="text-[9px] text-gray-500 uppercase tracking-wide">Sin consumo</p>
                            <p className="text-red-400 font-bold text-base">{sinConsumo.toLocaleString("es-EC")}</p>
                          </div>
                        </div>

                        <div className="border-t border-[#046C5E]/30" />

                        {/* Monto */}
                        <div>
                          <p className="text-[9px] text-gray-500 uppercase tracking-wide mb-1">Dólares Actual</p>
                          <p className="text-amber-300 font-extrabold text-lg">${fmt(t.monto)}</p>
                        </div>

                        {/* VS Mes anterior */}
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-[9px] text-gray-500 uppercase tracking-wide">Mes anterior</p>
                            <p className="text-gray-300 text-sm font-semibold">${fmt(t.anterior)}</p>
                          </div>
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold border
                            ${varMonto >= 0
                              ? "text-emerald-400 border-emerald-400/20 bg-emerald-400/10"
                              : "text-red-400 border-red-400/20 bg-red-400/10"}`}>
                            {varMonto >= 0 ? "▲" : "▼"} ${fmt(Math.abs(varMonto))}
                          </span>
                        </div>

                        {/* Unidades */}
                        <div className="flex items-center justify-between border-t border-[#046C5E]/20 pt-2">
                          <p className="text-[9px] text-gray-500 uppercase tracking-wide">Unidades</p>
                          <p className="text-blue-300 font-bold">{t.unidades.toLocaleString("es-EC")}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </>
        )}

        {/* ══ Lista agrupada + Vista sucursales ════════════════════════════════ */}
        {!cargando && (!esVip || tipoSeleccionado !== null || clienteSeleccionado !== null) && (
          <>
            {/* Cabecera info cliente seleccionado */}
            {clienteSeleccionado !== null && (() => {
              const info = clientesAgrupados.find(c => c.customer_code === clienteSeleccionado);
              const totalSuc = sucursalesVista.reduce((a, s) => a + s.consumo_actual, 0);
              const totalAntSuc = sucursalesVista.reduce((a, s) => a + s.consumo_anterior, 0);
              const varSuc = totalSuc - totalAntSuc;
              const activasSuc = sucursalesVista.filter(s => s.consumo_actual > 0).length;
              return (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
                  {[
                    { label: "Sucursales",    value: sucursalesVista.length.toLocaleString("es-EC"), color: "text-white" },
                    { label: "Activas",       value: activasSuc.toLocaleString("es-EC"),             color: "text-emerald-400" },
                    { label: "Unidades",      value: sucursalesVista.reduce((a,s)=>a+s.unidades_actual,0).toLocaleString("es-EC"), color: "text-blue-300" },
                    { label: "Consumo Total", value: `$${fmt(totalSuc)}`,                             color: "text-amber-300" },
                  ].map(k => (
                    <div key={k.label} className="bg-gradient-to-br from-[#012E24] to-[#013d30] border border-[#046C5E]/40 rounded-xl p-3 text-center">
                      <p className="text-[10px] uppercase tracking-widest text-gray-400 mb-1">{k.label}</p>
                      <p className={`text-xl font-extrabold ${k.color}`}>{k.value}</p>
                    </div>
                  ))}
                </div>
              );
            })()}

            {/* Filtros */}
            <div className="flex flex-wrap gap-3 mb-4">
              <div className="relative flex-1 min-w-[180px]">
                <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 1 0 5 11a6 6 0 0 0 12 0z"/>
                </svg>
                <input type="text"
                  placeholder={clienteSeleccionado ? "Buscar dirección…" : "Buscar cliente o código…"}
                  value={busqueda}
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

            <div className="bg-gradient-to-br from-[#012E24] to-[#013d30] border border-[#046C5E]/30 rounded-2xl overflow-hidden mb-6">

              {/* ── MOBILE ───────────────────────────────────────────── */}
              <div className="md:hidden">
                {paginados.length === 0
                  ? <p className="text-center text-gray-400 py-12 text-sm">No se encontraron resultados.</p>
                  : clienteSeleccionado !== null
                    // Vista sucursales — mobile
                    ? (() => {
                        const sucItems = paginados as Cliente[];
                        return (
                          <div className="space-y-3 p-3">
                            {sucItems.map((s, idx) => {
                              const rowKey     = `${s.customer_code}::${s.customer_address_code ?? ''}::${(pagina-1)*POR_PAGINA+idx}`;
                              const isExpanded = expandedSuc.has(rowKey);
                              const prods      = productosSuc.get(rowKey);
                              const sinConsumo = s.consumo_actual === 0;
                              const dirLabel   = getDireccionLabel(s.descripcion_direccion, s.direccion_entrega) || s.customer_address_code || s.customer_code;
                              return (
                                <div key={rowKey}
                                  className="bg-gradient-to-br from-[#013d30] to-[#012E24] border border-[#046C5E]/40 rounded-xl overflow-hidden">
                                  {/* Cabecera — clicable */}
                                  <div className="p-4 cursor-pointer" onClick={() => toggleSucursal(s, rowKey)}>
                                    <div className="flex items-start justify-between mb-2">
                                      <div className="flex-1 min-w-0 pr-2">
                                        <div className="flex items-center gap-2 mb-0.5">
                                          <span className={`text-[10px] transition-transform duration-200 inline-block ${isExpanded ? "rotate-90" : ""} text-white/40`}>▶</span>
                                          <p className="text-[10px] font-mono text-white/40">{s.customer_address_code || "—"}</p>
                                        </div>
                                        <p className="text-sm font-medium text-white/80 truncate">
                                          {getDireccionLabel(s.descripcion_direccion, s.direccion_entrega)}
                                        </p>
                                      </div>
                                      <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded border text-[10px] font-semibold shrink-0
                                        ${sinConsumo ? "text-red-400 bg-red-500/15 border-red-500/30" : "text-green-400 bg-green-500/15 border-green-500/30"}`}>
                                        <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${sinConsumo ? "bg-red-500" : "bg-green-500"}`}/>
                                        {sinConsumo ? "Sin consumo" : "Activa"}
                                      </span>
                                    </div>
                                    <div className="grid grid-cols-3 gap-2">
                                      <div className="text-center">
                                        <p className="text-[9px] text-white/40 uppercase">Consumo</p>
                                        <p className="text-sm font-bold text-blue-400">${fmt(s.consumo_actual)}</p>
                                      </div>
                                      <div className="text-center">
                                        <p className="text-[9px] text-white/40 uppercase">VS Ant</p>
                                        <p className={`text-sm font-bold ${s.variacion_abs >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                                          {s.variacion_abs >= 0 ? "+" : ""}${fmt(Math.abs(s.variacion_abs))}
                                        </p>
                                      </div>
                                      <div className="text-center">
                                        <p className="text-[9px] text-white/40 uppercase">Unidades</p>
                                        <p className="text-sm font-bold text-green-400">{s.unidades_actual.toLocaleString("es-EC")}</p>
                                      </div>
                                    </div>
                                    <div className="mt-2 flex items-center justify-between text-[10px] text-white/40">
                                      {s.ultima_compra
                                        ? <span>Últ. compra: {new Date(s.ultima_compra).toLocaleDateString("es-EC")}</span>
                                        : <span/>}
                                      {hasCoords(s.latitud, s.longitud) ? (
                                        <a href={`https://maps.google.com/?q=${s.latitud},${s.longitud}`}
                                          target="_blank" rel="noreferrer"
                                          onClick={(e) => e.stopPropagation()}
                                          className="text-blue-400 hover:underline border border-blue-400/30 px-2 py-0.5 rounded whitespace-nowrap shrink-0">
                                          Mapa
                                        </a>
                                      ) : null}
                                    </div>
                                  </div>
                                  {/* Productos expandidos */}
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
                                                    <td className="px-3 py-2 text-right text-green-400 tabular-nums">{prods.reduce((a,p)=>a+p.unidades_vendidas,0).toLocaleString("es-EC")}</td>
                                                    <td className="px-4 py-2 text-right text-blue-400 tabular-nums">${fmt(prods.reduce((a,p)=>a+p.monto_usd,0))}</td>
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
                        );
                      })()
                    // Vista lista agrupada — mobile
                    : <div className="divide-y divide-[#046C5E]/20">{(paginados as ClienteAgrupado[]).map((c, idx) => {
                        const sinConsumo = c.consumo_actual === 0;
                        return (
                          <div key={c.customer_code}
                            onClick={() => { setClienteSeleccionado(c.customer_code); setClienteNombre(c.nombre_cliente); setClienteIdentificacion(c.identificacion_cliente || ""); setBusqueda(""); setFiltro("todos"); setPagina(1); }}
                            className={`p-4 cursor-pointer ${sinConsumo ? "bg-red-900/30 border-l-4 border-red-500/60" : idx % 2 === 0 ? "bg-[#013d32]" : "bg-[#014f3e]"}`}>
                            <div className="flex items-start justify-between mb-2">
                              <div className="flex-1 min-w-0">
                                <p className="font-bold text-white text-sm truncate">
                                  {c.nombre_cliente}
                                  {c.total_sucursales > 0 && (
                                    <span className="ml-2 text-gray-400 text-xs font-normal">
                                      {c.total_sucursales} suc.
                                    </span>
                                  )}
                                </p>
                                <p className="text-[11px] text-gray-400 font-mono">{c.customer_code}</p>
                              </div>
                              <div className="flex flex-col items-end gap-1 ml-2 shrink-0">
                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${sinConsumo ? "bg-red-500/30 text-red-300" : "bg-green-500/30 text-green-300"}`}>
                                  {sinConsumo ? "Sin consumo" : "Activo"}
                                </span>
                                {esVip && (
                                  c.fuente === "odoo"
                                    ? <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/40">Externo</span>
                                    : <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/40">Preventa</span>
                                )}
                              </div>
                            </div>
                            <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs">
                              <div>
                                <p className="text-[9px] text-gray-500 uppercase">Consumo</p>
                                <p className="text-white font-bold">${fmt(c.consumo_actual)}</p>
                              </div>
                              <div>
                                <p className="text-[9px] text-gray-500 uppercase">VS Ant</p>
                                <p className={`font-bold ${c.variacion_abs >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                                  {c.variacion_abs >= 0 ? "+" : ""}${fmt(Math.abs(c.variacion_abs))}
                                </p>
                              </div>
                            </div>
                            <p className="text-[10px] text-emerald-400 mt-2 text-right">Ver sucursales →</p>
                          </div>
                        );
                      })}</div>
                }
              </div>

              {/* ── DESKTOP ──────────────────────────────────────────── */}
              <div className="hidden md:block overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="bg-[#014434] text-[10px] uppercase text-green-300 select-none">
                      <th className="px-3 py-3 text-center">N°</th>
                      {clienteSeleccionado !== null
                        // Columnas sucursales
                        ? (<>
                            {([
                            ["Dirección Cód.", "customer_address_code", "left"],
                            ["Dirección",      "direccion_entrega",     "left"],
                            ["Teléfono",       "telefono",              "center"],
                            ["Unidades",       "unidades_actual",       "right"],
                            ["Consumo Actual", "consumo_actual",        "right"],
                            ["Mes Anterior",   "consumo_anterior",      "right"],
                            ["VS Mes Ant",     "variacion_abs",         "right"],
                            ["% Var",          "variacion_porc",        "right"],
                            ["Últ. Compra",    "ultima_compra",         "center"],
                            ["Estado",         "_estado",               "center"],
                          ] as [string,string,"left"|"center"|"right"][]).map(([label, key, align]) => (
                            <th key={key} onClick={() => requestSort(key)}
                              className={`px-3 py-3 text-${align} cursor-pointer hover:text-white transition-colors whitespace-nowrap`}>
                              {label}<span className="ml-1 text-[#046C5E]">{sa(key)}</span>
                            </th>
                          ))}
                            <th className="px-3 py-3 text-center whitespace-nowrap">Mapa</th>
                          </>)
                        // Columnas lista agrupada
                        : ([
                            ["Código",         "customer_code",       "left"],
                            ["Cliente",        "nombre_cliente",      "left"],
                            ["Tipo Negocio",   "tipo_negocio",        "left"],
                            ["Teléfono",       "telefono",            "center"],
                            ["Unidades",       "unidades_actual",     "right"],
                            ["Consumo Actual", "consumo_actual",      "right"],
                            ["Mes Anterior",   "consumo_anterior",    "right"],
                            ["VS Mes Ant",     "variacion_abs",       "right"],
                            ["% Var",          "variacion_porc",      "right"],
                            ["Últ. Compra",    "ultima_compra",       "center"],
                            ["Estado",         "_estado",             "center"],
                            ...(esVip ? [["Fuente", "_fuente", "center"] as [string,string,"left"|"center"|"right"]] : []),
                          ] as [string,string,"left"|"center"|"right"][]).map(([label, key, align]) => (
                            <th key={key} onClick={() => requestSort(key)}
                              className={`px-3 py-3 text-${align} cursor-pointer hover:text-white transition-colors whitespace-nowrap`}>
                              {label}<span className="ml-1 text-[#046C5E]">{sa(key)}</span>
                            </th>
                          ))
                      }
                      {clienteSeleccionado === null && <th className="px-3 py-3 text-center">Detalle</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {paginados.length === 0
                      ? <tr><td colSpan={clienteSeleccionado !== null ? 13 : (esVip ? 14 : 13)} className="px-4 py-12 text-center text-gray-400 text-sm">No se encontraron resultados.</td></tr>
                      : clienteSeleccionado !== null
                        // Filas sucursales
                        ? (paginados as Cliente[]).map((s, idx) => {
                            const globalN    = (pagina-1)*POR_PAGINA+idx+1;
                            const rowKey     = `${s.customer_code}::${s.customer_address_code ?? ''}::${globalN-1}`;
                            const isExpanded = expandedSuc.has(rowKey);
                            const prods      = productosSuc.get(rowKey);
                            const sinConsumo = s.consumo_actual === 0;
                            const rowBg      = sinConsumo ? "bg-[rgba(220,38,38,0.5)]" : idx % 2 === 0 ? "bg-[#013d32]" : "bg-[#014f3e]";
                            const dirLabel   = getDireccionLabel(s.descripcion_direccion, s.direccion_entrega);
                            return (
                              <React.Fragment key={rowKey}>
                                {/* Fila principal */}
                                <tr onClick={() => toggleSucursal(s, rowKey)}
                                  className={`cursor-pointer transition-colors ${rowBg} hover:bg-[#025940] group`}>
                                  {/* # con flecha ▶ */}
                                  <td className="px-3 py-2 text-center text-xs text-white/40 w-10">
                                    <span className="inline-flex items-center gap-1.5 select-none">
                                      <span className={`text-[10px] text-emerald-400/60 transition-transform duration-200 inline-block ${isExpanded ? "rotate-90" : ""}`}>▶</span>
                                      <span className="text-white/30">{globalN}</span>
                                    </span>
                                  </td>
                                  <td className="px-3 py-2 text-left font-mono text-xs text-white/50">{s.customer_address_code || "—"}</td>
                                  <td className="px-3 py-2 text-left text-xs text-white/80 max-w-[220px]">
                                    <span className="truncate block" title={dirLabel}>{dirLabel}</span>
                                  </td>
                                  <td className="px-3 py-2 text-center text-white/60 text-xs whitespace-nowrap">{s.telefono || "—"}</td>
                                  <td className="px-3 py-2 text-right text-green-400 font-bold tabular-nums">{Number(s.unidades_actual).toLocaleString("es-EC")}</td>
                                  <td className="px-3 py-2 text-right text-blue-400 font-bold tabular-nums">${fmt(s.consumo_actual)}</td>
                                  <td className="px-3 py-2 text-right text-white/60 tabular-nums">${fmt(s.consumo_anterior)}</td>
                                  <td className={`px-3 py-2 text-right font-bold tabular-nums ${s.variacion_abs >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                                    {s.variacion_abs >= 0 ? "+" : ""}${fmt(Math.abs(s.variacion_abs))}
                                  </td>
                                  <td className={`px-3 py-2 text-right text-xs tabular-nums ${s.variacion_abs >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                                    {s.variacion_porc !== null ? `${s.variacion_porc >= 0 ? "+" : ""}${Number(s.variacion_porc).toFixed(1)}%` : "—"}
                                  </td>
                                  <td className="px-3 py-2 text-center text-white/60 text-xs whitespace-nowrap">
                                    {s.ultima_compra ? new Date(s.ultima_compra).toLocaleDateString("es-EC") : "—"}
                                  </td>
                                  <td className="px-3 py-2 text-center">
                                    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded border text-[10px] font-semibold
                                      ${sinConsumo
                                        ? "text-red-400 bg-red-500/15 border-red-500/30"
                                        : "text-green-400 bg-green-500/15 border-green-500/30"}`}>
                                      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${sinConsumo ? "bg-red-500" : "bg-green-500"}`}/>
                                      {sinConsumo ? "Sin consumo" : "Activa"}
                                    </span>
                                  </td>
                                  <td className="px-3 py-2 text-center" onClick={(e) => e.stopPropagation()}>
                                    {hasCoords(s.latitud, s.longitud)
                                      ? <a href={`https://maps.google.com/?q=${s.latitud},${s.longitud}`}
                                          target="_blank" rel="noreferrer"
                                          className="text-[10px] text-blue-400 hover:underline border border-blue-400/30 px-2 py-0.5 rounded whitespace-nowrap">
                                          Mapa
                                        </a>
                                      : <span className="text-[10px] text-white/40 italic whitespace-nowrap">—</span>
                                    }
                                  </td>
                                </tr>
                                {/* Fila expandida — productos */}
                                {isExpanded && (
                                  <tr>
                                    <td colSpan={12} className="p-0 border-b border-[#046C5E]/20">
                                      <div className="bg-[#011f17] border-l-2 border-emerald-500/40">
                                        <div className="flex items-center gap-3 px-5 py-2 border-b border-[#046C5E]/20">
                                          <span className="text-[10px] text-emerald-400/60 uppercase tracking-widest font-semibold">
                                            Productos · {dirLabel}
                                          </span>
                                        </div>
                                        {prods === undefined
                                          ? <div className="flex justify-center items-center py-6">
                                              <div className="animate-spin h-5 w-5 border-2 border-emerald-400/20 border-t-emerald-400 rounded-full"/>
                                            </div>
                                          : prods.length === 0
                                            ? <p className="text-center text-white/30 italic py-5 text-xs">Sin productos en este período</p>
                                            : (() => {
                                                const totalU = prods.reduce((a, p) => a + p.unidades_vendidas, 0);
                                                const totalV = prods.reduce((a, p) => a + p.monto_usd, 0);
                                                return (
                                                  <div className="overflow-x-auto">
                                                    <table className="w-full text-xs">
                                                      <thead>
                                                        <tr className="bg-[#011f17] text-emerald-400/70 uppercase tracking-wider">
                                                          <th className="px-8 py-2 text-left font-semibold">Producto</th>
                                                          <th className="px-3 py-2 text-right font-semibold whitespace-nowrap">Unidades</th>
                                                          <th className="px-5 py-2 text-right font-semibold whitespace-nowrap">Ventas</th>
                                                        </tr>
                                                      </thead>
                                                      <tbody>
                                                        {prods.map((p, pi) => (
                                                          <tr key={pi} className={`border-t border-[#046C5E]/10 ${pi % 2 === 0 ? "bg-[#012920]" : "bg-[#013025]"}`}>
                                                            <td className="px-8 py-1.5 text-white/70 font-medium">{p.producto || <span className="text-white/30 italic">—</span>}</td>
                                                            <td className="px-3 py-1.5 text-right text-green-400 font-bold tabular-nums">{Number(p.unidades_vendidas).toLocaleString("es-EC")}</td>
                                                            <td className="px-5 py-1.5 text-right text-blue-400 font-bold tabular-nums">${fmt(Number(p.monto_usd))}</td>
                                                          </tr>
                                                        ))}
                                                      </tbody>
                                                      <tfoot>
                                                        <tr className="border-t border-[#046C5E]/30 bg-[#012018] font-bold">
                                                          <td className="px-8 py-2 text-emerald-400/60 text-[11px] uppercase">{prods.length} producto{prods.length !== 1 ? "s" : ""}</td>
                                                          <td className="px-3 py-2 text-right text-green-400 tabular-nums">{totalU.toLocaleString("es-EC")}</td>
                                                          <td className="px-5 py-2 text-right text-blue-400 tabular-nums">${fmt(totalV)}</td>
                                                        </tr>
                                                      </tfoot>
                                                    </table>
                                                  </div>
                                                );
                                              })()
                                        }
                                      </div>
                                    </td>
                                  </tr>
                                )}
                              </React.Fragment>
                            );
                          })
                        // Filas lista agrupada
                        : (paginados as ClienteAgrupado[]).map((c, idx) => {
                            const sinConsumo = c.consumo_actual === 0;
                            return (
                              <tr key={c.customer_code}
                                onClick={() => { setClienteSeleccionado(c.customer_code); setClienteNombre(c.nombre_cliente); setClienteIdentificacion(c.identificacion_cliente || ""); setBusqueda(""); setFiltro("todos"); setPagina(1); }}
                                className={`cursor-pointer ${sinConsumo ? "bg-[rgba(220,38,38,0.5)]" : idx % 2 === 0 ? "bg-[#013d32]" : "bg-[#014f3e]"} hover:bg-[#025940] transition`}>
                                <td className="px-3 py-2 text-center text-gray-400 text-xs">{(pagina-1)*POR_PAGINA+idx+1}</td>
                                <td className="px-3 py-2 text-left font-mono text-xs text-gray-300">{c.customer_code}</td>
                                <td className="px-3 py-2 text-left font-semibold text-white">
                                  {c.nombre_cliente}
                                  {c.total_sucursales > 0 && (
                                    <span className="ml-2 text-gray-400 text-xs font-normal">
                                      {c.total_sucursales} {c.total_sucursales === 1 ? "suc." : "suc."}
                                    </span>
                                  )}
                                </td>
                                <td className="px-3 py-2 text-left text-gray-300 text-xs">{c.tipo_negocio || "—"}</td>
                                <td className="px-3 py-2 text-center text-gray-300 text-xs whitespace-nowrap">{c.telefono || "—"}</td>
                                <td className="px-3 py-2 text-right text-blue-300 font-semibold">{Number(c.unidades_actual).toLocaleString("es-EC")}</td>
                                <td className="px-3 py-2 text-right font-bold text-white">${fmt(c.consumo_actual)}</td>
                                <td className="px-3 py-2 text-right text-gray-400">${fmt(c.consumo_anterior)}</td>
                                <td className={`px-3 py-2 text-right font-bold ${c.variacion_abs >= 0 ? "text-green-400" : "text-red-400"}`}>
                                  {c.variacion_abs >= 0 ? "+" : ""}${fmt(Math.abs(c.variacion_abs))}
                                </td>
                                <td className={`px-3 py-2 text-right text-xs ${c.variacion_abs >= 0 ? "text-green-400" : "text-red-400"}`}>
                                  {c.variacion_porc !== null ? `${c.variacion_porc >= 0 ? "+" : ""}${Number(c.variacion_porc).toFixed(1)}%` : "—"}
                                </td>
                                <td className="px-3 py-2 text-center text-gray-400 text-xs whitespace-nowrap">
                                  {c.ultima_compra ? new Date(c.ultima_compra).toLocaleDateString("es-EC") : "—"}
                                </td>
                                <td className="px-3 py-2 text-center">
                                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${sinConsumo ? "bg-red-500/30 text-red-300" : "bg-green-500/30 text-green-300"}`}>
                                    {sinConsumo ? "Sin consumo" : "Activo"}
                                  </span>
                                </td>
                                {esVip && (
                                  <td className="px-3 py-2 text-center">
                                    {c.fuente === "odoo"
                                      ? <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/40">Externo</span>
                                      : <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/40">Preventa</span>
                                    }
                                  </td>
                                )}
                                <td className="px-3 py-2 text-center">
                                  <span className="text-[10px] text-emerald-400 whitespace-nowrap">Ver →</span>
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
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
