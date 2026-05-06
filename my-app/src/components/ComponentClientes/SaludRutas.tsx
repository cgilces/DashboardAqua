import React, { useEffect, useMemo, useState } from "react";
import {
  Activity, TrendingUp, TrendingDown, ArrowUpRight, ArrowDownRight,
  ChevronDown, ChevronUp, ChevronRight, Minus, X,
} from "lucide-react";
import { API_BASE_URL } from "../../config";
import { fetchAuth } from "../../utils/fetchAuth";

// ─── Tipos ───────────────────────────────────────────────────────────────
type RutaSalud = {
  ruta: string;
  nuevos: number;
  perdidos: number;
  activos: number;
  clientes_totales: number;
  valor_perdido_mensual: number;
  valor_ganado: number;
  valor_activo_mensual: number;
  net_delta_clientes: number;
  rotacion_porc: number;
};

type Totales = {
  nuevos: number;
  perdidos: number;
  activos: number;
  valor_perdido_mensual: number;
  valor_ganado: number;
  valor_activo_mensual: number;
  net_delta_clientes: number;
  rotacion_porc: number;
};

const PRESET_PREFIJOS = [
  { id: "todos",      label: "Todas",               value: "*"        },
  { id: "autoventa",  label: "Autoventa (R)",       value: "R"        },
  { id: "preventa",   label: "Prevendedores (PVR)", value: "PVR"      },
  { id: "tiendas",    label: "Tiendas (PV)",        value: "PV"       },
  { id: "domicilio",  label: "Domicilio (A)",       value: "A"        },
  { id: "vip",        label: "VIP (V)",             value: "V"        },
  { id: "mayorista",  label: "Mayorista (M)",       value: "M"        },
];

const VENTANAS = [30, 60, 90, 120];

const money = (n = 0) => Number(n).toLocaleString("es-EC", { style: "currency", currency: "USD" });
const num   = (n = 0) => Number(n).toLocaleString("es-EC");

// Color por ruta basado en net delta
function severidadColor(net: number, perdidos: number) {
  if (perdidos === 0)   return "border-emerald-500/40 from-emerald-900/15";
  if (net >= 0)          return "border-emerald-500/40 from-emerald-900/15";
  if (net >= -2)         return "border-yellow-500/40 from-yellow-900/15";
  if (net >= -5)         return "border-orange-500/40 from-orange-900/20";
  return "border-red-500/50 from-red-900/25";
}

// ─── Componente ──────────────────────────────────────────────────────────
type DetalleRow = {
  codigo_cliente: string;
  ruc: string;
  nombre_cliente: string;
  telefono: string;
  ciudad: string;
  tipo_negocio: string;
  ultima_compra: string | null;
  primera_compra: string | null;
  ventas_total: number;
  facturas_total: number;
  promedio_mensual: number;
  dias_sin_compra: number;
  clasificacion: "NUEVO" | "PERDIDO" | "ACTIVO" | "OTRO";
};

