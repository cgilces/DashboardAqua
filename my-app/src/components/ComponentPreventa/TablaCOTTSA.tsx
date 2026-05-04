// components/ComponentPreventa/TablaCOTTSA.tsx
import React, { useState, useEffect } from "react";
import * as XLSX from "xlsx";
import { BsDownload, BsGear, BsPlusCircle, BsX } from "react-icons/bs";
import { AlertTriangle, Lightbulb, ShoppingCart } from "lucide-react";
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
  ruta?: string;
  vendedor?: string;
  unidades?: number;
  cant_facturas?: number;
  cant_clientes?: number;
  vsMesAnterior: {
    dolares_anterior: number;
    variacion_abs: number;
    variacion_porc: number | null;
  };
  dolares: number;
  proyeccion: number;
}

interface BloquePOS {
  label: string;
  unidades: number;
  subtotal: number;
  dolares: number;
  cant_facturas: number;
  cant_clientes: number;
  huerfanos?: { total: number; cantidad: number };
  vsMesAnterior: {
    dolares_anterior: number;
    variacion_abs: number;
    variacion_porc: number | null;
  };
}

interface DatosCOTTSA {
  ranking: RutaCOTTSA[];
  pos?: BloquePOS;
  totales: TotalesCOTTSA;
}

interface POSDetalleItem {
  id: number;
  caja: string;
  pos_reference: string | null;
  sesion: string | null;
  ruta: string;
  date_order: string;
  cliente: string;
  monto: number;
  documento: string | null;
  tipo: string;
  facturado: boolean;
  es_reembolso: boolean;
}

interface POSDetalleResp {
  items: POSDetalleItem[];
  totales: {
    facts: number;
    notcr: number;
    huerfanos: number;
    neto: number;
    cantidad_total: number;
    cantidad_facturados: number;
    cantidad_huerfanos: number;
  };
}

interface ReembolsoHuerfano {
  id: number;
  name: string;
  pos_reference: string | null;
  cliente: string;
  monto: number;
  fecha: string;
  ruta: string;
  estado: string;
}

interface RespuestaHuerfanos {
  cantidad: number;
  total: number;
  reembolsos: ReembolsoHuerfano[];
  advertencia?: string;
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

  const [huerfanos, setHuerfanos] = useState<RespuestaHuerfanos | null>(null);
  const [mostrarHuerfanos, setMostrarHuerfanos] = useState(false);
  const [mostrarDesglose, setMostrarDesglose] = useState(false);

  const [posDetalle, setPosDetalle] = useState<POSDetalleResp | null>(null);
  const [posDetalleAbierto, setPosDetalleAbierto] = useState(false);
  const [posDetalleCargando, setPosDetalleCargando] = useState(false);
  const [posDetalleError, setPosDetalleError] = useState<string | null>(null);
  const [posBusqueda, setPosBusqueda] = useState("");
  const [posFiltroTipo, setPosFiltroTipo] = useState<"todos" | "fact" | "notcr" | "huerfanos">("todos");

  const abrirPOSDetalle = async () => {
    setPosDetalleAbierto(true);
    setPosBusqueda("");
    setPosFiltroTipo("todos");
    if (posDetalle) return; // ya está cargado
    setPosDetalleCargando(true);
    setPosDetalleError(null);
    try {
      const res = await fetch(`${API_BASE_URL}/api/COTTSA/pos-detalle?anio=${anio}&mes=${mes}`, {
        headers: authHeaders(),
      });
      if (!res.ok) throw new Error("No se pudo cargar el detalle POS");
      const data: POSDetalleResp = await res.json();
      setPosDetalle(data);
    } catch (e: any) {
      setPosDetalleError(e?.message || "Error al cargar detalle POS");
    } finally {
      setPosDetalleCargando(false);
    }
  };

  // Limpiar la cache cuando cambie el mes/año
  useEffect(() => {
    setPosDetalle(null);
  }, [anio, mes]);

  const cerrarPOSDetalle = () => setPosDetalleAbierto(false);

  useEffect(() => {
    let cancelado = false;
    fetchExtra(anio, mes).then(d => { if (!cancelado) setExtra(d); });
    return () => { cancelado = true; };
  }, [anio, mes]);

