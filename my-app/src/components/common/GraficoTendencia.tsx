// components/common/GraficoTendencia.tsx
// Gráfico de tendencia 12 meses — reutilizable en todos los dashboards
import React, { useMemo } from "react";
import {
  ComposedChart, Area, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer,
} from "recharts";
import { BsCurrencyDollar, BsGraphUpArrow, BsBoxSeam, BsStack } from "react-icons/bs";

export interface PuntoTendencia {
  label: string;
  anio: number;
  mes: number;
  dolares: number;
  unidades: number;
  proyeccion?: number;
}

interface Props {
  datos: PuntoTendencia[];
  subtitulo?: string;
}

/* ── Tooltip ─────────────────────────────────────────────── */
const TooltipTendencia = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  const dol  = payload.find((p: any) => p.dataKey === "dolares");
  const proy = payload.find((p: any) => p.dataKey === "proyeccion");
  const uni  = payload.find((p: any) => p.dataKey === "unidades");
  const acum = payload.find((p: any) => p.dataKey === "acumulado");
  const esCurrent = proy && proy.value !== dol?.value;
  return (
    <div className="bg-[#010f0c] border border-[#046C5E]/70 rounded-xl px-4 py-3 text-xs text-white shadow-2xl min-w-[180px]">
      <p className="font-bold text-emerald-300 text-sm mb-2">{label}</p>
      {dol && (
        <p className="flex items-center gap-1.5 text-white">
          <BsCurrencyDollar className="text-emerald-400 shrink-0" size={12} />
          <span className="text-gray-400">Real:</span>{" "}
          <span className="font-semibold text-emerald-300">
            ${Number(dol.value).toLocaleString("es-EC", { minimumFractionDigits: 2 })}
          </span>
        </p>
      )}
      {esCurrent && proy && (
        <p className="flex items-center gap-1.5 text-white mt-1">
          <BsGraphUpArrow className="text-yellow-400 shrink-0" size={12} />
          <span className="text-gray-400">Proyección:</span>{" "}
          <span className="font-semibold text-yellow-300">
            ${Number(proy.value).toLocaleString("es-EC", { minimumFractionDigits: 2 })}
          </span>
        </p>
      )}
      {uni && (
        <p className="flex items-center gap-1.5 text-white mt-1">
          <BsBoxSeam className="text-cyan-400 shrink-0" size={12} />
          <span className="text-gray-400">Unidades:</span>{" "}
          <span className="font-semibold text-cyan-300">
            {Number(uni.value).toLocaleString("es-EC")}
          </span>
        </p>
      )}
      {acum && (
        <p className="flex items-center gap-1.5 text-white mt-1 pt-1 border-t border-[#046C5E]/40">
          <BsStack className="text-violet-400 shrink-0" size={12} />
          <span className="text-gray-400">Acumulado:</span>{" "}
          <span className="font-semibold text-violet-300">
            ${Number(acum.value).toLocaleString("es-EC", { minimumFractionDigits: 2 })}
          </span>
        </p>
      )}
    </div>
  );
};

/* ── Dot con pulso SVG animado ───────────────────────────── */
const PulsingDot = (props: any) => {
  const { cx, cy, payload, color, mesActual, anioActual } = props;
  if (!cx || !cy) return null;
  const esCurrent = payload.mes === mesActual && payload.anio === anioActual;
  if (esCurrent) {
    return (
      <g>
        <circle cx={cx} cy={cy} r={14} fill={color} fillOpacity={0.08}>
          <animate attributeName="r" values="10;18;10" dur="2.4s" repeatCount="indefinite" />
          <animate attributeName="fill-opacity" values="0.12;0.03;0.12" dur="2.4s" repeatCount="indefinite" />
        </circle>
        <circle cx={cx} cy={cy} r={7} fill={color} fillOpacity={0.22}>
          <animate attributeName="r" values="6;10;6" dur="2.4s" repeatCount="indefinite" />
          <animate attributeName="fill-opacity" values="0.25;0.08;0.25" dur="2.4s" repeatCount="indefinite" />
        </circle>
        <circle cx={cx} cy={cy} r={4.5} fill={color} stroke="#010f0c" strokeWidth={2} />
      </g>
    );
  }
  return <circle cx={cx} cy={cy} r={3} fill={color} fillOpacity={0.85} stroke="#010f0c" strokeWidth={1.5} />;
};

