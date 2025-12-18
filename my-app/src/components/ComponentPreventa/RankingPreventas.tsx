import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import * as XLSX from "xlsx"; // Importar la librería XLSX para generar archivos Excel
import { useAuth } from "../../components/auth/AuthContext"; // Importa el hook useAuth

// Define la interfaz Props para las propiedades que el componente recibirá
interface Props {
  datos: any; // Si sabes más sobre la estructura de datos, puedes mejorar el tipo
  anio: number | string;
  mes: number | string;
}

const RankingPreventas: React.FC<Props> = ({ datos, anio, mes }) => {
  const navigate = useNavigate();

  // Obtener el rol del usuario desde el contexto
  const { user } = useAuth(); // Accede al usuario desde el contexto de autenticación
  const isVendedor = user?.role === "VENDEDOR"; // Compara el rol con "Vendedor"
  const isAdmin = user?.role === "ADMIN"; // Compara el rol con "Admin"

  const [sortConfig, setSortConfig] = useState({ key: 'N*', direction: 'asc' });
  const [sortedData, setSortedData] = useState(datos.rankingPreventas);

  if (!datos || !datos.rankingPreventas) {
    return (
      <p className="text-center text-gray-400 py-4">
        No hay datos disponibles para mostrar.
      </p>
    );
  }

  const preventas = sortedData;

  // Totales
  const totalUnidades = preventas.reduce(
    (acc: number, p: any) => acc + (p.unidades || 0),
    0
  );

  const totalUSD = preventas.reduce(
    (acc: number, p: any) => acc + (p.monto || 0),
    0
  );

  // Agregar los totales de Meta, Proyección, y Vs Mes Anterior
  const totalMeta = preventas.reduce(
    (acc: number, p: any) => acc + (p.meta || 0),
    0
  );

  const totalProyeccion = preventas.reduce(
    (acc: number, p: any) => acc + (p.proyeccion || 0),
    0
  );

  const totalVsMesAnterior = preventas.reduce(
    (acc: number, p: any) => acc + (p.vsMesAnterior?.monto_anterior || 0),
    0
  );

  // Función para exportar a Excel
  const exportarTablaExcel = () => {
    if (!preventas || preventas.length === 0) return;

    try {
      const rutaUpper = "Ranking Preventa"; // Si deseas agregar alguna otra variable aquí, puedes hacerlo

      // 1️⃣ Formato de los datos a exportar
      const datosExportar = preventas.map((p) => ({
        "N*": preventas.indexOf(p) + 1,
        "Ruta / Preventa": p.preventa,
        "Unidades": p.unidades?.toLocaleString() ?? "0",
        "Dólares": (p.monto?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) ?? "0.00"),
        "Meta": (p.meta?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) ?? "0.00"),
        "Proyección": (p.proyeccion?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) ?? "0.00"),
        "Vs Mes Anterior": (p.vsMesAnterior?.monto_anterior?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) ?? "Sin datos"),
      }));

      // 2️⃣ Crear hoja de trabajo
      const ws = XLSX.utils.json_to_sheet(datosExportar);

      // 3️⃣ Agregar título en A1
      const titulo = [`RANKING PREVENTA - ${rutaUpper} - ${mes}/${anio}`];
      XLSX.utils.sheet_add_aoa(ws, [titulo], { origin: "A1" });

      // 4️⃣ Agregar la fila de totales
      const filaTotales = {
        "Ruta / Preventa": "Total",
        "Ruta ": "",
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
      ws['!cols'] = columnas.map((col) => {
        const maxLong = Math.max(
          col.length,
          ...datosExportar.map((row) => String(row[col]).length)
        );
        return { wch: maxLong + 4 }; // +4 para margen visual
      });

      // 6️⃣ Crear el libro de trabajo Excel
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "RankingPreventas");

      const nombreArchivo = `ranking_preventa_${rutaUpper}_${mes}_${anio}.xlsx`;
      XLSX.writeFile(wb, nombreArchivo, { compression: true });

    } catch (error) {
      console.error("❌ Error exportando Excel:", error);
    }
  };

  // Función para ordenar los datos
  const requestSort = (key) => {
    let direction = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }

    setSortConfig({ key, direction });

    const sorted = [...preventas].sort((a, b) => {
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
    <div className="overflow-x-auto bg-[#012E24] text-white rounded-lg shadow-md border border-[#046C5E]">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-bold px-4 py-3 text-blue-300">RANKING PREVENTA</h2>

        {/* Mostrar el botón solo si el rol del usuario es "admin" */}
        {isAdmin && (
          <div className="flex gap-4 mb-4"> {/* Flexbox para alinear los botones */}
            {/* Botón Configurar Metas */}
            <button
              onClick={() => navigate("/configurar-metas")}
              className="bg-[#0db48b] hover:bg-[#0aa77e] text-black font-semibold px-4 py-2 rounded-lg shadow-md transition flex items-center gap-2"
            >
              <span>⚙️</span> Configurar Metas
            </button>

            {/* Botón para exportar tabla a Excel */}
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
              onClick={() => requestSort('preventa')}
            >
              Ruta / Preventa <span className="text-green-300">{sortConfig.key === 'preventa' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : '↕'}</span>
            </th>
            <th
              className="px-4 py-3 text-right cursor-pointer"
              onClick={() => requestSort('unidades')}
            >
              Unidades <span className="text-green-300">{sortConfig.key === 'unidades' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : '↕'}</span>
            </th>
            <th
              className="px-4 py-3 text-right cursor-pointer"
              onClick={() => requestSort('monto')}
            >
              Dólares <span className="text-green-300">{sortConfig.key === 'monto' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : '↕'}</span>
            </th>
            <th
              className="px-4 py-3 text-right cursor-pointer"
              onClick={() => requestSort('meta')}
            >
              Meta <span className="text-green-300">{sortConfig.key === 'meta' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : '↕'}</span>
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
          {sortedData.map((p, idx) => {
            const meta = Number(p.meta) || 0;
            const proy = Number(p.proyeccion) || 0;

            // ----------- PROYECCIÓN REAL ----------- 
            const porcProy = meta > 0 ? ((proy / meta) * 100).toFixed(1) : "0.0";

            // ----------- VARIACIÓN REAL ----------- 
            const variacionAbs = proy - (p.vsMesAnterior?.monto_anterior || 0); // Variación entre proyección y monto anterior
            const variacionPorc = p.vsMesAnterior?.monto_anterior > 0
              ? ((variacionAbs / p.vsMesAnterior?.monto_anterior) * 100).toFixed(2)
              : "0.00";

            const montoAnterior = p.vsMesAnterior?.monto_anterior ?? 0;

            return (
              <tr
                key={idx}
                onClick={() =>
                  navigate(`/detalle-ruta/${p.preventa}/${anio}/${mes}`)
                }
                className={`cursor-pointer ${idx % 2 === 0 ? "bg-[#013d32]" : "bg-[#014f3e]"}`}
              >
                <td className="px-4 py-2 font-medium text-gray-100">{idx + 1}</td>

                <td className="px-4 py-2 font-medium text-gray-100 underline decoration-dotted hover:text-green-300">
                  {p.preventa}
                </td>

                <td className="px-4 py-2 text-right text-green-400 font-semibold">
                  {p.unidades?.toLocaleString() ?? "0"}
                </td>

                <td className="px-4 py-2 text-right text-blue-400 font-semibold">
                  $ {p.monto?.toLocaleString(undefined, {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  }) ?? "0.00"}
                </td>

                <td className="px-4 py-2 text-right text-blue-400 font-semibold">
                  $ {meta.toLocaleString(undefined, {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </td>

                <td className="px-4 py-2 text-right font-bold">
                  {(() => {
                    const meta = Number(p.meta) || 0;
                    const proy = Number(p.proyeccion) || 0;

                    const porcentajeCrecimiento = meta > 0 ? ((proy / meta - 1) * 100) : 0;

                    return (
                      <>
                        <span className={`text-${porcentajeCrecimiento > 0 ? 'green' : 'red'}-400`}>
                          ({porcentajeCrecimiento.toFixed(1)}%)
                        </span>
                        {" "}
                        <span className="text-blue-300">
                          ${proy.toLocaleString("es-EC", { minimumFractionDigits: 2 })}
                        </span>
                      </>
                    );
                  })()}
                </td>

                <td
                  className={`px-4 py-2 text-right font-bold ${variacionAbs < 0
                    ? "text-red-400"
                    : variacionAbs > 0
                      ? "text-green-400"
                      : "text-gray-300"
                    }`}
                >
                  {variacionAbs !== 0 ? (
                    <>
                      <span>
                        ({variacionAbs > 0 ? "+" : ""}{variacionPorc}%)
                      </span>{" "}
                      ${montoAnterior.toLocaleString("es-EC", {
                        minimumFractionDigits: 2,
                      })}
                    </>
                  ) : (
                    "Sin datos"
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>

        <tfoot className="bg-[#014434] font-bold text-gray-200 border-t border-[#046C5E]">
          <tr>
            <td className="px-4 py-3 text-left">Total</td>
            <td className="px-4 py-3"></td>

            <td className="px-4 py-3 text-right text-green-400">
              {totalUnidades.toLocaleString()}
            </td>

            <td className="px-4 py-3 text-right text-blue-400">
              ${totalUSD.toLocaleString(undefined, {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </td>

            <td className="px-4 py-3 text-right text-blue-400">
              ${totalMeta.toLocaleString(undefined, {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </td>

            <td className="px-4 py-3 text-right text-blue-400">
              ${totalProyeccion.toLocaleString(undefined, {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </td>

            <td className="px-4 py-3 text-right text-blue-400">
              ${totalVsMesAnterior.toLocaleString(undefined, {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
};

export default RankingPreventas;
