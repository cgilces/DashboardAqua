import React from "react";
import { useNavigate } from "react-router-dom";

interface Props {
  datos: any;
  anio: number | string;   // ahora OBLIGATORIOS
  mes: number | string;    // ahora OBLIGATORIOS
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

  // Lista de preventas
  const preventas = datos.rankingPreventas;

  // Totales generales
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

      {/* 🔧 BOTÓN GENERAL PARA CONFIGURAR METAS */}
      <div className="flex justify-end mb-4">
        <button
          onClick={() => navigate("/configurar-metas")}
          className="bg-[#0db48b] hover:bg-[#0aa77e] text-black font-semibold px-4 py-2 rounded-lg shadow-md transition flex items-center gap-2"
        >
          <span>⚙️</span> Configurar Metas
        </button>
      </div>

      <table className="min-w-full text-sm">
        {/* ENCABEZADO */}
        <thead className="bg-[#014434] text-green-300 uppercase text-xs">
          <tr>
            <th className="px-4 py-3 text-left">Ruta / Preventa</th>
            <th className="px-4 py-3 text-right">Unidades</th>
            <th className="px-4 py-3 text-right">Dólares</th>
            <th className="px-4 py-3 text-right">Proyección</th>
            <th className="px-4 py-3 text-right">Vs Mes Anterior</th>
          </tr>
        </thead>

        {/* CUERPO */}
        <tbody>
          {preventas.map((p: any, idx: number) => {
            // Proyección (-2%)
            const proyeccion = -2;
            const meta = (p.unidades * (1 + proyeccion / 100)).toFixed(0);

            // Variación real del backend
            const variacion =
              p.vsMesAnterior?.variacion_porc !== undefined
                ? p.vsMesAnterior.variacion_porc
                : 0;

            const unidadesAnterior =
              p.vsMesAnterior?.unidades_anterior ?? 0;

            const variacionTexto =
              `${variacion > 0 ? "+" : ""}${variacion}% (${unidadesAnterior})`;

            return (
              <tr
                key={idx}
                onClick={() =>
                  //  navigate(`/detalle-ruta/${p.preventa}?anio=${anio}&mes=${mes}`)
                  navigate(`/detalle-ruta/${p.preventa}/${anio}/${mes}`)                
                }
                className={`cursor-pointer ${
                  idx % 2 === 0 ? "bg-[#013d32]" : "bg-[#014f3e]"
                } hover:bg-[#026452] transition`}
                title={`Ver detalle de ${p.preventa}`}
              >
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

                <td className="px-4 py-2 text-right text-green-300">
                  {proyeccion}% ({meta})
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

        {/* PIE DE TABLA */}
        <tfoot className="bg-[#014434] font-bold text-gray-200 border-t border-[#046C5E]">
          <tr>
            <td className="px-4 py-3 text-left">Total</td>

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

            <td colSpan={2}></td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
};

export default RankingPreventas;
