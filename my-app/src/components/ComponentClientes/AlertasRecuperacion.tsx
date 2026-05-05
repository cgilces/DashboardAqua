import React, { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle, Phone, MessageCircle, X, Clock, TrendingDown,
  CheckCircle2, History, ChevronDown, ChevronUp, Users, DollarSign,
} from "lucide-react";
import { API_BASE_URL } from "../../config";
import { useAuth } from "../auth/AuthContext";

// ─── Tipos ───────────────────────────────────────────────────────────────
type ClienteAlerta = {
  group_key: string;
  ruc: string;
  nombre_cliente: string;
  telefono: string;
  email: string;
  vendedor: string;
  tipo_negocio: string;
  ciudad: string;
  tiene_credito: boolean;
  ultima_compra: string;
  dias_sin_compra: number;
  ventas_6m: number;
  facturas_6m: number;
  promedio_mensual: number;
  valor_en_riesgo: number;
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
  totalEnRiesgo: number;
  totalPromMes: number;
  conTelefono: number;
  contactos7d: number;
  recuperados7d: number;
  clientesContactados7d: number;
};

const RESULTADOS = [
  { value: "CONTACTADO",        label: "Contactado",        color: "text-blue-300 bg-blue-500/15 border-blue-500/30" },
  { value: "NO_CONTESTA",       label: "No contestó",       color: "text-gray-300 bg-gray-500/15 border-gray-500/30" },
  { value: "PROMETIO_COMPRAR",  label: "Prometió comprar",  color: "text-yellow-300 bg-yellow-500/15 border-yellow-500/30" },
  { value: "NO_INTERESADO",     label: "No interesado",     color: "text-red-300 bg-red-500/15 border-red-500/30" },
  { value: "RECUPERADO",        label: "Recuperado",        color: "text-emerald-300 bg-emerald-500/15 border-emerald-500/30" },
];
const UMBRALES = [15, 30, 45, 60, 90];

const money = (n = 0) => Number(n).toLocaleString("es-EC", { style: "currency", currency: "USD" });
const fmtFecha = (s: string | null) => s ? new Date(s).toLocaleDateString("es-EC") : "-";
const fmtFechaHora = (s: string) => new Date(s).toLocaleString("es-EC", {
  day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
});
const resultadoCfg = (r: string | null | undefined) =>
  RESULTADOS.find(x => x.value === r) ?? { label: r ?? "-", color: "text-gray-400 bg-gray-500/15 border-gray-500/30", value: "" };

// Limpia el teléfono para WhatsApp/tel:
function normalizarTel(t: string) {
  if (!t) return "";
  const limpio = t.replace(/\D/g, "");
  if (!limpio) return "";
  // Si ya tiene código de país (>10 dígitos) lo dejo
  if (limpio.length > 10) return limpio;
  // Ecuador: 09xxxxxxxx → 5939xxxxxxxx
  if (limpio.startsWith("0") && limpio.length === 10) return "593" + limpio.slice(1);
  return limpio;
}

