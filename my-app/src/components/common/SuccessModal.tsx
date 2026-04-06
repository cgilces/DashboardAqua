
import React from 'react';
import { CheckCircleIcon } from './Icons';

interface SuccessModalProps {
  isOpen: boolean;
  onClose: () => void;
  message?: string;
}

export const SuccessModal: React.FC<SuccessModalProps> = ({ isOpen, onClose, message = 'Se ha guardado exitosamente.' }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center px-4 bg-[#19322f]/90 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-[#19322f] w-full max-w-sm rounded-2xl border border-[#b2e1d8] shadow-[0_0_30px_rgba(178,225,216,0.2)] p-8 flex flex-col items-center text-center transform transition-all scale-100">
        
        <div className="w-20 h-20 bg-[#b2e1d8]/10 rounded-full flex items-center justify-center mb-6">
            <CheckCircleIcon className="w-12 h-12 text-[#b2e1d8]" />
        </div>
        
        <h2 className="text-2xl font-bold text-[#b2e1d8] mb-2">¡Éxito!</h2>
        <p className="text-[#b2e1d8]/80 mb-8 text-lg">
          {message}
        </p>

        <button
          onClick={onClose}
          className="w-full bg-[#b2e1d8] hover:bg-[#9adfd3] text-[#19322f] font-bold text-lg py-3 rounded-xl transition-colors shadow-lg active:scale-95 transform duration-100"
        >
          Aceptar
        </button>
      </div>
    </div>
  );
};
