
const RankingRutasR = ({ data }: { data: any[] }) => {
  if (!data || data.length === 0) {
    return <p className="text-gray-400 text-center">No hay datos para mostrar.</p>;
  }

  return (
    <div className="overflow-x-auto bg-[#012E24] text-white rounded-lg shadow-md border border-[#046C5E] mt-6">
      <h2 className="text-xl font-bold px-4 py-3 bg-[#014434] text-green-300">
        Ranking R – Descartable
      </h2>

      <table className="min-w-full text-sm">
        <thead className="bg-[#014434] text-green-300 uppercase text-xs">
          <tr>
            <th className="px-4 py-3 text-left">Usuario</th>
            <th className="px-4 py-3 text-right">Unidades</th>
          </tr>
        </thead>

        <tbody>
          {data.map((r, index) => (
            <tr
              key={index}
              className={index % 2 === 0 ? "bg-[#013d32]" : "bg-[#014f3e]"}
            >
              <td className="px-4 py-2">{r.usuario}</td>
              <td className="px-4 py-2 text-right text-green-400 font-bold">
                {Number(r.sum_cantidad).toLocaleString()}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default RankingRutasR;
