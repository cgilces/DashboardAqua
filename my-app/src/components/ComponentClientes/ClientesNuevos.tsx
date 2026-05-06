import React, { useEffect, useMemo, useState } from "react";
import {
  UserPlus, ChevronDown, ChevronUp, CalendarDays, ArrowLeft, AlertCircle, ChevronRight,
} from "lucide-react";
import { BsDownload } from "react-icons/bs";
import toast from "react-hot-toast";
import { API_BASE_URL } from "../../config";
import { fetchAuth } from "../../utils/fetchAuth";
import { exportExcel } from "../../utils/exportExcel";

// ─── Tipos ───────────────────────────────────────────────────────────────
type CanalRow = {
  canal: string;
  total_nuevos: number;
  facturado: number;
  activos: number;
  sin_recompra: number;
  sin_actividad: number;
  pct_retencion_temprana: number;
  pct_sin_recompra: number;
  pct_sin_actividad: number;
};

type ClienteNuevo = {
  codigo_cliente: string;
  ruc: string;
  nombre_cliente: string;
  vendedor: string;
  telefono: string;
  email: string;
  ciudad: string;
  canal: string;
  fecha_creacion: string;
  pedidos_periodo: number;
  facturado_periodo: number;
  ultima_compra_periodo: string | null;
  estado: "ACTIVO" | "SIN_RECOMPRA" | "SIN_ACTIVIDAD";
};

type Totales = CanalRow;

const fmtD = (d: Date) => d.toISOString().slice(0, 10);
const today = () => fmtD(new Date());
const startOfYear = () => `${new Date().getFullYear()}-01-01`;
const startOfMonth = () => `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}-01`;
const isDate = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s);

const PRESETS = [
  { id: "ano",   label: "Año corriente", desde: startOfYear,  hasta: today },
  { id: "mes",   label: "Mes corriente", desde: startOfMonth, hasta: today },
  { id: "2026",  label: "Desde 1 ene 2026", desde: () => "2026-01-01", hasta: today },
];

const ESTADO_CFG: Record<string, { label: string; color: string; dot: string }> = {
  ACTIVO:        { label: "Activo (2+ compras)",       color: "text-emerald-300 bg-emerald-500/15 border-emerald-500/30", dot: "bg-emerald-500" },
  SIN_RECOMPRA:  { label: "Reciente sin recompra",     color: "text-yellow-300 bg-yellow-500/15 border-yellow-500/30",   dot: "bg-yellow-400" },
  SIN_ACTIVIDAD: { label: "Sin actividad",             color: "text-gray-300 bg-gray-500/15 border-gray-500/30",         dot: "bg-gray-500" },
};

const money = (n = 0) => Number(n).toLocaleString("es-EC", { style: "currency", currency: "USD" });
const num   = (n = 0) => Number(n).toLocaleString("es-EC");
const fmtFecha = (s: string | null) => s ? new Date(s).toLocaleDateString("es-EC") : "-";

// Color por canal (consistente con tipo_negocio)
function colorCanal(c: string) {
  const k = c.toUpperCase();
  if (k.includes("VIP")) return { border: "border-purple-500/40", bg: "from-purple-900/15", accent: "text-purple-300" };
  if (k.includes("DOMICILIO")) return { border: "border-blue-500/40", bg: "from-blue-900/15", accent: "text-blue-300" };
  if (k.includes("MAYORISTA") || k.includes("MAYOR")) return { border: "border-orange-500/40", bg: "from-orange-900/15", accent: "text-orange-300" };
  if (k.includes("EMPRESA")) return { border: "border-cyan-500/40", bg: "from-cyan-900/15", accent: "text-cyan-300" };
  if (k.includes("RURAL")) return { border: "border-yellow-500/40", bg: "from-yellow-900/15", accent: "text-yellow-300" };
  if (k.includes("TIENDA")) return { border: "border-emerald-500/40", bg: "from-emerald-900/15", accent: "text-emerald-300" };
  return { border: "border-white/20", bg: "from-white/5", accent: "text-white/70" };
}

