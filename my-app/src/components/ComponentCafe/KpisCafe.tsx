// components/ComponentCafe/KpisCafe.tsx
import React from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell, ReferenceLine, Legend,
} from "recharts";
import GraficoTendencia, { PuntoTendencia } from "../common/GraficoTendencia";

interface Props {
  tendencia6Meses?: PuntoTendencia[];
  totales: {
    unidades:            number;
    dolares:             number;
    proyeccion_unidades: number;
    proyeccion_dolares:  number;
    cant_facturas:       number;
    cant_clientes:       number;
    mes_anterior: { unidades: number; dolares: number };
    variacion_dolares:  { abs: number; porcentaje: number | null };
    variacion_unidades: { abs: number; porcentaje: number | null };
  };
  esMesActual: boolean;
  anioFiltro?: number;
  mesFiltro?: number;
}

const money  = (v: number) => `$${v.toLocaleString("es-EC", { minimumFractionDigits: 2 })}`;
const fmtInt = (v: number) => v.toLocaleString("es-EC");

/* Tooltip personalizado */
const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-[#011f1a] border border-[#046C5E] rounded-lg px-3 py-2 text-xs text-white shadow-lg">
      <p className="font-semibold text-green-300 mb-1">{label}</p>
      {payload.map((p: any, i: number) => (
        <p key={i} style={{ color: p.color }}>
          {p.name}: {p.name.includes("$") ? money(p.value) : fmtInt(p.value)}
        </p>
      ))}
    </div>
  );
};

