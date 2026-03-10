import React, { useState, useEffect } from "react";
import { BsDownload } from "react-icons/bs";
import * as XLSX from "xlsx"; // Importar la librería XLSX para generar archivos Excel

interface Props {
    data?: any;
}

// ✅ Categorías oficiales (SIN acentos, SIN espacios raros)
// 👉 Estas keys se usan para:
// - backend
// - frontend
// - sorting
// - exportación a Excel
const CATEGORIAS = [
    "300ML",
    "500ML",
    "625ML",
    "1L",
    "1L_SPORT",
    "1_5L",
    "GALON",
    "6L",
] as const;



type FilaCosto = {
    preventa: string;
    [key: string]: string | number | null;
};


const CostoPromedioProductos: React.FC<Props> = ({ data }) => {
    // Mueve la función transformar arriba, antes del uso de useState

    const transformar = (tabla: any): FilaCosto[] => {
        if (!tabla) return [];

        const filas: FilaCosto[] = [];

        for (const preventa in tabla) {
            const productos = tabla[preventa];

            const fila: FilaCosto = { preventa };

            CATEGORIAS.forEach(cat => {
                fila[`c_${cat}`] = productos[cat]?.precio ?? null;
                fila[`v_${cat}`] = productos[cat]?.vsAnterior ?? null;
            });

            filas.push(fila);
        }

        return filas;
    };



    // const [sortConfig, setSortConfig] = useState({ key: 'preventa', direction: 'asc' });
    // const [sortedData, setSortedData] = useState(data ? transformar(data) : []);


    const [sortConfig, setSortConfig] = useState<{
        key: string;
        direction: 'asc' | 'desc';
    }>({
        key: 'preventa',
        direction: 'asc',
    });

    const [sortedData, setSortedData] = useState<FilaCosto[]>([]);


    useEffect(() => {
        if (data) {
            setSortedData(transformar(data));
        }
    }, [data]);


    const money = (v: number | string | null) =>
        v === null ? "—" : `$${Number(v).toFixed(2)}`;

    const variacion = (v: number | string | null) =>
        v === null ? "—" : `${Number(v) > 0 ? "+" : ""}${v}%`;

    // Función para exportar a Excel
    const exportarTablaExcel = () => {
        if (!sortedData || sortedData.length === 0) return;

        try {
            const rutaUpper = "Precio Promedio por Producto"; // Título del archivo, cambia si es necesario

            // 1️⃣ Formato de los datos a exportar
            const datosExportar = sortedData.map((r, index) => ({
                "N*": index + 1,
                "Preventa": r.preventa, // Campo de la Preventa
                "300ML": r["c_300ML"]?.toLocaleString() ?? "0", // 300ML
                "VS ANT 300ML": r["v_300ML"]?.toLocaleString() ?? "0", // Variación 300ML
                "500ML": r["c_500ML"]?.toLocaleString() ?? "0", // 500ML
                "VS ANT 500ML": r["v_500ML"]?.toLocaleString() ?? "0", // Variación 500ML
                "625ML": r["c_625ML"]?.toLocaleString() ?? "0", // 625ML
                "VS ANT 625ML": r["v_625ML"]?.toLocaleString() ?? "0", // Variación 625ML
                "1L": r["c_1L"]?.toLocaleString() ?? "0", // 1L
                "VS ANT 1L": r["v_1L"]?.toLocaleString() ?? "0", // Variación 1L
                "1L SPORT": r["c_1L SPORT"]?.toLocaleString() ?? "0", // 1L SPORT
                "VS ANT 1L SPORT": r["v_1L SPORT"]?.toLocaleString() ?? "0", // Variación 1L SPORT
                "1.5L": r["c_1.5L"]?.toLocaleString() ?? "0", // 1.5L
                "VS ANT 1.5L": r["v_1.5L"]?.toLocaleString() ?? "0", // Variación 1.5L
                "Galón": r["c_Galón"]?.toLocaleString() ?? "0", // Galón
                "VS ANT Galón": r["v_Galón"]?.toLocaleString() ?? "0", // Variación Galón
                "GL": r["c_GL"]?.toLocaleString() ?? "0", // GL
                "VS ANT GL": r["v_GL"]?.toLocaleString() ?? "0", // Variación GL
            }));

            // 2️⃣ Crear hoja de trabajo
            const ws = XLSX.utils.json_to_sheet(datosExportar);

            // 3️⃣ Agregar título en A1
            const titulo = [`PRECIO PROMEDIO POR PRODUCTO - ${rutaUpper}`];
            XLSX.utils.sheet_add_aoa(ws, [titulo], { origin: "A1" });

            // 5️⃣ Auto-ajustar el ancho de las columnas
            const columnas = Object.keys(datosExportar[0]);
            ws['!cols'] = columnas.map((col) => {
                const maxLong = Math.max(
                    col.length,
                    ...datosExportar.map((row: Record<string, any>) =>
                        String(row[col] ?? "").length
                    )
                );
                return { wch: maxLong + 4 }; // +4 para margen visual
            });

            // 6️⃣ Crear el libro de trabajo Excel
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, "RankingPreventa");

            const nombreArchivo = `ranking_precio_promedio_${rutaUpper}.xlsx`;
            XLSX.writeFile(wb, nombreArchivo, { compression: true });

        } catch (error) {
            console.error("❌ Error exportando Excel:", error);
        }
    };

    // Función para ordenar los datos
    const requestSort = (key: string) => {
        let direction: 'asc' | 'desc' = 'asc';

        if (sortConfig.key === key && sortConfig.direction === 'asc') {
            direction = 'desc';
        }

        setSortConfig({ key, direction });

        const sorted = [...sortedData].sort((a, b) => {
            const aValue = a[key];
            const bValue = b[key];

            if (typeof aValue === 'string' && typeof bValue === 'string') {
                return direction === 'asc'
                    ? aValue.localeCompare(bValue)
                    : bValue.localeCompare(aValue);
            }

            if (typeof aValue === 'number' && typeof bValue === 'number') {
                return direction === 'asc' ? aValue - bValue : bValue - aValue;
            }

            return 0;
        });

        setSortedData(sorted);
    };


    return (
        <div className="bg-[#012E24] text-white rounded-lg shadow-md border border-[#046C5E] mt-8">

            {/* HEADER SUPERIOR */}

            <div className="
  flex flex-col gap-3
  md:flex-row md:items-center md:justify-between
  px-4 py-3
">
                {/* TÍTULO */}
                <h2 className="
    text-lg md:text-xl
    font-bold
    text-blue-300
    text-center md:text-left
  ">
                    PRECIO PROMEDIO POR PRODUCTO
                </h2>

                {/* BOTÓN */}
                <div className="flex gap-4 mb-4"> {/* Flexbox para alinear los botones */}
                    <button
                        onClick={exportarTablaExcel}
                        className="
        flex items-center justify-center gap-2
        w-full md:w-auto
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
                        Exportar
                    </button>
                </div>
            </div>



            {/* HEADER FIJO */}
            <div className="overflow-x-auto">
                <table className="min-w-full text-sm table-fixed">
                    <thead className="bg-[#014434] text-green-300 uppercase text-xs sticky top-0 z-20">
                        <tr>
                            <th
                                className="px-4 py-3 text-left w-44 cursor-pointer hover:text-white transition-colors select-none"
                                onClick={() => requestSort("preventa")}
                            >
                                Preventa
                            </th>

                            {CATEGORIAS.map((cat) => (
                                <React.Fragment key={`head-${cat}`}>
                                    <th
                                        className="px-4 py-3 text-right w-24 cursor-pointer hover:text-white transition-colors select-none"
                                        onClick={() => requestSort(`c_${cat}`)}
                                    >
                                        {cat}
                                    </th>
                                    <th
                                        className="px-4 py-3 text-right w-28 cursor-pointer hover:text-white transition-colors select-none"
                                        onClick={() => requestSort(`v_${cat}`)}
                                    >
                                        VS ANT
                                    </th>
                                </React.Fragment>
                            ))}
                        </tr>
                    </thead>
                </table>
            </div>

            {/* BODY SCROLL */}
            <div className="overflow-x-auto ">
                <table className="min-w-full text-sm table-fixed">
                    <tbody>
                        {sortedData.map((row, idx) => (
                            <tr
                                key={row.preventa}
                                className={`
                  ${idx % 2 === 0 ? "bg-[#013d32]" : "bg-[#014f3e]"}
                  hover:bg-[#026452] transition
                `}
                            >
                                <td className="px-4 py-2 w-44 font-medium">
                                    {row.preventa}
                                </td>

                                {CATEGORIAS.map((cat) => {
                                    const precio = row[`c_${cat}`];
                                    const vsRaw = row[`v_${cat}`];
                                    const vsNum = vsRaw === null ? null : Number(vsRaw);

                                    return (
                                        <React.Fragment key={`${row.preventa}-${cat}`}>
                                            <td className="px-4 py-2 w-24 text-right text-blue-400 font-semibold">
                                                {money(precio)}
                                            </td>

                                            <td
                                                className={`
          px-4 py-2 w-28 text-right font-semibold
          ${vsNum === null
                                                        ? "text-gray-400"
                                                        : vsNum >= 0
                                                            ? "text-green-400"
                                                            : "text-red-400"
                                                    }
        `}
                                            >
                                                {variacion(vsNum)}
                                            </td>
                                        </React.Fragment>
                                    );
                                })}

                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default CostoPromedioProductos;
