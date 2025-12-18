
import React, { useEffect } from 'react';
import { Transition } from './Transition';
import { CheckCircleIcon, XCircleIcon } from './Icons';

interface ToastProps {
  message: string;
  type: 'success' | 'error';
  show: boolean;
  onClose: () => void;
}

export const Toast: React.FC<ToastProps> = ({ message, type, show, onClose }) => {
  useEffect(() => {
    if (show) {
      const timer = setTimeout(() => {
        onClose();
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [show, onClose]);

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 pointer-events-none">
      <Transition show={show}>
        <div className={`flex items-center p-4 rounded-lg shadow-lg border pointer-events-auto ${type === 'success'
            ? 'bg-gray-800 border-green-600 text-green-400'
            : 'bg-gray-800 border-red-600 text-red-400'
          }`}>
          <div className="flex-shrink-0 mr-3">
            {type === 'success' ? (
              <CheckCircleIcon className="w-6 h-6" />
            ) : (
              <XCircleIcon className="w-6 h-6" />
            )}
          </div>
          <div className="font-medium text-sm">{message}</div>
        </div>
      </Transition>
    </div>
  );
};
