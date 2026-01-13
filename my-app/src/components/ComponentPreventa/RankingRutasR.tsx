import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import * as XLSX from "xlsx"; // Importar la librería XLSX para generar archivos Excel
import { useAuth } from "../../components/auth/AuthContext"; // Importa el hook useAuth

const RankingRutasR = ({
  data,
  anio,
  mes
}: {
  data: any[];
  anio: string;
  mes: string;
}) => {
  const navigate = useNavigate();
  // Obtener el rol del usuario desde el contexto
  const { user } = useAuth();  // Accede al usuario desde el contexto de autenticación
  const isVendedor = user?.role === "VENDEDOR";  // Compara el rol con "Vendedor"
  const isAdmin = user?.role === "ADMIN";  // Compara el rol con "Admin"

  const [sortConfig, setSortConfig] = useState({ key: 'N*', direction: 'asc' });
  const [sortedData, setSortedData] = useState(data);  // Datos ordenados

  if (!data || data.length === 0) {
    return <p className="text-gray-400 text-center">No hay datos para mostrar.</p>;
  }

  // ============================
  // 🔢 CALCULO DE TOTALES
  // ============================
  const totalUnidades = sortedData.reduce((acc, r) => acc + Number(r.unidades || 0), 0);
  const totalUSD = sortedData.reduce((acc, r) => acc + Number(r.dolares || 0), 0);
  const totalMeta = sortedData.reduce((acc, r) => acc + Number(r.meta || 0), 0);
  const totalProyeccion = sortedData.reduce((acc, r) => acc + Number(r.proyeccion || 0), 0);
  const totalVsMesAnterior = sortedData.reduce((acc, r) => acc + (r.vsMesAnterior?.monto_anterior || 0), 0);

  // Función para exportar a Excel
  const exportarTablaExcel = () => {
    if (!sortedData || sortedData.length === 0) return;

    try {
      const rutaUpper = "Ranking Rutas"; // Si deseas agregar alguna otra variable aquí, puedes hacerlo

      // 1️⃣ Formato de los datos a exportar
      const datosExportar = sortedData.map((r, index) => ({
        "N*": index + 1,
        "Usuario": r.usuario, // Cambié `p.preventa` por `r.usuario`
        "Unidades": r.unidades?.toLocaleString() ?? "0",
        "Dólares": (r.dolares?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) ?? "0.00"),
        "Meta": (r.meta?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) ?? "0.00"),
        "Proyección": (r.proyeccion?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) ?? "0.00"),
        "Vs Mes Anterior": (r.vsMesAnterior?.monto_anterior?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) ?? "Sin datos"),
      }));

      // 2️⃣ Crear hoja de trabajo
      const ws = XLSX.utils.json_to_sheet(datosExportar);

      // 3️⃣ Agregar título en A1
      const titulo = [`RANKING RUTAS - ${rutaUpper} - ${mes}/${anio}`];
      XLSX.utils.sheet_add_aoa(ws, [titulo], { origin: "A1" });

      // 4️⃣ Agregar la fila de totales
      const filaTotales = {
        "Ranking": "Total",
        "Usuario": "",
        "Unidades": totalUnidades.toLocaleString(),
        "Dólares": totalUSD.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
        "Meta": totalMeta.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
        "Proyección": totalProyeccion.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
        "Vs Mes Anterior": totalVsMesAnterior.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
      };

      // Agregar fila de totales al final de la hoja
      XLSX.utils.sheet_add_json(ws, [filaTotales], { skipHeader: true, origin: -1 });

      // 5️⃣ Auto-ajustar el ancho de las columnas
      const columnas = Object.keys(datosExportar[0]);
      ws['!cols'] = columnas.map((col: any) => {
        const maxLong = Math.max(
          col.length,
          ...datosExportar.map((row) => String(row[col]).length)
        );
        return { wch: maxLong + 4 }; // +4 para margen visual
      });

      // 6️⃣ Crear el libro de trabajo Excel
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "RankingRutas");

      const nombreArchivo = `ranking_rutas_${rutaUpper}_${mes}_${anio}.xlsx`;
      XLSX.writeFile(wb, nombreArchivo, { compression: true });

    } catch (error) {
      console.error("❌ Error exportando Excel:", error);
    }
  };

  // Función para ordenar los datos
  const requestSort = (key: any) => {
    let direction = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }

    setSortConfig({ key, direction });

    const sorted = [...data].sort((a, b) => {
      // Obtener el valor a comparar dependiendo de la clave
      const aValue = key === 'vsMesAnterior'
        ? a[key]?.monto_anterior // Acceder al valor dentro del objeto vsMesAnterior
        : a[key]; // En el caso de otras columnas, simplemente usamos el valor

      const bValue = key === 'vsMesAnterior'
        ? b[key]?.monto_anterior // Acceder al valor dentro del objeto vsMesAnterior
        : b[key]; // En el caso de otras columnas, simplemente usamos el valor

      // Comparar los valores
      if (typeof aValue === 'string' && typeof bValue === 'string') {
        return direction === 'asc' ? aValue.localeCompare(bValue) : bValue.localeCompare(aValue);
      }

      if (typeof aValue === 'number' && typeof bValue === 'number') {
        return direction === 'asc' ? aValue - bValue : bValue - aValue;
      }

      return 0;
    });

    setSortedData(sorted);
  };


  return (
    <div className="overflow-x-auto bg-[#012E24] text-white rounded-lg shadow-md border border-[#046C5E] mt-6">
      {/* Botón para exportar tabla a Excel */}
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-bold px-4 py-3 text-blue-300">
          RANKING R - DESCARTABLE
        </h2>

        {/* Mostrar el botón solo si el rol del usuario es "admin" */}
        {isAdmin && (
          <div className="flex gap-4 mb-4"> {/* Flexbox para alinear los botones */}
            <button
              onClick={exportarTablaExcel}
              className="bg-[#0db48b] hover:bg-[#0aa77e] text-black font-semibold px-4 py-2 rounded-lg shadow-md transition flex items-center gap-2"
            >
              <span>📥</span> Exportar
            </button>
          </div>
        )}
      </div>

      <table className="min-w-full text-sm">
        <thead className="bg-[#014434] text-green-300 uppercase text-xs">
          <tr>
            <th
              className="px-4 py-3 text-left cursor-pointer"
              onClick={() => requestSort('N*')}
            >
              N* <span className="text-green-300">{sortConfig.key === 'N*' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : '↕'}</span>
            </th>
            <th
              className="px-4 py-3 text-left cursor-pointer"
              onClick={() => requestSort('usuario')}
            >
              Usuario <span className="text-green-300">{sortConfig.key === 'usuario' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : '↕'}</span>
            </th>
            <th
              className="px-4 py-3 text-right cursor-pointer"
              onClick={() => requestSort('unidades')}
            >
              Unidades <span className="text-green-300">{sortConfig.key === 'unidades' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : '↕'}</span>
            </th>
            <th
              className="px-4 py-3 text-right cursor-pointer"
              onClick={() => requestSort('dolares')}
            >
              Dólares <span className="text-green-300">{sortConfig.key === 'dolares' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : '↕'}</span>
            </th>
            <th
              className="px-4 py-3 text-right cursor-pointer"
              onClick={() => requestSort('meta')}
            >
              Metas <span className="text-green-300">{sortConfig.key === 'meta' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : '↕'}</span>
            </th>
            <th
              className="px-4 py-3 text-right cursor-pointer"
              onClick={() => requestSort('proyeccion')}
            >
              Proyección <span className="text-green-300">{sortConfig.key === 'proyeccion' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : '↕'}</span>
            </th>
            <th
              className="px-4 py-3 text-right cursor-pointer"
              onClick={() => requestSort('vsMesAnterior')}
            >
              Vs Mes Anterior <span className="text-green-300">{sortConfig.key === 'vsMesAnterior' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : '↕'}</span>
            </th>
          </tr>
        </thead>

        <tbody>
          {sortedData.map((r, index) => (
            <tr
              key={index}
              onClick={() =>
                navigate(`/ruta/${r.usuario}?anio=${anio}&mes=${mes}`)
              }
              className={`transition-all duration-200 cursor-pointer
                ${index % 2 === 0 ? "bg-[#013d32]" : "bg-[#014f3e]"}
                hover:bg-[#016a57] hover:shadow-lg hover:text-white
                border-l-4 border-transparent hover:border-green-400
              `}
            >
              <td className="px-4 py-2 font-medium text-gray-100">
                {index + 1}
              </td>

              <td className="px-4 py-2 text-blue-300 font-bold">{r.usuario}</td>

              <td className="px-4 py-2 text-right text-green-400 font-bold">
                {Number(r.unidades).toLocaleString()}
              </td>

              <td className="px-4 py-2 text-right text-blue-300 font-bold">
                ${Number(r.dolares).toLocaleString("es-EC", {
                  minimumFractionDigits: 2
                })}
              </td>

              <td className="px-4 py-2 text-right text-blue-300 font-bold">
                ${Number(r.meta).toLocaleString("es-EC", {
                  minimumFractionDigits: 2
                })}
              </td>

              <td className="px-4 py-2 text-right font-bold">
                {(() => {
                  const meta = Number(r.meta) || 0;
                  const proy = Number(r.proyeccion) || 0;
                  const porcentajeCrecimiento = meta > 0 ? ((proy / meta - 1) * 100) : 0;

                  return (
                    <>
                      <span className={`text-${porcentajeCrecimiento > 0 ? 'green' : 'red'}-400`}>
                        ({porcentajeCrecimiento.toFixed(1)}%)
                      </span>
                      <span className="text-blue-300">
                        ${proy.toLocaleString("es-EC", { minimumFractionDigits: 2 })}
                      </span>
                    </>
                  );
                })()}
              </td>

            <td
  className={`px-4 py-2 text-right font-bold ${
    (r.vsMesAnterior?.variacion_abs ?? 0) >= 0 ? "text-green-400" : "text-red-400"
  }`}
>
  {!r.vsMesAnterior || r.vsMesAnterior.monto_anterior === 0 ? (
    "Sin datos"
  ) : (
    (() => {
      const abs = Number(r.vsMesAnterior.variacion_abs) || 0;
      const porc = r.vsMesAnterior.variacion_porc;
      const signo = abs >= 0 ? "+" : "-";

      return (
        <>
          (
          {porc !== null
            ? `${porc >= 0 ? "+" : "-"}${Math.abs(porc).toFixed(2)}%`
            : "–"}
          )
          {" "}
          {signo}$
          {Math.abs(abs).toLocaleString("es-EC", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })}
        </>
      );
    })()
  )}
</td>


            </tr>
          ))}
        </tbody>

        <tfoot className="bg-[#014434] font-bold text-gray-200 border-t border-[#046C5E]">
          <tr>
            <td className="px-4 py-3 text-left">Total</td>
            <td className="px-4 py-3"></td>
            <td className="px-4 py-3 text-right text-green-400">{totalUnidades.toLocaleString()}</td>
            <td className="px-4 py-3 text-right text-blue-400">
              ${totalUSD.toLocaleString("es-EC", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </td>
            <td className="px-4 py-3 text-right text-blue-400">
              ${totalMeta.toLocaleString("es-EC", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </td>
            <td className="px-4 py-3 text-right text-blue-400">
              ${totalProyeccion.toLocaleString("es-EC", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </td>
            <td className="px-4 py-3 text-right text-blue-400">
              ${totalVsMesAnterior.toLocaleString("es-EC", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
};

export default RankingRutasR;
