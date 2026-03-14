import { useState, useEffect, useMemo } from "react";

interface ClienteTop {
  codigo: string;
  cliente: string;
  montoActual: number;
  montoAnterior: number;
  variacionMontoAbs: number;
  variacionMontoPorc: number | null;
}

export default function TopClientes({
  topClientes,
}: {
  topClientes: ClienteTop[];
}) {
  // 🔹 PAGINACIÓN
  const [pagina, setPagina] = useState(1);
  const itemsPorPagina = 10;

  // 🔹 ORDENACIÓN
  const [sortConfig, setSortConfig] = useState<{
    key: keyof ClienteTop;
    direction: "asc" | "desc";
  }>({
    key: "cliente",
    direction: "asc",
  });

  // 🧠 RESET AUTOMÁTICO CUANDO CAMBIA LA DATA
  useEffect(() => {
    setPagina(1);
  }, [topClientes]);

  // 🔹 ORDENACIÓN MEMORIZADA
  const sortedClientes = useMemo(() => {
    return [...topClientes].sort((a, b) => {
      const aValue: any = a[sortConfig.key];
      const bValue: any = b[sortConfig.key];

      if (aValue < bValue) {
        return sortConfig.direction === "asc" ? -1 : 1;
      }
      if (aValue > bValue) {
        return sortConfig.direction === "asc" ? 1 : -1;
      }
      return 0;
    });
  }, [topClientes, sortConfig]);

  // 🔹 PAGINACIÓN
  const totalPaginas = Math.ceil(sortedClientes.length / itemsPorPagina);

  const clientesPaginados = useMemo(() => {
    return sortedClientes.slice(
      (pagina - 1) * itemsPorPagina,
      pagina * itemsPorPagina
    );
  }, [sortedClientes, pagina]);

  const paginaAnterior = () => pagina > 1 && setPagina(pagina - 1);
  const paginaSiguiente = () =>
    pagina < totalPaginas && setPagina(pagina + 1);

  // 🔹 CAMBIO DE ORDEN
  const handleSort = (key: keyof ClienteTop) => {
    setSortConfig((prev) => ({
      key,
      direction:
        prev.key === key && prev.direction === "asc" ? "desc" : "asc",
    }));
  };

  const totalActual   = topClientes.reduce((a, c) => a + c.montoActual,   0);
  const totalAnterior = topClientes.reduce((a, c) => a + c.montoAnterior, 0);

  return (
    <div
      key={`top-clientes-${topClientes.length}`}
      className="overflow-x-auto bg-[#012E24] text-white rounded-lg shadow-md border border-[#046C5E] mt-6"
    >
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between px-4 py-4">
        <h2 className="text-lg md:text-xl font-bold text-blue-300">
          Top Clientes con Mayor Consumo
        </h2>
        <div className="flex gap-3 flex-wrap items-center">
          <div className="bg-[#011f1a] border border-[#046C5E] rounded-lg px-3 py-2 text-center">
            <p className="text-xs text-gray-400">Mes Actual</p>
            <p className="text-base font-bold text-white">${totalActual.toLocaleString("es-EC", { minimumFractionDigits: 2 })}</p>
          </div>
          <div className="bg-[#011f1a] border border-[#046C5E] rounded-lg px-3 py-2 text-center">
            <p className="text-xs text-gray-400">Mes Anterior</p>
            <p className="text-base font-bold text-blue-300">${totalAnterior.toLocaleString("es-EC", { minimumFractionDigits: 2 })}</p>
          </div>
        </div>
      </div>

      <table className="min-w-full text-sm border border-[#046C5E] rounded-lg">
        <thead className="bg-[#014434] text-green-300 uppercase text-xs">
          <tr>
            <th
              className="px-4 py-3 text-left cursor-pointer hover:text-white transition-colors select-none"
              onClick={() => handleSort("cliente")}
            >
              Cliente
            </th>

            <th
              className="px-4 py-3 text-right cursor-pointer hover:text-white transition-colors select-none"
              onClick={() => handleSort("montoActual")}
            >
              Mes Actual (USD)
            </th>

            <th
              className="px-4 py-3 text-right cursor-pointer hover:text-white transition-colors select-none"
              onClick={() => handleSort("montoAnterior")}
            >
              Mes Anterior (USD)
            </th>

            <th
              className="px-4 py-3 text-right cursor-pointer hover:text-white transition-colors select-none"
              onClick={() => handleSort("variacionMontoAbs")}
            >
              Variación
            </th>

            <th
              className="px-4 py-3 text-right cursor-pointer hover:text-white transition-colors select-none"
              onClick={() => handleSort("variacionMontoPorc")}
            >
              %
            </th>
          </tr>
        </thead>

        <tbody>
          {clientesPaginados.map((cli, idx) => (
            <tr
              key={`${cli.codigo}-${idx}`}
              className={`${
                idx % 2 === 0 ? "bg-[#013d32]" : "bg-[#014f3e]"
              } hover:bg-[#026452] transition`}
            >
              <td className="px-4 py-2">
                <b>{cli.cliente}</b>
                <br />
                <span className="text-[#6BAF8E] text-xs">
                  Código: {cli.codigo}
                </span>
              </td>

              <td className="px-4 py-2 text-right text-blue-400 font-semibold">
                ${cli.montoActual.toLocaleString("es-EC", { minimumFractionDigits: 2 })}
              </td>

              <td className="px-4 py-2 text-right text-blue-300 font-semibold">
                ${cli.montoAnterior.toLocaleString("es-EC", { minimumFractionDigits: 2 })}
              </td>

              <td
                className={`px-4 py-2 text-right font-semibold ${
                  cli.variacionMontoAbs >= 0
                    ? "text-green-400"
                    : "text-red-400"
                }`}
              >
                {cli.variacionMontoAbs >= 0 ? "+" : ""}
                ${cli.variacionMontoAbs.toLocaleString("es-EC", {
                  minimumFractionDigits: 2,
                })}
              </td>

              <td
                className={`px-4 py-2 text-right font-semibold ${
                  (cli.variacionMontoPorc ?? 0) >= 0
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
        <div className="flex justify-center mt-6 gap-2 pb-4">
          <button
            disabled={pagina === 1}
            onClick={paginaAnterior}
            className="px-3 py-1 rounded bg-[#046C5E] disabled:opacity-40"
          >
            ← Anterior
          </button>

          <span className="px-3 py-1 text-sm text-gray-300">
            Página {pagina} / {totalPaginas}
          </span>

          <button
            disabled={pagina === totalPaginas}
            onClick={paginaSiguiente}
            className="px-3 py-1 rounded bg-[#046C5E] disabled:opacity-40"
          >
            Siguiente →
          </button>
        </div>
      )}
    </div>
  );
}
