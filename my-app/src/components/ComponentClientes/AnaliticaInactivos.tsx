import React, { useEffect, useState } from "react";
import { LineChart as LineChartIcon, ChevronDown, ChevronUp } from "lucide-react";
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, CartesianGrid } from "recharts";
import { API_BASE_URL } from "../../config";
import { fetchAuth } from "../../utils/fetchAuth";

type CohorteRow = {
  mes: string;
  nuevos: number;
  retenidos_30d: number;
  retenidos_60d: number;
  retenidos_90d: number;
  pct_30d: number;
  pct_60d: number;
  pct_90d: number;
};

type TendenciaRow = {
  mes: string;
  activos: number;
  en_riesgo: number;
  inactivos: number;
};

const num = (n = 0) => Number(n).toLocaleString("es-EC");

export default function AnaliticaInactivos() {
  const [expandido, setExpandido] = useState(false);
  const [cohorte, setCohorte] = useState<CohorteRow[]>([]);
  const [tendencia, setTendencia] = useState<TendenciaRow[]>([]);
  const [cargando, setCargando] = useState(false);
  const [tab, setTab] = useState<"tendencia" | "cohorte">("tendencia");

  useEffect(() => {
    if (!expandido) return;
    const ctrl = new AbortController();
    (async () => {
      setCargando(true);
      try {
        const [r1, r2] = await Promise.all([
          fetchAuth(`${API_BASE_URL}/api/dashboard-clientes/cohorte-retencion?meses=6`, { signal: ctrl.signal }),
          fetchAuth(`${API_BASE_URL}/api/dashboard-clientes/tendencia-inactivos?meses=6`, { signal: ctrl.signal }),
        ]);
        const j1 = await r1.json();
        const j2 = await r2.json();
        if (j1.ok) setCohorte(j1.data || []);
        if (j2.ok) setTendencia(j2.data || []);
      } catch (e: any) {
        if (e?.name !== "AbortError") console.error("Error analitica:", e);
      } finally {
        setCargando(false);
      }
    })();
    return () => ctrl.abort();
  }, [expandido]);

  // return (
  //   <div className="mb-6 bg-gradient-to-br from-[#1a1f2c] via-[#0f1620] to-[#012E24] border border-violet-500/30 rounded-2xl shadow-2xl overflow-hidden">
  //     <div className="px-4 md:px-6 py-4 flex flex-wrap items-center justify-between gap-3 border-b border-violet-500/20 bg-gradient-to-r from-violet-900/30 to-transparent">
  //       <div className="flex items-center gap-3 min-w-0">
  //         <div className="bg-violet-500/20 border border-violet-500/40 rounded-xl p-2 shrink-0">
  //           <LineChartIcon className="text-violet-400" size={22}/>
  //         </div>
  //         <div>
  //           <h2 className="text-base md:text-lg font-bold text-white">Analítica histórica</h2>
  //           <p className="text-[11px] md:text-xs text-white/60">
  //             Tendencia de activos vs inactivos · Cohortes de retención por mes
  //           </p>
  //         </div>
  //       </div>
  //       <button onClick={() => setExpandido(o => !o)}
  //         className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 text-xs flex items-center gap-1.5 text-white/70 hover:text-white transition-colors">
  //         {expandido ? <>Ocultar <ChevronUp size={14} /></> : <>Ver <ChevronDown size={14} /></>}
  //       </button>
  //     </div>

  //     {expandido && (
  //       <div className="p-4 md:p-6 space-y-4">
  //         <div className="flex gap-2">
  //           <button onClick={() => setTab("tendencia")}
  //             className={`px-3 py-1.5 rounded-lg text-xs font-medium border-b-2 transition-all ${
  //               tab === "tendencia" ? "border-violet-400 text-violet-200 bg-white/5" : "border-transparent text-white/50 hover:text-white"
  //             }`}>
  //             Tendencia mensual
  //           </button>
  //           <button onClick={() => setTab("cohorte")}
  //             className={`px-3 py-1.5 rounded-lg text-xs font-medium border-b-2 transition-all ${
  //               tab === "cohorte" ? "border-violet-400 text-violet-200 bg-white/5" : "border-transparent text-white/50 hover:text-white"
  //             }`}>
  //             Cohorte de retención
  //           </button>
  //         </div>

  //         {cargando ? (
  //           <p className="text-center text-white/40 italic py-8">Cargando analítica…</p>
  //         ) : tab === "tendencia" ? (
  //           <TendenciaChart data={tendencia} />
  //         ) : (
  //           <CohorteTabla data={cohorte} />
  //         )}
  //       </div>
  //     )}
  //   </div>
  // );
}

