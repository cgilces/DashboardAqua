import { useState } from "react";

/* ============================
   TIPOS
============================ */
interface VsMesAnterior {
  porcentaje: number;
  dolares: number;
}

interface ItemDetalle {
  codigo: string;
  unidades: number;
  dolares: number;
  meta: number;
  proyeccion: number;
  vsmesanterior?: VsMesAnterior | null;
}

interface Props {
  titulo: string;
  data?: ItemDetalle[];
  total?: {
    unidades: number;
    dolares: number;
    meta?: number;
    proyeccion?: number;
    vsmesanterior?: VsMesAnterior | null;
  };
}

type SortKey =
  | "codigo"
  | "unidades"
  | "dolares"
  | "meta"
  | "proyeccion"
  | "vsmesanterior";

/* ============================
   HELPERS (CLAVE)
============================ */
const money = (v: number | undefined) =>
  v != null ? `$${v.toLocaleString("es-EC", { minimumFractionDigits: 2 })}` : "$0,00";

const renderVsMesAnterior = (
  vs?: VsMesAnterior | null
) => {
  if (!vs) return "—";

  const { porcentaje, dolares } = vs;

  // Backend manda 0 → mostrar 0
  if (porcentaje === 0 || dolares === 0) {
    return "$0,00";
  }

  const color =
    porcentaje > 0 ? "text-green-400" : "text-red-400";

  const signo = porcentaje > 0 ? "+" : "";

  return (
    <span className={`font-semibold ${color}`}>
      ({signo}{porcentaje.toFixed(2)}%){" "}
      {money(Math.abs(dolares))}
    </span>
  );
};

