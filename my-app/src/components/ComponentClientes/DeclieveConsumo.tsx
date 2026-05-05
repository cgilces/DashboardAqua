import React, { useEffect, useMemo, useState } from "react";
import {
  TrendingDown, Phone, MessageCircle, X, History, ChevronDown, ChevronUp,
  Users, AlertTriangle, BarChart3,
} from "lucide-react";
import { API_BASE_URL } from "../../config";
import { useAuth } from "../auth/AuthContext";

// ─── Tipos ───────────────────────────────────────────────────────────────
type ClienteDeclive = {
  group_key: string;
  codigo_cliente: string;
  ruc: string;
  nombre_cliente: string;
  vendedor: string;
  telefono: string;
  email: string;
  ciudad: string;
  tipo_negocio: string;
  canal_subcanal: string;
  unidades_90d: number;
  unidades_reciente: number;
  ventas_90d: number;
  ventas_reciente: number;
  facturas_90d: number;
  facturas_reciente: number;
  ultima_compra: string;
  dias_sin_compra: number;
  baseline_semanas: number;
  baseline_semanal_unidades: number;
  reciente_semanal_unidades: number;
  precio_promedio: number;
  caida_porc: number;
  volumen_riesgo: number;
  ultimo_contacto_fecha: string | null;
  ultimo_contacto_por: string | null;
  ultimo_contacto_resultado: string | null;
};

type ContactoHist = {
  id: number;
  fecha_contacto: string;
  contactado_por: string;
  resultado: string;
  notas: string | null;
  dias_sin_compra_al_contactar: number | null;
};

type KPIs = {
  totalClientes: number;
  totalRiesgo: number;
  caidaPromedio: number;
  recuperados7d: number;
  clientesContactados7d: number;
};

const RESULTADOS = [
  { value: "CONTACTADO",          label: "Contactado",          color: "text-blue-300 bg-blue-500/15 border-blue-500/30" },
  { value: "NO_CONTESTA",         label: "No contestó",         color: "text-gray-300 bg-gray-500/15 border-gray-500/30" },
  { value: "PROMETIO_COMPRAR",    label: "Prometió subir",      color: "text-yellow-300 bg-yellow-500/15 border-yellow-500/30" },
  { value: "NO_INTERESADO",       label: "No interesado",       color: "text-red-300 bg-red-500/15 border-red-500/30" },
  { value: "CONSUMO_RECUPERADO",  label: "Consumo recuperado",  color: "text-emerald-300 bg-emerald-500/15 border-emerald-500/30" },
];

const UMBRALES = [30, 50, 70];
const VENTANAS = [14, 21, 28];

const PRESET_PREFIJOS = [
  { id: "todos",      label: "Todos",         value: "*"   },
  { id: "autoventa",  label: "Autoventa (R)", value: "R"   },
  { id: "preventa",   label: "PVR",           value: "PVR" },
  { id: "tiendas",    label: "Tiendas (PV)",  value: "PV"  },
  { id: "domicilio",  label: "Domicilio (A)", value: "A"   },
  { id: "vip",        label: "VIP (V)",       value: "V"   },
  { id: "mayorista",  label: "Mayorista (M)", value: "M"   },
];

const money = (n = 0) => Number(n).toLocaleString("es-EC", { style: "currency", currency: "USD" });
const num   = (n = 0) => Number(n).toLocaleString("es-EC", { maximumFractionDigits: 2 });
const fmtFecha = (s: string | null) => s ? new Date(s).toLocaleDateString("es-EC") : "-";
const fmtFechaHora = (s: string) => new Date(s).toLocaleString("es-EC", {
  day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
});
const resultadoCfg = (r: string | null | undefined) =>
  RESULTADOS.find(x => x.value === r) ?? { label: r ?? "-", color: "text-gray-400 bg-gray-500/15 border-gray-500/30", value: "" };

function normalizarTel(t: string) {
  if (!t) return "";
  const limpio = t.replace(/\D/g, "");
  if (!limpio) return "";
  if (limpio.length > 10) return limpio;
  if (limpio.startsWith("0") && limpio.length === 10) return "593" + limpio.slice(1);
  return limpio;
}

