import { useState } from "react";

interface ClienteTop {
  codigo: string;
  cliente: string;
  montoActual: number;
  montoAnterior: number;
  variacionMontoAbs: number;
  variacionMontoPorc: number | null;
}

export default function TopClientes({ topClientes }: { topClientes: ClienteTop[] }) {

  // 🔹 PAGINACIÓN
  const [pagina, setPagina] = useState(1);
  const itemsPorPagina = 10;
  const [sortConfig, setSortConfig] = useState<{ key: keyof ClienteTop; direction: "asc" | "desc" }>({
    key: "cliente",
    direction: "asc",
  });

  // 🔹 FUNCION PARA ORDENAR Y PAGINAR
  const sortedClientes = [...topClientes].sort((a, b) => {
    const aValue = a[sortConfig.key];
    const bValue = b[sortConfig.key];
    if (aValue < bValue) {
      return sortConfig.direction === "asc" ? -1 : 1;
    }
    if (aValue > bValue) {
      return sortConfig.direction === "asc" ? 1 : -1;
    }
    return 0;
  });

  const totalPaginas = Math.ceil(sortedClientes.length / itemsPorPagina);
  const clientesPaginados = sortedClientes.slice(
    (pagina - 1) * itemsPorPagina,
    pagina * itemsPorPagina
  );

  const paginaAnterior = () => pagina > 1 && setPagina(pagina - 1);
  const paginaSiguiente = () =>
    pagina < totalPaginas && setPagina(pagina + 1);

  // 🔹 CAMBIAR LA ORDENACION AL HACER CLIC EN LA CABECERA
  const handleSort = (key: keyof ClienteTop) => {
    let direction: "asc" | "desc" = "asc";
    if (sortConfig.key === key && sortConfig.direction === "asc") {
      direction = "desc";
    }
    setSortConfig({ key, direction });
  };

  return (
    // <div className="mb-8">
    <div className="overflow-x-auto bg-[#012E24] text-white rounded-lg shadow-md border border-[#046C5E] mt-6">

      <h2 className="text-xl font-bold px-4 py-3 text-blue-300">

        {/* <h2 className="text-lg font-semibold mb-4 text-center"> */}
        Top 20 Clientes con Mayor Consumo
      </h2>

      <table className="min-w-full text-sm border border-[#046C5E] rounded-lg">
        <thead className="bg-[#014434] text-green-300 uppercase text-xs">
          <tr>
            <th
              className="px-4 py-3 text-left cursor-pointer"
              onClick={() => handleSort("cliente")}
            >
              Cliente
              <span className="text-[#6BAF8E] ml-1">
                {sortConfig.key === "cliente"
                  ? sortConfig.direction === "asc"
                    ? "↑"
                    : "↓"
                  : "↕"}
              </span>
            </th>

            <th
              className="px-4 py-3 text-right cursor-pointer"
              onClick={() => handleSort("montoActual")}
            >
              Mes Actual (USD)
              <span className="text-[#6BAF8E] ml-1">
                {sortConfig.key === "montoActual"
                  ? sortConfig.direction === "asc"
                    ? "↑"
                    : "↓"
                  : "↕"}
              </span>
            </th>

            <th
              className="px-4 py-3 text-right cursor-pointer"
              onClick={() => handleSort("montoAnterior")}
            >
              Mes Anterior (USD)
              <span className="text-[#6BAF8E] ml-1">
                {sortConfig.key === "montoAnterior"
                  ? sortConfig.direction === "asc"
                    ? "↑"
                    : "↓"
                  : "↕"}
              </span>
            </th>

            <th
              className="px-4 py-3 text-right cursor-pointer"
              onClick={() => handleSort("variacionMontoAbs")}
            >
              Variación
              <span className="text-[#6BAF8E] ml-1">
                {sortConfig.key === "variacionMontoAbs"
                  ? sortConfig.direction === "asc"
                    ? "↑"
                    : "↓"
                  : "↕"}
              </span>
            </th>

            <th
              className="px-4 py-3 text-right cursor-pointer"
              onClick={() => handleSort("variacionMontoPorc")}
            >
              %
              <span className="text-[#6BAF8E] ml-1">
                {sortConfig.key === "variacionMontoPorc"
                  ? sortConfig.direction === "asc"
                    ? "↑"
                    : "↓"
                  : "↕"}
              </span>
            </th>
          </tr>
        </thead>

        <tbody>
          {clientesPaginados.map((cli, idx) => (
            <tr
              key={`cli-${cli.codigo}-${idx}`}
              className={`${idx % 2 === 0 ? "bg-[#013d32]" : "bg-[#014f3e]"
                } hover:bg-[#026452] transition`}
            >
              <td className="px-4 py-2 text-white">
                <b>{cli.cliente}</b>
                <br />
                <span className="text-[#6BAF8E] text-xs">
                  Código: {cli.codigo}
                </span>
              </td>

              <td className="px-4 py-2 text-right text-blue-400 font-semibold">
                ${cli.montoActual.toLocaleString(undefined, {
                  minimumFractionDigits: 2,
                })}
              </td>

              <td className="px-4 py-2 text-right text-blue-300 font-semibold">
                ${cli.montoAnterior.toLocaleString(undefined, {
                  minimumFractionDigits: 2,
                })}
              </td>

              <td
                className={`px-4 py-2 text-right font-semibold ${cli.variacionMontoAbs >= 0
                  ? "text-green-400"
                  : "text-red-400"
                  }`}
              >
                {cli.variacionMontoAbs >= 0 ? "+" : ""}
                ${cli.variacionMontoAbs.toLocaleString(undefined, {
                  minimumFractionDigits: 2,
                })}
              </td>

              <td
                className={`px-4 py-2 text-right font-semibold ${(cli.variacionMontoPorc ?? 0) >= 0
                  ? "text-green-400"
                  : "text-red-400"
                  }`}
              >
                {cli.variacionMontoPorc !== null
                  ? `${cli.variacionMontoPorc.toFixed(1)}%`
                  : "N/A"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* PAGINACIÓN */}
      {totalPaginas > 1 && (
        <div className="flex justify-center mt-6 gap-2">
          {/* ⬅️ ANTERIOR */}
          <button
            disabled={pagina === 1}
            onClick={paginaAnterior}
            className={`px-3 py-1 rounded-md flex items-center justify-center
        ${pagina === 1
                ? "bg-gray-700 text-gray-500 cursor-not-allowed"
                : "bg-[#046C5E] hover:bg-[#058A73]"
              }`}
          >
            <span className="sm:hidden">←</span>
            <span className="hidden sm:inline">← Anterior</span>
          </button>

          {/* 🔢 NÚMEROS */}
          {(() => {
            const pages = [];
            const maxVisible = 5;

            if (totalPaginas <= maxVisible) {
              for (let i = 1; i <= totalPaginas; i++) pages.push(i);
            } else {
              pages.push(1);

              if (pagina > 3) pages.push("...");

              const start = Math.max(2, pagina - 1);
              const end = Math.min(totalPaginas - 1, pagina + 1);

              for (let i = start; i <= end; i++) pages.push(i);

              if (pagina < totalPaginas - 2) pages.push("...");

              pages.push(totalPaginas);
            }

            return pages.map((num, idx) =>
              num === "..." ? (
                <span
                  key={`dots-${idx}`}
                  className="px-2 py-1 text-gray-400 select-none"
                >
                  ...
                </span>
              ) : (
                <button
                  key={`page-${num}`}
                  onClick={() => setPagina(num)}
                  className={`px-3 py-1 rounded-md
              ${pagina === num
                      ? "bg-green-500 text-black font-bold"
                      : "bg-[#01382D] hover:bg-[#025f4b]"
                    }`}
                >
                  {num}
                </button>
              )
            );
          })()}

          {/* ➡️ SIGUIENTE */}
          <button
            disabled={pagina === totalPaginas}
            onClick={paginaSiguiente}
            className={`px-3 py-1 rounded-md flex items-center justify-center
        ${pagina === totalPaginas
                ? "bg-gray-700 text-gray-500 cursor-not-allowed"
                : "bg-[#046C5E] hover:bg-[#058A73]"
              }`}
          >
            <span className="sm:hidden">→</span>
            <span className="hidden sm:inline">Siguiente →</span>
          </button>
        </div>
      )}

    </div>

  );
}
