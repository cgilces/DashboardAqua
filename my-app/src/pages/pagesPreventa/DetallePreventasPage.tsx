import React, { useEffect, useState } from "react";
import { useParams, Link, useLocation } from "react-router-dom";
import * as XLSX from "xlsx";

// ─── Tipos ────────────────────────────────────────────────────────
type LocationState = {
  objetivo_gerencia?:          number;
  objetivo_gerencia_unidades?: number;
  proyeccion?:                 number;
  monto?:                      number;
  meta?:                       number;
};

const fmt    = (v: number) => v.toLocaleString("es-EC", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtInt = (v: number) => v.toLocaleString("es-EC");

const DetallePreventasPage: React.FC = () => {
  const { ruta, anio, mes } = useParams();
  const location            = useLocation();

  // ✅ Datos del ranking pasados por navigate state
  const state = (location.state || {}) as LocationState;
  const objetivo   = Number(state.objetivo_gerencia)          || 0;
  const objUnidades = Number(state.objetivo_gerencia_unidades) || 0;
  const proyeccion  = Number(state.proyeccion)                 || 0;
  const monto       = Number(state.monto)                      || 0;
  const metaVendedor = Number(state.meta)                      || 0;

  // Diferencia real vs objetivo
  const faltaUSD      = objetivo > 0 ? objetivo - proyeccion : 0;
  const porcObjetivo  = objetivo > 0 ? (proyeccion / objetivo) * 100 : null;
  const superado      = faltaUSD <= 0;

  const [productos,           setProductos]           = useState<any[]>([]);
  const [resumenClientes,     setResumenClientes]     = useState<any>(null);
  const [clientesRuta,        setClientesRuta]        = useState<any[]>([]);
  const [cargando,            setCargando]            = useState(false);
  const [filtroConsumo,       setFiltroConsumo]       = useState("Todos");
  const [terminoBusqueda,     setTerminoBusqueda]     = useState("");
  const [paginaActual,        setPaginaActual]        = useState(1);
  const [sortConfig,          setSortConfig]          = useState({ key: "codigo_cliente", direction: "asc" });
  const clientesPorPagina = 60;

  if (!ruta || !anio || !mes)
    return <div className="text-white p-10"><h1>Parámetros inválidos en la ruta</h1></div>;

  // ── Ordenar ───────────────────────────────────────────────────────
  const requestSort = (key: string) => {
    const direction = sortConfig.key === key && sortConfig.direction === "asc" ? "desc" : "asc";
    setSortConfig({ key, direction });

    const getComparable = (row: any) => {
      if (key === "vsMesAnterior") {
        const abs = Number(row?.vsMesAnterior?.variacion_abs);
        if (Number.isFinite(abs)) return abs;
        const rawAbs = String(row?.vsMesAnterior?.variacion_abs ?? "").replace(/[^\d.-]/g, "");
        const absParsed = Number(rawAbs);
        if (Number.isFinite(absParsed)) return absParsed;
        const rawPorc = String(row?.vsMesAnterior?.variacion_porc ?? "").replace("%","").replace(",",".").trim();
        const porc = Number(rawPorc);
        return Number.isFinite(porc) ? porc : 0;
      }
      const val = row?.[key];
      const num = Number(String(val).replace(",", "."));
      if (Number.isFinite(num) && String(val).match(/^-?\d+([.,]\d+)?$/)) return num;
      if (typeof val === "string") return val.toLowerCase();
      if (typeof val === "number") return val;
      return val ?? "";
    };

    setClientesRuta(prev => [...prev].sort((a, b) => {
      const aVal = getComparable(a);
      const bVal = getComparable(b);
      if (typeof aVal === "number" && typeof bVal === "number")
        return direction === "asc" ? aVal - bVal : bVal - aVal;
      return direction === "asc" ? String(aVal).localeCompare(String(bVal)) : String(bVal).localeCompare(String(aVal));
    }));
  };

  // ── Cargar datos ──────────────────────────────────────────────────
  useEffect(() => {
    setCargando(true);
    fetch(`http://localhost:5000/api/ventas/detalle-ruta/${ruta}/${anio}/${mes}`)
      .then(res => res.json())
      .then(data => {
        let clientes = data.clientesRuta || [];
        if (filtroConsumo !== "Todos")
          clientes = clientes.filter((c: any) => c.tuvo_consumo === filtroConsumo);
        setClientesRuta(clientes);

        const productosMapeados = (data.productosVendidos || []).map((p: any) => ({
          descripcion: p.producto,
          unidades:    Number(p.unidades_vendidas),
          monto:       Number(p.monto_usd),
        }));
        setProductos(productosMapeados);
        setResumenClientes(data.resumenClientes);
      })
      .finally(() => setCargando(false));
  }, [ruta, anio, mes, filtroConsumo]);

  // ── Filtrar + paginar ─────────────────────────────────────────────
  const clientesFiltrados = (clientesRuta || []).filter(c =>
    String(c?.nombre_cliente || "").toLowerCase().includes(String(terminoBusqueda || "").toLowerCase())
  );
  const indiceUltimo  = paginaActual * clientesPorPagina;
  const indicePrimero = indiceUltimo - clientesPorPagina;
  const clientesPagina = clientesFiltrados.slice(indicePrimero, indiceUltimo);
  const totalPaginas   = Math.ceil(clientesFiltrados.length / clientesPorPagina);

  // ── Exportar ──────────────────────────────────────────────────────
  type ExcelClienteRuta = {
    Código: string | number; Cliente: string; Dirección: string;
    "Tipo Negocio": string; Teléfono: string; Latitud: string; Longitud: string;
    "Cantidad Actual": number; "Consumo Actual($)": number; "Max Consumo($)": number;
    "VS MES ANT": string; "Última Visita": string; "Última Factura": string; "Tuvo Consumo": string;
  };

  const exportarClientesRuta = () => {
    if (!clientesRuta || clientesRuta.length === 0) return;
    try {
      const rutaUpper       = (ruta || "").toUpperCase();
      const datosExportar: ExcelClienteRuta[] = clientesRuta.map(c => ({
        Código: c.codigo_cliente, Cliente: c.nombre_cliente,
        Dirección: c.direccion_entrega ?? "", "Tipo Negocio": c.tipo_negocio ?? "SIN CLASIFICAR",
        Teléfono: c.telefono_cliente ?? "", Latitud: c.latitud_cliente ?? "", Longitud: c.longitud_cliente ?? "",
        "Cantidad Actual": Number(c.cantidad_productos || 0), "Consumo Actual($)": Number(c.consumo_actual || 0),
        "Max Consumo($)": Number(c.max_consumo || 0),
        "VS MES ANT": c.vsMesAnterior ? `${c.vsMesAnterior.variacion_abs > 0 ? "+" : ""}${Number(c.vsMesAnterior.variacion_abs || 0).toFixed(2)} (${c.vsMesAnterior.variacion_porc})` : "",
        "Última Visita": c.ultima_visita ?? "—", "Última Factura": c.ultima_factura ?? "—",
        "Tuvo Consumo": c.tuvo_consumo,
      }));
      const ws = XLSX.utils.json_to_sheet(datosExportar);
      XLSX.utils.sheet_add_aoa(ws, [[`CLIENTES DE RUTA - ${rutaUpper} - ${mes}/${anio}`]], { origin: "A1" });
      const columnas = Object.keys(datosExportar[0]) as (keyof ExcelClienteRuta)[];
      ws["!cols"] = columnas.map(col => ({ wch: Math.max(col.length, ...datosExportar.map(r => String(r[col]).length)) + 4 }));
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "ClientesRuta");
      XLSX.writeFile(wb, `clientes_ruta_${rutaUpper}_${mes}_${anio}.xlsx`, { compression: true });
    } catch {}
  };

  if (cargando)
    return (
      <div className="flex flex-col justify-center items-center h-screen text-gray-300">
        <div className="w-10 h-10 border-4 border-t-[#74ab3c] border-gray-700 rounded-full animate-spin mb-4"/>
        <p>Cargando datos de {ruta}...</p>
      </div>
    );

  // ────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen text-white p-5">

      {/* HEADER */}
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Detalle de {ruta} — {mes}/{anio}</h1>
        <Link to="/dashboard/preventa" className="px-4 py-2 bg-[#046C5E] rounded-lg hover:bg-[#058A73] transition">
          ← Volver al Dashboard
        </Link>
      </div>

      {/* ══════════════════════════════════════════════════════════
          ✅ CARD OBJETIVO GERENCIA
          Solo se muestra si hay un objetivo configurado
      ══════════════════════════════════════════════════════════ */}
      {objetivo > 0 && (
        <div className="mb-8 p-5 rounded-2xl border border-amber-500/30 bg-gradient-to-br from-[#1a1200]/80 to-[#012a20]/80 shadow-xl backdrop-blur-sm">

          {/* Título */}
          <div className="flex items-center gap-2 mb-5">
            <div className="w-1 h-6 rounded-full bg-gradient-to-b from-amber-400 to-yellow-600"/>
            <h2 className="text-base font-bold text-amber-300 uppercase tracking-wider">
              Objetivo de Gerencia — {ruta}
            </h2>
            <span className="ml-auto text-xs text-white/30 font-mono">{mes}/{anio}</span>
          </div>

          {/* Métricas */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-5">

            {/* Objetivo */}
            <div className="rounded-xl bg-white/5 border border-amber-500/20 p-4">
              <p className="text-[10px] font-bold uppercase tracking-widest text-amber-400/70 mb-1">Objetivo USD</p>
              <p className="text-xl font-bold text-amber-300">${fmt(objetivo)}</p>
              {objUnidades > 0 && (
                <p className="text-xs text-white/40 mt-0.5">{fmtInt(objUnidades)} unidades</p>
              )}
            </div>

            {/* Proyección actual */}
            <div className="rounded-xl bg-white/5 border border-blue-500/20 p-4">
              <p className="text-[10px] font-bold uppercase tracking-widest text-blue-400/70 mb-1">Proyección</p>
              <p className="text-xl font-bold text-blue-300">${fmt(proyeccion)}</p>
              <p className="text-xs text-white/40 mt-0.5">Venta actual: ${fmt(monto)}</p>
            </div>

            {/* Diferencia (falta / superado) */}
            <div className={`rounded-xl bg-white/5 border p-4 ${superado ? "border-green-500/30" : "border-red-500/30"}`}>
              <p className="text-[10px] font-bold uppercase tracking-widest mb-1 text-white/40">
                {superado ? "Superado en" : "Falta alcanzar"}
              </p>
              <p className={`text-xl font-bold ${superado ? "text-green-400" : "text-red-400"}`}>
                {superado ? "+" : "−"}${fmt(Math.abs(faltaUSD))}
              </p>
              {!superado && metaVendedor > 0 && (
                <p className="text-xs text-white/40 mt-0.5">Meta vendedor: ${fmt(metaVendedor)}</p>
              )}
            </div>

            {/* % cumplimiento */}
            <div className="rounded-xl bg-white/5 border border-white/10 p-4 flex flex-col justify-between">
              <p className="text-[10px] font-bold uppercase tracking-widest text-white/40 mb-2">Cumplimiento</p>
              <div>
                {/* barra de progreso */}
                <div className="w-full h-2.5 rounded-full bg-white/10 mb-2 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${
                      porcObjetivo! >= 100 ? "bg-green-400" :
                      porcObjetivo! >= 80  ? "bg-yellow-400" : "bg-red-400"
                    }`}
                    style={{ width: `${Math.min(porcObjetivo ?? 0, 100)}%` }}
                  />
                </div>
                <p className={`text-2xl font-extrabold ${
                  porcObjetivo! >= 100 ? "text-green-400" :
                  porcObjetivo! >= 80  ? "text-yellow-400" : "text-red-400"
                }`}>
                  {porcObjetivo !== null ? `${porcObjetivo.toFixed(1)}%` : "—"}
                </p>
              </div>
            </div>
          </div>

          {/* Mensaje contextual */}
          <div className={`rounded-xl px-4 py-3 text-sm font-semibold border ${
            superado
              ? "bg-green-500/10 border-green-500/25 text-green-300"
              : porcObjetivo! >= 80
              ? "bg-yellow-500/10 border-yellow-500/25 text-yellow-300"
              : "bg-red-500/10 border-red-500/25 text-red-300"
          }`}>
            {superado
              ? `✓ ${ruta} ha superado el objetivo de gerencia. Proyección ${porcObjetivo!.toFixed(1)}% del objetivo.`
              : porcObjetivo! >= 80
              ? `⚡ ${ruta} está cerca del objetivo. Con $${fmt(faltaUSD)} más se alcanza la meta de gerencia.`
              : `⚠ ${ruta} necesita $${fmt(faltaUSD)} adicionales para cumplir el objetivo de gerencia (${porcObjetivo!.toFixed(1)}% alcanzado).`
            }
          </div>
        </div>
      )}

      {/* RESUMEN CLIENTES */}
      {resumenClientes && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
          <div className="p-5 bg-[#01382D] rounded-lg shadow-md">
            <h3 className="text-gray-200 text-sm mb-1">Clientes asignados</h3>
            <p className="text-4xl font-bold text-green-400">{resumenClientes.totalClientesRuta}</p>
          </div>
          <div className="p-5 bg-[#01382D] rounded-lg shadow-md">
            <h3 className="text-gray-200 text-sm mb-1">Clientes con consumo</h3>
            <p className="text-4xl font-bold text-blue-400">{resumenClientes.clientesConConsumo}</p>
          </div>
          <div className="p-5 bg-[#01382D] rounded-lg shadow-md">
            <h3 className="text-gray-200 text-sm mb-1">Clientes sin consumo</h3>
            <p className="text-4xl font-bold text-red-400">{resumenClientes.clientesSinConsumo}</p>
          </div>
        </div>
      )}

      {/* PRODUCTOS VENDIDOS */}
      <h1 className="text-center text-xl font-bold mb-4">PRODUCTOS VENDIDOS</h1>

      {productos.length > 0 ? (
        <table className="min-w-full text-sm border border-[#046C5E] rounded-lg mb-12">
          <thead className="bg-[#014434] text-green-300 uppercase text-xs">
            <tr>
              <th className="px-4 py-3 text-left">Producto</th>
              <th className="px-4 py-3 text-right">Unidades</th>
              <th className="px-4 py-3 text-right">Dólares</th>
            </tr>
          </thead>
          <tbody>
            {productos.map((p, idx) => (
              <tr key={idx} className={`${idx % 2 === 0 ? "bg-[#013d32]" : "bg-[#014f3e]"} hover:bg-[#026452] transition`}>
                <td className="px-4 py-2">{p.descripcion}</td>
                <td className="px-4 py-2 text-right text-green-400 font-semibold">{p.unidades.toLocaleString()}</td>
                <td className="px-4 py-2 text-right text-blue-400 font-semibold">
                  ${p.monto.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </td>
              </tr>
            ))}
            <tr className="bg-[#022d24] font-bold">
              <td className="px-4 py-3 text-right text-white uppercase">Total</td>
              <td className="px-4 py-3 text-right text-green-500">
                {productos.reduce((acc, p) => acc + p.unidades, 0).toLocaleString()}
              </td>
              <td className="px-4 py-3 text-right text-blue-500">
                ${productos.reduce((acc, p) => acc + p.monto, 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </td>
            </tr>
          </tbody>
        </table>
      ) : (
        <p className="text-center text-gray-400 mt-10">No se encontraron productos facturados para esta ruta.</p>
      )}

      {/* CLIENTES DE RUTA */}
      <div className="overflow-x-auto scrollbar-hide">
        <div className="min-w-full text-sm border border-[#046C5E] rounded-lg">
          <h1 className="text-center text-xl font-bold mt-10 mb-4">CLIENTES DE RUTA</h1>

          {clientesRuta.length > 0 ? (
            <>
              <div className="mb-6">
                {/* ACCIONES */}
                <div className="flex flex-col sm:flex-row sm:justify-between gap-4 mb-4">
                  <button onClick={exportarClientesRuta}
                    className="flex items-center gap-2 px-4 py-2 bg-[#046C5E] hover:bg-[#058A73] text-white font-semibold rounded-md shadow-md transition">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5 5m0 0l5-5m-5 5V4"/>
                    </svg>
                    Exportar clientes S/C
                  </button>
                  <div>
                    <label htmlFor="filtroConsumo" className="text-white mr-2">Filtrar por consumo Mes_Actual:</label>
                    <select id="filtroConsumo" value={filtroConsumo} onChange={e => setFiltroConsumo(e.target.value)}
                      className="px-4 py-2 bg-[#046C5E] text-white font-semibold rounded-md">
                      <option value="Todos">Todos</option>
                      <option value="Sí">Con Consumo</option>
                      <option value="No">Sin Consumo</option>
                    </select>
                  </div>
                </div>

                {/* BUSCADOR */}
                <div className="flex justify-center mb-4">
                  <div className="relative w-full sm:w-3/4 md:w-1/2 lg:w-1/3">
                    <input type="text" placeholder="Buscar por nombre de cliente"
                      value={terminoBusqueda} onChange={e => setTerminoBusqueda(e.target.value)}
                      className="w-full px-4 py-2 pl-10 rounded-md bg-[#046C5E] text-white text-sm focus:outline-none focus:ring-2 focus:ring-[#74ab3c]"/>
                    <svg xmlns="http://www.w3.org/2000/svg" className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M18 10a8 8 0 10-8 8 8 8 0 008-8z"/>
                    </svg>
                  </div>
                </div>

                {/* TABLA CLIENTES */}
                <div className="overflow-x-auto scrollbar-hide">
                  <table className="w-full table-fixed text-sm border border-[#046C5E] rounded-lg">
                    <thead className="bg-[#014434] text-green-300 uppercase text-xs">
                      <tr>
                        <th className="px-4 py-3">N°</th>
                        {[
                          ["Código","codigo_cliente"],["Cliente","nombre_cliente"],
                          ["Dirección","direccion_entrega"],["Tipo Negocio","tipo_negocio"],
                          ["Teléfono","telefono_cliente"],["Latitud","latitud_cliente"],
                          ["Longitud","longitud_cliente"],["Cantidad Actual","cantidad_productos"],
                          ["Consumo Actual($)","consumo_actual"],["Max Consumo($)","max_consumo"],
                          ["VS MES ANT","vsMesAnterior"],["Última Visita","ultima_visita"],
                          ["Última Factura","ultima_factura"],["Tuvo Consumo","tuvo_consumo"],
                        ].map(([label, key]) => (
                          <th key={key} className="px-4 py-3 text-left cursor-pointer" onClick={() => requestSort(key)}>
                            {label}
                            <span className="text-[#6BAF8E] ml-1">
                              {sortConfig.key === key ? (sortConfig.direction === "asc" ? "↑" : "↓") : "↕"}
                            </span>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {clientesPagina.map((c, idx) => (
                        <tr key={idx} className={`${c.tuvo_consumo === "No" ? "bg-[rgba(220,38,38,0.6)]" : idx % 2 === 0 ? "bg-[#013d32]" : "bg-[#014f3e]"} hover:bg-[#026452] transition`}>
                          <td className="px-4 py-2">{(paginaActual - 1) * clientesPorPagina + idx + 1}</td>
                          <td className="px-4 py-2 text-white">{c.codigo_cliente}</td>
                          <td className="px-0 py-4 text-white">{c.nombre_cliente}</td>
                          <td className="px-4 py-2 text-white">{c.direccion_entrega}</td>
                          <td className="px-4 py-2 text-white">{c.tipo_negocio}</td>
                          <td className="px-0 py-2">{c.telefono_cliente || "Sin Número"}</td>
                          <td className="px-3 py-2">{c.latitud_cliente  || "Sin Número"}</td>
                          <td className="px-2 py-2">{c.longitud_cliente || "Sin Número"}</td>
                          <td className="px-8 py-2 text-white">{c.cantidad_productos}</td>
                          <td className="px-4 py-2 text-white">{c.consumo_actual}</td>
                          <td className="px-4 py-2">
                            <div className="flex flex-col leading-tight">
                              <span className="text-white text-sm">
                                ${Number(c.max_consumo).toLocaleString("es-EC", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </span>
                              <span className="text-xs text-[#6BAF8E] font-medium">{c.mes_max_consumo_nombre ?? ""}</span>
                            </div>
                          </td>
                          <td className="px-4 py-2">
                            {c.vsMesAnterior ? (
                              <div className="flex flex-col leading-tight">
                                <span className={`text-sm font-bold ${c.vsMesAnterior.variacion_abs > 0 ? "text-green-400" : c.vsMesAnterior.variacion_abs < 0 ? "text-red-400" : "text-gray-300"}`}>
                                  ${Math.abs(c.vsMesAnterior.variacion_abs).toLocaleString("es-EC", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </span>
                                <span className={`text-xs font-semibold ${c.vsMesAnterior.variacion_abs > 0 ? "text-green-300" : c.vsMesAnterior.variacion_abs < 0 ? "text-red-300" : "text-gray-400"}`}>
                                  ({c.vsMesAnterior.variacion_abs > 0 && "+"}{c.vsMesAnterior.variacion_porc})
                                </span>
                              </div>
                            ) : ""}
                          </td>
                          <td className="px-4 py-2 text-[#6BAF8E] font-semibold whitespace-nowrap">{c.ultima_visita  ?? "—"}</td>
                          <td className="px-4 py-2 text-[#6BAF8E] font-semibold whitespace-nowrap">{c.ultima_factura ?? "—"}</td>
                          <td className={`px-4 py-2 font-bold ${c.tuvo_consumo === "Sí" ? "text-green-500" : "text-red-500"}`}>{c.tuvo_consumo}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* PAGINACIÓN */}
              <div className="flex justify-center mt-6 gap-2">
                <button disabled={paginaActual === 1} onClick={() => setPaginaActual(paginaActual - 1)}
                  className={`px-3 py-1 rounded-md flex items-center justify-center ${paginaActual === 1 ? "bg-gray-700 text-gray-500 cursor-not-allowed" : "bg-[#046C5E] hover:bg-[#058A73]"}`}>
                  <span className="sm:hidden">←</span><span className="hidden sm:inline">← Anterior</span>
                </button>

                {(() => {
                  const pages: any[] = [];
                  const maxVisible = 5;
                  if (totalPaginas <= maxVisible) {
                    for (let i = 1; i <= totalPaginas; i++) pages.push(i);
                  } else {
                    pages.push(1);
                    if (paginaActual > 3) pages.push("...");
                    const start = Math.max(2, paginaActual - 1);
                    const end   = Math.min(totalPaginas - 1, paginaActual + 1);
                    for (let i = start; i <= end; i++) pages.push(i);
                    if (paginaActual < totalPaginas - 2) pages.push("...");
                    pages.push(totalPaginas);
                  }
                  return pages.map((num, idx) =>
                    num === "..." ? (
                      <span key={`dots-${idx}`} className="px-2 py-1 text-gray-400 select-none">...</span>
                    ) : (
                      <button key={`page-${idx}-${num}`} onClick={() => setPaginaActual(num)}
                        className={`px-3 py-1 rounded-md ${paginaActual === num ? "bg-green-500 text-black font-bold" : "bg-[#01382D] hover:bg-[#025f4b]"}`}>
                        {num}
                      </button>
                    )
                  );
                })()}

                <button disabled={paginaActual === totalPaginas} onClick={() => setPaginaActual(paginaActual + 1)}
                  className={`px-3 py-1 rounded-md flex items-center justify-center ${paginaActual === totalPaginas ? "bg-gray-700 text-gray-500 cursor-not-allowed" : "bg-[#046C5E] hover:bg-[#058A73]"}`}>
                  <span className="sm:hidden">→</span><span className="hidden sm:inline">Siguiente →</span>
                </button>
              </div>
            </>
          ) : (
            <p className="text-center text-gray-400 mt-10">Sin consumo</p>
          )}
        </div>
      </div>
    </div>
  );
};

export default DetallePreventasPage;