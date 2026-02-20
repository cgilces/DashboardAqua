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
const KpisHielo: React.FC<Props> = ({ kpis, comparativa, totalProyeccion }) => {
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
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-10">

      {/* ===========================
        CARD UNIDADES HIELO
    =========================== */}
      <div className="
      bg-gradient-to-br from-[#012E24] to-[#014034]
      border border-[#046C5E]/40
      rounded-2xl p-6
      shadow-lg
      transition-all duration-300
      hover:shadow-xl
    ">
        <p className="uppercase tracking-wider text-xs text-blue-300 font-bold mb-4 text-center">

          Unidades Hielo
        </p>

        <p className="text-4xl font-bold text-white">
          <span className="text-sm text-gray-400 mr-1">Unidades:</span>
          {kpis.unidadesTotales.toLocaleString("es-EC")}
        </p>

        {comparativa?.unidades && (
          <div className="mt-4 border-t border-[#046C5E]/40 pt-3 text-sm">
            <p className="text-gray-400">
              Mes anterior:{" "}
              <span className="text-white font-medium">
                {comparativa.unidades.anterior.toLocaleString("es-EC")}
              </span>
            </p>

            <p className="text-gray-400">
              Mes actual:{" "}
              <span className="text-white font-medium">
                {comparativa.unidades.actual.toLocaleString("es-EC")}
              </span>
            </p>

            <p className={`font-semibold ${colorVariacion(comparativa.unidades)}`}>
              {comparativa.unidades.variacionAbs >= 0 ? "▲" : "▼"}{" "}
              {comparativa.unidades.variacionPorc?.toFixed(1)}%{" "}
              ({comparativa.unidades.variacionAbs >= 0 ? "+" : ""}
              {comparativa.unidades.variacionAbs.toLocaleString("es-EC")})
            </p>
          </div>
        )}

      </div>

      {/* ===========================
        CARD VENTAS USD
    =========================== */}
      <div className="
      bg-gradient-to-br from-[#012E24] to-[#014034]
      border border-[#046C5E]/40
      rounded-2xl p-6
      shadow-lg
      transition-all duration-300
      hover:shadow-xl
    ">
        <p className="uppercase tracking-wider text-xs text-blue-300 font-bold mb-4 text-center">
          Ventas USD
        </p>

        <p className="text-4xl font-bold text-emerald-400">
          <span className="text-sm text-gray-400 mr-1">Proyección_Dolares:</span>

          {money(kpis.montoTotal)}
        </p>

        {comparativa?.monto && (
          <div className="mt-4 border-t border-[#046C5E]/40 pt-3 text-sm">
            <p className="text-gray-400">
              Mes anterior:{" "}
              <span className="text-white font-medium">
                {money(comparativa.monto.anterior)}
              </span>
            </p>

            <p className="text-gray-400">
              Mes actual:{" "}
              <span className="text-white font-medium">
                {money(comparativa.monto.actual)}
              </span>
            </p>

            <p className={`font-semibold ${colorVariacion(comparativa.monto)}`}>
              {comparativa.monto.variacionAbs >= 0 ? "▲" : "▼"}{" "}
              {comparativa.monto.variacionPorc?.toFixed(1)}%{" "}
              ({comparativa.monto.variacionAbs >= 0 ? "+" : ""}
              {money(Math.abs(comparativa.monto.variacionAbs))})
            </p>
          </div>
        )}

      </div>

    </div>
  );

};

export default KpisHielo;
