
import React, { useEffect, useState } from 'react';

interface TransitionProps {
  show: boolean;
  children: React.ReactNode;
}

export const Transition: React.FC<TransitionProps> = ({ show, children }) => {
  const [shouldRender, setShouldRender] = useState(show);

  useEffect(() => {
    if (show) {
      setShouldRender(true);
    } else {
      const timer = setTimeout(() => setShouldRender(false), 300); // Match duration of leave transition
      return () => clearTimeout(timer);
    }
  }, [show]);

  if (!shouldRender) {
    return null;
  }

  return (
    <div
      className={`transition-all duration-300 ease-in-out ${
        show ? 'opacity-100' : 'opacity-0'
      }`}
    >
      {children}
    </div>
  );
};
