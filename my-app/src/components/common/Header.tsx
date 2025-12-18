
import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { AquaGotaparaMain, ExitIcon, MenuIcon, CloseIcon } from './Icons';
import { useAuth } from '../auth/AuthContext';

export const Header: React.FC = () => {
  const { logout } = useAuth();
  const location = useLocation();
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const stored = localStorage.getItem("app_user_session");
  if (!stored) return null;

  const u = JSON.parse(stored);
  const user = u.username;
  const rol = u.role;

  const isActive = (path: string) => location.pathname === path;

  return (
    <header className="bg-[#ffffff] shadow-md sticky top-0 z-10 border-b border-[#b2e1d8]/10">
      <div className="w-full mx-auto px-2 sm:px-4 md:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 gap-2">
          {/* Logo */}
          <div className="flex items-center gap-1 flex-shrink-0">
            <AquaGotaparaMain className="w-6 h-6 xs:w-8 xs:h-8 sm:w-10 sm:h-10 text-[#b2e1d8]" />
          </div>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center gap-1">
            <Link
              to="/"
              className={`px-4 py-2 rounded-lg font-medium transition-all duration-200 ${isActive('/')
                ? 'bg-[#bedacc] text-[#162b25] shadow-lg'
                : 'text-[#162b25] hover:bg-[#bedacc]/40'
                }`}
            >
              Rutas
            </Link>
            {rol === "ADMIN" && (
              <Link
                to="/createuser"
                className={`px-4 py-2 rounded-lg font-medium transition-all duration-200 ${isActive('/createuser')
                  ? 'bg-[#bedacc] text-[#162b25] shadow-lg'
                  : 'text-[#162b25] hover:bg-[#bedacc]/40'
                  }`}
              >
                Usuarios
              </Link>
            )}
          </nav>

          {/* Desktop User Info & Logout */}
          <div className="hidden md:flex items-center space-x-2 gap-4">
            <div className="flex items-center space-x-2">
              <span className="text-[#162b25] font-bold text-sm uppercase bg-[#bedacc] px-2 py-0.5 rounded">{rol}</span>
              <span className="text-[#162b25]/40 text-sm">|</span>
              <span className="text-[#162b25] text-sm font-bold">{user}</span>
            </div>
            <button
              onClick={logout}
              className="text-sm text-[#162b25] font-medium hover:bg-[#162b25] hover:text-[#ffffff] border border-[#162b25] py-1 px-6 gap-2 flex items-center rounded no-underline"
            >
              <ExitIcon />
              Cerrar Sesión
            </button>
          </div>

          {/* Mobile Menu Button */}
          <button
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            className="md:hidden flex-shrink-0 text-[#162b25] hover:text-[#b2e1d8] focus:outline-none p-1.5"
            aria-label="Menú"
          >
            {isMenuOpen ? (
              <CloseIcon className="w-6 h-6" />
            ) : (
              <MenuIcon className="w-6 h-6" />
            )}
          </button>
        </div>
      </div>

      {/* Mobile Menu Dropdown */}
      {isMenuOpen && (
        <div className="md:hidden bg-[#ffffff] border-t border-[#b2e1d8]/10 px-4 pt-4 pb-6 shadow-lg fixed top-16 w-full left-0 z-50 flex flex-col items-center">
          <div className="flex flex-col space-y-3 mb-6 w-full max-w-xs">
            <Link
              to="/"
              onClick={() => setIsMenuOpen(false)}
              className={`px-4 py-3 rounded-lg font-medium text-center transition-all duration-200 ${isActive('/')
                ? 'bg-[#bedacc] text-[#162b25]'
                : 'text-[#162b25] hover:bg-[#bedacc]/40'
                }`}
            >
              Rutas
            </Link>
            {rol === "ADMIN" && (
              <Link
                to="/createuser"
                onClick={() => setIsMenuOpen(false)}
                className={`px-4 py-3 rounded-lg font-medium text-center transition-all duration-200 ${isActive('/createuser')
                  ? 'bg-[#b2e1d8] text-[#162b25]'
                  : 'text-[#162b25] hover:bg-[#b2e1d8]/10'
                  }`}
              >
                Usuarios
              </Link>
            )}
          </div>

          <div className="border-t border-[#b2e1d8]/20 pt-6 w-full max-w-xs flex flex-col gap-4">
            <div className="flex items-center justify-center gap-2">
              <span className="text-[#162b25] font-bold text-xs uppercase bg-[#bedacc] px-3 py-1 rounded-full">{rol}</span>
              <span className="text-[#162b25] text-sm font-medium">{user}</span>
            </div>
            <button
              onClick={logout}
              className="w-full text-sm text-[#162b25] font-medium hover:bg-[#162b25] hover:text-[#ffffff] border border-[#162b25] py-2.5 px-4 gap-2 flex items-center justify-center rounded-lg no-underline transition-colors"
            >
              <ExitIcon />
              Cerrar Sesión
            </button>
          </div>
        </div>
      )}
    </header>
  );
};
