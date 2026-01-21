import React, { useEffect, useState } from "react";
import { useParams, useSearchParams, Link } from "react-router-dom";
import * as XLSX from "xlsx";

const DetalleBotellonPage: React.FC = () => {
  // ==========================
  // PARAMETROS CORRECTOS
  // ==========================
  const { ruta } = useParams<{ ruta: string }>();
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
  if (!ruta || !anio || !mes) {
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
      const aVal = a[key];
      const bVal = b[key];

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
      `http://localhost:5000/api/botellones/detalle-botellones/${ruta}/${anio}/${mes}`
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
  }, [ruta, anio, mes, filtroConsumo]);

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

    const rutaUpper = ruta.toUpperCase();

    const datos = clientesRuta.map((c) => ({
      Ruta: rutaUpper,
      Código: c.codigo_cliente,
      Cliente: c.nombre_cliente,
      Dirección: c.direccion_entrega,
      "Última visita": c.ultima_visita || "—",
      "Última factura": c.ultima_factura || "—",
      "Consumo Actual": c.consumo_actual,
      "Consumo Máx": c.max_consumo,
      "Cantidad": c.cantidad_productos,
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
        <p>Cargando datos de {ruta}...</p>
      </div>
    );
  }

  // ==========================
  // RENDER
  // ==========================
  return (
    <div className="min-h-screen bg-[#012E24] text-white p-8">
      {/* HEADER */}
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">
          Detalle de {ruta} — {mes}/{anio}
        </h1>

        <Link
          to="/dashboard/botellon"
          className="px-4 py-2 bg-[#046C5E] rounded-lg hover:bg-[#058A73]"
        >
          ← Volver
        </Link>
      </div>

      {/* RESUMEN */}
      {resumenClientes && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
          <div className="p-5 bg-[#01382D] rounded-lg">
            <p>Clientes asignados</p>
            <p className="text-3xl font-bold text-green-400">
              {resumenClientes.totalClientesRuta}
            </p>
          </div>

          <div className="p-5 bg-[#01382D] rounded-lg">
            <p>Con consumo</p>
            <p className="text-3xl font-bold text-blue-400">
              {resumenClientes.clientesConConsumo}
            </p>
          </div>

          <div className="p-5 bg-[#01382D] rounded-lg">
            <p>Sin consumo</p>
            <p className="text-3xl font-bold text-red-400">
              {resumenClientes.clientesSinConsumo}
            </p>
          </div>
        </div>
      )}

      {/* CLIENTES */}
      <h2 className="text-xl font-bold mb-4">Clientes de Ruta</h2>

      <input
        value={terminoBusqueda}
        onChange={(e) => setTerminoBusqueda(e.target.value)}
        placeholder="Buscar cliente"
        className="mb-4 px-4 py-2 bg-[#046C5E] rounded-md w-full md:w-1/3"
      />

      <table className="min-w-full text-sm border border-[#046C5E]">
        <thead className="bg-[#014434]">
          <tr>
            {[
              ["Código", "codigo_cliente"],
              ["Cliente", "nombre_cliente"],
              ["Dirección", "direccion_entrega"],
              ["Consumo", "consumo_actual"],
              ["Tuvo", "tuvo_consumo"],
            ].map(([label, key]) => (
              <th
                key={key}
                onClick={() => requestSort(key)}
                className="px-4 py-3 cursor-pointer"
              >
                {label}
              </th>
            ))}
          </tr>
        </thead>

        <tbody>
          {clientesPagina.map((c, idx) => (
            <tr
              key={idx}
              className={`${
                c.tuvo_consumo === "No"
                  ? "bg-red-900/60"
                  : idx % 2 === 0
                  ? "bg-[#013d32]"
                  : "bg-[#014f3e]"
              }`}
            >
              <td className="px-4 py-2">{c.codigo_cliente}</td>
              <td className="px-4 py-2">{c.nombre_cliente}</td>
              <td className="px-4 py-2">{c.direccion_entrega}</td>
              <td className="px-4 py-2">{c.consumo_actual}</td>
              <td className="px-4 py-2 font-bold">{c.tuvo_consumo}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* PAGINACIÓN */}
      <div className="flex justify-center gap-2 mt-6">
        <button
          disabled={paginaActual === 1}
          onClick={() => setPaginaActual(paginaActual - 1)}
        >
          ←
        </button>

        <span>
          Página {paginaActual} / {totalPaginas}
        </span>

        <button
          disabled={paginaActual === totalPaginas}
          onClick={() => setPaginaActual(paginaActual + 1)}
        >
          →
        </button>
      </div>

      <div className="mt-6">
        <button
          onClick={exportarClientesRuta}
          className="px-4 py-2 bg-[#046C5E] rounded-lg"
        >
          Exportar Excel
        </button>
      </div>
    </div>
  );
};

export default DetalleBotellonPage;