export default function SaludRutas() {
  const [dias, setDias]           = useState(60);
  const [prefijos, setPrefijos]   = useState("*");
  const [data, setData]           = useState<RutaSalud[]>([]);
  const [totales, setTotales]     = useState<Totales | null>(null);
  const [cargando, setCargando]   = useState(false);
  const [expandido, setExpandido] = useState(false);

  // Drill-down state
  const [rutaSeleccionada, setRutaSeleccionada] = useState<string | null>(null);
  const [detalle, setDetalle] = useState<{ nuevos: DetalleRow[]; perdidos: DetalleRow[]; activos: DetalleRow[] } | null>(null);
  const [cargandoDetalle, setCargandoDetalle] = useState(false);
  const [tabDetalle, setTabDetalle] = useState<"perdidos" | "nuevos" | "activos">("perdidos");

  const abrirDetalle = async (ruta: string) => {
    setRutaSeleccionada(ruta);
    setDetalle(null);
    setCargandoDetalle(true);
    try {
      const res = await fetchAuth(`${API_BASE_URL}/api/dashboard-clientes/ruta-detalle?ruta=${encodeURIComponent(ruta)}&dias=${dias}`);
      const json = await res.json();
      if (json.ok) {
        setDetalle({ nuevos: json.nuevos || [], perdidos: json.perdidos || [], activos: json.activos || [] });
      }
    } catch (e) { console.error(e); }
    finally { setCargandoDetalle(false); }
  };

  useEffect(() => {
    if (!expandido) return;
    const ctrl = new AbortController();
    (async () => {
      setCargando(true);
      try {
        const url = `${API_BASE_URL}/api/dashboard-clientes/salud-rutas?dias=${dias}&prefijos=${encodeURIComponent(prefijos)}`;
        const res = await fetchAuth(url, { signal: ctrl.signal });
        const json = await res.json();
        if (json.ok) {
          setData(json.data || []);
          setTotales(json.totales || null);
        }
      } catch (e: any) {
        if (e?.name !== "AbortError") console.error("Error salud-rutas:", e);
      } finally {
        setCargando(false);
      }
    })();
    return () => ctrl.abort();
  }, [expandido, dias, prefijos]);

  const orden = useMemo(() => {
    return [...data].sort((a, b) => {
      // Las rutas con peor net_delta primero (más alarma)
      if (a.net_delta_clientes !== b.net_delta_clientes) return a.net_delta_clientes - b.net_delta_clientes;
      return b.valor_perdido_mensual - a.valor_perdido_mensual;
    });
  }, [data]);

  return (
    <div className="mb-6 bg-gradient-to-br from-[#012E24] to-[#013d30] border border-[#046C5E]/40 rounded-2xl shadow-2xl overflow-hidden">
      {/* Header */}
      <div className="px-4 md:px-6 py-4 flex flex-wrap items-center justify-between gap-3 border-b border-[#046C5E]/40 bg-gradient-to-r from-blue-900/20 to-transparent">
        <div className="flex items-center gap-3 min-w-0">
          <div className="bg-blue-500/20 border border-blue-500/40 rounded-xl p-2 shrink-0">
            <Activity className="text-blue-400" size={22} />
          </div>
          <div className="min-w-0">
            <h2 className="text-base md:text-lg font-bold text-white flex items-center gap-2 flex-wrap">
              Salud por Ruta
              {cargando && (
                <span className="text-xs text-emerald-400 inline-flex items-center gap-1">
                  <span className="w-3 h-3 border-2 border-emerald-400/20 border-t-emerald-400 rounded-full animate-spin"/>
                  cargando…
                </span>
              )}
            </h2>
            <p className="text-[11px] md:text-xs text-white/60">
              Comparativa de clientes <span className="text-emerald-300">nuevos</span> vs <span className="text-red-300">perdidos</span> por ruta — ventana de <span className="font-semibold">{dias} días</span>
            </p>
          </div>
        </div>
        <button
          onClick={() => setExpandido(o => !o)}
          className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 text-xs flex items-center gap-1.5 text-white/70 hover:text-white transition-colors"
        >
          {expandido ? <>Ocultar <ChevronUp size={14} /></> : <>Ver <ChevronDown size={14} /></>}
        </button>
      </div>

      {expandido && (
        <div className="p-4 md:p-6 space-y-5">
          {/* Filtros: prefijo + ventana */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[10px] uppercase tracking-widest text-white/40 font-semibold mr-1">Tipo:</span>
              {PRESET_PREFIJOS.map(p => (
                <button key={p.id} onClick={() => setPrefijos(p.value)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-all ${
                    prefijos === p.value
                      ? "bg-blue-500/30 border-blue-500 text-blue-200"
                      : "bg-[#013d32] border-[#046C5E] text-white/50 hover:text-white hover:border-blue-500/40"
                  }`}>
                  {p.label}
                </button>
              ))}
            </div>
            <div className="h-6 w-px bg-white/10 hidden md:block" />
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[10px] uppercase tracking-widest text-white/40 font-semibold mr-1">Ventana:</span>
              {VENTANAS.map(v => (
                <button key={v} onClick={() => setDias(v)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-all ${
                    dias === v
                      ? "bg-emerald-500/30 border-emerald-500 text-emerald-200"
                      : "bg-[#013d32] border-[#046C5E] text-white/50 hover:text-white hover:border-emerald-500/40"
                  }`}>
                  {v}d
                </button>
              ))}
            </div>
          </div>

          {/* Resumen total */}
          {totales && (
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              <div className="rounded-xl p-3 border border-emerald-500/30 bg-emerald-500/10">
                <p className="text-[10px] uppercase tracking-widest text-emerald-300/80 font-semibold mb-1 flex items-center gap-1">
                  <ArrowUpRight size={12} /> Nuevos
                </p>
                <p className="text-2xl font-bold text-emerald-300">{num(totales.nuevos)}</p>
              </div>
              <div className="rounded-xl p-3 border border-red-500/30 bg-red-500/10">
                <p className="text-[10px] uppercase tracking-widest text-red-300/80 font-semibold mb-1 flex items-center gap-1">
                  <ArrowDownRight size={12} /> Perdidos
                </p>
                <p className="text-2xl font-bold text-red-300">{num(totales.perdidos)}</p>
              </div>
              <div className={`rounded-xl p-3 border ${
                totales.net_delta_clientes >= 0
                  ? "bg-emerald-500/10 border-emerald-500/30"
                  : "bg-red-500/10 border-red-500/30"
              }`}>
                <p className="text-[10px] uppercase tracking-widest text-white/60 font-semibold mb-1">Net Δ clientes</p>
                <p className={`text-2xl font-bold ${totales.net_delta_clientes >= 0 ? "text-emerald-300" : "text-red-300"}`}>
                  {totales.net_delta_clientes > 0 ? "+" : ""}{num(totales.net_delta_clientes)}
                </p>
              </div>
              <div className="rounded-xl p-3 border border-white/10 bg-black/25">
                <p className="text-[10px] uppercase tracking-widest text-white/50 font-semibold mb-1">$ perdido/mes</p>
                <p className="text-lg font-bold text-red-300 break-all">{money(totales.valor_perdido_mensual)}</p>
              </div>
              <div className="rounded-xl p-3 border border-white/10 bg-black/25">
                <p className="text-[10px] uppercase tracking-widest text-white/50 font-semibold mb-1">Rotación</p>
                <p className="text-2xl font-bold text-yellow-300">{totales.rotacion_porc}%</p>
              </div>
            </div>
          )}

          {/* Cards por ruta */}
          {orden.length === 0 ? (
            <div className="text-center py-10 text-white/40 italic text-sm">
              {cargando ? "Cargando…" : "Sin rutas con datos"}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
              {orden.map(r => <CardRuta key={r.ruta} r={r} onClick={() => abrirDetalle(r.ruta)} />)}
            </div>
          )}
        </div>
      )}

      {/* Modal de drill-down */}
      {rutaSeleccionada && (
        <ModalDetalleRuta
          ruta={rutaSeleccionada}
          detalle={detalle}
          cargando={cargandoDetalle}
          tab={tabDetalle}
          onChangeTab={setTabDetalle}
          onClose={() => { setRutaSeleccionada(null); setDetalle(null); }}
        />
      )}
    </div>
  );
}

// ─── Card por ruta ────────────────────────────────────────────────────────
function CardRuta({ r, onClick }: { r: RutaSalud; onClick: () => void }) {
  const colorBorder = severidadColor(r.net_delta_clientes, r.perdidos);
  const positivo = r.net_delta_clientes >= 0;
  const equilibrio = r.net_delta_clientes === 0;

  return (
    <button onClick={onClick}
      className={`bg-gradient-to-br ${colorBorder} to-[#012E24] border rounded-xl p-3 hover:shadow-xl hover:scale-[1.01] transition-all flex flex-col gap-2.5 text-left`}>
      {/* Header: Ruta + delta */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-base font-bold text-white leading-tight">{r.ruta}</p>
          <p className="text-[10px] text-white/40">
            {num(r.activos)} activos · {num(r.clientes_totales)} totales
          </p>
        </div>
        <span className={`shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold border whitespace-nowrap
          ${positivo && !equilibrio ? "text-emerald-300 bg-emerald-500/15 border-emerald-500/40"
            : equilibrio ? "text-gray-300 bg-gray-500/15 border-gray-500/40"
            : "text-red-300 bg-red-500/15 border-red-500/40"}`}>
          {positivo && !equilibrio ? <TrendingUp size={11}/> : equilibrio ? <Minus size={11}/> : <TrendingDown size={11}/>}
          {r.net_delta_clientes > 0 ? "+" : ""}{r.net_delta_clientes}
        </span>
      </div>

      {/* Nuevos vs Perdidos */}
      <div className="grid grid-cols-2 gap-1.5">
        <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-2 text-center">
          <p className="text-[9px] uppercase text-emerald-300/80 mb-0.5 flex items-center justify-center gap-1">
            <ArrowUpRight size={10}/> Nuevos
          </p>
          <p className="text-lg font-bold text-emerald-300 leading-none">{num(r.nuevos)}</p>
          <p className="text-[10px] text-emerald-300/70 mt-0.5">{money(r.valor_ganado)}</p>
        </div>
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-2 text-center">
          <p className="text-[9px] uppercase text-red-300/80 mb-0.5 flex items-center justify-center gap-1">
            <ArrowDownRight size={10}/> Perdidos
          </p>
          <p className="text-lg font-bold text-red-300 leading-none">{num(r.perdidos)}</p>
          <p className="text-[10px] text-red-300/70 mt-0.5">{money(r.valor_perdido_mensual)}/mes</p>
        </div>
      </div>

      {/* Métricas adicionales */}
      <div className="grid grid-cols-2 gap-1.5 text-[10px]">
        <div className="bg-black/25 rounded-md px-2 py-1.5 border border-white/5">
          <p className="text-white/40 uppercase">Rotación</p>
          <p className={`font-bold ${
            r.rotacion_porc < 10 ? "text-emerald-300"
            : r.rotacion_porc < 25 ? "text-yellow-300"
            : "text-red-300"
          }`}>{r.rotacion_porc}%</p>
        </div>
        <div className="bg-black/25 rounded-md px-2 py-1.5 border border-white/5">
          <p className="text-white/40 uppercase">$ activos/mes</p>
          <p className="font-bold text-blue-300">{money(r.valor_activo_mensual)}</p>
        </div>
      </div>
      <p className="text-[10px] text-white/40 italic text-center inline-flex items-center justify-center gap-0.5">Click para ver clientes <ChevronRight size={10}/></p>
    </button>
  );
}

// ─── Modal drill-down ─────────────────────────────────────────────────────
function ModalDetalleRuta({
  ruta, detalle, cargando, tab, onChangeTab, onClose,
}: {
  ruta: string;
  detalle: { nuevos: DetalleRow[]; perdidos: DetalleRow[]; activos: DetalleRow[] } | null;
  cargando: boolean;
  tab: "perdidos" | "nuevos" | "activos";
  onChangeTab: (t: "perdidos" | "nuevos" | "activos") => void;
  onClose: () => void;
}) {
  const filas = detalle ? detalle[tab] : [];
  const tabsCfg = [
    { id: "perdidos" as const, label: "Perdidos", color: "text-red-300 border-red-500", count: detalle?.perdidos.length ?? 0 },
    { id: "nuevos" as const,   label: "Nuevos",   color: "text-emerald-300 border-emerald-500", count: detalle?.nuevos.length ?? 0 },
    { id: "activos" as const,  label: "Activos",  color: "text-blue-300 border-blue-500", count: detalle?.activos.length ?? 0 },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4" onClick={onClose}>
      <div onClick={e => e.stopPropagation()}
        className="bg-gradient-to-br from-[#013d32] to-[#012E24] border border-[#046C5E] rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] flex flex-col overflow-hidden">
        <div className="px-5 py-4 border-b border-[#046C5E]/40 flex items-center justify-between">
          <div>
            <p className="text-[10px] uppercase tracking-widest text-blue-300 font-semibold">Detalle de ruta</p>
            <h3 className="text-lg font-bold text-white">{ruta}</h3>
          </div>
          <button onClick={onClose} className="text-white/40 hover:text-white p-1 rounded-lg hover:bg-white/10">
            <X size={20}/>
          </button>
        </div>
        <div className="px-5 py-2 border-b border-[#046C5E]/40 flex gap-2">
          {tabsCfg.map(t => (
            <button key={t.id} onClick={() => onChangeTab(t.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium border-b-2 transition-all ${
                tab === t.id ? `${t.color} bg-white/5` : "border-transparent text-white/50 hover:text-white"
              }`}>
              {t.label} ({t.count})
            </button>
          ))}
        </div>
        <div className="flex-1 overflow-auto px-5 py-3">
          {cargando ? (
            <p className="text-center text-white/40 italic py-8">Cargando…</p>
          ) : filas.length === 0 ? (
            <p className="text-center text-white/40 italic py-8">Sin clientes en este grupo</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="text-[10px] uppercase tracking-wider text-white/50">
                  <tr>
                    <th className="px-2 py-2 text-left">Cliente</th>
                    <th className="px-2 py-2 text-left">Ciudad</th>
                    <th className="px-2 py-2 text-right">Última compra</th>
                    <th className="px-2 py-2 text-right">Días sin</th>
                    <th className="px-2 py-2 text-right">Promedio/mes</th>
                  </tr>
                </thead>
                <tbody>
                  {filas.map((f, i) => (
                    <tr key={f.codigo_cliente} className={`border-t border-white/5 ${i % 2 === 0 ? "bg-black/20" : "bg-black/30"}`}>
                      <td className="px-2 py-2">
                        <div className="text-xs font-medium text-white">{f.nombre_cliente}</div>
                        <div className="text-[10px] text-white/40 font-mono">{f.ruc || "Sin RUC"}</div>
                      </td>
                      <td className="px-2 py-2 text-xs text-white/60">{f.ciudad || "-"}</td>
                      <td className="px-2 py-2 text-right text-xs text-white/70">{f.ultima_compra ? new Date(f.ultima_compra).toLocaleDateString("es-EC") : "-"}</td>
                      <td className="px-2 py-2 text-right text-xs text-yellow-300">{f.dias_sin_compra}d</td>
                      <td className="px-2 py-2 text-right text-xs text-emerald-300 font-semibold">{money(f.promedio_mensual)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
