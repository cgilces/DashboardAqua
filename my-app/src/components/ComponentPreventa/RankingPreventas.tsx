import React from "react";
import { useNavigate } from "react-router-dom";

interface Props {
  datos: any;
  anio: number | string;
  mes: number | string;
}

const RankingPreventas: React.FC<Props> = ({ datos, anio, mes }) => {
  const navigate = useNavigate();

  if (!datos || !datos.rankingPreventas) {
    return (
      <p className="text-center text-gray-400 py-4">
        No hay datos disponibles para mostrar.
      </p>
    );
  }

  const preventas = datos.rankingPreventas;

  // Totales
  const totalUnidades = preventas.reduce(
    (acc: number, p: any) => acc + (p.unidades || 0),
    0
  );

  const totalUSD = preventas.reduce(
    (acc: number, p: any) => acc + (p.monto || 0),
    0
  );

  return (
    <div className="overflow-x-auto bg-[#012E24] text-white rounded-lg shadow-md border border-[#046C5E]">

      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-bold px-4 py-3 text-blue-300">
          RANKING PREVENTA
        </h2>

        <button
          onClick={() => navigate("/configurar-metas")}
          className="bg-[#0db48b] hover:bg-[#0aa77e] text-black font-semibold px-4 py-2 rounded-lg shadow-md transition flex items-center gap-2"
        >
          <span>⚙️</span> Configurar Metas
        </button>
      </div>

      <table className="min-w-full text-sm">
        <thead className="bg-[#014434] text-green-300 uppercase text-xs">
          <tr>
            <th className="px-4 py-3 text-left">N*</th>
            <th className="px-4 py-3 text-left">Ruta / Preventa</th>
            <th className="px-4 py-3 text-right">Unidades</th>
            <th className="px-4 py-3 text-right">Dólares</th>
            <th className="px-4 py-3 text-right">Meta</th>
            <th className="px-4 py-3 text-right">Proyección</th>
            <th className="px-4 py-3 text-right">Vs Mes Anterior</th>
          </tr>
        </thead>

        <tbody>
          {preventas.map((p: any, idx: number) => {
            const meta = Number(p.meta) || 0;
            const proy = Number(p.proyeccion) || 0;

            // ----------- PROYECCIÓN REAL -----------
            const porcProy =
              meta > 0 ? ((proy / meta) * 100).toFixed(1) : "0.0";

            // ----------- VARIACIÓN REAL -----------
            const variacion =
              p.vsMesAnterior?.variacion_porc ?? 0;

            const montoAnterior =
              p.vsMesAnterior?.monto_anterior ?? 0;

            const variacionTexto = `${variacion > 0 ? "+" : ""}${variacion}% ($${montoAnterior.toLocaleString(
              undefined,
              { minimumFractionDigits: 2, maximumFractionDigits: 2 }
            )})`;

            return (
              <tr
                key={idx}
                onClick={() =>
                  navigate(`/detalle-ruta/${p.preventa}/${anio}/${mes}`)
                }
                className={`cursor-pointer ${
                  idx % 2 === 0 ? "bg-[#013d32]" : "bg-[#014f3e]"
                } hover:bg-[#026452] transition`}
                title={`Ver detalle de ${p.preventa}`}
              >
                <td className="px-4 py-2 font-medium text-gray-100">
                  {idx + 1}
                </td>

                <td className="px-4 py-2 font-medium text-gray-100 underline decoration-dotted hover:text-green-300">
                  {p.preventa}
                </td>

                <td className="px-4 py-2 text-right text-green-400 font-semibold">
                  {p.unidades?.toLocaleString() ?? "0"}
                </td>

                <td className="px-4 py-2 text-right text-blue-400 font-semibold">
                  $
                  {p.monto?.toLocaleString(undefined, {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  }) ?? "0.00"}
                </td>

                <td className="px-4 py-2 text-right text-blue-400 font-semibold">
                  $
                  {meta.toLocaleString(undefined, {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </td>

                {/* 🔥 PROYECCIÓN REAL: % + ($VALOR) */}
                <td className="px-4 py-2 text-right font-bold">
                  <span className="text-green-300">
                    {porcProy}%
                  </span>{" "}
                  <span className="text-blue-300">
                    ($
                    {proy.toLocaleString("es-EC", {
                      minimumFractionDigits: 2,
                    })}
                    )
                  </span>
                </td>

                <td
                  className={`px-4 py-2 text-right ${
                    variacion < 0
                      ? "text-red-400"
                      : variacion > 0
                      ? "text-green-400"
                      : "text-gray-300"
                  }`}
                >
                  {variacionTexto}
                </td>
              </tr>
            );
          })}
        </tbody>

        <tfoot className="bg-[#014434] font-bold text-gray-200 border-t border-[#046C5E]">
          <tr>
            <td className="px-4 py-3 text-left">Total</td>
            <td className="px-4 py-3"></td>

            <td className="px-4 py-3 text-right text-green-400">
              {totalUnidades.toLocaleString()}
            </td>

            <td className="px-4 py-3 text-right text-blue-400">
              $
              {totalUSD.toLocaleString(undefined, {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </td>

            <td colSpan={3}></td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
};

export default RankingPreventas;
