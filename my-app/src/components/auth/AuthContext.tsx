import React, { createContext, useContext, useState, useEffect } from 'react';
import { User } from '../../types';
import { useNavigate } from 'react-router-dom';
import { API_BASE_URL } from '../../config';
import { moduloInicial } from '../../utils/visibilidad';

export type { User };

interface AuthContextType {
  user: User | null;
  login: (usuario: string, clave: string) => Promise<void>;
  solicitarCodigoRegistro: (usuario: string, clave: string) => Promise<boolean>;
  confirmarRegistro: (usuario: string, clave: string, codigo: string) => Promise<boolean>;
  logout: () => void;
  loading: boolean;
  error: string | null;
}

// Tiempo de inactividad antes del cierre automático (5 minutos).
const INACTIVITY_TIMEOUT_MS = 5 * 60 * 1000;
const LAST_ACTIVITY_KEY = 'app_last_activity';

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

  // ─────────────────────────────────────────────────────────
  // AUTO-LOGOUT POR INACTIVIDAD
  // Cierra sesión y vuelve a /login después de 5 min sin
  // interacción del usuario (mouse, teclado, scroll, touch).
  // Sincronizado entre pestañas vía localStorage.
  // ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (!user) return;

    let timerId: number | undefined;

    const cerrarPorInactividad = () => {
      // Limpia sesión sin pasar por navigate dos veces.
      setUser(null);
      localStorage.removeItem('app_user_session');
      localStorage.removeItem('app_token');
      localStorage.removeItem(LAST_ACTIVITY_KEY);
      alert('Tu sesión se cerró por inactividad. Inicia sesión nuevamente.');
      navigate('/', { replace: true });
    };

    const programarCierre = () => {
      const last = Number(localStorage.getItem(LAST_ACTIVITY_KEY) || Date.now());
      const transcurrido = Date.now() - last;
      const restante = INACTIVITY_TIMEOUT_MS - transcurrido;
      if (restante <= 0) {
        cerrarPorInactividad();
        return;
      }
      window.clearTimeout(timerId);
      timerId = window.setTimeout(programarCierre, restante);
    };

    const registrarActividad = () => {
      localStorage.setItem(LAST_ACTIVITY_KEY, String(Date.now()));
      programarCierre();
    };

    // Sincronización entre pestañas: si otra pestaña registra actividad,
    // refrescamos el timer aquí también.
    const onStorage = (e: StorageEvent) => {
      if (e.key === LAST_ACTIVITY_KEY) programarCierre();
    };

    const eventos: (keyof WindowEventMap)[] = [
      'mousemove', 'mousedown', 'keydown', 'scroll', 'touchstart', 'click',
    ];
    eventos.forEach(ev => window.addEventListener(ev, registrarActividad, { passive: true }));
    window.addEventListener('storage', onStorage);

    // Inicializa el contador.
    localStorage.setItem(LAST_ACTIVITY_KEY, String(Date.now()));
    programarCierre();

    return () => {
      window.clearTimeout(timerId);
      eventos.forEach(ev => window.removeEventListener(ev, registrarActividad));
      window.removeEventListener('storage', onStorage);
    };
  }, [user, navigate]);

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
      // Señal para que el modal de bienvenida JARVIS salude (una vez) tras el login.
      try {
        sessionStorage.setItem('jarvis_saludar', '1');
        sessionStorage.removeItem('jarvis_modal_sesion');
      } catch {}

      // ── Redirección según rol ──────────────────────
      if (loggedUser.role === "VENDEDOR") {
        const tieneRuta = Array.isArray(loggedUser.assigned_routes) && loggedUser.assigned_routes.length > 0;
        if (!tieneRuta) {
          setError("Tu usuario no tiene rutas asignadas. Contacta al administrador.");
          setLoading(false);
          return;
        }
        // Aterriza en el módulo de su canal (botellón/preventa/hielo) según su ruta.
        navigate(moduloInicial(loggedUser.assigned_routes));

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

  // ─────────────────────────────────────────────────────────
  // REGISTRO POR CÓDIGO — PASO 1
  // Solicita el envío de un código de verificación al correo de
  // control (cgilces@aqua.com.ec). No crea la cuenta todavía.
  // Devuelve true si el código se envió correctamente.
  // ─────────────────────────────────────────────────────────
  const solicitarCodigoRegistro = async (usuario: string, clave: string): Promise<boolean> => {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`${API_BASE_URL}/api/login/registro/solicitar-codigo`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ usuario, clave }),
      });

      const data = await res.json();

      if (!res.ok || !data.ok) {
        setError(data.msg || "No se pudo enviar el código de verificación");
        return false;
      }
      return true;

    } catch (err: any) {
      console.error("Solicitar código error:", err);
      setError("No se pudo conectar con el servidor");
      return false;
    } finally {
      setLoading(false);
    }
  };

  // ─────────────────────────────────────────────────────────
  // REGISTRO POR CÓDIGO — PASO 2
  // Verifica el código; si es correcto el backend crea la cuenta
  // ADMIN y aquí se inicia sesión automáticamente.
  // Devuelve true si la cuenta se creó.
  // ─────────────────────────────────────────────────────────
  const confirmarRegistro = async (usuario: string, clave: string, codigo: string): Promise<boolean> => {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`${API_BASE_URL}/api/login/registro/confirmar`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ usuario, clave, codigo }),
      });

      const data = await res.json();

      if (!res.ok || !data.ok) {
        setError(data.msg || "No se pudo crear la cuenta");
        setLoading(false);
        return false;
      }

      // Cuenta creada → inicia sesión automáticamente.
      await login(usuario, clave);
      return true;

    } catch (err: any) {
      console.error("Confirmar registro error:", err);
      setError("No se pudo conectar con el servidor");
      setLoading(false);
      return false;
    }
  };

  const logout = () => {
    setUser(null);
    localStorage.clear();
    navigate('/');
  };

  return (
    <AuthContext.Provider value={{ user, login, solicitarCodigoRegistro, confirmarRegistro, logout, loading, error }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};