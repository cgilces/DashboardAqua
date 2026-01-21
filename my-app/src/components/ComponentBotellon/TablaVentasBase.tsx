import { useState } from "react";
import * as XLSX from "xlsx";
import { BsDownload } from "react-icons/bs";
import { useNavigate } from "react-router-dom";


/* ============================
   TIPOS
============================ */
export interface MetaHistorica {
    meta_historica: string;
    mes_mayor_consumo: string | null;
}

export interface VsMesAnterior {
    monto_anterior: number;
    variacion_abs: number;
    variacion_porc: number | null;
}

export interface ItemDetalleVentas {
    codigo: string;
    unidades: number;
    dolares: number;
    meta: MetaHistorica;
    proyeccion: number;
    vsMesAnterior?: VsMesAnterior | null;
}

interface Props {
    titulo: string;
    subtitulo?: string;
    data?: ItemDetalleVentas[];
    nombreHojaExcel?: string;
    nombreArchivoExcel?: string;
    anio: number | string;
    mes: number | string;
}

/* ============================
   HELPERS
============================ */
const money = (v?: number) =>
    v != null
        ? `$${v.toLocaleString("es-EC", { minimumFractionDigits: 2 })}`
        : "—";

/* ============================
   COMPONENTE BASE
============================ */
const TablaVentasBase: React.FC<Props> = ({
    titulo,
    subtitulo = "Botellones – Órdenes + Facturas",
    data = [],
    nombreHojaExcel = "Ventas",
    nombreArchivoExcel = "ventas",
    anio,
    mes,
}) => {

    if (!Array.isArray(data) || data.length === 0) {
        return (
            <div className="bg-[#012E24] text-gray-400 rounded-lg p-4 border border-[#046C5E]">
                No hay datos para {titulo}
            </div>
        );
    }

    const navigate = useNavigate();


    /* ============================
       ORDENAMIENTO
    ============================ */
    type SortKey =
        | "codigo"
        | "unidades"
        | "dolares"
        | "meta"
        | "proyeccion"
        | "vsMesAnterior";

    const [sortConfig, setSortConfig] = useState<{
        key: SortKey;
        direction: "asc" | "desc";
    }>({
        key: "dolares",
        direction: "desc",
    });

    const requestSort = (key: SortKey) => {
        setSortConfig((prev) => ({
            key,
            direction:
                prev.key === key && prev.direction === "desc" ? "asc" : "desc",
        }));
    };

    const sortedData = [...data].sort((a, b) => {
        const getValue = (item: ItemDetalleVentas) => {
            switch (sortConfig.key) {
                case "meta":
                    return Number(item.meta?.meta_historica || 0);
                case "vsMesAnterior":
                    return Number(item.vsMesAnterior?.variacion_abs || 0);
                default:
                    return (item as any)[sortConfig.key] ?? 0;
            }
        };

        const aVal = getValue(a);
        const bVal = getValue(b);

        return sortConfig.direction === "asc" ? aVal - bVal : bVal - aVal;
    });

    const iconSort = (key: SortKey) =>
        sortConfig.key === key
            ? sortConfig.direction === "asc"
                ? "↑"
                : "↓"
            : "↕";

    /* ============================
       TOTALES
    ============================ */
    const totalUnidades = sortedData.reduce((a, r) => a + r.unidades, 0);
    const totalDolares = sortedData.reduce((a, r) => a + r.dolares, 0);
    const totalMeta = sortedData.reduce(
        (a, r) => a + Number(r.meta?.meta_historica || 0),
        0
    );
    const totalProyeccion = sortedData.reduce((a, r) => a + r.proyeccion, 0);
    const totalvsmesanterior = sortedData.reduce((a, r) => a + (r.vsMesAnterior?.variacion_abs || 0), 0);


    /* ============================
       EXPORTAR EXCEL
    ============================ */
    const exportarExcel = () => {
        const datos = sortedData.map((r) => ({
            Ruta: r.codigo,
            Unidades: r.unidades,
            Dólares: r.dolares,
            Meta: Number(r.meta?.meta_historica || 0),
            Proyección: r.proyeccion,
            "Vs Mes Anterior (%)": r.vsMesAnterior?.variacion_abs ?? "",
        }));

        const ws = XLSX.utils.json_to_sheet(datos);

        XLSX.utils.sheet_add_json(
            ws,
            [
                {
                    Ruta: "TOTAL",
                    Unidades: totalUnidades,
                    Dólares: totalDolares,
                    Meta: totalMeta,
                    Proyección: totalProyeccion,
                    "Vs Mes Anterior (%)": totalvsmesanterior,
                },
            ],
            { skipHeader: true, origin: -1 }
        );

        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, nombreHojaExcel);

        XLSX.writeFile(wb, `${nombreArchivoExcel}.xlsx`);
    };

    /* ============================
       RENDER
    ============================ */
    return (
        <div className="overflow-x-auto bg-[#012E24] text-white rounded-lg shadow-md border border-[#046C5E] mb-8">

            {/* HEADER */}
            <div className="
                        flex flex-col gap-4
                        md:flex-row md:items-center md:justify-between
                        px-4 py-4
                        border-b border-[#046C5E]
                        ">
                {/* TÍTULOS */}
                <div className="flex flex-col gap-1">
                    <h2 className="text-lg md:text-xl font-bold text-green-300 leading-tight">
                        {titulo}
                    </h2>
                    <p className="text-sm text-gray-300 max-w-xl">
                        {subtitulo}
                    </p>
                </div>

                {/* BOTÓN EXPORTAR */}
                <div className="flex md:justify-end">
                    <button
                        onClick={exportarExcel}
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
                            ">
                        <BsDownload size={16} className="text-white shrink-0" />
                        <span>Exportar</span>
                    </button>
                </div>
            </div>


            {/* TABLA */}
            <table className="min-w-full text-sm">
                <thead className="bg-[#014434] text-green-300 uppercase text-xs">
                    <tr>
                        <th onClick={() => requestSort("codigo")} className="px-4 py-3 text-left cursor-pointer">
                            RUTA {iconSort("codigo")}
                        </th>
                        <th onClick={() => requestSort("unidades")} className="px-4 py-3 text-right cursor-pointer">
                            UNIDADES {iconSort("unidades")}
                        </th>
                        <th onClick={() => requestSort("dolares")} className="px-4 py-3 text-right cursor-pointer">
                            DÓLARES {iconSort("dolares")}
                        </th>
                        <th onClick={() => requestSort("meta")} className="px-4 py-3 text-right cursor-pointer">
                            META {iconSort("meta")}
                        </th>
                        <th onClick={() => requestSort("proyeccion")} className="px-4 py-3 text-right cursor-pointer">
                            PROYECCIÓN {iconSort("proyeccion")}
                        </th>
                        <th onClick={() => requestSort("vsMesAnterior")} className="px-4 py-3 text-right cursor-pointer">
                            VS MES ANTERIOR {iconSort("vsMesAnterior")}
                        </th>
                    </tr>
                </thead>




                <tbody>
                    {sortedData.map((row, idx) => (
                        <tr
                            key={row.codigo}
                            onClick={() =>
                                navigate(`/dashboard/botellon/${row.codigo}?anio=${anio}&mes=${mes}`)
                            }
                            className={`transition-all duration-200 cursor-pointer
                                        ${idx % 2 === 0 ? "bg-[#013d32]" : "bg-[#014f3e]"}
                                        hover:bg-[#016a57] hover:shadow-lg hover:text-white
                                        border-l-4 border-transparent hover:border-green-400
                                    `}
                        >
                            <td className="px-4 py-2 font-semibold">
                                {row.codigo}
                            </td>

                            <td className="px-4 py-2 text-right text-green-400 font-bold">
                                {row.unidades.toLocaleString("es-EC")}
                            </td>

                            <td className="px-4 py-2 text-right text-blue-400 font-bold">
                                {money(row.dolares)}
                            </td>

                            <td className="px-4 py-2 text-right">
                                {row.meta
                                    ? `${Number(row.meta.meta_historica).toLocaleString("es-EC", {
                                        minimumFractionDigits: 2,
                                    })} (${new Date(row.meta.mes_mayor_consumo!).toLocaleDateString(
                                        "es-EC",
                                        { month: "long" }
                                    )})`
                                    : "—"}
                            </td>

                            <td className="px-4 py-2 text-right text-blue-400 font-bold">
                                {money(row.proyeccion)}
                            </td>

                            <td className="px-4 py-2 text-right font-bold">
                                {(() => {
                                    const porc = row.vsMesAnterior?.variacion_porc ?? 0;
                                    const abs = row.vsMesAnterior?.variacion_abs ?? 0;

                                    return (
                                        <span
                                            className={`${porc >= 0 ? "text-green-400" : "text-red-400"}`}
                                        >
                                            ({porc >= 0 ? "+" : ""}
                                            {porc.toFixed(2)}%)
                                            {" "}
                                            {money(abs)}
                                        </span>
                                    );
                                })()}
                            </td>
                        </tr>
                    ))}
                </tbody>


                {/* FOOTER TOTAL */}
                <tfoot className="bg-[#014434] font-bold border-t border-[#046C5E]">
                    <tr>
                        <td className="px-4 py-3">TOTAL GENERAL</td>
                        <td className="px-4 py-3 text-right">
                            {totalUnidades.toLocaleString("es-EC")}
                        </td>
                        <td className="px-4 py-3 text-right">
                            {money(totalDolares)}
                        </td>
                        <td className="px-4 py-3 text-right">
                            {money(totalMeta)}
                        </td>
                        <td className="px-4 py-3 text-right">
                            {money(totalProyeccion)}
                        </td>
                        <td className="px-4 py-3 text-right">
                            {money(totalvsmesanterior)}
                        </td>
                    </tr>
                </tfoot>
            </table>
        </div>
    );
};

export default TablaVentasBase;
