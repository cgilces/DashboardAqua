import React from "react";
import { useNavigate } from "react-router-dom";

/* ============================
   TIPOS
============================ */
interface VsMesAnterior {
  monto_anterior?: number;
  variacion_abs?: number;
  variacion_porc?: number | null;
  unidades?: number;

  // Nuevos campos para unidades
  variacionAbsUnidades?: number;
  variacionPorcUnidades?: number | null;
}

interface CanalVentasUSD {
  monto?: number;
  proyeccion?: number;          // USD proyectado
  proyeccion_unidades?: number; //  nuevo
  unidades?: number;            // acumulado real
  vsMesAnterior?: VsMesAnterior;
}


interface Props {
  titulo?: string;
  canales: string[];
  data: Record<string, CanalVentasUSD>;
  anio?: string | number;
  mes?: string | number;
  rutasCanales?: Record<string, string>;
  scrollTargets?: Record<string, string>;
  onScrollClick?: (canal: string) => void;
}

/* ============================
   HELPERS
============================ */
const money = (v: number) =>
  `$${v.toLocaleString("es-EC", { minimumFractionDigits: 2 })}`;

const CANALES_LABELS: Record<string, string> = {
  domicilio: "Domicilio",
  empresas: "Empresas",
  mayorista: "Mayorista",
  quito: "Quito",
  rural: "Rural",
  televenta_vip: "Televenta VIP",
  tiendas: "Tiendas",
  tiendas_vip: "Tiendas VIP",
  vip: "VIP",
};

