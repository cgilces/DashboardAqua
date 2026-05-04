import React from "react";
import { Shield, User, LogOut } from "lucide-react";
import { useAuth } from "../auth/AuthContext";

export const Header: React.FC = () => {
  const { logout } = useAuth();

  const stored = localStorage.getItem("app_user_session");
  if (!stored) return null;

  const u = JSON.parse(stored);
  const user = u.username;
  const rol = u.role;

  return (
    <header className="sticky top-0 z-20 text-white">
      <div className="w-full flex justify-center">
        {/* CONTENEDOR CENTRAL */}
        <div className="flex items-center h-12 md:h-14 px-4 md:px-6 rounded-full gap-4
                        bg-[#012E24]/90 backdrop-blur border border-[#046C5E]/60 shadow-sm">

          {/* ROL */}
          <span className="inline-flex items-center gap-1.5 text-xs md:text-sm font-semibold uppercase bg-[#046C5E]/60 px-3 py-1 rounded-full tracking-wide">
            <Shield size={12} />
            {rol}
          </span>

          {/* USUARIO */}
          <span className="inline-flex items-center gap-1.5 text-xs md:text-sm font-medium text-white/90">
            <User size={14} />
            {user}
          </span>

          {/* LOGOUT */}
          <button
            onClick={logout}
            className="flex items-center gap-2 text-xs md:text-sm font-medium
                       px-3 md:px-4 py-1 md:py-1.5 rounded-md
                       border border-white/30 hover:bg-white/10 transition"
          >
            <LogOut size={14} />
            <span>Cerrar Sesión</span>
          </button>

        </div>
      </div>
    </header>
  );
};
