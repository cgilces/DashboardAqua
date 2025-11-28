// src/components/TopClientes.tsx
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

  const totalPaginas = Math.ceil(topClientes.length / itemsPorPagina);

  const clientesPaginados = topClientes.slice(
    (pagina - 1) * itemsPorPagina,
    pagina * itemsPorPagina
  );

  const paginaAnterior = () => pagina > 1 && setPagina(pagina - 1);
  const paginaSiguiente = () =>
    pagina < totalPaginas && setPagina(pagina + 1);

  return (
    <div className="tarjeta fade-in mb-8">
      <h2 className="text-lg font-semibold mb-4">
        Top 20 Clientes con Mayor Consumo
      </h2>

      <table className="w-full text-sm">
        <thead>
          <tr className="text-gray-400 border-b border-gray-700">
            <th className="text-left py-2">Cliente</th>
            <th className="text-right py-2">Mes Actual (USD)</th>
            <th className="text-right py-2">Mes Anterior (USD)</th>
            <th className="text-right py-2">Variación</th>
            <th className="text-right py-2">%</th>
          </tr>
        </thead>

        <tbody>
          {clientesPaginados.map((cli) => (
            <tr
              key={cli.codigo}
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
                {cli.variacionMontoPorc !== null && cli.variacionMontoPorc !== undefined
                  ? (cli.variacionMontoPorc ?? 0).toFixed(1)
                  : "N/A"}
              </td>

            </tr>
          ))}
        </tbody>
      </table>

      {/* PAGINACIÓN */}
      {totalPaginas > 1 && (
        <div className="flex justify-between items-center mt-4 text-sm text-gray-300">
          <button
            onClick={paginaAnterior}
            disabled={pagina === 1}
            className={`px-4 py-2 rounded-lg bg-[#046C5E] hover:bg-[#058A73] transition ${pagina === 1 ? "opacity-40 cursor-not-allowed" : ""
              }`}
          >
            ⬅️ Anterior
          </button>

          <span>
            Página {pagina} de {totalPaginas}
          </span>

          <button
            onClick={paginaSiguiente}
            disabled={pagina === totalPaginas}
            className={`px-4 py-2 rounded-lg bg-[#046C5E] hover:bg-[#058A73] transition ${pagina === totalPaginas ? "opacity-40 cursor-not-allowed" : ""
              }`}
          >
            Siguiente ➡️
          </button>
        </div>
      )}
    </div>
  );
}
