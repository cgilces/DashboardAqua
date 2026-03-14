// components/ComponentCotsa/TablaCotsa.tsx
import React, { useState, useEffect } from "react";
import * as XLSX from "xlsx";
import { BsDownload } from "react-icons/bs";
import { useAuth } from "../../components/auth/AuthContext";
import { API_BASE_URL } from "../../config";

interface RutaCotsa {
  ruta: string;
  vendedor: string;
  unidades: number;
  subtotal: number;
  dolares: number;
  proyeccion: number;
  cant_facturas: number;
  cant_clientes: number;
  vsMesAnterior: {
    dolares_anterior: number;
    variacion_abs: number;
    variacion_porc: number | null;
  };
}

interface TotalesCotsa {
  unidades: number;
  dolares: number;
  proyeccion: number;
  cant_facturas: number;
  cant_clientes: number;
}

interface DatosCotsa {
  ranking: RutaCotsa[];
  totales: TotalesCotsa;
}

interface Props {
  anio: number | string;
  mes: number | string;
}

type SortKey =
  | "ruta" | "vendedor" | "unidades" | "subtotal" | "dolares"
  | "proyeccion" | "vsMesAnterior" | "cant_facturas" | "cant_clientes";

const fmt    = (n: number) => n.toLocaleString("es-EC", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtInt = (n: number) => n.toLocaleString("es-EC");

const getSortValue = (r: RutaCotsa, key: SortKey): number | string => {
  switch (key) {
    case "ruta":          return r.ruta;
    case "vendedor":      return r.vendedor;
    case "unidades":      return r.unidades;
    case "subtotal":      return r.subtotal;
    case "dolares":       return r.dolares;
    case "proyeccion":    return r.proyeccion;
    case "vsMesAnterior": return r.vsMesAnterior.variacion_abs;
    case "cant_facturas": return r.cant_facturas;
    case "cant_clientes": return r.cant_clientes;
    default:              return 0;
  }
};

// ── Deduplicar por ruta+vendedor ──────────────────────────────
const deduplicar = (ranking: RutaCotsa[]): RutaCotsa[] => {
  const vistos = new Set<string>();
  return ranking.filter(r => {
    const key = `${r.ruta}-${r.vendedor}`;
    if (vistos.has(key)) return false;
    vistos.add(key);
    return true;
  });
};

export default function TablaCotsa({ anio, mes }: Props) {
  const { user } = useAuth();
  const isAdmin  = (user?.role ?? "").toUpperCase() === "ADMIN";

  const [datos,       setDatos]       = useState<DatosCotsa | null>(null);
  const [cargando,    setCargando]    = useState(false);
  const [error,       setError]       = useState<string | null>(null);
  const [sortKey,     setSortKey]     = useState<SortKey>("dolares");
  const [sortDir,     setSortDir]     = useState<"asc" | "desc">("desc");
  const [sortedRutas, setSortedRutas] = useState<RutaCotsa[]>([]);

  const hoy         = new Date();
  const esMesActual = Number(anio) === hoy.getFullYear() && Number(mes) === hoy.getMonth() + 1;

  useEffect(() => {
    if (!anio || !mes) return;
    const fetchData = async () => {
      try {
        setCargando(true);
        setError(null);
        const res = await fetch(`${API_BASE_URL}/api/cotsa/dashboard?anio=${anio}&mes=${mes}`);
        if (!res.ok) throw new Error("Error al obtener datos COTSA");
        const data: DatosCotsa = await res.json();

        // ── Deduplicar antes de guardar en estado ─────────────
        const rankingLimpio = deduplicar(data.ranking);
        const dataLimpia    = { ...data, ranking: rankingLimpio };

        setDatos(dataLimpia);
        setSortedRutas(rankingLimpio);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setCargando(false);
      }
    };
    fetchData();
  }, [anio, mes]);

  const requestSort = (key: SortKey) => {
    const newDir = sortKey === key && sortDir === "desc" ? "asc" : "desc";
    setSortKey(key);
    setSortDir(newDir);
    const sorted = [...(datos?.ranking ?? [])].sort((a, b) => {
      const av = getSortValue(a, key);
      const bv = getSortValue(b, key);
      if (typeof av === "string" && typeof bv === "string")
        return newDir === "asc" ? av.localeCompare(bv) : bv.localeCompare(av);
      return newDir === "asc"
        ? (av as number) - (bv as number)
        : (bv as number) - (av as number);
    });
    setSortedRutas(sorted);
  };

  const sortIcon = (key: SortKey) =>
    sortKey === key ? (sortDir === "asc" ? "↑" : "↓") : "↕";

  const exportarExcel = () => {
    if (!sortedRutas.length || !datos) return;
    try {
      const rows = sortedRutas.map((r, i) => ({
        "N°"             : i + 1,
        "Ruta"           : r.ruta,
        "Vendedor"       : r.vendedor,
        "Unidades"       : fmtInt(r.unidades),
        "Subtotal"       : fmt(r.subtotal),
        "Dólares $"      : fmt(r.dolares),
        "Proyección"     : fmt(r.proyeccion),
        "Mes Anterior $" : fmt(r.vsMesAnterior.dolares_anterior),
        "Variación $"    : r.vsMesAnterior.dolares_anterior === 0
          ? "Sin datos" : fmt(r.vsMesAnterior.variacion_abs),
        "Variación %"    : r.vsMesAnterior.dolares_anterior === 0
          ? "Sin datos" : r.vsMesAnterior.variacion_porc !== null
            ? `${r.vsMesAnterior.variacion_porc > 0 ? "+" : ""}${r.vsMesAnterior.variacion_porc.toFixed(1)}%`
            : "–",
        "Facturas"       : r.cant_facturas,
        "Clientes"       : r.cant_clientes,
      }));

      const { totales } = datos;
      const filaTotales = {
        "N°"             : "",
        "Ruta"           : "TOTAL",
        "Vendedor"       : "",
        "Unidades"       : fmtInt(totales.unidades),
        "Subtotal"       : "—",
        "Dólares $"      : fmt(totales.dolares),
        "Proyección"     : fmt(totales.proyeccion),
        "Mes Anterior $" : "—",
        "Variación $"    : "—",
        "Variación %"    : "—",
        "Facturas"       : totales.cant_facturas,
        "Clientes"       : totales.cant_clientes,
      };

      const ws = XLSX.utils.json_to_sheet([]);
      XLSX.utils.sheet_add_aoa(ws, [
        [`COTSA — VENTAS POR RUTA - ${mes}/${anio}`], [],
      ], { origin: "A1" });
      XLSX.utils.sheet_add_json(ws, rows, { origin: "A3" });
      XLSX.utils.sheet_add_json(ws, [filaTotales], { skipHeader: true, origin: -1 });

      const keys = Object.keys(rows[0]);
      ws["!cols"] = keys.map((col) => ({
        wch: Math.max(col.length, ...rows.map((r: any) => String(r[col]).length)) + 4,
      }));

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "CotSA");
      XLSX.writeFile(wb, `cotsa_${mes}_${anio}.xlsx`, { compression: true });
    } catch (err) {
      console.error("Error exportando Excel:", err);
    }
  };

  // ── Estados de carga ─────────────────────────────────────────
  if (cargando)
    return (
      <div className="flex justify-center items-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-[#046C5E]" />
        <span className="ml-3 text-gray-400">Cargando datos COTSA...</span>
      </div>
    );

  if (error)
    return (
      <div className="bg-red-900/20 border border-red-500 rounded-xl p-4 text-red-400">
        Error: {error}
      </div>
    );

  if (!datos) return null;

  const { totales } = datos;

  return (
    <div className="overflow-x-auto bg-[#012E24] text-white rounded-lg shadow-md border border-[#046C5E] mt-6 mb-10">

      {/* ── Encabezado ───────────────────────────────────────── */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between px-4 py-4">
        <h2 className="text-lg md:text-xl font-bold text-blue-300">
          COTSA — VENTAS POR RUTA - AGUA OK
        </h2>

        <div className="flex gap-3 flex-wrap items-center">
          <div className="bg-[#011f1a] border border-[#046C5E] rounded-lg px-3 py-2 text-center">
            <p className="text-xs text-gray-400">Dólares $</p>
            <p className="text-base font-bold text-white">${fmt(totales.dolares)}</p>
          </div>
          {esMesActual && (
            <div className="bg-[#011f1a] border border-[#046C5E] rounded-lg px-3 py-2 text-center">
              <p className="text-xs text-gray-400">Proyección</p>
              <p className="text-base font-bold text-emerald-400">${fmt(totales.proyeccion)}</p>
            </div>
          )}
          <div className="bg-[#011f1a] border border-[#046C5E] rounded-lg px-3 py-2 text-center">
            <p className="text-xs text-gray-400">Unidades</p>
            <p className="text-base font-bold text-blue-300">{fmtInt(totales.unidades)}</p>
          </div>
          <div className="bg-[#011f1a] border border-[#046C5E] rounded-lg px-3 py-2 text-center">
            <p className="text-xs text-gray-400">Facturas</p>
            <p className="text-base font-bold text-white">{totales.cant_facturas}</p>
          </div>

          {isAdmin && (
            <button
              onClick={exportarExcel}
              className="flex items-center gap-2 px-4 py-2 rounded-lg border border-[#0db48b]/60 bg-[#0db48b]/20 text-white font-semibold hover:bg-[#0db48b]/30 active:scale-[0.98] transition-all"
            >
              <BsDownload size={16} />
              <span>Exportar</span>
            </button>
          )}
        </div>
      </div>

      {/* ── Tabla ─────────────────────────────────────────────── */}
      <table className="min-w-full text-sm">
        <thead className="bg-[#014434] text-green-300 uppercase text-xs">
          <tr>
            <th className="px-4 py-3 text-left">N°</th>
            {([
              ["ruta",          "Ruta",           "text-left"],
              ["vendedor",      "Vendedor",        "text-left"],
              ["unidades",      "Unidades",        "text-right"],
              ["subtotal",      "Subtotal",        "text-right"],
              ["dolares",       "Dólares $",       "text-right"],
              ...(esMesActual ? [["proyeccion", "Proyección", "text-right"]] : []),
              ["vsMesAnterior", "Variación",       "text-right"],
              ["vsMesAnterior", "%",               "text-right"],
              ["cant_facturas", "Facturas",        "text-right"],
              ["cant_clientes", "Clientes",        "text-right"],
            ] as [SortKey, string, string][]).map(([key, label, align], colIdx) => (
              <th
                key={`${key}-${colIdx}`}
                className={`px-4 py-3 ${align} cursor-pointer hover:text-white transition-colors select-none`}
                onClick={() => requestSort(key)}
              >
                {label} <span className="text-green-300">{sortIcon(key)}</span>
              </th>
            ))}
          </tr>
        </thead>

        <tbody>
          {sortedRutas.map((r, idx) => {
            const esPositivo = r.vsMesAnterior.variacion_abs >= 0;
            const sinDatos   = r.vsMesAnterior.dolares_anterior === 0;
            return (
              <tr
                key={`${r.ruta}-${r.vendedor}-${idx}`}
                className={`transition-all duration-200
                  ${idx % 2 === 0 ? "bg-[#013d32]" : "bg-[#014f3e]"}
                  hover:bg-[#016a57] border-l-4 border-transparent hover:border-green-400
                `}
              >
                <td className="px-4 py-2 text-gray-400 text-xs">{idx + 1}</td>

                {/* Ruta */}
                <td className="px-4 py-2 font-bold text-blue-300">{r.ruta}</td>

                {/* Vendedor */}
                <td className="px-4 py-2 text-gray-300">{r.vendedor}</td>

                <td className="px-4 py-2 text-right text-green-400 font-bold">{fmtInt(r.unidades)}</td>
                <td className="px-4 py-2 text-right text-gray-400">${fmt(r.subtotal)}</td>
                <td className="px-4 py-2 text-right font-bold text-white">${fmt(r.dolares)}</td>

                {esMesActual && (
                  <td className="px-4 py-2 text-right font-bold text-emerald-400">${fmt(r.proyeccion)}</td>
                )}

                {/* VARIACIÓN */}
                <td className={`px-4 py-2 text-right font-bold ${esPositivo ? "text-green-400" : "text-red-400"}`}>
                  {sinDatos ? (
                    <span className="text-gray-500 font-normal">Sin datos</span>
                  ) : (
                    <>
                      <span className="block text-gray-300 font-normal text-xs">
                        ${fmt(r.vsMesAnterior.dolares_anterior)}
                      </span>
                      {esPositivo ? "+" : "-"}${fmt(Math.abs(r.vsMesAnterior.variacion_abs))}
                    </>
                  )}
                </td>
                {/* % */}
                <td className={`px-4 py-2 text-right font-bold ${esPositivo ? "text-green-400" : "text-red-400"}`}>
                  {sinDatos ? (
                    <span className="text-gray-500 font-normal">—</span>
                  ) : (
                    r.vsMesAnterior.variacion_porc !== null
                      ? `${r.vsMesAnterior.variacion_porc >= 0 ? "+" : ""}${r.vsMesAnterior.variacion_porc.toFixed(2)}%`
                      : "–"
                  )}
                </td>

                <td className="px-4 py-2 text-right text-gray-300">{r.cant_facturas}</td>
                <td className="px-4 py-2 text-right text-gray-300">{r.cant_clientes}</td>
              </tr>
            );
          })}
        </tbody>

        <tfoot className="bg-[#014434] font-bold text-gray-200 border-t border-[#046C5E]">
          <tr>
            <td className="px-4 py-3" colSpan={3}>TOTAL</td>
            <td className="px-4 py-3 text-right text-green-400">{fmtInt(totales.unidades)}</td>
            <td className="px-4 py-3 text-right text-gray-400">—</td>
            <td className="px-4 py-3 text-right text-blue-400">${fmt(totales.dolares)}</td>
            {esMesActual && (
              <td className="px-4 py-3 text-right text-emerald-400">${fmt(totales.proyeccion)}</td>
            )}
            <td className="px-4 py-3 text-right text-gray-400">—</td>
            <td className="px-4 py-3 text-right text-gray-400">—</td>
            <td className="px-4 py-3 text-right">{totales.cant_facturas}</td>
            <td className="px-4 py-3 text-right">{totales.cant_clientes}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}