/* ============================
   COMPONENTE
============================ */
const ResumenVentasCanalUSD: React.FC<Props> = ({
  titulo = "Ventas USD Botellón",
  canales,
  data,
  anio,
  mes,
  rutasCanales = {},
  scrollTargets = {},
  onScrollClick,
}) => {
  const navigate = useNavigate();
  return (
    <div className="mb-10">
      <h3 className="text-sm text-emerald-300 mb-6 uppercase px-2">
        {titulo}
      </h3>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {canales.map((canal) => {
          const d = data[canal];
          if (!d) return null;

          const proyeccionUSD = d.proyeccion ?? 0;
          const proyeccionUnidades = d.proyeccion_unidades ?? 0;
          // const unidadesActuales = d.unidades ?? 0;
          const mesAnterior = d.vsMesAnterior;
          const unidadesMesAnterior = mesAnterior?.unidades ?? 0;
          const variacionAbsUnidades = mesAnterior?.variacionAbsUnidades ?? 0;
          const variacionPorcUnidades = mesAnterior?.variacionPorcUnidades ?? 0;
          const montoAnterior = mesAnterior?.monto_anterior ?? 0;
          const variacionAbs = mesAnterior?.variacion_abs ?? 0;
          const variacionPorc = mesAnterior?.variacion_porc ?? 0;


          //  OCULTAR CARD SI UNIDADES ES 0
          if (proyeccionUnidades === 0 && proyeccionUSD === 0) return null;

          const ruta = rutasCanales[canal];
          const scrollId = scrollTargets[canal];
          const clickable = !!(ruta && anio != null && mes != null) || !!scrollId;

          const handleClick = () => {
            if (ruta && anio != null && mes != null) {
              navigate(`${ruta}/${anio}/${mes}`);
            } else if (scrollId) {
              document.getElementById(scrollId)?.scrollIntoView({ behavior: "smooth", block: "start" });
              onScrollClick?.(canal);
            }
          };

          return (
            <div
              key={canal}
              onClick={clickable ? handleClick : undefined}
              className={`
                bg-gradient-to-br from-[#012E24] to-[#014034]
                border border-[#046C5E]/40
                rounded-2xl p-6
                shadow-lg
                flex flex-col
                transition-all duration-300
                hover:shadow-xl
                ${clickable ? "cursor-pointer hover:border-emerald-400/60 hover:scale-[1.02]" : ""}
              `}
            >
              {/* CANAL */}
              <div className="flex items-center justify-between mb-5">
                <p className="uppercase tracking-wider text-xs text-blue-300 font-semibold">
                  {CANALES_LABELS[canal] ?? canal}
                </p>
                {clickable && (
                  <span className="text-[10px] text-gray-400 italic">
                    {ruta ? "Ver clientes →" : "Ver tabla ↓"}
                  </span>
                )}
              </div>

              <div className="grid grid-cols-2 md:grid-cols-2 gap-4 md:gap-8 mb-6">

                {/* ===================== COLUMNA UNIDADES ===================== */}
                <div className="space-y-2 md:space-y-4 min-w-0">

                  {/* PROYECCIÓN */}
                  <div className="min-w-0">
                    <p className="text-[10px] md:text-xs text-gray-400 uppercase tracking-wide whitespace-nowrap">
                      Proyección Unidades
                    </p>

                    <p className="font-bold text-white text-xl md:text-2xl xl:text-3xl leading-none truncate">
                      {proyeccionUnidades.toLocaleString("es-EC")}
                    </p>
                  </div>

                  {/* ✅ DESKTOP: Mes anterior (Unidades) */}
                  <div className="hidden md:block border-t border-[#046C5E]/30 pt-3 space-y-2 min-w-0">
                    <p className="text-xs text-gray-400 uppercase tracking-wide">Mes anterior</p>

                    <p className="text-white font-semibold text-base truncate">
                      {unidadesMesAnterior.toLocaleString("es-EC")} Uni
                    </p>

                    <span
                      className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-semibold border ${variacionAbsUnidades >= 0
                        ? "text-emerald-400 border-emerald-400/20 bg-emerald-400/10"
                        : "text-red-400 border-red-400/20 bg-red-400/10"
                        }`}
                    >
                      {variacionAbsUnidades >= 0 ? "▲" : "▼"}
                      <span className="truncate">
                        {Math.abs(variacionAbsUnidades).toLocaleString("es-EC")}
                      </span>
                      <span className="opacity-90">({variacionPorcUnidades.toFixed(1)}%)</span>
                    </span>


                  </div>
                </div>

                {/* ===================== COLUMNA USD ===================== */}
                <div className="space-y-2 md:space-y-4 text-right border-l border-[#046C5E]/40 pl-2  ">

                  {/* PROYECCIÓN */}
                  <div className="min-w-0">
                    <p className="text-[10px] md:text-xs text-gray-400 uppercase tracking-wide whitespace-nowrap">
                      Proyección Dólares
                    </p>

                    <p className="font-bold text-emerald-400 text-xl md:text-2xl xl:text2xl leading-none whitespace-nowrap">
                      {money(proyeccionUSD)}
                    </p>
                  </div>

                  {/* ✅ DESKTOP: Mes anterior (USD) */}
                  <div className="hidden md:block border-t border-[#046C5E]/30 pt-4 space-y-2 min-w-0">
                    <p className="text-xs text-gray-400 uppercase tracking-wide">Mes anterior</p>

                    <p className="text-white font-semibold text-base truncate">
                      {money(montoAnterior)}
                    </p>

                    <span
                      className={`inline-flex items-center justify-end gap-1 px-2 py-1 rounded-md text-xs font-semibold border ${variacionAbs >= 0
                        ? "text-emerald-400 border-emerald-400/20 bg-emerald-400/10"
                        : "text-red-400 border-red-400/20 bg-red-400/10"
                        }`}
                    >
                      {variacionAbs >= 0 ? "▲" : "▼"}
                      <span className="truncate">{money(Math.abs(variacionAbs))}</span>
                      <span className="opacity-90">({variacionPorc.toFixed(1)}%)</span>
                    </span>
                  </div>

                </div>

                {/* ===================== ✅ MÓVIL ABAJO: DOS BLOQUES ===================== */}
                {/* ✅ MÓVIL ABAJO: Dos bloques */}
                <div className="col-span-2 md:hidden border-t border-[#046C5E]/30 pt-3 grid grid-cols-2 gap-4">

                  {/* BLOQUE UNIDADES */}
                  <div className="space-y-1 min-w-0">
                    <p className="text-[10px] text-gray-400 uppercase tracking-wide">
                      Mes anterior
                    </p>

                    <p className="text-white font-semibold text-sm truncate">
                      {unidadesMesAnterior.toLocaleString("es-EC")} Uni
                    </p>

                    <span
                      className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-semibold border ${variacionAbsUnidades >= 0
                          ? "text-emerald-400 border-emerald-400/20 bg-emerald-400/10"
                          : "text-red-400 border-red-400/20 bg-red-400/10"
                        }`}
                    >
                      {variacionAbsUnidades >= 0 ? "▲" : "▼"}
                      <span className="truncate">
                        {Math.abs(variacionAbsUnidades).toLocaleString("es-EC")}
                      </span>
                      <span className="opacity-90">({variacionPorcUnidades.toFixed(1)}%)</span>
                    </span>
                  </div>

                  {/* BLOQUE USD */}
                  <div className="space-y-1 text-right min-w-0">
                    <p className="text-[10px] text-gray-400 uppercase tracking-wide">
                      Mes anterior
                    </p>

                    <p className="text-white font-semibold text-sm truncate">
                      {money(montoAnterior)}
                    </p>

                    <span
                      className={`inline-flex items-center justify-end gap-1 px-2 py-1 rounded-md text-[11px] font-semibold border ${variacionAbs >= 0
                          ? "text-emerald-400 border-emerald-400/20 bg-emerald-400/10"
                          : "text-red-400 border-red-400/20 bg-red-400/10"
                        }`}
                    >
                      {variacionAbs >= 0 ? "▲" : "▼"}
                      <span className="truncate">{money(Math.abs(variacionAbs))}</span>
                      <span className="opacity-90">({variacionPorc.toFixed(1)}%)</span>
                    </span>
                  </div>

                </div>
              </div>
            </div>

          );
        })}
      </div>
    </div>
  );
};

export default ResumenVentasCanalUSD;
