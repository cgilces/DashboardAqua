import React, { useEffect, useState } from "react";
import { Trophy, ChevronDown, ChevronUp, CalendarDays, Inbox, ArrowRight } from "lucide-react";
import { BsDownload } from "react-icons/bs";
import toast from "react-hot-toast";
import { API_BASE_URL } from "../../config";
import { fetchAuth } from "../../utils/fetchAuth";
import { exportExcel } from "../../utils/exportExcel";

type VendedorRow = {
  vendedor: string;
  contactos_total: number;
  clientes_unicos: number;
  contactados: number;
  no_contesta: number;
  prometio: number;
  no_interesado: number;
  recuperados: number;
  consumo_recuperado: number;
  recovery_rate: number;
};

type Totales = Omit<VendedorRow, "vendedor">;

const num = (n = 0) => Number(n).toLocaleString("es-EC");
const fmtD = (d: Date) => d.toISOString().slice(0, 10);
const today = () => fmtD(new Date());
const daysAgo = (d: number) => {
  const t = new Date();
  t.setDate(t.getDate() - d);
  return fmtD(t);
};

const PRESETS = [
  { id: "7d",  label: "7 días",   desde: () => daysAgo(7) },
  { id: "30d", label: "30 días",  desde: () => daysAgo(30) },
  { id: "90d", label: "90 días",  desde: () => daysAgo(90) },
];

// Color del recovery rate
function rateColor(r: number) {
  if (r >= 30) return "text-emerald-300 bg-emerald-500/15 border-emerald-500/40";
  if (r >= 15) return "text-yellow-300 bg-yellow-500/15 border-yellow-500/40";
  return "text-red-300 bg-red-500/15 border-red-500/40";
}

