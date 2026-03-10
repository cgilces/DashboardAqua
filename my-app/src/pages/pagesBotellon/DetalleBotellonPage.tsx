import React, { useEffect, useState } from "react";
import { useParams, useSearchParams, Link } from "react-router-dom";
import * as XLSX from "xlsx";
import { API_BASE_URL } from "../../config";


const DetalleBotellonPage: React.FC = () => {
  // ==========================
  // PARAMETROS CORRECTOS
  // ==========================
  // const { usuario } = useParams<{ usuario: string }>();
  const { usuario } = useParams<{ usuario: string }>();


  const [searchParams] = useSearchParams();

  const anio = searchParams.get("anio");
  const mes = searchParams.get("mes");

  // ==========================
  // ESTADOS
  // ==========================
  const [productos, setProductos] = useState<any[]>([]);
  const [resumenClientes, setResumenClientes] = useState<any>(null);
  const [clientesRuta, setClientesRuta] = useState<any[]>([]);
  const [cargando, setCargando] = useState(false);

  const [filtroConsumo, setFiltroConsumo] = useState("Todos");
  const [terminoBusqueda, setTerminoBusqueda] = useState("");

  // PAGINACIÓN
  const [paginaActual, setPaginaActual] = useState(1);
  const clientesPorPagina = 60;

  // ORDEN
  const [sortConfig, setSortConfig] = useState<{
    key: string;
    direction: "asc" | "desc";
  }>({
    key: "codigo_cliente",
    direction: "asc",
  });

  // ==========================
  // VALIDACIÓN
  // ==========================
  if (!usuario || !anio || !mes) {
    return (
      <div className="text-white p-10">
        <h1>Parámetros inválidos</h1>
      </div>
    );
  }



  // ==========================
  // ORDENAR
  // ==========================
  const requestSort = (key: string) => {
    const direction =
      sortConfig.key === key && sortConfig.direction === "asc"
        ? "desc"
        : "asc";

    setSortConfig({ key, direction });

    const sorted = [...clientesRuta].sort((a, b) => {
      let aVal = a[key];
      let bVal = b[key];

      // Si el campo es "consumo_actual", asegúrate de que se convierte a un número
      if (key === "consumo_actual") {
        aVal = parseFloat(aVal) || 0; // Si no se puede convertir a número, se asigna 0
        bVal = parseFloat(bVal) || 0; // Lo mismo para bVal
      }


      // Si estamos ordenando por "vsMesAnterior.variacion_abs"
      if (key === "vsMesAnterior") {
        aVal = a[key]?.variacion_abs || 0; // Obtener variacion_abs o 0 si no está definido
        bVal = b[key]?.variacion_abs || 0; // Obtener variacion_abs o 0 si no está definido
      }

      // Si los valores son de tipo string
      if (typeof aVal === "string" && typeof bVal === "string") {
        return direction === "asc"
          ? aVal.localeCompare(bVal)
          : bVal.localeCompare(aVal);
      }

      if (typeof aVal === "number" && typeof bVal === "number") {
        return direction === "asc" ? aVal - bVal : bVal - aVal;
      }

      return 0;
    });

    setClientesRuta(sorted);
  };

  // ==========================
  // FETCH DATOS
  // ==========================
  useEffect(() => {
    setCargando(true);

    fetch(
      `${API_BASE_URL}/api/botellones/detalle-botellones/${usuario}/${anio}/${mes}`
    )
      .then((res) => res.json())
      .then((data) => {
        // CLIENTES
        let clientes = data.clientesRuta || [];

        if (filtroConsumo !== "Todos") {
          clientes = clientes.filter(
            (c: any) => c.tuvo_consumo === filtroConsumo
          );
        }

        setClientesRuta(clientes);

        // PRODUCTOS
        const productosMapeados = (data.productosVendidos || []).map(
          (p: any) => ({
            descripcion: p.producto,
            unidades: Number(p.unidades_vendidas),
            monto: Number(p.monto_usd),
          })
        );

        setProductos(productosMapeados);

        // RESUMEN
        setResumenClientes(data.resumenClientes);
      })
      .finally(() => setCargando(false));
  }, [usuario, anio, mes, filtroConsumo]);

  // ==========================
  // FILTRO + PAGINACIÓN
  // ==========================
  const clientesFiltrados = clientesRuta.filter((c) =>
    c.nombre_cliente
      ?.toLowerCase()
      .includes(terminoBusqueda.toLowerCase())
  );

  const inicio = (paginaActual - 1) * clientesPorPagina;
  const fin = inicio + clientesPorPagina;

  const clientesPagina = clientesFiltrados.slice(inicio, fin);
  const totalPaginas = Math.ceil(clientesFiltrados.length / clientesPorPagina);

  // ==========================
  // EXPORTAR EXCEL
  // ==========================
  const exportarClientesRuta = () => {
    if (clientesRuta.length === 0) return;

    const rutaUpper = usuario.toUpperCase();

    const datos = clientesRuta.map((c) => ({
      Ruta: rutaUpper,
      Código: c.codigo_cliente,
      Cliente: c.nombre_cliente,
      Dirección: c.direccion_entrega,
      "Última visita": c.ultima_visita || "—",
      "Última factura": c.ultima_factura || "—",
      "Consumo Actual": c.consumo_actual,
      "Consumo Máx": c.max_consumo,
      "Cantidad": c.cantidad_botellon,
      "Tuvo Consumo": c.tuvo_consumo,
    }));

    const ws = XLSX.utils.json_to_sheet(datos);
    const wb = XLSX.utils.book_new();

    XLSX.utils.book_append_sheet(wb, ws, "ClientesRuta");
    XLSX.writeFile(
      wb,
      `clientes_ruta_${rutaUpper}_${mes}_${anio}.xlsx`
    );
  };

  // ==========================
  // LOADING
  // ==========================
  if (cargando) {
    return (
      <div className="flex justify-center items-center h-screen bg-[#012E24] text-gray-300">
        <p>Cargando datos de {usuario}...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen text-white p-5">
      {/* HEADER */}
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">
          Detalle de {usuario} — {mes}/{anio}
        </h1>

        <Link
          to="/dashboard/botellon"
          className="px-4 py-2 bg-[#046C5E] rounded-lg hover:bg-[#058A73] transition"
        >
          ← Volver al Dashboard
        </Link>
      </div>

      {/* ===================== RESUMEN CLIENTES ===================== */}
      {resumenClientes && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
          <div className="p-5 bg-[#01382D] rounded-lg shadow-md">
            <h3 className="text-gray-200 text-sm mb-1">Clientes asignados</h3>
            <p className="text-4xl font-bold text-green-400">
              {resumenClientes.totalClientesRuta}
            </p>
          </div>

          <div className="p-5 bg-[#01382D] rounded-lg shadow-md">
            <h3 className="text-gray-200 text-sm mb-1">Clientes con consumo</h3>
            <p className="text-4xl font-bold text-blue-400">
              {resumenClientes.clientesConConsumo}
            </p>
          </div>

          <div className="p-5 bg-[#01382D] rounded-lg shadow-md">
            <h3 className="text-gray-200 text-sm mb-1">Clientes sin consumo</h3>
            <p className="text-4xl font-bold text-red-400">
              {resumenClientes.clientesSinConsumo}
            </p>
          </div>
        </div>
      )}

      {/* ===================== PRODUCTOS VENDIDOS ===================== */}
      <h1 className="text-center text-xl font-bold mb-4">
        PRODUCTOS VENDIDOS
      </h1>

      {productos.length > 0 ? (
        <table className="w-full text-sm border border-[#046C5E] rounded-lg mb-12">
          <thead className="bg-[#014434] text-green-300 uppercase text-xs">
            <tr>
              <th className="px-4 py-3 text-left">Producto</th>
              <th className="px-4 py-3 text-right">Unidades</th>
              <th className="px-4 py-3 text-right">Dólares</th>
            </tr>
          </thead>

          <tbody>
            {productos.map((p, idx) => (
              <tr
                key={idx}
                className={`${idx % 2 === 0 ? "bg-[#013d32]" : "bg-[#014f3e]"} hover:bg-[#026452] transition`}
              >
                <td className="px-4 py-2">{p.descripcion}</td>
                <td className="px-4 py-2 text-right text-green-400 font-semibold">
                  {p.unidades.toLocaleString()}
                </td>
                <td className="px-4 py-2 text-right text-blue-400 font-semibold">
                  ${p.monto.toLocaleString(undefined, {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </td>
              </tr>
            ))}

            {/* TOTAL */}
            <tr className="bg-[#022d24] font-bold">
              <td className="px-4 py-3 text-right uppercase">Total</td>
              <td className="px-4 py-3 text-right text-green-500">
                {productos.reduce((acc, p) => acc + p.unidades, 0).toLocaleString()}
              </td>
              <td className="px-4 py-3 text-right text-blue-500">
                ${productos.reduce((acc, p) => acc + p.monto, 0).toLocaleString(undefined, {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </td>
            </tr>
          </tbody>
        </table>
      ) : (
        <p className="text-center text-gray-400 mt-10">
          No se encontraron productos facturados para esta ruta.
        </p>
      )}

      {/* ===================== CLIENTES ===================== */}
      <div className="min-w-full text-sm border border-[#046C5E] rounded-lg">

        <h1 className="text-center text-xl font-bold mt-10 mb-4">
          CLIENTES DE RUTA
        </h1>

        {/* ACCIONES */}
        <div className="flex flex-col sm:flex-row sm:justify-between gap-4 mb-4">
          <button
            onClick={exportarClientesRuta}
            className="flex items-center gap-2 px-4 py-2 bg-[#046C5E] hover:bg-[#058A73] text-white font-semibold rounded-md shadow-md transition"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5 5m0 0l5-5m-5 5V4" />
            </svg>
            Exportar clientes S/C
          </button>

          <div>
            <label htmlFor="filtroConsumo" className="text-white mr-2">
              Filtrar por consumo Mes_Actual:
            </label>
            <select
              id="filtroConsumo"
              value={filtroConsumo}
              onChange={(e) => setFiltroConsumo(e.target.value)}
              className="px-4 py-2 bg-[#046C5E] text-white font-semibold rounded-md"
            >
              <option value="Todos">Todos</option>
              <option value="Sí">Con Consumo</option>
              <option value="No">Sin Consumo</option>
            </select>
          </div>
        </div>

        {/* BUSCADOR */}
        <div className="flex justify-center mb-4">
          <div className="relative w-full sm:w-3/4 md:w-1/2 lg:w-1/3">
            <input
              type="text"
              placeholder="Buscar por nombre de cliente"
              value={terminoBusqueda}
              onChange={(e) => setTerminoBusqueda(e.target.value)}
              className="w-full px-4 py-2 pl-10 rounded-md bg-[#046C5E] text-white text-sm focus:outline-none focus:ring-2 focus:ring-[#74ab3c]"
            />
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-white"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M18 10a8 8 0 10-8 8 8 8 0 008-8z" />
            </svg>
          </div>
        </div>

        {/* TABLA CLIENTES */}
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm border border-[#046C5E] rounded-lg">
            <thead className="bg-[#014434] text-green-300 uppercase text-xs">
              <tr>
                <th className="px-4 py-3">N°</th>
                {[
                  ["Código", "codigo_cliente"],
                  ["Cliente", "nombre_cliente"],
                  ["Dirección", "direccion_cliente"],
                  ["Tipo Negocio", "tipo_negocio"],

                  ["#Teléfono", "telefono_cliente"],
                  ["Latitud", "latitud_direccion_cliente"],
                  ["Longitud", "longitud_direccion_cliente"],
                  ["Cantidad Actual", "cantidad_botellon"],
                  ["Consumo Actual($)", "consumo_actual"],
                  ["Maximo Consumo($)", "maximo_consumo"],

                  ["VS MES ANT", "vsMesAnterior"],
                  ["Última Visita", "ultima_visita"],
                  ["Última Factura", "ultima_factura"],
                  ["Tuvo Consumo", "tuvo_consumo"],

                ].map(([label, key]) => (
                  <th
                    key={key}
                    onClick={() => requestSort(key)}
                    className="px-4 py-3 cursor-pointer hover:text-white transition-colors select-none"
                  >
                    {label}
                    <span className="text-[#6BAF8E] ml-1">
                      {sortConfig.key === key
                        ? sortConfig.direction === "asc"
                          ? "↑"
                          : "↓"
                        : "↕"}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>

            <tbody>
              {clientesPagina.map((c, idx) => (
                <tr
                  key={idx}
                  className={`${c.tuvo_consumo === "No"
                    ? "bg-red-900/60"
                    : idx % 2 === 0
                      ? "bg-[#013d32]"
                      : "bg-[#014f3e]"
                    } hover:bg-[#026452] transition`}
                >
                  <td className="px-4 py-2">
                    {(paginaActual - 1) * clientesPorPagina + idx + 1}
                  </td>
                  <td className="px-4 py-2">{c.codigo_cliente}</td>
                  <td className="px-4 py-2">{c.nombre_cliente}</td>
                  <td className="px-4 py-2">{c.direccion_cliente}</td>
                  <td className="px-4 py-2 text-white">{c.tipo_negocio}</td>
                  <td className="px-2 py-2">{c.telefono_direccion_cliente || "Sin Número"}</td>
                  <td className="px-2 py-2">{c.latitud_direccion_cliente}</td>
                  <td className="px-4 py-2">{c.longitud_direccion_cliente}</td>
                  <td className="px-4 py-2">{c.cantidad_botellon}</td>
                  <td className="px-2 py-2">{c.consumo_actual}</td>
                  <td className="px-4 py-2">
                    <div className="flex flex-col leading-tight">

                      {/* Monto máximo */}
                      <span className="text-white  text-sm">
                        ${Number(c.max_consumo).toLocaleString("es-EC", {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </span>

                      {/* Mes */}
                      <span className="text-xs text-[#6BAF8E] font-medium">
                        {c.mes_max_consumo_nombre ?? ""}
                      </span>

                    </div>
                  </td>
                  <td className="px-6 py-2">
                    {c.vsMesAnterior ? (
                      <div className="flex flex-col leading-tight">

                        {/* Diferencia en dólares */}
                        <span
                          className={`text-sm font-bold
          ${c.vsMesAnterior.variacion_abs > 0
                              ? "text-green-400"
                              : c.vsMesAnterior.variacion_abs < 0
                                ? "text-red-400"
                                : "text-gray-300"
                            }`}
                        >
                          {c.vsMesAnterior.variacion_abs > 0 && "+"}$
                          {Math.abs(c.vsMesAnterior.variacion_abs).toLocaleString("es-EC", {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}
                        </span>

                        {/* Porcentaje */}
                        <span
                          className={`text-xs font-semibold
          ${c.vsMesAnterior.variacion_abs > 0
                              ? "text-green-300"
                              : c.vsMesAnterior.variacion_abs < 0
                                ? "text-red-300"
                                : "text-gray-400"
                            }`}
                        >
                          (
                          {c.vsMesAnterior.variacion_abs > 0 && "+"}
                          {c.vsMesAnterior.variacion_porc}
                          )
                        </span>

                      </div>
                    ) : (
                      <span className="text-gray-500">—</span>
                    )}
                  </td>

                  <td className="px-0 py-2" style={{ whiteSpace: 'nowrap' }}>
                    {c.ultima_visita || "Sin Fecha"}
                  </td>
                  <td className="px-3 py-2" style={{ whiteSpace: 'nowrap' }}>
                    {c.ultima_factura || "Sin Fecha"}
                  </td>
                  <td
                    className={`px-2 py-2 font-bold ${c.tuvo_consumo === "Sí" ? "text-green-500" : "text-red-500"}`}
                    style={{ whiteSpace: 'nowrap' }}
                  >
                    {c.tuvo_consumo}
                  </td>

                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* PAGINACIÓN */}
        <div className="flex justify-center mt-6 gap-2">
          <button
            disabled={paginaActual === 1}
            onClick={() => setPaginaActual(paginaActual - 1)}
            className={`px-3 py-1 rounded-md flex items-center justify-center ${paginaActual === 1
              ? "bg-gray-700 text-gray-500 cursor-not-allowed"
              : "bg-[#046C5E] hover:bg-[#058A73]"
              }`}
          >
            <span className="sm:hidden">←</span>
            <span className="hidden sm:inline">← Anterior</span>
          </button>

          {(() => {
            const pages = [];
            const maxVisible = 5;

            if (totalPaginas <= maxVisible) {
              for (let i = 1; i <= totalPaginas; i++) pages.push(i);
            } else {
              pages.push(1);
              if (paginaActual > 3) pages.push("...");
              const start = Math.max(2, paginaActual - 1);
              const end = Math.min(totalPaginas - 1, paginaActual + 1);
              for (let i = start; i <= end; i++) pages.push(i);
              if (paginaActual < totalPaginas - 2) pages.push("...");
              pages.push(totalPaginas);
            }

            return pages.map((num: any, idx) =>
              num === "..." ? (
                <span key={`dots-${idx}`} className="px-2 py-1 text-gray-400 select-none">
                  ...
                </span>
              ) : (
                <button
                  key={`page-${idx}-${num}`}
                  onClick={() => setPaginaActual(num)}
                  className={`px-3 py-1 rounded-md ${paginaActual === num
                    ? "bg-green-500 text-black font-bold"
                    : "bg-[#01382D] hover:bg-[#025f4b]"
                    }`}
                >
                  {num}
                </button>
              )
            );
          })()}

          <button
            disabled={paginaActual === totalPaginas}
            onClick={() => setPaginaActual(paginaActual + 1)}
            className={`px-3 py-1 rounded-md flex items-center justify-center ${paginaActual === totalPaginas
              ? "bg-gray-700 text-gray-500 cursor-not-allowed"
              : "bg-[#046C5E] hover:bg-[#058A73]"
              }`}
          >
            <span className="sm:hidden">→</span>
            <span className="hidden sm:inline">Siguiente →</span>
          </button>
        </div>
      </div>
    </div>
  );


};

export default DetalleBotellonPage;
