import React, { useEffect, useState, useMemo } from "react";

import { useParams, Link } from "react-router-dom";
import * as XLSX from "xlsx";
// import { API_URL } from "../../config/api";


const DetalleHieloPage: React.FC = () => {
  const { ruta, anio, mes } = useParams();
  const [productos, setProductos] = useState<any[]>([]);
  const [resumenClientes, setResumenClientes] = useState<any>(null);
  // const [clientesSinConsumo, setClientesSinConsumo] = useState<any[]>([]);
  const [cargando, setCargando] = useState(false);
  const [filtroConsumo, setFiltroConsumo] = useState("Todos"); // 'Todos', 'Sí', 'No'
  const [clientesRuta, setClientesRuta] = useState<any[]>([]);  // Clientes asignados a la ruta
  const [terminoBusqueda, setTerminoBusqueda] = useState(""); // Estado para el término de búsqueda


  // PAGINACIÓN
  const [paginaActual, setPaginaActual] = useState(1);
  const clientesPorPagina = 60;


  useEffect(() => {
    setPaginaActual(1);
  }, [filtroConsumo, terminoBusqueda]);


  const clientesFiltrados = clientesRuta.filter((cliente) =>
    // cliente.nombre_cliente.toLowerCase().includes(terminoBusqueda.toLowerCase())
    (cliente.nombre_cliente ?? "").toLowerCase().includes(terminoBusqueda.toLowerCase())

  );

  // Ordenación
  const [sortConfig, setSortConfig] = useState({
    key: "codigo_cliente",
    direction: "asc"
  });
  /* =======================
     VALIDACIÓN RUTA
  ======================= */
  if (!ruta || !anio || !mes) {
    return (
      <div className="text-white p-10">
        <h1>Parámetros inválidos en la ruta</h1>
      </div>
    );
  }

  // Función para ordenar las columnas
  const requestSort = (key: string) => {
    setPaginaActual(1);

    setSortConfig((prev) => {
      let direction: "asc" | "desc" = "asc";  // Por defecto, orden ascendente

      // Si la columna ya está ordenada y la dirección es ascendente, alternamos a descendente
      if (prev.key === key && prev.direction === "asc") {
        direction = "desc";
      }

      return { key, direction };  // Actualizamos la clave y la dirección
    });
  };

  const clientesOrdenados = useMemo(() => {
    const sorted = [...clientesFiltrados];  // Copiar los datos filtrados para no mutar el estado original

    sorted.sort((a, b) => {
      let aValue = a[sortConfig.key];
      let bValue = b[sortConfig.key];




      // Acceder a 'variacion_abs' de 'vsMesAnterior'
      // const aVariacionAbs = a.vsMesAnterior ? parseFloat(a.vsMesAnterior.variacion_abs) : 0;
      // const bVariacionAbs = b.vsMesAnterior ? parseFloat(b.vsMesAnterior.variacion_abs) : 0;
      // // Comparar por la propiedad 'variacion_abs'
      // if (sortConfig.direction === "desc") {
      //   return aVariacionAbs - bVariacionAbs;  // Orden ascendente
      // } else {
      //   return bVariacionAbs - aVariacionAbs;  // Orden descendente
      // }




      // Si estamos ordenando por "Consumo Actual", calcular la diferencia
      if (sortConfig.key === "consumo_actual") {
        const aConsumoActual = a.consumo_actual || 0;
        const bConsumoActual = b.consumo_actual || 0;
        const aConsumoAnterior = a.consumo_mes_anterior || 0;  // Suponiendo que el campo de consumo del mes anterior se llama 'consumo_mes_anterior'
        const bConsumoAnterior = b.consumo_mes_anterior || 0;

        // Calculamos la diferencia
        aValue = aConsumoActual - aConsumoAnterior;
        bValue = bConsumoActual - bConsumoAnterior;
      }

      // Ordenación de valores numéricos generales
      if (typeof aValue === "number" && typeof bValue === "number") {
        return sortConfig.direction === "asc" ? aValue - bValue : bValue - aValue;
      }

      // Ordenación de valores alfabéticos (por si se ordenan otros campos)
      if (typeof aValue === "string" && typeof bValue === "string") {
        return sortConfig.direction === "asc"
          ? aValue.localeCompare(bValue)
          : bValue.localeCompare(aValue);
      }

      const aLatitud = parseFloat(a.latitud_cliente);  // Convertir latitud a número
      const bLatitud = parseFloat(b.latitud_cliente);  // Convertir latitud a número

      // Ordenar por latitud
      if (sortConfig.direction === "asc") {
        return aLatitud - bLatitud;  // Orden ascendente
      } else {
        return bLatitud - aLatitud;  // Orden descendente
      }

      return 0;  // Si no es comparable, no ordenamos



    });

    return sorted;  // Retornamos el array ordenado
  }, [clientesFiltrados, sortConfig]);  // Dependencias: se vuelve a ejecutar cuando 'clientesFiltrados' o 'sortConfig' cambian



  useEffect(() => {
    setCargando(true);

    fetch(
      `http://localhost:5000/api/hielo/detalle-hielo/${ruta}/${anio}/${mes}`
      // `${API_URL}/api/hielo/detalle-hielo/${ruta}/${anio}/${mes}`

    )


      .then((res) => res.json())
      .then((data) => {
        console.log("Datos FULL recibidos hielo:", data);

        // FILTRAR CLIENTES SEGÚN EL FILTRO SELECCIONADO
        let clientesFiltrados = data.clientesRuta || []; // clientesRuta con todos los clientes

        if (filtroConsumo !== "Todos") {
          clientesFiltrados = clientesFiltrados.filter(
            (cliente: { tuvo_consumo: string }) => cliente.tuvo_consumo === filtroConsumo
          ); // Filtrar por "Sí" o "No"
        }

        setClientesRuta(clientesFiltrados); // Actualizamos el estado de clientesRuta con los clientes filtrados

        // PRODUCTOS
        const productosMapeados = (data.productosVendidos || []).map((p: any) => ({
          descripcion: p.producto,
          unidades: Number(p.unidades_vendidas),
          monto: Number(p.monto_usd),
        }));

        setProductos(productosMapeados);

        // RESUMEN CLIENTES
        setResumenClientes(data.resumenClientes);
      })
      .finally(() => setCargando(false));
  }, [ruta, anio, mes, filtroConsumo]); // Dependencia de filtroConsumo para actualizar la lista cuando cambie el filtro

  // 📌 Cálculo de clientes paginados
  const indiceUltimo = paginaActual * clientesPorPagina;
  const indicePrimero = indiceUltimo - clientesPorPagina;

  // Aquí usamos clientesFiltrados para la paginación
  const clientesPagina = clientesOrdenados.slice(indicePrimero, indiceUltimo);

  const totalPaginas = Math.ceil(clientesOrdenados.length / clientesPorPagina);

  if (cargando) {
    return (
      <div className="flex flex-col justify-center items-center h-screen bg-[#012E24] text-gray-300">
        <div className="w-10 h-10 border-4 border-t-[#74ab3c] border-gray-700 rounded-full animate-spin mb-4"></div>
        <p>Cargando datos de {ruta}...</p>
      </div>
    );
  }




  type ClienteExportExcel = {
    Ruta: string;
    Código: any;
    Cliente: any;
    Dirección: any;
    "Teléfono": any;
    tipo_negocio: any;

    "Última visita": any;
    "Última factura": any;
    "Consumo Actual": any;
    Cantidad: any;
    "Tuvo Consumo": any;
    "Latitud": any;
    "Longitud": any;
    "VS Mes Anterior ($)": any;
    "VS Mes Anterior (%)": any;
  };



  const exportarClientesRuta = () => {
    if (!clientesRuta || clientesRuta.length === 0) return;

    try {
      const rutaUpper = (ruta || "").toUpperCase();

      const datosExportar: ClienteExportExcel[] = clientesRuta.map((c) => ({
        Ruta: rutaUpper,
        Código: c.codigo_cliente,
        Cliente: c.nombre_cliente,
        Dirección: c.direccion_entrega,
        tipo_negocio: c.tipo_negocio || "—", // Tipo de negocio (vacío si no tiene)
        "Teléfono": c.telefono_cliente || "—", // Teléfono (vacío si no tiene)
        "Consumo_Actual($)": c.consumo_actual,
        Cantidad: c.cantidad_productos,
        "Tuvo Consumo": c.tuvo_consumo,
        "Latitud": c.latitud_cliente || "—", // Latitud (vacío si no tiene)
        "Longitud": c.longitud_cliente || "—", // Longitud (vacío si no tiene)
        "Última visita": c.ultima_visita || "—",
        "Última factura": c.ultima_factura || "—",
        "VS Mes Anterior ($)": c.vsMesAnterior ? `$${Math.abs(c.vsMesAnterior.variacion_abs).toFixed(2)}` : "—", // VS Mes Anterior (diferencia absoluta)
        "VS Mes Anterior (%)": c.vsMesAnterior ? `${c.vsMesAnterior.variacion_porc}%` : "—", // Variación porcentual
      }));

      // Crear hoja de Excel
      const ws = XLSX.utils.json_to_sheet(datosExportar);

      // Agregar título en A1
      const titulo = [`CLIENTES DE RUTA - ${rutaUpper} - ${mes}/${anio}`];
      XLSX.utils.sheet_add_aoa(ws, [titulo], { origin: "A1" });

      // Auto-ajustar el ancho de las columnas
      const columnas = Object.keys(datosExportar[0]) as (keyof ClienteExportExcel)[];

      ws["!cols"] = columnas.map((col) => {
        const maxLong = Math.max(
          col.length,
          ...datosExportar.map((row) => String(row[col]).length)
        );
        return { wch: maxLong + 4 }; // +4 para margen visual
      });

      // Crear libro de trabajo
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "ClientesRuta");

      const nombreArchivo = `clientes_ruta_${rutaUpper}_${mes}_${anio}.xlsx`;
      XLSX.writeFile(wb, nombreArchivo, { compression: true });
    } catch (error) {
      // console.error("❌ Error exportando Excel:", error);
    }
  };



  return (
    <div className="min-h-screen text-white p-8">
      {/* HEADER */}
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">
          Detalle de {ruta} — {mes}/{anio}
        </h1>

        <Link to="/dashboard/hielo" className="px-4 py-2 bg-[#046C5E] rounded-lg hover:bg-[#058A73] transition">
          ← Volver al Dashboard
        </Link>
      </div>

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

      {/* tabla PRODUCTOS VENDIDOS */}
      <h1 className="text-center text-xl font-bold mb-4">PRODUCTOS VENDIDOS</h1>

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

            {/* 🔹 FILA TOTAL */}
            <tr className="bg-[#022d24] border-[#74ab3c] font-bold">
              <td className="px-4 py-3 text-right text-white uppercase">Total</td>
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
        <p className="text-center text-gray-400 mt-10">No se encontraron productos facturados para esta ruta.</p>
      )}

      {/* tabla CLIENTES */}

      <div className="overflow-x-auto scrollbar-hide">

        <div className="min-w-full text-sm border border-[#046C5E] rounded-lg">
          <h1 className="text-center text-xl font-bold mt-10 mb-4">CLIENTES DE RUTA</h1>
          {clientesRuta.length > 0 ? (
            <>
              <div className="mb-6">
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
                      className="w-full px-4 py-2 pl-10 rounded-md bg-[#046C5E] text-white text-sm
                       focus:outline-none focus:ring-2 focus:ring-[#74ab3c]"
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

                {/* TABLA */}
                <table className="min-w-full text-sm border border-[#046C5E] rounded-lg">
                  <thead className="bg-[#014434] text-green-300 uppercase text-xs">
                    <tr>
                      <th className="px-4 py-3 text-left">N°</th>
                      {[
                        ["Código", "codigo_cliente"],
                        ["Cliente", "nombre_cliente"],
                        ["Dirección", "direccion_entrega"],
                        ["Tipo Negocio", "tipo_negocio"],

                        ["#Teléfono", "telefono_direccion_cliente"],
                        ["Latitud", "latitud_direccion_cliente"],
                        ["Longitud", "longitud_direccion_cliente"],

                        ["Cantidad Actual", "cantidad_productos"],
                        ["Consumo Actual($)", "consumo_actual"],
                        ["Maximo Consumo($)", "maximo_consumo"],

                        ["VS MES ANT", "porcentaje_cambio"],
                        ["Última visita", "ultima_visita"],
                        ["Última factura", "ultima_factura"],
                        ["Tuvo consumo", "tuvo_consumo"],
                      ].map(([label, key]) => (
                        <th
                          key={key}
                          className="px-4 py-3 text-left cursor-pointer"
                          onClick={() => requestSort(key)}
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
                          ? "bg-[rgba(220,38,38,0.6)]"
                          : idx % 2 === 0
                            ? "bg-[#013d32]"
                            : "bg-[#014f3e]"
                          } hover:bg-[#026452] transition`}
                      >
                        {/* N° */}
                        <td className="px-4 py-2 text-white font-semibold">
                          {(paginaActual - 1) * clientesPorPagina + idx + 1}
                        </td>

                        <td className="px-4 py-2 text-white">{c.codigo_cliente}</td>
                        <td className="px-4 py-2 text-white">{c.nombre_cliente}</td>
                        <td className="px-4 py-2 text-white">{c.direccion_entrega}</td>
                        <td className="px-4 py-2 text-white">{c.tipo_negocio}</td>


                        <td className="px-4 py-2 text-white">{c.telefono_cliente || "Sin Número"}</td>

                        <td className="px-4 py-2 text-white">{c.latitud_cliente}</td>
                        <td className="px-4 py-2 text-white">{c.longitud_cliente}</td>
                        <td className="px-4 py-2 text-white">{c.cantidad_productos}</td>
                        <td className="px-4 py-2 text-white">${c.consumo_actual}</td>

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



                        <td className="px-6 py-4">
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


                        <td className="px-4 py-2 text-[#6BAF8E] font-semibold whitespace-nowrap">
                          {c.ultima_visita ?? "—"}
                        </td>
                        <td className="px-4 py-2 text-[#6BAF8E] font-semibold whitespace-nowrap">
                          {c.ultima_factura ?? "—"}
                        </td>

                        <td
                          className={`px-4 py-2 font-bold ${c.tuvo_consumo === "Sí" ? "text-green-500" : "text-red-500"}`}
                        >
                          {c.tuvo_consumo}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {/* PAGINACIÓN (se mantiene igual) */}
              <div className="flex justify-center mt-6 gap-2">
                <button
                  disabled={paginaActual === 1}
                  onClick={() => setPaginaActual(paginaActual - 1)}
                  className={`px-3 py-1 rounded-md flex items-center justify-center ${paginaActual === 1
                    ? "bg-gray-700 text-gray-500 cursor-not-allowed"
                    : "bg-[#046C5E] hover:bg-[#058A73]"} `}
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
                      <span key={`dots-${idx}`} className="px-2 py-1 text-gray-400 select-none">...</span>
                    ) : (
                      <button
                        key={`page-${idx}-${num}`}
                        onClick={() => setPaginaActual(num)}
                        className={`px-3 py-1 rounded-md ${paginaActual === num
                          ? "bg-green-500 text-black font-bold"
                          : "bg-[#01382D] hover:bg-[#025f4b]"} `}
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
                    : "bg-[#046C5E] hover:bg-[#058A73]"} `}
                >
                  <span className="sm:hidden">→</span>
                  <span className="hidden sm:inline">Siguiente →</span>
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

export default DetalleHieloPage;
