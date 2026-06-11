import React, { useState, useEffect, useCallback } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell,
  AreaChart, Area,
} from "recharts";
import { BarChart2, TrendingUp, TrendingDown, DollarSign, Package, Users, FileText, Calendar } from "lucide-react";

// MUI Icons (pestañas + secciones de Gerencia)
import AssessmentIcon         from "@mui/icons-material/Assessment";
import TrendingUpIcon         from "@mui/icons-material/TrendingUp";
import EmojiEventsIcon        from "@mui/icons-material/EmojiEvents";
import CreditCardIcon         from "@mui/icons-material/CreditCard";
import PersonOffIcon          from "@mui/icons-material/PersonOff";
import AttachMoneyIcon        from "@mui/icons-material/AttachMoney";
import Inventory2Icon         from "@mui/icons-material/Inventory2";
import PeopleIcon             from "@mui/icons-material/People";
import WarningAmberIcon       from "@mui/icons-material/WarningAmber";
import ErrorOutlineIcon       from "@mui/icons-material/ErrorOutline";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
import NotificationsActiveIcon from "@mui/icons-material/NotificationsActive";
import AccountBalanceIcon     from "@mui/icons-material/AccountBalance";
import PaymentsIcon           from "@mui/icons-material/Payments";
import DonutLargeIcon         from "@mui/icons-material/DonutLarge";
import WorkspacePremiumIcon   from "@mui/icons-material/WorkspacePremium";

import DashboardLayout from "../../layout/DashboardLayout";
import { Header } from "../../components/common/Header";
import BotonActualizarSincronizacion from "../../components/elements/BotonActualizarSincronizacion";
import { API_BASE_URL } from "../../config";

// ── Types: Consolidado ─────────────────────────────────────────
interface Empresa {
  empresa: string;
  color: string;
  actual: number;
  anterior: number;
  variacionAbs: number;
  variacionPorc: number;
  tendencia: { label: string; total: number }[];
}

interface Canal {
  canal: string;
  dolares: number;
  proyeccion: number;
  unidades: number;
  mesAnterior: number;
  variacionAbs: number;
  variacionPorc: number;
  docs: number;
  clientes: number;
}
interface Kpis {
  totalVentas: number;
  totalProyeccion: number;
  totalUnidades: number;
  totalMesAnterior: number;
  variacionAbs: number;
  variacionPorc: number;
  ticketPromedio: number;
  totalDocumentos: number;
  totalClientes: number;
}
interface DatosConsolidado {
  periodo: { anio: number; mes: number; esMesActual: boolean; label: string };
  kpis: Kpis;
  canales: Canal[];
  tendencia: { label: string; total: number }[];
  topProductos: { nombre: string; unidades: number; dolares: number }[];
  topClientes:  { codigo: string; nombre: string; dolares: number }[];
  porEmpresa:   Empresa[];
}

// ── Types: Gerencia (cobranza / vendedores / riesgo / márgenes) ──
interface CobranzaRow { codigo_cliente:string; nombre_cliente:string; telefono_cliente:string; facturas_pendientes:number; saldo_total:number; fecha_mas_antigua:string; dias_vencido:number; estado:"CRITICO"|"ALERTA"|"OK" }
interface CobranzaData { resumen:{total_cartera:number;clientes_criticos:number;clientes_alerta:number;clientes_ok:number}; detalle:CobranzaRow[] }
interface Vendedor { nombre_vendedor:string; codigo_vendedor:string; clientes_visitados:number; pedidos:number; ventas_total:number; margen_total:number; clientes_con_pedido:number; tasa_cierre_pct:number; margen_pct:number }
interface ClienteRiesgo { codigo_cliente:string; nombre_cliente:string; telefono_cliente:string; vendedor:string; ultima_fecha:string; dias_sin_comprar:number; total_facturas:number; ventas_acumuladas:number; ticket_promedio:number; estado:"PERDIDO"|"RIESGO"|"ALERTA" }
interface MargenCanal { canal:string; ventas_total:number; margen_total:number; num_pedidos:number; margen_pct:number }
interface MargenCategoria { categoria:string; ventas_total:number; margen_total:number; unidades:number; margen_pct:number }
interface MargenData { porCanal:MargenCanal[]; porCategoria:MargenCategoria[]; resumen:{ totalVentas:number; totalMargen:number; margenGlobal:number } }
interface RiesgoData { resumen:{ perdidos:number; en_riesgo:number; en_alerta:number; cartera_en_riesgo:number }; clientes:ClienteRiesgo[] }

