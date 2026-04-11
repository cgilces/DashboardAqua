import React, { useEffect, useState, useCallback } from "react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Cell,
  PieChart, Pie, Legend,
  AreaChart, Area, ResponsiveContainer,
} from "recharts";

// MUI Icons
import AttachMoneyIcon        from "@mui/icons-material/AttachMoney";
import CalendarMonthIcon      from "@mui/icons-material/CalendarMonth";
import Inventory2Icon         from "@mui/icons-material/Inventory2";
import ReceiptIcon            from "@mui/icons-material/Receipt";
import PeopleIcon             from "@mui/icons-material/People";
import TrendingUpIcon         from "@mui/icons-material/TrendingUp";
import InsightsIcon           from "@mui/icons-material/Insights";
import CreditCardIcon         from "@mui/icons-material/CreditCard";
import WarningAmberIcon       from "@mui/icons-material/WarningAmber";
import ErrorOutlineIcon       from "@mui/icons-material/ErrorOutline";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
import AssessmentIcon         from "@mui/icons-material/Assessment";
import PersonOffIcon          from "@mui/icons-material/PersonOff";
import NotificationsActiveIcon from "@mui/icons-material/NotificationsActive";
import AccountBalanceIcon     from "@mui/icons-material/AccountBalance";
import PaymentsIcon           from "@mui/icons-material/Payments";
import EmojiEventsIcon        from "@mui/icons-material/EmojiEvents";
import SpeedIcon              from "@mui/icons-material/Speed";
import DonutLargeIcon         from "@mui/icons-material/DonutLarge";

import WorkspacePremiumIcon   from "@mui/icons-material/WorkspacePremium";
import StorefrontIcon         from "@mui/icons-material/Storefront";
import RadioButtonCheckedIcon from "@mui/icons-material/RadioButtonChecked";

import DashboardLayout from "../../layout/DashboardLayout";
import { Header } from "../../components/common/Header";
import { API_BASE_URL } from "../../config";

// ── Helpers ─────────────────────────────────────────────────────────
const MESES_LABEL = ["","Enero","Febrero","Marzo","Abril","Mayo","Junio",
  "Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];

const fmt  = (n: number) => n.toLocaleString("es-EC", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtI = (n: number) => n.toLocaleString("es-EC");
const fmtK = (n: number) => {
  if (n >= 1_000_000) return `$${(n/1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `$${(n/1_000).toFixed(1)}k`;
  return `$${fmt(n)}`;
};

// ── Types ────────────────────────────────────────────────────────────
interface Kpis { ventas:number; unidades:number; pedidos:number; clientes_activos:number; margen:number; ventas_anterior:number; variacion_pct:number|null; anio:number; mes:number }
interface Proyeccion { ventas_actual:number; dias_transcurridos:number; dias_mes:number; tasa_diaria:number; proyeccion:number; ventas_anterior:number; pct_mes_anterior:number|null; pedidos_actual:number; clientes_actual:number }
interface CobranzaRow { codigo_cliente:string; nombre_cliente:string; telefono_cliente:string; facturas_pendientes:number; saldo_total:number; fecha_mas_antigua:string; dias_vencido:number; estado:"CRITICO"|"ALERTA"|"OK" }
interface CobranzaData { resumen:{total_cartera:number;clientes_criticos:number;clientes_alerta:number;clientes_ok:number}; detalle:CobranzaRow[] }
interface Vendedor { nombre_vendedor:string; codigo_vendedor:string; clientes_visitados:number; pedidos:number; ventas_total:number; margen_total:number; clientes_con_pedido:number; tasa_cierre_pct:number; margen_pct:number }
interface ClienteRiesgo { codigo_cliente:string; nombre_cliente:string; telefono_cliente:string; vendedor:string; ultima_fecha:string; dias_sin_comprar:number; total_facturas:number; ventas_acumuladas:number; ticket_promedio:number; estado:"PERDIDO"|"RIESGO"|"ALERTA" }

interface MargenCanal { canal:string; ventas_total:number; margen_total:number; num_pedidos:number; margen_pct:number }
interface MargenCategoria { categoria:string; ventas_total:number; margen_total:number; unidades:number; margen_pct:number }
interface Producto { producto:string; codigo_producto:string; categoria:string; ventas_total:number; unidades:number; margen_total:number; num_clientes:number; num_pedidos:number; margen_pct:number; precio_promedio:number }
interface ClienteNuevo { nuevos:number; recurrentes:number; total_activos:number }
interface TendenciaNuevos { label:string; nuevos:number; recurrentes:number }
interface RankingCliente { customer_code:string; nombre_cliente:string; telefono_cliente:string; tipo_negocio:string; seller_code:string; ventas_total:number; unidades_total:number; num_pedidos:number; ticket_promedio:number; margen_total:number }

// ── Colores ──────────────────────────────────────────────────────────
const COLORS = ["#34d399","#60a5fa","#fbbf24","#a78bfa","#f87171","#38bdf8","#fb7185","#a3e635","#fb923c","#e879f9"];
const ESTADO_CL: Record<string,string> = {
  CRITICO:"bg-red-500/20 text-red-300 border-red-500/40",
  ALERTA: "bg-amber-500/20 text-amber-300 border-amber-500/40",
  OK:     "bg-emerald-500/20 text-emerald-300 border-emerald-500/40",
  PERDIDO:"bg-red-500/20 text-red-300 border-red-500/40",
  RIESGO: "bg-amber-500/20 text-amber-300 border-amber-500/40",
};

// ── Medallas ─────────────────────────────────────────────────────────
function Medalla({ pos }: { pos: number }) {
  if (pos === 0) return <WorkspacePremiumIcon sx={{ fontSize:18, color:"#fbbf24" }} />;
  if (pos === 1) return <WorkspacePremiumIcon sx={{ fontSize:18, color:"#9ca3af" }} />;
  if (pos === 2) return <WorkspacePremiumIcon sx={{ fontSize:18, color:"#b45309" }} />;
  return <span className="text-gray-400 text-xs">{pos + 1}</span>;
}

// ── KPI Card ─────────────────────────────────────────────────────────
function KpiCard({ label, value, sub, color="text-white", icon, badge, badgeColor="text-emerald-300" }: {
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

// ── Barra de progreso ─────────────────────────────────────────────────
function ProgBar({ pct, label, sub }: { pct:number; label:string; sub?:string }) {
  const cl = pct >= 90 ? "bg-emerald-500" : pct >= 60 ? "bg-amber-400" : "bg-red-500";
  const txtCl = pct >= 90 ? "text-emerald-400" : pct >= 60 ? "text-amber-400" : "text-red-400";
  return (
    <div className="mb-3">
      <div className="flex justify-between items-start mb-1">
        <div>
          <span className="text-white font-semibold text-xs block">{label}</span>
          {sub && <span className="text-gray-500 text-[10px]">{sub}</span>}
        </div>
        <span className={`font-extrabold text-base ml-3 shrink-0 ${txtCl}`}>{pct}%</span>
      </div>
      <div className="h-2.5 bg-white/10 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${cl} transition-all duration-500`} style={{ width:`${Math.min(pct,100)}%` }} />
      </div>
    </div>
  );
}

