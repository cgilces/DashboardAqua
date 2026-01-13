import React from "react";

/* ============================
   TIPOS
============================ */
interface Variacion {
  anterior: number;
  actual: number;
  variacionAbs: number;
  variacionPorc: number | null;
}

interface Props {
  kpis: {
    unidadesTotales: number;
    montoTotal: number;

    metaMensualUnidades: number;
    metaMensualUSD: number;



    cumplimientoUnidadesMensual: number;
    cumplimientoUSDMensual: number;

    cumplimientoUnidadesAnual: number;
    cumplimientoUSDAnual: number;

    promedioUSDPorUnidad: number;
    grupoMayorUnidades: string;
    grupoMayorMonto: string;
  };

  comparativa?: {
    unidades: Variacion;
    monto: Variacion;
  };
}

/* ============================
   HELPERS
============================ */
const pctCap = (v: number) => Math.min(100, Math.max(0, v));

const money = (v: number) =>
  `$${v.toLocaleString("es-EC", { minimumFractionDigits: 2 })}`;

const formatVariacion = (v?: Variacion) => {
  if (!v || v.variacionPorc === null) return "—";
  if (v.variacionAbs === 0) return "$0,00";

  const signo = v.variacionPorc > 0 ? "+" : "";
  return `(${signo}${v.variacionPorc.toFixed(2)}%) $${Math.abs(
    v.variacionAbs
  ).toLocaleString("es-EC", { minimumFractionDigits: 2 })}`;
};

const colorVariacion = (v?: Variacion) => {
  if (!v || v.variacionAbs === 0) return "text-gray-400";
  return v.variacionAbs > 0 ? "text-green-400" : "text-red-400";
};

/* ============================
   COMPONENTE
============================ */
const KpisBotellones: React.FC<Props> = ({ kpis, comparativa }) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">

      {/* ============================
         KPI UNIDADES
      ============================ */}
      <div className="bg-[#012E24] border border-[#046C5E] rounded-xl p-6">
        <h3 className="text-gray-300 text-sm">Unidades Botellones</h3>

        <p className="text-4xl font-bold">
          {kpis.unidadesTotales.toLocaleString("es-EC")}
        </p>

        {/* VS MES ANTERIOR */}
        <p className={`text-xs mt-1 ${colorVariacion(comparativa?.unidades)}`}>
          {formatVariacion(comparativa?.unidades)}
        </p>

        {/* TARGET MENSUAL */}
        <p className="text-xs mt-4 mb-1">
          TARGET MENSUAL
          <span className="float-right">
            {kpis.cumplimientoUnidadesMensual.toFixed(1)}%
          </span>
        </p>
        <div className="h-3 bg-[#02483A] rounded-full mb-3">
          <div
            className="h-full bg-[#04C29B] rounded-full transition-all"
            style={{
              width: `${pctCap(kpis.cumplimientoUnidadesMensual)}%`,
            }}
          />
        </div>

        {/* TARGET ANUAL */}
        {/* <p className="text-xs mb-1">
          TARGET ANUAL
          <span className="float-right">
            {kpis.cumplimientoUnidadesAnual.toFixed(1)}%
          </span>
        </p>
        <div className="h-3 bg-[#02483A] rounded-full">
          <div
            className="h-full bg-[#04C29B] rounded-full transition-all"
            style={{
              width: `${pctCap(kpis.cumplimientoUnidadesAnual)}%`,
            }}
          />
        </div> */}
      </div>

      {/* ============================
         KPI USD
      ============================ */}
      <div className="bg-[#012E24] border border-[#046C5E] rounded-xl p-6">
        <h3 className="text-gray-300 text-sm">Ventas USD</h3>

        <p className="text-4xl font-bold">{money(kpis.montoTotal)}</p>

        {/* VS MES ANTERIOR */}
        <p className={`text-xs mt-1 ${colorVariacion(comparativa?.monto)}`}>
          {formatVariacion(comparativa?.monto)}
        </p>

        {/* TARGET MENSUAL */}
        <p className="text-xs mt-4 mb-1">
          TARGET MENSUAL
          <span className="float-right">
            {kpis.cumplimientoUSDMensual.toFixed(1)}%
          </span>
        </p>
        <div className="h-3 bg-[#02483A] rounded-full mb-3">
          <div
            className="h-full bg-[#4c8cb4] rounded-full transition-all"
            style={{
              width: `${pctCap(kpis.cumplimientoUSDMensual)}%`,
            }}
          />
        </div>

        {/* TARGET ANUAL */}
        {/* <p className="text-xs mb-1">
          TARGET ANUAL
          <span className="float-right">
            {kpis.cumplimientoUSDAnual.toFixed(1)}%
          </span>
        </p>
        <div className="h-3 bg-[#02483A] rounded-full">
          <div
            className="h-full bg-[#4c8cb4] rounded-full transition-all"
            style={{
              width: `${pctCap(kpis.cumplimientoUSDAnual)}%`,
            }}
          />
        </div> */}
      </div>

      {/* ============================
         COMPARATIVA DETALLADA
      ============================ */}
      <div className="bg-[#012E24] border border-[#046C5E] rounded-xl p-6">
        <h3 className="text-gray-300 text-sm mb-3">
          Comparativa Mes Anterior
        </h3>

        {/* UNIDADES */}
        {comparativa?.unidades && (
          <div className="mb-4">
            <p className="text-sm font-semibold text-white">Unidades</p>
            <p className="text-xs text-gray-300">
              Mes anterior:{" "}
              <span className="font-semibold">
                {comparativa.unidades.anterior.toLocaleString("es-EC")}
              </span>
            </p>
            <p className="text-xs text-gray-300">
              Mes actual:{" "}
              <span className="font-semibold">
                {comparativa.unidades.actual.toLocaleString("es-EC")}
              </span>
            </p>
            <p
              className={`text-xs font-bold ${colorVariacion(
                comparativa.unidades
              )}`}
            >
              {formatVariacion(comparativa.unidades)}
            </p>
          </div>
        )}

        {/* MONTO USD */}
        {comparativa?.monto && (
          <div>
            <p className="text-sm font-semibold text-white">Monto USD</p>
            <p className="text-xs text-gray-300">
              Mes anterior:{" "}
              <span className="font-semibold">
                {money(comparativa.monto.anterior)}
              </span>
            </p>
            <p className="text-xs text-gray-300">
              Mes actual:{" "}
              <span className="font-semibold">
                {money(comparativa.monto.actual)}
              </span>
            </p>
            <p
              className={`text-xs font-bold ${colorVariacion(
                comparativa.monto
              )}`}
            >
              {formatVariacion(comparativa.monto)}
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default KpisBotellones;