// ── Constants ──────────────────────────────────────────────────
const MESES: Record<string, number> = {
  Enero:1, Febrero:2, Marzo:3, Abril:4, Mayo:5, Junio:6,
  Julio:7, Agosto:8, Septiembre:9, Octubre:10, Noviembre:11, Diciembre:12,
};
const MESES_LABEL = ["","Enero","Febrero","Marzo","Abril","Mayo","Junio",
  "Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];
const CANAL_COLORS: Record<string, string> = {
  PREVENTA:    "#60a5fa",
  BOTELLONES:  "#34d399",
  HIELO:       "#a78bfa",
  COTTSA:       "#fbbf24",
  "DESC. ODOO":"#f87171",
};
const CANAL_LABELS: Record<string, string> = {
  PREVENTA:    "Preventa",
  BOTELLONES:  "Botellones",
  HIELO:       "Hielo",
  COTTSA:       "COTTSA",
  "DESC. ODOO":"Descartable",
};
const COLORS = ["#34d399","#60a5fa","#fbbf24","#a78bfa","#f87171","#38bdf8","#fb7185","#a3e635","#fb923c","#e879f9"];
const ESTADO_CL: Record<string,string> = {
  CRITICO:"bg-red-500/20 text-red-300 border-red-500/40",
  ALERTA: "bg-amber-500/20 text-amber-300 border-amber-500/40",
  OK:     "bg-emerald-500/20 text-emerald-300 border-emerald-500/40",
  PERDIDO:"bg-red-500/20 text-red-300 border-red-500/40",
  RIESGO: "bg-amber-500/20 text-amber-300 border-amber-500/40",
};

// ── Helpers ─────────────────────────────────────────────────────
const fmt  = (n: number) => n.toLocaleString("es-EC", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtI = (n: number) => n.toLocaleString("es-EC");
const fmtK = (n: number) => {
  if (n >= 1_000_000) return `$${(n/1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `$${(n/1_000).toFixed(1)}k`;
  return `$${fmt(n)}`;
};

// ── Custom Tooltips ─────────────────────────────────────────────
const TooltipBars = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-[#012E24] border border-[#046C5E] rounded-xl p-3 text-xs text-white shadow-xl min-w-[160px]">
      <p className="font-bold text-green-300 mb-2">{label}</p>
      {payload.map((p: any) => (
        <div key={p.name} className="flex justify-between gap-6" style={{ color: p.color }}>
          <span>{p.name}</span>
          <span className="font-bold">${fmt(p.value)}</span>
        </div>
      ))}
    </div>
  );
};
const TooltipArea = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-[#012E24] border border-[#046C5E] rounded-xl p-3 text-xs text-white shadow-xl">
      <p className="font-bold text-green-300 mb-1">{label}</p>
      <p className="text-emerald-400 font-bold text-sm">${fmt(payload[0]?.value || 0)}</p>
    </div>
  );
};
const TooltipHBar = ({ active, payload }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-[#012E24] border border-[#046C5E] rounded-xl p-3 text-xs text-white shadow-xl">
      <p style={{ color: payload[0]?.fill }} className="font-bold">${fmt(payload[0]?.value || 0)}</p>
    </div>
  );
};
const TipDol = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-[#012E24] border border-[#046C5E]/40 rounded-lg px-3 py-2 text-xs text-white shadow-xl">
      <p className="font-bold mb-1">{label}</p>
      {payload.map((p: any) => <p key={p.name} style={{color:p.color||p.fill}}>{p.name}: ${fmt(Number(p.value))}</p>)}
    </div>
  );
};

// ── KPI Card (vista General) ────────────────────────────────────
const KpiCard = ({
  icon: Icon, label, value, sub, subColor = "text-gray-400", color = "text-white", accent = false
}: any) => (
  <div className={`relative overflow-hidden rounded-2xl p-5 flex flex-col gap-1.5 shadow-lg border transition-all duration-200 hover:scale-[1.02] ${
    accent
      ? "bg-gradient-to-br from-[#014d3b] to-[#013d30] border-emerald-500/40"
      : "bg-gradient-to-br from-[#012E24] to-[#013d30] border-[#046C5E]/40"
  }`}>
    <div className="flex items-center justify-between">
      <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400">{label}</span>
      <Icon size={15} className="text-gray-500" />
    </div>
    <p className={`text-2xl font-extrabold leading-tight tracking-tight ${color}`}>{value}</p>
    {sub && <p className={`text-[11px] font-medium ${subColor}`}>{sub}</p>}
    {accent && <div className="absolute top-0 right-0 w-1 h-full bg-emerald-500/60 rounded-r-2xl" />}
  </div>
);

// ── KPI Card (secciones Gerencia: con icono MUI + badge) ─────────
function KpiCardG({ label, value, sub, color="text-white", icon, badge, badgeColor="text-emerald-300" }: {
  label:string; value:string; sub?:string; color?:string;
  icon?: React.ReactNode; badge?:string; badgeColor?:string;
}) {
  return (
    <div className="bg-gradient-to-br from-[#012E24] to-[#013d30] border border-[#046C5E]/40 rounded-xl p-4 flex flex-col gap-1">
      <div className="flex items-center justify-between">
        <p className="text-[10px] uppercase tracking-widest text-gray-400">{label}</p>
        {icon && <span className="text-gray-400">{icon}</span>}
      </div>
      <p className={`text-2xl font-extrabold leading-tight ${color}`}>{value}</p>
      {badge && <span className={`self-start text-[10px] font-bold px-2 py-0.5 rounded-full bg-white/5 border border-white/10 ${badgeColor}`}>{badge}</span>}
      {sub && <p className="text-[11px] text-gray-500 leading-tight">{sub}</p>}
    </div>
  );
}

// ── Progress Bar ────────────────────────────────────────────────
const MiniProgress = ({ value, color }: { value: number; color: string }) => (
  <div className="w-full bg-[#011f1a] rounded-full h-1.5 mt-1">
    <div className="h-1.5 rounded-full transition-all" style={{ width: `${Math.min(value, 100)}%`, background: color }} />
  </div>
);

// ── Medallas (ranking vendedores) ──────────────────────────────
function Medalla({ pos }: { pos: number }) {
  if (pos === 0) return <WorkspacePremiumIcon sx={{ fontSize:18, color:"#fbbf24" }} />;
  if (pos === 1) return <WorkspacePremiumIcon sx={{ fontSize:18, color:"#9ca3af" }} />;
  if (pos === 2) return <WorkspacePremiumIcon sx={{ fontSize:18, color:"#b45309" }} />;
  return <span className="text-gray-400 text-xs">{pos + 1}</span>;
}

// ── Tabs ────────────────────────────────────────────────────────
const TABS = [
  { id:"general",    label:"General",     icon: <AssessmentIcon  sx={{fontSize:16}}/> },
  { id:"margenes",   label:"Márgenes",    icon: <TrendingUpIcon  sx={{fontSize:16}}/> },
  { id:"vendedores", label:"Vendedores",  icon: <EmojiEventsIcon sx={{fontSize:16}}/> },
  { id:"cobranza",   label:"Cobranza",    icon: <CreditCardIcon  sx={{fontSize:16}}/> },
  { id:"riesgo",     label:"Riesgo Fuga", icon: <PersonOffIcon   sx={{fontSize:16}}/> },
];

// ── MAIN COMPONENT ───────────────────────────────────────────────
export default function Dashboardconsolidado() {
  const hoy = new Date();
  const [mesSeleccionado,  setMesSeleccionado]  = useState(hoy.getMonth() + 1);
  const [anioSeleccionado, setAnioSeleccionado] = useState(hoy.getFullYear());
  const [tab, setTab] = useState("general");

  const [datos,     setDatos]     = useState<DatosConsolidado | null>(null);
  const [cobranza,  setCobranza]  = useState<CobranzaData | null>(null);
  const [vendedores,setVendedores]= useState<Vendedor[]>([]);
  const [riesgo,    setRiesgo]    = useState<RiesgoData | null>(null);
  const [margen,    setMargen]    = useState<MargenData | null>(null);
  const [cargando,  setCargando]  = useState(false);
  const [error,     setError]     = useState<string | null>(null);

  const fetchAll = useCallback(() => {
    setCargando(true);
    setError(null);
    const qs = `anio=${anioSeleccionado}&mes=${mesSeleccionado}`;
    const j = (u: string) => fetch(`${API_BASE_URL}${u}`).then(r => { if (!r.ok) throw new Error("Error de red"); return r.json(); });
    Promise.all([
      j(`/api/consolidado/dashboard?${qs}`).catch(() => { setError("Error al obtener datos consolidados"); return null; }),
      j(`/api/gerencia/cobranza?${qs}`).catch(() => null),
      j(`/api/gerencia/vendedores?${qs}`).catch(() => null),
      j(`/api/gerencia/clientes-riesgo`).catch(() => null),
      j(`/api/gerencia/margen?${qs}`).catch(() => null),
    ]).then(([d, c, v, r, mg]) => {
      setDatos(d);
      setCobranza(c);
      setVendedores(v?.vendedores || []);
      setRiesgo(r);
      setMargen(mg);
    }).finally(() => setCargando(false));
  }, [mesSeleccionado, anioSeleccionado]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const { kpis, canales = [], tendencia = [], topProductos = [], topClientes = [], periodo, porEmpresa = [] } = datos || {};

  // Pie data
  const pieData = canales.filter(c => c.dolares > 0).map(c => ({
    name: c.canal, value: c.dolares,
  }));
  const totalPie = pieData.reduce((s, d) => s + d.value, 0);

  // Bar comparison data
  const barData = canales.map(c => ({
    canal:    CANAL_LABELS[c.canal] || c.canal,
    "Actual":   Number(c.dolares.toFixed(2)),
    "Anterior": Number(c.mesAnterior.toFixed(2)),
  }));

  // Top productos / clientes (reversed for horizontal bar, so highest is at top)
  const topProdData    = [...topProductos].reverse().map(p => ({
    nombre:  p.nombre.length > 28 ? p.nombre.substring(0, 28) + "…" : p.nombre,
    dolares: p.dolares,
  }));
  const topClData = [...topClientes].reverse().map(c => ({
    nombre:  c.nombre.length > 25 ? c.nombre.substring(0, 25) + "…" : c.nombre,
    dolares: c.dolares,
  }));

  return (
    <DashboardLayout>
      <div className="main-content min-h-screen text-white px-4 md:px-8 py-4 md:py-6">
        <Header />

        {/* ── HEADER ────────────────────────────────────────── */}
        <header className="flex flex-col gap-4 md:flex-row md:justify-between md:items-center mb-6 border-b border-[#046C5E]/50 pb-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 flex items-center justify-center">
              <BarChart2 className="text-emerald-400 w-5 h-5" />
            </div>
            <div>
              <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Consolidado General</h1>
              <p className="text-xs text-gray-400 tracking-wide">Grupo AQUA S.A. — {periodo?.label || `${MESES_LABEL[mesSeleccionado]} ${anioSeleccionado}`}</p>
            </div>
          </div>
          <div className="flex justify-center w-full md:w-auto">
            <BotonActualizarSincronizacion />
          </div>
          <div className="flex gap-2 flex-wrap items-center">
            <div className="relative">
              <Calendar size={15} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-white/60 pointer-events-none" />
              <select
                className="bg-[#046C5E] text-white pl-8 pr-3 py-2 rounded-lg text-sm font-medium appearance-none"
                value={mesSeleccionado}
                onChange={e => setMesSeleccionado(Number(e.target.value))}
              >
                {Object.entries(MESES).map(([n, v]) => <option key={v} value={v}>{n}</option>)}
              </select>
            </div>
            <div className="relative">
              <Calendar size={15} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-white/60 pointer-events-none" />
              <select
                className="bg-[#046C5E] text-white pl-8 pr-3 py-2 rounded-lg text-sm font-medium appearance-none"
                value={anioSeleccionado}
                onChange={e => setAnioSeleccionado(Number(e.target.value))}
              >
                {Array.from({ length: 5 }, (_, i) => hoy.getFullYear() - i).map(y =>
                  <option key={y} value={y}>{y}</option>
                )}
              </select>
            </div>
          </div>
        </header>

        {/* ── TABS ──────────────────────────────────────────── */}
        <div className="flex flex-wrap gap-1.5 mb-6 overflow-x-auto scroll-x-thin">
          {TABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg transition
                ${tab === t.id
                  ? "bg-emerald-600 text-white shadow"
                  : "bg-[#012E24] border border-[#046C5E]/30 text-gray-400 hover:text-white hover:border-emerald-500/40"}`}>
              {t.icon}{t.label}
            </button>
          ))}
        </div>

        {/* ── LOADING ─────────────────────────────────────────── */}
        {cargando && (
          <div className="flex flex-col justify-center items-center py-32 gap-4">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-emerald-400" />
            <p className="text-gray-400 text-sm">Cargando datos…</p>
          </div>
        )}

        {/* ── ERROR ───────────────────────────────────────────── */}
        {error && !cargando && (
          <div className="bg-red-900/20 border border-red-500 rounded-xl p-4 text-red-400 mb-6">
            Error: {error}
          </div>
        )}

        {/* ══════════════════════════════════════════════════════
            PESTAÑA: GENERAL (Consolidado)
        ══════════════════════════════════════════════════════ */}
        {tab === "general" && datos && !cargando && kpis && (
          <>
            {/* KPI CARDS */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
              <KpiCard
                icon={DollarSign}
                label={periodo?.esMesActual ? "Proyección mes" : "Ventas mes"}
                value={`$${fmt(periodo?.esMesActual ? kpis.totalProyeccion : kpis.totalVentas)}`}
                sub={periodo?.esMesActual ? `Real acumulado: $${fmt(kpis.totalVentas)}` : `Mes cerrado`}
                color="text-emerald-400"
                accent
              />
              <KpiCard
                icon={kpis.variacionAbs >= 0 ? TrendingUp : TrendingDown}
                label="Crecimiento vs ant."
                value={`${kpis.variacionAbs >= 0 ? "+" : ""}${kpis.variacionPorc.toFixed(1)}%`}
                sub={`${kpis.variacionAbs >= 0 ? "+" : ""}$${fmt(Math.abs(kpis.variacionAbs))}`}
                color={kpis.variacionAbs >= 0 ? "text-green-400" : "text-red-400"}
                subColor={kpis.variacionAbs >= 0 ? "text-green-500" : "text-red-500"}
              />
              <KpiCard
                icon={Package}
                label="Unidades vendidas"
                value={fmtI(kpis.totalUnidades)}
                sub={`Mes anterior: $${fmt(kpis.totalMesAnterior)}`}
                color="text-blue-300"
              />
              <KpiCard
                icon={FileText}
                label="Ticket promedio"
                value={`$${fmt(kpis.ticketPromedio)}`}
                sub={`${fmtI(kpis.totalDocumentos)} documentos`}
                color="text-amber-300"
              />
              <KpiCard
                icon={Users}
                label="Clientes activos"
                value={fmtI(kpis.totalClientes)}
                sub="Con compras este mes"
                color="text-purple-300"
              />
              <KpiCard
                icon={TrendingUp}
                label="Margen bruto"
                value={margen?.resumen ? `$${fmt(margen.resumen.totalMargen)}` : "—"}
                sub={margen?.resumen ? `${margen.resumen.margenGlobal}% sobre ventas` : "Sin datos de margen"}
                color="text-emerald-400"
              />
            </div>

            {/* ══════════════════════════════════════════════════
                CARDS POR EMPRESA
            ══════════════════════════════════════════════════ */}
            {porEmpresa.length > 0 && (() => {
              const cottsa   = porEmpresa.find(e => e.empresa.toUpperCase().includes('COTT'));
              const resto    = [...porEmpresa.filter(e => !e.empresa.toUpperCase().includes('COTT'))].sort((a, b) => b.actual - a.actual);
              const fila1    = resto.slice(0, 2);
              const fila3    = resto.slice(2);

              const EmpCard = ({ emp }: { emp: Empresa }) => {
                const pos      = emp.variacionAbs >= 0;
                const sinDatos = emp.actual === 0 && emp.anterior === 0;
                return (
                  <div
                    className="bg-gradient-to-br from-[#012E24] to-[#013d30] border border-[#046C5E]/30 rounded-2xl p-4 shadow-lg flex flex-col gap-3"
                    style={{ borderTopColor: emp.color, borderTopWidth: 2 }}
                  >
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-widest mb-0.5" style={{ color: emp.color }}>
                        {emp.empresa}
                      </p>
                      <p className="text-xl md:text-2xl font-extrabold text-white leading-tight">
                        {sinDatos ? <span className="text-gray-600 text-base">Sin datos</span> : `$${fmt(emp.actual)}`}
                      </p>
                    </div>
                    {!sinDatos && (
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-[10px] text-gray-500 uppercase tracking-wide">Mes anterior</p>
                          <p className="text-xs font-semibold text-gray-300">${fmt(emp.anterior)}</p>
                        </div>
                        <span className={`inline-flex items-center gap-1 text-xs font-bold px-2 py-1 rounded-lg border ${
                          pos ? "text-green-400 border-green-400/30 bg-green-400/10"
                             : "text-red-400 border-red-400/30 bg-red-400/10"
                        }`}>
                          {pos ? "▲" : "▼"} {emp.variacionPorc >= 0 ? "+" : ""}{emp.variacionPorc.toFixed(1)}%
                        </span>
                      </div>
                    )}
                    {!sinDatos && (
                      <div>
                        <p className="text-[9px] text-gray-600 uppercase tracking-wide mb-1">6 meses</p>
                        <ResponsiveContainer width="100%" height={64}>
                          <BarChart data={emp.tendencia} barSize={10} margin={{ top: 2, right: 2, left: 2, bottom: 0 }}>
                            <XAxis dataKey="label" tick={{ fill: "#4b5563", fontSize: 8 }} axisLine={false} tickLine={false} />
                            <Tooltip
                              formatter={(v: any) => [`$${fmt(v)}`, ""]}
                              contentStyle={{ background: "#012E24", border: `1px solid ${emp.color}50`, borderRadius: 8, fontSize: 10 }}
                              cursor={{ fill: "#046C5E15" }}
                            />
                            <Bar dataKey="total" fill={emp.color} radius={[2, 2, 0, 0]} opacity={0.8} />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    )}
                  </div>
                );
              };

              return (
                <div className="mb-8">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <p className="text-[11px] font-bold uppercase tracking-widest text-gray-400">Ventas por Empresa</p>
                      <p className="text-xs text-gray-500">Grupo AQUA — todas las razones sociales</p>
                    </div>
                  </div>

                  {/* Fila 1 — top 2 por ventas */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                    {fila1.map(emp => <EmpCard key={emp.empresa} emp={emp} />)}
                  </div>

                  {/* Fila 2 — COTTSA centrado */}
                  {cottsa && (
                    <div className="flex justify-center mb-4">
                      <div className="w-full sm:w-1/2">
                        <EmpCard emp={cottsa} />
                      </div>
                    </div>
                  )}

                  {/* Fila 3 — restantes */}
                  {fila3.length > 0 && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {fila3.map(emp => <EmpCard key={emp.empresa} emp={emp} />)}
                    </div>
                  )}
                </div>
              );
            })()}

            {/* ══════════════════════════════════════════════════
                GRÁFICO BARRAS COMPARATIVO + DONA
            ══════════════════════════════════════════════════ */}
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 mb-8">

              {/* Barras: Actual vs Anterior */}
              <div className="lg:col-span-3 bg-gradient-to-br from-[#012E24] to-[#013d30] border border-[#046C5E]/30 rounded-2xl p-5">
                <p className="text-[11px] font-bold uppercase tracking-widest text-gray-400">Ventas por Canal</p>
                <p className="text-xs text-gray-500 mb-5">Mes actual vs mes anterior ($)</p>
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={barData} barSize={18} barCategoryGap="30%">
                    <CartesianGrid strokeDasharray="3 3" stroke="#046C5E1A" vertical={false} />
                    <XAxis dataKey="canal" tick={{ fill: "#9ca3af", fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis
                      tickFormatter={v => `$${v >= 1000 ? `${(v/1000).toFixed(0)}k` : v}`}
                      tick={{ fill: "#9ca3af", fontSize: 10 }}
                      axisLine={false} tickLine={false}
                    />
                    <Tooltip content={<TooltipBars />} cursor={{ fill: "#046C5E18" }} />
                    <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11, color: "#9ca3af", paddingTop: 8 }} />
                    <Bar dataKey="Actual"   fill="#34d399" radius={[4,4,0,0]} />
                    <Bar dataKey="Anterior" fill="#046C5E" radius={[4,4,0,0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Dona: Distribución */}
              <div className="lg:col-span-2 bg-gradient-to-br from-[#012E24] to-[#013d30] border border-[#046C5E]/30 rounded-2xl p-5 flex flex-col">
                <p className="text-[11px] font-bold uppercase tracking-widest text-gray-400">Distribución</p>
                <p className="text-xs text-gray-500 mb-2">Participación por canal</p>
                <ResponsiveContainer width="100%" height={190}>
                  <PieChart>
                    <Pie
                      data={pieData} cx="50%" cy="50%"
                      innerRadius={55} outerRadius={82}
                      paddingAngle={3} dataKey="value" strokeWidth={0}
                    >
                      {pieData.map(entry => (
                        <Cell key={entry.name} fill={CANAL_COLORS[entry.name] || "#6b7280"} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(v: any) => [`$${fmt(v)}`, ""]}
                      contentStyle={{ background: "#012E24", border: "1px solid #046C5E", borderRadius: 10, fontSize: 12 }}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className="flex flex-col gap-2 mt-2">
                  {pieData.map(d => {
                    const pct = totalPie > 0 ? (d.value / totalPie) * 100 : 0;
                    return (
                      <div key={d.name}>
                        <div className="flex items-center justify-between text-xs">
                          <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: CANAL_COLORS[d.name] || "#6b7280" }} />
                            <span className="text-gray-300">{CANAL_LABELS[d.name] || d.name}</span>
                          </div>
                          <span className="font-bold" style={{ color: CANAL_COLORS[d.name] || "#fff" }}>{pct.toFixed(1)}%</span>
                        </div>
                        <MiniProgress value={pct} color={CANAL_COLORS[d.name] || "#6b7280"} />
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* ══════════════════════════════════════════════════
                ÁREA: TENDENCIA 6 MESES
            ══════════════════════════════════════════════════ */}
            <div className="bg-gradient-to-br from-[#012E24] to-[#013d30] border border-[#046C5E]/30 rounded-2xl p-5 mb-8">
              <div className="flex items-center justify-between mb-1">
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-widest text-gray-400">Tendencia de Ventas</p>
                  <p className="text-xs text-gray-500">Últimos 6 meses — Total empresa ($)</p>
                </div>
                {tendencia.length > 1 && (() => {
                  const last  = tendencia[tendencia.length - 1]?.total || 0;
                  const prev  = tendencia[tendencia.length - 2]?.total || 0;
                  const diff  = prev > 0 ? ((last - prev) / prev) * 100 : 0;
                  const pos   = diff >= 0;
                  return (
                    <span className={`text-xs font-bold px-2.5 py-1 rounded-full border ${pos ? "text-green-400 border-green-400/30 bg-green-400/10" : "text-red-400 border-red-400/30 bg-red-400/10"}`}>
                      {pos ? "▲" : "▼"} {Math.abs(diff).toFixed(1)}% vs mes ant.
                    </span>
                  );
                })()}
              </div>
              <ResponsiveContainer width="100%" height={210}>
                <AreaChart data={tendencia} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="gradTotal" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor="#34d399" stopOpacity={0.25} />
                      <stop offset="95%" stopColor="#34d399" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#046C5E1A" vertical={false} />
                  <XAxis dataKey="label" tick={{ fill: "#9ca3af", fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis
                    tickFormatter={v => `$${v >= 1000 ? `${(v/1000).toFixed(0)}k` : v}`}
                    tick={{ fill: "#9ca3af", fontSize: 10 }}
                    axisLine={false} tickLine={false}
                  />
                  <Tooltip content={<TooltipArea />} cursor={{ stroke: "#34d399", strokeWidth: 1, strokeDasharray: "4 4" }} />
                  <Area
                    type="monotone" dataKey="total" name="Total"
                    stroke="#34d399" strokeWidth={2.5}
                    fill="url(#gradTotal)"
                    dot={{ fill: "#34d399", r: 4, strokeWidth: 0 }}
                    activeDot={{ r: 6, fill: "#34d399", strokeWidth: 2, stroke: "#012E24" }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            {/* ══════════════════════════════════════════════════
                TOP PRODUCTOS + TOP CLIENTES
            ══════════════════════════════════════════════════ */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">

              {/* Top Productos */}
              <div className="bg-gradient-to-br from-[#012E24] to-[#013d30] border border-[#046C5E]/30 rounded-2xl p-5">
                <p className="text-[11px] font-bold uppercase tracking-widest text-gray-400">Top 10 Productos</p>
                <p className="text-xs text-gray-500 mb-4">Por ventas en dólares — mes actual</p>
                {topProdData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart layout="vertical" data={topProdData} barSize={12} margin={{ left: 0, right: 20 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#046C5E1A" horizontal={false} />
                      <XAxis
                        type="number"
                        tickFormatter={v => `$${v >= 1000 ? `${(v/1000).toFixed(0)}k` : v}`}
                        tick={{ fill: "#9ca3af", fontSize: 10 }}
                        axisLine={false} tickLine={false}
                      />
                      <YAxis
                        type="category" dataKey="nombre" width={130}
                        tick={{ fill: "#d1d5db", fontSize: 10 }}
                        axisLine={false} tickLine={false}
                      />
                      <Tooltip content={<TooltipHBar />} cursor={{ fill: "#046C5E18" }} />
                      <Bar dataKey="dolares" fill="#60a5fa" radius={[0,4,4,0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <p className="text-gray-500 text-center py-10">Sin datos para este período</p>
                )}
              </div>

              {/* Top Clientes */}
              <div className="bg-gradient-to-br from-[#012E24] to-[#013d30] border border-[#046C5E]/30 rounded-2xl p-5">
                <p className="text-[11px] font-bold uppercase tracking-widest text-gray-400">Top 10 Clientes</p>
                <p className="text-xs text-gray-500 mb-4">Por volumen de compra — mes actual</p>
                {topClData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart layout="vertical" data={topClData} barSize={12} margin={{ left: 0, right: 20 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#046C5E1A" horizontal={false} />
                      <XAxis
                        type="number"
                        tickFormatter={v => `$${v >= 1000 ? `${(v/1000).toFixed(0)}k` : v}`}
                        tick={{ fill: "#9ca3af", fontSize: 10 }}
                        axisLine={false} tickLine={false}
                      />
                      <YAxis
                        type="category" dataKey="nombre" width={130}
                        tick={{ fill: "#d1d5db", fontSize: 10 }}
                        axisLine={false} tickLine={false}
                      />
                      <Tooltip content={<TooltipHBar />} cursor={{ fill: "#046C5E18" }} />
                      <Bar dataKey="dolares" fill="#fbbf24" radius={[0,4,4,0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <p className="text-gray-500 text-center py-10">Sin datos para este período</p>
                )}
              </div>
            </div>

            {/* ══════════════════════════════════════════════════
                TABLA RESUMEN POR CANAL
            ══════════════════════════════════════════════════ */}
            <div className="bg-gradient-to-br from-[#012E24] to-[#013d30] border border-[#046C5E]/30 rounded-2xl p-5 mb-8">
              <p className="text-[11px] font-bold uppercase tracking-widest text-gray-400 mb-4">Resumen Detallado por Canal</p>
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="text-[10px] uppercase text-green-300 bg-[#014434]">
                      <th className="px-4 py-3 text-left rounded-tl-lg">Canal</th>
                      <th className="px-4 py-3 text-right">Dólares $</th>
                      {periodo?.esMesActual && <th className="px-4 py-3 text-right">Proyección</th>}
                      <th className="px-4 py-3 text-right">Unidades</th>
                      <th className="px-4 py-3 text-right">Mes Anterior</th>
                      <th className="px-4 py-3 text-right">Variación $</th>
                      <th className="px-4 py-3 text-right">Var %</th>
                      <th className="px-4 py-3 text-right">Part. %</th>
                      <th className="px-4 py-3 text-right rounded-tr-lg">Clientes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {canales.map((c, i) => {
                      const pos  = c.variacionAbs >= 0;
                      const part = kpis.totalVentas > 0 ? (c.dolares / kpis.totalVentas) * 100 : 0;
                      const clr  = CANAL_COLORS[c.canal] || "#fff";
                      return (
                        <tr
                          key={c.canal}
                          className={`${i % 2 === 0 ? "bg-[#013d32]" : "bg-[#014f3e]"} hover:bg-[#025940] transition`}
                        >
                          <td className="px-4 py-3 font-bold" style={{ color: clr }}>
                            <div className="flex items-center gap-2">
                              <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: clr }} />
                              {c.canal}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-right text-white font-semibold">${fmt(c.dolares)}</td>
                          {periodo?.esMesActual && (
                            <td className="px-4 py-3 text-right text-emerald-400 font-semibold">${fmt(c.proyeccion)}</td>
                          )}
                          <td className="px-4 py-3 text-right text-blue-300">{fmtI(c.unidades)}</td>
                          <td className="px-4 py-3 text-right text-gray-400">${fmt(c.mesAnterior)}</td>
                          <td className={`px-4 py-3 text-right font-bold ${pos ? "text-green-400" : "text-red-400"}`}>
                            {pos ? "+" : ""}${fmt(c.variacionAbs)}
                          </td>
                          <td className={`px-4 py-3 text-right font-bold ${pos ? "text-green-400" : "text-red-400"}`}>
                            {pos ? "+" : ""}{c.variacionPorc.toFixed(1)}%
                          </td>
                          <td className="px-4 py-3 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <div className="w-12 bg-[#011f1a] rounded-full h-1.5">
                                <div className="h-1.5 rounded-full" style={{ width: `${Math.min(part, 100)}%`, background: clr }} />
                              </div>
                              <span className="text-gray-300 text-xs w-10 text-right">{part.toFixed(1)}%</span>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-right text-gray-400">{fmtI(c.clientes)}</td>
                        </tr>
                      );
                    })}

                    {/* Fila total */}
                    <tr className="bg-[#014434] font-bold text-gray-100 border-t-2 border-[#046C5E]">
                      <td className="px-4 py-3 text-green-300 rounded-bl-lg">TOTAL EMPRESA</td>
                      <td className="px-4 py-3 text-right text-white">${fmt(kpis.totalVentas)}</td>
                      {periodo?.esMesActual && (
                        <td className="px-4 py-3 text-right text-emerald-400">${fmt(kpis.totalProyeccion)}</td>
                      )}
                      <td className="px-4 py-3 text-right text-blue-300">{fmtI(kpis.totalUnidades)}</td>
                      <td className="px-4 py-3 text-right text-gray-300">${fmt(kpis.totalMesAnterior)}</td>
                      <td className={`px-4 py-3 text-right ${kpis.variacionAbs >= 0 ? "text-green-400" : "text-red-400"}`}>
                        {kpis.variacionAbs >= 0 ? "+" : ""}${fmt(Math.abs(kpis.variacionAbs))}
                      </td>
                      <td className={`px-4 py-3 text-right ${kpis.variacionAbs >= 0 ? "text-green-400" : "text-red-400"}`}>
                        {kpis.variacionAbs >= 0 ? "+" : ""}{kpis.variacionPorc.toFixed(1)}%
                      </td>
                      <td className="px-4 py-3 text-right text-gray-300">100%</td>
                      <td className="px-4 py-3 text-right text-gray-300 rounded-br-lg">{fmtI(kpis.totalClientes)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}

        {/* ══════════════════════════════════════════════════════
            PESTAÑA: MÁRGENES
        ══════════════════════════════════════════════════════ */}
        {tab === "margenes" && !cargando && (
          margen ? (
            <section className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <KpiCardG label="Ventas Totales"  value={`$${fmt(margen.resumen.totalVentas)}`} color="text-white"       icon={<AttachMoneyIcon sx={{fontSize:18}}/>}/>
                <KpiCardG label="Margen Bruto"    value={`$${fmt(margen.resumen.totalMargen)}`} color="text-emerald-300" icon={<TrendingUpIcon sx={{fontSize:18}}/>}/>
                <KpiCardG label="% Margen Global" value={`${margen.resumen.margenGlobal}%`}
                  color={margen.resumen.margenGlobal>=20?"text-emerald-300":"text-amber-300"} icon={<DonutLargeIcon sx={{fontSize:18}}/>}/>
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div className="bg-gradient-to-br from-[#012E24] to-[#013d30] border border-[#046C5E]/30 rounded-2xl p-4">
                  <div className="flex items-center gap-2 mb-4">
                    <AssessmentIcon sx={{fontSize:14,color:"#9ca3af"}}/>
                    <p className="text-xs text-gray-400 uppercase tracking-widest">Distribución por Canal</p>
                  </div>
                  {margen.porCanal.length>0 && (
                    <>
                      <ResponsiveContainer width="100%" height={200}>
                        <PieChart>
                          <Pie data={margen.porCanal} dataKey="ventas_total" nameKey="canal"
                            cx="50%" cy="50%" outerRadius={80} innerRadius={40}>
                            {margen.porCanal.map((_,i)=><Cell key={i} fill={COLORS[i%COLORS.length]}/>)}
                          </Pie>
                          <Tooltip formatter={(v:number)=>`$${fmt(v)}`}
                            contentStyle={{background:"#012E24",border:"1px solid #046C5E55",borderRadius:8,fontSize:12}}/>
                          <Legend formatter={(v)=><span className="text-xs text-gray-300">{v}</span>}/>
                        </PieChart>
                      </ResponsiveContainer>
                      <div className="mt-3 space-y-2">
                        {margen.porCanal.map((c,i)=>(
                          <div key={i} className="flex items-center justify-between text-xs">
                            <div className="flex items-center gap-2">
                              <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{background:COLORS[i%COLORS.length]}}/>
                              <span className="text-gray-300">{c.canal}</span>
                            </div>
                            <div className="flex items-center gap-3">
                              <span className="text-white font-bold">${fmt(Number(c.ventas_total))}</span>
                              <span className={`font-bold ${Number(c.margen_pct)>=20?"text-emerald-400":"text-amber-400"}`}>{Number(c.margen_pct).toFixed(1)}%</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </div>
                <div className="bg-gradient-to-br from-[#012E24] to-[#013d30] border border-[#046C5E]/30 rounded-2xl p-4">
                  <div className="flex items-center gap-2 mb-4">
                    <Inventory2Icon sx={{fontSize:14,color:"#9ca3af"}}/>
                    <p className="text-xs text-gray-400 uppercase tracking-widest">Top Categorías por Ventas</p>
                  </div>
                  <div className="space-y-2">
                    {margen.porCategoria.slice(0,12).map((c,i)=>(
                      <div key={i} className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          <span className="text-gray-500 w-4 shrink-0">{i+1}</span>
                          <span className="text-gray-300 truncate">{c.categoria}</span>
                        </div>
                        <div className="flex items-center gap-3 shrink-0 ml-2">
                          <span className="text-white font-bold">${fmt(Number(c.ventas_total))}</span>
                          <span className={`font-bold w-12 text-right ${Number(c.margen_pct)>=20?"text-emerald-400":"text-amber-400"}`}>{Number(c.margen_pct).toFixed(1)}%</span>
                        </div>
                      </div>
                    ))}
                    {margen.porCategoria.length===0&&<p className="text-center py-8 text-gray-400">Sin datos de categorías.</p>}
                  </div>
                </div>
              </div>
            </section>
          ) : (
            <p className="text-gray-400 text-center py-16">No se pudieron cargar los datos de márgenes.</p>
          )
        )}

        {/* ══════════════════════════════════════════════════════
            PESTAÑA: VENDEDORES
        ══════════════════════════════════════════════════════ */}
        {tab === "vendedores" && !cargando && (
          <section className="space-y-4">
            <div className="flex items-center gap-2">
              <EmojiEventsIcon sx={{fontSize:14,color:"#9ca3af"}}/>
              <p className="text-xs text-gray-400 uppercase tracking-widest">Eficiencia de Vendedores — {MESES_LABEL[mesSeleccionado]} {anioSeleccionado}</p>
            </div>
            {vendedores.length>0 && (
              <div className="bg-gradient-to-br from-[#012E24] to-[#013d30] border border-[#046C5E]/30 rounded-2xl p-4">
                <p className="text-xs text-gray-400 uppercase tracking-widest mb-3">Ventas por Vendedor</p>
                <ResponsiveContainer width="100%" height={Math.max(200, vendedores.length*28)}>
                  <BarChart data={vendedores.slice(0,15)} layout="vertical" margin={{top:0,right:20,left:90,bottom:0}}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#046C5E22" horizontal={false}/>
                    <XAxis type="number" tick={{fill:"#9ca3af",fontSize:10}} tickFormatter={v=>fmtK(v)}/>
                    <YAxis type="category" dataKey="nombre_vendedor" tick={{fill:"#9ca3af",fontSize:10}} width={85}/>
                    <Tooltip content={<TipDol/>}/>
                    <Bar dataKey="ventas_total" name="Ventas" radius={[0,4,4,0]}>
                      {vendedores.slice(0,15).map((_,i)=><Cell key={i} fill={COLORS[i%COLORS.length]}/>)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
            <div className="bg-gradient-to-br from-[#012E24] to-[#013d30] border border-[#046C5E]/30 rounded-2xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="bg-[#014434] text-[10px] uppercase text-green-300">
                      <th className="px-3 py-3 text-left">N°</th>
                      <th className="px-3 py-3 text-left">Vendedor</th>
                      <th className="px-3 py-3 text-right">Visit.</th>
                      <th className="px-3 py-3 text-right">Pedidos</th>
                      <th className="px-3 py-3 text-right">Ventas $</th>
                      <th className="px-3 py-3 text-right">Margen $</th>
                      <th className="px-3 py-3 text-right">Margen %</th>
                      <th className="px-3 py-3 text-right">Tasa Cierre</th>
                    </tr>
                  </thead>
                  <tbody>
                    {vendedores.length===0
                      ? <tr><td colSpan={8} className="text-center py-12 text-gray-400">Sin datos de vendedores.</td></tr>
                      : vendedores.map((v,i)=>(
                        <tr key={v.codigo_vendedor||i}
                          className={`${i===0?"bg-amber-900/20 border-l-2 border-amber-500":i%2===0?"bg-[#013d32]":"bg-[#014f3e]"} hover:bg-[#025940] transition`}>
                          <td className="px-3 py-2"><Medalla pos={i}/></td>
                          <td className="px-3 py-2"><p className="font-semibold text-white">{v.nombre_vendedor}</p><p className="text-[10px] text-blue-400 font-mono">{v.codigo_vendedor}</p></td>
                          <td className="px-3 py-2 text-right text-white">{fmtI(v.clientes_visitados)}</td>
                          <td className="px-3 py-2 text-right text-white">{fmtI(v.pedidos)}</td>
                          <td className="px-3 py-2 text-right font-bold text-emerald-300">${fmt(Number(v.ventas_total))}</td>
                          <td className="px-3 py-2 text-right text-blue-300">${fmt(Number(v.margen_total))}</td>
                          <td className="px-3 py-2 text-right"><span className={`font-bold ${Number(v.margen_pct)>=20?"text-emerald-400":Number(v.margen_pct)>=10?"text-amber-400":"text-red-400"}`}>{Number(v.margen_pct).toFixed(1)}%</span></td>
                          <td className="px-3 py-2 text-right"><span className={`font-bold ${Number(v.tasa_cierre_pct)>=60?"text-emerald-400":Number(v.tasa_cierre_pct)>=30?"text-amber-400":"text-red-400"}`}>{Number(v.tasa_cierre_pct).toFixed(1)}%</span></td>
                        </tr>
                      ))
                    }
                  </tbody>
                </table>
              </div>
            </div>
          </section>
        )}

        {/* ══════════════════════════════════════════════════════
            PESTAÑA: COBRANZA
        ══════════════════════════════════════════════════════ */}
        {tab === "cobranza" && !cargando && (
          cobranza ? (
            <section className="space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <KpiCardG label="Total Cartera"     value={`$${fmt(cobranza.resumen.total_cartera)}`}  color="text-red-300"     icon={<AccountBalanceIcon sx={{fontSize:18}}/>}/>
                <KpiCardG label="Clientes Críticos" value={String(cobranza.resumen.clientes_criticos)} color="text-red-300"     icon={<ErrorOutlineIcon sx={{fontSize:18}}/>} sub="> 45 días vencido"/>
                <KpiCardG label="En Alerta"         value={String(cobranza.resumen.clientes_alerta)}   color="text-amber-300"   icon={<WarningAmberIcon sx={{fontSize:18}}/>} sub="> 20 días vencido"/>
                <KpiCardG label="Al Día"            value={String(cobranza.resumen.clientes_ok)}       color="text-emerald-300" icon={<CheckCircleOutlineIcon sx={{fontSize:18}}/>}/>
              </div>
              <div className="bg-gradient-to-br from-[#012E24] to-[#013d30] border border-[#046C5E]/30 rounded-2xl overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead>
                      <tr className="bg-[#014434] text-[10px] uppercase text-green-300">
                        <th className="px-3 py-3 text-left">N°</th>
                        <th className="px-3 py-3 text-left">Cliente</th>
                        <th className="px-3 py-3 text-center">Teléfono</th>
                        <th className="px-3 py-3 text-right">Facturas</th>
                        <th className="px-3 py-3 text-right">Saldo Total</th>
                        <th className="px-3 py-3 text-center">Venc. + Antigua</th>
                        <th className="px-3 py-3 text-right">Días Vencido</th>
                        <th className="px-3 py-3 text-center">Estado</th>
                      </tr>
                    </thead>
                    <tbody>
                      {cobranza.detalle.length===0
                        ? <tr><td colSpan={8} className="text-center py-12 text-gray-400">Sin cartera pendiente.</td></tr>
                        : cobranza.detalle.map((r,i)=>(
                          <tr key={r.codigo_cliente||i}
                            className={`${r.estado==="CRITICO"?"bg-red-900/20":i%2===0?"bg-[#013d32]":"bg-[#014f3e]"} hover:bg-[#025940] transition`}>
                            <td className="px-3 py-2 text-gray-400 text-xs">{i+1}</td>
                            <td className="px-3 py-2"><p className="font-semibold text-white">{r.nombre_cliente}</p><p className="text-[10px] text-blue-400 font-mono">{r.codigo_cliente}</p></td>
                            <td className="px-3 py-2 text-center text-gray-300 text-xs">{r.telefono_cliente||"—"}</td>
                            <td className="px-3 py-2 text-right text-white">{r.facturas_pendientes}</td>
                            <td className="px-3 py-2 text-right font-bold text-red-300">${fmt(Number(r.saldo_total))}</td>
                            <td className="px-3 py-2 text-center text-gray-400 text-xs">{r.fecha_mas_antigua?new Date(r.fecha_mas_antigua).toLocaleDateString("es-EC"):"—"}</td>
                            <td className={`px-3 py-2 text-right font-extrabold text-lg ${r.dias_vencido>45?"text-red-400":r.dias_vencido>20?"text-amber-400":"text-emerald-400"}`}>{r.dias_vencido}d</td>
                            <td className="px-3 py-2 text-center">
                              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${ESTADO_CL[r.estado]||""}`}>{r.estado}</span>
                            </td>
                          </tr>
                        ))
                      }
                    </tbody>
                  </table>
                </div>
              </div>
            </section>
          ) : (
            <p className="text-gray-400 text-center py-16">No se pudieron cargar los datos de cobranza.</p>
          )
        )}

        {/* ══════════════════════════════════════════════════════
            PESTAÑA: RIESGO DE FUGA
        ══════════════════════════════════════════════════════ */}
        {tab === "riesgo" && !cargando && (
          riesgo ? (
            <section className="space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <KpiCardG label="Clientes Perdidos" value={String(riesgo.resumen.perdidos)}   color="text-red-300"     icon={<ErrorOutlineIcon sx={{fontSize:18}}/>} sub="> 60 días sin comprar"/>
                <KpiCardG label="En Riesgo"         value={String(riesgo.resumen.en_riesgo)}  color="text-amber-300"   icon={<WarningAmberIcon sx={{fontSize:18}}/>} sub="> 30 días sin comprar"/>
                <KpiCardG label="En Alerta"         value={String(riesgo.resumen.en_alerta)}  color="text-yellow-300"  icon={<NotificationsActiveIcon sx={{fontSize:18}}/>} sub="= 30 días sin comprar"/>
                <KpiCardG label="Cartera en Riesgo" value={`$${fmt(riesgo.resumen.cartera_en_riesgo)}`} color="text-red-300" icon={<PaymentsIcon sx={{fontSize:18}}/>}/>
              </div>
              <div className="bg-gradient-to-br from-[#012E24] to-[#013d30] border border-[#046C5E]/30 rounded-2xl overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead>
                      <tr className="bg-[#014434] text-[10px] uppercase text-green-300">
                        <th className="px-3 py-3 text-left">N°</th>
                        <th className="px-3 py-3 text-left">Cliente</th>
                        <th className="px-3 py-3 text-left">Vendedor</th>
                        <th className="px-3 py-3 text-center">Última Compra</th>
                        <th className="px-3 py-3 text-right">Días Sin Comprar</th>
                        <th className="px-3 py-3 text-right">Facturas</th>
                        <th className="px-3 py-3 text-right">Ventas Históricas</th>
                        <th className="px-3 py-3 text-right">Ticket Prom.</th>
                        <th className="px-3 py-3 text-center">Estado</th>
                      </tr>
                    </thead>
                    <tbody>
                      {riesgo.clientes.length===0
                        ? <tr><td colSpan={9} className="text-center py-12 text-gray-400">No hay clientes en riesgo.</td></tr>
                        : riesgo.clientes.map((c,i)=>(
                          <tr key={c.codigo_cliente||i}
                            className={`${c.estado==="PERDIDO"?"bg-red-900/20":c.estado==="RIESGO"?"bg-amber-900/10":i%2===0?"bg-[#013d32]":"bg-[#014f3e]"} hover:bg-[#025940] transition`}>
                            <td className="px-3 py-2 text-gray-400 text-xs">{i+1}</td>
                            <td className="px-3 py-2"><p className="font-semibold text-white">{c.nombre_cliente}</p><p className="text-[10px] text-blue-400 font-mono">{c.codigo_cliente}</p>{c.telefono_cliente&&<p className="text-[10px] text-gray-400">{c.telefono_cliente}</p>}</td>
                            <td className="px-3 py-2 text-gray-300 text-xs">{c.vendedor||"—"}</td>
                            <td className="px-3 py-2 text-center text-gray-400 text-xs">{c.ultima_fecha?new Date(c.ultima_fecha).toLocaleDateString("es-EC"):"—"}</td>
                            <td className={`px-3 py-2 text-right font-extrabold text-lg ${c.dias_sin_comprar>60?"text-red-400":c.dias_sin_comprar>30?"text-amber-400":"text-yellow-400"}`}>{c.dias_sin_comprar}d</td>
                            <td className="px-3 py-2 text-right text-white">{c.total_facturas}</td>
                            <td className="px-3 py-2 text-right text-emerald-300 font-bold">${fmt(Number(c.ventas_acumuladas))}</td>
                            <td className="px-3 py-2 text-right text-gray-300">${fmt(Number(c.ticket_promedio))}</td>
                            <td className="px-3 py-2 text-center"><span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${ESTADO_CL[c.estado]||""}`}>{c.estado}</span></td>
                          </tr>
                        ))
                      }
                    </tbody>
                  </table>
                </div>
              </div>
            </section>
          ) : (
            <p className="text-gray-400 text-center py-16">No se pudieron cargar los datos de riesgo.</p>
          )
        )}
      </div>
    </DashboardLayout>
  );
}
