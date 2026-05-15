import { useState } from "react";
import * as XLSX from "xlsx";
import { BsDownload, BsGear, BsPeople } from "react-icons/bs";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../components/auth/AuthContext";
import ImportarMetasBoton from "../common/ImportarMetasBoton";

// Mapa seccionMetas → URL del listado agregado de clientes del grupo.
const URL_CLIENTES_GRUPO: Record<string, string> = {
    MAYORISTA: "/mayorista-botellon/clientes",
    TIENDAS: "/tiendas-botellon/clientes",
    TIENDAS_VIP: "/tiendas-vip-botellon/clientes",
    RURAL: "/rural-botellon/clientes",
};


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

export interface CupoGerencia {
    cupo_dolares: number;
    cupo_unidades: number;
}

export interface ItemDetalleVentas {
    codigo: string;
    unidades: number;
    dolares: number;
    meta: MetaHistorica;
    cupo?: CupoGerencia | null;
    proyeccion: {
        dolares: number
        unidades: number
    };
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
    seccionMetas?: string; // ej: "TIENDAS" — si se pasa, muestra botón Metas (solo admin)
}

/* ============================
   HELPERS
============================ */
const money = (v?: number) =>
    v != null
        ? `$${v.toLocaleString("es-EC", { minimumFractionDigits: 2 })}`
        : "—";


