import React, { useEffect, useState, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { MapPin, Phone, ChevronDown, ChevronRight } from "lucide-react";
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

interface ProductoSucursal {
  producto: string;
  unidades_vendidas: number;
  monto_usd: number;
}

export default function VipDetalleClientePage() {
  const { clienteCode, anio, mes } = useParams<{ clienteCode: string; anio: string; mes: string }>();
  const navigate = useNavigate();
  const codigo = decodeURIComponent(clienteCode || "");

  const tipoProducto =
    (localStorage.getItem("tipoProductoBotellon") as "todo" | "liquido" | "envase") ?? "todo";

  const [cliente,   setCliente]   = useState<ClienteInfo | null>(null);
  const [sucursales, setSucursales] = useState<Sucursal[]>([]);
  const [cargando,  setCargando]  = useState(true);

  // Expand productos por sucursal
  const [expandedSuc, setExpandedSuc] = useState<Set<string>>(new Set());
  const [productosSuc, setProductosSuc] = useState<Map<string, ProductoSucursal[] | undefined>>(new Map());

  const toggleSucursal = async (s: Sucursal) => {
    const key = s.customer_address_code || s.codigo_sucursal;
    if (!key) return;
    setExpandedSuc(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
    if (!productosSuc.has(key)) {
      setProductosSuc(prev => new Map(prev).set(key, undefined)); // spinner
      try {
        const params = new URLSearchParams({
          clienteCode: codigo,
          addressCode: key,
          anio: String(anio),
          mes: String(mes),
          tipoProducto,
        });
        const res = await fetch(`${API_BASE_URL}/api/botellones/vip-sucursal-productos?${params}`);
        const json = await res.json();
        setProductosSuc(prev => new Map(prev).set(key, json.ok ? json.productos : []));
      } catch {
        setProductosSuc(prev => new Map(prev).set(key, []));
      }
    }
  };

  useEffect(() => {
    setCargando(true);
    fetch(`${API_BASE_URL}/api/botellones/vip-cliente-detalle?clienteCode=${encodeURIComponent(codigo)}&anio=${anio}&mes=${mes}&tipoProducto=${tipoProducto}`)
      .then(r => r.json())
      .then(data => {
        setCliente(data.cliente || null);
        setSucursales(data.sucursales || []);
      })
      .catch(console.error)
      .finally(() => setCargando(false));
  }, [clienteCode, anio, mes, tipoProducto]);

  const totalMonto  = sucursales.reduce((a, s) => a + Number(s.consumo_actual), 0);
  const totalAnt    = sucursales.reduce((a, s) => a + Number(s.consumo_anterior), 0);
  const totalUnid   = sucursales.reduce((a, s) => a + Number(s.cantidad_actual), 0);
  const varAbs      = totalMonto - totalAnt;

  return (
    <DashboardLayout>
      <div className="main-content min-h-screen text-white px-4 md:px-8 py-4 md:py-6">
        <Header />

        {/* Cabecera */}
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
                VIP Botellón · {MESES[Number(mes)]} {anio}
              </p>
              {cliente?.tipo_negocio && (
                <span className="text-[10px] bg-blue-500/20 text-blue-300 border border-blue-500/30 px-2 py-0.5 rounded-full font-semibold">
                  {cliente.tipo_negocio}
                </span>
              )}
              {cliente?.telefono && (
                <span className="text-[10px] text-gray-400 inline-flex items-center gap-1"><Phone size={10} /> {cliente.telefono}</span>
              )}
              <span className="text-[10px] text-gray-500 font-mono">{codigo}</span>
            </div>
          </div>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          {[
            { label: "Sucursales",      value: sucursales.length.toLocaleString("es-EC"),   color: "text-white"       },
            { label: "Unidades Actual", value: totalUnid.toLocaleString("es-EC"),           color: "text-blue-300"    },
            { label: "Dólares Actual",  value: `$${fmt(totalMonto)}`,                       color: "text-amber-300"   },
            { label: "Mes Anterior",    value: `$${fmt(totalAnt)}`,                         color: "text-gray-300"    },
          ].map(k => (
            <div key={k.label}
              className="bg-gradient-to-br from-[#012E24] to-[#013d30] border border-[#046C5E]/40 rounded-xl p-3 text-center">
              <p className="text-[10px] uppercase tracking-widest text-gray-400 mb-1">{k.label}</p>
              <p className={`text-xl font-extrabold ${k.color}`}>{k.value}</p>
            </div>
          ))}
        </div>

        {/* VS Mes anterior */}
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

        {/* Loading */}
        {cargando && (
          <div className="flex flex-col justify-center items-center py-32 gap-4">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-emerald-400" />
            <p className="text-gray-400 text-sm">Cargando sucursales…</p>
          </div>
        )}

        {/* Sucursales */}
        {!cargando && (
          <>
            <p className="text-xs text-gray-400 uppercase tracking-widest mb-4">
              {sucursales.length} sucursal{sucursales.length !== 1 ? "es" : ""} / dirección{sucursales.length !== 1 ? "es" : ""}
            </p>

            {/* MOBILE: cards */}
            <div className="md:hidden mb-6">
              {sucursales.length === 0
                ? <p className="text-center text-gray-400 py-12 text-sm">No se encontraron sucursales.</p>
                : <div className="space-y-3">
                    {sucursales.map((s, idx) => {
                      const sinConsumo = Number(s.consumo_actual) === 0;
                      const vsAnt = Number(s.consumo_actual) - Number(s.consumo_anterior);
                      const key = s.customer_address_code || s.codigo_sucursal || String(idx);
                      const isExpanded = expandedSuc.has(key);
                      const productos = productosSuc.get(key);
                      return (
                        <div key={key}
                          className="bg-gradient-to-br from-[#013d30] to-[#012E24] border border-[#046C5E]/40 rounded-xl overflow-hidden">
                          <div className="p-4 cursor-pointer" onClick={() => toggleSucursal(s)}>
                            <div className="flex items-start justify-between mb-3">
                              <div className="flex-1 pr-2 flex items-start gap-2">
                                <span className="text-emerald-300 mt-0.5">
                                  {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                                </span>
                                <div>
                                  <p className="font-semibold text-white text-sm leading-tight">{s.nombre_sucursal}</p>
                                  {s.direccion && s.direccion !== s.nombre_sucursal && (
                                    <p className="text-[10px] text-white/40 mt-0.5">{s.direccion}</p>
                                  )}
                                  <p className="text-[10px] text-white/30 font-mono mt-0.5">{s.codigo_sucursal}</p>
                                </div>
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
                                  className="text-blue-400/70 hover:text-blue-400 inline-flex items-center gap-1" onClick={e => e.stopPropagation()}>
                                  <MapPin size={10} /> Ver mapa
                                </a>
                              ) : (
                                <span className="italic text-white/30">Sin información de mapa</span>
                              )}
                            </div>
                          </div>
                          {/* Productos expandidos en mobile */}
                          {isExpanded && (
                            <div className="px-4 pb-4 border-t border-emerald-400/20 bg-[#011f1a]">
                              <p className="text-[10px] uppercase tracking-widest text-emerald-300 font-bold py-3">
                                Productos vendidos
                              </p>
                              {productos === undefined ? (
                                <div className="flex items-center gap-2 text-gray-400 text-xs py-2">
                                  <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-emerald-400" />
                                  Cargando…
                                </div>
                              ) : productos.length === 0 ? (
                                <p className="text-gray-400 text-xs italic py-2">Sin productos.</p>
                              ) : (
                                <div className="space-y-1.5">
                                  {productos.map((p, i) => {
                                    const uni = Number(p.unidades_vendidas);
                                    const usd = Number(p.monto_usd);
                                    return (
                                      <div key={i} className="flex justify-between items-center text-xs py-1 border-b border-emerald-400/10">
                                        <span className="text-gray-200 flex-1 pr-2">{p.producto}</span>
                                        <span className="text-blue-300 font-semibold w-12 text-right">{uni}</span>
                                        <span className="text-amber-300 font-semibold w-20 text-right">${fmt(usd)}</span>
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
              }
            </div>

            {/* DESKTOP: tabla */}
            <div className="hidden md:block bg-gradient-to-br from-[#012E24] to-[#013d30] border border-[#046C5E]/40 rounded-2xl overflow-hidden mb-6 shadow-xl">
              <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="bg-[#014434] text-[10px] uppercase text-green-300">
                    <th className="px-3 py-3 text-center w-8"></th>
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
                  {sucursales.length === 0
                    ? <tr><td colSpan={11} className="px-4 py-12 text-center text-gray-400 text-sm">No se encontraron sucursales.</td></tr>
                    : sucursales.map((s, idx) => {
                        const sinConsumo = Number(s.consumo_actual) === 0;
                        const vsAnt = Number(s.consumo_actual) - Number(s.consumo_anterior);
                        const key = s.customer_address_code || s.codigo_sucursal || String(idx);
                        const isExpanded = expandedSuc.has(key);
                        const productos = productosSuc.get(key);
                        return (
                          <React.Fragment key={key}>
                            <tr
                              onClick={() => toggleSucursal(s)}
                              className={`cursor-pointer transition-colors ${idx % 2 === 0 ? "bg-[#013d32]" : "bg-[#014f3e]"} hover:bg-[#025940]`}>
                              <td className="px-3 py-2 text-emerald-300">
                                {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                              </td>
                              <td className="px-3 py-2 text-gray-400 text-xs">{idx + 1}</td>
                              <td className="px-3 py-2 text-white max-w-[300px]">
                                <p className="font-semibold text-sm leading-tight">{s.nombre_sucursal}</p>
                                {s.direccion && s.direccion !== s.nombre_sucursal && (
                                  <p className="text-[10px] text-gray-400 mt-0.5 leading-tight">{s.direccion}</p>
                                )}
                                <p className="text-xs text-blue-400 font-mono mt-0.5">{s.codigo_sucursal}</p>
                              </td>
                              <td className="px-3 py-2 text-gray-300 text-xs">{s.telefono || "—"}</td>
                              <td className="px-3 py-2 text-right text-blue-300 font-semibold">
                                {Number(s.cantidad_actual).toLocaleString("es-EC")}
                              </td>
                              <td className="px-3 py-2 text-right font-bold text-white">
                                ${fmt(Number(s.consumo_actual))}
                              </td>
                              <td className="px-3 py-2 text-right text-gray-300">
                                ${fmt(Number(s.consumo_anterior))}
                              </td>
                              <td className={`px-3 py-2 text-right font-bold ${vsAnt >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                                {vsAnt >= 0 ? "+" : ""}${fmt(Math.abs(vsAnt))}
                              </td>
                              <td className="px-3 py-2 text-center text-gray-400 text-xs whitespace-nowrap">
                                {s.ultima_factura ? new Date(s.ultima_factura).toLocaleDateString("es-EC") : "—"}
                              </td>
                              <td className="px-3 py-2 text-center" onClick={(e) => e.stopPropagation()}>
                                {hasCoords(s.latitud, s.longitud)
                                  ? <a href={`https://maps.google.com/?q=${s.latitud},${s.longitud}`}
                                      target="_blank" rel="noreferrer"
                                      className="text-[10px] text-blue-400 hover:underline border border-blue-400/30 px-2 py-0.5 rounded whitespace-nowrap inline-flex items-center gap-1">
                                      <MapPin size={10} /> Mapa
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
                            {/* Fila expandida: productos de la sucursal */}
                            {isExpanded && (
                              <tr className="bg-[#011f1a]">
                                <td colSpan={11} className="p-0">
                                  <div className="px-6 py-4 border-t border-b border-emerald-400/20">
                                    <p className="text-[10px] uppercase tracking-widest text-emerald-300 font-bold mb-3">
                                      Productos vendidos en esta sucursal
                                    </p>
                                    {productos === undefined ? (
                                      <div className="flex items-center gap-2 text-gray-400 text-xs py-4">
                                        <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-emerald-400" />
                                        Cargando productos…
                                      </div>
                                    ) : productos.length === 0 ? (
                                      <p className="text-gray-400 text-xs italic py-2">Sin productos para esta sucursal en el período.</p>
                                    ) : (
                                      <table className="min-w-full text-xs">
                                        <thead>
                                          <tr className="text-[10px] uppercase text-emerald-300 border-b border-emerald-400/30">
                                            <th className="px-3 py-2 text-left">Producto</th>
                                            <th className="px-3 py-2 text-right">Unidades</th>
                                            <th className="px-3 py-2 text-right">Dólares</th>
                                            <th className="px-3 py-2 text-right">Precio Prom.</th>
                                          </tr>
                                        </thead>
                                        <tbody>
                                          {productos.map((p, i) => {
                                            const uni = Number(p.unidades_vendidas);
                                            const usd = Number(p.monto_usd);
                                            const prom = uni > 0 ? usd / uni : 0;
                                            return (
                                              <tr key={i} className="border-b border-emerald-400/10 hover:bg-emerald-400/5">
                                                <td className="px-3 py-1.5 text-gray-200">{p.producto}</td>
                                                <td className="px-3 py-1.5 text-right text-blue-300 font-semibold">
                                                  {uni.toLocaleString("es-EC")}
                                                </td>
                                                <td className="px-3 py-1.5 text-right text-amber-300 font-semibold">
                                                  ${fmt(usd)}
                                                </td>
                                                <td className="px-3 py-1.5 text-right text-purple-300">
                                                  ${fmt(prom)}
                                                </td>
                                              </tr>
                                            );
                                          })}
                                          {(() => {
                                            const totUni = productos.reduce((a, p) => a + Number(p.unidades_vendidas), 0);
                                            const totUSD = productos.reduce((a, p) => a + Number(p.monto_usd), 0);
                                            const promTot = totUni > 0 ? totUSD / totUni : 0;
                                            return (
                                              <tr className="font-bold border-t border-emerald-400/40 text-emerald-200">
                                                <td className="px-3 py-2 uppercase text-[10px]">Total</td>
                                                <td className="px-3 py-2 text-right">{totUni.toLocaleString("es-EC")}</td>
                                                <td className="px-3 py-2 text-right">${fmt(totUSD)}</td>
                                                <td className="px-3 py-2 text-right">${fmt(promTot)}</td>
                                              </tr>
                                            );
                                          })()}
                                        </tbody>
                                      </table>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            )}
                          </React.Fragment>
                        );
                      })
                  }
                </tbody>
                {sucursales.length > 1 && (
                  <tfoot>
                    <tr className="bg-[#014434] border-t border-[#046C5E]/30 font-bold text-green-300 text-xs uppercase">
                      <td colSpan={4} className="px-3 py-3">Total</td>
                      <td className="px-3 py-3 text-right text-blue-300">
                        {totalUnid.toLocaleString("es-EC")}
                      </td>
                      <td className="px-3 py-3 text-right text-white">
                        ${fmt(totalMonto)}
                      </td>
                      <td className="px-3 py-3 text-right text-gray-300">
                        ${fmt(totalAnt)}
                      </td>
                      <td className={`px-3 py-3 text-right ${varAbs >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                        {varAbs >= 0 ? "+" : ""}${fmt(Math.abs(varAbs))}
                      </td>
                      <td colSpan={3} />
                    </tr>
                  </tfoot>
                )}
              </table>
              </div>
            </div>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
