import React, { useState } from 'react';
import { AlertTriangle, X } from 'lucide-react';
import Button from './Button';

/**
 * ConfirmationModal Component
 * Handles the display, closing, and action logic for the delete confirmation dialog.
 */
const Modal = ({ isOpen, itemToDelete, onConfirm, onClose }) => {
    if (!isOpen) return null;

    return (
        <div
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50 animate-fade-in"
            onClick={onClose}
        >
            <div
                className="bg-white rounded-2xl shadow-2xl max-w-sm w-full transform transition-all animate-slide-up"
                // Previene que el click en el contenido cierre el modal
                onClick={(e) => e.stopPropagation()}
            >
                {/* El botón de cerrar (X) ha sido eliminado para un diseño más simple. 
            Ahora se usa solo el botón "Cancelar" y el click en el fondo. */}

                {/* Ícono de advertencia - Más pequeño y menos padding */}
                <div className="flex justify-center pt-5 pb-1">
                    <div className="bg-red-100 rounded-full p-3"> {/* Usando red-100 */}
                        <AlertTriangle className="text-red-500" size={32} /> {/* Usando red-500 */}
                    </div>
                </div>

                {/* Header - Menos espacio vertical */}
                <div className="text-center px-6 pb-1">
                    <h2 className="text-xl font-bold text-gray-800 mb-1">
                        Confirmar Eliminación
                    </h2>
                    <p className="text-sm text-gray-600">
                        Esta acción es irreversible. ¿Deseas continuar?
                    </p>
                </div>

                {/* Body (Item Details) - Menos padding exterior e interior */}
                <div className="px-6 pb-3">
                    <div className="bg-[#FFFFF] border border-green-200 rounded-xl p-3">
                        <p className="text-xs text-green-700 font-medium">
                            Estás a punto de eliminar:
                        </p>
                        <p className="font-semibold text-green-900 mt-1 text-sm truncate">
                            "{itemToDelete}"
                        </p>
                    </div>
                </div>

                {/* Footer con botones - Menos padding alrededor */}
                <div className="flex gap-3 p-3 border-t border-gray-100 bg-gray-50 rounded-b-2xl">
                    <Button
                        onClick={onClose}
                        variant="ghost"
                        size="sm"
                        // Botón Cancelar: Estilo neutral de Tailwind
                        className="flex-1  text-gray-700 font-medium py-2 px-4 rounded-xl border border-gray-300 transition-colors shadow-sm text-sm"
                    >
                        Cancelar
                    </Button>
                    <Button
                        onClick={onConfirm}
                        variant="verdeaqua"
                        size="sm"
                        // Botón Eliminar: Estilo de advertencia de Tailwind (Rojo)
                        className="flex-1  text-white font-semibold py-2 px-4 rounded-xl transition-colors shadow-md shadow-red-200 text-sm"
                    >
                        Sí, Eliminar Permanentemente
                    </Button>
                </div>
            </div>
        </div>
    );
};
export default Modal;