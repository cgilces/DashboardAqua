
import React from 'react';

interface CardProps {
  children: React.ReactNode;
  className?: string;
  color?: string;
}

export const Card: React.FC<CardProps> = ({ children, className = '', color }) => {
  return (
    <div className={`${color}  border border-[#162b25] rounded-xl shadow-lg overflow-hidden ${className}`}>
      {children}
    </div>
  );
};
