import React, { useEffect, useState, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import DashboardLayout from "../../layout/DashboardLayout";
import { Header } from "../../components/common/Header";
import { API_BASE_URL } from "../../config";

const fmt = (n: number) =>
  n.toLocaleString("es-EC", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** Devuelve true sólo si lat/lng son numéricos válidos y distintos de 0. */
const hasCoords = (lat?: string | number | null, lng?: string | number | null) => {
  if (lat === null || lat === undefined || lat === "") return false;
  if (lng === null || lng === undefined || lng === "") return false;
  const nLat = Number(lat);
  const nLng = Number(lng);
  if (!Number.isFinite(nLat) || !Number.isFinite(nLng)) return false;
  if (nLat === 0 || nLng === 0) return false;
  return true;
};

const MESES = ["","Enero","Febrero","Marzo","Abril","Mayo","Junio",
  "Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];

interface ClienteInfo {
  nombre_cliente: string;
  tipo_negocio: string;
  telefono: string;
}

interface Sucursal {
  nombre_sucursal: string;
  direccion: string;
  codigo_sucursal: string;
  telefono: string;
  latitud: string;
  longitud: string;
  customer_address_code: string;
  cantidad_actual: number;
  consumo_actual: number;
  consumo_anterior: number;
  ultima_factura: string | null;
}

export default function EmpresasDetalleClientePage() {
  const { clienteCode, anio, mes } = useParams<{ clienteCode: string; anio: string; mes: string }>();
  const navigate = useNavigate();
  const codigo = decodeURIComponent(clienteCode || "");

  const tipoProducto =
    (localStorage.getItem("tipoProductoBotellon") as "todo" | "liquido" | "envase") ?? "todo";

  const [cliente,    setCliente]    = useState<ClienteInfo | null>(null);
  const [sucursales, setSucursales] = useState<Sucursal[]>([]);
  const [cargando,   setCargando]   = useState(true);
  const [sucSearch,  setSucSearch]  = useState("");

  const sucFiltered = useMemo(() => {
    const q = sucSearch.trim().toLowerCase();
    if (!q) return sucursales;
    return sucursales.filter(s =>
      (s.customer_address_code || "").toLowerCase().includes(q) ||
      (s.nombre_sucursal || "").toLowerCase().includes(q) ||
      (s.direccion || "").toLowerCase().includes(q)
    );
  }, [sucursales, sucSearch]);

  useEffect(() => {
    setCargando(true);
    fetch(`${API_BASE_URL}/api/botellones/empresas-cliente-detalle?clienteCode=${encodeURIComponent(codigo)}&anio=${anio}&mes=${mes}&tipoProducto=${tipoProducto}`)
      .then(r => r.json())
      .then(data => {
        setCliente(data.cliente || null);
        setSucursales(data.sucursales || []);
      })
      .catch(console.error)
      .finally(() => setCargando(false));
  }, [clienteCode, anio, mes, tipoProducto]);

  const totalMonto = sucursales.reduce((a, s) => a + Number(s.consumo_actual), 0);
  const totalAnt   = sucursales.reduce((a, s) => a + Number(s.consumo_anterior), 0);
  const totalUnid  = sucursales.reduce((a, s) => a + Number(s.cantidad_actual), 0);
  const varAbs     = totalMonto - totalAnt;

  return (
    <DashboardLayout>
      <div className="main-content min-h-screen text-white px-4 md:px-8 py-4 md:py-6">
        <Header />

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-6 border-b border-[#046C5E]/50 pb-4">
          <div>
            <button onClick={() => navigate(-1)}
              className="text-xs text-gray-400 hover:text-white mb-1 flex items-center gap-1 transition">
              ← Volver a clientes
            </button>
            <h1 className="text-xl md:text-2xl font-bold tracking-tight">
              {cliente?.nombre_cliente || codigo}
            </h1>
            <div className="flex flex-wrap items-center gap-3 mt-1">
              <p className="text-xs text-gray-400">
                Empresas Botellón · {MESES[Number(mes)]} {anio}
              </p>
              {cliente?.tipo_negocio && (
                <span className="text-[10px] bg-blue-500/20 text-blue-300 border border-blue-500/30 px-2 py-0.5 rounded-full font-semibold">
                  {cliente.tipo_negocio}
                </span>
              )}
              {cliente?.telefono && (
                <span className="text-[10px] text-gray-400">📞 {cliente.telefono}</span>
              )}
              <span className="text-[10px] text-gray-500 font-mono">{codigo}</span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          {[
            { label: "Sucursales",      value: sucursales.length.toLocaleString("es-EC"), color: "text-white"     },
            { label: "Unidades Actual", value: totalUnid.toLocaleString("es-EC"),         color: "text-blue-300"  },
            { label: "Dólares Actual",  value: `$${fmt(totalMonto)}`,                     color: "text-amber-300" },
            { label: "Mes Anterior",    value: `$${fmt(totalAnt)}`,                       color: "text-gray-300"  },
          ].map(k => (
            <div key={k.label}
              className="bg-gradient-to-br from-[#012E24] to-[#013d30] border border-[#046C5E]/40 rounded-xl p-3 text-center">
              <p className="text-[10px] uppercase tracking-widest text-gray-400 mb-1">{k.label}</p>
              <p className={`text-xl font-extrabold ${k.color}`}>{k.value}</p>
            </div>
          ))}
        </div>

        {!cargando && totalAnt > 0 && (
          <div className={`flex items-center gap-3 mb-6 px-4 py-3 rounded-xl border text-sm font-semibold
            ${varAbs >= 0
              ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-300"
              : "bg-red-500/10 border-red-500/30 text-red-300"}`}>
            <span>{varAbs >= 0 ? "▲" : "▼"}</span>
            <span>
              VS mes anterior: {varAbs >= 0 ? "+" : ""}${fmt(Math.abs(varAbs))}
              &nbsp;·&nbsp; Mes anterior total: ${fmt(totalAnt)}
            </span>
          </div>
        )}

        {cargando && (
          <div className="flex flex-col justify-center items-center py-32 gap-4">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-emerald-400" />
            <p className="text-gray-400 text-sm">Cargando sucursales…</p>
          </div>
        )}

        {!cargando && (
          <>
            <div className="flex flex-col items-center gap-3 mb-4">
              <p className="text-sm font-bold uppercase tracking-widest text-white/50">
                Sucursales · {sucFiltered.length}{sucSearch && ` / ${sucursales.length}`}
              </p>
              <div className="relative w-full max-w-lg">
                <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-white/30 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M11 19a8 8 0 100-16 8 8 0 000 16z"/>
                </svg>
                <input type="text" value={sucSearch} onChange={e => setSucSearch(e.target.value)}
                  placeholder="Buscar por código o dirección..."
                  className="w-full bg-[#014434] border border-[#046C5E] rounded-xl pl-11 pr-4 py-2.5 text-sm text-white placeholder-white/30 focus:outline-none focus:border-emerald-500/60 transition-colors"/>
              </div>
            </div>

            {/* MOBILE */}
            <div className="md:hidden mb-6">
              {sucFiltered.length === 0
                ? <p className="text-center text-gray-400 py-12 text-sm">No se encontraron sucursales.</p>
                : <div className="space-y-3">
                    {sucFiltered.map((s, idx) => {
                      const sinConsumo = Number(s.consumo_actual) === 0;
                      const vsAnt = Number(s.consumo_actual) - Number(s.consumo_anterior);
                      return (
                        <div key={s.customer_address_code || idx}
                          className="bg-gradient-to-br from-[#013d30] to-[#012E24] border border-[#046C5E]/40 rounded-xl overflow-hidden">
                          <div className="p-4">
                            <div className="flex items-start justify-between mb-3">
                              <div className="flex-1 pr-2">
                                <p className="font-semibold text-white text-sm leading-tight">{s.nombre_sucursal || s.direccion}</p>
                                {s.nombre_sucursal && s.direccion && s.nombre_sucursal !== s.direccion && (
                                  <p className="text-[10px] text-white/40 mt-0.5">{s.direccion}</p>
                                )}
                              </div>
                              <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded border text-[10px] font-semibold shrink-0
                                ${sinConsumo ? "text-red-400 bg-red-500/15 border-red-500/30" : "text-green-400 bg-green-500/15 border-green-500/30"}`}>
                                <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${sinConsumo ? "bg-red-500" : "bg-green-500"}`}/>
                                {sinConsumo ? "Sin consumo" : "Activo"}
                              </span>
                            </div>
                            <div className="grid grid-cols-3 gap-2 text-center mb-2">
                              <div>
                                <p className="text-[9px] text-white/40 uppercase">Consumo</p>
                                <p className="text-sm font-bold text-blue-400">${fmt(Number(s.consumo_actual))}</p>
                              </div>
                              <div>
                                <p className="text-[9px] text-white/40 uppercase">Cant.</p>
                                <p className="text-sm font-bold text-green-400">{Number(s.cantidad_actual)}</p>
                              </div>
                              <div>
                                <p className="text-[9px] text-white/40 uppercase">VS Ant</p>
                                <p className={`text-sm font-bold ${vsAnt >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                                  {vsAnt >= 0 ? "+" : ""}${fmt(Math.abs(vsAnt))}
                                </p>
                              </div>
                            </div>
                            <div className="flex flex-wrap gap-3 text-[10px] text-white/40 pt-2 border-t border-[#046C5E]/20 mt-1">
                              {s.telefono && <span>{s.telefono}</span>}
                              {hasCoords(s.latitud, s.longitud) ? (
                                <a href={`https://maps.google.com/?q=${s.latitud},${s.longitud}`}
                                  target="_blank" rel="noreferrer"
                                  className="text-blue-400/70 hover:text-blue-400" onClick={e => e.stopPropagation()}>
                                  📍 Ver mapa
                                </a>
                              ) : (
                                <span className="italic text-white/30">Sin información de mapa</span>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
              }
            </div>

            {/* DESKTOP */}
            <div className="hidden md:block bg-gradient-to-br from-[#012E24] to-[#013d30] border border-[#046C5E]/40 rounded-2xl overflow-hidden mb-6 shadow-xl">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="bg-[#014434] text-[10px] uppercase text-green-300">
                    <th className="px-3 py-3 text-left">N°</th>
                    <th className="px-3 py-3 text-left">Dirección / Sucursal</th>
                    <th className="px-3 py-3 text-left">Teléfono</th>
                    <th className="px-3 py-3 text-right">Cant. Actual</th>
                    <th className="px-3 py-3 text-right">Consumo Actual</th>
                    <th className="px-3 py-3 text-right">Mes Anterior</th>
                    <th className="px-3 py-3 text-right">VS Mes Ant</th>
                    <th className="px-3 py-3 text-center">Última Factura</th>
                    <th className="px-3 py-3 text-center">Mapa</th>
                    <th className="px-3 py-3 text-center">Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {sucFiltered.length === 0
                    ? <tr><td colSpan={10} className="px-4 py-12 text-center text-gray-400 text-sm">No se encontraron sucursales.</td></tr>
                    : sucFiltered.map((s, idx) => {
                        const sinConsumo = Number(s.consumo_actual) === 0;
                        const vsAnt = Number(s.consumo_actual) - Number(s.consumo_anterior);
                        return (
                          <tr key={s.customer_address_code || idx}
                            className={`transition-colors ${idx % 2 === 0 ? "bg-[#013d32]" : "bg-[#014f3e]"} hover:bg-[#025940]`}>
                            <td className="px-3 py-2 text-white/30 text-xs">{idx + 1}</td>
                            <td className="px-3 py-2 text-white font-semibold max-w-[260px]">
                              <span title={s.nombre_sucursal || s.direccion} className="line-clamp-2 text-sm">{s.nombre_sucursal || s.direccion}</span>
                              {s.nombre_sucursal && s.direccion && s.nombre_sucursal !== s.direccion && (
                                <p className="text-[10px] text-white/40 mt-0.5 line-clamp-1">{s.direccion}</p>
                              )}
                            </td>
                            <td className="px-3 py-2 text-white/50 text-xs">{s.telefono || "—"}</td>
                            <td className="px-3 py-2 text-right text-green-400 font-semibold tabular-nums">
                              {Number(s.cantidad_actual).toLocaleString("es-EC")}
                            </td>
                            <td className="px-3 py-2 text-right font-bold text-white tabular-nums">
                              ${fmt(Number(s.consumo_actual))}
                            </td>
                            <td className="px-3 py-2 text-right text-white/40 tabular-nums">
                              ${fmt(Number(s.consumo_anterior))}
                            </td>
                            <td className={`px-3 py-2 text-right font-bold tabular-nums ${vsAnt >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                              {vsAnt >= 0 ? "+" : ""}${fmt(Math.abs(vsAnt))}
                            </td>
                            <td className="px-3 py-2 text-center text-white/40 text-xs whitespace-nowrap">
                              {s.ultima_factura ? new Date(s.ultima_factura).toLocaleDateString("es-EC") : "—"}
                            </td>
                            <td className="px-3 py-2 text-center">
                              {hasCoords(s.latitud, s.longitud)
                                ? <a href={`https://maps.google.com/?q=${s.latitud},${s.longitud}`}
                                    target="_blank" rel="noreferrer"
                                    className="text-[10px] text-blue-400/70 hover:text-blue-400 border border-blue-400/20 px-2 py-0.5 rounded whitespace-nowrap">
                                    📍 Mapa
                                  </a>
                                : <span className="text-[10px] text-white/40 italic whitespace-nowrap">Sin información</span>
                              }
                            </td>
                            <td className="px-3 py-2 text-center">
                              <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded border text-[10px] font-semibold
                                ${sinConsumo ? "text-red-400 bg-red-500/15 border-red-500/30" : "text-green-400 bg-green-500/15 border-green-500/30"}`}>
                                <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${sinConsumo ? "bg-red-500" : "bg-green-500"}`}/>
                                {sinConsumo ? "Sin consumo" : "Activo"}
                              </span>
                            </td>
                          </tr>
                        );
                      })
                  }
                </tbody>
                {sucursales.length > 1 && (
                  <tfoot>
                    <tr className="bg-[#014434] border-t border-[#046C5E]/30 font-bold text-green-300 text-xs uppercase">
                      <td colSpan={3} className="px-3 py-3">Total</td>
                      <td className="px-3 py-3 text-right text-blue-300">{totalUnid.toLocaleString("es-EC")}</td>
                      <td className="px-3 py-3 text-right text-white">${fmt(totalMonto)}</td>
                      <td className="px-3 py-3 text-right text-gray-300">${fmt(totalAnt)}</td>
                      <td className={`px-3 py-3 text-right ${varAbs >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                        {varAbs >= 0 ? "+" : ""}${fmt(Math.abs(varAbs))}
                      </td>
                      <td colSpan={3} />
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
