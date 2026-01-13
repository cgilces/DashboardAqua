import { useEffect, useMemo, useState } from "react";

/* ============================
   TIPOS
============================ */
interface ClienteRuta {
  ruta_asignada: string;
  codigo_cliente: string;
  nombre_cliente: string;
  direccion_entrega: string;
  max_consumo: number;
  total_botellones: number;
  consumo_actual: number;
  porcentaje_cambio: number;
  ultima_visita?: string;
  ultima_factura?: string;
  tuvo_consumo: "Sí" | "No";
}

interface Props {
  clientesRuta: ClienteRuta[];

  terminoBusqueda: string;
  setTerminoBusqueda: (v: string) => void;

  filtroConsumo: string;
  setFiltroConsumo: (v: string) => void;

  exportarClientesRuta: () => void;

  sortConfig: {
    key: keyof ClienteRuta;
    direction: "asc" | "desc";
  };
  requestSort: (key: keyof ClienteRuta) => void;

  paginaActual: number;
  setPaginaActual: (v: number) => void;
}

const FILAS_POR_PAGINA = 10;

export default function TablaClientesBotellon({
  clientesRuta,
  terminoBusqueda,
  setTerminoBusqueda,
  filtroConsumo,
  setFiltroConsumo,
  exportarClientesRuta,
  sortConfig,
  requestSort,
  paginaActual,
  setPaginaActual,
}: Props) {

  /* ============================
     FILTRO POR RUTA
  ============================ */
  const [rutaSeleccionada, setRutaSeleccionada] = useState("Todas");

  const rutasDisponibles = useMemo(() => {
    return Array.from(
      new Set(clientesRuta.map(c => c.ruta_asignada).filter(Boolean))
    ).sort();
  }, [clientesRuta]);

  useEffect(() => {
    setRutaSeleccionada("Todas");
    setPaginaActual(1);
  }, [clientesRuta, setPaginaActual]);

  /* ============================
     FILTRO + ORDEN
  ============================ */
  const clientesFiltrados = useMemo(() => {
    let data = [...clientesRuta];

    // 🔹 Ruta
    if (rutaSeleccionada !== "Todas") {
      data = data.filter(c => c.ruta_asignada === rutaSeleccionada);
    }

    // 🔹 Búsqueda
    if (terminoBusqueda) {
      data = data.filter(c =>
        c.nombre_cliente
          .toLowerCase()
          .includes(terminoBusqueda.toLowerCase())
      );
    }

    // 🔹 Consumo
    if (filtroConsumo !== "Todos") {
      data = data.filter(c => c.tuvo_consumo === filtroConsumo);
    }

    // 🔹 Orden
    data.sort((a, b) => {
      const aVal = a[sortConfig.key];
      const bVal = b[sortConfig.key];

      if (typeof aVal === "string" && typeof bVal === "string") {
        return sortConfig.direction === "asc"
          ? aVal.localeCompare(bVal)
          : bVal.localeCompare(aVal);
      }

      return sortConfig.direction === "asc"
        ? Number(aVal) - Number(bVal)
        : Number(bVal) - Number(aVal);
    });

    return data;
  }, [
    clientesRuta,
    rutaSeleccionada,
    terminoBusqueda,
    filtroConsumo,
    sortConfig,
  ]);

  /* ============================
     PAGINACIÓN REAL
  ============================ */
  const totalPaginas = Math.ceil(clientesFiltrados.length / FILAS_POR_PAGINA);

  const clientesPagina = useMemo(() => {
    const inicio = (paginaActual - 1) * FILAS_POR_PAGINA;
    return clientesFiltrados.slice(inicio, inicio + FILAS_POR_PAGINA);
  }, [clientesFiltrados, paginaActual]);

  /* ============================
     RENDER
  ============================ */
  return (
    <div className="min-w-full text-sm border border-[#046C5E] rounded-lg">

      <h1 className="text-center text-xl font-bold mt-10 mb-4">
        LISTADO DE CLIENTES
      </h1>

      {clientesRuta.length > 0 ? (
        <>
          {/* ===== ACCIONES ===== */}
          <div className="flex flex-wrap gap-4 px-4 mb-4 justify-between">
            <button
              onClick={exportarClientesRuta}
              className="px-4 py-2 bg-[#046C5E] hover:bg-[#058A73] text-white rounded-md"
            >
              Exportar clientes S/C
            </button>

            <div className="flex gap-4">
              <select
                value={filtroConsumo}
                onChange={e => setFiltroConsumo(e.target.value)}
                className="px-4 py-2 bg-[#046C5E] text-white rounded-md"
              >
                <option value="Todos">Todos</option>
                <option value="Sí">Con Consumo</option>
                <option value="No">Sin Consumo</option>
              </select>

              <select
                value={rutaSeleccionada}
                onChange={e => setRutaSeleccionada(e.target.value)}
                className="px-4 py-2 bg-[#046C5E] text-white rounded-md"
              >
                <option value="Todas">Todas</option>
                {rutasDisponibles.map(r => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
            </div>
          </div>

          {/* ===== BUSCADOR ===== */}
          <div className="flex justify-center mb-4 px-4">
            <input
              value={terminoBusqueda}
              onChange={e => setTerminoBusqueda(e.target.value)}
              placeholder="Buscar cliente"
              className="w-1/2 px-4 py-2 rounded-md bg-[#046C5E] text-white"
            />
          </div>

          {/* ===== TABLA ===== */}
          <table className="min-w-full border border-[#046C5E]">
            <thead className="bg-[#003f32] text-[#7de3c8] text-[11px] uppercase sticky top-0 z-10">
              {[
                ["Código", "codigo_cliente"],
                ["Cliente", "nombre_cliente"],
                ["Dirección", "direccion_entrega"],
                ["Ruta", "ruta_asignada"],
                ["Consumo Prime", "max_consumo"],
                ["Cantidad", "total_botellones"],
                ["Consumo Actual", "consumo_actual"],
                ["VS Mes Ant", "porcentaje_cambio"],
                ["Última visita", "ultima_visita"],
                ["Última factura", "ultima_factura"],
                ["Tuvo consumo", "tuvo_consumo"],
              ].map(([label, key]) => {
                const columna = key as keyof ClienteRuta;
                const activa = sortConfig.key === columna;

                return (
                  <th
                    key={key}
                    onClick={() => requestSort(columna)}
                    className="
        px-3 py-2
        text-center
        cursor-pointer
        select-none
        whitespace-nowrap
        border-r border-[#0b5a4a]
        last:border-r-0
      "
                  >
                    <div className="flex flex-col items-center leading-tight">
                      {/* TEXTO */}
                      <span className="font-semibold tracking-wide">
                        {label}
                      </span>

                      {/* FLECHA */}
                      <span className="text-[10px] text-[#7de3c8]">
                        {activa
                          ? sortConfig.direction === "asc"
                            ? "↑"
                            : "↓"
                          : "↕"}
                      </span>
                    </div>
                  </th>
                );
              })}

            </thead>

            <tbody>
              {clientesPagina.map((c, idx) => (
                <tr
                  key={idx}
                  className={`
                    ${c.tuvo_consumo === "No"
                      ? "bg-red-700/50"
                      : idx % 2 === 0
                        ? "bg-[#013d32]"
                        : "bg-[#014f3e]"}
                  `}
                >
                  <td className="px-4 py-2">{c.codigo_cliente}</td>
                  <td className="px-4 py-2">{c.nombre_cliente}</td>
                  <td className="px-4 py-2">{c.direccion_entrega}</td>
                  <td className="px-4 py-2">{c.ruta_asignada}</td>
                  <td className="px-4 py-2">{c.max_consumo}</td>
                  <td className="px-4 py-2">{c.total_botellones}</td>
                  <td className="px-4 py-2">{c.consumo_actual}</td>
                  <td className="px-4 py-2">{c.porcentaje_cambio}</td>
                  <td className="px-4 py-2">{c.ultima_visita ?? "—"}</td>
                  <td className="px-4 py-2">{c.ultima_factura ?? "—"}</td>
                  <td className="px-4 py-2 font-bold">{c.tuvo_consumo}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* ===== PAGINACIÓN ===== */}
          <div className="flex justify-center mt-6 gap-4">
            <button
              disabled={paginaActual === 1}
              onClick={() => setPaginaActual(p => p - 1)}
            >
              ←
            </button>
            <span>
              Página {paginaActual} de {totalPaginas}
            </span>
            <button
              disabled={paginaActual === totalPaginas}
              onClick={() => setPaginaActual(p => p + 1)}
            >
              →
            </button>
          </div>
        </>
      ) : (
        <p className="text-center text-gray-400 mt-10">
          No existen clientes para este grupo
        </p>
      )}
    </div>
  );
}
