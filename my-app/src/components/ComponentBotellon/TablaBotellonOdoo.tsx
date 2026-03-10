// components/ComponentBotellon/TablaBotellonOdoo.tsx
import React, { useState, useEffect } from "react";
import * as XLSX from "xlsx";
import { BsDownload } from "react-icons/bs";
import { useAuth } from "../../components/auth/AuthContext";
import { API_BASE_URL } from "../../config";

// ================================================================
// INTERFACES
// ================================================================
interface RutaBotellon {
  ruta: string;
  botellones: number;
  dolares: number;
  subtotal: number;
  cant_ordenes: number;
  cant_clientes: number;
  proyeccion_botellones: number;
  proyeccion_dolares: number;
  mes_anterior: { botellones: number; dolares: number };
  variacion_botellones: { abs: number; porcentaje: number | null };
  variacion_dolares: { abs: number; porcentaje: number | null };
}

interface DatosBotellonOdoo {
  periodo: { anio: number; mes: number; esMesActual: boolean };
  fechas: { inicio: string; fin: string };
  dias: { transcurridos: number; laborables: number };
  totales: {
    botellones: number;
    dolares: number;
    proyeccion_botellones: number;
    proyeccion_dolares: number;
    cant_ordenes: number;
    mes_anterior: { botellones: number; dolares: number };
    variacion: { abs: number; porcentaje: number | null };
  };
  rutas: RutaBotellon[];
}

interface Props {
  anio: number | string;
  mes: number | string;
}

type SortKey =
  | "ruta" | "botellones" | "dolares" | "subtotal"
  | "proyeccion_botellones" | "proyeccion_dolares"
  | "mes_anterior" | "variacion"
  | "cant_ordenes" | "cant_clientes";

