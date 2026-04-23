// components/ComponentPreventa/TablaCOTTSA.tsx
import React, { useState, useEffect } from "react";
import * as XLSX from "xlsx";
import { BsDownload, BsGear, BsPlusCircle, BsX } from "react-icons/bs";
import { useAuth } from "../../components/auth/AuthContext";
import { useNavigate } from "react-router-dom";
import { API_BASE_URL } from "../../config";

interface ExtraCOTTSA {
  unidades: number;
  dolares: number;
  facturas: number;
}

const EXTRA_VACIO: ExtraCOTTSA = { unidades: 0, dolares: 0, facturas: 0 };

const authHeaders = (): Record<string, string> => {
  const token = localStorage.getItem('app_token');
  return token ? { Authorization: `Bearer ${token}` } : {};
};

const fetchExtra = async (anio: number | string, mes: number | string): Promise<ExtraCOTTSA> => {
  try {
    const res = await fetch(`${API_BASE_URL}/api/COTTSA/extra?anio=${anio}&mes=${mes}`, {
      headers: authHeaders(),
    });
    if (!res.ok) return EXTRA_VACIO;
    const data = await res.json();
    return {
      unidades: Number(data.unidades) || 0,
      dolares: Number(data.dolares) || 0,
      facturas: Number(data.facturas) || 0,
    };
  } catch {
    return EXTRA_VACIO;
  }
};

const guardarExtraRemoto = async (
  anio: number | string,
  mes: number | string,
  data: ExtraCOTTSA
): Promise<ExtraCOTTSA> => {
  const res = await fetch(`${API_BASE_URL}/api/COTTSA/extra`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify({ anio, mes, ...data }),
  });
  if (!res.ok) throw new Error('No se pudo guardar');
  const j = await res.json();
  return {
    unidades: Number(j.unidades) || 0,
    dolares: Number(j.dolares) || 0,
    facturas: Number(j.facturas) || 0,
  };
};

interface TotalesCOTTSA {
  unidades: number;
  dolares: number;
  proyeccion: number;
  cant_facturas: number;
  cant_clientes: number;
  mesAnterior?: number;
  objetivo_gerencia?: number;
  objetivo_gerencia_unidades?: number;
}

interface RutaCOTTSA {
  vsMesAnterior: {
    dolares_anterior: number;
    variacion_abs: number;
    variacion_porc: number | null;
  };
  dolares: number;
  proyeccion: number;
}

interface DatosCOTTSA {
  ranking: RutaCOTTSA[];
  totales: TotalesCOTTSA;
}

interface Props {
  anio: number | string;
  mes: number | string;
  onTotalesLoaded?: (totales: {
    canal: string;
    monto: number;
    montoReal?: number;
    mesAnterior: number;
    variacionAbs: number;
    variacionPorc: number;
    unidades: number;
  }) => void;
}

