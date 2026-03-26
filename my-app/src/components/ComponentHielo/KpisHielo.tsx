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
    metaMensualDolares: number;

    cumplimientoUnidadesMensual: number;
    cumplimientoUSDMensual: number;
  };

  comparativa?: {
    unidades: Variacion;
    monto: Variacion;
  };

  totalProyeccion: number; // ESTA LÍNEA FALTABA
  onCardClick?: () => void;
}


/* ============================
   HELPERS
============================ */
const money = (v: number) =>
  `$${v.toLocaleString("es-EC", { minimumFractionDigits: 2 })}`;

const formatVariacion = (v?: Variacion) => {
  if (!v || v.variacionPorc === null) return "—";

  const signo = v.variacionAbs > 0 ? "+" : "";
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
const KpisHielo: React.FC<Props> = ({ kpis, comparativa, totalProyeccion, onCardClick }) => {
  // 🔒 LIMITAMOS BARRAS AL 100%
  const cumplimientoUnidadesVisual = Math.min(
    100,
    Math.max(0, kpis.cumplimientoUnidadesMensual ?? 0)
  );

  const cumplimientoUSDVisual = Math.min(
    100,
    Math.max(0, kpis.cumplimientoUSDMensual ?? 0)
  );

  return (
    <div className="mb-10">
      <h3 className="text-sm text-emerald-300 mb-4 uppercase px-2 tracking-wider">
        Total Hielo
      </h3>

      <div className="grid grid-cols-2 gap-6 max-w-2xl mx-auto w-full">

        {/* TOTAL UNIDADES */}
        <div
          onClick={onCardClick}
          className={`min-w-0 bg-gradient-to-br from-[#012E24] to-[#014034] border border-[#046C5E]/40 rounded-2xl p-6 shadow-lg text-center transition-all duration-300 hover:shadow-xl hover:border-emerald-400/60 hover:scale-[1.02] ${onCardClick ? "cursor-pointer" : ""}`}
        >
          <div className="flex items-center justify-between mb-4">
            <p className="uppercase tracking-wider text-xs text-blue-300 font-semibold">
              Total Unidades
            </p>
            {onCardClick && <span className="text-[10px] text-gray-400 italic">Ver rutas ↓</span>}
          </div>
          <p className="text-[10px] md:text-xs text-gray-400 uppercase tracking-wide mb-1">
            Proyección
          </p>
          <p className="font-bold text-white text-2xl md:text-4xl leading-none mb-5 break-all">
            {kpis.unidadesTotales.toLocaleString("es-EC")}
          </p>
          {comparativa?.unidades && (
            <div className="border-t border-[#046C5E]/30 pt-3 space-y-2">
              <p className="text-xs text-gray-400 uppercase tracking-wide">Mes anterior</p>
              <p className="text-white font-semibold text-base">
                {comparativa.unidades.anterior.toLocaleString("es-EC")} Uni
              </p>
              <div className="flex justify-center">
                <span
                  className={`inline-flex items-center gap-1 px-3 py-1 rounded-md text-xs font-semibold border ${
                    comparativa.unidades.variacionAbs >= 0
                      ? "text-emerald-400 border-emerald-400/20 bg-emerald-400/10"
                      : "text-red-400 border-red-400/20 bg-red-400/10"
                  }`}
                >
                  {comparativa.unidades.variacionAbs >= 0 ? "▲" : "▼"}
                  {Math.abs(comparativa.unidades.variacionAbs).toLocaleString("es-EC")}
                  <span className="opacity-90">({comparativa.unidades.variacionPorc?.toFixed(1)}%)</span>
                </span>
              </div>
            </div>
          )}
        </div>

        {/* TOTAL DÓLARES */}
        <div
          onClick={onCardClick}
          className={`min-w-0 bg-gradient-to-br from-[#012E24] to-[#014034] border border-[#046C5E]/40 rounded-2xl p-6 shadow-lg text-center transition-all duration-300 hover:shadow-xl hover:border-emerald-400/60 hover:scale-[1.02] ${onCardClick ? "cursor-pointer" : ""}`}
        >
          <div className="flex items-center justify-between mb-4">
            <p className="uppercase tracking-wider text-xs text-blue-300 font-semibold">
              Total Dólares
            </p>
            {onCardClick && <span className="text-[10px] text-gray-400 italic">Ver rutas ↓</span>}
          </div>
          <p className="text-[10px] md:text-xs text-gray-400 uppercase tracking-wide mb-1">
            Proyección
          </p>
          <p className="font-bold text-emerald-400 text-2xl md:text-4xl leading-none mb-5 break-all">
            {money(totalProyeccion)}
          </p>
          {comparativa?.monto && (
            <div className="border-t border-[#046C5E]/30 pt-3 space-y-2">
              <p className="text-xs text-gray-400 uppercase tracking-wide">Mes anterior</p>
              <p className="text-white font-semibold text-base">
                {money(comparativa.monto.anterior)}
              </p>
              <div className="flex justify-center">
                <span
                  className={`inline-flex items-center gap-1 px-3 py-1 rounded-md text-xs font-semibold border ${
                    comparativa.monto.variacionAbs >= 0
                      ? "text-emerald-400 border-emerald-400/20 bg-emerald-400/10"
                      : "text-red-400 border-red-400/20 bg-red-400/10"
                  }`}
                >
                  {comparativa.monto.variacionAbs >= 0 ? "▲" : "▼"}
                  {money(Math.abs(comparativa.monto.variacionAbs))}
                  <span className="opacity-90">({comparativa.monto.variacionPorc?.toFixed(1)}%)</span>
                </span>
              </div>
            </div>
          )}
        </div>

      </div>
    </div>
  );

};

export default KpisHielo;