// ─── Componente ──────────────────────────────────────────────────────────
export default function ClientesNuevos() {
  const [desde, setDesde] = useState("2026-01-01");
  const [hasta, setHasta] = useState(today());
  const [draftDesde, setDraftDesde] = useState("2026-01-01");
  const [draftHasta, setDraftHasta] = useState(today());

  const [canales, setCanales] = useState<CanalRow[]>([]);
  const [totales, setTotales] = useState<Totales | null>(null);
  const [data, setData] = useState<ClienteNuevo[]>([]);
  const [cargando, setCargando] = useState(false);
  const [expandido, setExpandido] = useState(false);

  // Drill-down: canal seleccionado para ver tabla
  const [canalDetalle, setCanalDetalle] = useState<string | null>(null);
  const [filtroEstado, setFiltroEstado] = useState<string>("");
  const [busqueda, setBusqueda] = useState("");

  // Cargar (lazy: solo cuando está expandido)
  useEffect(() => {
    if (!expandido) return;
    const ctrl = new AbortController();
    (async () => {
      setCargando(true);
      try {
        const url = `${API_BASE_URL}/api/dashboard-clientes/clientes-nuevos?desde=${desde}&hasta=${hasta}`;
        const res = await fetchAuth(url, { signal: ctrl.signal });
        const json = await res.json();
        if (json.ok) {
          setCanales(json.canales || []);
          setTotales(json.totales || null);
          setData(json.data || []);
        }
      } catch (e: any) {
        if (e?.name !== "AbortError") console.error("Error clientes-nuevos:", e);
      } finally {
        setCargando(false);
      }
    })();
    return () => ctrl.abort();
  }, [expandido, desde, hasta]);

  const aplicarPreset = (p: typeof PRESETS[number]) => {
    const d = p.desde(); const h = p.hasta();
    setDraftDesde(d); setDraftHasta(h);
    setDesde(d); setHasta(h);
  };
  const aplicarRango = () => {
    if (isDate(draftDesde) && isDate(draftHasta)) {
      setDesde(draftDesde); setHasta(draftHasta);
    }
  };

  // Filtro de detalle
  const detalleFiltrado = useMemo(() => {
    let d = canalDetalle ? data.filter(r => r.canal === canalDetalle) : data;
    if (filtroEstado) d = d.filter(r => r.estado === filtroEstado);
    if (busqueda.trim()) {
      const q = busqueda.trim().toLowerCase();
      d = d.filter(r =>
        r.nombre_cliente.toLowerCase().includes(q) ||
        r.ruc.toLowerCase().includes(q) ||
        (r.vendedor || "").toLowerCase().includes(q)
      );
    }
    return d;
  }, [data, canalDetalle, filtroEstado, busqueda]);

  return (
    <div className="mb-6 bg-gradient-to-br from-[#0d2a3a] via-[#0a1f2c] to-[#012E24] border border-cyan-500/30 rounded-2xl shadow-2xl overflow-hidden">
      {/* Header */}
      <div className="px-4 md:px-6 py-4 flex flex-wrap items-center justify-between gap-3 border-b border-cyan-500/20 bg-gradient-to-r from-cyan-900/30 to-transparent">
        <div className="flex items-center gap-3 min-w-0">
          <div className="bg-cyan-500/20 border border-cyan-500/40 rounded-xl p-2 shrink-0">
            <UserPlus className="text-cyan-400" size={22} />
          </div>
          <div className="min-w-0">
            <h2 className="text-base md:text-lg font-bold text-white flex items-center gap-2 flex-wrap">
              Clientes Nuevos por Canal
              {cargando && (
                <span className="text-xs text-emerald-400 inline-flex items-center gap-1">
                  <span className="w-3 h-3 border-2 border-emerald-400/20 border-t-emerald-400 rounded-full animate-spin"/>
                  cargando…
                </span>
              )}
            </h2>
            <p className="text-[11px] md:text-xs text-white/60">
              Adquisición y retención temprana — período <span className="font-semibold text-white">{desde}</span> a <span className="font-semibold text-white">{hasta}</span>
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {expandido && data.length > 0 && (
            <button
              onClick={() => {
                exportExcel("clientes_nuevos", data.map((c, i) => ({
                  "N°": i + 1,
                  "Canal": c.canal,
                  "RUC": c.ruc,
                  "Cliente": c.nombre_cliente,
                  "Ciudad": c.ciudad,
                  "Vendedor": c.vendedor,
                  "Primera compra": c.fecha_creacion,
                  "Pedidos en período": c.pedidos_periodo,
                  "Última compra": c.ultima_compra_periodo,
                  "Facturado período": c.facturado_periodo,
                  "Estado": c.estado,
                  "Teléfono": c.telefono,
                  "Email": c.email,
                })), "ClientesNuevos");
                toast.success(`Exportado ${data.length} clientes`);
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-emerald-500/40 bg-emerald-500/15 text-emerald-300 text-xs font-medium hover:bg-emerald-500/25 transition-colors">
              <BsDownload size={12}/> Exportar
            </button>
          )}
          <button onClick={() => setExpandido(o => !o)}
            className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 text-xs flex items-center gap-1.5 text-white/70 hover:text-white transition-colors">
            {expandido ? <>Ocultar <ChevronUp size={14} /></> : <>Ver <ChevronDown size={14} /></>}
          </button>
        </div>
      </div>

      {expandido && (
        <div className="p-4 md:p-6 space-y-5">
          {/* Aviso de calidad de datos */}
          <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg px-3 py-2 text-[11px] text-yellow-200/90 flex gap-2">
            <AlertCircle size={14} className="shrink-0 mt-0.5"/>
            <div>
              <span className="font-semibold">Nota sobre fuente de datos:</span> "Cliente nuevo" se calcula por <span className="underline">fecha de primera factura</span> en el rango (no por <code>fecha_creacion_cliente</code> que se reescribe en cada sync).
              Canal usa <span className="underline">tipo de negocio</span> (cobertura ~58%) hasta que <code>codigo_subcanal</code> esté limpio en Odoo (hoy 22%).
            </div>
          </div>

          {/* Filtros de fecha */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[10px] uppercase tracking-widest text-white/40 font-semibold mr-1">Período:</span>
              {PRESETS.map(p => {
                const isActive = desde === p.desde() && hasta === p.hasta();
                return (
                  <button key={p.id} onClick={() => aplicarPreset(p)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-all ${
                      isActive
                        ? "bg-cyan-500/30 border-cyan-500 text-cyan-200"
                        : "bg-[#013d32] border-[#046C5E] text-white/50 hover:text-white"
                    }`}>
                    {p.label}
                  </button>
                );
              })}
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs text-white/40">Desde</span>
              <div className="relative">
                <CalendarDays size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-white/50 pointer-events-none" />
                <input type="date" value={draftDesde} onChange={e => setDraftDesde(e.target.value)}
                  className="bg-[#014434] border border-[#046C5E] rounded-lg pl-8 pr-3 py-1.5 text-sm text-white focus:outline-none focus:border-emerald-500/60 [color-scheme:dark]"/>
              </div>
              <span className="text-xs text-white/40">Hasta</span>
              <div className="relative">
                <CalendarDays size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-white/50 pointer-events-none" />
                <input type="date" value={draftHasta} onChange={e => setDraftHasta(e.target.value)}
                  className="bg-[#014434] border border-[#046C5E] rounded-lg pl-8 pr-3 py-1.5 text-sm text-white focus:outline-none focus:border-emerald-500/60 [color-scheme:dark]"/>
              </div>
              <button onClick={aplicarRango} disabled={!isDate(draftDesde) || !isDate(draftHasta)}
                className="px-3 py-1.5 bg-emerald-700 rounded-lg text-xs font-medium text-white disabled:opacity-30 hover:bg-emerald-600 transition-all">
                Aplicar
              </button>
            </div>
          </div>

          {/* Vista: cards de canal o detalle */}
          {!canalDetalle ? (
            <>
              {/* Totales */}
              {totales && totales.total_nuevos > 0 && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <KpiCard label="Total nuevos"     value={num(totales.total_nuevos)}                 color="text-white" />
                  <KpiCard label="Facturación"      value={money(totales.facturado)}                  color="text-cyan-300" highlight />
                  <KpiCard label="Retención temprana" value={`${totales.pct_retencion_temprana}%`}    color="text-emerald-300" />
                  <KpiCard label="Sin recompra"     value={`${totales.pct_sin_recompra}%`}            color="text-yellow-300" />
                </div>
              )}

              {/* Cards por canal */}
              {canales.length === 0 ? (
                <div className="text-center py-10 text-white/40 italic text-sm">
                  {cargando ? "Cargando…" : "Sin clientes nuevos en el período"}
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {canales.map(c => {
                    const col = colorCanal(c.canal);
                    return (
                      <button key={c.canal} onClick={() => setCanalDetalle(c.canal)}
                        className={`bg-gradient-to-br ${col.bg} to-[#012E24] border ${col.border} rounded-xl p-4 hover:shadow-xl hover:scale-[1.01] transition-all text-left flex flex-col gap-3`}>
                        {/* Canal name */}
                        <div className="flex items-start justify-between gap-2">
                          <p className={`text-sm font-bold ${col.accent} truncate`}>{c.canal}</p>
                          <span className="text-[10px] text-white/40 italic shrink-0 inline-flex items-center gap-0.5">Ver clientes <ChevronRight size={10}/></span>
                        </div>

                        {/* Total + facturación */}
                        <div className="flex items-end justify-between">
                          <div>
                            <p className="text-[10px] text-white/40 uppercase">Nuevos</p>
                            <p className="text-2xl font-extrabold text-white leading-none">{num(c.total_nuevos)}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-[10px] text-white/40 uppercase">Facturado</p>
                            <p className="text-base font-bold text-cyan-300">{money(c.facturado)}</p>
                          </div>
                        </div>

                        <div className="border-t border-white/10"/>

                        {/* % retención + barra */}
                        <div>
                          <div className="flex items-center justify-between text-[10px] text-white/50 mb-1">
                            <span>Retención temprana</span>
                            <span className="text-emerald-300 font-bold">{c.pct_retencion_temprana}%</span>
                          </div>
                          <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                            <div className="h-full bg-emerald-500" style={{ width: `${c.pct_retencion_temprana}%` }}/>
                          </div>
                        </div>

                        {/* Distribución por estado */}
                        <div className="grid grid-cols-3 gap-1.5 text-center text-[10px]">
                          <div className="bg-emerald-500/10 border border-emerald-500/20 rounded px-1 py-1">
                            <p className="text-emerald-300/80">2+ compras</p>
                            <p className="font-bold text-emerald-300">{num(c.activos)}</p>
                          </div>
                          <div className="bg-yellow-500/10 border border-yellow-500/20 rounded px-1 py-1">
                            <p className="text-yellow-300/80">1 compra</p>
                            <p className="font-bold text-yellow-300">{num(c.sin_recompra)}</p>
                          </div>
                          <div className="bg-gray-500/10 border border-gray-500/20 rounded px-1 py-1">
                            <p className="text-gray-300/80">0 compras</p>
                            <p className="font-bold text-gray-300">{num(c.sin_actividad)}</p>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </>
          ) : (
            // Vista detalle: tabla de clientes del canal
            <DetalleCanal
              canal={canalDetalle}
              clientes={detalleFiltrado}
              filtroEstado={filtroEstado}
              busqueda={busqueda}
              onChangeFiltroEstado={setFiltroEstado}
              onChangeBusqueda={setBusqueda}
              onVolver={() => { setCanalDetalle(null); setFiltroEstado(""); setBusqueda(""); }}
            />
          )}
        </div>
      )}
    </div>
  );
}

// ─── Subcomponentes ───────────────────────────────────────────────────────
function KpiCard({ label, value, color, highlight = false }: {
  label: string; value: string; color: string; highlight?: boolean;
}) {
  return (
    <div className={`rounded-xl p-3 border ${highlight ? "bg-cyan-500/10 border-cyan-500/40" : "bg-black/25 border-white/10"}`}>
      <p className="text-[10px] uppercase tracking-widest text-white/50 font-semibold mb-1">{label}</p>
      <p className={`text-lg md:text-xl font-bold ${color} leading-tight break-all`}>{value}</p>
    </div>
  );
}

function DetalleCanal({
  canal, clientes, filtroEstado, busqueda,
  onChangeFiltroEstado, onChangeBusqueda, onVolver,
}: {
  canal: string;
  clientes: ClienteNuevo[];
  filtroEstado: string;
  busqueda: string;
  onChangeFiltroEstado: (s: string) => void;
  onChangeBusqueda: (s: string) => void;
  onVolver: () => void;
}) {
  const totalFact = clientes.reduce((a, c) => a + Number(c.facturado_periodo || 0), 0);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <button onClick={onVolver}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 text-xs text-white/70 hover:text-white transition-colors">
            <ArrowLeft size={14}/> Volver a canales
          </button>
          <h3 className="text-base font-bold text-cyan-300">{canal}</h3>
          <span className="text-xs text-white/50">— {clientes.length} clientes · {money(totalFact)}</span>
        </div>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <select value={filtroEstado} onChange={e => onChangeFiltroEstado(e.target.value)}
          className="bg-[#013d32] border border-[#046C5E] rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-emerald-500/60">
          <option value="">Todos los estados</option>
          <option value="ACTIVO">Activos (2+ compras)</option>
          <option value="SIN_RECOMPRA">Sin recompra (1 compra)</option>
          <option value="SIN_ACTIVIDAD">Sin actividad (0)</option>
        </select>
        <input value={busqueda} onChange={e => onChangeBusqueda(e.target.value)}
          placeholder="Buscar nombre, RUC, vendedor..."
          className="flex-1 min-w-[200px] bg-[#013d32] border border-[#046C5E] rounded-lg px-3 py-1.5 text-sm text-white placeholder-white/30 focus:outline-none focus:border-emerald-500/60"/>
      </div>

      {clientes.length === 0 ? (
        <p className="text-center text-white/40 italic py-6 text-sm">Sin clientes con esos filtros</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-cyan-500/20">
          <table className="min-w-full text-sm">
            <thead className="bg-cyan-900/20 text-cyan-200 uppercase text-[10px] tracking-wider">
              <tr>
                <th className="px-3 py-3 text-left">Cliente</th>
                <th className="px-3 py-3 text-left">Vendedor</th>
                <th className="px-3 py-3 text-left">1ra compra</th>
                <th className="px-3 py-3 text-right">Pedidos</th>
                <th className="px-3 py-3 text-left">Última compra</th>
                <th className="px-3 py-3 text-right">Facturado</th>
                <th className="px-3 py-3 text-center">Estado</th>
              </tr>
            </thead>
            <tbody>
              {clientes.map((c, idx) => {
                const cfg = ESTADO_CFG[c.estado] || ESTADO_CFG.SIN_ACTIVIDAD;
                return (
                  <tr key={c.codigo_cliente}
                      className={`border-t border-cyan-500/10 ${idx % 2 === 0 ? "bg-black/20" : "bg-black/30"} hover:bg-cyan-500/5 transition-colors`}>
                    <td className="px-3 py-2">
                      <div className="font-medium text-white text-xs leading-tight truncate max-w-[280px]" title={c.nombre_cliente}>
                        {c.nombre_cliente}
                      </div>
                      <div className="text-[10px] text-white/40 mt-0.5 font-mono">
                        {c.ruc || "Sin RUC"} {c.ciudad && `· ${c.ciudad}`}
                      </div>
                    </td>
                    <td className="px-3 py-2 text-xs text-blue-300">{c.vendedor || "-"}</td>
                    <td className="px-3 py-2 text-xs text-white/70">{fmtFecha(c.fecha_creacion)}</td>
                    <td className="px-3 py-2 text-right font-semibold text-white">{c.pedidos_periodo}</td>
                    <td className="px-3 py-2 text-xs text-white/70">{fmtFecha(c.ultima_compra_periodo)}</td>
                    <td className="px-3 py-2 text-right font-bold text-cyan-300">{money(c.facturado_periodo)}</td>
                    <td className="px-3 py-2 text-center">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold border ${cfg.color}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`}/>
                        {cfg.label}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