// ── Tooltip ───────────────────────────────────────────────────────────
const TipDol = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-[#012E24] border border-[#046C5E]/40 rounded-lg px-3 py-2 text-xs text-white shadow-xl">
      <p className="font-bold mb-1">{label}</p>
      {payload.map((p: any) => <p key={p.name} style={{color:p.color||p.fill}}>{p.name}: ${fmt(Number(p.value))}</p>)}
    </div>
  );
};

// ── Tabs ──────────────────────────────────────────────────────────────
const TABS = [
  { id:"resumen",    label:"Resumen",       icon: <AssessmentIcon sx={{fontSize:16}}/> },
  { id:"proyeccion", label:"Proyección",    icon: <InsightsIcon sx={{fontSize:16}}/> },
  { id:"cobranza",   label:"Cobranza",      icon: <CreditCardIcon sx={{fontSize:16}}/> },
  { id:"vendedores", label:"Vendedores",    icon: <EmojiEventsIcon sx={{fontSize:16}}/> },
  { id:"clientes",   label:"Top Clientes",  icon: <PeopleIcon sx={{fontSize:16}}/> },
  { id:"riesgo",     label:"Riesgo Fuga",   icon: <PersonOffIcon sx={{fontSize:16}}/> },
  { id:"productos",  label:"Productos",     icon: <Inventory2Icon sx={{fontSize:16}}/> },
  { id:"margen",     label:"Márgenes",      icon: <TrendingUpIcon sx={{fontSize:16}}/> },
];

