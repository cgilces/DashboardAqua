import React from 'react';

interface InputProps {
    type: string;
    value: string;
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
    className?: string;
    placeholder?: string;
    required?: boolean;
    accept?: string;
    onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
    onBlur?: (e: React.FocusEvent<HTMLInputElement>) => void;
}

const Input = ({ type, value, onChange, className, placeholder, required, accept, onKeyDown, onBlur }: InputProps) => {
    switch (type) {
        case 'file':
            return (
                <input
                    type={type}
                    value={value}
                    accept={accept}
                    onChange={onChange}
                    className={className || "bg-[#BEDACC] hidden  hover:bg-[#9adfd3] disabled:opacity-70 text-[#19322f] font-bold py-3 rounded-lg transition-colors flex justify-center items-center shadow-lg uppercase tracking-wider text-sm"}
                    placeholder={placeholder}
                    required
                />
            );
        default:
            return (
                <input
                    type={type}
                    value={value}
                    accept={accept}
                    onChange={onChange}
                    className={className || "w-full bg-[#f3f3f3] border border-[#162b25] rounded-lg px-2 py-2 text-[#162b25] placeholder-[#162b25] focus:ring-2 focus:ring-[#162b25] focus:border-transparent outline-none transition-all"}
                    placeholder={placeholder}
                    required
                />
            );
    }

};

export default Input;