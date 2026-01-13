import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import * as XLSX from "xlsx"; // Importar la librería XLSX para generar archivos Excel
import { useAuth } from "../../components/auth/AuthContext"; // Importa el hook useAuth

// Definir los tipos para los datos
interface VsMesAnterior {
  monto_anterior: number;
}

interface Preventa {
  preventa: string;
  unidades: number;
  monto: number;
  meta: number;
  proyeccion: number;
  vsMesAnterior?: VsMesAnterior;
}

interface Datos {
  rankingPreventas: Preventa[];
}

// Define la interfaz Props para las propiedades que el componente recibirá
interface Props {
  datos: Datos; 
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
  const [sortedData, setSortedData] = useState<Preventa[]>(datos.rankingPreventas);

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
    (acc: number, p: Preventa) => acc + (p.unidades || 0),
    0
  );

  const totalUSD = preventas.reduce(
    (acc: number, p: Preventa) => acc + (p.monto || 0),
    0
  );

  // Agregar los totales de Meta, Proyección, y Vs Mes Anterior
  const totalMeta = preventas.reduce(
    (acc: number, p: Preventa) => acc + (p.meta || 0),
    0
  );

  const totalProyeccion = preventas.reduce(
    (acc: number, p: Preventa) => acc + (p.proyeccion || 0),
    0
  );

  const totalVsMesAnterior = preventas.reduce(
    (acc: number, p: Preventa) => acc + (p.vsMesAnterior?.monto_anterior || 0),
    0
  );

  // Función para exportar a Excel
  const exportarTablaExcel = () => {
    if (!preventas || preventas.length === 0) return;

    try {
      const rutaUpper = "Ranking Preventa"; 

      // 1️⃣ Formato de los datos a exportar
      const datosExportar = preventas.map((p: Preventa) => ({
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
        return { wch: maxLong + 4 }; 
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
  const requestSort = (key: keyof Preventa) => {
    let direction = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }

    setSortConfig({ key, direction });

    const sorted = [...preventas].sort((a, b) => {
      const aValue = key === 'vsMesAnterior'
        ? a[key]?.monto_anterior
        : a[key];

      const bValue = key === 'vsMesAnterior'
        ? b[key]?.monto_anterior
        : b[key];

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
      <div className="flex justify-between items-center px-4 mb-4">

        {/* TÍTULO */}
        <h2 className="text-xl font-bold text-blue-300 leading-none">
          RANKING PREVENTA
        </h2>

        {/* BOTONES ADMIN */}
        {isAdmin && (
          <div className="flex flex-nowrap items-center gap-3 sm:gap-4">

            {/* CONFIGURAR METAS */}
            <button
              onClick={() => navigate("/configurar-metas")}
              className="
          flex items-center gap-2
          bg-[#0db48b] hover:bg-[#0aa77e]
          text-black font-semibold
          px-3.5 sm:px-5 py-2 sm:py-2.5
          rounded-lg shadow-md
          transition
          text-sm sm:text-base
        "
            >
              <span className="text-base sm:text-lg">⚙️</span>
              <span className="hidden sm:inline">Configurar Metas</span>
            </button>

            {/* EXPORTAR */}
            <button
              onClick={exportarTablaExcel}
              className="
          flex items-center gap-2
          bg-[#0db48b] hover:bg-[#0aa77e]
          text-black font-semibold
          px-3.5 sm:px-5 py-2 sm:py-2.5
          rounded-lg shadow-md
          transition
          text-sm sm:text-base
        "
            >
              <span className="text-base sm:text-lg">📥</span>
              <span className="hidden sm:inline">Exportar</span>
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
              onClick={() => requestSort('proyeccion')}>
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
                      ${variacionAbs.toLocaleString("es-EC", {
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
