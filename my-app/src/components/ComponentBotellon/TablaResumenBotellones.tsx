import { useNavigate } from "react-router-dom";
import { useState } from "react";

/* ============================
   TIPOS
============================ */
interface VsMesAnterior {
  porcentaje: number;
  dolares: number;
}

interface TotalGrupo {
  unidades: number;
  dolares: number;
  meta?: number;
  proyeccion?: number;
  vsmesanterior?: VsMesAnterior | null;
}

interface GrupoBotellon {
  total: TotalGrupo;
}

interface Props {
  botellones: Record<string, GrupoBotellon>;
  anio: number;
  mes: number;
}

type SortKey =
  | "grupo"
  | "unidades"
  | "dolares"
  | "meta"
  | "proyeccion"
  | "vsmesanterior";

/* ============================
   COMPONENTE
============================ */
export default function TablaResumenBotellones({
  botellones,
  anio,
  mes,
}: Props) {
  const navigate = useNavigate();

  /* ============================
     ORDENAMIENTO
  ============================ */
  const [sortConfig, setSortConfig] = useState<{
    key: SortKey;
    direction: "asc" | "desc";
  }>({
    key: "grupo",
    direction: "asc",
  });

  /* ============================
     DATA NORMALIZADA
  ============================ */
  const filas = Object.entries(botellones).map(([grupo, info]) => ({
    grupo,
    unidades: Number(info.total.unidades || 0),
    dolares: Number(info.total.dolares || 0),
    meta: Number(info.total.meta || 0),
    proyeccion: Number(info.total.proyeccion || 0),
    vsmesanterior: info.total.vsmesanterior ?? null,
  }));

  /* ============================
     ORDENAR DATA
  ============================ */
  const sortedData = [...filas].sort((a, b) => {
    const { key, direction } = sortConfig;

    if (key === "vsmesanterior") {
      const aVal = a.vsmesanterior?.porcentaje ?? 0;
      const bVal = b.vsmesanterior?.porcentaje ?? 0;
      return direction === "asc" ? aVal - bVal : bVal - aVal;
    }

    const aValue = a[key];
    const bValue = b[key];

    if (typeof aValue === "string") {
      return direction === "asc"
        ? aValue.localeCompare(bValue as string)
        : (bValue as string).localeCompare(aValue);
    }

    return direction === "asc"
      ? (aValue as number) - (bValue as number)
      : (bValue as number) - (aValue as number);
  });

  const requestSort = (key: SortKey) => {
    let direction: "asc" | "desc" = "asc";
    if (sortConfig.key === key && sortConfig.direction === "asc") {
      direction = "desc";
    }
    setSortConfig({ key, direction });
  };

  /* ============================
     HELPERS
  ============================ */
  const money = (v: number) =>
    `$${v.toLocaleString("es-EC", { minimumFractionDigits: 2 })}`;

  const formatVsMesAnterior = (vs?: VsMesAnterior | null) => {
    if (!vs) return "—";

    const pct = vs.porcentaje;
    const val = vs.dolares;

    if (pct === 0 && val === 0) return "$0,00";

    const signo = pct > 0 ? "+" : "";
    return `(${signo}${pct.toFixed(2)}%) $${Math.abs(val).toLocaleString(
      "es-EC",
      { minimumFractionDigits: 2 }
    )}`;
  };

  const colorVs = (vs?: VsMesAnterior | null) => {
    if (!vs) return "text-gray-400";
    if (vs.dolares > 0) return "text-green-400";
    if (vs.dolares < 0) return "text-red-400";
    return "text-gray-400";
  };

  /* ============================
     UI
  ============================ */
  return (
    <div className="bg-[#012E24] rounded-lg border border-[#046C5E] mb-10">
      {/* HEADER */}
      <div className="px-4 py-3 border-b border-[#046C5E]">
        <h2 className="text-xl font-bold text-green-300">
          Resumen General Botellones
        </h2>
        <p className="text-sm text-gray-300">
          Totales por grupo comercial (Facturas + Órdenes no facturadas)
        </p>
      </div>

      {/* TABLA */}
      <table className="w-full text-sm">
        <thead className="bg-[#014434] text-green-300 uppercase text-xs">
          <tr>
            <th className="px-4 py-3 text-left">N°</th>
            <th onClick={() => requestSort("grupo")} className="px-4 py-3 text-left cursor-pointer hover:text-white transition-colors select-none">
              Grupo
            </th>
            <th onClick={() => requestSort("unidades")} className="px-4 py-3 text-right cursor-pointer hover:text-white transition-colors select-none">
              Unidades
            </th>
            <th onClick={() => requestSort("dolares")} className="px-4 py-3 text-right cursor-pointer hover:text-white transition-colors select-none">
              Dólares
            </th>
            <th onClick={() => requestSort("meta")} className="px-4 py-3 text-right cursor-pointer hover:text-white transition-colors select-none">
              Meta
            </th>
            <th onClick={() => requestSort("proyeccion")} className="px-4 py-3 text-right cursor-pointer hover:text-white transition-colors select-none">
              Proyección
            </th>
            <th onClick={() => requestSort("vsmesanterior")} className="px-4 py-3 text-right cursor-pointer hover:text-white transition-colors select-none">
              Vs Mes Anterior
            </th>
          </tr>
        </thead>

        <tbody>
          {sortedData.map((row, idx) => (
            <tr
              key={row.grupo}
              onClick={() =>
                navigate(
                  `/dashboard/botellon/grupo/${row.grupo}?anio=${anio}&mes=${mes}`
                )
              }
              className={`cursor-pointer ${
                idx % 2 === 0 ? "bg-[#013d32]" : "bg-[#014f3e]"
              } hover:bg-[#026452] transition`}
            >
              <td className="px-4 py-2 text-gray-300">{idx + 1}</td>

              <td className="px-4 py-2 font-semibold text-white">
                {row.grupo.split(",").join("")}
              </td>

              <td className="px-4 py-2 text-right text-green-400 font-semibold">
                {row.unidades.toLocaleString("es-EC")}
              </td>

              <td className="px-4 py-2 text-right text-blue-400 font-semibold">
                {money(row.dolares)}
              </td>

              <td className="px-4 py-2 text-right text-gray-300">
                {row.meta ? money(row.meta) : "—"}
              </td>

              <td className="px-4 py-2 text-right text-gray-300">
                {row.proyeccion ? money(row.proyeccion) : "—"}
              </td>

              <td
                className={`px-4 py-2 text-right font-semibold ${colorVs(
                  row.vsmesanterior
                )}`}
              >
                {formatVsMesAnterior(row.vsmesanterior)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
