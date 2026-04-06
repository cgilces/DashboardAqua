import React from "react";

interface BuscadorFrecuenciaProps {
    valor: string;
    alCambiar: (valor: string) => void;
    placeholder?: string;
}

const BuscadorFrecuencia: React.FC<BuscadorFrecuenciaProps> = ({
    valor,
    alCambiar,
    placeholder = "Buscar por RUC o Cliente..."
}) => {
    return (
<div className="w-full flex justify-center mt-4">
    <div className="flex items-center gap-3 w-full md:w-1/2">

            {/* Etiqueta */}
            <label className="text-[#162b25] text-sm font-medium">Buscar:</label>

            {/* Campo de entrada */}
            <div className="relative flex-grow">
                <input
                    type="text"
                    value={valor}
                    onChange={(e) => alCambiar(e.target.value)}
                    placeholder={placeholder}
                    className="
                        w-full bg-white border border-[#b2e1d8]/40 rounded-lg 
                        text-[#162b25] placeholder-[#6c8a82] text-sm 
                        px-3 py-2 focus:outline-none focus:ring-1 focus:ring-[#6BAF8E]
                    "
                />

                {/* Icono de búsqueda */}
                <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                    <svg
                        className="w-5 h-5 text-[#6c8a82]"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        viewBox="0 0 24 24"
                    >
                        <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M21 21l-4.35-4.35M16 10a6 6 0 11-12 0 6 6 0 0112 0z"
                        />
                    </svg>
                </div>
            </div>

        </div>
        </div>
    );
};

export default BuscadorFrecuencia;