// Color del badge de caída según umbral del brief
function cfgCaida(p: number) {
  if (p >= 70) return { color: "text-red-300 bg-red-500/15 border-red-500/40",         label: "CRÍTICO" };
  if (p >= 50) return { color: "text-orange-300 bg-orange-500/15 border-orange-500/40", label: "ALTO"    };
  return                { color: "text-yellow-300 bg-yellow-500/15 border-yellow-500/40", label: "MEDIO"  };
}

// ─── Componente ──────────────────────────────────────────────────────────
export default function DeclieveConsumo() {
  const { user } = useAuth();
  const username = user?.username ?? "anonimo";

  const [umbral, setUmbral]       = useState(30);
  const [ventana, setVentana]     = useState(14);
  const [prefijos, setPrefijos]   = useState("*");
  const [busqueda, setBusqueda]   = useState("");
  const [filtroVendedor, setFiltroVendedor] = useState("");
  const [data, setData]           = useState<ClienteDeclive[]>([]);
  const [kpis, setKpis]           = useState<KPIs | null>(null);
  const [cargando, setCargando]   = useState(false);
  const [expandido, setExpandido] = useState(false);
  const [yaCargado, setYaCargado] = useState(false);

  // Modal
  const [clienteModal, setClienteModal] = useState<ClienteDeclive | null>(null);
  const [historial, setHistorial]       = useState<ContactoHist[]>([]);
  const [cargandoHist, setCargandoHist] = useState(false);
  const [resultado, setResultado]       = useState("CONTACTADO");
  const [notas, setNotas]               = useState("");
  const [guardando, setGuardando]       = useState(false);

  // Cargar (lazy: solo cuando el panel está expandido)
  const cargarDeclive = async () => {
    setCargando(true);
    try {
      const url = `${API_BASE_URL}/api/dashboard-clientes/declive-consumo?umbral=${umbral}&ventana=${ventana}&prefijos=${encodeURIComponent(prefijos)}`;
      const res = await fetch(url);
      const json = await res.json();
      if (json.ok) {
        setData(json.data || []);
        setKpis(json.kpis || null);
        setYaCargado(true);
      }
    } catch (e) {
      console.error("Error declive-consumo:", e);
    } finally {
      setCargando(false);
    }
  };
  useEffect(() => {
    if (!expandido) return;
    cargarDeclive();
  }, [expandido, umbral, ventana, prefijos]);

  // Modal: abrir con historial
  const abrirModal = async (c: ClienteDeclive) => {
    setClienteModal(c);
    setHistorial([]);
    setResultado("CONTACTADO");
    setNotas("");
    setCargandoHist(true);
    try {
      const r = await fetch(`${API_BASE_URL}/api/dashboard-clientes/contactos-recuperacion/historial/${encodeURIComponent(c.group_key)}`);
      const j = await r.json();
      if (j.ok) setHistorial(j.contactos || []);
    } catch (e) { console.error(e); }
    finally { setCargandoHist(false); }
  };

  const guardarContacto = async () => {
    if (!clienteModal) return;
    setGuardando(true);
    try {
      const r = await fetch(`${API_BASE_URL}/api/dashboard-clientes/contactos-recuperacion`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          group_key:                    clienteModal.group_key,
          ruc:                          clienteModal.ruc,
          nombre_cliente:               clienteModal.nombre_cliente,
          contactado_por:               username,
          resultado,
          notas:                        notas.trim() || null,
          dias_sin_compra_al_contactar: clienteModal.dias_sin_compra,
        }),
      });
      const j = await r.json();
      if (j.ok) {
        setNotas("");
        setResultado("CONTACTADO");
        // refrescar historial y la lista (un cliente marcado como CONSUMO_RECUPERADO/NO_INTERESADO sale de la lista)
        const hist = await fetch(`${API_BASE_URL}/api/dashboard-clientes/contactos-recuperacion/historial/${encodeURIComponent(clienteModal.group_key)}`);
        const hjson = await hist.json();
        if (hjson.ok) setHistorial(hjson.contactos || []);
        await cargarDeclive();
      } else {
        alert("No se pudo registrar el contacto");
      }
    } catch (e) {
      console.error(e);
      alert("Error registrando contacto");
    } finally {
      setGuardando(false);
    }
  };

  // Vendedores únicos para filtro
  const vendedoresOpts = useMemo(() => {
    const s = new Set<string>();
    for (const r of data) if (r.vendedor && r.vendedor !== "-") s.add(r.vendedor);
    return [...s].sort();
  }, [data]);

  const filtrados = useMemo(() => {
    let d = data;
    if (filtroVendedor) d = d.filter(r => r.vendedor === filtroVendedor);
    if (busqueda.trim()) {
      const q = busqueda.trim().toLowerCase();
      d = d.filter(r =>
        r.nombre_cliente.toLowerCase().includes(q) ||
        r.ruc.toLowerCase().includes(q) ||
        (r.vendedor || "").toLowerCase().includes(q)
      );
    }
    return d;
  }, [data, filtroVendedor, busqueda]);

  return (
    <div className="mb-6 bg-gradient-to-br from-[#3a2e15] via-[#2a1f10] to-[#012E24] border border-yellow-500/30 rounded-2xl shadow-2xl overflow-hidden">
      {/* Header */}
      <div className="px-4 md:px-6 py-4 flex flex-wrap items-center justify-between gap-3 border-b border-yellow-500/20 bg-gradient-to-r from-yellow-900/30 to-transparent">
        <div className="flex items-center gap-3 min-w-0">
          <div className="bg-yellow-500/20 border border-yellow-500/40 rounded-xl p-2 shrink-0">
            <TrendingDown className="text-yellow-400" size={22} />
          </div>
          <div className="min-w-0">
            <h2 className="text-base md:text-lg font-bold text-white flex items-center gap-2 flex-wrap">
              Clientes en Declive de Consumo
              {cargando && (
                <span className="text-xs text-emerald-400 inline-flex items-center gap-1">
                  <span className="w-3 h-3 border-2 border-emerald-400/20 border-t-emerald-400 rounded-full animate-spin"/>
                  cargando…
                </span>
              )}
            </h2>
            <p className="text-[11px] md:text-xs text-white/60">
              Clientes que <span className="text-white font-semibold">siguen comprando</span> pero su volumen bajó <span className="text-yellow-300 font-semibold">≥{umbral}%</span> vs últimos 90 días — ventana reciente: {ventana}d
            </p>
          </div>
        </div>
        <button onClick={() => setExpandido(o => !o)}
          className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 text-xs flex items-center gap-1.5 text-white/70 hover:text-white transition-colors">
          {expandido ? <>Ocultar <ChevronUp size={14} /></> : <>Ver <ChevronDown size={14} /></>}
        </button>
      </div>

      {expandido && (
        <div className="p-4 md:p-6 space-y-5">
          {/* KPIs */}
          {kpis && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <KpiCard icon={<Users size={16}/>}          label="Clientes en declive" value={kpis.totalClientes.toLocaleString("es-EC")} color="text-white" />
              <KpiCard icon={<AlertTriangle size={16}/>}  label="Volumen en riesgo"   value={money(kpis.totalRiesgo)}                    color="text-yellow-300" highlight />
              <KpiCard icon={<BarChart3 size={16}/>}      label="Caída promedio"      value={`${kpis.caidaPromedio.toFixed(1)}%`}        color="text-orange-300" />
              <KpiCard icon={<TrendingDown size={16}/>}   label="Gestionados (7d)"    value={`${kpis.clientesContactados7d} · ${kpis.recuperados7d} recup.`} color="text-emerald-300" />
            </div>
          )}

          {/* Filtros */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] uppercase tracking-widest text-white/40 font-semibold mr-1">Umbral:</span>
              {UMBRALES.map(u => (
                <button key={u} onClick={() => setUmbral(u)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-all ${
                    umbral === u
                      ? u >= 70 ? "bg-red-500/30 border-red-500 text-red-200"
                        : u >= 50 ? "bg-orange-500/30 border-orange-500 text-orange-200"
                        : "bg-yellow-500/30 border-yellow-500 text-yellow-200"
                      : "bg-[#013d32] border-[#046C5E] text-white/50 hover:text-white"
                  }`}>
                  ≥{u}%
                </button>
              ))}
            </div>
            <div className="h-6 w-px bg-white/10 hidden md:block" />
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] uppercase tracking-widest text-white/40 font-semibold mr-1">Ventana:</span>
              {VENTANAS.map(v => (
                <button key={v} onClick={() => setVentana(v)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-all ${
                    ventana === v
                      ? "bg-emerald-500/25 border-emerald-500/50 text-emerald-200"
                      : "bg-[#013d32] border-[#046C5E] text-white/50 hover:text-white"
                  }`}>
                  {v}d
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[10px] uppercase tracking-widest text-white/40 font-semibold mr-1">Canal:</span>
              {PRESET_PREFIJOS.map(p => (
                <button key={p.id} onClick={() => setPrefijos(p.value)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-all ${
                    prefijos === p.value
                      ? "bg-blue-500/25 border-blue-500/50 text-blue-200"
                      : "bg-[#013d32] border-[#046C5E] text-white/50 hover:text-white"
                  }`}>
                  {p.label}
                </button>
              ))}
            </div>
            <input
              value={busqueda}
              onChange={e => setBusqueda(e.target.value)}
              placeholder="Buscar cliente, RUC, vendedor..."
              className="flex-1 min-w-[180px] bg-[#013d32] border border-[#046C5E] rounded-lg px-3 py-1.5 text-sm text-white placeholder-white/30 focus:outline-none focus:border-emerald-500/60"
            />
            <select value={filtroVendedor} onChange={e => setFiltroVendedor(e.target.value)}
              className="bg-[#013d32] border border-[#046C5E] rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-emerald-500/60">
              <option value="">Todos los vendedores</option>
              {vendedoresOpts.map(v => <option key={v} value={v}>{v}</option>)}
            </select>
          </div>

          {/* Tabla */}
          {filtrados.length === 0 ? (
            <div className="text-center py-10 text-white/40 italic text-sm">
              {cargando ? "Cargando…" : "No hay clientes en declive con esos filtros"}
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-yellow-500/20">
              <table className="min-w-full text-sm">
                <thead className="bg-yellow-900/20 text-yellow-200 uppercase text-[10px] tracking-wider">
                  <tr>
                    <th className="px-3 py-3 text-left">Cliente</th>
                    <th className="px-3 py-3 text-right">Baseline (u/sem)</th>
                    <th className="px-3 py-3 text-right">Reciente (u/sem)</th>
                    <th className="px-3 py-3 text-center">Caída</th>
                    <th className="px-3 py-3 text-right">$ Riesgo</th>
                    <th className="px-3 py-3 text-left">Última compra</th>
                    <th className="px-3 py-3 text-left">Última gestión</th>
                    <th className="px-3 py-3 text-center">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {filtrados.map((c, idx) => {
                    const caidaCfg = cfgCaida(c.caida_porc);
                    const tel = normalizarTel(c.telefono);
                    const wapp = tel ? `https://wa.me/${tel}?text=${encodeURIComponent(`Hola ${c.nombre_cliente}, te contactamos de Aqua...`)}` : "";
                    const call = tel ? `tel:+${tel}` : "";
                    const gestion = c.ultimo_contacto_resultado ? resultadoCfg(c.ultimo_contacto_resultado) : null;

                    return (
                      <tr key={c.codigo_cliente}
                          className={`border-t border-yellow-500/10 ${idx % 2 === 0 ? "bg-black/20" : "bg-black/30"} hover:bg-yellow-500/5 transition-colors`}>
                        <td className="px-3 py-2">
                          <div className="font-medium text-white text-xs leading-tight">{c.nombre_cliente}</div>
                          <div className="text-[10px] text-white/40 mt-0.5">
                            {c.ruc || "Sin RUC"} · <span className="text-blue-300">{c.vendedor || "-"}</span>
                            {c.canal_subcanal && ` · ${c.canal_subcanal}`}
                          </div>
                        </td>
                        <td className="px-3 py-2 text-right text-white/80 text-xs">{num(c.baseline_semanal_unidades)}</td>
                        <td className="px-3 py-2 text-right text-orange-300 text-xs font-semibold">{num(c.reciente_semanal_unidades)}</td>
                        <td className="px-3 py-2 text-center">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold border ${caidaCfg.color}`}>
                            ▼{c.caida_porc}%
                          </span>
                          <div className="text-[9px] text-white/40 mt-0.5">{caidaCfg.label}</div>
                        </td>
                        <td className="px-3 py-2 text-right text-yellow-300 font-bold text-xs">{money(c.volumen_riesgo)}</td>
                        <td className="px-3 py-2 text-xs text-white/70">
                          {fmtFecha(c.ultima_compra)}
                          <div className="text-[10px] text-white/40">{c.dias_sin_compra}d atrás</div>
                        </td>
                        <td className="px-3 py-2 text-[10px]">
                          {gestion ? (
                            <>
                              <span className={`inline-flex px-1.5 py-0.5 rounded border ${gestion.color}`}>{gestion.label}</span>
                              <div className="text-white/40 mt-0.5">por @{c.ultimo_contacto_por} · {fmtFecha(c.ultimo_contacto_fecha)}</div>
                            </>
                          ) : <span className="text-white/30 italic">Sin gestión</span>}
                        </td>
                        <td className="px-3 py-2">
                          <div className="flex gap-1 justify-center flex-wrap">
                            {wapp && <a href={wapp} target="_blank" rel="noopener noreferrer" title="WhatsApp"
                              className="w-7 h-7 rounded-md bg-green-600/20 border border-green-500/40 text-green-300 hover:bg-green-600/30 inline-flex items-center justify-center">
                              <MessageCircle size={12}/>
                            </a>}
                            {call && <a href={call} title="Llamar"
                              className="w-7 h-7 rounded-md bg-blue-600/20 border border-blue-500/40 text-blue-300 hover:bg-blue-600/30 inline-flex items-center justify-center">
                              <Phone size={12}/>
                            </a>}
                            <button onClick={() => abrirModal(c)} title="Gestionar"
                              className="w-7 h-7 rounded-md bg-emerald-600/20 border border-emerald-500/40 text-emerald-300 hover:bg-emerald-600/30 inline-flex items-center justify-center">
                              <History size={12}/>
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Modal de gestión */}
      {clienteModal && (
        <ModalGestion
          cliente={clienteModal}
          historial={historial}
          cargandoHist={cargandoHist}
          resultado={resultado}
          notas={notas}
          guardando={guardando}
          onClose={() => setClienteModal(null)}
          onChangeResultado={setResultado}
          onChangeNotas={setNotas}
          onGuardar={guardarContacto}
        />
      )}
    </div>
  );
}

// ─── Subcomponentes ───────────────────────────────────────────────────────
function KpiCard({ icon, label, value, color, highlight = false }: {
  icon: React.ReactNode; label: string; value: string; color: string; highlight?: boolean;
}) {
  return (
    <div className={`rounded-xl p-3 border ${highlight ? "bg-yellow-500/10 border-yellow-500/40" : "bg-black/25 border-white/10"}`}>
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-widest text-white/50 font-semibold mb-1">
        <span className="opacity-70">{icon}</span>{label}
      </div>
      <p className={`text-lg md:text-xl font-bold ${color} leading-tight break-all`}>{value}</p>
    </div>
  );
}

function ModalGestion({
  cliente, historial, cargandoHist, resultado, notas, guardando,
  onClose, onChangeResultado, onChangeNotas, onGuardar,
}: {
  cliente: ClienteDeclive;
  historial: ContactoHist[];
  cargandoHist: boolean;
  resultado: string;
  notas: string;
  guardando: boolean;
  onClose: () => void;
  onChangeResultado: (s: string) => void;
  onChangeNotas: (s: string) => void;
  onGuardar: () => void;
}) {
  const tel = normalizarTel(cliente.telefono);
  const caidaCfg = cfgCaida(cliente.caida_porc);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4" onClick={onClose}>
      <div onClick={e => e.stopPropagation()}
        className="bg-gradient-to-br from-[#013d32] to-[#012E24] border border-[#046C5E] rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-5 py-4 border-b border-[#046C5E]/40 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[10px] uppercase tracking-widest text-yellow-300 font-semibold">Gestión de declive de consumo</p>
            <h3 className="text-lg font-bold text-white leading-tight truncate">{cliente.nombre_cliente}</h3>
            <p className="text-xs text-white/50 font-mono mt-0.5">
              {cliente.ruc || "Sin RUC"} · Vendedor: {cliente.vendedor || "-"}
            </p>
          </div>
          <button onClick={onClose} className="text-white/40 hover:text-white p-1 rounded-lg hover:bg-white/10">
            <X size={20} />
          </button>
        </div>

        {/* Métricas de declive */}
        <div className="px-5 py-3 grid grid-cols-2 md:grid-cols-4 gap-2 border-b border-[#046C5E]/40 bg-black/20">
          <div>
            <p className="text-[9px] text-white/40 uppercase">Baseline (90d)</p>
            <p className="text-base font-semibold text-white/80">{num(cliente.baseline_semanal_unidades)} u/sem</p>
          </div>
          <div>
            <p className="text-[9px] text-white/40 uppercase">Reciente</p>
            <p className="text-base font-semibold text-orange-300">{num(cliente.reciente_semanal_unidades)} u/sem</p>
          </div>
          <div>
            <p className="text-[9px] text-white/40 uppercase">Caída</p>
            <p className={`text-base font-bold inline-flex items-center gap-1 px-2 py-0.5 rounded ${caidaCfg.color}`}>
              ▼{cliente.caida_porc}%
            </p>
          </div>
          <div>
            <p className="text-[9px] text-white/40 uppercase">$ en riesgo</p>
            <p className="text-base font-bold text-yellow-300">{money(cliente.volumen_riesgo)}</p>
          </div>
        </div>

        {(cliente.telefono || cliente.email) && (
          <div className="px-5 py-2 border-b border-[#046C5E]/40 flex items-center gap-3 text-xs flex-wrap">
            {cliente.telefono && (
              <a href={`tel:+${tel}`} className="text-blue-300 hover:underline flex items-center gap-1">
                <Phone size={12}/> {cliente.telefono}
              </a>
            )}
            {cliente.email && (
              <a href={`mailto:${cliente.email}`} className="text-emerald-300 hover:underline">
                ✉ {cliente.email}
              </a>
            )}
          </div>
        )}

        {/* Form de contacto */}
        <div className="px-5 py-4 border-b border-[#046C5E]/40 bg-yellow-900/10">
          <p className="text-[10px] uppercase tracking-widest text-yellow-300 font-semibold mb-2">
            Registrar nuevo contacto
          </p>
          <div className="flex flex-wrap gap-1.5 mb-2">
            {RESULTADOS.map(r => (
              <button key={r.value} onClick={() => onChangeResultado(r.value)}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-medium border transition-all ${
                  resultado === r.value ? r.color : "bg-[#013d32] border-[#046C5E] text-white/50 hover:text-white"
                }`}>
                {r.label}
              </button>
            ))}
          </div>
          <textarea
            value={notas}
            onChange={e => onChangeNotas(e.target.value)}
            rows={2}
            placeholder="Notas (opcional): qué se conversó, por qué bajó el consumo, próximos pasos…"
            className="w-full bg-[#012E24] border border-[#046C5E]/60 rounded-lg px-3 py-2 text-sm text-white placeholder-white/30 focus:outline-none focus:border-emerald-500/60 resize-none"
          />
          <div className="flex justify-end mt-2">
            <button onClick={onGuardar} disabled={guardando}
              className="px-4 py-1.5 rounded-lg bg-yellow-600 hover:bg-yellow-500 text-white font-semibold text-sm disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
              {guardando ? "Guardando…" : "Registrar contacto"}
            </button>
          </div>
        </div>

        {/* Historial */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          <p className="text-[10px] uppercase tracking-widest text-white/40 font-semibold mb-3 flex items-center gap-2">
            <History size={12}/> Historial de contactos
            {historial.length > 0 && <span className="text-emerald-300 normal-case">({historial.length})</span>}
          </p>
          {cargandoHist ? (
            <p className="text-center text-white/40 py-6 text-sm italic">Cargando historial…</p>
          ) : historial.length === 0 ? (
            <p className="text-center text-white/40 py-6 text-sm italic">Sin contactos previos registrados</p>
          ) : (
            <div className="space-y-2">
              {historial.map(h => {
                const cfg = resultadoCfg(h.resultado);
                return (
                  <div key={h.id} className="bg-black/25 border border-white/5 rounded-lg p-3">
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold border ${cfg.color}`}>
                          {cfg.label}
                        </span>
                        <span className="text-[10px] text-white/40">por <span className="font-mono text-white/70">@{h.contactado_por}</span></span>
                      </div>
                      <span className="text-[10px] text-white/50 shrink-0">{fmtFechaHora(h.fecha_contacto)}</span>
                    </div>
                    {h.notas && <p className="text-xs text-white/70 mt-1 whitespace-pre-wrap">{h.notas}</p>}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
