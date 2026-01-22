import React from "react";

/* ============================
   TIPOS CORRECTOS (REALES)
============================ */
interface VsMesAnterior {
  monto_anterior?: number;
  variacion_abs?: number;
  variacion_porc?: number | null;
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
    <div className="grid grid-cols-1 gap-6 mb-10">
      <div className="bg-[#] border border-[#046C5E] rounded-xl p-6">
        <h3 className="text-sm text-emerald-300 mb-6 uppercase">
          {titulo}
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {canales.map((canal) => {
            const d = data[canal];
            if (!d) return null;

            console.log("CARD DATA", canal, d);


            const monto = d.monto ?? 0;
            const unidades = d.unidades ?? 0;

            // const mesAnterior =
            //   d.vsMesAnterior?.monto_anterior ?? 0;

            // const variacionAbs =
            //   d.vsMesAnterior?.variacion_abs ?? 0;

            // const variacionPorc =
            //   d.vsMesAnterior?.variacion_porc ?? 0;

            // const signo = variacionAbs >= 0 ? "+" : "";

            return (
              <div
                key={canal}
                className="border border-[#046C5E] rounded-lg p-4 bg-[#01372C]"
              >
                <p className="text-xs text-gray-400 uppercase mb-1">
                  {CANALES_LABELS[canal] ?? canal}
                </p>

                <p className="text-3xl font-bold text-white">
                  {money(monto)}
                </p>

                {/* <p className="text-xs text-gray-300 mt-1">
                  Mes anterior: {money(mesAnterior)}
                </p>

                <p
                  className={`text-xs font-semibold mt-1 ${
                    variacionAbs >= 0
                      ? "text-green-400"
                      : "text-red-400"
                  }`}
                >
                  Variación: {signo}
                  {money(Math.abs(variacionAbs))} (
                  {variacionPorc.toFixed(1)}%)
                </p> */}

                <p className="text-xs text-gray-300 mt-2">
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
    </div>
  );
};

export default ResumenVentasCanalUSD;
