import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import * as XLSX from "xlsx";
import { useAuth } from "../../components/auth/AuthContext";
import { BsDownload, BsGear } from "react-icons/bs";
import ImportarMetasBoton from "../common/ImportarMetasBoton";

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
  unidadesPorPresentacion?: Record<string, number>;
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
  const { user } = useAuth();

  const isVendedor = user?.role === "VENDEDOR";

  // 🔐 Calcular filas visibles ANTES de los hooks
  const preventasFiltradas = isVendedor
    ? (datos?.rankingPreventas || []).filter((p) => p.preventa === user?.username)
    : datos?.rankingPreventas || [];

  // ✅ Ocultar tabla si no hay datos o si el VENDEDOR no tiene filas aquí
  if (!datos?.rankingPreventas?.length || (isVendedor && preventasFiltradas.length === 0)) {
    return null;
  }

  return <RankingPreventa datos={datos} anio={anio} mes={mes} user={user} preventasFiltradas={preventasFiltradas} />;
};

const RankingPreventa: React.FC<Props & { user: any; preventasFiltradas: Preventa[] }> = ({ datos, anio, mes, user, preventasFiltradas }) => {
  const navigate = useNavigate();
  const isAdmin = user?.role === "ADMIN";

  const [sortConfig, setSortConfig] = useState<{
    key: SortKey;
    direction: "asc" | "desc";
  }>({
    key: "N*",
    direction: "asc",
  });

  const [sortedData, setSortedData] = useState<Preventa[]>(preventasFiltradas);

  const preventas = sortedData;

  /* ─────────────── TOTALES ─────────────── */

  const totalUnidades = preventas.reduce((a, p) => a + (p.unidades || 0), 0);

  const totalUSD = preventas.reduce((a, p) => a + (p.monto || 0), 0);

  const totalMeta = preventas.reduce((a, p) => a + (p.meta || 0), 0);

  const totalProyeccion = preventas.reduce((a, p) => a + (p.proyeccion || 0), 0);

  const totalVsMesAnterior = preventas.reduce(
    (a, p) => a + ((p.proyeccion || 0) - (p.objetivo_gerencia || 0)),
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
      className={`px-4 py-3 text-${align} cursor-pointer hover:text-white transition-colors select-none whitespace-nowrap`}
    >
      {label}
      <SortIcon col={k} cfg={sortConfig} />
    </th>
  );

  /* ───────────────── RENDER ───────────────── */

  return (
    <div className="bg-[#012E24] text-white rounded-lg shadow-md border border-[#046C5E] mt-6">

      {/* HEADER */}

      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between px-4 py-4">
        <h2 className="text-lg md:text-xl font-bold text-blue-300">
          RANKING PREVENTA
        </h2>
        <div className="flex gap-3 flex-wrap items-center">
          <div className="bg-[#011f1a] border border-[#046C5E] rounded-lg px-3 py-2 text-center">
            <p className="text-xs text-gray-400">Unidades</p>
            <p className="text-base font-bold text-green-400">{fmtInt(totalUnidades)}</p>
          </div>
          <div className="bg-[#011f1a] border border-[#046C5E] rounded-lg px-3 py-2 text-center">
            <p className="text-xs text-gray-400">Dólares</p>
            <p className="text-base font-bold text-white">${fmt(totalUSD)}</p>
          </div>
          <div className="bg-[#011f1a] border border-[#046C5E] rounded-lg px-3 py-2 text-center">
            <p className="text-xs text-gray-400">Meta</p>
            <p className="text-base font-bold text-white">${fmt(totalMeta)}</p>
          </div>
          <div className="bg-[#011f1a] border border-[#046C5E] rounded-lg px-3 py-2 text-center">
            <p className="text-xs text-gray-400">Proyección</p>
            <p className="text-base font-bold text-emerald-400">${fmt(totalProyeccion)}</p>
          </div>
          {isAdmin && (
            <div className="flex gap-2 items-center">
              <button
                onClick={() => navigate("/configurar-metas")}
                title="Configurar Metas"
                className="flex items-center gap-2 px-4 py-2 rounded-lg border border-[#0db48b]/60 bg-[#0db48b]/20 text-white font-semibold hover:bg-[#0db48b]/30 active:scale-[0.98] transition-all"
              >
                <BsGear size={16} />
                <span>Metas</span>
              </button>
              <ImportarMetasBoton />
              <button
                onClick={exportarTablaExcel}
                className="flex items-center gap-2 px-4 py-2 rounded-lg border border-[#0db48b]/60 bg-[#0db48b]/20 text-white font-semibold hover:bg-[#0db48b]/30 active:scale-[0.98] transition-all"
              >
                <BsDownload size={16} />
                <span>Exportar</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* TABLA */}
      <div className="overflow-x-auto">
      <table className="min-w-full text-sm">

        <thead className="bg-[#014434] text-green-300 uppercase text-xs">

          <tr>

            <Th k="N*" label="N°" align="left" />
            <Th k="preventa" label="Ruta / Preventa" align="left" />
            <Th k="monto" label="Dólares" />
            <Th k="objetivo_gerencia" label="Cupo" />
            <Th k="proyeccion" label="Proyección" />
            <Th k="vsMesAnterior" label="Variación" />
            <Th k="vsMesAnterior" label="%" />

          </tr>

        </thead>

        <tbody>

          {sortedData.map((p, idx) => {

            const meta = Number(p.meta) || 0;
            const proy = Number(p.proyeccion) || 0;
            const objetivo = Number(p.objetivo_gerencia) || 0;
            const montoAnterior = Number(p.vsMesAnterior?.monto_anterior) || 0;

            const variacionAbs =
              objetivo > 0 ? proy - objetivo : proy - montoAnterior;

            const baseVar = objetivo > 0 ? objetivo : montoAnterior;
            const variacionPorc =
              baseVar > 0
                ? ((variacionAbs / baseVar) * 100).toFixed(2)
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

                {/* <td className="px-4 py-2 text-right text-green-400">
                  <div>{fmtInt(p.unidades ?? 0)}</div>
                  {p.unidadesPorPresentacion && Object.keys(p.unidadesPorPresentacion).length > 0 && (
                    <div className="mt-0.5 space-y-0.5">
                      {Object.entries(p.unidadesPorPresentacion)
                        .sort((a, b) => b[1] - a[1])
                        .map(([pres, cant]) => (
                          <div key={pres} className="flex justify-between gap-2 text-[10px] text-gray-400 font-normal">
                            <span className="text-white">{pres}</span>
                            <span>{fmtInt(cant)}</span>
                          </div>
                        ))}
                    </div>
                  )}
                </td> */}

                <td className="px-4 py-2 text-right text-blue-400">
                  ${fmt(p.monto ?? 0)}
                </td>

                <td className="px-4 py-2 text-right text-amber-300">
                  {objetivo > 0 ? `$${fmt(objetivo)}` : "—"}
                </td>

                <td className="px-4 py-2 text-right font-bold text-blue-300">
                  ${fmt(proy)}
                </td>

                {/* VARIACIÓN */}
                <td className={`px-4 py-2 text-right font-bold ${variacionAbs < 0 ? "text-red-400" : variacionAbs > 0 ? "text-green-400" : "text-gray-400"}`}>
                  {variacionAbs !== 0 ? (
                    <>{variacionAbs > 0 ? "+" : "-"}${fmt(Math.abs(variacionAbs))}</>
                  ) : (
                    <span className="text-gray-500 text-xs italic">Sin datos</span>
                  )}
                </td>

                {/* % */}
                <td className={`px-4 py-2 text-right font-bold ${baseVar <= 0 ? "text-gray-400" : Number(variacionPorc) < 0 ? "text-red-400" : Number(variacionPorc) > 0 ? "text-green-400" : "text-gray-400"}`}>
                  {baseVar > 0 ? (
                    <>{Number(variacionPorc) > 0 ? "+" : ""}{variacionPorc}%</>
                  ) : (variacionAbs > 0
                    ? <span className="text-emerald-300 text-xs italic">Nuevo</span>
                    : <span className="text-gray-500 text-xs italic">—</span>
                  )}
                </td>

              </tr>
            );
          })}

        </tbody>

        <tfoot className="bg-[#014434] font-bold text-xs text-gray-200 border-t border-[#046C5E]">

          <tr>

            <td className="px-4 py-3">Total</td>

            <td className="px-4 py-3"></td>

            {/* <td className="px-4 py-3 text-right text-green-400">
              {fmtInt(totalUnidades)}
            </td> */}

            <td className="px-4 py-3 text-right text-blue-400">
              ${fmt(totalUSD)}
            </td>

            <td className="px-4 py-3 text-right text-amber-300">
              {totalObjetivo > 0 ? `$${fmt(totalObjetivo)}` : "—"}
            </td>

            <td className="px-4 py-3 text-right">
              ${fmt(totalProyeccion)}
            </td>

            <td className={`px-4 py-3 text-right ${totalVsMesAnterior >= 0 ? "text-green-400" : "text-red-400"}`}>
              {totalVsMesAnterior >= 0 ? "+" : "-"}${fmt(Math.abs(totalVsMesAnterior))}
            </td>

            <td className="px-4 py-3 text-right text-gray-400">—</td>

          </tr>

        </tfoot>

      </table>
      </div>
    </div>
  );
};

export default RankingPreventas;