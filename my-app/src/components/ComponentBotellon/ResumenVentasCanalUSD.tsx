import React from "react";

/* ============================
   TIPOS
============================ */
interface VsMesAnterior {
  monto_anterior?: number;
  variacion_abs?: number;
  variacion_porc?: number | null;
  unidades?: number;
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
}) => {
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
          const unidadesActuales = d.unidades ?? 0;
          const mesAnterior = d.vsMesAnterior;
          const montoAnterior = mesAnterior?.monto_anterior ?? 0;
          const variacionAbs = mesAnterior?.variacion_abs ?? 0;
          const variacionPorc = mesAnterior?.variacion_porc ?? 0;


          //  OCULTAR CARD SI UNIDADES ES 0
          if (proyeccionUnidades === 0 && proyeccionUSD === 0) return null;

          return (
            <div
              key={canal}
              className="
                bg-gradient-to-br from-[#012E24] to-[#014034]
                border border-[#046C5E]/40
                rounded-2xl p-6
                shadow-lg
                flex flex-col
                transition-all duration-300
                hover:shadow-xl
              "
                        >
              {/* CANAL */}
              <p className="uppercase tracking-wider text-xs text-blue-300 font-semibold mb-5">
                {CANALES_LABELS[canal] ?? canal}
              </p>

              {/* PROYECCIÓN EN 2 COLUMNAS */}
              <div className="grid grid-cols-2 gap-6 mb-4">

                {/* UNIDADES */}
                <div>
                  <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">
                    Proyección Unidades
                  </p>
                  <p className="
                          font-bold text-white
                          text-xl
                          sm:text-2xl
                          xl:text-3xl
                          whitespace-nowrap
                        ">
                    {proyeccionUnidades.toLocaleString("es-EC")}
                  </p>
                </div>

                {/* DÓLARES */}
                <div className="text-right border-l border-[#046C5E]/40 pl-4">
                  <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">
                    Proyección DÓLARES
                  </p>
                  <p className="
                      font-bold text-emerald-400
                      text-xl
                      sm:text-2xl
                      xl:text-3xl
                    ">
                    {money(proyeccionUSD)}
                  </p>
                </div>

              </div>

              {/* MES ANTERIOR */}
              <p className="text-xs text-gray-400 mb-1">
                Mes anterior:{" "}
                <span className="text-white font-medium">
                  {money(montoAnterior)}
                </span>
              </p>

              {/* VARIACIÓN */}
              <p
                className={`text-sm font-semibold ${variacionAbs >= 0 ? "text-green-400" : "text-red-400"
                  }`}
              >
                {variacionAbs >= 0 ? "▲" : "▼"}{" "}
                {money(Math.abs(variacionAbs))} ({variacionPorc.toFixed(1)}%)
              </p>
            </div>

          );
        })}
      </div>
    </div>
  );
};

export default ResumenVentasCanalUSD;