function TendenciaChart({ data }: { data: TendenciaRow[] }) {
  if (data.length === 0) return <p className="text-center text-white/40 italic py-8">Sin datos en el período</p>;
  return (
    <div>
      <p className="text-[11px] text-white/60 mb-3">
        Evolución mensual: clientes <span className="text-emerald-300">activos</span> (compraron en últimos 30d),
        <span className="text-yellow-300"> en riesgo</span> (31-60d sin comprar) e
        <span className="text-red-300"> inactivos</span> (60d+ sin comprar).
      </p>
      <div style={{ width: "100%", height: 320 }}>
        <ResponsiveContainer>
          <LineChart data={data} margin={{ top: 10, right: 20, bottom: 10, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)"/>
            <XAxis dataKey="mes" stroke="#999" fontSize={11}/>
            <YAxis stroke="#999" fontSize={11}/>
            <Tooltip contentStyle={{ background: "#012E24", border: "1px solid #046C5E", borderRadius: 8, color: "#fff", fontSize: 12 }}/>
            <Legend wrapperStyle={{ fontSize: 12 }}/>
            <Line type="monotone" dataKey="activos"   stroke="#10b981" strokeWidth={2} name="Activos"/>
            <Line type="monotone" dataKey="en_riesgo" stroke="#f59e0b" strokeWidth={2} name="En riesgo"/>
            <Line type="monotone" dataKey="inactivos" stroke="#ef4444" strokeWidth={2} name="Inactivos"/>
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function CohorteTabla({ data }: { data: CohorteRow[] }) {
  if (data.length === 0) return <p className="text-center text-white/40 italic py-8">Sin datos</p>;
  return (
    <div>
      <p className="text-[11px] text-white/60 mb-3">
        Por cada cohorte (mes en que el cliente hizo su primera compra), muestra el % que volvió a comprar dentro de 30/60/90 días.
        Más alto es mejor.
      </p>
      <div style={{ width: "100%", height: 280 }} className="mb-4">
        <ResponsiveContainer>
          <BarChart data={data} margin={{ top: 10, right: 20, bottom: 10, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)"/>
            <XAxis dataKey="mes" stroke="#999" fontSize={11}/>
            <YAxis stroke="#999" fontSize={11} unit="%"/>
            <Tooltip contentStyle={{ background: "#012E24", border: "1px solid #046C5E", borderRadius: 8, color: "#fff", fontSize: 12 }}/>
            <Legend wrapperStyle={{ fontSize: 12 }}/>
            <Bar dataKey="pct_30d" fill="#10b981" name="% retenidos 30d"/>
            <Bar dataKey="pct_60d" fill="#3b82f6" name="% retenidos 60d"/>
            <Bar dataKey="pct_90d" fill="#8b5cf6" name="% retenidos 90d"/>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="overflow-x-auto rounded-xl border border-violet-500/20">
        <table className="min-w-full text-sm">
          <thead className="bg-violet-900/20 text-violet-200 uppercase text-[10px] tracking-wider">
            <tr>
              <th className="px-3 py-2 text-left">Cohorte</th>
              <th className="px-3 py-2 text-right">Nuevos</th>
              <th className="px-3 py-2 text-right">30d</th>
              <th className="px-3 py-2 text-right">% 30d</th>
              <th className="px-3 py-2 text-right">60d</th>
              <th className="px-3 py-2 text-right">% 60d</th>
              <th className="px-3 py-2 text-right">90d</th>
              <th className="px-3 py-2 text-right">% 90d</th>
            </tr>
          </thead>
          <tbody>
            {data.map((c, i) => (
              <tr key={c.mes} className={`border-t border-violet-500/10 ${i % 2 === 0 ? "bg-black/20" : "bg-black/30"}`}>
                <td className="px-3 py-2 text-white font-mono text-xs">{c.mes}</td>
                <td className="px-3 py-2 text-right text-white">{num(c.nuevos)}</td>
                <td className="px-3 py-2 text-right text-emerald-300/80 text-xs">{num(c.retenidos_30d)}</td>
                <td className="px-3 py-2 text-right text-emerald-300 font-bold">{c.pct_30d}%</td>
                <td className="px-3 py-2 text-right text-blue-300/80 text-xs">{num(c.retenidos_60d)}</td>
                <td className="px-3 py-2 text-right text-blue-300 font-bold">{c.pct_60d}%</td>
                <td className="px-3 py-2 text-right text-violet-300/80 text-xs">{num(c.retenidos_90d)}</td>
                <td className="px-3 py-2 text-right text-violet-300 font-bold">{c.pct_90d}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