// ════════════════════════════════════════════════════════════════════
// PÁGINA PRINCIPAL
// ════════════════════════════════════════════════════════════════════
export default function DashboardGerencia() {
  const hoy = new Date();
  const [anio, setAnio] = useState(hoy.getFullYear());
  const [mes,  setMes]  = useState(hoy.getMonth() + 1);
  const [tab,  setTab]  = useState("resumen");

  const [kpis,       setKpis]       = useState<Kpis|null>(null);
  const [proyeccion, setProyeccion] = useState<Proyeccion|null>(null);
  const [cobranza,   setCobranza]   = useState<CobranzaData|null>(null);
  const [vendedores, setVendedores] = useState<Vendedor[]>([]);
  const [riesgo,     setRiesgo]     = useState<{resumen:any;clientes:ClienteRiesgo[]}|null>(null);
  const [margen,     setMargen]     = useState<{porCanal:MargenCanal[];porCategoria:MargenCategoria[];resumen:any}|null>(null);
  const [productos,  setProductos]  = useState<Producto[]>([]);
  const [nuevos,     setNuevos]     = useState<{resumen:ClienteNuevo;tendencia:TendenciaNuevos[]}|null>(null);
  const [ranking,    setRanking]    = useState<RankingCliente[]>([]);
  const [loading,    setLoading]    = useState(false);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    const qs = `anio=${anio}&mes=${mes}`;
    try {
      const [k, pr, c, v, r, mg, p, n, rk] = await Promise.all([
        fetch(`${API_BASE_URL}/api/gerencia/kpis?${qs}`).then(r=>r.json()),
        fetch(`${API_BASE_URL}/api/gerencia/proyeccion?${qs}`).then(r=>r.json()),
        fetch(`${API_BASE_URL}/api/gerencia/cobranza?${qs}`).then(r=>r.json()),
        fetch(`${API_BASE_URL}/api/gerencia/vendedores?${qs}`).then(r=>r.json()),
        fetch(`${API_BASE_URL}/api/gerencia/clientes-riesgo`).then(r=>r.json()),
        fetch(`${API_BASE_URL}/api/gerencia/margen?${qs}`).then(r=>r.json()),
        fetch(`${API_BASE_URL}/api/gerencia/top-productos?${qs}&limite=20`).then(r=>r.json()),
        fetch(`${API_BASE_URL}/api/gerencia/clientes-nuevos?${qs}`).then(r=>r.json()),
        fetch(`${API_BASE_URL}/api/gerencia/ranking-clientes?${qs}&limite=25`).then(r=>r.json()),
      ]);
      setKpis(k);
      setProyeccion(pr);
      setCobranza(c);
      setVendedores(v.vendedores||[]);
      setRiesgo(r);
      setMargen(mg);
      setProductos(p.productos||[]);
      setNuevos(n);
      setRanking(rk.clientes||[]);
    } catch(e) { console.error(e); }
    finally { setLoading(false); }
  }, [anio, mes]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const anios = [hoy.getFullYear()-1, hoy.getFullYear()];

  return (
    <DashboardLayout>
      <div className="main-content min-h-screen text-white px-4 md:px-8 py-4 md:py-6">
        <Header />

        {/* ── Cabecera ── */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-5 border-b border-[#046C5E]/50 pb-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight">Dashboard Gerencial</h1>
            <p className="text-sm text-gray-400 mt-1">Vista ejecutiva integral · Grupo AQUA S.A. · {MESES_LABEL[mes]} {anio}</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <select value={anio} onChange={e=>setAnio(Number(e.target.value))}
              className="bg-[#013d30] border border-[#046C5E]/40 text-white rounded-lg px-3 py-1.5 text-sm focus:outline-none">
              {anios.map(a=><option key={a} value={a}>{a}</option>)}
            </select>
            <select value={mes} onChange={e=>setMes(Number(e.target.value))}
              className="bg-[#013d30] border border-[#046C5E]/40 text-white rounded-lg px-3 py-1.5 text-sm focus:outline-none">
              {MESES_LABEL.slice(1).map((m,i)=><option key={i+1} value={i+1}>{m}</option>)}
            </select>
            <button onClick={fetchAll} disabled={loading}
              className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-sm font-semibold px-4 py-1.5 rounded-lg transition flex items-center gap-1.5">
              <InsightsIcon sx={{fontSize:15}}/> {loading ? "Cargando…" : "Actualizar"}
            </button>
          </div>
        </div>

        {/* ── Tabs ── */}
        <div className="flex flex-wrap gap-1.5 mb-5">
          {TABS.map(t=>(
            <button key={t.id} onClick={()=>setTab(t.id)}
              className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg transition
                ${tab===t.id
                  ? "bg-emerald-600 text-white shadow"
                  : "bg-[#012E24] border border-[#046C5E]/30 text-gray-400 hover:text-white hover:border-emerald-500/40"}`}>
              {t.icon}{t.label}
            </button>
          ))}
        </div>

        {loading && (
          <div className="flex justify-center items-center py-24">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-emerald-400"/>
          </div>
        )}

        {!loading && (
          <>
            {/* ════════ RESUMEN EJECUTIVO ════════ */}
            {tab==="resumen" && kpis && (
              <section className="space-y-5">
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                  <KpiCard label="Ventas del Mes"   value={`$${fmt(kpis.ventas)}`}
                    badge={kpis.variacion_pct!==null ? `${kpis.variacion_pct>=0?"▲":"▼"} ${Math.abs(kpis.variacion_pct)}% vs ant.` : undefined}
                    badgeColor={kpis.variacion_pct!==null&&kpis.variacion_pct<0?"text-red-300":"text-emerald-300"}
                    color="text-emerald-300"
                    icon={<AttachMoneyIcon sx={{fontSize:18}}/>}/>
                  <KpiCard label="Mes Anterior"     value={`$${fmt(kpis.ventas_anterior)}`}   color="text-gray-300"   icon={<CalendarMonthIcon sx={{fontSize:18}}/>}/>
                  <KpiCard label="Unidades"          value={fmtI(kpis.unidades)}               color="text-blue-300"   icon={<Inventory2Icon sx={{fontSize:18}}/>}/>
                  <KpiCard label="Pedidos"           value={fmtI(kpis.pedidos)}                color="text-purple-300" icon={<ReceiptIcon sx={{fontSize:18}}/>}/>
                  <KpiCard label="Clientes Activos"  value={fmtI(kpis.clientes_activos)}       color="text-amber-300"  icon={<PeopleIcon sx={{fontSize:18}}/>}/>
                  <KpiCard label="Margen Bruto"      value={`$${fmt(kpis.margen)}`}
                    sub={kpis.ventas>0?`${Math.round((kpis.margen/kpis.ventas)*100)}% sobre ventas`:undefined}
                    color="text-emerald-300" icon={<TrendingUpIcon sx={{fontSize:18}}/>}/>
                </div>

                {/* Proyección rápida */}
                {proyeccion && (
                  <div className="bg-gradient-to-br from-[#012E24] to-[#013d30] border border-emerald-500/20 rounded-2xl p-5">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <InsightsIcon sx={{fontSize:14,color:"#9ca3af"}}/>
                          <p className="text-[10px] uppercase tracking-widest text-gray-400">Proyección al Cierre del Mes</p>
                        </div>
                        <p className="text-4xl font-extrabold text-emerald-300">{fmtK(proyeccion.proyeccion)}</p>
                        <p className="text-sm text-gray-400 mt-1">
                          Día {proyeccion.dias_transcurridos} de {proyeccion.dias_mes} · Tasa diaria: {fmtK(proyeccion.tasa_diaria)}
                        </p>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        {proyeccion.pct_mes_anterior!==null && (
                          <span className={`text-xl font-extrabold ${proyeccion.pct_mes_anterior>=100?"text-emerald-300":"text-amber-300"}`}>
                            {proyeccion.pct_mes_anterior}% del mes anterior
                          </span>
                        )}
                        <p className="text-xs text-gray-400">Mes ant.: ${fmt(proyeccion.ventas_anterior)}</p>
                      </div>
                    </div>
                    <div className="mt-4">
                      <div className="flex justify-between text-xs text-gray-400 mb-1.5">
                        <span>Progreso del mes</span>
                        <span className="text-white font-bold">{Math.round((proyeccion.dias_transcurridos/proyeccion.dias_mes)*100)}%</span>
                      </div>
                      <div className="h-2.5 bg-white/10 rounded-full overflow-hidden">
                        <div className="h-full rounded-full bg-emerald-500 transition-all"
                          style={{width:`${Math.round((proyeccion.dias_transcurridos/proyeccion.dias_mes)*100)}%`}}/>
                      </div>
                    </div>
                  </div>
                )}

                {/* Alertas rápidas */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {cobranza && (
                    <div className="bg-gradient-to-br from-[#012E24] to-[#013d30] border border-red-500/30 rounded-xl p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <AccountBalanceIcon sx={{fontSize:14,color:"#fca5a5"}}/>
                        <p className="text-[10px] uppercase tracking-widest text-red-300">Cartera por Cobrar</p>
                      </div>
                      <p className="text-2xl font-extrabold text-red-300">${fmt(cobranza.resumen.total_cartera)}</p>
                      <div className="mt-3 space-y-1.5 text-xs">
                        <div className="flex justify-between items-center">
                          <span className="text-red-400 flex items-center gap-1"><ErrorOutlineIcon sx={{fontSize:12}}/> Críticos (&gt;45d)</span>
                          <span className="font-bold text-red-300">{cobranza.resumen.clientes_criticos}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-amber-400 flex items-center gap-1"><WarningAmberIcon sx={{fontSize:12}}/> En alerta (&gt;20d)</span>
                          <span className="font-bold text-amber-300">{cobranza.resumen.clientes_alerta}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-emerald-400 flex items-center gap-1"><CheckCircleOutlineIcon sx={{fontSize:12}}/> Al día</span>
                          <span className="font-bold text-emerald-300">{cobranza.resumen.clientes_ok}</span>
                        </div>
                      </div>
                    </div>
                  )}
                  {riesgo && (
                    <div className="bg-gradient-to-br from-[#012E24] to-[#013d30] border border-amber-500/30 rounded-xl p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <PersonOffIcon sx={{fontSize:14,color:"#fcd34d"}}/>
                        <p className="text-[10px] uppercase tracking-widest text-amber-300">Clientes en Riesgo</p>
                      </div>
                      <p className="text-2xl font-extrabold text-amber-300">{riesgo.resumen.perdidos+riesgo.resumen.en_riesgo+riesgo.resumen.en_alerta}</p>
                      <div className="mt-3 space-y-1.5 text-xs">
                        <div className="flex justify-between items-center">
                          <span className="text-red-400 flex items-center gap-1"><ErrorOutlineIcon sx={{fontSize:12}}/> Perdidos (&gt;60d)</span>
                          <span className="font-bold text-red-300">{riesgo.resumen.perdidos}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-amber-400 flex items-center gap-1"><WarningAmberIcon sx={{fontSize:12}}/> En riesgo (&gt;30d)</span>
                          <span className="font-bold text-amber-300">{riesgo.resumen.en_riesgo}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-yellow-400 flex items-center gap-1"><NotificationsActiveIcon sx={{fontSize:12}}/> En alerta (30d)</span>
                          <span className="font-bold text-yellow-300">{riesgo.resumen.en_alerta}</span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Clientes nuevos vs recurrentes */}
                {nuevos && nuevos.tendencia.length > 0 && (
                  <div className="bg-gradient-to-br from-[#012E24] to-[#013d30] border border-[#046C5E]/30 rounded-2xl p-4">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-4 gap-2">
                      <div className="flex items-center gap-2">
                        <PeopleIcon sx={{fontSize:14,color:"#9ca3af"}}/>
                        <p className="text-xs uppercase tracking-widest text-gray-400">Clientes Nuevos vs Recurrentes (últimos 6 meses)</p>
                      </div>
                      <div className="flex gap-4 text-xs">
                        <span className="flex items-center gap-1.5"><RadioButtonCheckedIcon sx={{fontSize:12,color:"#34d399"}}/><span className="text-gray-300">Nuevos: <b className="text-white">{nuevos.resumen.nuevos}</b></span></span>
                        <span className="flex items-center gap-1.5"><RadioButtonCheckedIcon sx={{fontSize:12,color:"#60a5fa"}}/><span className="text-gray-300">Recurrentes: <b className="text-white">{nuevos.resumen.recurrentes}</b></span></span>
                      </div>
                    </div>
                    <ResponsiveContainer width="100%" height={180}>
                      <AreaChart data={nuevos.tendencia} margin={{top:0,right:10,left:0,bottom:0}}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#046C5E22"/>
                        <XAxis dataKey="label" tick={{fill:"#9ca3af",fontSize:10}}/>
                        <YAxis tick={{fill:"#9ca3af",fontSize:10}}/>
                        <Tooltip contentStyle={{background:"#012E24",border:"1px solid #046C5E55",borderRadius:8,fontSize:12}}/>
                        <Area type="monotone" dataKey="recurrentes" name="Recurrentes" stackId="1" stroke="#60a5fa" fill="#60a5fa33"/>
                        <Area type="monotone" dataKey="nuevos"      name="Nuevos"      stackId="1" stroke="#34d399" fill="#34d39933"/>
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                )}

                {/* Top 5 productos */}
                {productos.length > 0 && (
                  <div className="bg-gradient-to-br from-[#012E24] to-[#013d30] border border-[#046C5E]/30 rounded-2xl p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <Inventory2Icon sx={{fontSize:14,color:"#9ca3af"}}/>
                      <p className="text-xs uppercase tracking-widest text-gray-400">Top 5 Productos del Mes</p>
                    </div>
                    <div className="space-y-2">
                      {productos.slice(0,5).map((p,i)=>(
                        <div key={i} className="flex items-center justify-between text-xs">
                          <div className="flex items-center gap-2 flex-1 min-w-0">
                            <span className="text-gray-500 w-4 shrink-0 font-bold">{i+1}</span>
                            <div className="min-w-0">
                              <span className="text-white font-semibold truncate block">{p.producto}</span>
                              <span className="text-gray-500 text-[10px]">{p.categoria}</span>
                            </div>
                          </div>
                          <div className="flex items-center gap-4 shrink-0 ml-2">
                            <span className="text-gray-400">{fmtI(Number(p.unidades))} u</span>
                            <span className="text-white font-bold">${fmt(Number(p.ventas_total))}</span>
                            <span className={`font-bold w-12 text-right ${Number(p.margen_pct)>=20?"text-emerald-400":"text-amber-400"}`}>{Number(p.margen_pct).toFixed(1)}%</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </section>
            )}

            {/* ════════ PROYECCIÓN ════════ */}
            {tab==="proyeccion" && proyeccion && (
              <section className="space-y-5">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <KpiCard label="Ventas Actuales"   value={`$${fmt(proyeccion.ventas_actual)}`}  color="text-white"       icon={<AttachMoneyIcon sx={{fontSize:18}}/>}/>
                  <KpiCard label="Proyección Cierre" value={fmtK(proyeccion.proyeccion)}           color="text-emerald-300" icon={<InsightsIcon sx={{fontSize:18}}/>}
                    badge={proyeccion.pct_mes_anterior!==null?`${proyeccion.pct_mes_anterior}% vs mes ant.`:undefined}
                    badgeColor={proyeccion.pct_mes_anterior!==null&&proyeccion.pct_mes_anterior>=100?"text-emerald-300":"text-amber-300"}/>
                  <KpiCard label="Tasa Diaria"       value={fmtK(proyeccion.tasa_diaria)}          color="text-blue-300"    icon={<SpeedIcon sx={{fontSize:18}}/>}/>
                  <KpiCard label="Mes Anterior"      value={`$${fmt(proyeccion.ventas_anterior)}`} color="text-gray-300"    icon={<CalendarMonthIcon sx={{fontSize:18}}/>}/>
                </div>

                <div className="bg-gradient-to-br from-[#012E24] to-[#013d30] border border-emerald-500/20 rounded-2xl p-6">
                  <div className="flex items-center gap-2 mb-6">
                    <InsightsIcon sx={{fontSize:14,color:"#9ca3af"}}/>
                    <p className="text-[10px] uppercase tracking-widest text-gray-400">Avance del mes — día {proyeccion.dias_transcurridos} de {proyeccion.dias_mes}</p>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 text-center">
                    <div>
                      <p className="text-gray-400 text-xs mb-1">Facturado hasta hoy</p>
                      <p className="text-3xl font-extrabold text-white">${fmt(proyeccion.ventas_actual)}</p>
                    </div>
                    <div className="border-x border-[#046C5E]/30">
                      <p className="text-gray-400 text-xs mb-1">Proyección al cierre</p>
                      <p className="text-3xl font-extrabold text-emerald-300">{fmtK(proyeccion.proyeccion)}</p>
                    </div>
                    <div>
                      <p className="text-gray-400 text-xs mb-1">Falta para cerrar el mes</p>
                      <p className="text-3xl font-extrabold text-blue-300">
                        {proyeccion.proyeccion>proyeccion.ventas_actual
                          ? fmtK(proyeccion.proyeccion-proyeccion.ventas_actual)
                          : "Superado"}
                      </p>
                    </div>
                  </div>
                  <div className="mt-6">
                    <div className="flex justify-between text-xs text-gray-400 mb-1.5">
                      <span>Progreso temporal del mes</span>
                      <span className="text-white font-bold">{Math.round((proyeccion.dias_transcurridos/proyeccion.dias_mes)*100)}%</span>
                    </div>
                    <div className="h-4 bg-white/10 rounded-full overflow-hidden">
                      <div className="h-full rounded-full bg-emerald-500 transition-all flex items-center justify-end pr-2"
                        style={{width:`${Math.round((proyeccion.dias_transcurridos/proyeccion.dias_mes)*100)}%`}}>
                        <span className="text-[9px] font-bold text-white">Día {proyeccion.dias_transcurridos}</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <KpiCard label="Pedidos del Mes"  value={fmtI(proyeccion.pedidos_actual)}   color="text-purple-300" icon={<ReceiptIcon sx={{fontSize:18}}/>}/>
                  <KpiCard label="Clientes Activos" value={fmtI(proyeccion.clientes_actual)}  color="text-amber-300"  icon={<PeopleIcon sx={{fontSize:18}}/>}/>
                  <KpiCard label="Ticket Promedio"
                    value={proyeccion.pedidos_actual>0?`$${fmt(proyeccion.ventas_actual/proyeccion.pedidos_actual)}`:"—"}
                    color="text-blue-300" icon={<StorefrontIcon sx={{fontSize:18}}/>}/>
                </div>
              </section>
            )}

            {/* ════════ COBRANZA ════════ */}
            {tab==="cobranza" && cobranza && (
              <section className="space-y-4">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <KpiCard label="Total Cartera"     value={`$${fmt(cobranza.resumen.total_cartera)}`}  color="text-red-300"     icon={<AccountBalanceIcon sx={{fontSize:18}}/>}/>
                  <KpiCard label="Clientes Críticos" value={String(cobranza.resumen.clientes_criticos)} color="text-red-300"     icon={<ErrorOutlineIcon sx={{fontSize:18}}/>} sub="> 45 días vencido"/>
                  <KpiCard label="En Alerta"         value={String(cobranza.resumen.clientes_alerta)}   color="text-amber-300"   icon={<WarningAmberIcon sx={{fontSize:18}}/>} sub="> 20 días vencido"/>
                  <KpiCard label="Al Día"            value={String(cobranza.resumen.clientes_ok)}       color="text-emerald-300" icon={<CheckCircleOutlineIcon sx={{fontSize:18}}/>}/>
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
                              className={`${r.estado==="CRITICO"?"bg-red-900/20":i%2===0?"bg-[#013d32]":"bg-[#014f3e]"} hover:bg-[#016a57] transition`}>
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
            )}

            {/* ════════ VENDEDORES ════════ */}
            {tab==="vendedores" && (
              <section className="space-y-4">
                <div className="flex items-center gap-2">
                  <EmojiEventsIcon sx={{fontSize:14,color:"#9ca3af"}}/>
                  <p className="text-xs text-gray-400 uppercase tracking-widest">Eficiencia de Vendedores — {MESES_LABEL[mes]} {anio}</p>
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
                              className={`${i===0?"bg-amber-900/20 border-l-2 border-amber-500":i%2===0?"bg-[#013d32]":"bg-[#014f3e]"} hover:bg-[#016a57] transition`}>
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

            {/* ════════ TOP CLIENTES ════════ */}
            {tab==="clientes" && (
              <section className="space-y-4">
                <div className="flex items-center gap-2">
                  <PeopleIcon sx={{fontSize:14,color:"#9ca3af"}}/>
                  <p className="text-xs text-gray-400 uppercase tracking-widest">Top Clientes por Ventas — {MESES_LABEL[mes]} {anio}</p>
                </div>
                {ranking.length>0 && (
                  <div className="bg-gradient-to-br from-[#012E24] to-[#013d30] border border-[#046C5E]/30 rounded-2xl p-4">
                    <ResponsiveContainer width="100%" height={220}>
                      <BarChart data={ranking.slice(0,10)} layout="vertical" margin={{top:0,right:20,left:120,bottom:0}}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#046C5E22" horizontal={false}/>
                        <XAxis type="number" tick={{fill:"#9ca3af",fontSize:10}} tickFormatter={v=>fmtK(v)}/>
                        <YAxis type="category" dataKey="nombre_cliente" tick={{fill:"#9ca3af",fontSize:10}} width={115}/>
                        <Tooltip content={<TipDol/>}/>
                        <Bar dataKey="ventas_total" name="Ventas" radius={[0,4,4,0]}>
                          {ranking.slice(0,10).map((_,i)=><Cell key={i} fill={COLORS[i%COLORS.length]}/>)}
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
                          <th className="px-3 py-3 text-left">Cliente</th>
                          <th className="px-3 py-3 text-left">Tipo</th>
                          <th className="px-3 py-3 text-right">Ventas $</th>
                          <th className="px-3 py-3 text-right">Unidades</th>
                          <th className="px-3 py-3 text-right">Pedidos</th>
                          <th className="px-3 py-3 text-right">Ticket Prom.</th>
                          <th className="px-3 py-3 text-right">Margen $</th>
                        </tr>
                      </thead>
                      <tbody>
                        {ranking.length===0
                          ? <tr><td colSpan={8} className="text-center py-12 text-gray-400">Sin datos.</td></tr>
                          : ranking.map((c,i)=>(
                            <tr key={c.customer_code||i}
                              className={`${i===0?"bg-amber-900/20 border-l-2 border-amber-500":i%2===0?"bg-[#013d32]":"bg-[#014f3e]"} hover:bg-[#016a57] transition`}>
                              <td className="px-3 py-2"><Medalla pos={i}/></td>
                              <td className="px-3 py-2"><p className="font-semibold text-white">{c.nombre_cliente}</p><p className="text-[10px] text-blue-400 font-mono">{c.customer_code}</p>{c.telefono_cliente&&<p className="text-[10px] text-gray-400">{c.telefono_cliente}</p>}</td>
                              <td className="px-3 py-2"><span className="text-[10px] bg-blue-500/20 text-blue-300 border border-blue-500/30 px-2 py-0.5 rounded-full">{c.tipo_negocio}</span></td>
                              <td className="px-3 py-2 text-right font-bold text-emerald-300">${fmt(Number(c.ventas_total))}</td>
                              <td className="px-3 py-2 text-right text-blue-300">{fmtI(Number(c.unidades_total))}</td>
                              <td className="px-3 py-2 text-right text-white">{c.num_pedidos}</td>
                              <td className="px-3 py-2 text-right text-gray-300">${fmt(Number(c.ticket_promedio))}</td>
                              <td className="px-3 py-2 text-right text-emerald-300">${fmt(Number(c.margen_total))}</td>
                            </tr>
                          ))
                        }
                      </tbody>
                    </table>
                  </div>
                </div>
              </section>
            )}

            {/* ════════ RIESGO DE FUGA ════════ */}
            {tab==="riesgo" && riesgo && (
              <section className="space-y-4">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <KpiCard label="Clientes Perdidos" value={String(riesgo.resumen.perdidos)}   color="text-red-300"     icon={<ErrorOutlineIcon sx={{fontSize:18}}/>} sub="> 60 días sin comprar"/>
                  <KpiCard label="En Riesgo"         value={String(riesgo.resumen.en_riesgo)}  color="text-amber-300"   icon={<WarningAmberIcon sx={{fontSize:18}}/>} sub="> 30 días sin comprar"/>
                  <KpiCard label="En Alerta"         value={String(riesgo.resumen.en_alerta)}  color="text-yellow-300"  icon={<NotificationsActiveIcon sx={{fontSize:18}}/>} sub="= 30 días sin comprar"/>
                  <KpiCard label="Cartera en Riesgo" value={`$${fmt(riesgo.resumen.cartera_en_riesgo)}`} color="text-red-300" icon={<PaymentsIcon sx={{fontSize:18}}/>}/>
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
                              className={`${c.estado==="PERDIDO"?"bg-red-900/20":c.estado==="RIESGO"?"bg-amber-900/10":i%2===0?"bg-[#013d32]":"bg-[#014f3e]"} hover:bg-[#016a57] transition`}>
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
            )}


            {/* ════════ PRODUCTOS ════════ */}
            {tab==="productos" && (
              <section className="space-y-4">
                <div className="flex items-center gap-2">
                  <Inventory2Icon sx={{fontSize:14,color:"#9ca3af"}}/>
                  <p className="text-xs text-gray-400 uppercase tracking-widest">Top Productos — {MESES_LABEL[mes]} {anio}</p>
                </div>
                {productos.length>0 && (
                  <div className="bg-gradient-to-br from-[#012E24] to-[#013d30] border border-[#046C5E]/30 rounded-2xl p-4">
                    <p className="text-xs text-gray-400 uppercase tracking-widest mb-3">Ventas por Producto (Top 10)</p>
                    <ResponsiveContainer width="100%" height={280}>
                      <BarChart data={productos.slice(0,10)} layout="vertical" margin={{top:0,right:20,left:160,bottom:0}}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#046C5E22" horizontal={false}/>
                        <XAxis type="number" tick={{fill:"#9ca3af",fontSize:10}} tickFormatter={v=>fmtK(v)}/>
                        <YAxis type="category" dataKey="producto" tick={{fill:"#9ca3af",fontSize:10}} width={155}/>
                        <Tooltip content={<TipDol/>}/>
                        <Bar dataKey="ventas_total" name="Ventas" radius={[0,4,4,0]}>
                          {productos.slice(0,10).map((_,i)=><Cell key={i} fill={COLORS[i%COLORS.length]}/>)}
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
                          <th className="px-3 py-3 text-left">Producto</th>
                          <th className="px-3 py-3 text-left">Categoría</th>
                          <th className="px-3 py-3 text-right">Ventas $</th>
                          <th className="px-3 py-3 text-right">Unidades</th>
                          <th className="px-3 py-3 text-right">Margen $</th>
                          <th className="px-3 py-3 text-right">Margen %</th>
                          <th className="px-3 py-3 text-right">Clientes</th>
                          <th className="px-3 py-3 text-right">Precio Prom.</th>
                        </tr>
                      </thead>
                      <tbody>
                        {productos.length===0
                          ? <tr><td colSpan={9} className="text-center py-12 text-gray-400">Sin datos de productos.</td></tr>
                          : productos.map((p,i)=>(
                            <tr key={p.codigo_producto||i}
                              className={`${i%2===0?"bg-[#013d32]":"bg-[#014f3e]"} hover:bg-[#016a57] transition`}>
                              <td className="px-3 py-2 text-gray-400 text-xs">{i+1}</td>
                              <td className="px-3 py-2"><p className="font-semibold text-white max-w-[200px] truncate">{p.producto}</p><p className="text-[10px] text-blue-400 font-mono">{p.codigo_producto}</p></td>
                              <td className="px-3 py-2"><span className="text-[10px] bg-purple-500/20 text-purple-300 border border-purple-500/30 px-2 py-0.5 rounded-full">{p.categoria}</span></td>
                              <td className="px-3 py-2 text-right font-bold text-emerald-300">${fmt(Number(p.ventas_total))}</td>
                              <td className="px-3 py-2 text-right text-blue-300">{fmtI(Number(p.unidades))}</td>
                              <td className="px-3 py-2 text-right text-emerald-300">${fmt(Number(p.margen_total))}</td>
                              <td className="px-3 py-2 text-right"><span className={`font-bold ${Number(p.margen_pct)>=20?"text-emerald-400":Number(p.margen_pct)>=10?"text-amber-400":"text-red-400"}`}>{Number(p.margen_pct).toFixed(1)}%</span></td>
                              <td className="px-3 py-2 text-right text-gray-300">{p.num_clientes}</td>
                              <td className="px-3 py-2 text-right text-gray-300">${Number(p.precio_promedio).toFixed(4)}</td>
                            </tr>
                          ))
                        }
                      </tbody>
                    </table>
                  </div>
                </div>
              </section>
            )}

            {/* ════════ MÁRGENES ════════ */}
            {tab==="margen" && margen && (
              <section className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <KpiCard label="Ventas Totales"  value={`$${fmt(margen.resumen.totalVentas)}`} color="text-white"       icon={<AttachMoneyIcon sx={{fontSize:18}}/>}/>
                  <KpiCard label="Margen Bruto"    value={`$${fmt(margen.resumen.totalMargen)}`} color="text-emerald-300" icon={<TrendingUpIcon sx={{fontSize:18}}/>}/>
                  <KpiCard label="% Margen Global" value={`${margen.resumen.margenGlobal}%`}
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
            )}
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