// ─── Componente principal ────────────────────────────────────────────────
export default function AlertasRecuperacion() {
  const { user } = useAuth();
  const username = user?.username ?? "anonimo";

  const [umbral, setUmbral] = useState<number>(15);
  const [expandido, setExpandido] = useState(true);
  const [verTodos, setVerTodos] = useState(false);
  const [data, setData] = useState<ClienteAlerta[]>([]);
  const [kpis, setKpis] = useState<KPIs | null>(null);
  const [cargando, setCargando] = useState(false);
  const [filtroVendedor, setFiltroVendedor] = useState("");
  const [busqueda, setBusqueda] = useState("");

  // Modal
  const [clienteModal, setClienteModal] = useState<ClienteAlerta | null>(null);
  const [historial, setHistorial] = useState<ContactoHist[]>([]);
  const [cargandoHist, setCargandoHist] = useState(false);

  // Form de contacto (dentro del modal)
  const [resultado, setResultado] = useState("CONTACTADO");
  const [notas, setNotas] = useState("");
  const [guardando, setGuardando] = useState(false);

  // ── Fetch alertas ──────────────────────────────────────────────────────
  const cargarAlertas = async () => {
    setCargando(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/dashboard-clientes/alertas-recuperacion?umbral=${umbral}`);
      const json = await res.json();
      if (json.ok) {
        setData(json.data || []);
        setKpis(json.kpis || null);
      }
    } catch (err) {
      console.error("Error alertas-recuperacion:", err);
    } finally {
      setCargando(false);
    }
  };
  useEffect(() => { cargarAlertas(); }, [umbral]);

  // ── Fetch historial al abrir modal ─────────────────────────────────────
  const abrirHistorial = async (c: ClienteAlerta) => {
    setClienteModal(c);
    setHistorial([]);
    setResultado("CONTACTADO");
    setNotas("");
    setCargandoHist(true);
    try {
      const res = await fetch(
        `${API_BASE_URL}/api/dashboard-clientes/contactos-recuperacion/historial/${encodeURIComponent(c.group_key)}`
      );
      const json = await res.json();
      if (json.ok) setHistorial(json.contactos || []);
    } catch (err) {
      console.error("Error historial:", err);
    } finally {
      setCargandoHist(false);
    }
  };

  // ── Guardar contacto ───────────────────────────────────────────────────
  const guardarContacto = async () => {
    if (!clienteModal) return;
    setGuardando(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/dashboard-clientes/contactos-recuperacion`, {
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
      const json = await res.json();
      if (json.ok) {
        setNotas("");
        setResultado("CONTACTADO");
        // Refresca historial y la lista principal
        await Promise.all([
          (async () => {
            const r = await fetch(
              `${API_BASE_URL}/api/dashboard-clientes/contactos-recuperacion/historial/${encodeURIComponent(clienteModal.group_key)}`
            );
            const j = await r.json();
            if (j.ok) setHistorial(j.contactos || []);
          })(),
          cargarAlertas(),
        ]);
      } else {
        alert("No se pudo registrar el contacto");
      }
    } catch (err) {
      console.error(err);
      alert("Error registrando contacto");
    } finally {
      setGuardando(false);
    }
  };

  // ── Filtros derivados ──────────────────────────────────────────────────
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
        r.vendedor.toLowerCase().includes(q)
      );
    }
    return d;
  }, [data, filtroVendedor, busqueda]);

  const visibles = verTodos ? filtrados : filtrados.slice(0, 12);

  // ── Render ─────────────────────────────────────────────────────────────
  return (
    <div className="mb-6 bg-gradient-to-br from-[#3a1a1a] via-[#2a1715] to-[#012E24] border border-red-500/30 rounded-2xl shadow-2xl overflow-hidden">
      {/* Header banner */}
      <div className="px-4 md:px-6 py-4 flex flex-wrap items-center justify-between gap-3 border-b border-red-500/20 bg-gradient-to-r from-red-900/30 to-transparent">
        <div className="flex items-center gap-3 min-w-0">
          <div className="bg-red-500/20 border border-red-500/40 rounded-xl p-2 shrink-0">
            <AlertTriangle className="text-red-400" size={22} />
          </div>
          <div className="min-w-0">
            <h2 className="text-base md:text-lg font-bold text-white flex items-center gap-2 flex-wrap">
              Clientes a Recuperar
              {cargando && (
                <span className="text-xs text-emerald-400 inline-flex items-center gap-1">
                  <span className="w-3 h-3 border-2 border-emerald-400/20 border-t-emerald-400 rounded-full animate-spin"/>
                  cargando…
                </span>
              )}
            </h2>
            <p className="text-[11px] md:text-xs text-white/60">
              Clientes regulares con <span className="text-red-300 font-semibold">≥{umbral} días</span> sin comprar — ordenados por valor en riesgo
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
          {/* KPIs */}
          {kpis && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <KpiCard icon={<Users size={16} />} label="Clientes" value={kpis.totalClientes.toLocaleString("es-EC")} color="text-white" />
              <KpiCard icon={<DollarSign size={16} />} label="Valor en riesgo" value={money(kpis.totalEnRiesgo)} color="text-red-300" highlight />
              <KpiCard icon={<TrendingDown size={16} />} label="Promedio mensual" value={money(kpis.totalPromMes)} color="text-yellow-300" />
              <KpiCard icon={<CheckCircle2 size={16} />} label="Gestionados (7d)" value={`${kpis.clientesContactados7d} · ${kpis.recuperados7d} recup.`} color="text-emerald-300" />
            </div>
          )}

          {/* Pills umbral + filtros */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] uppercase tracking-widest text-white/40 font-semibold mr-1">Umbral:</span>
              {UMBRALES.map(u => (
                <button
                  key={u}
                  onClick={() => setUmbral(u)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-all ${
                    umbral === u
                      ? "bg-red-500/30 border-red-500 text-red-200"
                      : "bg-[#013d32] border-[#046C5E] text-white/50 hover:text-white hover:border-red-500/40"
                  }`}
                >
                  {u}d
                </button>
              ))}
            </div>
            <div className="h-6 w-px bg-white/10 hidden md:block" />
            <input
              value={busqueda}
              onChange={e => setBusqueda(e.target.value)}
              placeholder="Buscar cliente, RUC o vendedor..."
              className="flex-1 min-w-[180px] bg-[#013d32] border border-[#046C5E] rounded-lg px-3 py-1.5 text-sm text-white placeholder-white/30 focus:outline-none focus:border-emerald-500/60"
            />
            <select
              value={filtroVendedor}
              onChange={e => setFiltroVendedor(e.target.value)}
              className="bg-[#013d32] border border-[#046C5E] rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-emerald-500/60"
            >
              <option value="">Todos los vendedores</option>
              {vendedoresOpts.map(v => <option key={v} value={v}>{v}</option>)}
            </select>
          </div>

          {/* Lista de candidatos */}
          {filtrados.length === 0 ? (
            <div className="text-center py-10 text-white/40 italic text-sm">
              {cargando ? "Cargando…" : `No hay clientes con ≥${umbral} días sin comprar`}
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                {visibles.map(c => (
                  <CardCliente key={c.group_key} cliente={c} onAbrir={() => abrirHistorial(c)} />
                ))}
              </div>
              {filtrados.length > 12 && (
                <div className="flex justify-center">
                  <button
                    onClick={() => setVerTodos(v => !v)}
                    className="px-4 py-2 rounded-lg bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-sm font-medium hover:bg-emerald-500/30 transition-colors flex items-center gap-2"
                  >
                    {verTodos
                      ? <>Ver menos <ChevronUp size={14} /></>
                      : <>Ver todos ({filtrados.length}) <ChevronDown size={14} /></>}
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Modal historial + registro */}
      {clienteModal && (
        <ModalCliente
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
    <div className={`rounded-xl p-3 border ${highlight ? "bg-red-500/10 border-red-500/40" : "bg-black/25 border-white/10"}`}>
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-widest text-white/50 font-semibold mb-1">
        <span className="opacity-70">{icon}</span>{label}
      </div>
      <p className={`text-lg md:text-xl font-bold ${color} leading-tight break-all`}>{value}</p>
    </div>
  );
}

function CardCliente({ cliente, onAbrir }: { cliente: ClienteAlerta; onAbrir: () => void }) {
  const tel  = normalizarTel(cliente.telefono);
  const wapp = tel ? `https://wa.me/${tel}?text=${encodeURIComponent(`Hola ${cliente.nombre_cliente}, te contactamos de Aqua...`)}` : "";
  const call = tel ? `tel:+${tel}` : "";
  const ultCfg = resultadoCfg(cliente.ultimo_contacto_resultado);
  const sevColor =
    cliente.dias_sin_compra >= 60 ? "border-red-500/60 from-red-900/30"
    : cliente.dias_sin_compra >= 30 ? "border-orange-500/50 from-orange-900/20"
    : "border-yellow-500/40 from-yellow-900/15";

  return (
    <div className={`bg-gradient-to-br ${sevColor} to-[#012E24] border rounded-xl p-3 hover:shadow-xl transition-all flex flex-col gap-2.5`}>
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-white leading-tight truncate" title={cliente.nombre_cliente}>
            {cliente.nombre_cliente}
          </p>
          <p className="text-[10px] text-white/40 font-mono truncate">
            {cliente.ruc || "Sin RUC"} {cliente.ciudad && `· ${cliente.ciudad}`}
          </p>
        </div>
        <span className={`shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold border whitespace-nowrap
          ${cliente.dias_sin_compra >= 60 ? "text-red-300 bg-red-500/15 border-red-500/40"
            : cliente.dias_sin_compra >= 30 ? "text-orange-300 bg-orange-500/15 border-orange-500/40"
            : "text-yellow-300 bg-yellow-500/15 border-yellow-500/40"}`}>
          <Clock size={10} />{cliente.dias_sin_compra}d
        </span>
      </div>

      {/* Métricas */}
      <div className="grid grid-cols-3 gap-1.5 text-center">
        <div className="bg-black/30 rounded-lg p-1.5">
          <p className="text-[9px] text-white/40 uppercase">Última</p>
          <p className="text-[11px] font-semibold text-white/80">{fmtFecha(cliente.ultima_compra)}</p>
        </div>
        <div className="bg-black/30 rounded-lg p-1.5">
          <p className="text-[9px] text-white/40 uppercase">Prom/mes</p>
          <p className="text-[11px] font-semibold text-yellow-300">{money(cliente.promedio_mensual)}</p>
        </div>
        <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-1.5">
          <p className="text-[9px] text-red-300/70 uppercase">En riesgo</p>
          <p className="text-[11px] font-bold text-red-300">{money(cliente.valor_en_riesgo)}</p>
        </div>
      </div>

      {/* Vendedor + tipo */}
      <div className="flex items-center gap-1.5 text-[10px] text-white/50 flex-wrap">
        <span className="bg-blue-500/15 text-blue-300 px-1.5 py-0.5 rounded border border-blue-500/30">
          {cliente.vendedor}
        </span>
        <span className="bg-white/5 text-white/60 px-1.5 py-0.5 rounded border border-white/10 truncate max-w-[120px]">
          {cliente.tipo_negocio}
        </span>
        {cliente.tiene_credito && (
          <span className="bg-yellow-500/15 text-yellow-300 px-1.5 py-0.5 rounded border border-yellow-500/30">
            Crédito
          </span>
        )}
      </div>

      {/* Último contacto */}
      {cliente.ultimo_contacto_fecha && (
        <div className={`rounded-md px-2 py-1.5 border text-[10px] ${ultCfg.color}`}>
          <span className="font-semibold">{ultCfg.label}</span> · {fmtFecha(cliente.ultimo_contacto_fecha)} por <span className="font-mono">@{cliente.ultimo_contacto_por}</span>
        </div>
      )}

      {/* Acciones */}
      <div className="flex items-center gap-1.5 pt-1">
        {wapp ? (
          <a href={wapp} target="_blank" rel="noopener noreferrer"
             className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 rounded-lg bg-green-600/20 border border-green-500/40 text-green-300 text-[11px] font-semibold hover:bg-green-600/30 transition-colors"
             title={`WhatsApp ${cliente.telefono}`}>
            <MessageCircle size={12} /> WhatsApp
          </a>
        ) : (
          <span className="flex-1 px-2 py-1.5 rounded-lg bg-white/5 border border-white/10 text-white/30 text-[11px] text-center italic">
            sin tel
          </span>
        )}
        {call && (
          <a href={call}
             className="px-2 py-1.5 rounded-lg bg-blue-600/20 border border-blue-500/40 text-blue-300 text-[11px] font-semibold hover:bg-blue-600/30 transition-colors flex items-center justify-center"
             title={`Llamar ${cliente.telefono}`}>
            <Phone size={12} />
          </a>
        )}
        <button onClick={onAbrir}
          className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 rounded-lg bg-emerald-600/20 border border-emerald-500/40 text-emerald-300 text-[11px] font-semibold hover:bg-emerald-600/30 transition-colors">
          <History size={12} /> Gestionar
        </button>
      </div>
    </div>
  );
}

function ModalCliente({
  cliente, historial, cargandoHist, resultado, notas, guardando,
  onClose, onChangeResultado, onChangeNotas, onGuardar,
}: {
  cliente: ClienteAlerta;
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
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4" onClick={onClose}>
      <div onClick={e => e.stopPropagation()}
        className="bg-gradient-to-br from-[#013d32] to-[#012E24] border border-[#046C5E] rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-5 py-4 border-b border-[#046C5E]/40 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[10px] uppercase tracking-widest text-emerald-300 font-semibold">Gestión de recuperación</p>
            <h3 className="text-lg font-bold text-white leading-tight truncate">{cliente.nombre_cliente}</h3>
            <p className="text-xs text-white/50 font-mono mt-0.5">
              {cliente.ruc || "Sin RUC"} · Vendedor: {cliente.vendedor}
            </p>
          </div>
          <button onClick={onClose} className="text-white/40 hover:text-white p-1 rounded-lg hover:bg-white/10">
            <X size={20} />
          </button>
        </div>

        {/* Métricas + contacto */}
        <div className="px-5 py-3 grid grid-cols-2 md:grid-cols-4 gap-2 border-b border-[#046C5E]/40 bg-black/20">
          <div>
            <p className="text-[9px] text-white/40 uppercase">Días sin compra</p>
            <p className="text-base font-bold text-red-300">{cliente.dias_sin_compra}</p>
          </div>
          <div>
            <p className="text-[9px] text-white/40 uppercase">Última compra</p>
            <p className="text-base font-semibold text-white/80">{fmtFecha(cliente.ultima_compra)}</p>
          </div>
          <div>
            <p className="text-[9px] text-white/40 uppercase">Promedio/mes</p>
            <p className="text-base font-bold text-yellow-300">{money(cliente.promedio_mensual)}</p>
          </div>
          <div>
            <p className="text-[9px] text-white/40 uppercase">En riesgo</p>
            <p className="text-base font-bold text-red-300">{money(cliente.valor_en_riesgo)}</p>
          </div>
        </div>

        {(cliente.telefono || cliente.email) && (
          <div className="px-5 py-2 border-b border-[#046C5E]/40 flex items-center gap-3 text-xs flex-wrap">
            {cliente.telefono && (
              <a href={`tel:+${tel}`} className="text-blue-300 hover:underline flex items-center gap-1">
                <Phone size={12} /> {cliente.telefono}
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
        <div className="px-5 py-4 border-b border-[#046C5E]/40 bg-emerald-900/10">
          <p className="text-[10px] uppercase tracking-widest text-emerald-300 font-semibold mb-2">
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
            placeholder="Notas (opcional): qué se conversó, próximos pasos…"
            className="w-full bg-[#012E24] border border-[#046C5E]/60 rounded-lg px-3 py-2 text-sm text-white placeholder-white/30 focus:outline-none focus:border-emerald-500/60 resize-none"
          />
          <div className="flex justify-end mt-2">
            <button onClick={onGuardar} disabled={guardando}
              className="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-sm disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
              {guardando ? "Guardando…" : "Registrar contacto"}
            </button>
          </div>
        </div>

        {/* Historial */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          <p className="text-[10px] uppercase tracking-widest text-white/40 font-semibold mb-3 flex items-center gap-2">
            <History size={12} /> Historial de contactos
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
                        {h.dias_sin_compra_al_contactar != null && (
                          <span className="text-[10px] text-white/40">· {h.dias_sin_compra_al_contactar}d sin compra</span>
                        )}
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
