import React, { useEffect, useState, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import * as XLSX from "xlsx";
import { BsDownload } from "react-icons/bs";
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
  codigo_subcanal: string;
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

interface ClienteFull {
  codigo_cliente: string;
  nombre_cliente: string;
  direccion_entrega: string;
  tipo_negocio: string;
  subcanal: string;
  codigo_subcanal: string;
  telefono: string;
  latitud?: string | null;
  longitud?: string | null;
  cantidad_actual: number;
  consumo_actual: number;
  consumo_anterior: number;
  max_consumo: number;
  ultima_factura: string | null;
}

const POR_PAGINA = 60;

export default function DetalleVipBotellonPage() {
  const { anio, mes } = useParams<{ anio: string; mes: string }>();
  const navigate = useNavigate();

  const tipoProducto =
    (localStorage.getItem("tipoProductoBotellon") as "todo" | "liquido" | "envase") ?? "todo";

  const [subcanales, setSubcanales] = useState<Subcanal[]>([]);
  const [productos,  setProductos]  = useState<Producto[]>([]);
  const [cargando,   setCargando]   = useState(true);

  // ─── Vista "Todos los clientes" ───────────────────────────────────────
  const [vistaTodos, setVistaTodos] = useState(false);
  const [clientesTodos, setClientesTodos] = useState<ClienteFull[]>([]);
  const [cargandoTodos, setCargandoTodos] = useState(false);
  const [busqueda, setBusqueda] = useState("");
  const [filtro, setFiltro] = useState<"todos" | "con" | "sin">("todos");
  const [subcanalFiltro, setSubcanalFiltro] = useState<{ codigo: string; nombre: string } | null>(null);
  const [pagina, setPagina] = useState(1);
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: "asc" | "desc" }>({
    key: "consumo_actual", direction: "desc",
  });

  useEffect(() => {
    setCargando(true);
    fetch(`${API_BASE_URL}/api/botellones/vip-subcanales?anio=${anio}&mes=${mes}&tipoProducto=${tipoProducto}`)
      .then(r => r.json())
      .then(data => {
        setSubcanales(data.subcanales || []);
        setProductos(data.productosVendidos || []);
      })
      .catch(console.error)
      .finally(() => setCargando(false));
  }, [anio, mes, tipoProducto]);

  useEffect(() => {
    if (!vistaTodos || clientesTodos.length > 0) return;
    setCargandoTodos(true);
    fetch(`${API_BASE_URL}/api/botellones/clientes-vip?anio=${anio}&mes=${mes}&tipoProducto=${tipoProducto}`)
      .then(r => r.json())
      .then(data => {
        setClientesTodos(data.clientes || []);
      })
      .catch(console.error)
      .finally(() => setCargandoTodos(false));
  }, [vistaTodos, anio, mes, tipoProducto]);

  const totalClientes     = subcanales.reduce((a, s) => a + Number(s.total_clientes), 0);
  const totalConConsumo   = subcanales.reduce((a, s) => a + Number(s.clientes_con_consumo), 0);
  const totalMonto        = subcanales.reduce((a, s) => a + Number(s.monto_actual), 0);
  const totalMontoAnt     = subcanales.reduce((a, s) => a + Number(s.monto_anterior), 0);
  const totalUnidades     = subcanales.reduce((a, s) => a + Number(s.unidades_actual), 0);
  const varAbs            = totalMonto - totalMontoAnt;

  const requestSort = (key: string) => {
    const dir = sortConfig.key === key && sortConfig.direction === "asc" ? "desc" : "asc";
    setSortConfig({ key, direction: dir });
    setPagina(1);
  };
  const sa = (k: string) => sortConfig.key === k ? (sortConfig.direction === "asc" ? " ↑" : " ↓") : " ↕";

  const clientesFiltrados = useMemo(() => {
    const q = busqueda.toLowerCase();
    let arr = clientesTodos.filter(c => {
      const matchQ = !q || c.nombre_cliente?.toLowerCase().includes(q) || c.codigo_cliente?.toLowerCase().includes(q);
      const matchF = filtro === "todos" ? true : filtro === "con" ? c.consumo_actual > 0 : c.consumo_actual === 0;
      let matchSub = true;
      if (subcanalFiltro) {
        if (subcanalFiltro.codigo) {
          // Subcanal con código real → match exacto
          matchSub = c.codigo_subcanal === subcanalFiltro.codigo;
        } else {
          // Sin código = card "Sin Clasificar": clientes sin codigo_subcanal
          // (o que apuntan a un subcanal no registrado en la tabla subcanales).
          const sinCodigo = !c.codigo_subcanal || c.codigo_subcanal.trim() === "";
          const target = subcanalFiltro.nombre.toLowerCase();
          const sinSubcanal = !c.subcanal || c.subcanal.trim() === "";
          const matchNombre = (c.subcanal || "").toLowerCase() === target;
          matchSub = sinCodigo || sinSubcanal || matchNombre;
        }
      }
      return matchQ && matchF && matchSub;
    });
    const { key, direction: dir } = sortConfig;
    arr = [...arr].sort((a, b) => {
      const av: any = (a as any)[key];
      const bv: any = (b as any)[key];
      const an = Number(av), bn = Number(bv);
      if (Number.isFinite(an) && Number.isFinite(bn)) return dir === "asc" ? an - bn : bn - an;
      return dir === "asc" ? String(av).localeCompare(String(bv)) : String(bv).localeCompare(String(av));
    });
    return arr;
  }, [clientesTodos, busqueda, filtro, sortConfig, subcanalFiltro]);

  const totalPags = Math.max(1, Math.ceil(clientesFiltrados.length / POR_PAGINA));
  const paginados = clientesFiltrados.slice((pagina - 1) * POR_PAGINA, pagina * POR_PAGINA);

  const exportarTodos = () => {
    if (clientesFiltrados.length === 0) return;
    const datos = clientesFiltrados.map((c, i) => ({
      "N°": i + 1,
      Código: c.codigo_cliente,
      Cliente: c.nombre_cliente,
      "Tipo Negocio": c.tipo_negocio,
      Teléfono: c.telefono,
      Unidades: c.cantidad_actual,
      "Consumo Actual": c.consumo_actual,
      "Consumo Anterior": c.consumo_anterior,
      "Variación Abs": c.consumo_actual - c.consumo_anterior,
      "Máx Histórico": c.max_consumo,
      "Última Factura": c.ultima_factura ?? "",
    }));
    const ws = XLSX.utils.json_to_sheet(datos);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Clientes VIP");
    XLSX.writeFile(wb, `clientes_vip_${mes}_${anio}.xlsx`);
  };

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
            <p className="text-xs text-gray-400">
              {MESES[Number(mes)]} {anio} ·{" "}
              {vistaTodos ? "Lista completa de clientes" : "Selecciona un módulo para ver sus clientes"}
              {tipoProducto !== "todo" && (
                <span
                  className={`ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${
                    tipoProducto === "liquido"
                      ? "text-blue-300 border-blue-400/40 bg-blue-500/10"
                      : "text-amber-300 border-amber-400/40 bg-amber-500/10"
                  }`}
                >
                  Filtro: {tipoProducto === "liquido" ? "Líquido" : "Envase"}
                </span>
              )}
            </p>
          </div>
        </div>

        {/* KPIs globales (solo vista subcanales) */}
        {!vistaTodos && (
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
        )}

        {/* VS Mes anterior banner (solo vista subcanales) */}
        {!vistaTodos && !cargando && totalMontoAnt > 0 && (
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

        {/* ───────── VISTA: TODOS LOS CLIENTES ───────── */}
        {vistaTodos && (
          <div className="bg-gradient-to-br from-[#012E24] to-[#013d30] border border-[#046C5E]/30 rounded-2xl overflow-hidden mb-8">
            {subcanalFiltro && (
              <div className="flex items-center justify-between px-4 py-3 bg-emerald-500/10 border-b border-emerald-400/30">
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-emerald-300 font-semibold uppercase text-xs tracking-wider">Filtro Subcanal:</span>
                  <span className="text-white font-bold">{subcanalFiltro.nombre}</span>
                </div>
                <button
                  onClick={() => { setSubcanalFiltro(null); setPagina(1); }}
                  className="text-xs text-emerald-300 hover:text-white font-semibold flex items-center gap-1"
                >
                  ✕ Quitar filtro
                </button>
              </div>
            )}

            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between p-4 border-b border-[#046C5E]/30">
              <div className="flex flex-wrap items-center gap-2">
                <input
                  type="text"
                  placeholder="Buscar por código o nombre…"
                  value={busqueda}
                  onChange={(e) => { setBusqueda(e.target.value); setPagina(1); }}
                  className="bg-[#011f1a] border border-[#046C5E]/60 rounded-lg px-3 py-2 text-sm w-64 placeholder-gray-500 focus:outline-none focus:border-emerald-400"
                />
                <select
                  value={filtro}
                  onChange={(e) => { setFiltro(e.target.value as any); setPagina(1); }}
                  className="bg-[#011f1a] border border-[#046C5E]/60 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-emerald-400"
                >
                  <option value="todos">Todos</option>
                  <option value="con">Con consumo</option>
                  <option value="sin">Sin consumo</option>
                </select>
                <span className="text-xs text-gray-400">
                  {clientesFiltrados.length.toLocaleString("es-EC")} cliente{clientesFiltrados.length !== 1 ? "s" : ""}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    setVistaTodos(false);
                    setSubcanalFiltro(null);
                    setBusqueda("");
                    setPagina(1);
                  }}
                  className="px-3 py-2 rounded-lg border border-[#046C5E] bg-[#013d30] text-white text-sm font-semibold hover:border-emerald-400/60 hover:bg-[#025040] transition"
                >
                  ← Volver a subcanales
                </button>
                <button
                  onClick={exportarTodos}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg border border-[#0db48b]/60 bg-[#0db48b]/20 text-white text-sm font-semibold hover:bg-[#0db48b]/30 transition"
                >
                  <BsDownload size={14} />
                  <span>Exportar</span>
                </button>
              </div>
            </div>

            {cargandoTodos ? (
              <div className="flex flex-col justify-center items-center py-24 gap-4">
                <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-emerald-400" />
                <p className="text-gray-400 text-sm">Cargando clientes…</p>
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead>
                      <tr className="bg-[#014434] text-[10px] uppercase text-green-300">
                        <th className="px-3 py-3 text-left">N°</th>
                        <th className="px-3 py-3 text-left cursor-pointer hover:text-white" onClick={() => requestSort("codigo_cliente")}>
                          Código{sa("codigo_cliente")}
                        </th>
                        <th className="px-3 py-3 text-left cursor-pointer hover:text-white" onClick={() => requestSort("nombre_cliente")}>
                          Cliente{sa("nombre_cliente")}
                        </th>
                        <th className="px-3 py-3 text-left cursor-pointer hover:text-white" onClick={() => requestSort("tipo_negocio")}>
                          Tipo Negocio{sa("tipo_negocio")}
                        </th>
                        <th className="px-3 py-3 text-left">Teléfono</th>
                        <th className="px-3 py-3 text-right cursor-pointer hover:text-white" onClick={() => requestSort("cantidad_actual")}>
                          Unidades{sa("cantidad_actual")}
                        </th>
                        <th className="px-3 py-3 text-right cursor-pointer hover:text-white" onClick={() => requestSort("consumo_actual")}>
                          Consumo{sa("consumo_actual")}
                        </th>
                        <th className="px-3 py-3 text-right cursor-pointer hover:text-white" onClick={() => requestSort("consumo_anterior")}>
                          Mes Ant.{sa("consumo_anterior")}
                        </th>
                        <th className="px-3 py-3 text-right">Variación</th>
                        <th className="px-3 py-3 text-right cursor-pointer hover:text-white" onClick={() => requestSort("max_consumo")}>
                          Máx{sa("max_consumo")}
                        </th>
                        <th className="px-3 py-3 text-left cursor-pointer hover:text-white" onClick={() => requestSort("ultima_factura")}>
                          Última{sa("ultima_factura")}
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {paginados.length === 0 ? (
                        <tr>
                          <td colSpan={11} className="px-4 py-10 text-center text-gray-400 text-sm">
                            No se encontraron clientes con los filtros aplicados.
                          </td>
                        </tr>
                      ) : (
                        paginados.map((c, idx) => {
                          const varMonto = Number(c.consumo_actual) - Number(c.consumo_anterior);
                          const tieneConsumo = Number(c.consumo_actual) > 0;
                          const num = (pagina - 1) * POR_PAGINA + idx + 1;
                          return (
                            <tr
                              key={c.codigo_cliente}
                              onClick={() => navigate(`/vip-botellon/cliente/${c.codigo_cliente}/${anio}/${mes}`)}
                              className={`cursor-pointer transition-colors hover:bg-[#025940] ${
                                idx % 2 === 0 ? "bg-[#013d32]" : "bg-[#014f3e]"
                              }`}
                            >
                              <td className="px-3 py-2 text-gray-400 text-xs">{num}</td>
                              <td className="px-3 py-2 text-gray-300 font-mono text-xs">{c.codigo_cliente}</td>
                              <td className="px-3 py-2 font-semibold text-white">{c.nombre_cliente}</td>
                              <td className="px-3 py-2 text-gray-300">{c.tipo_negocio || "—"}</td>
                              <td className="px-3 py-2 text-gray-300">{c.telefono || "—"}</td>
                              <td className="px-3 py-2 text-right text-blue-300 font-semibold">
                                {Number(c.cantidad_actual).toLocaleString("es-EC")}
                              </td>
                              <td className={`px-3 py-2 text-right font-bold ${tieneConsumo ? "text-amber-300" : "text-gray-500"}`}>
                                ${fmt(Number(c.consumo_actual))}
                              </td>
                              <td className="px-3 py-2 text-right text-gray-400">
                                ${fmt(Number(c.consumo_anterior))}
                              </td>
                              <td className={`px-3 py-2 text-right font-semibold ${varMonto >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                                {varMonto >= 0 ? "+" : "-"}${fmt(Math.abs(varMonto))}
                              </td>
                              <td className="px-3 py-2 text-right text-purple-300">
                                ${fmt(Number(c.max_consumo))}
                              </td>
                              <td className="px-3 py-2 text-gray-300 text-xs">
                                {c.ultima_factura ? new Date(c.ultima_factura).toLocaleDateString("es-EC") : "—"}
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>

                {totalPags > 1 && (
                  <div className="flex items-center justify-between p-4 border-t border-[#046C5E]/30 text-sm">
                    <button
                      onClick={() => setPagina(p => Math.max(1, p - 1))}
                      disabled={pagina === 1}
                      className="px-3 py-1.5 rounded border border-[#046C5E]/60 disabled:opacity-30 hover:bg-[#025040]"
                    >
                      ← Anterior
                    </button>
                    <span className="text-gray-400">
                      Página {pagina} de {totalPags}
                    </span>
                    <button
                      onClick={() => setPagina(p => Math.min(totalPags, p + 1))}
                      disabled={pagina === totalPags}
                      className="px-3 py-1.5 rounded border border-[#046C5E]/60 disabled:opacity-30 hover:bg-[#025040]"
                    >
                      Siguiente →
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* Loading vista principal */}
        {!vistaTodos && cargando && (
          <div className="flex flex-col justify-center items-center py-32 gap-4">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-emerald-400" />
            <p className="text-gray-400 text-sm">Cargando módulos…</p>
          </div>
        )}

        {/* Productos Vendidos (solo vista subcanales) */}
        {!vistaTodos && !cargando && productos.length > 0 && (
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
                    <th className="px-4 py-3 text-right">Precio Promedio</th>
                  </tr>
                </thead>
                <tbody>
                  {productos.map((p, idx) => {
                    const uni = Number(p.unidades_vendidas);
                    const usd = Number(p.monto_usd);
                    const prom = uni > 0 ? usd / uni : 0;
                    return (
                      <tr key={idx} className={`${idx % 2 === 0 ? "bg-[#013d32]" : "bg-[#014f3e]"} hover:bg-[#025940] transition-colors`}>
                        <td className="px-4 py-2">{p.producto}</td>
                        <td className="px-4 py-2 text-right text-green-400 font-semibold">
                          {uni.toLocaleString("es-EC")}
                        </td>
                        <td className="px-4 py-2 text-right text-blue-400 font-semibold">
                          ${fmt(usd)}
                        </td>
                        <td className="px-4 py-2 text-right text-purple-400 font-semibold">
                          ${fmt(prom)}
                        </td>
                      </tr>
                    );
                  })}
                  {(() => {
                    const totUni = productos.reduce((a, p) => a + Number(p.unidades_vendidas), 0);
                    const totUSD = productos.reduce((a, p) => a + Number(p.monto_usd), 0);
                    const promTotal = totUni > 0 ? totUSD / totUni : 0;
                    return (
                      <tr className="bg-[#014434] font-bold border-t border-[#046C5E]/30">
                        <td className="px-4 py-3 text-green-300 uppercase text-xs">Total</td>
                        <td className="px-4 py-3 text-right text-green-400">
                          {totUni.toLocaleString("es-EC")}
                        </td>
                        <td className="px-4 py-3 text-right text-blue-400">
                          ${fmt(totUSD)}
                        </td>
                        <td className="px-4 py-3 text-right text-purple-300">
                          ${fmt(promTotal)}
                        </td>
                      </tr>
                    );
                  })()}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Subcanales agrupados por canal */}
        {!vistaTodos && !cargando && (() => {
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
              {canales.map((canal, canalIdx) => {
                const items = porCanal[canal];
                const canalTotal = items.reduce((a, s) => a + Number(s.monto_actual), 0);
                const canalClientes = items.reduce((a, s) => a + Number(s.total_clientes), 0);

                return (
                  <div key={canal} className="mb-10">
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

                    {canalIdx === 0 && (
                      <div className="mb-5">
                        <button
                          onClick={() => {
                            setSubcanalFiltro(null);
                            setVistaTodos(true);
                            setPagina(1);
                          }}
                          className="w-full sm:w-auto px-5 py-2.5 rounded-xl border text-sm font-semibold transition-all flex items-center justify-center gap-2 bg-[#013d30] border-[#046C5E] text-white hover:border-emerald-400/60 hover:bg-[#025040]"
                        >
                          Ver todos los clientes →
                        </button>
                      </div>
                    )}

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
                      {items.map((s) => {
                        const sinConsumo = Number(s.total_clientes) - Number(s.clientes_con_consumo);
                        const varMonto   = Number(s.monto_actual) - Number(s.monto_anterior);
                        return (
                          <div
                            key={`${canal}-${s.subcanal}`}
                            onClick={() => {
                              setSubcanalFiltro({ codigo: s.codigo_subcanal || "", nombre: s.subcanal });
                              setVistaTodos(true);
                              setPagina(1);
                            }}
                            className="cursor-pointer bg-gradient-to-br from-[#012E24] to-[#014034]
                              border border-[#046C5E]/40 rounded-2xl p-5 shadow-lg flex flex-col gap-3
                              hover:border-emerald-400/60 hover:scale-[1.02] transition-all duration-200"
                          >
                            <div className="flex items-start justify-between gap-2">
                              <p className="text-sm font-bold text-white leading-tight">{s.subcanal}</p>
                              <span className="shrink-0 text-[10px] text-gray-400 italic mt-0.5">Ver clientes →</span>
                            </div>

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
