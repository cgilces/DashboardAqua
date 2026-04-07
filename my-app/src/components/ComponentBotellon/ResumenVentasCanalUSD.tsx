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
  `$${v.toLocaleString("es-EC", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

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
      <h3 className="text-sm text-emerald-300 mb-2 uppercase ">
        {titulo}
      </h3>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {canales.map((canal) => {
          const d = data[canal];
          if (!d) return null;

          const proyeccionUSD = d.proyeccion ?? 0;
          const montoReal = d.monto ?? 0;
          const hayProyeccion = Math.abs(proyeccionUSD - montoReal) > 0.01;
          const proyeccionUnidades = d.proyeccion_unidades ?? 0;
          const unidadesReal = d.unidades ?? 0;
          const hayProyeccionUnidades = Math.abs(proyeccionUnidades - unidadesReal) > 0.5;
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
                rounded-2xl p-5
                shadow-lg flex flex-col
                transition-all duration-300 hover:shadow-xl
                ${clickable ? "cursor-pointer hover:border-emerald-400/60 hover:scale-[1.02]" : ""}
              `}
            >
              {/* ── Cabecera canal ─────────────────────────── */}
              <div className="flex items-center justify-between mb-4">
                <p className="uppercase tracking-wider text-xs text-blue-300 font-semibold">
                  {CANALES_LABELS[canal] ?? canal}
                </p>
                {clickable && (
                  <span className="text-[10px] text-gray-400 italic">
                    {ruta ? "Ver clientes →" : "Ver tabla ↓"}
                  </span>
                )}
              </div>

              {/* ── Grid 2 columnas: cada fila alineada ────── */}
              <div className="flex-1 grid grid-cols-2 gap-x-4">

                {/* ── FILA 1: etiquetas ─────────────────────── */}
                <p className="text-[10px] text-gray-400 uppercase tracking-wide leading-tight">
                  Proy. Unidades
                </p>
                <p className="text-[10px] text-gray-400 uppercase tracking-wide leading-tight text-right">
                  Proy. Dólares
                </p>

                {/* ── FILA 2: valores proyección ────────────── */}
                <p className="font-bold text-white text-base md:text-lg leading-tight mt-0.5 whitespace-nowrap overflow-hidden">
                  {proyeccionUnidades.toLocaleString("es-EC")}
                </p>
                <p className="font-bold text-emerald-400 text-base md:text-lg leading-tight mt-0.5 text-right whitespace-nowrap overflow-hidden">
                  {money(proyeccionUSD)}
                </p>

                {/* ── FILA 3: reales debajo de proyecciones ── */}
                <p className={`text-[11px] leading-tight mt-0.5 ${hayProyeccionUnidades ? "text-gray-400" : "invisible"}`}>
                  Real: <span className="text-white font-semibold">{unidadesReal.toLocaleString("es-EC")}</span>
                </p>
                <p className={`text-[11px] leading-tight mt-0.5 text-right ${hayProyeccion ? "text-gray-400" : "invisible"}`}>
                  Real: <span className="text-white font-semibold">{money(montoReal)}</span>
                </p>

                {/* ── SEPARADOR compartido ─────────────────── */}
                <div className="col-span-2 border-t border-[#046C5E]/30 my-3" />

                {/* ── FILA 4: etiqueta mes anterior ─────────── */}
                <p className="text-[10px] text-gray-400 uppercase tracking-wide">Mes anterior</p>
                <p className="text-[10px] text-gray-400 uppercase tracking-wide text-right">Mes anterior</p>

                {/* ── FILA 5: valores mes anterior ─────────── */}
                <p className="text-white font-semibold text-sm mt-0.5 truncate">
                  {unidadesMesAnterior.toLocaleString("es-EC")} Uni
                </p>
                <p className="text-white font-semibold text-sm mt-0.5 text-right truncate">
                  {money(montoAnterior)}
                </p>

                {/* ── FILA 6: badges variación ──────────────── */}
                <div className="mt-1.5">
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold border
                    ${variacionAbsUnidades >= 0
                      ? "text-emerald-400 border-emerald-400/20 bg-emerald-400/10"
                      : "text-red-400 border-red-400/20 bg-red-400/10"}`}>
                    {variacionAbsUnidades >= 0 ? "▲" : "▼"}
                    {Math.round(Math.abs(variacionAbsUnidades)).toLocaleString("es-EC")}
                    <span className="opacity-80">({variacionPorcUnidades.toFixed(1)}%)</span>
                  </span>
                </div>
                <div className="mt-1.5 flex justify-end">
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold border
                    ${variacionAbs >= 0
                      ? "text-emerald-400 border-emerald-400/20 bg-emerald-400/10"
                      : "text-red-400 border-red-400/20 bg-red-400/10"}`}>
                    {variacionAbs >= 0 ? "▲" : "▼"}
                    {money(Math.abs(variacionAbs))}
                    <span className="opacity-80">({variacionPorc.toFixed(1)}%)</span>
                  </span>
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
