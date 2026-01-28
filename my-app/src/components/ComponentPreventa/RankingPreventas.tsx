import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import * as XLSX from "xlsx"; // Importar la librería XLSX para generar archivos Excel
import { useAuth } from "../../components/auth/AuthContext"; // Importa el hook useAuth
import { BsDownload, BsGear } from "react-icons/bs";


// Definir los tipos para los datos
interface VsMesAnterior {
  monto_anterior: number;
  variacion_abs: number; //  diferencia absoluta vs mes anterior
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


  const [sortConfig, setSortConfig] = useState<{
    key: SortKey;
    direction: 'asc' | 'desc';
  }>({
    key: 'N*',
    direction: 'asc',
  });
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
    (acc: number, p: Preventa) => acc + (p.vsMesAnterior?.variacion_abs || 0),
    0
  );

  // Función para exportar a Excel
  const exportarTablaExcel = () => {
    if (!preventas || preventas.length === 0) return;

    try {
      const rutaUpper = "Ranking Preventa";

      type ExcelRow = {
        "N*": number;
        "Ruta / Preventa": string;
        Unidades: string;
        Dólares: string;
        Meta: string;
        Proyección: string;
        "Vs Mes Anterior": string;
      };


      // 1️⃣ Formato de los datos a exportar
      const datosExportar: ExcelRow[] = preventas.map((p, index) => ({
        "N*": index + 1,
        "Ruta / Preventa": p.preventa,
        Unidades: p.unidades?.toLocaleString() ?? "0",
        Dólares: p.monto?.toLocaleString(undefined, { minimumFractionDigits: 2 }) ?? "0.00",
        Meta: p.meta?.toLocaleString(undefined, { minimumFractionDigits: 2 }) ?? "0.00",
        Proyección: p.proyeccion?.toLocaleString(undefined, { minimumFractionDigits: 2 }) ?? "0.00",
        "Vs Mes Anterior":
          p.vsMesAnterior?.variacion_abs?.toLocaleString(undefined, {
            minimumFractionDigits: 2,
          }) ?? "Sin datos",
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
      const columnas = Object.keys(datosExportar[0]) as (keyof ExcelRow)[];

      ws["!cols"] = columnas.map((col) => {
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

  type SortKey = "N*" | "preventa" | "unidades" | "monto" | "meta" | "proyeccion" | "vsMesAnterior";
  // Función para ordenar los datos

  const requestSort = (key: SortKey) => {
    const direction =
      sortConfig.key === key && sortConfig.direction === "asc" ? "desc" : "asc";

    setSortConfig({ key, direction });

    if (key === "N*") return;

    const sorted = [...preventas].sort((a, b) => {
      let aValue: number | string = 0;
      let bValue: number | string = 0;

      switch (key) {
        case "preventa":
          aValue = a.preventa;
          bValue = b.preventa;
          break;

        case "vsMesAnterior":
          // Ordenar por 'variacion_abs' (diferencia absoluta)
          aValue = a.vsMesAnterior?.variacion_abs ?? 0;
          bValue = b.vsMesAnterior?.variacion_abs ?? 0;
          break;

        default:
          aValue = a[key];
          bValue = b[key];
      }

      // Si el valor es una cadena, ordenar como texto
      if (typeof aValue === "string" && typeof bValue === "string") {
        return direction === "asc"
          ? aValue.localeCompare(bValue)
          : bValue.localeCompare(aValue);
      }

      // Si es un número, ordenar numéricamente
      return direction === "asc"
        ? Number(aValue) - Number(bValue)
        : Number(bValue) - Number(aValue);
    });

    setSortedData(sorted);
  };


  return (
    <div className="overflow-x-auto bg-[#012E24] text-white rounded-lg shadow-md border border-[#046C5E] mt-6">
      <div
        className="
    flex flex-col gap-3
    md:flex-row md:items-center md:justify-between
    mb-4
  "
      >
        {/* TÍTULO */}
        <h2
          className="
      text-lg md:text-xl
      font-bold
      px-4 py-2
      text-blue-300
      text-center md:text-left
    "
        >
          RANKING PREVENTA
        </h2>

        {/* BOTONES ADMIN */}
        {isAdmin && (
          <div className="flex gap-4 mb-4"> {/* Flexbox para alinear los botones */}
            {/* CONFIGURAR */}
            <button
              onClick={() => navigate("/configurar-metas")}
              className="
          flex items-center justify-center gap-2
          px-4 py-2
          rounded-lg
          border border-[#0db48b]/60
          bg-[#0db48b]/20
          text-white font-semibold
          shadow-md
          hover:bg-[#0db48b]/30
          hover:shadow-lg
          active:scale-[0.98]
          transition-all
        "
            >
              <BsGear size={16} />
            </button>

            {/* EXPORTAR */}
            <button
              onClick={exportarTablaExcel}
              className="
          flex items-center justify-center gap-2
          px-4 py-2
          rounded-lg
          border border-[#0db48b]/60
          bg-[#0db48b]/20
          text-white font-semibold
          shadow-md
          hover:bg-[#0db48b]/30
          hover:shadow-lg
          active:scale-[0.98]
          transition-all
        "
            >
              <BsDownload size={16} />
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
            // const variacionAbs = proy - (p.vsMesAnterior?.monto_anterior || 0); // Variación entre proyección y monto anterior
            // const variacionPorc = p.vsMesAnterior?.monto_anterior > 0
            //   ? ((variacionAbs / p.vsMesAnterior?.monto_anterior) * 100).toFixed(2)
            //   : "0.00";
            //  const montoAnterior = p.vsMesAnterior?.monto_anterior ?? 0;

            const montoAnterior = p.vsMesAnterior?.monto_anterior ?? 0;
            const variacionAbs = proy - montoAnterior; // Variación entre proyección y monto anterior
            const variacionPorc =
              montoAnterior > 0
                ? ((variacionAbs / montoAnterior) * 100).toFixed(2)
                : "0.00";

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
