import { useNavigate } from "react-router-dom";

const RankingRutasR = ({
  data,
  anio,
  mes
}: {
  data: any[];
  anio: string;
  mes: string;
}) => {

  const navigate = useNavigate();

  if (!data || data.length === 0) {
    return <p className="text-gray-400 text-center">No hay datos para mostrar.</p>;
  }

  return (
    <div className="overflow-x-auto bg-[#012E24] text-white rounded-lg shadow-md border border-[#046C5E] mt-6">

      <h2 className="text-xl font-bold px-4 py-3 bg-[#014434] text-blue-300">
        Ranking R – Descartable
      </h2>

      <table className="min-w-full text-sm">
        <thead className="bg-[#014434] text-green-300 uppercase text-xs">
          <tr>
            <th className="px-4 py-3 text-left">Usuario</th>
            <th className="px-4 py-3 text-right">Unidades</th>
            <th className="px-4 py-3 text-right">Dólares</th>
            <th className="px-4 py-3 text-right">Metas</th>

            <th className="px-4 py-3 text-right">Proyeccion</th>
            <th className="px-4 py-3 text-right">Vs Mes Anterior</th>

          </tr>
        </thead>

        <tbody>
          {data.map((r, index) => (
            <tr
              key={index}
              onClick={() =>
                navigate(`/ruta/${r.usuario}?anio=${anio}&mes=${mes}`)
              }
              className={`transition-all duration-200 cursor-pointer
                ${index % 2 === 0 ? "bg-[#013d32]" : "bg-[#014f3e]"}
                hover:bg-[#016a57] hover:shadow-lg hover:text-white
                border-l-4 border-transparent hover:border-green-400
              `}
            >
              <td className="px-4 py-2 text-blue-300 font-bold">{r.usuario}</td>

              <td className="px-4 py-2 text-right text-green-400 font-bold">
                {Number(r.unidades).toLocaleString()}
              </td>

              <td className="px-4 py-2 text-right text-blue-300 font-bold">
                ${Number(r.dolares).toLocaleString("es-EC", {
                  minimumFractionDigits: 2
                })}
              </td>


                  <td className="px-4 py-2 text-right text-blue-300 font-bold">
                ${Number(r.meta).toLocaleString("es-EC", {
                  minimumFractionDigits: 2
                })}
              </td>


              <td className="px-4 py-2 text-right text-blue-300 font-bold">
                ${Number(r.proyeccion).toLocaleString("es-EC", {
                  minimumFractionDigits: 2
                })}





              </td>


              {/* VS MES ANTERIOR */}
              <td
                className={`px-4 py-2 text-right font-bold ${r.vsMesAnterior.variacion_abs >= 0 ? "text-green-400" : "text-red-400"
                  }`}
              >
                {r.vsMesAnterior.monto_anterior === 0 ? (
                  "Sin datos"
                ) : (
                  <>
                    ${Number(r.vsMesAnterior.variacion_abs).toLocaleString("es-EC", {
                      minimumFractionDigits: 2,
                    })}{" "}
                    (
                    {r.vsMesAnterior.variacion_porc !== null
                      ? `${r.vsMesAnterior.variacion_porc}%`
                      : "–"}
                    )
                  </>
                )}
              </td>



            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default RankingRutasR;
