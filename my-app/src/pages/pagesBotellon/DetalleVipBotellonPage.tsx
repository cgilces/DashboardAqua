import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import DashboardLayout from "../../layout/DashboardLayout";
import { Header } from "../../components/common/Header";
import { API_BASE_URL } from "../../config";

const fmt = (n: number) =>
  n.toLocaleString("es-EC", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const MESES = ["","Enero","Febrero","Marzo","Abril","Mayo","Junio",
  "Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];

interface Subcanal {
  canal: string;
  subcanal: string;
  total_clientes: number;
  clientes_con_consumo: number;
  unidades_actual: number;
  monto_actual: number;
  monto_anterior: number;
}

interface Producto {
  producto: string;
  unidades_vendidas: number;
  monto_usd: number;
}

export default function DetalleVipBotellonPage() {
  const { anio, mes } = useParams<{ anio: string; mes: string }>();
  const navigate = useNavigate();

  const [subcanales, setSubcanales] = useState<Subcanal[]>([]);
  const [productos,  setProductos]  = useState<Producto[]>([]);
  const [cargando,   setCargando]   = useState(true);

  useEffect(() => {
    setCargando(true);
    fetch(`${API_BASE_URL}/api/botellones/vip-subcanales?anio=${anio}&mes=${mes}`)
      .then(r => r.json())
      .then(data => {
        setSubcanales(data.subcanales || []);
        setProductos(data.productosVendidos || []);
      })
      .catch(console.error)
      .finally(() => setCargando(false));
  }, [anio, mes]);

  const totalClientes     = subcanales.reduce((a, s) => a + Number(s.total_clientes), 0);
  const totalConConsumo   = subcanales.reduce((a, s) => a + Number(s.clientes_con_consumo), 0);
  const totalMonto        = subcanales.reduce((a, s) => a + Number(s.monto_actual), 0);
  const totalMontoAnt     = subcanales.reduce((a, s) => a + Number(s.monto_anterior), 0);
  const totalUnidades     = subcanales.reduce((a, s) => a + Number(s.unidades_actual), 0);
  const varAbs            = totalMonto - totalMontoAnt;

  return (
    <DashboardLayout>
      <div className="main-content min-h-screen text-white px-4 md:px-8 py-4 md:py-6">
        <Header />

        {/* Cabecera */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-6 border-b border-[#046C5E]/50 pb-4">
          <div>
            <button onClick={() => navigate(-1)}
              className="text-xs text-gray-400 hover:text-white mb-1 flex items-center gap-1 transition">
              ← Volver
            </button>
            <h1 className="text-xl md:text-2xl font-bold tracking-tight">Clientes VIP — Botellón</h1>
            <p className="text-xs text-gray-400">{MESES[Number(mes)]} {anio} · Selecciona un módulo para ver sus clientes</p>
          </div>
        </div>

        {/* KPIs globales */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-8">
          {[
            { label: "Total Clientes",   value: totalClientes.toLocaleString("es-EC"),    color: "text-white"        },
            { label: "Con Consumo",      value: totalConConsumo.toLocaleString("es-EC"),   color: "text-emerald-400"  },
            { label: "Sin Consumo",      value: (totalClientes - totalConConsumo).toLocaleString("es-EC"), color: "text-red-400" },
            { label: "Unidades Actual",  value: totalUnidades.toLocaleString("es-EC"),     color: "text-blue-300"     },
            { label: "Dólares Actual",   value: `$${fmt(totalMonto)}`,                    color: "text-amber-300"    },
          ].map(k => (
            <div key={k.label}
              className="bg-gradient-to-br from-[#012E24] to-[#013d30] border border-[#046C5E]/40 rounded-xl p-3 text-center">
              <p className="text-[10px] uppercase tracking-widest text-gray-400 mb-1">{k.label}</p>
              <p className={`text-xl font-extrabold ${k.color}`}>{k.value}</p>
            </div>
          ))}
        </div>

        {/* VS Mes anterior banner */}
        {!cargando && totalMontoAnt > 0 && (
          <div className={`flex items-center gap-3 mb-6 px-4 py-3 rounded-xl border text-sm font-semibold
            ${varAbs >= 0
              ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-300"
              : "bg-red-500/10 border-red-500/30 text-red-300"}`}>
            <span className="text-base">{varAbs >= 0 ? "▲" : "▼"}</span>
            <span>
              VS mes anterior: {varAbs >= 0 ? "+" : ""}${fmt(Math.abs(varAbs))}
              &nbsp;·&nbsp;
              Mes anterior: ${fmt(totalMontoAnt)}
            </span>
          </div>
        )}

        {/* Loading */}
        {cargando && (
          <div className="flex flex-col justify-center items-center py-32 gap-4">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-emerald-400" />
            <p className="text-gray-400 text-sm">Cargando módulos…</p>
          </div>
        )}

        {/* Productos Vendidos */}
        {!cargando && productos.length > 0 && (
          <div className="bg-gradient-to-br from-[#012E24] to-[#013d30] border border-[#046C5E]/30 rounded-2xl overflow-hidden mb-8">
            <h2 className="text-sm font-bold uppercase tracking-wider text-green-300 px-4 py-3 border-b border-[#046C5E]/30">
              Productos Vendidos
            </h2>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="bg-[#014434] text-[10px] uppercase text-green-300">
                    <th className="px-4 py-3 text-left">Producto</th>
                    <th className="px-4 py-3 text-right">Unidades</th>
                    <th className="px-4 py-3 text-right">Dólares</th>
                  </tr>
                </thead>
                <tbody>
                  {productos.map((p, idx) => (
                    <tr key={idx} className={`${idx % 2 === 0 ? "bg-[#013d32]" : "bg-[#014f3e]"} hover:bg-[#016a57] transition`}>
                      <td className="px-4 py-2">{p.producto}</td>
                      <td className="px-4 py-2 text-right text-green-400 font-semibold">
                        {Number(p.unidades_vendidas).toLocaleString("es-EC")}
                      </td>
                      <td className="px-4 py-2 text-right text-blue-400 font-semibold">
                        ${fmt(Number(p.monto_usd))}
                      </td>
                    </tr>
                  ))}
                  <tr className="bg-[#014434] font-bold border-t border-[#046C5E]/30">
                    <td className="px-4 py-3 text-green-300 uppercase text-xs">Total</td>
                    <td className="px-4 py-3 text-right text-green-400">
                      {productos.reduce((a, p) => a + Number(p.unidades_vendidas), 0).toLocaleString("es-EC")}
                    </td>
                    <td className="px-4 py-3 text-right text-blue-400">
                      ${fmt(productos.reduce((a, p) => a + Number(p.monto_usd), 0))}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Subcanales agrupados por canal */}
        {!cargando && (() => {
          // Agrupar por canal
          const porCanal = subcanales.reduce<Record<string, Subcanal[]>>((acc, s) => {
            const key = s.canal;
            if (!acc[key]) acc[key] = [];
            acc[key].push(s);
            return acc;
          }, {});

          const canales = Object.keys(porCanal);

          if (canales.length === 0) {
            return (
              <p className="text-center text-gray-400 py-16 text-sm">
                No se encontraron datos para este período.
              </p>
            );
          }

          return (
            <>
              {canales.map((canal) => {
                const items = porCanal[canal];
                const canalTotal = items.reduce((a, s) => a + Number(s.monto_actual), 0);
                const canalClientes = items.reduce((a, s) => a + Number(s.total_clientes), 0);

                return (
                  <div key={canal} className="mb-10">
                    {/* Cabecera del canal */}
                    <div className="flex items-center justify-between mb-4 pb-2 border-b border-[#046C5E]/40">
                      <div className="flex items-center gap-3">
                        <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0" />
                        <h2 className="text-sm font-bold uppercase tracking-widest text-emerald-300">{canal}</h2>
                        <span className="text-xs text-gray-500">{items.length} subcanal{items.length !== 1 ? "es" : ""}</span>
                      </div>
                      <div className="flex items-center gap-4 text-xs text-gray-400">
                        <span>{canalClientes.toLocaleString("es-EC")} clientes</span>
                        <span className="text-amber-300 font-semibold">${fmt(canalTotal)}</span>
                      </div>
                    </div>

                    {/* Grid de subcanales dentro del canal */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
                      {items.map((s) => {
                        const sinConsumo = Number(s.total_clientes) - Number(s.clientes_con_consumo);
                        const varMonto   = Number(s.monto_actual) - Number(s.monto_anterior);
                        return (
                          <div
                            key={`${canal}-${s.subcanal}`}
                            onClick={() =>
                              navigate(`/vip-botellon/tipo/${encodeURIComponent(s.subcanal)}/${anio}/${mes}`)
                            }
                            className="cursor-pointer bg-gradient-to-br from-[#012E24] to-[#014034]
                              border border-[#046C5E]/40 rounded-2xl p-5 shadow-lg flex flex-col gap-3
                              hover:border-emerald-400/60 hover:scale-[1.02] transition-all duration-200"
                          >
                            {/* Encabezado */}
                            <div className="flex items-start justify-between gap-2">
                              <p className="text-sm font-bold text-white leading-tight">{s.subcanal}</p>
                              <span className="shrink-0 text-[10px] text-gray-400 italic mt-0.5">Ver clientes →</span>
                            </div>

                            {/* Clientes */}
                            <div className="grid grid-cols-3 gap-2 text-center">
                              <div>
                                <p className="text-[9px] text-gray-500 uppercase tracking-wide">Total</p>
                                <p className="text-white font-bold text-base">{Number(s.total_clientes).toLocaleString("es-EC")}</p>
                              </div>
                              <div>
                                <p className="text-[9px] text-gray-500 uppercase tracking-wide">Activos</p>
                                <p className="text-emerald-400 font-bold text-base">{Number(s.clientes_con_consumo).toLocaleString("es-EC")}</p>
                              </div>
                              <div>
                                <p className="text-[9px] text-gray-500 uppercase tracking-wide">Sin consumo</p>
                                <p className="text-red-400 font-bold text-base">{sinConsumo.toLocaleString("es-EC")}</p>
                              </div>
                            </div>

                            <div className="border-t border-[#046C5E]/30" />

                            {/* Montos */}
                            <div>
                              <p className="text-[9px] text-gray-500 uppercase tracking-wide mb-1">Dólares Actual</p>
                              <p className="text-amber-300 font-extrabold text-lg">${fmt(Number(s.monto_actual))}</p>
                            </div>
                            <div className="flex items-center justify-between">
                              <div>
                                <p className="text-[9px] text-gray-500 uppercase tracking-wide">Mes anterior</p>
                                <p className="text-gray-300 text-sm font-semibold">${fmt(Number(s.monto_anterior))}</p>
                              </div>
                              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold border
                                ${varMonto >= 0
                                  ? "text-emerald-400 border-emerald-400/20 bg-emerald-400/10"
                                  : "text-red-400 border-red-400/20 bg-red-400/10"}`}>
                                {varMonto >= 0 ? "▲" : "▼"}
                                ${fmt(Math.abs(varMonto))}
                              </span>
                            </div>

                            {/* Unidades */}
                            <div className="flex items-center justify-between border-t border-[#046C5E]/20 pt-2">
                              <p className="text-[9px] text-gray-500 uppercase tracking-wide">Unidades</p>
                              <p className="text-blue-300 font-bold">{Number(s.unidades_actual).toLocaleString("es-EC")}</p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </>
          );
        })()}
      </div>
    </DashboardLayout>
  );
}
