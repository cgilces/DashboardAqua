// components/ComponentPreventa/TablaCotsa.tsx
import React, { useState, useEffect } from "react";
import * as XLSX from "xlsx";
import { BsDownload } from "react-icons/bs";
import { useAuth } from "../../components/auth/AuthContext";
import { useNavigate } from "react-router-dom";
import { API_BASE_URL } from "../../config";

interface TotalesCotsa {
  unidades: number;
  dolares: number;
  proyeccion: number;
  cant_facturas: number;
  cant_clientes: number;
  mesAnterior?: number;
}

interface RutaCotsa {
  vsMesAnterior: {
    dolares_anterior: number;
    variacion_abs: number;
    variacion_porc: number | null;
  };
  dolares: number;
  proyeccion: number;
}

interface DatosCotsa {
  ranking: RutaCotsa[];
  totales: TotalesCotsa;
}

interface Props {
  anio: number | string;
  mes: number | string;
  onTotalesLoaded?: (totales: { canal: string; monto: number; mesAnterior: number; variacionAbs: number; variacionPorc: number; unidades: number }) => void;
}

const fmt    = (n: number) => n.toLocaleString("es-EC", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtInt = (n: number) => n.toLocaleString("es-EC");

export default function TablaCotsa({ anio, mes, onTotalesLoaded }: Props) {
  const { user }   = useAuth();
  const navigate   = useNavigate();
  const isAdmin    = (user?.role ?? "").toUpperCase() === "ADMIN";

  const [datos,    setDatos]    = useState<DatosCotsa | null>(null);
  const [cargando, setCargando] = useState(false);
  const [error,    setError]    = useState<string | null>(null);

  const hoy         = new Date();
  const esMesActual = Number(anio) === hoy.getFullYear() && Number(mes) === hoy.getMonth() + 1;

  useEffect(() => {
    if (!anio || !mes) return;
    setCargando(true);
    setError(null);
    fetch(`${API_BASE_URL}/api/cotsa/dashboard?anio=${anio}&mes=${mes}`)
      .then(res => { if (!res.ok) throw new Error("Error COTSA"); return res.json(); })
      .then((data: DatosCotsa) => {
        setDatos(data);
        if (onTotalesLoaded) {
          // Usar mesAnterior del backend (incluye TODAS las rutas del mes anterior, no solo las actuales)
          const ant = data.totales.mesAnterior ?? data.ranking.reduce((a, r) => a + r.vsMesAnterior.dolares_anterior, 0);
          const hoy = new Date();
          const esMes = Number(anio) === hoy.getFullYear() && Number(mes) === hoy.getMonth() + 1;
          const montoComparar = esMes ? data.totales.proyeccion : data.totales.dolares;
          const varAbs = montoComparar - ant;
          onTotalesLoaded({
            canal: "COTSA - AGUA OK",
            monto: montoComparar,
            montoReal: data.totales.dolares,
            mesAnterior: ant,
            variacionAbs: varAbs,
            variacionPorc: ant > 0 ? (varAbs / ant) * 100 : 0,
            unidades: data.totales.unidades,
          });
        }
      })
      .catch(err => setError(err.message))
      .finally(() => setCargando(false));
  }, [anio, mes]);

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

  const { totales, ranking } = datos;

  // Calcular variación total del canal
  // totalAnterior: usa el valor del backend que incluye TODAS las rutas del mes anterior
  const totalAnterior  = totales.mesAnterior ?? ranking.reduce((a, r) => a + r.vsMesAnterior.dolares_anterior, 0);
  const montoActualTabla = esMesActual ? totales.proyeccion : totales.dolares;
  const totalVariacion = montoActualTabla - totalAnterior;
  const porcVariacion  = totalAnterior > 0 ? (totalVariacion / totalAnterior) * 100 : null;
  const esPositivo     = totalVariacion >= 0;
  const sinDatos       = totalAnterior === 0;

  const exportarExcel = () => {
    if (!datos) return;
    try {
      const row = {
        "Canal"          : "COTSA - AGUA OK",
        "Unidades"       : fmtInt(totales.unidades),
        "Dólares $"      : fmt(totales.dolares),
        "Proyección"     : fmt(totales.proyeccion),
        "Mes Anterior $" : sinDatos ? "Sin datos" : fmt(totalAnterior),
        "Variación $"    : sinDatos ? "Sin datos" : fmt(totalVariacion),
        "Variación %"    : sinDatos ? "Sin datos" : porcVariacion !== null ? `${porcVariacion >= 0 ? "+" : ""}${porcVariacion.toFixed(2)}%` : "–",
        "Facturas"       : totales.cant_facturas,
        "Clientes"       : totales.cant_clientes,
      };
      const ws = XLSX.utils.json_to_sheet([]);
      XLSX.utils.sheet_add_aoa(ws, [[`COTSA — VENTAS POR RUTA - ${mes}/${anio}`], []], { origin: "A1" });
      XLSX.utils.sheet_add_json(ws, [row], { origin: "A3" });
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "CotSA");
      XLSX.writeFile(wb, `cotsa_${mes}_${anio}.xlsx`, { compression: true });
    } catch (err) {
      console.error("Error exportando Excel:", err);
    }
  };

  return (
    <div className="bg-[#012E24] text-white rounded-lg shadow-md border border-[#046C5E] mt-6 mb-10">

      {/* ── Encabezado con KPIs ──────────────────────────────── */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between px-4 py-4">
        <h2 className="text-lg md:text-xl font-bold text-blue-300">
          COTSA — VENTAS - AGUA OK
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

      {/* ── Fila única del canal ─────────────────────────────── */}
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
          <tr
            onClick={() => navigate(`/cotsa/clientes/${anio}/${mes}`)}
            className="bg-[#013d32] cursor-pointer hover:bg-[#016a57] border-l-4 border-transparent hover:border-green-400 transition-all duration-200"
          >
            <td className="px-4 py-3 font-bold text-blue-300">
              COTSA — AGUA OK
              <span className="ml-2 text-[10px] text-gray-400 font-normal italic">Ver clientes →</span>
            </td>

            <td className="px-4 py-3 text-right text-green-400 font-bold">
              {fmtInt(totales.unidades)}
            </td>

            <td className="px-4 py-3 text-right font-bold text-white">
              ${fmt(totales.dolares)}
            </td>

            {esMesActual && (
              <td className="px-4 py-3 text-right font-bold text-emerald-400">
                ${fmt(totales.proyeccion)}
              </td>
            )}

            {/* Variación */}
            <td className={`px-4 py-3 text-right font-bold ${esPositivo ? "text-green-400" : "text-red-400"}`}>
              {sinDatos ? (
                <span className="text-gray-500 font-normal">Sin datos</span>
              ) : (
                <>
                  <span className="block text-gray-300 font-normal text-xs">
                    ${fmt(totalAnterior)}
                  </span>
                  {esPositivo ? "+" : "-"}${fmt(Math.abs(totalVariacion))}
                </>
              )}
            </td>

            {/* % */}
            <td className={`px-4 py-3 text-right font-bold ${esPositivo ? "text-green-400" : "text-red-400"}`}>
              {sinDatos ? (
                <span className="text-gray-500 font-normal">—</span>
              ) : (
                porcVariacion !== null
                  ? `${porcVariacion >= 0 ? "+" : ""}${porcVariacion.toFixed(2)}%`
                  : "–"
              )}
            </td>

            <td className="px-4 py-3 text-right text-gray-300">{totales.cant_facturas}</td>
            <td className="px-4 py-3 text-right text-gray-300">{totales.cant_clientes}</td>
          </tr>
        </tbody>
      </table>
      </div>
    </div>
  );
}
