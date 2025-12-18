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
    <div className="tarjeta fade-in mb-8">
      <h2 className="text-lg font-semibold mb-4">
        Top 20 Clientes con Mayor Consumo
      </h2>

      <table className="w-full text-sm">
        <thead>
          <tr className="text-gray-400 border-b border-gray-700">
            <th className="text-left py-2" onClick={() => handleSort("cliente")}>
              Cliente {sortConfig.key === "cliente" ? (sortConfig.direction === 'asc' ? '↑' : '↓') : '↕'}
            </th>

            <th className="text-right py-2" onClick={() => handleSort("montoActual")}>
              Mes Actual (USD) {sortConfig.key === "montoActual" ? (sortConfig.direction === 'asc' ? '↑' : '↓') : '↕'}
            </th>
            <th className="text-right py-2" onClick={() => handleSort("montoAnterior")}>
              Mes Anterior (USD) {sortConfig.key === "montoAnterior" ? (sortConfig.direction === 'asc' ? '↑' : '↓') : '↕'}
            </th>
            <th className="text-right py-2" onClick={() => handleSort("variacionMontoAbs")}>
              Variación {sortConfig.key === "variacionMontoAbs" ? (sortConfig.direction === 'asc' ? '↑' : '↓') : '↕'}
            </th>
            <th className="text-right py-2" onClick={() => handleSort("variacionMontoPorc")}>
              % {sortConfig.key === "variacionMontoPorc" ? (sortConfig.direction === 'asc' ? '↑' : '↓') : '↕'}
            </th>         
          </tr>
        </thead>

        <tbody>
          {clientesPaginados.map((cli, idx) => (
            <tr
              key={`cli-${cli.codigo}-${cli.montoActual}-${idx}`}
              className="border-b border-gray-800 hover:bg-[#013c30]"
            >
              <td>
                <b>{cli.cliente}</b>
                <br />
                <span className="text-gray-400 text-xs">
                  Código: {cli.codigo}
                </span>
              </td>

              <td className="text-right">
                ${cli.montoActual.toLocaleString(undefined, {
                  minimumFractionDigits: 2,
                })}
              </td>

              <td className="text-right">
                ${cli.montoAnterior.toLocaleString(undefined, {
                  minimumFractionDigits: 2,
                })}
              </td>

              <td
                className={`text-right ${cli.variacionMontoAbs >= 0
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
                className={`text-right ${(cli.variacionMontoPorc ?? 0) >= 0
                    ? "text-green-400"
                    : "text-red-400"
                  }`}
              >
                {cli.variacionMontoPorc !== null
                  ? cli.variacionMontoPorc.toFixed(1)
                  : "N/A"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* PAGINACIÓN */}
      {totalPaginas > 1 && (
        <div className="flex justify-between items-center mt-4 text-sm text-gray-300">
          {/* Botón Anterior */}
          <button
            onClick={paginaAnterior}
            disabled={pagina === 1}
            className={`px-4 py-2 rounded-lg bg-[#046C5E] hover:bg-[#058A73] transition flex items-center justify-center
              ${pagina === 1 ? "opacity-40 cursor-not-allowed" : ""}
            `}
          >
            <span className="sm:hidden">⬅️</span>
            <span className="hidden sm:inline">⬅️ Anterior</span>
          </button>

          {/* Indicador */}
          <span className="mx-2">
            Página {pagina} de {totalPaginas}
          </span>

          {/* Botón Siguiente */}
          <button
            onClick={paginaSiguiente}
            disabled={pagina === totalPaginas}
            className={`px-4 py-2 rounded-lg bg-[#046C5E] hover:bg-[#058A73] transition flex items-center justify-center
              ${pagina === totalPaginas ? "opacity-40 cursor-not-allowed" : ""}
            `}
          >
            <span className="sm:hidden">➡️</span>
            <span className="hidden sm:inline">Siguiente ➡️</span>
          </button>
        </div>
      )}
    </div>
  );
}
