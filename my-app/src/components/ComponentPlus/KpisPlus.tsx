import React from "react";
import GraficoTendencia from "../common/GraficoTendencia";

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
  totalProyeccion: number;
  totalProyeccionUnidades?: number;
  esMesActual?: boolean;
  tendencia6Meses?: { label: string; anio: number; mes: number; dolares: number; unidades: number }[];
  onCardClick?: () => void;
  anioFiltro?: number;
  mesFiltro?: number;
}

const money = (v: number) =>
  `$${v.toLocaleString("es-EC", { minimumFractionDigits: 2 })}`;

const KpisPlus: React.FC<Props> = ({
  kpis,
  comparativa,
  totalProyeccion,
  totalProyeccionUnidades,
  esMesActual,
  tendencia6Meses,
  onCardClick,
  anioFiltro,
  mesFiltro,
}) => {
  const proyUnidades = totalProyeccionUnidades ?? kpis.unidadesTotales;

  return (
    <div className="mb-10">
      <GraficoTendencia
        datos={tendencia6Meses ?? []}
        subtitulo="Tendencia"
        anioFiltro={anioFiltro}
        mesFiltro={mesFiltro}
      />

      <h3 className="text-sm text-emerald-300 mb-4 uppercase px-2 tracking-wider">
        Total Plus
      </h3>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 sm:max-w-2xl mx-auto w-full">
        {/* TOTAL UNIDADES */}
        <div
          onClick={onCardClick}
          className={`min-w-0 bg-gradient-to-br from-[#012E24] to-[#014034] border border-[#046C5E]/40 rounded-2xl p-5 shadow-lg text-center transition-all duration-300 hover:shadow-xl hover:border-emerald-400/60 hover:scale-[1.02] ${onCardClick ? "cursor-pointer" : ""}`}
        >
          <div className="flex items-center justify-center mb-1">
            <p className="uppercase tracking-wider text-xs text-blue-300 font-semibold">
              {esMesActual ? "Proyección Unidades" : "Total Unidades"}
            </p>
          </div>
          {onCardClick && (
            <span className="block text-[10px] text-gray-400 italic text-right -mt-1 mb-1">Ver rutas ↓</span>
          )}
          <p className="font-bold text-white text-2xl md:text-3xl leading-none mb-3 break-all">
            {proyUnidades.toLocaleString("es-EC")}
          </p>
          {esMesActual && (
            <p className="text-xs text-gray-400 mb-2">
              Real: {kpis.unidadesTotales.toLocaleString("es-EC")}
            </p>
          )}
          {comparativa?.unidades && (
            <div className="border-t border-[#046C5E]/30 pt-2 space-y-1">
              <p className="text-xs text-gray-400">Mes anterior</p>
              <p className="text-white font-semibold text-sm">
                {comparativa.unidades.anterior.toLocaleString("es-EC")} Uni
              </p>
              <div className="flex justify-center">
                <span
                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold border ${
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
          className={`min-w-0 bg-gradient-to-br from-[#012E24] to-[#014034] border border-[#046C5E]/40 rounded-2xl p-5 shadow-lg text-center transition-all duration-300 hover:shadow-xl hover:border-emerald-400/60 hover:scale-[1.02] ${onCardClick ? "cursor-pointer" : ""}`}
        >
          <div className="flex items-center justify-center mb-1">
            <p className="uppercase tracking-wider text-xs text-blue-300 font-semibold">
              {esMesActual ? "Proyección Dólares $" : "Total Dólares"}
            </p>
          </div>
          {onCardClick && (
            <span className="block text-[10px] text-gray-400 italic text-right -mt-1 mb-1">Ver rutas ↓</span>
          )}
          <p className="font-bold text-white text-2xl md:text-3xl leading-none mb-3 break-all">
            {money(totalProyeccion)}
          </p>
          {esMesActual && (
            <p className="text-xs text-gray-400 mb-2">
              Real: {money(kpis.montoTotal)}
            </p>
          )}
          {comparativa?.monto && (
            <div className="border-t border-[#046C5E]/30 pt-2 space-y-1">
              <p className="text-xs text-gray-400">Mes anterior</p>
              <p className="text-white font-semibold text-sm">
                {money(comparativa.monto.anterior)}
              </p>
              <div className="flex justify-center">
                <span
                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold border ${
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

export default KpisPlus;
