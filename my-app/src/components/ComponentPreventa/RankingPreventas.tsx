import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import * as XLSX from "xlsx";
import { useAuth } from "../../components/auth/AuthContext";
import { BsDownload, BsGear } from "react-icons/bs";

/* ───────────────── TIPOS ───────────────── */

interface VsMesAnterior {
  monto_anterior: number;
  variacion_abs: number;
}

interface Preventa {
  preventa: string;
  unidades: number;
  monto: number;
  meta: number;
  proyeccion: number;

  objetivo_gerencia?: number;
  objetivo_gerencia_unidades?: number;

  vsMesAnterior?: VsMesAnterior;
}

interface Datos {
  rankingPreventas: Preventa[];
}

interface Props {
  datos: Datos;
  anio: number | string;
  mes: number | string;
}

type SortKey =
  | "N*"
  | "preventa"
  | "unidades"
  | "monto"
  | "meta"
  | "objetivo_gerencia"
  | "proyeccion"
  | "vsMesAnterior";

/* ───────────────── HELPERS ───────────────── */

const fmt = (v: number) =>
  v.toLocaleString("es-EC", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const fmtInt = (v: number) =>
  v.toLocaleString("es-EC");

const SortIcon = ({
  col,
  cfg,
}: {
  col: SortKey;
  cfg: { key: SortKey; direction: "asc" | "desc" };
}) => (
  <span className="ml-1 opacity-60 text-[10px]">
    {cfg.key === col ? (cfg.direction === "asc" ? "↑" : "↓") : "↕"}
  </span>
);

/* ───────────────── COMPONENTE ───────────────── */

const RankingPreventas: React.FC<Props> = ({ datos, anio, mes }) => {
  const navigate = useNavigate();
  const { user } = useAuth();

  const isAdmin = user?.role === "ADMIN";

  const [sortConfig, setSortConfig] = useState<{
    key: SortKey;
    direction: "asc" | "desc";
  }>({
    key: "N*",
    direction: "asc",
  });

  const [sortedData, setSortedData] = useState<Preventa[]>(
    datos?.rankingPreventas || []
  );

  if (!datos?.rankingPreventas?.length) {
    return (
      <p className="text-center text-gray-400 py-4">
        No hay datos disponibles
      </p>
    );
  }

  const preventas = sortedData;

  /* ─────────────── TOTALES ─────────────── */

  const totalUnidades = preventas.reduce((a, p) => a + (p.unidades || 0), 0);

  const totalUSD = preventas.reduce((a, p) => a + (p.monto || 0), 0);

  const totalMeta = preventas.reduce((a, p) => a + (p.meta || 0), 0);

  const totalProyeccion = preventas.reduce((a, p) => a + (p.proyeccion || 0), 0);

  const totalVsMesAnterior = preventas.reduce(
    (a, p) => a + (p.vsMesAnterior?.variacion_abs || 0),
    0
  );

  const totalObjetivo = preventas.reduce(
    (a, p) => a + (p.objetivo_gerencia || 0),
    0
  );

  /* ─────────────── ORDENAMIENTO ─────────────── */

  const requestSort = (key: SortKey) => {
    const direction =
      sortConfig.key === key && sortConfig.direction === "asc"
        ? "desc"
        : "asc";

    setSortConfig({ key, direction });

    if (key === "N*") return;

    const sorted = [...preventas].sort((a, b) => {
      let av: number | string = 0;
      let bv: number | string = 0;

      switch (key) {
        case "preventa":
          av = a.preventa;
          bv = b.preventa;
          break;

        case "vsMesAnterior":
          av = a.vsMesAnterior?.variacion_abs ?? 0;
          bv = b.vsMesAnterior?.variacion_abs ?? 0;
          break;

        case "objetivo_gerencia":
          av = a.objetivo_gerencia ?? 0;
          bv = b.objetivo_gerencia ?? 0;
          break;

        default:
          av = (a as any)[key];
          bv = (b as any)[key];
      }

      if (typeof av === "string" && typeof bv === "string") {
        return direction === "asc"
          ? av.localeCompare(bv)
          : bv.localeCompare(av);
      }

      return direction === "asc"
        ? Number(av) - Number(bv)
        : Number(bv) - Number(av);
    });

    setSortedData(sorted);
  };

  /* ─────────────── EXPORTAR EXCEL ─────────────── */

  const exportarTablaExcel = () => {
    if (!preventas.length) return;

    const rows = preventas.map((p, i) => ({
      N: i + 1,
      Preventa: p.preventa,
      Unidades: fmtInt(p.unidades ?? 0),
      Dolares: fmt(p.monto ?? 0),
      Meta: fmt(p.meta ?? 0),
      ObjGerencia: fmt(p.objetivo_gerencia ?? 0),
      Proyeccion: fmt(p.proyeccion ?? 0),
      VsMesAnterior:
        p.vsMesAnterior?.variacion_abs != null
          ? fmt(p.vsMesAnterior.variacion_abs)
          : "Sin datos",
    }));

    const ws = XLSX.utils.json_to_sheet(rows);

    const wb = XLSX.utils.book_new();

    XLSX.utils.book_append_sheet(wb, ws, "Ranking");

    XLSX.writeFile(wb, `ranking_preventa_${mes}_${anio}.xlsx`);
  };

  /* ─────────────── HEADER TABLE ─────────────── */

  const Th = ({
    k,
    label,
    align = "right",
  }: {
    k: SortKey;
    label: string;
    align?: "left" | "right" | "center";
  }) => (
    <th
      onClick={() => requestSort(k)}
      className={`px-4 py-3 text-${align} cursor-pointer whitespace-nowrap`}
    >
      {label}
      <SortIcon col={k} cfg={sortConfig} />
    </th>
  );

  /* ───────────────── RENDER ───────────────── */

  return (
    <div className="overflow-x-auto bg-[#012E24] text-white rounded-lg shadow-md border border-[#046C5E] mt-6">

      {/* HEADER */}

      <div className="flex justify-between px-4 pt-4 mb-2">

        <h2 className="text-lg font-bold text-blue-300">
          RANKING PREVENTA
        </h2>

        {isAdmin && (
          <div className="flex gap-3">

            <button
              onClick={() => navigate("/configurar-metas")}
              className="px-3 py-2 border rounded"
            >
              <BsGear />
            </button>

            <button
              onClick={exportarTablaExcel}
              className="px-3 py-2 border rounded"
            >
              <BsDownload />
            </button>

          </div>
        )}
      </div>

      {/* TABLA */}

      <table className="min-w-full text-sm">

        <thead className="bg-[#014434] text-green-300 uppercase text-xs">

          <tr>

            <Th k="N*" label="N°" align="left" />
            <Th k="preventa" label="Ruta / Preventa" align="left" />
            <Th k="unidades" label="Unidades" />
            <Th k="monto" label="Dólares" />
            <Th k="meta" label="Meta" />
            <Th k="objetivo_gerencia" label="Obj Gerencia" />
            <Th k="proyeccion" label="Proyección" />
            <Th k="vsMesAnterior" label="Vs Mes Anterior" />

          </tr>

        </thead>

        <tbody>

          {sortedData.map((p, idx) => {

            const meta = Number(p.meta) || 0;
            const proy = Number(p.proyeccion) || 0;
            const objetivo = Number(p.objetivo_gerencia) || 0;

            const montoAnterior = p.vsMesAnterior?.monto_anterior ?? 0;

            const variacionAbs = proy - montoAnterior;

            const variacionPorc =
              montoAnterior > 0
                ? ((variacionAbs / montoAnterior) * 100).toFixed(2)
                : "0.00";

            const porcentajeProy =
              meta > 0 ? ((proy / meta - 1) * 100) : 0;

            return (
              <tr
                key={idx}
                onClick={() => navigate(`/detalle-ruta/${p.preventa}/${anio}/${mes}`, { state: { objetivo_gerencia: p.objetivo_gerencia ?? 0, objetivo_gerencia_unidades: p.objetivo_gerencia_unidades ?? 0, proyeccion: p.proyeccion ?? 0, monto: p.monto ?? 0, meta: p.meta ?? 0 } })}

                className={`cursor-pointer transition-colors hover:bg-[#026452] ${idx % 2 === 0 ? "bg-[#013d32]" : "bg-[#014f3e]"}`}>


                <td className="px-4 py-2 text-gray-400 text-xs">
                  {idx + 1}
                </td>

                <td className="px-4 py-2 underline">
                  {p.preventa}
                </td>

                <td className="px-4 py-2 text-right text-green-400">
                  {fmtInt(p.unidades ?? 0)}
                </td>

                <td className="px-4 py-2 text-right text-blue-400">
                  ${fmt(p.monto ?? 0)}
                </td>

                <td className="px-4 py-2 text-right">
                  ${fmt(meta)}
                </td>

                <td className="px-4 py-2 text-right text-amber-300">
                  {objetivo > 0 ? `$${fmt(objetivo)}` : "sin datos"}
                </td>

                <td className="px-4 py-2 text-right font-bold">

                  <span
                    className={
                      porcentajeProy > 0
                        ? "text-green-400"
                        : "text-red-400"
                    }
                  >
                    ({porcentajeProy.toFixed(1)}%)
                  </span>

                  {" "}

                  <span className="text-blue-300">
                    ${fmt(proy)}
                  </span>

                </td>

                {/* VS MES ANTERIOR */}

                <td
                  className={`px-4 py-2 text-right font-bold ${variacionAbs < 0
                    ? "text-red-400"
                    : variacionAbs > 0
                      ? "text-green-400"
                      : "text-gray-400"
                    }`}
                >

                  {variacionAbs !== 0 ? (
                    <>
                      ({variacionAbs > 0 ? "+" : ""}
                      {variacionPorc}%)
                      {" "}
                      ${variacionAbs.toLocaleString("es-EC", {
                        minimumFractionDigits: 2,
                      })}
                    </>
                  ) : (
                    <span className="text-gray-500 text-xs italic">
                      Sin datos
                    </span>
                  )}

                </td>

              </tr>
            );
          })}

        </tbody>

        <tfoot className="bg-[#014434] font-bold text-xs">

          <tr>

            <td className="px-4 py-3">Total</td>

            <td></td>

            <td className="text-right text-green-400">
              {fmtInt(totalUnidades)}
            </td>

            <td className="text-right text-blue-400">
              ${fmt(totalUSD)}
            </td>

            <td className="text-right">
              ${fmt(totalMeta)}
            </td>

            <td className="text-right text-amber-300">
              {totalObjetivo > 0 ? `$${fmt(totalObjetivo)}` : "—"}
            </td>

            <td className="text-right">
              ${fmt(totalProyeccion)}
            </td>

            <td className="text-right">
              ${fmt(totalVsMesAnterior)}
            </td>

          </tr>

        </tfoot>

      </table>
    </div>
  );
};

export default RankingPreventas;