const KpisCafe: React.FC<Props> = ({ totales, esMesActual, tendencia6Meses, anioFiltro, mesFiltro }) => {
  const varDolPos = totales.variacion_dolares.abs >= 0;
  const varUniPos = totales.variacion_unidades.abs >= 0;
  const sinDatos  = totales.mes_anterior.dolares === 0;

  /* Datos para los gráficos de comparativa */
  const dataDolares = [
    { mes: "Mes Anterior", valor: totales.mes_anterior.dolares },
    { mes: esMesActual ? "Actual (Real)" : "Actual", valor: totales.dolares },
    ...(esMesActual ? [{ mes: "Proyección", valor: totales.proyeccion_dolares }] : []),
  ];

  const dataUnidades = [
    { mes: "Mes Anterior", valor: totales.mes_anterior.unidades },
    { mes: esMesActual ? "Actual (Real)" : "Actual", valor: totales.unidades },
    ...(esMesActual ? [{ mes: "Proyección", valor: totales.proyeccion_unidades }] : []),
  ];

  const colorBarra = (entry: any, index: number) => {
    if (entry.mes === "Proyección") return "#34d399";
    if (index === 0) return "#64748b";
    return entry.valor >= (dataDolares[0]?.valor ?? 0) ? "#22c55e" : "#ef4444";
  };

  const colorBarraUni = (entry: any, index: number) => {
    if (entry.mes === "Proyección") return "#34d399";
    if (index === 0) return "#64748b";
    return entry.valor >= (dataUnidades[0]?.valor ?? 0) ? "#22c55e" : "#ef4444";
  };

  return (
    <div>
      {/* ── Gráfico tendencia 6 meses ─────────────────────────── */}
      <GraficoTendencia datos={tendencia6Meses ?? []} subtitulo="IIBC S.A." anioFiltro={anioFiltro} mesFiltro={mesFiltro} />

      {/* ── Gráfico comparativa ───────────────────────────────── */}
    

      {/* ── KPI Cards ─────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 sm:max-w-2xl mx-auto w-full">

        {/* TOTAL DÓLARES */}
        <div className="bg-gradient-to-br from-[#012E24] to-[#014034] border border-[#046C5E]/40 rounded-2xl p-5 shadow-lg text-center">
          <p className="text-xs text-blue-300 uppercase tracking-wider font-semibold mb-1">
            {esMesActual ? "Proyección Dólares $" : "Total Dólares"}
          </p>
          <p className="font-bold text-white text-2xl md:text-3xl leading-none mb-3 break-all">
            {money(esMesActual ? totales.proyeccion_dolares : totales.dolares)}
          </p>
          {esMesActual && (
            <p className="text-xs text-gray-400 mb-2">Real: {money(totales.dolares)}</p>
          )}
          <div className="border-t border-[#046C5E]/30 pt-2 space-y-1">
            <p className="text-xs text-gray-400">Mes anterior</p>
            <p className="text-white font-semibold text-sm">{money(totales.mes_anterior.dolares)}</p>
            {!sinDatos && (
              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold border ${
                varDolPos
                  ? "text-emerald-400 border-emerald-400/20 bg-emerald-400/10"
                  : "text-red-400 border-red-400/20 bg-red-400/10"
              }`}>
                {varDolPos ? "▲" : "▼"}
                {money(Math.abs(totales.variacion_dolares.abs))}
                {totales.variacion_dolares.porcentaje !== null && (
                  <span>({totales.variacion_dolares.porcentaje?.toFixed(1)}%)</span>
                )}
              </span>
            )}
          </div>
        </div>

        {/* TOTAL UNIDADES */}
        <div className="bg-gradient-to-br from-[#012E24] to-[#014034] border border-[#046C5E]/40 rounded-2xl p-5 shadow-lg text-center">
          <p className="text-xs text-blue-300 uppercase tracking-wider font-semibold mb-1">
            {esMesActual ? "Proyección Unidades" : "Total Unidades"}
          </p>
          <p className="font-bold text-white text-2xl md:text-3xl leading-none mb-3 break-all">
            {fmtInt(esMesActual ? totales.proyeccion_unidades : totales.unidades)}
          </p>
          {esMesActual && (
            <p className="text-xs text-gray-400 mb-2">Real: {fmtInt(totales.unidades)}</p>
          )}
          <div className="border-t border-[#046C5E]/30 pt-2 space-y-1">
            <p className="text-xs text-gray-400">Mes anterior</p>
            <p className="text-white font-semibold text-sm">{fmtInt(totales.mes_anterior.unidades)} Uni</p>
            {totales.mes_anterior.unidades > 0 && (
              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold border ${
                varUniPos
                  ? "text-emerald-400 border-emerald-400/20 bg-emerald-400/10"
                  : "text-red-400 border-red-400/20 bg-red-400/10"
              }`}>
                {varUniPos ? "▲" : "▼"}
                {fmtInt(Math.abs(totales.variacion_unidades.abs))}
                {totales.variacion_unidades.porcentaje !== null && (
                  <span>({totales.variacion_unidades.porcentaje?.toFixed(1)}%)</span>
                )}
              </span>
            )}
          </div>
        </div>

        {/* FACTURAS */}
        <div className="bg-gradient-to-br from-[#012E24] to-[#014034] border border-[#046C5E]/40 rounded-2xl p-5 shadow-lg text-center">
          <p className="text-xs text-blue-300 uppercase tracking-wider font-semibold mb-1">Facturas</p>
          <p className="font-bold text-white text-2xl md:text-3xl leading-none mb-3">
            {fmtInt(totales.cant_facturas)}
          </p>
          <div className="border-t border-[#046C5E]/30 pt-2">
            <p className="text-xs text-gray-400">Facturas Odoo</p>
            <p className="text-xs text-green-300 mt-1">company_id = 4</p>
          </div>
        </div>

        {/* CLIENTES */}
        <div className="bg-gradient-to-br from-[#012E24] to-[#014034] border border-[#046C5E]/40 rounded-2xl p-5 shadow-lg text-center">
          <p className="text-xs text-blue-300 uppercase tracking-wider font-semibold mb-1">Clientes Únicos</p>
          <p className="font-bold text-amber-300 text-2xl md:text-3xl leading-none mb-3">
            {fmtInt(totales.cant_clientes)}
          </p>
          <div className="border-t border-[#046C5E]/30 pt-2">
            <p className="text-xs text-gray-400">Empresa IIBC S.A.</p>
            <p className="text-xs text-green-300 mt-1">Facturación Odoo</p>
          </div>
        </div>

      </div>
    </div>
  );
};

export default KpisCafe;
