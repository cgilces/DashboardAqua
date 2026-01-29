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
  unidades?: number;
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

      <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
        {canales.map((canal) => {
          const d = data[canal];
          if (!d) return null;

          const monto = d.monto ?? 0;
          const unidades = d.unidades ?? 0;

          const mesAnterior = d.vsMesAnterior;
          const montoAnterior = mesAnterior?.monto_anterior ?? 0;
          const variacionAbs = mesAnterior?.variacion_abs ?? 0;
          const variacionPorc = mesAnterior?.variacion_porc ?? 0;

          return (
            <div
              key={canal}
              className="
                bg-[#012E24] border border-[#046C5E] rounded-xl p-4
                text-center md:text-left
                flex flex-col items-center md:items-start
              "
            >
              {/* CANAL */}
              <p
                className="
                  uppercase mb-1 font-bold
                  text-base md:text-xs
                  text-blue-300
                  text-center md:text-left
                "
              >
                {CANALES_LABELS[canal] ?? canal}
              </p>

              {/* MONTO */}
              <p className="text-2xl font-bold text-white">
                {money(monto)}
              </p>

              {/* MES ANTERIOR */}
              <p className="text-xs text-gray-300">
                Mes anterior: {money(montoAnterior)}
              </p>

              {/* VARIACIÓN */}
              <p
                className={`text-xs font-semibold ${
                  variacionAbs >= 0 ? "text-green-400" : "text-red-400"
                }`}
              >
                Variación:{" "}
                {variacionAbs >= 0 ? "+" : "-"}
                {money(Math.abs(variacionAbs))} (
                {variacionPorc.toFixed(1)}%)
              </p>

              {/* UNIDADES */}
              <p className="text-xs text-gray-300 mt-1">
                Unidades:{" "}
                <span className="font-semibold">
                  {unidades.toLocaleString("es-EC")}
                </span>
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default ResumenVentasCanalUSD;
