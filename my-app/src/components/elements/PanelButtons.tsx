import React, { useState } from 'react';
import { UploadIcon, CloudIcon, SaveIcon, DatabaseIcon, RefreshIcon, UserAddIcon } from '../common/Icons';
import Button from './Button';
import BuscadorFrecuencia from "../../components/elements/BuscadorFrecuencia";

interface PanelButtonsProps {
    title?: string;
    subtitle?: string;
    isAdmin?: boolean;
    rutasAsignadas?: string[];
    handleFileUpload?: (event: React.ChangeEvent<HTMLInputElement>) => void;
    cargarDesdeBD?: () => void;
    handleApiSync?: () => void;
    handleSaveToDatabase?: () => void;
    handleAddClient?: () => void;

    // ✔ AGREGADO
    handleImportarRutas?: () => void;
    cargando?: boolean;

    selectedRoute?: string;
    setSelectedRoute?: (route: string) => void;
    setCurrentPage?: (page: number) => void;
    uniqueRoutes?: string[];
    itemCount?: number;
    itemLabel?: string;

    // ✔ Para enviar término de búsqueda al componente padre si quieres
    onBuscarFrecuencia?: (texto: string) => void;
}

const PanelButtons: React.FC<PanelButtonsProps> = ({
    title,
    subtitle,
    isAdmin,
    rutasAsignadas,
    handleFileUpload,
    handleAddClient,
    handleSaveToDatabase,

    // ✔ AGREGADO
    handleImportarRutas,
    cargando,

    selectedRoute,
    setSelectedRoute,
    setCurrentPage,
    uniqueRoutes,
    itemCount,
    itemLabel = 'items',

    // ✔ Para emitir búsqueda
    onBuscarFrecuencia
}) => {

    // ✔ ESTADO REAL (corregido)
    const [terminoBusqueda, setTerminoBusqueda] = useState("");

    return (
        <div className="flex flex-col gap-4 bg-[#ffffff] p-6 rounded-xl shadow-lg border border-gray-300 w-full">

            {/* Header Row */}
            <div className="flex flex-col xl:flex-row gap-6 items-start xl:items-center justify-between">

                <div className="min-w-[200px]">
                    {title ? (
                        <>
                            <h1 className="text-2xl font-bold text-[#162b25]">{title}</h1>
                            {subtitle && <p className="text-[#162b25]/60 text-sm">{subtitle}</p>}
                        </>
                    ) : (
                        <div className="text-[#162b25] font-semibold text-sm">
                            {isAdmin ? 'Vista de administrador' : `Ruta asignada: ${rutasAsignadas?.[0] ?? 'N/A'}`}
                        </div>
                    )}
                </div>

                {/* Botones acciones */}
                <div className="
                    flex flex-col gap-3 w-full 
                    sm:flex-col 
                    md:flex-row md:flex-wrap 
                    xl:flex-nowrap xl:ml-[20rem]
                ">

                    {/* Contenedor de botones */}
                    <div className="flex flex-col gap-3 w-full md:flex-row md:flex-wrap xl:flex-nowrap xl:w-auto">

                        {/* BOTÓN IMPORTAR RUTAS */}
                        {handleImportarRutas && (
                            <Button
                                onClick={handleImportarRutas}
                                disabled={cargando}
                                size="sm"
                                icon={<UploadIcon className="w-3 h-3" />}
                                className="
                                    w-full md:w-auto
                                    h-10 shadow-md border border-[#453445]/20
                                    text-white bg-[#162B25] hover:bg-[#6BAF8E]
                                    rounded-lg font-bold whitespace-nowrap
                                "
                            >
                                {cargando ? "Cargando..." : "Cargar_Rutas"}
                            </Button>
                        )}

                        {/* BOTÓN AGREGAR CLIENTE */}
                        {handleAddClient && (
                            <Button
                                onClick={handleAddClient}
                                size="sm"
                                icon={<UserAddIcon className="w-3 h-3" />}
                                className="
                                    w-full md:w-auto
                                    h-10 shadow-md border border-[#453445]/20
                                    text-white bg-[#162B25] hover:bg-[#6BAF8E]
                                    rounded-lg font-bold whitespace-nowrap
                                "
                            >
                                Agregar Cliente
                            </Button>
                        )}

                        {/* BOTÓN GUARDAR BD */}
                        {handleSaveToDatabase && (
                            <Button
                                onClick={handleSaveToDatabase}
                                size="sm"
                                icon={<SaveIcon className="w-5 h-5" />}
                                className="
                                    w-full md:w-auto
                                    h-10 shadow-md border border-[#453445]/20
                                    text-white bg-[#162B25] hover:bg-[#6BAF8E]
                                    rounded-lg font-bold whitespace-nowrap
                                "
                            >
                                Guardar_Frecuencia
                            </Button>
                        )}

                    </div>
                </div>

                {itemCount !== undefined && (
                    <div className="flex-shrink-0">
                        <span className="text-[#bedacc] xs:text-xs sm:text-sm sm:px-4 xs:px-2 text-md font-bold px-6 py-4 bg-[#162b25] rounded-full border border-[#b2e1d8]/10">
                            {itemCount} {itemLabel}
                        </span>
                    </div>
                )}

            </div>

            {/* Filtro por ruta */}
            {uniqueRoutes && selectedRoute !== undefined && setSelectedRoute && (
                <div className="flex items-center gap-3 pt-4 border-t border-[#b2e1d8]/10 mt-2">
                    <label className="text-[#162b25] text-sm font-medium">Filtrar por Ruta:</label>

                    <div className="relative">
                        <select
                            value={selectedRoute}
                            onChange={e => {
                                setSelectedRoute(e.target.value);
                                if (setCurrentPage) setCurrentPage(1);
                            }}
                            className="
                                bg-[#0f1f1b] hover:bg-[#0f1f1b]/80 
                                border border-[#b2e1d8]/30 
                                text-[#b6c6c1] text-sm rounded-lg pl-3 pr-8 py-2 
                                appearance-none focus:outline-none focus:ring-1 focus:ring-[#b2e1d8]
                            "
                        >
                            <option value="">Todas las rutas</option>
                            {uniqueRoutes.map(r => (
                                <option key={r} value={r}>
                                    Ruta {r}
                                </option>
                            ))}
                        </select>

                        <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-[#b2e1d8]">
                            <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20">
                                <path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z" />
                            </svg>
                        </div>
                    </div>
                </div>
            )}

            {/* ✔ BUSCADOR FRECUENCIA INTEGRADO AQUÍ */}
            <BuscadorFrecuencia
                valor={terminoBusqueda}
                alCambiar={(texto) => {
                    setTerminoBusqueda(texto);
                    setCurrentPage?.(1);
                    onBuscarFrecuencia?.(texto); // ⬅ Por si necesitas enviar al padre
                }}
            />

        </div>
    );
};

export default PanelButtons;