const price = (v?: number) =>
    v != null
        ? `$${v.toLocaleString("es-EC", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
        })}`
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
    seccionMetas,
}) => {
    const { user } = useAuth();
    const isAdmin = user?.role === "ADMIN";
    //  FILTRAR filas con unidades en 0
    const dataFiltrada = data.filter(
        (r) =>
            r.unidades > 0 ||
            r.dolares > 0 ||
            (r.proyeccion?.dolares || 0) > 0 ||
            (r.proyeccion?.unidades || 0) > 0
    );



    if (!Array.isArray(dataFiltrada) || dataFiltrada.length === 0) {

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
        | "precio_promedio"   //  NUEVO
        | "meta"
        | "cupo_dolares"
        | "proyeccion_dolares"
        | "proyeccion_unidades"
        | "vsMesAnterior"
        | "vsMesAnterior_abs"
        | "vsMesAnterior_porc";

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


    const calcPrecioPromedio = (dolares: number, unidades: number) =>
        unidades > 0 ? dolares / unidades : 0;

    const sortedData = [...dataFiltrada].sort((a, b) => {
        const getValue = (item: ItemDetalleVentas) => {
            switch (sortConfig.key) {
                case "codigo":
                    return item.codigo || "";

                case "meta":
                    return Number(item.meta?.meta_historica || 0);

                case "cupo_dolares":
                    return Number(item.cupo?.cupo_dolares || 0);

                case "vsMesAnterior":
                case "vsMesAnterior_abs":
                    return Number(item.vsMesAnterior?.variacion_abs || 0);

                case "vsMesAnterior_porc":
                    return Number(item.vsMesAnterior?.variacion_porc || 0);

                case "proyeccion_dolares":
                    return Number(item.proyeccion?.dolares || 0);

                case "proyeccion_unidades":
                    return Number(item.proyeccion?.unidades || 0);

                case "precio_promedio":
                    return calcPrecioPromedio(item.dolares, item.unidades);

                default:
                    return (item as any)[sortConfig.key] ?? 0;
            }
        };

        const aVal = getValue(a);
        const bVal = getValue(b);

        // manejar string vs number
        if (typeof aVal === "string" && typeof bVal === "string") {
            return sortConfig.direction === "asc"
                ? aVal.localeCompare(bVal)
                : bVal.localeCompare(aVal);
        }

        return sortConfig.direction === "asc"
            ? (aVal as number) - (bVal as number)
            : (bVal as number) - (aVal as number);
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
    const totalCupoDolares = sortedData.reduce(
        (a, r) => a + (r.cupo?.cupo_dolares || 0),
        0
    );
    const totalProyeccionDolares = sortedData.reduce(
        (a, r) => a + (r.proyeccion?.dolares || 0),
        0
    );
    const totalProyeccionUnidades = sortedData.reduce(
        (a, r) => a + (r.proyeccion?.unidades || 0),
        0
    );
    const totalvsmesanterior = sortedData.reduce((a, r) => a + (r.vsMesAnterior?.variacion_abs || 0), 0);



    const totalPrecioPromedio = calcPrecioPromedio(totalDolares, totalUnidades);
    /* ============================
       EXPORTAR EXCEL
    ============================ */
    const exportarExcel = () => {
        const datos = sortedData.map((r) => ({
            Ruta: r.codigo,
            Unidades: r.unidades,
            Dólares: r.dolares,
            "Precio Promedio": Number(calcPrecioPromedio(r.dolares, r.unidades).toFixed(2)),
            "Cupo Gerencia": r.cupo?.cupo_dolares ?? "",
            "Proyección USD": r.proyeccion?.dolares ?? 0,
            "Proyección Unidades": r.proyeccion?.unidades ?? 0,
            "Vs Mes Anterior (%)": r.vsMesAnterior?.variacion_porc ?? "",
        }));

        const ws = XLSX.utils.json_to_sheet(datos);

        XLSX.utils.sheet_add_json(
            ws,
            [
                {
                    Ruta: "TOTAL",
                    Unidades: totalUnidades,
                    Dólares: totalDolares,
                    "Precio Promedio": Number(totalPrecioPromedio.toFixed(2)),
                    "Cupo Gerencia": totalCupoDolares,
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
        <div className="bg-[#012E24] text-white rounded-lg shadow-md border border-[#046C5E] mb-8">

            {/* HEADER */}

            {/* HEADER */}
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between px-4 py-4">
                <div className="flex flex-col gap-1">
                    <h2 className="text-lg md:text-xl font-bold text-green-300 leading-tight">
                        {titulo}
                    </h2>
                    <p className="text-sm text-gray-300 max-w-xl">
                        {subtitulo}
                    </p>
                </div>

                <div className="flex gap-3 flex-wrap items-center">
                    <div className="bg-[#011f1a] border border-[#046C5E] rounded-lg px-3 py-2 text-center">
                        <p className="text-xs text-gray-400">Unidades</p>
                        <p className="text-base font-bold text-green-400">
                            {totalUnidades.toLocaleString("es-EC")}
                        </p>
                    </div>

                    <div className="bg-[#011f1a] border border-[#046C5E] rounded-lg px-3 py-2 text-center">
                        <p className="text-xs text-gray-400">Dólares</p>
                        <p className="text-base font-bold text-white">
                            {money(totalDolares)}
                        </p>
                    </div>

                    {/*  NUEVO: PRECIO PROMEDIO */}
                    <div className="bg-[#011f1a] border border-[#046C5E] rounded-lg px-3 py-2 text-center">
                        <p className="text-xs text-gray-400">Precio Prom.</p>
                        <p className="text-base font-bold text-purple-400">
                            {price(totalPrecioPromedio)}
                        </p>
                    </div>

                    <div className="bg-[#011f1a] border border-[#046C5E] rounded-lg px-3 py-2 text-center">
                        <p className="text-xs text-gray-400">Hist. Máx</p>
                        <p className="text-base font-bold text-amber-300">
                            {money(totalMeta)}
                        </p>
                    </div>

                    {totalCupoDolares > 0 && (
                        <div className="bg-[#011f1a] border border-amber-500/40 rounded-lg px-3 py-2 text-center">
                            <p className="text-xs text-amber-400">Cupo</p>
                            <p className="text-base font-bold text-amber-300">
                                {money(totalCupoDolares)}
                            </p>
                        </div>
                    )}

                    <div className="bg-[#011f1a] border border-[#046C5E] rounded-lg px-3 py-2 text-center">
                        <p className="text-xs text-gray-400">Proyección</p>
                        <p className="text-base font-bold text-emerald-400">
                            {money(totalProyeccionDolares)}
                        </p>
                    </div>

                    {seccionMetas && URL_CLIENTES_GRUPO[seccionMetas] && (
                        <button
                            onClick={() => navigate(`${URL_CLIENTES_GRUPO[seccionMetas]}/${anio}/${mes}`)}
                            className="flex items-center gap-2 px-4 py-2 rounded-lg border border-emerald-500/60 bg-emerald-500/20 text-white font-semibold hover:bg-emerald-500/30 active:scale-[0.98] transition-all"
                        >
                            <BsPeople size={16} className="text-white shrink-0" />
                            <span>Ver todos los clientes</span>
                        </button>
                    )}

                    {isAdmin && seccionMetas && (
                        <button
                            onClick={() => navigate(`/configurar-metas-botellon/${seccionMetas.toLowerCase()}`)}
                            className="flex items-center gap-2 px-4 py-2 rounded-lg border border-blue-500/60 bg-blue-500/20 text-white font-semibold hover:bg-blue-500/30 active:scale-[0.98] transition-all"
                        >
                            <BsGear size={16} className="text-white shrink-0" />
                            <span>Metas</span>
                        </button>
                    )}

                    {isAdmin && seccionMetas && <ImportarMetasBoton />}

                    <button
                        onClick={exportarExcel}
                        className="flex items-center gap-2 px-4 py-2 rounded-lg border border-[#0db48b]/60 bg-[#0db48b]/20 text-white font-semibold hover:bg-[#0db48b]/30 active:scale-[0.98] transition-all"
                    >
                        <BsDownload size={16} className="text-white shrink-0" />
                        <span>Exportar</span>
                    </button>
                </div>
            </div>




            {/* TABLA */}
            <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                    <thead className="bg-[#014434] text-green-300 uppercase text-xs">
                        <tr>
                            <th onClick={() => requestSort("codigo")} className="px-4 py-3 text-left cursor-pointer hover:text-white select-none">
                                RUTA {iconSort("codigo")}
                            </th>

                            <th onClick={() => requestSort("unidades")} className="px-4 py-3 text-right cursor-pointer hover:text-white select-none">
                                UNIDADES {iconSort("unidades")}
                            </th>

                            <th onClick={() => requestSort("dolares")} className="px-4 py-3 text-right cursor-pointer hover:text-white select-none">
                                DÓLARES {iconSort("dolares")}
                            </th>

                            <th onClick={() => requestSort("precio_promedio")} className="px-4 py-3 text-right cursor-pointer hover:text-white select-none">
                                PRECIO PROMEDIO {iconSort("precio_promedio")}
                            </th>

                            {seccionMetas && (
                                <th onClick={() => requestSort("cupo_dolares")} className="px-4 py-3 text-right cursor-pointer hover:text-white text-amber-300 select-none">
                                    CUPO {iconSort("cupo_dolares")}
                                </th>
                            )}

                            <th onClick={() => requestSort("proyeccion_unidades")} className="px-4 py-3 text-right cursor-pointer hover:text-white select-none">
                                PROYECCIÓN UND {iconSort("proyeccion_unidades")}
                            </th>

                            <th onClick={() => requestSort("proyeccion_dolares")} className="px-4 py-3 text-right cursor-pointer hover:text-white select-none">
                                PROYECCIÓN $ {iconSort("proyeccion_dolares")}
                            </th>

                            {/* 🔥 separados */}
                            <th onClick={() => requestSort("vsMesAnterior_abs")} className="px-4 py-3 text-right cursor-pointer hover:text-white select-none">
                                VARIACIÓN {iconSort("vsMesAnterior_abs")}
                            </th>

                            <th onClick={() => requestSort("vsMesAnterior_porc")} className="px-4 py-3 text-right cursor-pointer hover:text-white select-none">
                                % {iconSort("vsMesAnterior_porc")}
                            </th>
                        </tr>
                    </thead>

                    <tbody>
                        {sortedData.map((row, idx) => (
                            <tr
                                key={row.codigo}
                                onClick={() =>
                                    navigate(`/dashboard/botellon/${row.codigo}?anio=${anio}&mes=${mes}`, {
                                        state: {
                                            cupo_dolares: row.cupo?.cupo_dolares || 0,
                                            cupo_unidades: row.cupo?.cupo_unidades || 0,
                                            proyeccion_dolares: row.proyeccion?.dolares || 0,
                                            proyeccion_unidades: row.proyeccion?.unidades || 0,
                                            dolares: row.dolares,
                                            unidades: row.unidades,
                                        },
                                    })
                                }
                                className={`cursor-pointer transition
                        ${idx % 2 === 0 ? "bg-[#013d32]" : "bg-[#014f3e]"}
                        hover:bg-[#025940] hover:text-white border-l-4 border-transparent hover:border-green-400
                    `}
                            >
                                <td className="px-4 py-2 font-semibold">{row.codigo}</td>

                                <td className="px-4 py-2 text-right text-green-400 font-bold">
                                    {row.unidades.toLocaleString("es-EC")}
                                </td>

                                <td className="px-4 py-2 text-right text-blue-400 font-bold">
                                    {money(row.dolares)}
                                </td>

                                <td className="px-4 py-2 text-right text-purple-400 font-bold">
                                    {price(calcPrecioPromedio(row.dolares, row.unidades))}
                                </td>

                                {seccionMetas && (
                                    <td className="px-4 py-2 text-right font-bold text-amber-300">
                                        {row.cupo ? money(row.cupo.cupo_dolares) : <span className="text-gray-500">—</span>}
                                    </td>
                                )}

                                <td className="px-4 py-2 text-right text-green-400 font-bold">
                                    {row.proyeccion?.unidades?.toLocaleString("es-EC")}
                                </td>

                                <td className="px-4 py-2 text-right text-blue-400 font-bold">
                                    {money(row.proyeccion?.dolares)}
                                </td>

                                {/* VARIACIÓN */}
                                {(() => {
                                    const cupo = row.cupo?.cupo_dolares ?? 0;
                                    const proy = row.proyeccion?.dolares ?? 0;
                                    const montoAnterior = Number(row.vsMesAnterior?.monto_anterior ?? 0);
                                    const tieneCupo = seccionMetas && cupo > 0;

                                    const variacionAbs = tieneCupo
                                        ? proy - cupo
                                        : (row.vsMesAnterior?.variacion_abs ?? (proy - montoAnterior));

                                    const baseVar = tieneCupo ? cupo : montoAnterior;
                                    const variacionPorc = tieneCupo
                                        ? ((proy - cupo) / cupo) * 100
                                        : (row.vsMesAnterior?.variacion_porc != null
                                            ? Number(row.vsMesAnterior.variacion_porc)
                                            : (montoAnterior > 0 ? ((proy - montoAnterior) / montoAnterior) * 100 : 0));

                                    const mostrarValor = tieneCupo || baseVar > 0;

                                    return (
                                        <>
                                            <td className={`px-4 py-2 text-right font-bold ${variacionAbs > 0 ? "text-green-400" :
                                                variacionAbs < 0 ? "text-red-400" :
                                                    "text-gray-400"
                                                }`}>
                                                {mostrarValor
                                                    ? `${variacionAbs >= 0 ? "+" : "-"}${money(Math.abs(variacionAbs))}`
                                                    : "—"}
                                            </td>

                                            <td className={`px-4 py-2 text-right font-bold ${variacionPorc > 0 ? "text-green-400" :
                                                variacionPorc < 0 ? "text-red-400" :
                                                    "text-gray-400"
                                                }`}>
                                                {mostrarValor
                                                    ? `${variacionPorc >= 0 ? "+" : ""}${variacionPorc.toFixed(2)}%`
                                                    : "—"}
                                            </td>
                                        </>
                                    );
                                })()}
                            </tr>
                        ))}
                    </tbody>

                    {/* FOOTER */}
                    <tfoot className="bg-[#014434] font-bold border-t border-[#046C5E]">
                        <tr>
                            <td className="px-4 py-3">TOTAL GENERAL</td>

                            <td className="px-4 py-3 text-right">
                                {totalUnidades.toLocaleString("es-EC")}
                            </td>

                            <td className="px-4 py-3 text-right">
                                {money(totalDolares)}
                            </td>

                            <td className="px-4 py-3 text-right text-purple-300">
                                {price(totalPrecioPromedio)} </td>

                            {seccionMetas && (
                                <td className="px-4 py-3 text-right text-amber-300">
                                    {totalCupoDolares > 0 ? money(totalCupoDolares) : "—"}
                                </td>
                            )}

                            <td className="px-4 py-3 text-right text-green-400">
                                {totalProyeccionUnidades.toLocaleString("es-EC")}
                            </td>

                            <td className="px-4 py-3 text-right text-blue-400">
                                {money(totalProyeccionDolares)}
                            </td>

                            <td className={`px-4 py-3 text-right ${(seccionMetas ? totalProyeccionDolares - totalCupoDolares : totalvsmesanterior) >= 0
                                ? "text-green-400"
                                : "text-red-400"
                                }`}>
                                {money(Math.abs(
                                    seccionMetas
                                        ? totalProyeccionDolares - totalCupoDolares
                                        : totalvsmesanterior
                                ))}
                            </td>

                            <td className="px-4 py-3 text-right text-gray-400">—</td>
                        </tr>
                    </tfoot>
                </table>
            </div>
        </div>
    );
};

export default TablaVentasBase;
