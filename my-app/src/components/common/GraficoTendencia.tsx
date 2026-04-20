// components/common/GraficoTendencia.tsx
// Gráfico de tendencia — muestra los últimos 3 meses incluyendo el actual
import React, { useEffect, useMemo, useState } from "react";
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
  anioFiltro?: number;
  mesFiltro?: number;
}

/* ── Helpers de formato ──────────────────────────────────── */
const fmtDol = (v: number) =>
  "$" + v.toLocaleString("es-EC", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const fmtUni = (v: number) =>
  v.toLocaleString("es-EC") + " u";

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
            {fmtDol(Number(dol.value))}
          </span>
        </p>
      )}
      {esCurrent && proy && (
        <p className="flex items-center gap-1.5 text-white mt-1">
          <BsGraphUpArrow className="text-yellow-400 shrink-0" size={12} />
          <span className="text-gray-400">Proyección:</span>{" "}
          <span className="font-semibold text-yellow-300">
            {fmtDol(Number(proy.value))}
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
            {fmtDol(Number(acum.value))}
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

const NOMBRES_MES = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];

/* ── Componente principal ────────────────────────────────── */
const GraficoTendencia: React.FC<Props> = ({ datos, subtitulo, anioFiltro, mesFiltro }) => {
  /* ── Persistencia del estado expandido/colapsado (por subtítulo) ── */
  const storageKey = `graficoTendencia:${subtitulo ?? "default"}:expanded`;
  const [expanded, setExpanded] = useState<boolean>(() => {
    try {
      const v = localStorage.getItem(storageKey);
      return v === null ? true : v === "1";
    } catch { return true; }
  });
  useEffect(() => {
    try { localStorage.setItem(storageKey, expanded ? "1" : "0"); } catch {}
  }, [expanded, storageKey]);

  const hoy = new Date();
  const mesActual  = hoy.getMonth() + 1;
  const anioActual = hoy.getFullYear();

  /* ── Completar el año filtrado con ceros para meses sin ventas ── */
  const datosCompletos = useMemo(() => {
    if (!anioFiltro || !mesFiltro) return datos;

    const rango: PuntoTendencia[] = [];
    for (let m = 1; m <= mesFiltro; m++) {
      rango.push({ label: NOMBRES_MES[m - 1], anio: anioFiltro, mes: m, dolares: 0, unidades: 0 });
    }

    const map = new Map(
      datos
        .filter(d => d.anio === anioFiltro)
        .map(d => [`${d.mes}`, d])
    );
    return rango.map(p => map.get(`${p.mes}`) ?? p);
  }, [datos, anioFiltro, mesFiltro]);

  /* ── Calcular acumulado YTD ── */
  const dataConAcumulado = useMemo(() => {
    let acum = 0;
    let lastAnio = -1;
    return datosCompletos.map(d => {
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
  }, [datosCompletos]);

  /* ── Últimos 3 meses (incluyendo el actual) ── */
  const datos3Meses = useMemo(() => dataConAcumulado.slice(-3), [dataConAcumulado]);

  const maxRef  = Math.max(...datos3Meses.map(d => Math.max(d.dolares, d.proyeccion ?? d.dolares)));
  const maxAcum = Math.max(...datos3Meses.map(d => d.acumulado ?? 0));
  const maxUni  = Math.max(...datos3Meses.map(d => d.unidades));

  const puntoActual     = datos3Meses.find(d => d.mes === mesActual && d.anio === anioActual);
  const tieneProyeccion = puntoActual && puntoActual.proyeccion != null && puntoActual.proyeccion !== puntoActual.dolares;

  if (!datos || datos.length === 0) return null;

  return (
    <div className="bg-gradient-to-br from-[#011f1a] to-[#012E24] border border-[#046C5E]/30 rounded-2xl mb-6 shadow-xl overflow-hidden">

      {/* Header clickeable — siempre visible, alterna expandido/colapsado */}
      <button
        type="button"
        onClick={() => setExpanded(e => !e)}
        className="w-full flex items-center justify-between gap-3 px-5 py-4 hover:bg-[#046C5E]/10 transition-colors group"
        aria-expanded={expanded}
        aria-label={expanded ? "Ocultar gráfico" : "Mostrar gráfico"}
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-emerald-500/20 to-emerald-400/10 border border-emerald-400/20 flex items-center justify-center shrink-0">
            <BsGraphUpArrow className="text-emerald-400" size={16} />
          </div>
          <div className="text-left min-w-0">
            <p className="text-sm font-semibold text-white tracking-wide">Evolución de Ventas</p>
            <p className="text-[11px] text-gray-500 mt-0.5 truncate">
              Últimos 3 meses{subtitulo ? ` · ${subtitulo}` : ""}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {/* Mini KPI visible solo cuando está colapsado */}
          {!expanded && puntoActual && (
            <span className="hidden md:flex items-center gap-2 text-[11px] bg-[#010f0c]/50 border border-[#046C5E]/40 rounded-lg px-2.5 py-1">
              {tieneProyeccion ? (
                <>
                  <span className="text-yellow-300 font-bold">
                    {fmtDol(puntoActual.proyeccion ?? 0)}
                  </span>
                  <span className="text-gray-500 text-[10px] uppercase tracking-wider">proy</span>
                </>
              ) : (
                <span className="text-emerald-300 font-bold">
                  {fmtDol(puntoActual.dolares)}
                </span>
              )}
            </span>
          )}
          <span className={`text-[10px] font-semibold uppercase tracking-wider hidden sm:inline transition-colors ${expanded ? 'text-emerald-400' : 'text-gray-500 group-hover:text-emerald-400'}`}>
            {expanded ? "Ocultar" : "Mostrar"}
          </span>
          <span className={`w-7 h-7 rounded-lg border border-[#046C5E]/40 bg-[#010f0c]/40 flex items-center justify-center transition-all duration-300 group-hover:border-emerald-400/60 ${expanded ? 'rotate-180' : ''}`}>
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path d="M3 4.5L6 7.5L9 4.5" stroke="#34d399" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
        </div>
      </button>

      {/* Contenedor colapsable — transición suave via grid-rows */}
      <div
        className={`grid transition-[grid-template-rows] duration-500 ease-in-out ${expanded ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}
      >
        <div className="overflow-hidden">
          <div className={`px-5 pb-5 border-t border-[#046C5E]/20 pt-4 transition-opacity duration-300 ${expanded ? 'opacity-100' : 'opacity-0'}`}>

            {/* Leyenda + KPI proyección */}
            <div className="flex items-center justify-end gap-3 flex-wrap text-[10px] mb-4">
              {tieneProyeccion && (
                <div className="flex items-center gap-2 bg-yellow-400/10 border border-yellow-400/20 rounded-lg px-3 py-1.5 mr-auto">
                  <span className="text-yellow-300 font-bold text-xs">
                    Proy: {fmtDol(puntoActual!.proyeccion ?? 0)}
                  </span>
                  <span className="text-gray-500">·</span>
                  <span className="text-gray-400">
                    Real: {fmtDol(puntoActual!.dolares)}
                  </span>
                  <span className="text-gray-500">·</span>
                  <span className="text-cyan-400 text-xs">
                    {fmtUni(puntoActual!.unidades)}
                  </span>
                  <span className="text-gray-500">·</span>
                  <span className="text-violet-400 text-xs font-bold">
                    Acum: {fmtDol(puntoActual!.acumulado ?? 0)}
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

            {/* Chart — solo los 3 meses */}
      <ResponsiveContainer width="100%" height={260}>
        <ComposedChart data={datos3Meses} margin={{ top: 16, right: 52, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="gradDolaresShared" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%"   stopColor="#34d399" stopOpacity={0.28} />
              <stop offset="100%" stopColor="#34d399" stopOpacity={0.02} />
            </linearGradient>
          </defs>

          <CartesianGrid strokeDasharray="4 4" stroke="#046C5E15" vertical={false} />
          <XAxis
            dataKey="label"
            tick={{ fill: "#6b7280", fontSize: 15 }}
            axisLine={false} tickLine={false}
          />
          <YAxis
            yAxisId="dol"
            tick={{ fill: "#34d399", fontSize: 13 }}
            axisLine={false} tickLine={false}
            tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`}
            width={52}
            domain={[0, (dataMax: number) => Math.ceil(Math.max(dataMax, maxRef) * 1.1 / 1000) * 1000]}
          />
          <YAxis
            yAxisId="uni"
            orientation="right"
            tick={{ fill: "#22d3ee", fontSize: 13 }}
            axisLine={false} tickLine={false}
            tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)}
            width={44}
          />
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

          <Area
            yAxisId="dol"
            type="monotone"
            dataKey="dolares"
            stroke="#34d399"
            strokeWidth={2.5}
            fill="url(#gradDolaresShared)"
            dot={(p: any) => {
              const { key, ...rest } = p;
              return <PulsingDot key={key} {...rest} color="#34d399" mesActual={mesActual} anioActual={anioActual} />;
            }}
            activeDot={false}
          />
          <Line
            yAxisId="dol"
            type="monotone"
            dataKey="proyeccion"
            stroke="#fbbf24"
            strokeWidth={2}
            strokeDasharray="7 4"
            fill="none"
            dot={(p: any) => {
              const { key, ...rest } = p;
              return <ProyeccionDot key={key} {...rest} mesActual={mesActual} anioActual={anioActual} />;
            }}
            activeDot={false}
          />
          <Line
            yAxisId="uni"
            type="monotone"
            dataKey="unidades"
            stroke="#22d3ee"
            strokeWidth={2}
            strokeDasharray="6 3"
            fill="none"
            dot={(p: any) => {
              const { key, ...rest } = p;
              return <PulsingDot key={key} {...rest} color="#22d3ee" mesActual={mesActual} anioActual={anioActual} />;
            }}
            activeDot={false}
          />
          <Line
            yAxisId="acum"
            type="monotone"
            dataKey="acumulado"
            stroke="#a78bfa"
            strokeWidth={2.5}
            fill="none"
            dot={(p: any) => {
              const { key, ...rest } = p;
              return <PulsingDot key={key} {...rest} color="#a78bfa" mesActual={mesActual} anioActual={anioActual} />;
            }}
            activeDot={false}
          />
        </ComposedChart>
      </ResponsiveContainer>

      {/* Strip — 3 columnas, valores completos, texto más grande */}
      <div className="grid grid-cols-3 border-t border-[#046C5E]/20 pt-3 gap-2 mt-1">
        {datos3Meses.map((d) => {
          const esCurrent = d.mes === mesActual && d.anio === anioActual;
          const pctDol  = maxRef  > 0 ? Math.round((d.dolares / maxRef) * 100) : 0;
          const pctProy = maxRef  > 0 ? Math.round(((d.proyeccion ?? d.dolares) / maxRef) * 100) : 0;
          const pctUni  = maxUni  > 0 ? Math.round((d.unidades / maxUni) * 100) : 0;
          const pctAcum = maxAcum > 0 ? Math.round(((d.acumulado ?? 0) / maxAcum) * 100) : 0;
          const hayProy = esCurrent && d.proyeccion != null && d.proyeccion !== d.dolares;
          return (
            <div
              key={`${d.anio}-${d.mes}`}
              className={`flex flex-col items-center gap-1.5 px-2 py-2 rounded-lg transition-all ${
                esCurrent ? "bg-emerald-400/5 border border-emerald-400/15" : ""
              }`}
            >
              {/* Mes */}
              <span className={`text-base font-bold leading-none ${esCurrent ? "text-emerald-400" : "text-gray-400"}`}>
                {d.label} {d.anio}
              </span>

              {/* Dólares / Proyección */}
              {hayProy ? (
                <>
                  <span className="text-base font-bold leading-none text-yellow-400">
                    ↑{fmtDol(d.proyeccion ?? 0)}
                  </span>
                  <span className="text-sm leading-none text-emerald-400">
                    R{fmtDol(d.dolares)}
                  </span>
                </>
              ) : (
                <span className={`text-base font-bold leading-none ${esCurrent ? "text-emerald-400" : "text-gray-300"}`}>
                  {fmtDol(d.dolares)}
                </span>
              )}

              {/* Mini barras */}
              <div className="w-full flex flex-col gap-0.5">
                <div className="w-full bg-[#046C5E]/20 rounded-full h-[3px]">
                  <div className={`h-[3px] rounded-full ${esCurrent ? "bg-emerald-400" : "bg-emerald-700"}`} style={{ width: `${pctDol}%` }} />
                </div>
                {hayProy && (
                  <div className="w-full bg-[#046C5E]/20 rounded-full h-[3px]">
                    <div className="h-[3px] rounded-full bg-yellow-400" style={{ width: `${pctProy}%` }} />
                  </div>
                )}
                <div className="w-full bg-[#046C5E]/20 rounded-full h-[3px]">
                  <div className={`h-[3px] rounded-full ${esCurrent ? "bg-cyan-400" : "bg-cyan-700"}`} style={{ width: `${pctUni}%` }} />
                </div>
                <div className="w-full bg-[#046C5E]/20 rounded-full h-[3px]">
                  <div className={`h-[3px] rounded-full ${esCurrent ? "bg-violet-400" : "bg-violet-700"}`} style={{ width: `${pctAcum}%` }} />
                </div>
              </div>

              {/* Unidades */}
              <span className={`text-sm font-semibold leading-none ${esCurrent ? "text-cyan-400" : "text-gray-500"}`}>
                {fmtUni(d.unidades)}
              </span>

              {/* Acumulado YTD */}
              <span className={`text-sm font-semibold leading-none ${esCurrent ? "text-violet-400" : "text-gray-500"}`}>
                Σ{fmtDol(d.acumulado)}
              </span>
            </div>
          );
        })}
      </div>

          </div>
        </div>
      </div>
    </div>
  );
};

export default GraficoTendencia;
