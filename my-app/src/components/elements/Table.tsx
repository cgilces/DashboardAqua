import React from 'react';
import { Card } from "../common/Card";
import { ChevronLeftIcon, ChevronRightIcon } from "../common/Icons";

export interface Column<T> {
    header: string;
    accessorKey?: keyof T;
    render?: (item: T) => React.ReactNode;
    className?: string;
    headerClassName?: string;
}

interface TableProps<T> {
    data: T[];
    columns: Column<T>[];
    keyExtractor: (item: T) => string | number;

    // Pagination
    currentPage?: number;
    totalPages?: number;
    onNextPage?: () => void;
    onPrevPage?: () => void;

    // Mobile View
    renderMobileItem?: (item: T) => React.ReactNode;
}

export const Table = <T extends any>({
    data,
    columns,
    keyExtractor,
    currentPage,
    totalPages,
    onNextPage,
    onPrevPage,
    renderMobileItem
}: TableProps<T>) => {
    return (
        <Card className="overflow-hidden bg-[#ffffff] border-[#162b25]/20 ">
            {/* VISTA MÓVIL */}
            <div className="md:hidden divide-y divide-[#b2e1d8]/10">
                {renderMobileItem && data.map((item) => (
                    <div key={keyExtractor(item)} className="p-4">
                        {renderMobileItem(item)}
                    </div>
                ))}
            </div>

            {/* VISTA DE ESCRITORIO */}
            <div className="overflow-x-auto hidden md:block  ">
                <table className="w-full text-sm text-left text-[#162b25] ">
                    <thead className="text-xs text-[#162b25] uppercase bg-[#ffffff] border-b border-[#162b25]/40 sticky top-0">
                        <tr>
                            {columns.map((col, index) => (
                                <th key={index} className={`px-6 py-3 ${col.headerClassName || ''}`}>
                                    {col.header}
                                </th>
                            ))}
                        </tr>
                    </thead>

                    <tbody className="divide-y divide-[#162b25]/30 text-[#162b25]">
                        {data.map((item) => (
                            <tr key={keyExtractor(item)} className="hover:bg-[#162b25]/5 transition-colors ">
                                {columns.map((col, index) => (
                                    <td key={index} className={`px-6 py-4 ${col.className || ''}`}>
                                        {col.render
                                            ? col.render(item)
                                            : (col.accessorKey ? String(item[col.accessorKey] ?? '') : '')}
                                    </td>
                                ))}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* PAGINACIÓN */}
            {(currentPage !== undefined && totalPages !== undefined) && (
                <div className="bg-[#162b25] px-4 py-3 border-t border-[#b2e1d8]/20 flex justify-between">
                    <button
                        onClick={onPrevPage}
                        disabled={currentPage === 1}
                        className="px-4 py-2 border border-[#b2e1d8]/30 rounded-md bg-[#19322f] text-[#b2e1d8] disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <ChevronLeftIcon className="w-5 h-5" />
                    </button>

                    <span className="text-[#b2e1d8]/60">
                        {currentPage} / {totalPages}
                    </span>

                    <button
                        onClick={onNextPage}
                        disabled={currentPage === totalPages}
                        className="px-4 py-2 border border-[#b2e1d8]/30 rounded-md bg-[#19322f] text-[#b2e1d8] disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <ChevronRightIcon className="w-5 h-5" />
                    </button>
                </div>
            )}
        </Card>
    );
};