import React, { useState } from "react";

const ChatFlotante: React.FC = () => {
    const [abierto, setAbierto] = useState(false);
    const [mensajes, setMensajes] = useState([
        { tipo: "bot", texto: "Hola 👋 ¿En qué puedo ayudarte hoy?" },
    ]);
    const [input, setInput] = useState("");

    const enviarMensaje = () => {
        if (!input.trim()) return;

        const nuevoMensaje = { tipo: "user", texto: input };

        setMensajes((prev) => [...prev, nuevoMensaje]);
        setInput("");

        // 🔥 Aquí luego conectamos con tu backend
    };

    return (
        <>
            {/* BOTÓN FLOTANTE */}
            <button
                onClick={() => setAbierto(!abierto)}
                className="
                    fixed bottom-6 right-6
                    w-16 h-16
                    rounded-full
                    bg-gradient-to-br from-[#D2B858] to-[#b89e3f]
                    border border-[#ffffff30]
                    shadow-[0_8px_25px_rgba(210,184,88,0.45)]
                    backdrop-blur-md
                    flex items-center justify-center
                    text-white text-2xl
                    transition-all duration-300 ease-in-out
                    hover:scale-110
                    hover:shadow-[0_12px_35px_rgba(210,184,88,0.65)]
                    active:scale-95
                    z-50
                "
            >
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="#000000" className="icon icon-tabler icons-tabler-filled icon-tabler-message-chatbot"><path stroke="none" d="M0 0h24v24H0z" fill="none" /><path d="M18 3a4 4 0 0 1 4 4v8a4 4 0 0 1 -4 4h-4.724l-4.762 2.857a1 1 0 0 1 -1.508 -.743l-.006 -.114v-2h-1a4 4 0 0 1 -3.995 -3.8l-.005 -.2v-8a4 4 0 0 1 4 -4zm-2.8 9.286a1 1 0 0 0 -1.414 .014a2.5 2.5 0 0 1 -3.572 0a1 1 0 0 0 -1.428 1.4a4.5 4.5 0 0 0 6.428 0a1 1 0 0 0 -.014 -1.414m-5.69 -4.286h-.01a1 1 0 1 0 0 2h.01a1 1 0 0 0 0 -2m5 0h-.01a1 1 0 0 0 0 2h.01a1 1 0 0 0 0 -2" /></svg>
            </button>


            {/* VENTANA CHAT */}
            {abierto && (
                <div
                    className="
            fixed bottom-24 right-6
            w-80 sm:w-96
            bg-[#BEDACC]
            border border-[#046C5E]
            rounded-xl
            shadow-2xl
            flex flex-col
            overflow-hidden
            z-50
            animate-fadeIn
          "
                >
                    {/* HEADER */}
                    <div className="bg-[#014434] px-4 py-3 flex justify-between items-center">
                        <span className="text-white font-semibold">Asistente Virtual</span>
                        <button
                            onClick={() => setAbierto(false)}
                            className="text-gray-300 hover:text-white"
                        >
                            ✕
                        </button>
                    </div>

                    {/* MENSAJES */}
                    <div className="flex-1 p-4 overflow-y-auto space-y-3 text-sm">
                        {mensajes.map((m, i) => (
                            <div
                                key={i}
                                className={`max-w-[80%] px-3 py-2 rounded-lg ${m.tipo === "user"
                                    ? "ml-auto bg-emerald-600 text-white"
                                    : "bg-[#025f4b] text-gray-100"
                                    }`}
                            >
                                {m.texto}
                            </div>
                        ))}
                    </div>

                    {/* INPUT */}
                    <div className="p-3 border-t border-[#046C5E] flex gap-2">
                        <input
                            type="text"
                            placeholder="Escribe tu mensaje..."
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            className="
                flex-1
                px-3 py-2
                rounded-md
                bg-[#014f3e]
                text-white
                text-sm
                focus:outline-none
                focus:ring-2
                focus:ring-emerald-400
              "
                            onKeyDown={(e) => e.key === "Enter" && enviarMensaje()}
                        />

                        <button
                            onClick={enviarMensaje}
                            className="
                px-4 py-2
                bg-emerald-500
                hover:bg-emerald-600
                rounded-md
                text-white
                text-sm
                transition
              "
                        >
                            ➤
                        </button>
                    </div>
                </div>
            )}
        </>
    );
};

export default ChatFlotante;
