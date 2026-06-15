// components/elements/ErrorModalGlobal.tsx
// Modal de error GLOBAL: escucha el bus de errores (utils/errorGlobal) y muestra
// en pantalla, de forma descriptiva, cualquier error que ocurra en la app.
// Se monta una sola vez en la raíz (main.tsx). Encola si llegan varios.
import React, { useEffect, useState } from "react";
import { suscribirErrorGlobal, type ErrorGlobal } from "../../utils/errorGlobal";

const ErrorModalGlobal: React.FC = () => {
  const [cola, setCola] = useState<ErrorGlobal[]>([]);
  const actual = cola[0] || null;

  useEffect(() => {
    return suscribirErrorGlobal((err) => {
      setCola((prev) => (prev.length >= 5 ? prev : [...prev, err])); // tope anti-spam
    });
  }, []);

  const cerrar = () => setCola((prev) => prev.slice(1));

  if (!actual) return null;

  return (
    <>
      <style>{`
        @keyframes errModalIn { from { opacity:0; transform:translateY(16px) scale(0.97);} to { opacity:1; transform:translateY(0) scale(1);} }
        .err-modal-card { animation: errModalIn 0.22s cubic-bezier(0.34,1.56,0.64,1) both; }
      `}</style>
      <div
        className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm px-4"
        onClick={cerrar}
        role="presentation"
      >
        <div
          className="err-modal-card w-full max-w-md bg-[#0a1f18] border border-[#9a7c28]/60 rounded-2xl shadow-2xl overflow-hidden"
          onClick={(e) => e.stopPropagation()}
          role="alertdialog"
          aria-modal="true"
          aria-label={actual.titulo}
        >
          <div className="flex items-center gap-2.5 px-4 py-3 bg-gradient-to-r from-[#7a1f1f] to-[#9a2c2c]">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none"
              stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
              <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
            </svg>
            <h3 className="text-white font-semibold text-sm flex-1">{actual.titulo}</h3>
            {cola.length > 1 && (
              <span className="text-white/80 text-[11px] bg-black/20 rounded-full px-2 py-0.5">
                +{cola.length - 1} más
              </span>
            )}
          </div>
          <div className="px-4 py-4">
            <p className="text-gray-200 text-sm leading-relaxed whitespace-pre-line">{actual.mensaje}</p>
            {actual.detalle && (
              <p className="mt-2 text-[11px] text-gray-500 font-mono break-words">{actual.detalle}</p>
            )}
          </div>
          <div className="px-4 pb-4 flex justify-end">
            <button
              onClick={cerrar}
              className="px-4 py-2 rounded-lg bg-gradient-to-br from-[#D2B858] to-[#9a7c28] text-black text-sm font-semibold hover:scale-105 active:scale-95 transition-transform"
            >
              Entendido
            </button>
          </div>
        </div>
      </div>
    </>
  );
};

export default ErrorModalGlobal;
