import React, { createContext, useContext, useState, useEffect } from 'react';
import { User } from '../../types';
import { useNavigate } from 'react-router-dom';
import { API_BASE_URL } from '../../config';

export type { User };

interface AuthContextType {
  user: User | null;
  login: (usuario: string, clave: string) => Promise<void>;
  logout: () => void;
  loading: boolean;
  error: string | null;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const navigate = useNavigate();
  const [user,    setUser]    = useState<User | null>(null);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState<string | null>(null);

  // Recuperar sesión guardada
  useEffect(() => {
    const storedUser = localStorage.getItem('app_user_session');
    if (storedUser) {
      try { setUser(JSON.parse(storedUser)); }
      catch (e) { localStorage.removeItem('app_user_session'); }
    }
  }, []);

  const login = async (usuario: string, clave: string) => {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`${API_BASE_URL}/api/login/inicio`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ usuario, clave }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.msg || "Error al iniciar sesión");
        setLoading(false);
        return;
      }

      const loggedUser: User = {
        id:              data.user.id,
        username:        data.user.usuario,
        role:            data.user.rol,
        assigned_routes: data.user.rutas_asignadas,
      };

      setUser(loggedUser);
      localStorage.setItem('app_user_session', JSON.stringify(loggedUser));
      localStorage.setItem('app_token', data.token);

      // ── Redirección según rol ──────────────────────
      if (loggedUser.role === "VENDEDOR") {
        const ruta = Array.isArray(loggedUser.assigned_routes) && loggedUser.assigned_routes.length > 0
          ? loggedUser.assigned_routes[0]
          : null;

        if (!ruta) {
          setError("Tu usuario no tiene rutas asignadas. Contacta al administrador.");
          setLoading(false);
          return;
        }

        const now  = new Date();
        const anio = now.getFullYear();
        const mes  = now.getMonth() + 1;
        navigate(`/dashboard/preventa`);

      } else if (loggedUser.role === "SUPERVISOR") {
        navigate('/dashboard/crearusuarios');

      } else {
        // ADMIN → dashboard principal
        navigate('/dashboard/preventa');
      }

    } catch (err: any) {
      console.error("Login error:", err);
      setError("No se pudo conectar con el servidor");
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    setUser(null);
    localStorage.clear();
    navigate('/');
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, loading, error }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};