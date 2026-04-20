import React from "react";
import { ExitIcon } from "./Icons";
import { useAuth } from "../auth/AuthContext";

export const Header: React.FC = () => {
  const { logout } = useAuth();

  const stored = localStorage.getItem("app_user_session");
  if (!stored) return null;

  const u = JSON.parse(stored);
  const user = u.username;
  const rol = u.role;

  return (
    <header className="sticky top-0 z-20 text-white w-full">
      <div className="w-full flex justify-center sm:justify-end pr-0 sm:pr-2">
        <div
          className="flex items-center h-10 sm:h-12 md:h-14 px-3 sm:px-4 md:px-6 gap-2 sm:gap-3 md:gap-4
                     rounded-full bg-[#012E24]/90 backdrop-blur border border-[#046C5E]/60 shadow-sm
                     max-w-full overflow-hidden"
        >
          {/* ROL — oculto en xs muy pequeños, visible desde sm */}
          <span
            className="hidden xs:inline-flex text-[10px] sm:text-xs md:text-sm font-semibold uppercase
                       bg-[#046C5E]/60 px-2 sm:px-3 py-0.5 sm:py-1 rounded-full tracking-wide whitespace-nowrap"
          >
            {rol}
          </span>

          {/* USUARIO — truncado en móvil */}
          <span
            className="text-xs md:text-sm font-medium text-white/90 truncate max-w-[80px] sm:max-w-[140px] md:max-w-none"
            title={user}
          >
            {user}
          </span>

          {/* LOGOUT — icono solo en mobile, texto completo en md+ */}
          <button
            onClick={logout}
            className="flex items-center gap-1 sm:gap-2 text-xs md:text-sm font-medium
                       px-2 sm:px-3 md:px-4 py-1 md:py-1.5 rounded-md
                       border border-white/30 hover:bg-white/10 active:bg-white/20 transition
                       whitespace-nowrap"
            aria-label="Cerrar sesión"
          >
            <ExitIcon />
            <span className="hidden sm:inline">Cerrar Sesión</span>
          </button>
        </div>
      </div>
    </header>
  );
};
