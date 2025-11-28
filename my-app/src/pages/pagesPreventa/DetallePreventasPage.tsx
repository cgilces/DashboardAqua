import React, { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";

const DetallePreventasPage: React.FC = () => {
  const { ruta, anio, mes } = useParams();

  const [productos, setProductos] = useState<any[]>([]);
  const [resumenClientes, setResumenClientes] = useState<any>(null);
  const [clientesSinConsumo, setClientesSinConsumo] = useState<any[]>([]);
  const [cargando, setCargando] = useState(false);

  // 📌 PAGINACIÓN
  const [paginaActual, setPaginaActual] = useState(1);
  const clientesPorPagina = 10;

  if (!ruta || !anio || !mes) {
    return (
      <div className="text-white p-10">
        <h1>Parámetros inválidos en la ruta</h1>
      </div>
    );
  }

  useEffect(() => {
    setCargando(true);

    fetch(`http://localhost:5000/api/ventas/detalle-ruta/${ruta}/${anio}/${mes}`)
      .then((res) => res.json())
      .then((data) => {
        console.log("Datos FULL recibidos:", data);

        // PRODUCTOS
        const productosMapeados = (data.productosVendidos || []).map((p: any) => ({
          descripcion: p.producto,
          unidades: Number(p.unidades_vendidas),
          monto: Number(p.monto_usd),
        }));

        setProductos(productosMapeados);

        // RESUMEN CLIENTES
        setResumenClientes(data.resumenClientes);

        // CLIENTES SIN CONSUMO
        setClientesSinConsumo(data.listaClientesSinConsumo || []);
      })
      .finally(() => setCargando(false));
  }, [ruta, anio, mes]);


  // 📌 Cálculo de clientes paginados
  const indiceUltimo = paginaActual * clientesPorPagina;
  const indicePrimero = indiceUltimo - clientesPorPagina;
  const clientesPagina = clientesSinConsumo.slice(indicePrimero, indiceUltimo);

  const totalPaginas = Math.ceil(clientesSinConsumo.length / clientesPorPagina);

  if (cargando) {
    return (
      <div className="flex flex-col justify-center items-center h-screen bg-[#012E24] text-gray-300">
        <div className="w-10 h-10 border-4 border-t-[#74ab3c] border-gray-700 rounded-full animate-spin mb-4"></div>
        <p>Cargando datos de {ruta}...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#012E24] text-white p-8">

      {/* HEADER */}
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">
          Detalle de {ruta} — {mes}/{anio}
        </h1>

        <Link
          to="/"
          className="px-4 py-2 bg-[#046C5E] rounded-lg hover:bg-[#058A73] transition"
        >
          ← Volver al Dashboard
        </Link>
      </div>

      {/* RESUMEN CLIENTES */}
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
              <tr
                key={idx}
                className={`${idx % 2 === 0 ? "bg-[#013d32]" : "bg-[#014f3e]"
                  } hover:bg-[#026452] transition`}
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
          </tbody>
        </table>
      ) : (
        <p className="text-center text-gray-400 mt-10">
          No se encontraron productos facturados para esta ruta.
        </p>
      )}

      {/* CLIENTES SIN CONSUMO */}
      <h1 className="text-center text-xl font-bold mt-10 mb-4">CLIENTES SIN CONSUMO</h1>

      {clientesPagina.length > 0 ? (
        <>
          <table className="min-w-full text-sm border border-[#046C5E] rounded-lg">
            <thead className="bg-[#014434] text-red-300 uppercase text-xs">
              <tr>
                <th className="px-4 py-3 text-left">Código</th>
                <th className="px-4 py-3 text-left">Cliente</th>
                <th className="px-4 py-3 text-left">Dirección</th>
                <th className="px-4 py-3 text-left">ultima visita</th>
                <th className="px-4 py-3 text-left">ultima factura</th>

              </tr>
            </thead>


            <tbody>
              {clientesPagina.map((c, idx) => (
                <tr
                  key={idx}
                  className={`${idx % 2 === 0 ? "bg-[#3a0f00]" : "bg-[#5c1800]"
                    } hover:bg-[#8a2400] transition`}
                >
                  <td className="px-4 py-2">{c.codigo_cliente}</td>
                  <td className="px-4 py-2">{c.nombre_cliente}</td>
                  <td className="px-4 py-2">{c.direccion_entrega}</td>

                  {/* 🔹 NUEVO: mostrar última visita */}
                  <td className="px-4 py-2 text-green-300 font-bold">
                    {c.ultima_visita ?? "—"}
                  </td>

                  {/* 🔹 NUEVO: mostrar última factura */}
                  <td className="px-4 py-2 text-blue-300 font-bold">
                    {c.ultima_factura ?? "—"}
                  </td>

                </tr>
              ))}
            </tbody>





          </table>

          {/* PAGINACIÓN */}
          <div className="flex justify-center mt-6 gap-2">

            {/* Botón Anterior */}
            <button
              disabled={paginaActual === 1}
              onClick={() => setPaginaActual(paginaActual - 1)}
              className={`px-3 py-1 rounded-md ${paginaActual === 1
                ? "bg-gray-700 text-gray-500 cursor-not-allowed"
                : "bg-[#046C5E] hover:bg-[#058A73]"
                }`}
            >
              ← Anterior
            </button>

            {/* Números */}
            {Array.from({ length: totalPaginas }, (_, i) => i + 1).map((num) => (
              <button
                key={num}
                onClick={() => setPaginaActual(num)}
                className={`px-3 py-1 rounded-md ${paginaActual === num
                  ? "bg-green-500 text-black font-bold"
                  : "bg-[#01382D] hover:bg-[#025f4b]"
                  }`}
              >
                {num}
              </button>
            ))}

            {/* Botón Siguiente */}
            <button
              disabled={paginaActual === totalPaginas}
              onClick={() => setPaginaActual(paginaActual + 1)}
              className={`px-3 py-1 rounded-md ${paginaActual === totalPaginas
                ? "bg-gray-700 text-gray-500 cursor-not-allowed"
                : "bg-[#046C5E] hover:bg-[#058A73]"
                }`}
            >
              Siguiente →
            </button>
          </div>
        </>
      ) : (
        <p className="text-center text-gray-400 mt-10">
          Todos los clientes realizaron compras 🎉
        </p>
      )}
    </div>
  );
};

export default DetallePreventasPage;