export default function RecoveryRate() {
  const [desde, setDesde] = useState(daysAgo(30));
  const [hasta, setHasta] = useState(today());
  const [vendedores, setVendedores] = useState<VendedorRow[]>([]);
  const [totales, setTotales]       = useState<Totales | null>(null);
  const [cargando, setCargando]     = useState(false);
  const [expandido, setExpandido]   = useState(false); // colapsado por defecto (es analítica)

  useEffect(() => {
    if (!expandido) return;
    const ctrl = new AbortController();
    (async () => {
      setCargando(true);
      try {
        const url = `${API_BASE_URL}/api/dashboard-clientes/recovery-rate?desde=${desde}&hasta=${hasta}`;
        const res = await fetchAuth(url, { signal: ctrl.signal });
        const json = await res.json();
        if (json.ok) {
          setVendedores(json.vendedores || []);
          setTotales(json.totales || null);
        }
      } catch (e: any) {
        if (e?.name !== "AbortError") console.error("Error recovery-rate:", e);
      } finally {
        setCargando(false);
      }
    })();
    return () => ctrl.abort();
  }, [expandido, desde, hasta]);

  // return (
  //   <div className="mb-6 bg-gradient-to-br from-[#0e2a17] via-[#091f10] to-[#012E24] border border-emerald-500/30 rounded-2xl shadow-2xl overflow-hidden">
  //     {/* Header */}
  //     <div className="px-4 md:px-6 py-4 flex flex-wrap items-center justify-between gap-3 border-b border-emerald-500/20 bg-gradient-to-r from-emerald-900/30 to-transparent">
  //       <div className="flex items-center gap-3 min-w-0">
  //         <div className="bg-emerald-500/20 border border-emerald-500/40 rounded-xl p-2 shrink-0">
  //           <Trophy className="text-emerald-400" size={22}/>
  //         </div>
  //         <div className="min-w-0">
  //           <h2 className="text-base md:text-lg font-bold text-white flex items-center gap-2 flex-wrap">
  //             Recovery Rate por Vendedor
  //             {cargando && (
  //               <span className="text-xs text-emerald-400 inline-flex items-center gap-1">
  //                 <span className="w-3 h-3 border-2 border-emerald-400/20 border-t-emerald-400 rounded-full animate-spin"/>
  //                 cargando…
  //               </span>
  //             )}
  //           </h2>
  //           <p className="text-[11px] md:text-xs text-white/60">
  //             Efectividad de gestión: contactos × resultados × vendedor
  //           </p>
  //         </div>
  //       </div>
  //       <div className="flex items-center gap-2">
  //         {expandido && vendedores.length > 0 && (
  //           <button
  //             onClick={() => {
  //               exportExcel("recovery_rate", vendedores.map((v, i) => ({
  //                 "N°": i + 1,
  //                 "Vendedor": v.vendedor,
  //                 "Contactos": v.contactos_total,
  //                 "Clientes únicos": v.clientes_unicos,
  //                 "Contactados": v.contactados,
  //                 "No contesta": v.no_contesta,
  //                 "Prometió": v.prometio,
  //                 "No interesado": v.no_interesado,
  //                 "Recuperados": v.recuperados,
  //                 "Consumo recuperado": v.consumo_recuperado,
  //                 "Recovery rate %": v.recovery_rate,
  //               })), "RecoveryRate");
  //               toast.success(`Exportado ${vendedores.length} vendedores`);
  //             }}
  //             className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-emerald-500/40 bg-emerald-500/15 text-emerald-300 text-xs font-medium hover:bg-emerald-500/25 transition-colors">
  //             <BsDownload size={12}/> Exportar
  //           </button>
  //         )}
  //         <button onClick={() => setExpandido(o => !o)}
  //           className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 text-xs flex items-center gap-1.5 text-white/70 hover:text-white transition-colors">
  //           {expandido ? <>Ocultar <ChevronUp size={14} /></> : <>Ver <ChevronDown size={14} /></>}
  //         </button>
  //       </div>
  //     </div>

  //     {expandido && (
  //       <div className="p-4 md:p-6 space-y-4">
  //         {/* Filtros */}
  //         <div className="flex flex-wrap items-center gap-2">
  //           <span className="text-[10px] uppercase tracking-widest text-white/40 font-semibold mr-1">Período:</span>
  //           {PRESETS.map(p => {
  //             const isActive = desde === p.desde() && hasta === today();
  //             return (
  //               <button key={p.id} onClick={() => { setDesde(p.desde()); setHasta(today()); }}
  //                 className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-all ${
  //                   isActive
  //                     ? "bg-emerald-500/30 border-emerald-500 text-emerald-200"
  //                     : "bg-[#013d32] border-[#046C5E] text-white/50 hover:text-white"
  //                 }`}>
  //                 Últimos {p.label}
  //               </button>
  //             );
  //           })}
  //           <div className="h-6 w-px bg-white/10"/>
  //           <div className="relative">
  //             <CalendarDays size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-white/50 pointer-events-none"/>
  //             <input type="date" value={desde} onChange={e => setDesde(e.target.value)}
  //               className="bg-[#014434] border border-[#046C5E] rounded-lg pl-8 pr-3 py-1.5 text-xs text-white focus:outline-none focus:border-emerald-500/60 [color-scheme:dark]"/>
  //           </div>
  //           <ArrowRight size={14} className="text-white/40"/>
  //           <div className="relative">
  //             <CalendarDays size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-white/50 pointer-events-none"/>
  //             <input type="date" value={hasta} onChange={e => setHasta(e.target.value)}
  //               className="bg-[#014434] border border-[#046C5E] rounded-lg pl-8 pr-3 py-1.5 text-xs text-white focus:outline-none focus:border-emerald-500/60 [color-scheme:dark]"/>
  //           </div>
  //         </div>

  //         {/* Totales */}
  //         {totales && (
  //           <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
  //             <Kpi label="Contactos"           value={num(totales.contactos_total)}      color="text-white"/>
  //             <Kpi label="Clientes únicos"     value={num(totales.clientes_unicos)}      color="text-blue-300"/>
  //             <Kpi label="Recuperados"         value={num(totales.recuperados)}          color="text-emerald-300"/>
  //             <Kpi label="Consumo recuperado"  value={num(totales.consumo_recuperado)}   color="text-yellow-300"/>
  //             <Kpi label="Recovery rate"       value={`${totales.recovery_rate}%`}       color="text-emerald-300" highlight/>
  //           </div>
  //         )}

  //         {/* Tabla */}
  //         {vendedores.length === 0 ? (
  //           <div className="text-center py-8 px-4">
  //             {cargando ? (
  //               <p className="text-white/40 italic text-sm">Cargando…</p>
  //             ) : (totales && totales.contactos_total === 0) ? (
  //               <div className="max-w-md mx-auto space-y-2">
  //                 <p className="text-white/70 text-sm flex items-center justify-center gap-2">
  //                   <Inbox size={16} /> Aún no se ha registrado ningún contacto.
  //                 </p>
  //                 <p className="text-white/50 text-xs leading-relaxed">
  //                   Esta vista mide la efectividad de tu equipo: cuántos clientes contactaron y cuántos terminaron como
  //                   <span className="text-emerald-300 font-semibold"> "Recuperado"</span> o
  //                   <span className="text-yellow-300 font-semibold"> "Consumo recuperado"</span>.
  //                 </p>
  //                 <p className="text-white/50 text-xs leading-relaxed">
  //                   Para empezar a ver datos: usa el botón <span className="text-white font-semibold">"Gestionar"</span> en
  //                   los clientes de las secciones <span className="text-red-300">Recuperación</span> o
  //                   <span className="text-yellow-300"> Declive de Consumo</span>, registra el resultado de la llamada,
  //                   y volverá a aparecer aquí.
  //                 </p>
  //               </div>
  //             ) : (
  //               <p className="text-white/40 italic text-sm">Sin contactos en este rango de fechas (prueba ampliar el período)</p>
  //             )}
  //           </div>
  //         ) : (
  //           <div className="overflow-x-auto rounded-xl border border-emerald-500/20">
  //             <table className="min-w-full text-sm">
  //               <thead className="bg-emerald-900/20 text-emerald-200 uppercase text-[10px] tracking-wider">
  //                 <tr>
  //                   <th className="px-3 py-3 text-left">Vendedor</th>
  //                   <th className="px-3 py-3 text-right">Contactos</th>
  //                   <th className="px-3 py-3 text-right">Clientes</th>
  //                   <th className="px-3 py-3 text-right">No contesta</th>
  //                   <th className="px-3 py-3 text-right">Prometió</th>
  //                   <th className="px-3 py-3 text-right">No interesado</th>
  //                   <th className="px-3 py-3 text-right">Recuperados</th>
  //                   <th className="px-3 py-3 text-right">Consumo recup.</th>
  //                   <th className="px-3 py-3 text-center">Recovery rate</th>
  //                 </tr>
  //               </thead>
  //               <tbody>
  //                 {vendedores.map((v, idx) => (
  //                   <tr key={v.vendedor}
  //                       className={`border-t border-emerald-500/10 ${idx % 2 === 0 ? "bg-black/20" : "bg-black/30"} hover:bg-emerald-500/5`}>
  //                     <td className="px-3 py-2 font-mono text-blue-300 text-xs">@{v.vendedor}</td>
  //                     <td className="px-3 py-2 text-right text-white">{num(v.contactos_total)}</td>
  //                     <td className="px-3 py-2 text-right text-white/70">{num(v.clientes_unicos)}</td>
  //                     <td className="px-3 py-2 text-right text-gray-400">{num(v.no_contesta)}</td>
  //                     <td className="px-3 py-2 text-right text-yellow-300">{num(v.prometio)}</td>
  //                     <td className="px-3 py-2 text-right text-red-300">{num(v.no_interesado)}</td>
  //                     <td className="px-3 py-2 text-right text-emerald-300 font-bold">{num(v.recuperados)}</td>
  //                     <td className="px-3 py-2 text-right text-yellow-300 font-bold">{num(v.consumo_recuperado)}</td>
  //                     <td className="px-3 py-2 text-center">
  //                       <span className={`inline-flex px-2 py-0.5 rounded-md text-xs font-bold border ${rateColor(v.recovery_rate)}`}>
  //                         {v.recovery_rate}%
  //                       </span>
  //                     </td>
  //                   </tr>
  //                 ))}
  //               </tbody>
  //             </table>
  //           </div>
  //         )}
  //       </div>
  //     )}
  //   </div>
  // );
}

function Kpi({ label, value, color, highlight = false }: {
  label: string; value: string; color: string; highlight?: boolean;
}) {
  return (
    <div className={`rounded-xl p-3 border ${highlight ? "bg-emerald-500/10 border-emerald-500/40" : "bg-black/25 border-white/10"}`}>
      <p className="text-[10px] uppercase tracking-widest text-white/50 font-semibold mb-1">{label}</p>
      <p className={`text-lg md:text-xl font-bold ${color} leading-tight`}>{value}</p>
    </div>
  );
}
