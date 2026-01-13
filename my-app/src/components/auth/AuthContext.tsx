import React, { createContext, useContext, useState, useEffect } from 'react';
import { User } from '../../types';
import { useNavigate } from 'react-router-dom';

export type { User };

interface AuthContextType {
  user: User | null;
  login: (usuario: string, clave: string) => Promise<void>;
  logout: () => void;
  loading: boolean;
  error: string | null;
}

// Asegúrate de que esta exportación esté correcta
const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Recuperar sesión guardada
  useEffect(() => {
    const storedUser = localStorage.getItem('app_user_session');
    if (storedUser) {
      try {
        setUser(JSON.parse(storedUser));
      } catch (e) {
        localStorage.removeItem('app_user_session');
      }
    }
  }, []);

  // LOGIN usando backend PostgreSQL
  const login = async (usuario: string, clave: string) => {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("http://localhost:5000/api/login/inicio", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ usuario, clave }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.msg || "Error al iniciar sesión");
        setLoading(false);
        return;
      }

      const loggedUser: User = {
        id: data.user.id,
        username: data.user.usuario,
        role: data.user.rol,
        assigned_routes: data.user.rutas_asignadas,
      };

      setUser(loggedUser);
      localStorage.setItem('app_user_session', JSON.stringify(loggedUser));

      // Redirigir al dashboard después del login
      navigate('/dashboard/preventa');

    } catch (err: any) {
      console.error("Login error:", err);
      setError("No se pudo conectar con el servidor");
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    // Limpia estado
    setUser(null);

    // Borra TODO el localStorage
    localStorage.clear();

    // Redirige al login (ruta principal)
    navigate('/');
  };


  return (
    <AuthContext.Provider value={{ user, login, logout, loading, error }}>
      {children}
    </AuthContext.Provider>
  );
};

// Este es el hook que debes exportar correctamente
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};