/* ── Dot proyección — solo visible en mes actual ─────────── */
const ProyeccionDot = (props: any) => {
  const { cx, cy, payload, mesActual, anioActual } = props;
  if (!cx || !cy) return null;
  const esCurrent = payload.mes === mesActual && payload.anio === anioActual;
  if (!esCurrent) return null;
  return (
    <g>
      <circle cx={cx} cy={cy} r={12} fill="#fbbf24" fillOpacity={0.1}>
        <animate attributeName="r" values="8;16;8" dur="2.8s" repeatCount="indefinite" />
        <animate attributeName="fill-opacity" values="0.12;0.04;0.12" dur="2.8s" repeatCount="indefinite" />
      </circle>
      <circle cx={cx} cy={cy} r={5} fill="#fbbf24" stroke="#010f0c" strokeWidth={2} />
    </g>
  );
};

/* ── Componente principal ────────────────────────────────── */
const GraficoTendencia: React.FC<Props> = ({ datos, subtitulo }) => {
  if (!datos || datos.length === 0) return null;

  const hoy = new Date();
  const mesActual  = hoy.getMonth() + 1;
  const anioActual = hoy.getFullYear();

  /* ── Calcular acumulado YTD (se reinicia en enero de cada año) ── */
  const dataConAcumulado = useMemo(() => {
    let acum = 0;
    let lastAnio = -1;
    return datos.map(d => {
      if (d.anio !== lastAnio) {
        acum = 0;
        lastAnio = d.anio;
      }
      const valorMes = (d.proyeccion != null && d.proyeccion !== d.dolares)
        ? d.proyeccion
        : d.dolares;
      acum = Number((acum + valorMes).toFixed(2));
      return { ...d, acumulado: acum };
    });
  }, [datos]);

  const maxRef = Math.max(...dataConAcumulado.map(d => Math.max(d.dolares, d.proyeccion ?? d.dolares)));
  const maxAcum = Math.max(...dataConAcumulado.map(d => d.acumulado ?? 0));
  const maxUni  = Math.max(...datos.map(d => d.unidades));

  // Punto actual para mostrar KPI rápido en header
  const puntoActual = dataConAcumulado.find(d => d.mes === mesActual && d.anio === anioActual);
  const tieneProyeccion = puntoActual && puntoActual.proyeccion != null && puntoActual.proyeccion !== puntoActual.dolares;

  return (
    <div className="bg-gradient-to-br from-[#011f1a] to-[#012E24] border border-[#046C5E]/30 rounded-2xl p-5 mb-6 shadow-xl overflow-hidden">

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-4">
        <div>
          <p className="text-sm font-semibold text-white tracking-wide">Evolución de Ventas</p>
          <p className="text-[11px] text-gray-500 mt-0.5">{subtitulo ?? "Últimos 12 meses"}</p>
        </div>

        <div className="flex items-center gap-3 flex-wrap text-[10px]">
          {tieneProyeccion && (
            <div className="flex items-center gap-2 bg-yellow-400/10 border border-yellow-400/20 rounded-lg px-3 py-1.5">
              <span className="text-yellow-300 font-bold text-xs">
                Proy: ${((puntoActual!.proyeccion ?? 0) / 1000).toFixed(1)}k
              </span>
              <span className="text-gray-500">·</span>
              <span className="text-gray-400">
                Real: ${((puntoActual!.dolares) / 1000).toFixed(1)}k
              </span>
              <span className="text-gray-500">·</span>
              <span className="text-cyan-400 text-xs">
                {puntoActual!.unidades >= 1000
                  ? `${(puntoActual!.unidades / 1000).toFixed(1)}k`
                  : puntoActual!.unidades} u
              </span>
              <span className="text-gray-500">·</span>
              <span className="text-violet-400 text-xs font-bold">
                Acum: ${((puntoActual!.acumulado ?? 0) / 1000).toFixed(1)}k
              </span>
            </div>
          )}
          <span className="flex items-center gap-1.5 text-emerald-400">
            <span className="w-3 h-0.5 bg-emerald-400 rounded-full inline-block" />
            Real $
          </span>
          <span className="flex items-center gap-1.5 text-yellow-400">
            <span className="w-3 h-0.5 border-t-2 border-dashed border-yellow-400 inline-block" />
            Proyección
          </span>
          <span className="flex items-center gap-1.5 text-cyan-400">
            <span className="w-3 h-0.5 bg-cyan-400 rounded-full inline-block" />
            Unidades
          </span>
          <span className="flex items-center gap-1.5 text-violet-400">
            <span className="w-3 h-0.5 bg-violet-400 rounded-full inline-block" />
            Acumulado
          </span>
        </div>
      </div>

      {/* Chart */}
      <ResponsiveContainer width="100%" height={220}>
        <ComposedChart data={dataConAcumulado} margin={{ top: 16, right: 52, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="gradDolaresShared" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%"   stopColor="#34d399" stopOpacity={0.28} />
              <stop offset="100%" stopColor="#34d399" stopOpacity={0.02} />
            </linearGradient>
          </defs>

          <CartesianGrid strokeDasharray="4 4" stroke="#046C5E15" vertical={false} />
          <XAxis
            dataKey="label"
            tick={{ fill: "#6b7280", fontSize: 11 }}
            axisLine={false} tickLine={false}
          />
          {/* Eje izquierdo: dólares mensuales */}
          <YAxis
            yAxisId="dol"
            tick={{ fill: "#34d399", fontSize: 10 }}
            axisLine={false} tickLine={false}
            tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`}
            width={46}
            domain={[0, (dataMax: number) => Math.ceil(Math.max(dataMax, maxRef) * 1.1 / 1000) * 1000]}
          />
          {/* Eje derecho: unidades */}
          <YAxis
            yAxisId="uni"
            orientation="right"
            tick={{ fill: "#22d3ee", fontSize: 10 }}
            axisLine={false} tickLine={false}
            tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)}
            width={40}
          />
          {/* Eje oculto: acumulado (escala propia) */}
          <YAxis
            yAxisId="acum"
            orientation="right"
            hide={true}
            domain={[0, (dataMax: number) => Math.ceil(Math.max(dataMax, maxAcum) * 1.05 / 1000) * 1000]}
          />

          <Tooltip
            content={<TooltipTendencia />}
            cursor={{ stroke: "#046C5E60", strokeWidth: 1, strokeDasharray: "5 3" }}
          />

          {/* Área dólares reales */}
          <Area
            yAxisId="dol"
            type="monotone"
            dataKey="dolares"
            stroke="#34d399"
            strokeWidth={2.5}
            fill="url(#gradDolaresShared)"
            dot={(p: any) => <PulsingDot {...p} color="#34d399" mesActual={mesActual} anioActual={anioActual} />}
            activeDot={false}
          />

          {/* Línea proyección — solo se separa del real en mes actual */}
          <Line
            yAxisId="dol"
            type="monotone"
            dataKey="proyeccion"
            stroke="#fbbf24"
            strokeWidth={2}
            strokeDasharray="7 4"
            fill="none"
            dot={(p: any) => <ProyeccionDot {...p} mesActual={mesActual} anioActual={anioActual} />}
            activeDot={false}
          />

          {/* Línea unidades */}
          <Line
            yAxisId="uni"
            type="monotone"
            dataKey="unidades"
            stroke="#22d3ee"
            strokeWidth={2}
            strokeDasharray="6 3"
            fill="none"
            dot={(p: any) => <PulsingDot {...p} color="#22d3ee" mesActual={mesActual} anioActual={anioActual} />}
            activeDot={false}
          />

          {/* Línea acumulado YTD */}
          <Line
            yAxisId="acum"
            type="monotone"
            dataKey="acumulado"
            stroke="#a78bfa"
            strokeWidth={2.5}
            fill="none"
            dot={(p: any) => <PulsingDot {...p} color="#a78bfa" mesActual={mesActual} anioActual={anioActual} />}
            activeDot={false}
          />
        </ComposedChart>
      </ResponsiveContainer>

      {/* Strip mensual */}
      <div className="overflow-x-auto -mx-1 px-1 mt-1">
      <div
        className="grid border-t border-[#046C5E]/20 pt-3 gap-1"
        style={{ gridTemplateColumns: `repeat(${dataConAcumulado.length}, minmax(48px, 1fr))` }}
      >
        {dataConAcumulado.map((d) => {
          const esCurrent = d.mes === mesActual && d.anio === anioActual;
          const pctDol  = maxRef > 0 ? Math.round((d.dolares / maxRef) * 100) : 0;
          const pctProy = maxRef > 0 ? Math.round(((d.proyeccion ?? d.dolares) / maxRef) * 100) : 0;
          const pctUni  = maxUni > 0 ? Math.round((d.unidades / maxUni) * 100) : 0;
          const pctAcum = maxAcum > 0 ? Math.round(((d.acumulado ?? 0) / maxAcum) * 100) : 0;
          const hayProy = esCurrent && d.proyeccion != null && d.proyeccion !== d.dolares;
          return (
            <div
              key={`${d.anio}-${d.mes}`}
              className={`flex flex-col items-center gap-1 px-1 py-1.5 rounded-lg transition-all ${
                esCurrent ? "bg-emerald-400/5 border border-emerald-400/15" : ""
              }`}
            >
              {/* Proyección + Real (mes actual) */}
              {hayProy ? (
                <>
                  <span className="text-[10px] font-bold leading-none text-yellow-400">
                    ↑${((d.proyeccion ?? 0) / 1000).toFixed(1)}k
                  </span>
                  <span className="text-[9px] leading-none text-emerald-400">
                    R${(d.dolares / 1000).toFixed(1)}k
                  </span>
                </>
              ) : (
                <span className={`text-[10px] font-bold leading-none ${esCurrent ? "text-emerald-400" : "text-gray-300"}`}>
                  ${(d.dolares / 1000).toFixed(1)}k
                </span>
              )}

              {/* Mini barras */}
              <div className="w-full flex flex-col gap-0.5">
                {/* Real */}
                <div className="w-full bg-[#046C5E]/20 rounded-full h-[3px]">
                  <div
                    className={`h-[3px] rounded-full ${esCurrent ? "bg-emerald-400" : "bg-emerald-700"}`}
                    style={{ width: `${pctDol}%` }}
                  />
                </div>
                {/* Proyección */}
                {hayProy && (
                  <div className="w-full bg-[#046C5E]/20 rounded-full h-[3px]">
                    <div className="h-[3px] rounded-full bg-yellow-400" style={{ width: `${pctProy}%` }} />
                  </div>
                )}
                {/* Unidades */}
                <div className="w-full bg-[#046C5E]/20 rounded-full h-[3px]">
                  <div
                    className={`h-[3px] rounded-full ${esCurrent ? "bg-cyan-400" : "bg-cyan-700"}`}
                    style={{ width: `${pctUni}%` }}
                  />
                </div>
                {/* Acumulado */}
                <div className="w-full bg-[#046C5E]/20 rounded-full h-[3px]">
                  <div
                    className={`h-[3px] rounded-full ${esCurrent ? "bg-violet-400" : "bg-violet-700"}`}
                    style={{ width: `${pctAcum}%` }}
                  />
                </div>
              </div>

              <span className={`text-[9px] leading-none ${esCurrent ? "text-cyan-400" : "text-gray-600"}`}>
                {d.unidades >= 1000 ? `${(d.unidades / 1000).toFixed(1)}k` : d.unidades} u
              </span>
              <span className={`text-[9px] leading-none ${esCurrent ? "text-violet-400" : "text-gray-600"} font-medium`}>
                Σ${(d.acumulado / 1000).toFixed(0)}k
              </span>
              <span className={`text-[9px] leading-none font-medium ${esCurrent ? "text-emerald-500" : "text-gray-600"}`}>
                {d.label}
              </span>
            </div>
          );
        })}
      </div>
      </div>

    </div>
  );
};

export default GraficoTendencia;
