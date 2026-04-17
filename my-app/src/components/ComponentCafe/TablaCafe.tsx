// components/ComponentCafe/TablaCafe.tsx
import React, { useState, useEffect } from "react";
import * as XLSX from "xlsx";
import { BsDownload } from "react-icons/bs";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { API_BASE_URL } from "../../config";
import KpisCafe from "./KpisCafe";

interface PuntoTendencia {
  label: string; anio: number; mes: number; dolares: number; unidades: number;
}

interface DatosCafe {
  periodo: { anio: number; mes: number; esMesActual: boolean };
  tendencia6Meses?: PuntoTendencia[];
  totales: {
    unidades:            number;
    dolares:             number;
    proyeccion_unidades: number;
    proyeccion_dolares:  number;
    cant_facturas:       number;
    cant_clientes:       number;
    mes_anterior: { unidades: number; dolares: number };
    variacion_dolares:  { abs: number; porcentaje: number | null };
    variacion_unidades: { abs: number; porcentaje: number | null };
  };
  rutas: {
    ruta:          string;
    unidades:      number;
    dolares:       number;
    cant_facturas: number;
    cant_clientes: number;
  }[];
}

interface Props {
  anio: number | string;
  mes:  number | string;
}

const fmt    = (n: number) => n.toLocaleString("es-EC", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtInt = (n: number) => n.toLocaleString("es-EC");

export default function TablaCafe({ anio, mes }: Props) {
  const { user }  = useAuth();
  const isAdmin   = (user?.role ?? "").toUpperCase() === "ADMIN";
  const navigate  = useNavigate();

  const [datos,    setDatos]    = useState<DatosCafe | null>(null);
  const [cargando, setCargando] = useState(false);
  const [error,    setError]    = useState<string | null>(null);

  useEffect(() => {
    if (!anio || !mes) return;
    setCargando(true);
    setError(null);
    fetch(`${API_BASE_URL}/api/cafe/dashboard?anio=${anio}&mes=${mes}`)
      .then(res => { if (!res.ok) throw new Error("Error al cargar datos café"); return res.json(); })
      .then((data: DatosCafe) => setDatos(data))
      .catch(err => setError(err.message))
      .finally(() => setCargando(false));
  }, [anio, mes]);

  if (cargando)
    return (
      <div className="flex justify-center items-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-[#046C5E]" />
        <span className="ml-3 text-gray-400">Cargando café IIBC...</span>
      </div>
    );

  if (error)
    return (
      <div className="bg-red-900/20 border border-red-500 rounded-xl p-4 text-red-400">
        Error: {error}
      </div>
    );

  if (!datos) return null;

  const { totales, rutas, periodo, tendencia6Meses } = datos;
  const esMesActual = periodo.esMesActual;
  const varDolPos   = totales.variacion_dolares.abs >= 0;
  const sinDatos    = totales.mes_anterior.dolares === 0;

  const exportarExcel = () => {
    try {
      const rows = rutas.map(r => ({
        "Ruta / Vendedor" : r.ruta,
        "Unidades"        : fmtInt(r.unidades),
        "Dólares $"       : fmt(r.dolares),
        "Facturas"        : r.cant_facturas,
        "Clientes"        : r.cant_clientes,
      }));
      rows.push({
        "Ruta / Vendedor" : "TOTAL",
        "Unidades"        : fmtInt(totales.unidades),
        "Dólares $"       : fmt(totales.dolares),
        "Facturas"        : totales.cant_facturas,
        "Clientes"        : totales.cant_clientes,
      });
      const ws = XLSX.utils.json_to_sheet([]);
      XLSX.utils.sheet_add_aoa(ws, [[`CAFÉ IIBC — VENTAS ${mes}/${anio}`], []], { origin: "A1" });
      XLSX.utils.sheet_add_json(ws, rows, { origin: "A3" });
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "CafeIIBC");
      XLSX.writeFile(wb, `cafe_iibc_${mes}_${anio}.xlsx`, { compression: true });
    } catch (err) {
      console.error("Error exportando Excel:", err);
    }
  };

  return (
    <div className="mt-6 mb-10">

      {/* KPI Cards */}
      <KpisCafe totales={totales} esMesActual={esMesActual} tendencia6Meses={tendencia6Meses} anioFiltro={Number(anio)} mesFiltro={Number(mes)} />

      {/* Tabla */}
      <div className="bg-[#012E24] text-white rounded-lg shadow-md border border-[#046C5E] mt-6">

        {/* Encabezado */}
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between px-4 py-4">
          <h2 className="text-lg md:text-xl font-bold text-cyan-300">
            CAFÉ — IIBC S.A.
          </h2>
          <div className="flex gap-3 flex-wrap items-center">
            <div className="bg-[#011f1a] border border-[#046C5E] rounded-lg px-3 py-2 text-center">
              <p className="text-xs text-gray-400">Dólares $</p>
              <p className="text-base font-bold text-white">${fmt(totales.dolares)}</p>
            </div>
            {esMesActual && (
              <div className="bg-[#011f1a] border border-[#046C5E] rounded-lg px-3 py-2 text-center">
                <p className="text-xs text-gray-400">Proyección</p>
                <p className="text-base font-bold text-emerald-400">${fmt(totales.proyeccion_dolares)}</p>
              </div>
            )}
            <div className="bg-[#011f1a] border border-[#046C5E] rounded-lg px-3 py-2 text-center">
              <p className="text-xs text-gray-400">Unidades</p>
              <p className="text-base font-bold text-cyan-300">{fmtInt(totales.unidades)}</p>
            </div>
            <div className="bg-[#011f1a] border border-[#046C5E] rounded-lg px-3 py-2 text-center">
              <p className="text-xs text-gray-400">Facturas</p>
              <p className="text-base font-bold text-blue-300">{totales.cant_facturas}</p>
            </div>
            <div className="bg-[#011f1a] border border-[#046C5E] rounded-lg px-3 py-2 text-center">
              <p className="text-xs text-gray-400">Clientes</p>
              <p className="text-base font-bold text-amber-300">{totales.cant_clientes}</p>
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

        {/* Tabla */}
        <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-[#014434] text-green-300 uppercase text-xs">
            <tr>
              <th className="px-4 py-3 text-left">Canal</th>
              <th className="px-4 py-3 text-right">Unidades</th>
              <th className="px-4 py-3 text-right">Dólares $</th>
              {esMesActual && <th className="px-4 py-3 text-right">Proyección</th>}
              <th className="px-4 py-3 text-right">Variación</th>
              <th className="px-4 py-3 text-right">%</th>
              <th className="px-4 py-3 text-right">Facturas</th>
              <th className="px-4 py-3 text-right">Clientes</th>
            </tr>
          </thead>
          <tbody>
            {/* Fila total — clickeable */}
            <tr
              className="bg-[#013d32] border-l-4 border-transparent cursor-pointer hover:bg-[#025940] transition"
              onClick={() => navigate(`/cafe/clientes/${anio}/${mes}`)}
            >
              <td className="px-4 py-3 font-bold text-cyan-300">
                CAFÉ — IIBC S.A.
                <span className="ml-2 text-[10px] text-gray-400 font-normal italic">Ver clientes →</span>
              </td>
              <td className="px-4 py-3 text-right text-green-400 font-bold">{fmtInt(totales.unidades)}</td>
              <td className="px-4 py-3 text-right font-bold text-white">${fmt(totales.dolares)}</td>
              {esMesActual && (
                <td className="px-4 py-3 text-right font-bold text-emerald-400">
                  ${fmt(totales.proyeccion_dolares)}
                </td>
              )}
              <td className={`px-4 py-3 text-right font-bold ${varDolPos ? "text-green-400" : "text-red-400"}`}>
                {sinDatos ? (
                  <span className="text-gray-500 font-normal">Sin datos</span>
                ) : (
                  <>
                    <span className="block text-gray-300 font-normal text-xs">${fmt(totales.mes_anterior.dolares)}</span>
                    {varDolPos ? "+" : "-"}${fmt(Math.abs(totales.variacion_dolares.abs))}
                  </>
                )}
              </td>
              <td className={`px-4 py-3 text-right font-bold ${varDolPos ? "text-green-400" : "text-red-400"}`}>
                {sinDatos ? (
                  <span className="text-gray-500 font-normal">—</span>
                ) : (
                  totales.variacion_dolares.porcentaje !== null
                    ? `${totales.variacion_dolares.porcentaje >= 0 ? "+" : ""}${totales.variacion_dolares.porcentaje.toFixed(2)}%`
                    : "–"
                )}
              </td>
              <td className="px-4 py-3 text-right text-blue-300">{totales.cant_facturas}</td>
              <td className="px-4 py-3 text-right text-amber-300 font-bold">{totales.cant_clientes}</td>
            </tr>

          </tbody>
        </table>
        </div>
      </div>
    </div>
  );
}
