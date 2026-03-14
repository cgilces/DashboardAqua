import React from "react";

interface Props {
  ruta: string;
  datos: any[];
}

const TablaDetallePreventas: React.FC<Props> = ({ ruta, datos }) => {
  const totalUnidades = datos.reduce((acc, d) => acc + (d.unidades || 0), 0);
  const totalUSD = datos.reduce((acc, d) => acc + (d.monto || 0), 0);

  return (
    <div className="overflow-x-auto bg-[#012E24] text-white rounded-lg shadow-md border border-[#046C5E] mt-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between px-4 py-4">
        <h2 className="text-lg md:text-xl font-bold text-green-400">
          Detalle por Producto - {ruta}
        </h2>
        <div className="flex gap-3 flex-wrap items-center">
          <div className="bg-[#011f1a] border border-[#046C5E] rounded-lg px-3 py-2 text-center">
            <p className="text-xs text-gray-400">Unidades</p>
            <p className="text-base font-bold text-green-400">{totalUnidades.toLocaleString()}</p>
          </div>
          <div className="bg-[#011f1a] border border-[#046C5E] rounded-lg px-3 py-2 text-center">
            <p className="text-xs text-gray-400">Dólares</p>
            <p className="text-base font-bold text-white">${totalUSD.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
          </div>
        </div>
      </div>
      <table className="min-w-full text-sm">
        <thead className="bg-[#014434] text-green-300 uppercase text-xs">
          <tr>
            <th className="px-4 py-3 text-left">Producto</th>
            <th className="px-4 py-3 text-right">Unidades</th>
            <th className="px-4 py-3 text-right">Dólares</th>
            <th className="px-4 py-3 text-right">Proyección</th>
            <th className="px-4 py-3 text-right">Vs Mes Anterior</th>
          </tr>
        </thead>
        <tbody>
          {datos.map((d, idx) => (
            <tr
              key={idx}
              className={`${
                idx % 2 === 0 ? "bg-[#013d32]" : "bg-[#014f3e]"
              } hover:bg-[#026452] transition`}
            >
              <td className="px-4 py-2 font-medium text-gray-100">
                {d.producto}
              </td>
              <td className="px-4 py-2 text-right text-green-400 font-semibold">
                {d.unidades.toLocaleString()}
              </td>
              <td className="px-4 py-2 text-right text-blue-400 font-semibold">
                ${d.monto.toLocaleString(undefined, {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </td>
              <td className="px-4 py-2 text-right text-green-300">
                {d.proyeccion ?? "-"}
              </td>
              <td
                className={`px-4 py-2 text-right ${
                  (d.variacion ?? 0) < 0 ? "text-red-400" : "text-green-400"
                }`}
              >
                {d.variacion ?? "-"}
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot className="bg-[#014434] font-bold text-gray-200 border-t border-[#046C5E]">
          <tr>
            <td className="px-4 py-3 text-left">Total</td>
            <td className="px-4 py-3 text-right text-green-400">
              {totalUnidades.toLocaleString()}
            </td>
            <td className="px-4 py-3 text-right text-blue-400">
              ${totalUSD.toLocaleString(undefined, {
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

export default TablaDetallePreventas;