const fmt = (n: number) => n.toLocaleString("es-EC", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtInt = (n: number) => n.toLocaleString("es-EC");

export default function TablaCOTTSA({ anio, mes, onTotalesLoaded }: Props) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const isAdmin = (user?.role ?? "").toUpperCase() === "ADMIN";

  const [datos, setDatos] = useState<DatosCOTTSA | null>(null);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [extra, setExtra] = useState<ExtraCOTTSA>(EXTRA_VACIO);
  const [mostrarModal, setMostrarModal] = useState(false);
  const [formUnidades, setFormUnidades] = useState("");
  const [formDolares, setFormDolares] = useState("");
  const [formFacturas, setFormFacturas] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [errorModal, setErrorModal] = useState<string | null>(null);

  useEffect(() => {
    let cancelado = false;
    fetchExtra(anio, mes).then(d => { if (!cancelado) setExtra(d); });
    return () => { cancelado = true; };
  }, [anio, mes]);

  useEffect(() => {
    if (!datos || !onTotalesLoaded) return;
    const ant = datos.totales.mesAnterior ?? datos.ranking.reduce((a, r) => a + r.vsMesAnterior.dolares_anterior, 0);
    const hoyNow = new Date();
    const esMes = Number(anio) === hoyNow.getFullYear() && Number(mes) === hoyNow.getMonth() + 1;
    const dolaresReal = datos.totales.dolares + extra.dolares;
    const proyeccionTot = datos.totales.proyeccion + extra.dolares;
    const montoComparar = esMes ? proyeccionTot : dolaresReal;
    const varAbs = montoComparar - ant;
    onTotalesLoaded({
      canal: "COTTSA - AGUA OK",
      monto: montoComparar,
      montoReal: dolaresReal,
      mesAnterior: ant,
      variacionAbs: varAbs,
      variacionPorc: ant > 0 ? (varAbs / ant) * 100 : 0,
      unidades: datos.totales.unidades + extra.unidades,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [extra, datos]);

  const abrirModal = () => {
    setFormUnidades(extra.unidades ? String(extra.unidades) : "");
    setFormDolares(extra.dolares ? String(extra.dolares) : "");
    setFormFacturas(extra.facturas ? String(extra.facturas) : "");
    setErrorModal(null);
    setMostrarModal(true);
  };

  const guardarModal = async () => {
    const nuevo: ExtraCOTTSA = {
      unidades: Number(formUnidades) || 0,
      dolares: Number(formDolares) || 0,
      facturas: Number(formFacturas) || 0,
    };
    setGuardando(true);
    setErrorModal(null);
    try {
      const guardado = await guardarExtraRemoto(anio, mes, nuevo);
      setExtra(guardado);
      setMostrarModal(false);
    } catch (e: any) {
      setErrorModal(e?.message || "Error al guardar");
    } finally {
      setGuardando(false);
    }
  };

  const limpiarExtra = async () => {
    setGuardando(true);
    setErrorModal(null);
    try {
      const guardado = await guardarExtraRemoto(anio, mes, EXTRA_VACIO);
      setExtra(guardado);
      setMostrarModal(false);
    } catch (e: any) {
      setErrorModal(e?.message || "Error al limpiar");
    } finally {
      setGuardando(false);
    }
  };

  const hoy = new Date();
  const esMesActual = Number(anio) === hoy.getFullYear() && Number(mes) === hoy.getMonth() + 1;

  useEffect(() => {
    if (!anio || !mes) return;
    setCargando(true);
    setError(null);
    fetch(`${API_BASE_URL}/api/COTTSA/dashboard?anio=${anio}&mes=${mes}`)
      .then(res => { if (!res.ok) throw new Error("Error COTTSA"); return res.json(); })
      .then((data: DatosCOTTSA) => setDatos(data))
      .catch(err => setError(err.message))
      .finally(() => setCargando(false));
  }, [anio, mes]);

  if (cargando)
    return (
      <div className="flex justify-center items-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-[#046C5E]" />
        <span className="ml-3 text-gray-400">Cargando datos COTTSA...</span>
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

  // Totales combinados (datos del sistema + datos externos cargados desde el modal)
  const unidadesTotal = totales.unidades + extra.unidades;
  const dolaresTotal = totales.dolares + extra.dolares;
  const proyeccionTotal = totales.proyeccion + extra.dolares;
  const facturasTotal = totales.cant_facturas + extra.facturas;
  const hayExtra = extra.unidades > 0 || extra.dolares > 0 || extra.facturas > 0;

  // Variación del canal vs mes anterior
  const totalAnterior = totales.mesAnterior ?? ranking.reduce((a, r) => a + r.vsMesAnterior.dolares_anterior, 0);
  const montoActualTabla = esMesActual ? proyeccionTotal : dolaresTotal;
  const totalVariacion = montoActualTabla - totalAnterior;
  const porcVariacion = totalAnterior > 0 ? (totalVariacion / totalAnterior) * 100 : null;
  const esPositivo = totalVariacion >= 0;
  const sinDatos = totalAnterior === 0;

  // Objetivo de gerencia del canal
  const objetivo = Number(totales.objetivo_gerencia || 0);
  const objUnidades = Number(totales.objetivo_gerencia_unidades || 0);

  // Variación vs cupo (si hay objetivo configurado)
  const variacionVsCupo = objetivo > 0 ? montoActualTabla - objetivo : null;
  const porcVariacionVsCupo = objetivo > 0 && objetivo > 0
    ? (variacionVsCupo! / objetivo) * 100
    : null;

  const precioPromedio = unidadesTotal > 0 ? dolaresTotal / unidadesTotal : 0;

  const exportarExcel = () => {
    if (!datos) return;
    try {
      const row = {
        "Canal": "COTTSA - AGUA OK",
        "Unidades": fmtInt(unidadesTotal),
        "Dólares $": fmt(dolaresTotal),
        "Proyección": fmt(proyeccionTotal),
        "Cupo Gerencia": objetivo > 0 ? fmt(objetivo) : "—",
        "Mes Anterior $": sinDatos ? "Sin datos" : fmt(totalAnterior),
        "Variación $": sinDatos ? "Sin datos" : fmt(totalVariacion),
        "Variación %": sinDatos ? "Sin datos" : porcVariacion !== null ? `${porcVariacion >= 0 ? "+" : ""}${porcVariacion.toFixed(2)}%` : "–",
        "Facturas": facturasTotal,
        "Clientes": totales.cant_clientes,
        "Extra Unidades": extra.unidades,
        "Extra Dólares": fmt(extra.dolares),
        "Extra Facturas": extra.facturas,
      };
      const ws = XLSX.utils.json_to_sheet([]);
      XLSX.utils.sheet_add_aoa(ws, [[`COTTSA — VENTAS POR RUTA - ${mes}/${anio}`], []], { origin: "A1" });
      XLSX.utils.sheet_add_json(ws, [row], { origin: "A3" });
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "COTTSA");
      XLSX.writeFile(wb, `COTTSA_${mes}_${anio}.xlsx`, { compression: true });
    } catch (err) {
      console.error("Error exportando Excel:", err);
    }
  };

  return (
    <div className="bg-[#012E24] text-white rounded-lg shadow-md border border-[#046C5E] mt-6 mb-10">

      {/* ── Encabezado con KPIs ──────────────────────────────── */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between px-4 py-4">
        <h2 className="text-lg md:text-xl font-bold text-blue-300">
          COTTSA — VENTAS - AGUA OK
        </h2>

        <div className="flex gap-3 flex-wrap items-center">
          <div className="bg-[#011f1a] border border-[#046C5E] rounded-lg px-3 py-2 text-center">
            <p className="text-xs text-gray-400">Dólares $</p>
            <p className="text-base font-bold text-white">${fmt(dolaresTotal)}</p>
            {hayExtra && (
              <p className="text-[10px] text-purple-300 italic mt-0.5">
                +${fmt(extra.dolares)} externo
              </p>
            )}
          </div>
          {esMesActual && (
            <div className="bg-[#011f1a] border border-[#046C5E] rounded-lg px-3 py-2 text-center">
              <p className="text-xs text-gray-400">Proyección</p>
              <p className="text-base font-bold text-emerald-400">${fmt(proyeccionTotal)}</p>
            </div>
          )}
          <div className="bg-[#011f1a] border border-[#046C5E] rounded-lg px-3 py-2 text-center">
            <p className="text-xs text-gray-400">Unidades</p>
            <p className="text-base font-bold text-blue-300">{fmtInt(unidadesTotal)}</p>
            {hayExtra && (
              <p className="text-[10px] text-purple-300 italic mt-0.5">
                +{fmtInt(extra.unidades)} externo
              </p>
            )}
          </div>

          <div className="bg-[#011f1a] border border-[#046C5E] rounded-lg px-3 py-2 text-center">
            <p className="text-xs text-gray-400">Precio Prom.</p>
            <p className="text-base font-bold text-purple-300">
              ${fmt(precioPromedio)}
            </p>
          </div>


          <div className="bg-[#011f1a] border border-[#046C5E] rounded-lg px-3 py-2 text-center">
            <p className="text-xs text-gray-400">Facturas</p>
            <p className="text-base font-bold text-white">{facturasTotal}</p>
          </div>
          <div className="bg-[#011f1a] border border-amber-500/40 rounded-lg px-3 py-2 text-center">
            <p className="text-xs text-amber-400">Cupo</p>
            <p className="text-base font-bold text-amber-300">
              {objetivo > 0 ? `$${fmt(objetivo)}` : <span className="text-gray-500 text-sm">—</span>}
            </p>
          </div>
          {isAdmin && (
            <button
              onClick={abrirModal}
              title="Agregar datos de sistema externo"
              className={`flex items-center gap-2 px-4 py-2 rounded-lg border font-semibold active:scale-[0.98] transition-all ${hayExtra
                ? "border-purple-400/70 bg-purple-500/25 text-purple-100 hover:bg-purple-500/35"
                : "border-purple-500/60 bg-purple-500/20 text-white hover:bg-purple-500/30"
                }`}
            >
              <BsPlusCircle size={16} className="shrink-0" />
              <span>{hayExtra ? "Editar externo" : "Añadir externo"}</span>
            </button>
          )}
          {isAdmin && (
            <button
              onClick={() => navigate("/configurar-metas")}
              title="Configurar Metas"
              className="flex items-center gap-2 px-4 py-2 rounded-lg border border-blue-500/60 bg-blue-500/20 text-white font-semibold hover:bg-blue-500/30 active:scale-[0.98] transition-all"
            >
              <BsGear size={16} className="text-white shrink-0" />
              <span>Metas</span>
            </button>
          )}
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
              <th className="px-4 py-3 text-right">Precio Promedio	</th>
              {esMesActual && <th className="px-4 py-3 text-right">Proyección</th>}
              <th className="px-4 py-3 text-right text-amber-300">Cupo</th>
              <th className="px-4 py-3 text-right">Variación</th>
              <th className="px-4 py-3 text-right">%</th>
              <th className="px-4 py-3 text-right">Facturas</th>
              <th className="px-4 py-3 text-right">Clientes</th>
            </tr>
          </thead>

          <tbody>
            <tr
              onClick={() => navigate(`/COTTSA/clientes/${anio}/${mes}`, {
                state: {
                  objetivo_gerencia: objetivo,
                  objetivo_gerencia_unidades: objUnidades,
                  proyeccion: totales.proyeccion,
                  monto: totales.dolares,
                },
              })}
              className="bg-[#013d32] cursor-pointer hover:bg-[#025940] border-l-4 border-transparent hover:border-green-400 transition-all duration-200"
            >
              <td className="px-4 py-3 font-bold text-blue-300">
                <div className="flex items-center gap-3 flex-wrap">
                  <span>COTTSA — AGUA OK</span>
                  {hayExtra && (
                    <span
                      title={`Externo: ${fmtInt(extra.unidades)} und · $${fmt(extra.dolares)}`}
                      className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-purple-500/25 text-purple-200 border border-purple-400/60 whitespace-nowrap tracking-wide"
                    >
                      + Externo
                    </span>
                  )}
                </div>
                <span className="ml-0 text-[10px] text-gray-400 font-normal italic">Ver clientes →</span>
              </td>

              <td className="px-4 py-3 text-right text-green-400 font-bold">
                {fmtInt(unidadesTotal)}
                {hayExtra && (
                  <span className="block text-[10px] text-purple-300 font-normal italic">
                    +{fmtInt(extra.unidades)}
                  </span>
                )}
              </td>

              <td className="px-4 py-3 text-right font-bold text-white">
                ${fmt(dolaresTotal)}
                {hayExtra && (
                  <span className="block text-[10px] text-purple-300 font-normal italic">
                    +${fmt(extra.dolares)}
                  </span>
                )}
              </td>


              <td className="px-4 py-3 text-right text-purple-300 font-bold">
                ${fmt(precioPromedio)}
              </td>

              {esMesActual && (
                <td className="px-4 py-3 text-right font-bold text-emerald-400">
                  ${fmt(proyeccionTotal)}
                </td>
              )}

              {/* CUPO */}
              <td className="px-4 py-3 text-right font-bold text-amber-300">
                {objetivo > 0 ? `$${fmt(objetivo)}` : <span className="text-gray-500">—</span>}
              </td>

              {/* Variación — usa cupo si está configurado, si no usa mes anterior */}
              <td className={`px-4 py-3 text-right font-bold ${objetivo > 0
                ? variacionVsCupo! >= 0 ? "text-green-400" : "text-red-400"
                : sinDatos ? "" : esPositivo ? "text-green-400" : "text-red-400"
                }`}>
                {objetivo > 0 ? (
                  <>
                    {variacionVsCupo! >= 0 ? "+" : "-"}${fmt(Math.abs(variacionVsCupo!))}
                  </>
                ) : sinDatos ? (
                  <span className="text-gray-500 font-normal">Sin datos</span>
                ) : (
                  <>
                    <span className="block text-gray-300 font-normal text-xs">${fmt(totalAnterior)}</span>
                    {esPositivo ? "+" : "-"}${fmt(Math.abs(totalVariacion))}
                  </>
                )}
              </td>

              {/* % */}
              <td className={`px-4 py-3 text-right font-bold ${objetivo > 0
                ? porcVariacionVsCupo! >= 0 ? "text-green-400" : "text-red-400"
                : sinDatos ? "" : esPositivo ? "text-green-400" : "text-red-400"
                }`}>
                {objetivo > 0 ? (
                  porcVariacionVsCupo !== null
                    ? `${porcVariacionVsCupo >= 0 ? "+" : ""}${porcVariacionVsCupo.toFixed(2)}%`
                    : "–"
                ) : sinDatos ? (
                  <span className="text-gray-500 font-normal">—</span>
                ) : (
                  porcVariacion !== null
                    ? `${porcVariacion >= 0 ? "+" : ""}${porcVariacion.toFixed(2)}%`
                    : "–"
                )}
              </td>

              <td className="px-4 py-3 text-right text-gray-300">
                {facturasTotal}
                {hayExtra && extra.facturas > 0 && (
                  <span className="block text-[10px] text-purple-300 font-normal italic">
                    +{extra.facturas}
                  </span>
                )}
              </td>
              <td className="px-4 py-3 text-right text-gray-300">{totales.cant_clientes}</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* ── Modal Agregar datos externos ─────────────────────────── */}
      {mostrarModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={() => setMostrarModal(false)}>
          <div
            className="bg-[#012E24] border border-purple-500/50 rounded-xl shadow-2xl w-full max-w-md p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-purple-300">Añadir datos externos · COTTSA</h3>
              <button onClick={() => setMostrarModal(false)} className="text-gray-400 hover:text-white">
                <BsX size={24} />
              </button>
            </div>

            <p className="text-xs text-gray-400 mb-4">
              Ingresa los totales de unidades y dólares provenientes del sistema externo (mes {mes}/{anio}).
              Estos valores se sumarán al total actual de COTTSA y se guardan en servidor (visibles desde cualquier navegador).
            </p>

            {errorModal && (
              <div className="mb-3 p-2 rounded bg-red-900/30 border border-red-500/50 text-red-300 text-xs">
                {errorModal}
              </div>
            )}

            <div className="space-y-3">
              <label className="block">
                <span className="text-xs text-gray-300">Unidades externas</span>
                <input
                  type="number"
                  min={0}
                  step="1"
                  value={formUnidades}
                  onChange={(e) => setFormUnidades(e.target.value)}
                  placeholder="Ej: 103049"
                  className="mt-1 w-full rounded-lg bg-[#011f1a] border border-[#046C5E] px-3 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-purple-400"
                />
              </label>

              <label className="block">
                <span className="text-xs text-gray-300">Dólares externos ($)</span>
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  value={formDolares}
                  onChange={(e) => setFormDolares(e.target.value)}
                  placeholder="Ej: 12500.50"
                  className="mt-1 w-full rounded-lg bg-[#011f1a] border border-[#046C5E] px-3 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-purple-400"
                />
              </label>

              <label className="block">
                <span className="text-xs text-gray-300">Facturas externas (opcional)</span>
                <input
                  type="number"
                  min={0}
                  step="1"
                  value={formFacturas}
                  onChange={(e) => setFormFacturas(e.target.value)}
                  placeholder="Ej: 120"
                  className="mt-1 w-full rounded-lg bg-[#011f1a] border border-[#046C5E] px-3 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-purple-400"
                />
              </label>
            </div>

            <div className="flex gap-2 mt-6">
              <button
                onClick={guardarModal}
                disabled={guardando}
                className="flex-1 px-4 py-2 rounded-lg border border-purple-500/60 bg-purple-500/30 text-white font-semibold hover:bg-purple-500/40 active:scale-[0.98] transition-all disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {guardando ? "Guardando..." : "Guardar"}
              </button>
              {hayExtra && (
                <button
                  onClick={limpiarExtra}
                  disabled={guardando}
                  className="px-4 py-2 rounded-lg border border-red-500/50 bg-red-500/20 text-red-200 font-semibold hover:bg-red-500/30 active:scale-[0.98] transition-all disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  Limpiar
                </button>
              )}
              <button
                onClick={() => setMostrarModal(false)}
                disabled={guardando}
                className="px-4 py-2 rounded-lg border border-[#046C5E] bg-[#011f1a] text-gray-300 font-semibold hover:bg-[#022a22] active:scale-[0.98] transition-all disabled:opacity-60"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