// ================================================================
// HELPERS
// ================================================================
const fmt = (n: number) =>
  n.toLocaleString("es-EC", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtInt = (n: number) => n.toLocaleString("es-EC");

const getSortValue = (r: RutaBotellon, key: SortKey): number | string => {
  switch (key) {
    case "ruta":                 return r.ruta;
    case "botellones":           return r.botellones;
    case "dolares":              return r.dolares;
    case "subtotal":             return r.subtotal;
    case "proyeccion_botellones":return r.proyeccion_botellones;
    case "proyeccion_dolares":   return r.proyeccion_dolares;
    case "mes_anterior":         return r.mes_anterior.botellones;
    case "variacion":            return r.variacion_botellones.abs;
    case "cant_ordenes":         return r.cant_ordenes;
    case "cant_clientes":        return r.cant_clientes;
    default:                     return 0;
  }
};

// ================================================================
// COMPONENTE
// ================================================================
export default function TablaBotellonOdoo({ anio, mes }: Props) {
  const { user } = useAuth();
  const isAdmin  = (user?.role ?? "").toUpperCase() === "ADMIN";

  const [datos,       setDatos]       = useState<DatosBotellonOdoo | null>(null);
  const [cargando,    setCargando]    = useState(false);
  const [error,       setError]       = useState<string | null>(null);
  const [sortKey,     setSortKey]     = useState<SortKey>("botellones");
  const [sortDir,     setSortDir]     = useState<"asc" | "desc">("desc");
  const [sortedRutas, setSortedRutas] = useState<RutaBotellon[]>([]);

  // ── Fetch ────────────────────────────────────────────────────
  useEffect(() => {
    if (!anio || !mes) return;
    const fetchData = async () => {
      try {
        setCargando(true);
        setError(null);
        const res = await fetch(
          `${API_BASE_URL}/api/odoo/botellon-odoo?anio=${anio}&mes=${mes}`
        );
        if (!res.ok) throw new Error("Error al obtener datos");
        const data: DatosBotellonOdoo = await res.json();
        setDatos(data);
        setSortedRutas([...data.rutas]);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setCargando(false);
      }
    };
    fetchData();
  }, [anio, mes]);

  // ── Ordenar ──────────────────────────────────────────────────
  const requestSort = (key: SortKey) => {
    const newDir = sortKey === key && sortDir === "desc" ? "asc" : "desc";
    setSortKey(key);
    setSortDir(newDir);
    const sorted = [...(datos?.rutas ?? [])].sort((a, b) => {
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

  // ── Exportar Excel ───────────────────────────────────────────
  const exportarExcel = () => {
    if (!sortedRutas.length || !datos) return;
    try {
      const rows = sortedRutas.map((r, i) => ({
        "N°": i + 1,
        "Ruta / Vendedor":    r.ruta,
        "Botellones":         fmtInt(r.botellones),
        "Dólares $":            fmt(r.dolares),
        "Proyección Bot.":    fmtInt(r.proyeccion_botellones),
        "Proyección $":       fmt(r.proyeccion_dolares),
        "Mes Anterior Bot.":  fmtInt(r.mes_anterior.botellones),
        "Mes Anterior $":     fmt(r.mes_anterior.dolares),
        "Variación Bot.":     r.mes_anterior.botellones === 0 ? "Sin datos" : fmtInt(r.variacion_botellones.abs),
        "Variación Bot. %":   r.variacion_botellones.porcentaje !== null
          ? `${r.variacion_botellones.porcentaje >= 0 ? "+" : ""}${r.variacion_botellones.porcentaje.toFixed(1)}%`
          : "Sin datos",
        "Variación $":        r.mes_anterior.dolares === 0 ? "Sin datos" : fmt(r.variacion_dolares.abs),
        "Órdenes":            r.cant_ordenes,
        "Clientes":           r.cant_clientes,
      }));

      const { totales } = datos;
      const filaTotales = {
        "N°": "",
        "Ruta / Vendedor":   "TOTAL",
        "Botellones":        fmtInt(totales.botellones),
        "Dólares $":           fmt(totales.dolares),
        "Proyección Bot.":   fmtInt(totales.proyeccion_botellones),
        "Proyección $":      fmt(totales.proyeccion_dolares),
        "Mes Anterior Bot.": fmtInt(totales.mes_anterior.botellones),
        "Mes Anterior $":    fmt(totales.mes_anterior.dolares),
        "Variación Bot.":    fmtInt(totales.variacion.abs),
        "Variación Bot. %":  totales.variacion.porcentaje !== null
          ? `${totales.variacion.porcentaje >= 0 ? "+" : ""}${totales.variacion.porcentaje.toFixed(1)}%`
          : "Sin datos",
        "Variación $":       fmt(totales.dolares - totales.mes_anterior.dolares),
        "Órdenes":           totales.cant_ordenes,
        "Clientes":          "—",
      };

      const ws = XLSX.utils.json_to_sheet([]);
      XLSX.utils.sheet_add_aoa(ws, [
        [`VENTAS BOTELLÓN - RUTAS EMPRESA (ODOO) - ${mes}/${anio}`],
        [],
      ], { origin: "A1" });
      XLSX.utils.sheet_add_json(ws, rows, { origin: "A3" });
      XLSX.utils.sheet_add_json(ws, [filaTotales], { skipHeader: true, origin: -1 });

      const keys = Object.keys(rows[0]);
      ws["!cols"] = keys.map((col) => ({
        wch: Math.max(col.length, ...rows.map((r: any) => String(r[col]).length)) + 4,
      }));

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "BotellonOdoo");
      XLSX.writeFile(wb, `botellon_odoo_${mes}_${anio}.xlsx`, { compression: true });
    } catch (err) {
      console.error("Error exportando Excel:", err);
    }
  };

  // ── Estados de carga ─────────────────────────────────────────
  if (cargando)
    return (
      <div className="flex justify-center items-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-[#046C5E]" />
        <span className="ml-3 text-gray-400">Cargando botellones Odoo...</span>
      </div>
    );

  if (error)
    return (
      <div className="bg-red-900/20 border border-red-500 rounded-xl p-4 text-red-400">
        Error: {error}
      </div>
    );

  if (!datos) return null;

  const { totales, periodo, dias } = datos;
  const esMesActual = periodo.esMesActual;

  const columnas: [SortKey, string, string][] = [
    ["ruta",                 "Ruta / Vendedor",  "text-left"],
    ["botellones",           "Botellones",        "text-right"],
    ["dolares",              "Dólares $",           "text-right"],
    ...(esMesActual ? [
      ["proyeccion_botellones", "PROYECCIÓN_UNIDADES",     "text-right"] as [SortKey, string, string],
      ["proyeccion_dolares",    "PROYECCIÓN_USD $",        "text-right"] as [SortKey, string, string],
    ] : []),
    ["variacion",            "Vs Mes Anterior",   "text-right"],
    ["cant_ordenes",         "Órdenes",           "text-right"],
    ["cant_clientes",        "Clientes",          "text-right"],
  ];

  return (
    <div className="overflow-x-auto bg-[#012E24] text-white rounded-lg shadow-md border border-[#046C5E] mt-6 mb-10">

      {/* ── Encabezado ─────────────────────────────────────────── */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between px-4 py-4">
        <div>
          <h2 className="text-lg md:text-xl font-bold text-blue-300">
            💧 BOTELLÓN — RUTAS EMPRESA (ODOO)
          </h2>
          {/* <p className="text-xs text-gray-400 mt-1">
            {esMesActual
              ? `Días transcurridos: ${dias.transcurridos} / ${dias.laborables} laborables · `
              : "Mes cerrado · "}
            {datos.fechas.inicio.substring(0, 10)} → {datos.fechas.fin.substring(0, 10)}
          </p> */}
        </div>

        <div className="flex gap-3 flex-wrap items-center">
          <div className="bg-[#011f1a] border border-[#046C5E] rounded-lg px-3 py-2 text-center">
            <p className="text-xs text-gray-400">Botellones</p>
            <p className="text-base font-bold text-blue-300">{fmtInt(totales.botellones)}</p>
          </div>
          <div className="bg-[#011f1a] border border-[#046C5E] rounded-lg px-3 py-2 text-center">
            <p className="text-xs text-gray-400">Dólares $</p>
            <p className="text-base font-bold text-white">${fmt(totales.dolares)}</p>
          </div>
          {esMesActual && (
            <>
              <div className="bg-[#011f1a] border border-[#046C5E] rounded-lg px-3 py-2 text-center">
                <p className="text-xs text-gray-400">PROYECCIÓN_UNIDADES</p>
                <p className="text-base font-bold text-emerald-400">{fmtInt(totales.proyeccion_botellones)}</p>
              </div>
              <div className="bg-[#011f1a] border border-[#046C5E] rounded-lg px-3 py-2 text-center">
                <p className="text-xs text-gray-400">PROYECCIÓN_USD $</p>
                <p className="text-base font-bold text-emerald-400">${fmt(totales.proyeccion_dolares)}</p>
              </div>
            </>
          )}
          <div className="bg-[#011f1a] border border-[#046C5E] rounded-lg px-3 py-2 text-center">
            <p className="text-xs text-gray-400">Órdenes</p>
            <p className="text-base font-bold text-white">{totales.cant_ordenes}</p>
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

      {/* ── Tabla ──────────────────────────────────────────────── */}
      <table className="min-w-full text-sm">
        <thead className="bg-[#014434] text-green-300 uppercase text-xs">
          <tr>
            <th className="px-4 py-3 text-left">N°</th>
            {columnas.map(([key, label, align]) => (
              <th
                key={key}
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
            const esPositivo = r.variacion_botellones.abs >= 0;
            return (
              <tr
                key={r.ruta}
                className={`transition-all duration-200
                  ${idx % 2 === 0 ? "bg-[#013d32]" : "bg-[#014f3e]"}
                  hover:bg-[#016a57] border-l-4 border-transparent hover:border-green-400
                `}
              >
                <td className="px-4 py-2 text-gray-400 text-xs">{idx + 1}</td>
                <td className="px-4 py-2 font-bold text-blue-300">{r.ruta}</td>
                <td className="px-4 py-2 text-right text-green-400 font-bold">{fmtInt(r.botellones)}</td>
                <td className="px-4 py-2 text-right font-bold text-white">${fmt(r.dolares)}</td>
                {esMesActual && (
                  <>
                    <td className="px-4 py-2 text-right font-bold text-emerald-400">{fmtInt(r.proyeccion_botellones)}</td>
                    <td className="px-4 py-2 text-right font-bold text-emerald-400">${fmt(r.proyeccion_dolares)}</td>
                  </>
                )}
                {/* Vs Mes Anterior — botellones + variación en una sola celda */}
                <td className={`px-4 py-2 text-right font-bold ${esPositivo ? "text-green-400" : "text-red-400"}`}>
                  {r.mes_anterior.botellones === 0 ? (
                    <span className="text-gray-500 font-normal">Sin datos</span>
                  ) : (
                    <>
                      <span className="block text-gray-300 font-normal">
                        {fmtInt(r.mes_anterior.botellones)} bot. · ${fmt(r.mes_anterior.dolares)}
                      </span>
                      ({r.variacion_botellones.porcentaje !== null
                        ? `${r.variacion_botellones.porcentaje >= 0 ? "+" : ""}${r.variacion_botellones.porcentaje.toFixed(2)}%`
                        : "–"})
                      {" "}
                      {esPositivo ? "+" : "-"}{fmtInt(Math.abs(r.variacion_botellones.abs))} bot.
                    </>
                  )}
                </td>
                <td className="px-4 py-2 text-right text-gray-300">{r.cant_ordenes}</td>
                <td className="px-4 py-2 text-right text-gray-300">{r.cant_clientes}</td>
              </tr>
            );
          })}
        </tbody>

        {/* ── Fila totales ── */}
        <tfoot className="bg-[#014434] font-bold text-gray-200 border-t border-[#046C5E]">
          <tr>
            <td className="px-4 py-3" colSpan={2}>TOTAL</td>
            <td className="px-4 py-3 text-right text-green-400">{fmtInt(totales.botellones)}</td>
            <td className="px-4 py-3 text-right text-blue-400">${fmt(totales.dolares)}</td>
            {esMesActual && (
              <>
                <td className="px-4 py-3 text-right text-emerald-400">{fmtInt(totales.proyeccion_botellones)}</td>
                <td className="px-4 py-3 text-right text-emerald-400">${fmt(totales.proyeccion_dolares)}</td>
              </>
            )}
            <td className={`px-4 py-3 text-right ${totales.variacion.abs >= 0 ? "text-green-400" : "text-red-400"}`}>
              <span className="block text-gray-300 font-normal">
                {fmtInt(totales.mes_anterior.botellones)} bot. · ${fmt(totales.mes_anterior.dolares)}
              </span>
              {totales.variacion.porcentaje !== null
                ? `(${totales.variacion.porcentaje >= 0 ? "+" : ""}${totales.variacion.porcentaje.toFixed(2)}%) `
                : ""}
              {totales.variacion.abs >= 0 ? "+" : "-"}{fmtInt(Math.abs(totales.variacion.abs))} bot.
            </td>
            <td className="px-4 py-3 text-right">{totales.cant_ordenes}</td>
            <td className="px-4 py-3 text-right">—</td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}