/* ============================
   COMPONENTE
============================ */
const TablaBotellonGrupo: React.FC<Props> = ({
  titulo,
  data = [],
  total = { unidades: 0, dolares: 0 },
}) => {
  if (!Array.isArray(data)) return null;

  /* ============================
     ORDENAMIENTO
  ============================ */
  const [sortConfig, setSortConfig] = useState<{
    key: SortKey;
    direction: "asc" | "desc";
  }>({
    key: "dolares",
    direction: "desc",
  });

  const requestSort = (key: SortKey) => {
    let direction: "asc" | "desc" = "desc";
    if (sortConfig.key === key && sortConfig.direction === "desc") {
      direction = "asc";
    }
    setSortConfig({ key, direction });
  };

  const sortedData = [...data].sort((a, b) => {
    let aVal: number | string = 0;
    let bVal: number | string = 0;

    if (sortConfig.key === "vsmesanterior") {
      aVal = a.vsmesanterior?.dolares ?? 0;
      bVal = b.vsmesanterior?.dolares ?? 0;
    } else {
      aVal = a[sortConfig.key] as number | string;
      bVal = b[sortConfig.key] as number | string;
    }

    if (typeof aVal === "string") {
      return sortConfig.direction === "asc"
        ? aVal.localeCompare(bVal as string)
        : (bVal as string).localeCompare(aVal);
    }

    return sortConfig.direction === "asc"
      ? (aVal as number) - (bVal as number)
      : (bVal as number) - (aVal as number);
  });

  const iconSort = (key: SortKey) =>
    sortConfig.key === key
      ? sortConfig.direction === "asc"
        ? "↑"
        : "↓"
      : "↕";

  if (sortedData.length === 0) {
    return (
      <div className="bg-[#012E24] text-gray-400 rounded-lg p-4 border border-[#046C5E]">
        No hay datos para {titulo}
      </div>
    );
  }

  /* ============================
     RENDER
  ============================ */
  return (
    <div className="bg-[#012E24] text-white rounded-lg shadow-md border border-[#046C5E] mb-8">
      {/* HEADER */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between px-4 py-4">
        <div>
          <h2 className="text-lg md:text-xl font-bold text-green-300">{titulo}</h2>
          <p className="text-sm text-gray-300">Botellones – Órdenes + Facturas</p>
        </div>
        <div className="flex gap-3 flex-wrap items-center">
          <div className="bg-[#011f1a] border border-[#046C5E] rounded-lg px-3 py-2 text-center">
            <p className="text-xs text-gray-400">Unidades</p>
            <p className="text-base font-bold text-blue-300">{total.unidades.toLocaleString("es-EC")}</p>
          </div>
          <div className="bg-[#011f1a] border border-[#046C5E] rounded-lg px-3 py-2 text-center">
            <p className="text-xs text-gray-400">Dólares</p>
            <p className="text-base font-bold text-white">{money(total.dolares)}</p>
          </div>
          <div className="bg-[#011f1a] border border-[#046C5E] rounded-lg px-3 py-2 text-center">
            <p className="text-xs text-gray-400">Meta</p>
            <p className="text-base font-bold text-amber-300">{money(total.meta ?? 0)}</p>
          </div>
          <div className="bg-[#011f1a] border border-[#046C5E] rounded-lg px-3 py-2 text-center">
            <p className="text-xs text-gray-400">Proyección</p>
            <p className="text-base font-bold text-emerald-400">{money(total.proyeccion ?? 0)}</p>
          </div>
        </div>
      </div>

      {/* TABLA */}
      <div className="overflow-x-auto">
      <table className="min-w-full text-sm">
        <thead className="bg-[#014434] text-green-300 uppercase text-xs">
          <tr>
            <th onClick={() => requestSort("codigo")} className="px-4 py-3 text-left cursor-pointer hover:text-white transition-colors select-none">
              RUTA {iconSort("codigo")}
            </th>
            <th onClick={() => requestSort("unidades")} className="px-4 py-3 text-right cursor-pointer hover:text-white transition-colors select-none">
              UNIDADES {iconSort("unidades")}
            </th>
            <th onClick={() => requestSort("dolares")} className="px-4 py-3 text-right cursor-pointer hover:text-white transition-colors select-none">
              DÓLARES {iconSort("dolares")}
            </th>
            <th onClick={() => requestSort("meta")} className="px-4 py-3 text-right cursor-pointer hover:text-white transition-colors select-none">
              META {iconSort("meta")}
            </th>
            <th onClick={() => requestSort("proyeccion")} className="px-4 py-3 text-right cursor-pointer hover:text-white transition-colors select-none">
              PROYECCIÓN {iconSort("proyeccion")}
            </th>
            <th onClick={() => requestSort("vsmesanterior")} className="px-4 py-3 text-right cursor-pointer hover:text-white transition-colors select-none">
              VARIACIÓN {iconSort("vsmesanterior")}
            </th>
            <th onClick={() => requestSort("vsmesanterior")} className="px-4 py-3 text-right cursor-pointer hover:text-white transition-colors select-none">
              % {iconSort("vsmesanterior")}
            </th>
          </tr>
        </thead>

        <tbody>
          {sortedData.map((row, idx) => (
            <tr
              key={row.codigo}
              className={idx % 2 === 0 ? "bg-[#013d32]" : "bg-[#014f3e]"}
            >
              <td className="px-4 py-2 font-semibold">{row.codigo}</td>

              <td className="px-4 py-2 text-right text-green-400">
                {row.unidades !== undefined ? row.unidades.toLocaleString("es-EC") : "—"}
              </td>

              <td className="px-4 py-2 text-right text-blue-400 ">
                {money(row.dolares)}
              </td>

              <td className="px-4 py-2 text-right text-green-400">
                {money(row.meta)}
              </td>

              <td className="px-4 py-2 text-right text-blue-400">
                {money(row.proyeccion)}
              </td>

              {/* VARIACIÓN */}
              <td className={`px-4 py-2 text-right font-bold ${!row.vsmesanterior || row.vsmesanterior.dolares === 0 ? "text-gray-400" : row.vsmesanterior.dolares > 0 ? "text-green-400" : "text-red-400"}`}>
                {!row.vsmesanterior || (row.vsmesanterior.porcentaje === 0 && row.vsmesanterior.dolares === 0)
                  ? "—"
                  : `${row.vsmesanterior.dolares >= 0 ? "+" : "-"}$${Math.abs(row.vsmesanterior.dolares).toLocaleString("es-EC", { minimumFractionDigits: 2 })}`
                }
              </td>
              {/* % */}
              <td className={`px-4 py-2 text-right font-bold ${!row.vsmesanterior || row.vsmesanterior.dolares === 0 ? "text-gray-400" : row.vsmesanterior.porcentaje > 0 ? "text-green-400" : "text-red-400"}`}>
                {!row.vsmesanterior || (row.vsmesanterior.porcentaje === 0 && row.vsmesanterior.dolares === 0)
                  ? "—"
                  : `${row.vsmesanterior.porcentaje >= 0 ? "+" : ""}${row.vsmesanterior.porcentaje.toFixed(2)}%`
                }
              </td>
            </tr>
          ))}
        </tbody>

        {/* FOOTER */}
        <tfoot className="bg-[#014434] font-bold border-t border-[#046C5E]">
          <tr>
            <td className="px-4 py-3 text-white">
              TOTAL GENERAL
            </td>

            <td className="px-4 py-3 text-right text-blue-300">
              {total.unidades.toLocaleString("es-EC")}
            </td>

            <td className="px-4 py-3 text-right text-blue-300">
              {money(total.dolares)}
            </td>

            <td className="px-4 py-3 text-right text-blue-300">
              {money(total.meta ?? 0)}
            </td>

            <td className="px-4 py-3 text-right text-blue-300">
              {money(total.proyeccion ?? 0)}
            </td>

            <td className="px-4 py-3 text-right text-gray-400">—</td>
            <td className="px-4 py-3 text-right text-gray-400">—</td>
          </tr>
        </tfoot>
      </table>
      </div>
    </div>
  );
};

export default TablaBotellonGrupo;
