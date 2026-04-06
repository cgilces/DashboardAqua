import React from 'react';

/**
 * Define the color variants based on the user's specific palette.
 * Added 'outline', 'ghost', and 'input' for versatility.
 */
export type ButtonVariant =
    | 'claroaqua'
    | 'verdeaqua'
    | 'verdeclaroaqua'
    | 'outline'
    | 'ghost'
    | 'input'; // Nueva variante que simula un input

export type ButtonSize = 'sm' | 'md' | 'lg' | 'icon';

/**
 * Extendemos de HTMLAttributes<HTMLElement> para tener las propiedades base.
 * Definimos manualmente las propiedades específicas de Button y Label para evitar conflictos de tipos
 * que ocurren al extender simultáneamente ButtonHTMLAttributes y LabelHTMLAttributes.
 */
export interface ButtonProps extends React.HTMLAttributes<HTMLElement> {
    /** The content of the button. */
    children?: React.ReactNode;
    /** The visual style variant */
    variant?: ButtonVariant;
    /** The size of the button */
    size?: ButtonSize;
    /** An optional icon component to render */
    icon?: React.ReactNode;
    /** Position of the icon relative to the text */
    iconPosition?: 'left' | 'right';
    /** Shows a loading spinner and disables interaction */
    isLoading?: boolean;
    /** Permite renderizar el componente como 'button' (default) o 'label' */
    as?: 'button' | 'label';
    /** ID del input al que apunta el label (solo si as="label") */
    htmlFor?: string;
    /** Button type (solo si as="button") */
    type?: "submit" | "reset" | "button";
    /** Disabled state (solo si as="button") */
    disabled?: boolean;
}

const Button: React.FC<ButtonProps> = ({
    children,
    onClick,
    variant = 'claroaqua',
    size = 'md',
    className = '',
    disabled,
    icon,
    iconPosition = 'left',
    isLoading = false,
    as = 'button',
    htmlFor,
    ...props
}) => {

    // Elemento dinámico: puede ser 'button' o 'label'
    const Component = as as React.ElementType;

    // Estilos base comunes para todos los botones
    // Nota: 'cursor-pointer' es vital para que el label se sienta como botón
    const baseStyles = "inline-flex items-center rounded-lg transition-all duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer shadow-sm";

    // Estilos específicos para botones de acción (Botones normales)
    const actionBase = "justify-center   font-bold uppercase tracking-wider hover:shadow-md active:scale-95";

    // Estilos específicos para botones tipo Input
    const inputBase = "justify-between font-normal normal-case hover:border-[#9adfd3] hover:ring-1 hover:ring-[#9adfd3] focus:border-[#6baf8e] focus:ring-[#6baf8e] bg-white border border-slate-300 text-slate-700 w-full";

    // Mapeo de variantes de color y estilo
    const variantStyles: Record<ButtonVariant, string> = {
        claroaqua: `${actionBase} bg-[#BEDACC] text-[#19322f] hover:bg-[#9adfd3] focus:ring-[#9adfd3]`,
        verdeaqua: `${actionBase} bg-[#162b25] text-white hover:bg-[#2c4f45] focus:ring-[#162b25]`,
        verdeclaroaqua: `${actionBase} bg-[#6baf8e] text-[#19322f] hover:bg-[#5a9e7d] focus:ring-[#6baf8e]`,
        outline: `${actionBase} bg-transparent border-2 border-[#19322f] text-[#19322f] hover:bg-[#BEDACC]/20 focus:ring-[#19322f]`,
        ghost: `${actionBase} bg-transparent text-[#19322f] border-[#19322f]/20 hover:bg-[#BEDACC]/30 shadow-none hover:shadow-none focus:ring-[#BEDACC]`,
        input: inputBase, // Variante estilo input

    };

    // Ajustes de tamaño
    const sizeStyles = {
        sm: "px-2 py-1 text-xs gap-1",
        md: "px-4 py-3 text-sm gap-2",
        lg: "px-6 py-4 text-base gap-3",
        icon: "p-3 aspect-square text-sm justify-center",
    };

    // Calcular la clase final
    const computedClass = `
        ${baseStyles} 
        ${variantStyles[variant]} 
        ${sizeStyles[size]} 
        ${className}
    `;

    // Spinner de carga
    const Spinner = () => (
        <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
    );

    // Propiedades adicionales
    // Si es label, necesitamos 'htmlFor'. Si es botón, necesitamos 'type' (default button).
    // Filtramos disabled si es label, ya que label no soporta atributo disabled nativo (pero usaremos CSS para simularlo).
    const elementProps = {
        ...props,
        onClick: disabled || isLoading ? undefined : onClick,
        htmlFor: as === 'label' ? htmlFor : undefined,
        disabled: as === 'button' ? (disabled || isLoading) : undefined,
        // Añadir atributos aria para accesibilidad en labels 'deshabilitados'
        'aria-disabled': disabled || isLoading,
        type: as === 'button' ? (props.type || 'button') : undefined
    };

    return (
        <Component
            className={computedClass.trim().replace(/\s+/g, ' ')}
            {...elementProps}
        >
            {/* Contenido Izquierdo (Spinner o Icono) */}
            <span className="flex items-center gap-2 pointer-events-none">
                {isLoading && <Spinner />}
                {!isLoading && icon && iconPosition === 'left' && (
                    <span className="opacity-70">{icon}</span>
                )}
                {children}
            </span>

            {/* Contenido Derecho */}
            {!isLoading && icon && iconPosition === 'right' && (
                <span className="opacity-70 ml-2 pointer-events-none">{icon}</span>
            )}
        </Component>
    );
};

export default Button;