  useEffect(() => {
    let cancelado = false;
    setHuerfanos(null);
    fetch(`${API_BASE_URL}/api/COTTSA/reembolsos-huerfanos?anio=${anio}&mes=${mes}`, {
      headers: authHeaders(),
    })
      .then(res => res.ok ? res.json() : null)
      .then((data: RespuestaHuerfanos | null) => {
        if (!cancelado && data) setHuerfanos(data);
      })
      .catch(() => { /* silencioso: si falla, no rompe la tabla */ });
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

      {/* ── Banner de reembolsos POS huérfanos ─────────────────── */}
      {huerfanos && huerfanos.cantidad > 0 && (
        <div className="mx-4 mb-3 rounded-lg border border-amber-500/50 bg-amber-500/10 overflow-hidden">
          <button
            type="button"
            onClick={() => setMostrarHuerfanos(v => !v)}
            className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left hover:bg-amber-500/15 transition-colors"
          >
            <div className="flex items-center gap-3 flex-wrap">
              <AlertTriangle size={20} className="text-amber-300 flex-shrink-0" />
              <div>
                <p className="text-amber-200 font-semibold text-sm">
                  {huerfanos.cantidad} reembolso{huerfanos.cantidad !== 1 ? "s" : ""} POS sin facturar en Odoo
                </p>
                <p className="text-amber-300/70 text-xs">
                  ${fmt(huerfanos.total)} no se están descontando — facturarlos en Odoo y volver a sincronizar
                </p>
              </div>
            </div>
            <span className="text-amber-300 text-xs font-mono shrink-0">
              {mostrarHuerfanos ? "▲ ocultar" : "▼ ver detalle"}
            </span>
          </button>

          {mostrarHuerfanos && (
            <div className="border-t border-amber-500/30 bg-amber-500/5">
              <div className="overflow-x-auto">
                <table className="min-w-full text-xs">
                  <thead className="bg-amber-500/15 text-amber-200 uppercase">
                    <tr>
                      <th className="px-4 py-2 text-left">Fecha</th>
                      <th className="px-4 py-2 text-left">Ruta</th>
                      <th className="px-4 py-2 text-left">Pedido</th>
                      <th className="px-4 py-2 text-left">Cliente</th>
                      <th className="px-4 py-2 text-right">Monto</th>
                    </tr>
                  </thead>
                  <tbody>
                    {huerfanos.reembolsos.map(r => (
                      <tr key={r.id} className="border-t border-amber-500/15 hover:bg-amber-500/10">
                        <td className="px-4 py-2 text-amber-100/80 whitespace-nowrap">
                          {r.fecha ? new Date(r.fecha).toLocaleString("es-EC", {
                            year: "numeric", month: "2-digit", day: "2-digit",
                            hour: "2-digit", minute: "2-digit",
                          }) : "—"}
                        </td>
                        <td className="px-4 py-2 text-amber-200 font-semibold whitespace-nowrap">
                          {r.ruta}
                        </td>
                        <td className="px-4 py-2 text-amber-100/70 font-mono text-[11px]">
                          {r.name}
                        </td>
                        <td className="px-4 py-2 text-amber-100/80">{r.cliente}</td>
                        <td className="px-4 py-2 text-right font-bold text-amber-200 whitespace-nowrap">
                          −${fmt(r.monto)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-amber-500/15 border-t border-amber-500/40">
                    <tr>
                      <td colSpan={4} className="px-4 py-2 text-right font-bold text-amber-200 uppercase text-[11px]">
                        Total no descontado
                      </td>
                      <td className="px-4 py-2 text-right font-bold text-amber-100">
                        −${fmt(huerfanos.total)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
              <p className="px-4 py-2 text-[11px] text-amber-300/80 italic flex items-start gap-1.5">
                <Lightbulb size={12} className="mt-0.5 flex-shrink-0" />
                <span>Estos reembolsos existen como pos.order en Odoo pero no tienen nota de crédito fiscal.
                Para que entren al dashboard hay que facturarlos en Odoo (botón "Crear factura" en cada pedido)
                o activar la auto-facturación en la configuración del POS.</span>
              </p>
            </div>
          )}
        </div>
      )}

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
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); setMostrarDesglose(v => !v); }}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md border border-blue-400/40 bg-blue-500/10 text-[10px] text-blue-200 hover:bg-blue-500/20 transition-colors font-normal"
                    title="Mostrar desglose por ruta"
                  >
                    {mostrarDesglose ? "▲ ocultar desglose" : "▼ ver desglose"}
                  </button>
                </div>
                <span className="ml-0 text-[10px] text-gray-400 font-normal italic">Ver clientes →</span>
              </td>

              <td className="px-4 py-3 text-right text-green-400 font-bold">
                {fmtInt(unidadesTotal)}
              </td>

              <td className="px-4 py-3 text-right font-bold text-white">
                ${fmt(dolaresTotal)}
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
              </td>
              <td className="px-4 py-3 text-right text-gray-300">{totales.cant_clientes}</td>
            </tr>

            {/* ── Desglose por ruta + POS Kenny Navas ─────────────── */}
            {mostrarDesglose && datos && (
              <>
                {hayExtra && (() => {
                  const extPrecio = extra.unidades > 0 ? extra.dolares / extra.unidades : 0;
                  return (
                    <tr className="bg-purple-500/10 border-l-4 border-purple-400/60 text-xs">
                      <td className="pl-10 pr-4 py-2 text-purple-200">
                        <span className="opacity-60 mr-1">↳</span>
                        <span className="font-semibold">Aqua Premium NE</span>
                        <span className="text-gray-500 italic ml-1">(sistema externo · ingresado manual)</span>
                      </td>
                      <td className="px-4 py-2 text-right text-purple-300/90">{fmtInt(extra.unidades)}</td>
                      <td className="px-4 py-2 text-right font-semibold text-purple-200">${fmt(extra.dolares)}</td>
                      <td className="px-4 py-2 text-right text-purple-300">${fmt(extPrecio)}</td>
                      {esMesActual && <td className="px-4 py-2 text-right text-gray-500">—</td>}
                      <td className="px-4 py-2 text-right text-gray-500">—</td>
                      <td className="px-4 py-2 text-right text-gray-500">—</td>
                      <td className="px-4 py-2 text-right text-gray-500">—</td>
                      <td className="px-4 py-2 text-right text-purple-300/80">{extra.facturas || "—"}</td>
                      <td className="px-4 py-2 text-right text-gray-500">—</td>
                    </tr>
                  );
                })()}

                {datos.ranking.map((r, idx) => {
                  const rutaUnidades = Number(r.unidades) || 0;
                  const rutaPrecioProm = rutaUnidades > 0 ? r.dolares / rutaUnidades : 0;
                  const rutaVarAbs = Number(r.vsMesAnterior?.variacion_abs) || 0;
                  const rutaVarPorc = r.vsMesAnterior?.variacion_porc;
                  const rutaSinDatos = (Number(r.vsMesAnterior?.dolares_anterior) || 0) === 0;
                  const rutaPositivo = rutaVarAbs >= 0;
                  return (
                    <tr key={`desglose-${idx}`} className="bg-[#011f1a]/70 border-l-4 border-blue-400/40 text-xs">
                      <td className="pl-10 pr-4 py-2 text-blue-200">
                        <span className="opacity-60 mr-1">↳</span>
                        {r.vendedor || r.ruta}
                      </td>
                      <td className="px-4 py-2 text-right text-green-400/90">{fmtInt(rutaUnidades)}</td>
                      <td className="px-4 py-2 text-right font-semibold text-white">${fmt(r.dolares)}</td>
                      <td className="px-4 py-2 text-right text-purple-300">${fmt(rutaPrecioProm)}</td>
                      {esMesActual && (
                        <td className="px-4 py-2 text-right text-emerald-400/80">${fmt(r.proyeccion)}</td>
                      )}
                      <td className="px-4 py-2 text-right text-gray-500">—</td>
                      <td className={`px-4 py-2 text-right ${rutaSinDatos ? "text-gray-500" : rutaPositivo ? "text-green-400" : "text-red-400"}`}>
                        {rutaSinDatos
                          ? <span className="italic">Sin datos</span>
                          : <>{rutaPositivo ? "+" : "-"}${fmt(Math.abs(rutaVarAbs))}</>
                        }
                      </td>
                      <td className={`px-4 py-2 text-right ${rutaSinDatos ? "text-gray-500" : rutaPositivo ? "text-green-400" : "text-red-400"}`}>
                        {rutaVarPorc !== null && rutaVarPorc !== undefined
                          ? `${rutaVarPorc >= 0 ? "+" : ""}${rutaVarPorc.toFixed(2)}%`
                          : "—"}
                      </td>
                      <td className="px-4 py-2 text-right text-gray-400">{r.cant_facturas ?? "—"}</td>
                      <td className="px-4 py-2 text-right text-gray-400">{r.cant_clientes ?? "—"}</td>
                    </tr>
                  );
                })}

                {datos.pos && (
                  (() => {
                    const p = datos.pos;
                    const posPrecioProm = p.unidades !== 0 ? p.dolares / p.unidades : 0;
                    const posVarAbs = Number(p.vsMesAnterior?.variacion_abs) || 0;
                    const posVarPorc = p.vsMesAnterior?.variacion_porc;
                    const posSinDatos = (Number(p.vsMesAnterior?.dolares_anterior) || 0) === 0;
                    const posPositivo = posVarAbs >= 0;
                    const dolaresColor = p.dolares < 0 ? "text-red-400" : p.dolares > 0 ? "text-white" : "text-gray-400";
                    const tieneHuerfanos = (p.huerfanos?.cantidad ?? 0) > 0;
                    return (
                      <tr
                        onClick={abrirPOSDetalle}
                        className="bg-[#1a1200]/40 border-l-4 border-orange-400/50 text-xs cursor-pointer hover:bg-orange-500/15 hover:border-orange-400 transition-all duration-150"
                        title="Click para ver el detalle POS de Kenny Navas"
                      >
                        <td className="pl-10 pr-4 py-2 text-orange-200">
                          <span className="opacity-60 mr-1">↳</span>
                          {p.label}{" "}
                          <span className="text-gray-500 italic">
                            (POS — neto: Facts − todas las NotCr{tieneHuerfanos ? ` − ${p.huerfanos!.cantidad} huérfanos` : ""})
                          </span>
                          <span className="ml-2 text-[10px] text-orange-300/60 italic">click para ver detalle →</span>
                        </td>
                        <td className="px-4 py-2 text-right text-orange-300/80">
                          {p.unidades < 0 ? `-${fmtInt(Math.abs(p.unidades))}` : fmtInt(p.unidades)}
                        </td>
                        <td className={`px-4 py-2 text-right font-semibold ${dolaresColor}`}>
                          {p.dolares < 0 ? "-" : ""}${fmt(Math.abs(p.dolares))}
                        </td>
                        <td className="px-4 py-2 text-right text-purple-300">${fmt(posPrecioProm)}</td>
                        {esMesActual && <td className="px-4 py-2 text-right text-gray-500">—</td>}
                        <td className="px-4 py-2 text-right text-gray-500">—</td>
                        <td className={`px-4 py-2 text-right ${posSinDatos ? "text-gray-500" : posPositivo ? "text-green-400" : "text-red-400"}`}>
                          {posSinDatos
                            ? <span className="italic">Sin datos</span>
                            : <>{posPositivo ? "+" : "-"}${fmt(Math.abs(posVarAbs))}</>
                          }
                        </td>
                        <td className={`px-4 py-2 text-right ${posSinDatos ? "text-gray-500" : posPositivo ? "text-green-400" : "text-red-400"}`}>
                          {posVarPorc !== null && posVarPorc !== undefined
                            ? `${posVarPorc >= 0 ? "+" : ""}${posVarPorc.toFixed(2)}%`
                            : "—"}
                        </td>
                        <td className="px-4 py-2 text-right text-gray-400">{p.cant_facturas}</td>
                        <td className="px-4 py-2 text-right text-gray-400">{p.cant_clientes}</td>
                      </tr>
                    );
                  })()
                )}
              </>
            )}
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

      {/* ── Modal Detalle POS Kenny Navas ────────────────────────── */}
      {posDetalleAbierto && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-2 sm:p-4"
          onClick={cerrarPOSDetalle}
        >
          <div
            className="bg-gradient-to-br from-[#012E24] to-[#011a14] border border-orange-500/40 rounded-2xl shadow-2xl w-full max-w-6xl max-h-[92vh] flex flex-col overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between gap-3 px-4 sm:px-6 py-4 border-b border-orange-500/30 bg-gradient-to-r from-orange-500/15 to-transparent shrink-0">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-lg bg-orange-500/20 border border-orange-400/40 flex items-center justify-center shrink-0">
                  <ShoppingCart size={20} className="text-orange-300" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-base sm:text-lg font-bold text-orange-200 truncate">POS — Kenny Navas</h3>
                  <p className="text-[11px] text-orange-300/60 truncate">
                    Pedidos de TPV · COTTSA · {String(mes).padStart(2, "0")}/{anio}
                  </p>
                </div>
              </div>
              <button
                onClick={cerrarPOSDetalle}
                className="text-gray-400 hover:text-white p-1.5 rounded-lg hover:bg-white/5 transition shrink-0"
                title="Cerrar"
              >
                <BsX size={26} />
              </button>
            </div>

            {/* Body scrollable */}
            <div className="flex-1 overflow-y-auto">
              {posDetalleCargando && (
                <div className="flex flex-col items-center justify-center py-20 gap-3">
                  <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-orange-400" />
                  <p className="text-orange-200/70 text-sm">Cargando detalle POS desde Odoo…</p>
                </div>
              )}

              {posDetalleError && !posDetalleCargando && (
                <div className="m-4 p-4 rounded-lg bg-red-900/30 border border-red-500/40 text-red-200 text-sm flex items-center gap-2">
                  <AlertTriangle size={16} className="flex-shrink-0" /> {posDetalleError}
                </div>
              )}

              {posDetalle && !posDetalleCargando && (
                <>
                  {/* KPI cards */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2 sm:gap-3 px-3 sm:px-6 pt-4">
                    <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl px-3 py-3">
                      <p className="text-[10px] uppercase tracking-wider text-emerald-300/70 mb-1">Ventas (Fact)</p>
                      <p className="text-sm sm:text-base font-bold text-emerald-300">${fmt(posDetalle.totales.facts)}</p>
                    </div>
                    <div className="bg-red-500/10 border border-red-500/30 rounded-xl px-3 py-3">
                      <p className="text-[10px] uppercase tracking-wider text-red-300/70 mb-1">Reembolsos (NotCr)</p>
                      <p className="text-sm sm:text-base font-bold text-red-300">−${fmt(posDetalle.totales.notcr)}</p>
                    </div>
                    <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl px-3 py-3">
                      <p className="text-[10px] uppercase tracking-wider text-amber-300/70 mb-1">Huérfanos</p>
                      <p className="text-sm sm:text-base font-bold text-amber-300">
                        −${fmt(posDetalle.totales.huerfanos)}
                      </p>
                      <p className="text-[10px] text-amber-300/60 mt-0.5">{posDetalle.totales.cantidad_huerfanos} sin facturar</p>
                    </div>
                    <div className={`bg-gradient-to-br rounded-xl px-3 py-3 border ${
                      posDetalle.totales.neto < 0
                        ? "from-red-500/15 to-orange-500/10 border-red-500/40"
                        : "from-emerald-500/15 to-blue-500/10 border-emerald-500/40"
                    }`}>
                      <p className="text-[10px] uppercase tracking-wider text-white/60 mb-1">Neto Kenny Navas</p>
                      <p className={`text-base sm:text-lg font-extrabold ${
                        posDetalle.totales.neto < 0 ? "text-red-300" : "text-emerald-300"
                      }`}>
                        {posDetalle.totales.neto < 0 ? "−" : ""}${fmt(Math.abs(posDetalle.totales.neto))}
                      </p>
                    </div>
                  </div>

                  {/* Filtros y búsqueda */}
                  <div className="flex flex-col sm:flex-row gap-2 px-3 sm:px-6 py-3 mt-2">
                    <div className="relative flex-1 min-w-0">
                      <svg
                        className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-orange-300/50 pointer-events-none"
                        fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 1 0 5 11a6 6 0 0 0 12 0z"/>
                      </svg>
                      <input
                        type="text"
                        value={posBusqueda}
                        onChange={(e) => setPosBusqueda(e.target.value)}
                        placeholder="Buscar caja, cliente, documento, pedido…"
                        className="w-full bg-[#011f1a] border border-orange-500/30 rounded-lg pl-9 pr-3 py-2 text-sm text-white placeholder-orange-300/40 focus:outline-none focus:border-orange-400/70"
                      />
                    </div>
                    <div className="flex gap-1 flex-wrap">
                      {(() => {
                        // Contadores precalculados (sin depender del filtro actual)
                        const cFact = posDetalle.items.filter(it => it.tipo.startsWith("Fact")).length;
                        // "Reembolsos" muestra NotCr + Facts (para ver el neto Kenny Navas)
                        const cNotCr = posDetalle.items.filter(
                          it => it.tipo.startsWith("NotCr") || it.tipo.startsWith("Fact")
                        ).length;
                        const cHuerfanos = posDetalle.items.filter(it => it.tipo.includes("huérfano")).length;
                        const cTodos = posDetalle.items.length;
                        const tabs = [
                          { key: "todos" as const, label: "Todos", count: cTodos, color: "orange" },
                          { key: "fact" as const, label: "Facturas", count: cFact, color: "emerald" },
                          { key: "notcr" as const, label: "Reembolsos (neto)", count: cNotCr, color: "red" },
                          { key: "huerfanos" as const, label: "Huérfanos", count: cHuerfanos, color: "amber" },
                        ];
                        return tabs.map(({ key, label, count, color }) => {
                          const activo = posFiltroTipo === key;
                          const activeStyles: Record<string, string> = {
                            orange: "bg-orange-500/30 border-orange-400/60 text-orange-100",
                            emerald: "bg-emerald-500/30 border-emerald-400/60 text-emerald-100",
                            red: "bg-red-500/30 border-red-400/60 text-red-100",
                            amber: "bg-amber-500/30 border-amber-400/60 text-amber-100",
                          };
                          const badgeStyles: Record<string, string> = {
                            orange: activo ? "bg-orange-500/40 text-orange-100" : "bg-orange-500/15 text-orange-200",
                            emerald: activo ? "bg-emerald-500/40 text-emerald-100" : "bg-emerald-500/15 text-emerald-200",
                            red: activo ? "bg-red-500/40 text-red-100" : "bg-red-500/15 text-red-200",
                            amber: activo ? "bg-amber-500/40 text-amber-100" : "bg-amber-500/15 text-amber-200",
                          };
                          return (
                            <button
                              key={key}
                              onClick={() => setPosFiltroTipo(key)}
                              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold border transition ${
                                activo
                                  ? activeStyles[color]
                                  : "bg-[#011f1a] border-[#046C5E]/40 text-gray-400 hover:bg-[#022a22] hover:text-gray-200"
                              }`}
                            >
                              <span>{label}</span>
                              <span className={`inline-flex items-center justify-center min-w-[22px] h-5 px-1.5 rounded-full text-[10px] font-bold ${badgeStyles[color]}`}>
                                {count}
                              </span>
                            </button>
                          );
                        });
                      })()}
                    </div>
                  </div>

                  {/* Lista filtrada */}
                  {(() => {
                    const q = posBusqueda.trim().toLowerCase();
                    const items = posDetalle.items.filter(it => {
                      // "Reembolsos" incluye NotCr + Facts POS para mostrar el
                      // neto Kenny Navas con la compensación de las ventas POS.
                      if (posFiltroTipo === "notcr"
                          && !it.tipo.startsWith("NotCr")
                          && !it.tipo.startsWith("Fact")) return false;
                      if (posFiltroTipo === "fact" && !it.tipo.startsWith("Fact")) return false;
                      if (posFiltroTipo === "huerfanos" && !it.tipo.includes("huérfano")) return false;
                      if (!q) return true;
                      const hay = [it.caja, it.pos_reference, it.cliente, it.documento, it.ruta, it.sesion]
                        .filter(Boolean).map(String).join(" ").toLowerCase();
                      return hay.includes(q);
                    });
                    // Total de los items actualmente visibles (suma con signo).
                    const totalFiltrado = items.reduce((acc, it) => acc + (Number(it.monto) || 0), 0);
                    const filtroEtiqueta =
                      posFiltroTipo === "fact" ? "Total facturas"
                      : posFiltroTipo === "notcr" ? "Neto Kenny Navas (NotCr + ventas POS)"
                      : posFiltroTipo === "huerfanos" ? "Total huérfanos"
                      : q ? "Total filtrado"
                      : "Total Kenny Navas";

                    if (!items.length) {
                      return (
                        <div className="text-center py-12 text-gray-400 text-sm italic">
                          No hay registros que coincidan con los filtros.
                        </div>
                      );
                    }

                    return (
                      <>
                        {/* Mobile: cards */}
                        <div className="md:hidden px-3 pb-4 space-y-2">
                          {items.map((it) => {
                            const negativo = it.monto < 0;
                            const huerfano = it.tipo.includes("huérfano");
                            return (
                              <div
                                key={it.id}
                                className={`rounded-xl p-3 border ${
                                  huerfano
                                    ? "bg-amber-500/10 border-amber-500/40"
                                    : negativo
                                      ? "bg-red-500/5 border-red-500/30"
                                      : "bg-emerald-500/5 border-emerald-500/30"
                                }`}
                              >
                                <div className="flex items-start justify-between gap-2 mb-2">
                                  <div className="min-w-0">
                                    <p className="text-sm font-bold text-white truncate">{it.caja}</p>
                                    <p className="text-[10px] text-gray-400">{it.pos_reference || "—"}</p>
                                  </div>
                                  <span className={`text-sm font-bold whitespace-nowrap ${negativo ? "text-red-300" : "text-emerald-300"}`}>
                                    {negativo ? "−" : ""}${fmt(Math.abs(it.monto))}
                                  </span>
                                </div>
                                <div className="text-[11px] text-gray-300 mb-1.5">
                                  <span className="text-gray-500">Cliente: </span>{it.cliente}
                                </div>
                                <div className="flex items-center justify-between text-[10px] gap-2">
                                  <span className="text-gray-500">
                                    {it.date_order ? new Date(it.date_order).toLocaleString("es-EC", {
                                      day: "2-digit", month: "2-digit", year: "numeric",
                                      hour: "2-digit", minute: "2-digit",
                                    }) : "—"}
                                  </span>
                                  {it.documento ? (
                                    <span className={`px-2 py-0.5 rounded font-mono text-[10px] ${
                                      negativo ? "bg-red-500/20 text-red-200 border border-red-500/30"
                                              : "bg-emerald-500/20 text-emerald-200 border border-emerald-500/30"
                                    }`}>
                                      {it.documento}
                                    </span>
                                  ) : (
                                    <span className="px-2 py-0.5 rounded text-[10px] bg-amber-500/20 text-amber-200 border border-amber-500/40 font-semibold inline-flex items-center gap-1">
                                      <AlertTriangle size={10} /> Sin facturar
                                    </span>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>

                        {/* Desktop: tabla */}
                        <div className="hidden md:block overflow-x-auto px-3 sm:px-6 pb-4">
                          <table className="min-w-full text-xs">
                            <thead>
                              <tr className="bg-orange-500/10 text-orange-200 uppercase text-[10px] tracking-wider">
                                <th className="px-3 py-2.5 text-left">Caja</th>
                                <th className="px-3 py-2.5 text-left">Pedido</th>
                                <th className="px-3 py-2.5 text-left">Fecha</th>
                                <th className="px-3 py-2.5 text-left">Cliente</th>
                                <th className="px-3 py-2.5 text-right">Monto</th>
                                <th className="px-3 py-2.5 text-left">Documento</th>
                              </tr>
                            </thead>
                            <tbody>
                              {items.map((it, idx) => {
                                const negativo = it.monto < 0;
                                const huerfano = it.tipo.includes("huérfano");
                                return (
                                  <tr
                                    key={it.id}
                                    className={`border-b border-orange-500/10 hover:bg-orange-500/5 transition ${
                                      huerfano ? "bg-amber-500/5" : idx % 2 === 0 ? "bg-[#011f1a]/40" : ""
                                    }`}
                                  >
                                    <td className="px-3 py-2 font-semibold text-white whitespace-nowrap">
                                      <span className={`inline-block w-1 h-4 rounded-full mr-2 align-middle ${
                                        huerfano ? "bg-amber-400" : negativo ? "bg-red-400" : "bg-emerald-400"
                                      }`} />
                                      {it.caja}
                                    </td>
                                    <td className="px-3 py-2 text-gray-400 font-mono text-[10px] whitespace-nowrap">
                                      {it.pos_reference || "—"}
                                    </td>
                                    <td className="px-3 py-2 text-gray-300 whitespace-nowrap">
                                      {it.date_order ? new Date(it.date_order).toLocaleString("es-EC", {
                                        day: "2-digit", month: "2-digit", year: "numeric",
                                        hour: "2-digit", minute: "2-digit",
                                      }) : "—"}
                                    </td>
                                    <td className="px-3 py-2 text-gray-200 max-w-[220px] truncate" title={it.cliente}>
                                      {it.cliente}
                                    </td>
                                    <td className={`px-3 py-2 text-right font-bold tabular-nums whitespace-nowrap ${
                                      negativo ? "text-red-300" : "text-emerald-300"
                                    }`}>
                                      {negativo ? "−" : ""}${fmt(Math.abs(it.monto))}
                                    </td>
                                    <td className="px-3 py-2 whitespace-nowrap">
                                      {it.documento ? (
                                        <span className={`px-2 py-0.5 rounded font-mono text-[10px] ${
                                          negativo
                                            ? "bg-red-500/15 text-red-200 border border-red-500/25"
                                            : "bg-emerald-500/15 text-emerald-200 border border-emerald-500/25"
                                        }`}>
                                          {it.documento}
                                        </span>
                                      ) : (
                                        <span className="px-2 py-0.5 rounded text-[10px] bg-amber-500/20 text-amber-200 border border-amber-500/40 font-semibold inline-flex items-center gap-1">
                                          <AlertTriangle size={10} /> Sin facturar
                                        </span>
                                      )}
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                            <tfoot>
                              <tr className="bg-orange-500/15 border-t-2 border-orange-500/40">
                                <td colSpan={4} className="px-3 py-2.5 text-right text-orange-200 uppercase text-[10px] font-bold tracking-wider whitespace-nowrap">
                                  {filtroEtiqueta} ({items.length} {items.length === 1 ? "registro" : "registros"})
                                </td>
                                <td className={`px-3 py-2.5 text-right font-extrabold tabular-nums text-base whitespace-nowrap ${
                                  totalFiltrado < 0 ? "text-red-300" : totalFiltrado > 0 ? "text-emerald-300" : "text-gray-300"
                                }`}>
                                  <span className="inline-flex items-baseline justify-end gap-0">
                                    {totalFiltrado < 0 && <span>−</span>}
                                    <span>${fmt(Math.abs(totalFiltrado))}</span>
                                  </span>
                                </td>
                                <td className="px-3 py-2.5"></td>
                              </tr>
                            </tfoot>
                          </table>
                        </div>
                      </>
                    );
                  })()}
                </>
              )}
            </div>

            {/* Footer */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 px-4 sm:px-6 py-3 border-t border-orange-500/20 bg-[#011a14]/60 shrink-0">
              <p className="text-[11px] text-gray-400 italic flex items-center gap-1.5">
                <Lightbulb size={12} className="flex-shrink-0" />
                <span>Datos en vivo desde Odoo · Los <span className="text-amber-300 font-semibold">huérfanos</span> son reembolsos POS sin nota de crédito fiscal.</span>
              </p>
              <button
                onClick={cerrarPOSDetalle}
                className="px-4 py-2 rounded-lg border border-orange-500/40 bg-orange-500/15 text-orange-100 font-semibold hover:bg-orange-500/25 active:scale-[0.98] transition text-sm"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
