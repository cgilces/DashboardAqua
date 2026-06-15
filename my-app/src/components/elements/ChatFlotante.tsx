import React, { useState, useRef, useEffect, useCallback } from "react";
import { Zap, FileText, BarChart3, Lightbulb, Check, Clock, Volume2, VolumeX, Mic, MicOff } from "lucide-react";
import { hablarConNavegador, precargarVoces, detenerNavegador } from "../../utils/vozNavegador";
import { ttsPremiumAgotado, marcarTtsPremiumAgotado } from "../../utils/vozEstado";
import { useAuth } from "../../components/auth/AuthContext";
import { API_BASE_URL } from '../../config';

// ═══════════════════════════════════════════════════
// TIPOS
// ═══════════════════════════════════════════════════
interface Mensaje {
  tipo: "bot" | "user";
  texto: string;
  timestamp?: string;
  esPDF?: boolean;
  pdfUrl?: string;
  pdfNombre?: string;
  formato?: "pdf" | "excel";
  totalRegistros?: number;
  expirado?: boolean;
}

// ═══════════════════════════════════════════════════
// CONSTANTES
// ═══════════════════════════════════════════════════
const STORAGE_KEY        = "aqua_chat_mensajes";
const STORAGE_ABIERTO    = "aqua_chat_abierto";
const STORAGE_VOZ        = "aqua_chat_voz"; // "true"/"false" — voz JARVIS activa
const MAX_MENSAJES_LOCAL = 30;
const PDF_TTL_MS         = 30 * 60 * 1000;

const MSG_BIENVENIDA: Mensaje = {
  tipo: "bot",
  texto: "Hola, soy el asistente del ERP Grupo Aqua. Puedo responder consultas y generar **reportes en PDF y Excel**. ¿En qué te puedo ayudar?",
  timestamp: new Date().toISOString(),
};

// ¿El chat está "fresco"? (solo el saludo por defecto, sin conversación real)
// Solo en ese caso reemplazamos por el saludo dinámico para no pisar historial.
const esChatFresco = (msgs: Mensaje[]) =>
  msgs.length === 1 && msgs[0].tipo === "bot" && !msgs[0].esPDF;

// Placeholders rotativos para el input (mantiene el chat "vivo")
const PLACEHOLDERS = [
  "Pregúntame: ventas de hoy...",
  "Solicita: reporte del mes...",
  "Consulta: top 10 clientes...",
  "Pide: cartera vencida en PDF...",
  "Analiza: rutas menos rentables...",
];

// Sugerencias agrupadas por categoría para mejor descubrimiento
const SUGERENCIAS_POR_CATEGORIA: { nombre: string; Icono: React.ComponentType<{ size?: number; className?: string }>; color: string; items: string[] }[] = [
  {
    nombre: "Consultas rápidas",
    Icono: Zap,
    color: "emerald",
    items: ["Ventas de hoy", "Top productos del mes", "Top clientes", "Clientes sin comprar"],
  },
  {
    nombre: "Reportes PDF",
    Icono: FileText,
    color: "amber",
    items: ["Reporte ventas del mes", "Reporte por vendedor", "Reporte cartera vencida", "Cumplimiento de metas"],
  },
  {
    nombre: "Análisis",
    Icono: BarChart3,
    color: "cyan",
    items: ["Efectividad de visitas", "Cobertura de rutas", "Margen por vendedor", "Comparativo mes anterior"],
  },
];

// ═══════════════════════════════════════════════════
// SONIDO
// ═══════════════════════════════════════════════════
function reproducirNotificacion() {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const tocar = (freq: number, inicio: number, duracion: number, volumen = 0.15) => {
      const osc = ctx.createOscillator(); const gain = ctx.createGain();
      osc.connect(gain); gain.connect(ctx.destination);
      osc.type = "sine"; osc.frequency.value = freq;
      gain.gain.setValueAtTime(0, ctx.currentTime + inicio);
      gain.gain.linearRampToValueAtTime(volumen, ctx.currentTime + inicio + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + inicio + duracion);
      osc.start(ctx.currentTime + inicio); osc.stop(ctx.currentTime + inicio + duracion);
    };
    tocar(880, 0, 0.12); tocar(1100, 0.13, 0.18);
  } catch {}
}

// ═══════════════════════════════════════════════════
// PERSISTENCIA
// ═══════════════════════════════════════════════════
function cargarMensajes(): Mensaje[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [MSG_BIENVENIDA];
    const parsed: Mensaje[] = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.length === 0) return [MSG_BIENVENIDA];
    const ahora = Date.now();
    return parsed.map(m => {
      if (m.esPDF && m.pdfUrl && m.timestamp) {
        const edad = ahora - new Date(m.timestamp).getTime();
        if (edad > PDF_TTL_MS) return { ...m, expirado: true };
      }
      return m;
    });
  } catch { return [MSG_BIENVENIDA]; }
}

function guardarMensajes(mensajes: Mensaje[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(mensajes.slice(-MAX_MENSAJES_LOCAL)));
  } catch {}
}

// ═══════════════════════════════════════════════════
// ICONOS
// ═══════════════════════════════════════════════════
const BotIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="26" height="26" viewBox="0 0 24 24" fill="#000000">
    <path stroke="none" d="M0 0h24v24H0z" fill="none"/>
    <path d="M18 3a4 4 0 0 1 4 4v8a4 4 0 0 1 -4 4h-4.724l-4.762 2.857a1 1 0 0 1 -1.508 -.743l-.006 -.114v-2h-1a4 4 0 0 1 -3.995 -3.8l-.005 -.2v-8a4 4 0 0 1 4 -4zm-2.8 9.286a1 1 0 0 0 -1.414 .014a2.5 2.5 0 0 1 -3.572 0a1 1 0 0 0 -1.428 1.4a4.5 4.5 0 0 0 6.428 0a1 1 0 0 0 -.014 -1.414m-5.69 -4.286h-.01a1 1 0 1 0 0 2h.01a1 1 0 0 0 0 -2m5 0h-.01a1 1 0 0 0 0 2h.01a1 1 0 0 0 0 -2"/>
  </svg>
);
const SendIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
  </svg>
);
const PDFIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
    <polyline points="14 2 14 8 20 8"/>
    <line x1="12" y1="18" x2="12" y2="12"/><line x1="9" y1="15" x2="15" y2="15"/>
  </svg>
);
const TrashIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/>
    <path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/>
  </svg>
);
const CopyIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
  </svg>
);
const LockIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
  </svg>
);

// ═══════════════════════════════════════════════════
// TYPING INDICATOR
// ═══════════════════════════════════════════════════
const TypingIndicator = () => (
  <div className="flex items-center gap-1 px-4 py-3 bg-[#1a3d30] rounded-xl max-w-[80px] border border-[#2a5a45]">
    {[0,1,2].map(i => (
      <span key={i} className="w-2 h-2 rounded-full bg-emerald-300 animate-bounce"
        style={{ animationDelay: `${i*0.15}s`, animationDuration: "0.8s" }}/>
    ))}
  </div>
);

// ═══════════════════════════════════════════════════
// TARJETA PDF
// ═══════════════════════════════════════════════════
const PDFCard: React.FC<{
  pdfUrl: string; pdfNombre: string; totalRegistros: number; expirado?: boolean; formato?: "pdf" | "excel";
}> = ({ pdfUrl, pdfNombre, totalRegistros, expirado, formato = "pdf" }) => {
  const [descargando, setDescargando] = useState(false);
  const [descargado,  setDescargado]  = useState(false);
  const esExcel = formato === "excel";
  const etiqueta = esExcel ? "Reporte Excel Listo" : "Reporte PDF Listo";

  if (expirado) return (
    <div className="mt-2 rounded-xl border border-red-800/40 bg-red-950/30 px-3 py-2.5">
      <p className="text-red-400 text-xs font-medium flex items-center gap-1.5"><Clock size={12} /> Este reporte expiró (30 min)</p>
      <p className="text-gray-500 text-[11px] mt-0.5">Vuelve a solicitarlo para regenerarlo.</p>
    </div>
  );

  const descargar = async () => {
    setDescargando(true);
    try {
      const token = localStorage.getItem("app_token") || "";
      const res   = await fetch(`${API_BASE_URL}${pdfUrl}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("expirado");
      const blob = await res.blob();
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement("a");
      a.href = url; a.download = pdfNombre; a.click();
      URL.revokeObjectURL(url);
      setDescargado(true);
      setTimeout(() => setDescargado(false), 3000);
    } catch {
      alert("El reporte expiró (30 min). Vuelve a solicitarlo.");
    } finally { setDescargando(false); }
  };

  return (
    <div className="mt-2 rounded-xl border border-[#D2B858]/40 bg-gradient-to-br from-[#1a3020] to-[#0d2010] overflow-hidden">
      <div className="bg-gradient-to-r from-[#D2B858] to-[#b89e3f] px-3 py-2 flex items-center gap-2">
        <PDFIcon /><span className="text-black font-bold text-xs uppercase tracking-wide">{etiqueta}</span>
      </div>
      <div className="px-3 py-2.5">
        <p className="text-gray-300 text-xs truncate mb-0.5">{pdfNombre.replace(/_/g," ").replace(/\.(pdf|xlsx)$/i,"")}</p>
        <p className="text-emerald-400 text-[11px]">{totalRegistros} registros exportados · {esExcel ? "Excel" : "PDF"}</p>
      </div>
      <div className="px-3 pb-3">
        <button onClick={descargar} disabled={descargando}
          className={`w-full py-2 rounded-lg text-xs font-bold uppercase tracking-wide transition-all flex items-center justify-center gap-2 shadow-[0_4px_12px_rgba(210,184,88,0.3)]
            ${descargado
              ? "bg-emerald-600 text-white"
              : "bg-gradient-to-r from-[#D2B858] to-[#b89e3f] text-black hover:from-[#e8cc6a] disabled:opacity-60"}`}>
          {descargando ? (
            <><span className="w-3 h-3 border-2 border-black/40 border-t-black rounded-full animate-spin"/>Descargando...</>
          ) : descargado ? <><Check size={14} /> Descargado</> : <><PDFIcon/>Descargar Reporte</>}
        </button>
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════
// MARKDOWN
// ═══════════════════════════════════════════════════
function renderMarkdown(texto: string): React.ReactNode {
  const lineas = texto.split("\n");
  const nodos: React.ReactNode[] = [];
  lineas.forEach((linea, li) => {
    if (/^\s*[-•]\s+/.test(linea)) {
      nodos.push(<div key={li} className="flex gap-1.5 my-0.5"><span className="text-emerald-400 mt-0.5 flex-shrink-0">•</span><span>{renderInline(linea.replace(/^\s*[-•]\s+/,""))}</span></div>);
    } else if (/^\s*\d+\.\s+/.test(linea)) {
      const num = linea.match(/^\s*(\d+)\./)?.[1];
      nodos.push(<div key={li} className="flex gap-1.5 my-0.5"><span className="text-emerald-400 flex-shrink-0 font-bold text-xs mt-0.5">{num}.</span><span>{renderInline(linea.replace(/^\s*\d+\.\s+/,""))}</span></div>);
    } else if (linea.trim() === "") {
      nodos.push(<div key={li} className="h-1.5"/>);
    } else {
      nodos.push(<div key={li}>{renderInline(linea)}</div>);
    }
  });
  return <>{nodos}</>;
}
function renderInline(texto: string): React.ReactNode {
  return texto.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/g).map((p, i) => {
    if (p.startsWith("**") && p.endsWith("**")) return <strong key={i} className="font-bold text-emerald-300">{p.slice(2,-2)}</strong>;
    if (p.startsWith("*")  && p.endsWith("*"))  return <em key={i} className="italic text-gray-300">{p.slice(1,-1)}</em>;
    return <span key={i}>{p}</span>;
  });
}

// ═══════════════════════════════════════════════════
// COMPONENTE PRINCIPAL
// ═══════════════════════════════════════════════════
const ChatFlotante: React.FC = () => {
  const { user }  = useAuth();
  const isAdmin   = (user?.role ?? "").toUpperCase() === "ADMIN";

  const [mensajes,    setMensajes]    = useState<Mensaje[]>(cargarMensajes);
  const [abierto,     setAbierto]     = useState(() => {
    try { return localStorage.getItem(STORAGE_ABIERTO) === "true"; } catch { return false; }
  });
  const [input,       setInput]       = useState("");
  const [cargando,    setCargando]    = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [copiado,     setCopiado]     = useState<number | null>(null);
  const [placeholderIdx, setPlaceholderIdx] = useState(0);
  const [vozActiva,   setVozActiva]   = useState(() => {
    try { return localStorage.getItem(STORAGE_VOZ) !== "false"; } catch { return true; }
  });
  const [hablando,    setHablando]    = useState(false);
  const [escuchando,  setEscuchando]  = useState(false);
  const [errorModal,  setErrorModal]  = useState<{ titulo: string; mensaje: string } | null>(null);

  const mensajesEndRef = useRef<HTMLDivElement>(null);
  const inputRef       = useRef<HTMLInputElement>(null);
  const bienvenidaPedida = useRef(false);
  const vozActivaRef   = useRef(vozActiva);
  const audioRef       = useRef<HTMLAudioElement | null>(null);
  const saludoHablado  = useRef(false);
  const recognitionRef = useRef<any>(null);
  const micToggleRef   = useRef<() => void>(() => {});

  // ¿El navegador soporta reconocimiento de voz (micrófono)?
  const vozSoportada = typeof window !== "undefined" &&
    !!((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition);

  useEffect(() => { guardarMensajes(mensajes); }, [mensajes]);
  useEffect(() => { precargarVoces(); }, []); // carga la mejor voz del navegador

  // ── VOZ (TTS ElevenLabs — "JARVIS") ──────────────────────────────────────
  const detenerVoz = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = "";
      audioRef.current = null;
    }
    detenerNavegador(); // cortar también la voz del navegador
    setHablando(false);
  }, []);

  // Voz de respaldo del navegador (premium: mejor voz es, troceado) si ElevenLabs no está.
  const hablarNavegador = useCallback((texto: string) => {
    hablarConNavegador(texto, () => setHablando(true)).then(() => setHablando(false));
  }, []);

  // Pide el audio al backend y lo reproduce. Se auto-silencia si la voz está
  // desactivada (lee vozActivaRef para funcionar dentro de callbacks async).
  const hablar = useCallback(async (texto: string) => {
    if (!vozActivaRef.current || !texto?.trim()) return;
    // Si ya sabemos que la voz premium no tiene saldo, ir directo a la del
    // navegador (Google) sin esperar el round-trip que falla.
    if (ttsPremiumAgotado()) { hablarNavegador(texto); return; }
    try {
      detenerVoz();
      const token = localStorage.getItem("app_token") || "";
      const res = await fetch(`${API_BASE_URL}/api/bot/voz`, {
        method:  "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body:    JSON.stringify({ texto }),
      });
      if (!res.ok) { marcarTtsPremiumAgotado(); hablarNavegador(texto); return; } // sin créditos/error → voz del navegador
      const blob = await res.blob();
      const url  = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audio.playbackRate = 1.08;                 // un pelín más rápido, más natural
      (audio as any).preservesPitch = true;
      (audio as any).webkitPreservesPitch = true;
      audioRef.current = audio;
      setHablando(true);
      audio.onended = () => {
        URL.revokeObjectURL(url);
        setHablando(false);
        if (audioRef.current === audio) audioRef.current = null;
      };
      audio.onerror = () => { URL.revokeObjectURL(url); setHablando(false); };
      await audio.play().catch(() => { setHablando(false); hablarNavegador(texto); }); // autoplay bloqueado
    } catch { hablarNavegador(texto); }
  }, [detenerVoz, hablarNavegador]);

  // Sincroniza el ref, persiste la preferencia y corta el audio al silenciar.
  useEffect(() => {
    vozActivaRef.current = vozActiva;
    try { localStorage.setItem(STORAGE_VOZ, String(vozActiva)); } catch {}
    if (!vozActiva) detenerVoz();
  }, [vozActiva, detenerVoz]);

  // Detener audio al desmontar.
  useEffect(() => () => detenerVoz(), [detenerVoz]);

  // Hablar el saludo de bienvenida cuando el chat se abre (evita el bloqueo de
  // autoplay: solo suena tras la interacción de abrir el chat).
  useEffect(() => {
    if (!abierto || !vozActiva || saludoHablado.current) return;
    // Si el modal de bienvenida ya saludó con voz esta sesión, no repetir.
    try { if (sessionStorage.getItem("jarvis_modal_sesion") === "1") { saludoHablado.current = true; return; } } catch {}
    if (mensajes.length === 1 && mensajes[0].tipo === "bot") {
      saludoHablado.current = true;
      hablar(mensajes[0].texto);
    }
  }, [abierto, vozActiva, mensajes, hablar]);

  // ── Saludo de bienvenida DINÁMICO (personalizado por nombre, hora y rol) ──
  // Pide al backend un saludo generado al vuelo y reemplaza el saludo por
  // defecto solo si el chat está fresco (sin conversación real).
  const cargarBienvenida = useCallback(async () => {
    try {
      const token = localStorage.getItem("app_token") || "";
      const res = await fetch(`${API_BASE_URL}/api/bot/bienvenida`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return;
      const data = await res.json();
      if (!data?.respuesta) return;
      setMensajes(prev =>
        esChatFresco(prev)
          ? [{ tipo: "bot", texto: data.respuesta, timestamp: new Date().toISOString() }]
          : prev
      );
    } catch { /* se queda el saludo por defecto */ }
  }, []);

  // Al montar (sesión activa) pide el saludo personalizado una sola vez.
  useEffect(() => {
    if (!user || bienvenidaPedida.current) return;
    if (esChatFresco(mensajes)) {
      bienvenidaPedida.current = true;
      cargarBienvenida();
    }
  }, [user, mensajes, cargarBienvenida]);

  useEffect(() => {
    try { localStorage.setItem(STORAGE_ABIERTO, String(abierto)); } catch {}
    if (abierto) {
      setUnreadCount(0);
      setTimeout(() => inputRef.current?.focus(), 300);
    }
  }, [abierto]);

  useEffect(() => {
    mensajesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [mensajes, cargando]);

  // Rotación del placeholder solo cuando el chat está abierto y vacío
  useEffect(() => {
    if (!abierto || input.length > 0) return;
    const id = setInterval(() => {
      setPlaceholderIdx(i => (i + 1) % PLACEHOLDERS.length);
    }, 3500);
    return () => clearInterval(id);
  }, [abierto, input.length]);

  const copiarMensaje = useCallback((texto: string, idx: number) => {
    navigator.clipboard.writeText(texto).then(() => {
      setCopiado(idx);
      setTimeout(() => setCopiado(null), 2000);
    });
  }, []);

  const limpiarChat = async () => {
    setMensajes([{ ...MSG_BIENVENIDA, timestamp: new Date().toISOString() }]);
    localStorage.removeItem(STORAGE_KEY);
    try {
      const token = localStorage.getItem("app_token") || "";
      await fetch(`${API_BASE_URL}/api/bot/limpiar`, {
        method: "POST", headers: { Authorization: `Bearer ${token}` },
      });
    } catch {}
    // Regenerar saludo personalizado fresco tras limpiar (y permitir que lo hable de nuevo).
    bienvenidaPedida.current = false;
    saludoHablado.current = false;
    detenerVoz();
    cargarBienvenida();
  };

  const enviarMensaje = async (textoOverride?: string) => {
    // Bloquear si no es admin
    if (!isAdmin) return;

    const texto = (textoOverride || input).trim();
    if (!texto || cargando) return;

    const nuevoUser: Mensaje = { tipo: "user", texto, timestamp: new Date().toISOString() };
    setMensajes(prev => [...prev, nuevoUser]);
    setInput("");
    setCargando(true);

    try {
      const token = localStorage.getItem("app_token") || "";
      const res   = await fetch(`${API_BASE_URL}/api/bot/chat`, {
        method:  "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body:    JSON.stringify({ mensaje: texto }),
      });
      if (res.status === 401) { localStorage.clear(); window.location.href = "/"; return; }
      if (!res.ok) {
        // Leer el mensaje real que envía el backend para mostrarlo en el modal,
        // en vez de un genérico que confunde al usuario.
        let mensaje = `Error ${res.status}. Intenta de nuevo en un momento.`;
        try {
          const errData = await res.json();
          if (errData?.respuesta) mensaje = errData.respuesta;
        } catch {}
        setErrorModal({ titulo: "No se pudo procesar tu solicitud", mensaje });
        return;
      }

      const data      = await res.json();
      const nuevoBot: Mensaje = {
        tipo:           "bot",
        texto:          data.respuesta || "Sin respuesta.",
        timestamp:      new Date().toISOString(),
        esPDF:          data.esPDF    || false,
        pdfUrl:         data.pdfUrl,
        pdfNombre:      data.pdfNombre,
        formato:        data.formato  || "pdf",
        totalRegistros: data.totalRegistros,
      };
      setMensajes(prev => [...prev, nuevoBot]);
      hablar(nuevoBot.texto); // voz JARVIS (se auto-silencia si está desactivada)

      if (!abierto) {
        setUnreadCount(c => c + 1);
        reproducirNotificacion();
        if ("vibrate" in navigator) navigator.vibrate([80, 40, 80]);
      }
    } catch {
      setErrorModal({
        titulo: "Sin conexión",
        mensaje: "No se pudo conectar con el servidor. Revisa tu conexión a internet e intenta de nuevo.",
      });
    } finally { setCargando(false); }
  };

  // ── MICRÓFONO (voz → texto, Web Speech API) ──────────────────────────────
  // Escucha la pregunta del usuario, la transcribe a español y la envía sola
  // al terminar de hablar (manos libres, estilo JARVIS).
  const toggleMicrofono = () => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) return;
    // Si ya está escuchando → detener.
    if (recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch {}
      return;
    }
    detenerVoz(); // si JARVIS está hablando, callar para escuchar
    const rec = new SR();
    rec.lang = "es-EC";
    rec.interimResults = true;
    rec.continuous = false;
    rec.maxAlternatives = 1;
    let finalText = "";
    rec.onresult = (e: any) => {
      let interim = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const t = e.results[i][0].transcript;
        if (e.results[i].isFinal) finalText += t; else interim += t;
      }
      setInput((finalText || interim).trim());
    };
    rec.onerror = () => { setEscuchando(false); recognitionRef.current = null; };
    rec.onend = () => {
      setEscuchando(false);
      recognitionRef.current = null;
      const texto = (finalText || "").trim();
      if (texto) enviarMensaje(texto);
    };
    recognitionRef.current = rec;
    setInput("");
    setEscuchando(true);
    try { rec.start(); } catch { setEscuchando(false); recognitionRef.current = null; }
  };

  // Mantener un ref al toggle actual para los listeners de eventos globales.
  useEffect(() => { micToggleRef.current = toggleMicrofono; });

  // Detener el reconocimiento al desmontar.
  useEffect(() => () => { try { recognitionRef.current?.stop(); } catch {} }, []);

  // Eventos del modal de bienvenida JARVIS:
  //  - "jarvis:escuchar"  → abre el chat y arranca el micrófono
  //  - "jarvis:abrir-chat"→ solo abre el chat
  useEffect(() => {
    const onEscuchar = () => {
      setAbierto(true);
      saludoHablado.current = true; // el modal ya saludó; no repetir voz
      setTimeout(() => micToggleRef.current(), 600);
    };
    const onAbrir = () => setAbierto(true);
    // Reflejar en el chat los turnos que maneja el modal de voz JARVIS.
    const onTurno = (e: Event) => {
      const det = (e as CustomEvent).detail || {};
      const nuevos: Mensaje[] = [];
      if (det.pregunta)  nuevos.push({ tipo: "user", texto: det.pregunta,  timestamp: new Date().toISOString() });
      if (det.respuesta) nuevos.push({ tipo: "bot",  texto: det.respuesta, timestamp: new Date().toISOString() });
      if (nuevos.length) setMensajes(prev => [...prev, ...nuevos]);
    };
    window.addEventListener("jarvis:escuchar", onEscuchar);
    window.addEventListener("jarvis:abrir-chat", onAbrir);
    window.addEventListener("jarvis:turno", onTurno);
    return () => {
      window.removeEventListener("jarvis:escuchar", onEscuchar);
      window.removeEventListener("jarvis:abrir-chat", onAbrir);
      window.removeEventListener("jarvis:turno", onTurno);
    };
  }, []);

  const formatTime = (ts?: string) => {
    if (!ts) return "";
    try { return new Date(ts).toLocaleTimeString("es-EC", { hour: "2-digit", minute: "2-digit" }); }
    catch { return ""; }
  };

  const mostrarSugerencias = mensajes.length <= 1;

  return (
    <>
      <style>{`
        @keyframes fadeSlideUp {
          from { opacity:0; transform:translateY(20px) scale(0.96); }
          to   { opacity:1; transform:translateY(0) scale(1); }
        }
        @keyframes pulse-ring {
          0%   { box-shadow: 0 0 0 0    rgba(210,184,88,0.6); }
          70%  { box-shadow: 0 0 0 14px rgba(210,184,88,0);   }
          100% { box-shadow: 0 0 0 0    rgba(210,184,88,0);   }
        }
        @keyframes badge-pop {
          0%   { transform: scale(0); }
          70%  { transform: scale(1.25); }
          100% { transform: scale(1); }
        }
        .chat-window  { animation: fadeSlideUp 0.28s cubic-bezier(0.34,1.56,0.64,1) both; }
        .pulse-ring   { animation: pulse-ring 1.8s ease-out infinite; }
        .badge-pop    { animation: badge-pop 0.3s cubic-bezier(0.34,1.56,0.64,1) both; }
        .msg-group:hover .copy-btn { opacity: 1; }
        .copy-btn { opacity: 0; transition: opacity 0.15s; }
        ::-webkit-scrollbar { width:5px; }
        ::-webkit-scrollbar-track { background:transparent; }
        ::-webkit-scrollbar-thumb { background:#046C5E88; border-radius:8px; }
      `}</style>

      {/* ── BOTÓN FLOTANTE ── */}
      <button onClick={() => setAbierto(v => !v)} aria-label="Abrir asistente"
        style={{ bottom: "calc(1rem + env(safe-area-inset-bottom))" }}
        className={`fixed right-4 sm:right-6 w-14 h-14 sm:w-16 sm:h-16 rounded-full z-50 bg-gradient-to-br from-[#D2B858] to-[#9a7c28] flex items-center justify-center shadow-[0_8px_28px_rgba(210,184,88,0.5)] transition-all duration-300 hover:scale-110 active:scale-95 ${!abierto ? "pulse-ring" : ""}`}>
        {abierto ? (
          <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none"
            stroke="#000" strokeWidth="2.5" strokeLinecap="round">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        ) : <BotIcon/>}
        {unreadCount > 0 && !abierto && (
          <span key={unreadCount} className="badge-pop absolute -top-1 -right-1 min-w-[20px] h-5 px-1 rounded-full bg-red-500 text-white text-[11px] font-bold flex items-center justify-center border-2 border-white">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {/* ── VENTANA CHAT ── */}
      {abierto && (
        <div
          style={{ bottom: "calc(5rem + env(safe-area-inset-bottom))" }}
          className="chat-window fixed left-4 right-4 sm:left-auto sm:right-6 w-auto sm:w-[420px] h-[min(640px,calc(100dvh-120px))] bg-gradient-to-b from-[#0d2b22] to-[#081a14] border border-[#1a4a3a] rounded-2xl shadow-[0_24px_60px_rgba(0,0,0,0.65)] flex flex-col overflow-hidden z-50 backdrop-blur-sm">

          {/* HEADER */}
          <div className="relative bg-gradient-to-r from-[#014434] via-[#025f4b] to-[#014434] px-4 py-3.5 flex items-center justify-between border-b border-[#1a4a3a] flex-shrink-0 overflow-hidden">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_50%,rgba(210,184,88,0.15),transparent_50%)] pointer-events-none"/>
            <div className="relative flex items-center gap-3">
              <div className="relative w-10 h-10 rounded-full bg-gradient-to-br from-[#D2B858] to-[#9a7c28] flex items-center justify-center shadow-[0_4px_14px_rgba(210,184,88,0.45)] flex-shrink-0">
                <BotIcon/>
                <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-emerald-400 border-2 border-[#014434] animate-pulse"/>
              </div>
              <div>
                <p className="text-white font-semibold text-sm leading-tight flex items-center gap-1.5">
                  Asistente Aqua
                  <span className="text-[9px] px-1.5 py-0.5 rounded-md bg-[#D2B858]/20 text-[#D2B858] font-bold tracking-wide">AI</span>
                </p>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"/>
                  <span className="text-emerald-300/90 text-[11px]">
                    {escuchando ? "Escuchando…" : hablando ? "Hablando…" : vozActiva ? "Voz activa · Reportes PDF" : "Consultas · Reportes PDF"}
                  </span>
                </div>
              </div>
            </div>
            <div className="relative flex items-center gap-1">
              <button onClick={() => setVozActiva(v => !v)}
                title={vozActiva ? "Silenciar voz" : "Activar voz"}
                className={`transition p-1.5 rounded-md hover:bg-white/10 ${vozActiva ? "text-emerald-300" : "text-gray-500 hover:text-gray-300"}`}>
                {vozActiva
                  ? <Volume2 size={15} className={hablando ? "animate-pulse" : ""}/>
                  : <VolumeX size={15}/>}
              </button>
              {isAdmin && (
                <button onClick={limpiarChat} title="Limpiar conversación"
                  className="text-gray-400 hover:text-amber-400 transition p-1.5 rounded-md hover:bg-white/10">
                  <TrashIcon/>
                </button>
              )}
              <button onClick={() => setAbierto(false)} title="Cerrar"
                className="text-gray-400 hover:text-white transition p-1.5 rounded-md hover:bg-white/10">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24"
                  fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>
          </div>

          {/* MENSAJES */}
          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3 min-h-0">
            {mensajes.map((m, i) => (
              <div key={i} className={`msg-group flex flex-col ${m.tipo === "user" ? "items-end" : "items-start"}`}>
                <div className={`relative max-w-[85%] px-3.5 py-2.5 rounded-xl text-sm leading-relaxed
                  ${m.tipo === "user"
                    ? "bg-gradient-to-br from-emerald-500 to-emerald-700 text-white rounded-br-sm"
                    : "bg-[#1a3d30] text-gray-100 border border-[#2a5a45] rounded-bl-sm"}`}>
                  <div className={m.tipo === "bot" ? "pr-10" : ""}>{renderMarkdown(m.texto)}</div>
                  {m.esPDF && m.pdfUrl && (
                    <PDFCard pdfUrl={m.pdfUrl} pdfNombre={m.pdfNombre || "reporte.pdf"}
                      totalRegistros={m.totalRegistros || 0} expirado={m.expirado} formato={m.formato}/>
                  )}
                  {m.tipo === "bot" && (
                    <>
                      <button onClick={() => hablar(m.texto)} title="Reproducir con voz"
                        className="copy-btn absolute top-2 right-7 p-1 rounded text-gray-500 hover:text-emerald-300 hover:bg-white/10 transition">
                        <Volume2 size={12}/>
                      </button>
                      <button onClick={() => copiarMensaje(m.texto, i)} title="Copiar respuesta"
                        className="copy-btn absolute top-2 right-2 p-1 rounded text-gray-500 hover:text-emerald-300 hover:bg-white/10 transition">
                        {copiado === i ? <Check size={12} className="text-emerald-400" /> : <CopyIcon/>}
                      </button>
                    </>
                  )}
                </div>
                <span className="text-[10px] text-gray-500 mt-1 px-1">{formatTime(m.timestamp)}</span>
              </div>
            ))}
            {cargando && (
              <div className="flex flex-col items-start">
                <TypingIndicator/>
                <span className="text-[10px] text-gray-500 mt-1 px-1">Procesando...</span>
              </div>
            )}
            <div ref={mensajesEndRef}/>
          </div>

          {/* SUGERENCIAS — agrupadas por categoría (solo admin) */}
          {isAdmin && mostrarSugerencias && (
            <div className="px-3 pb-2 flex-shrink-0 border-t border-[#1a4a3a]/60 bg-[#081a14]/40 max-h-[210px] overflow-y-auto">
              <p className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold pt-2 pb-1 px-1 sticky top-0 bg-[#081a14]/90 backdrop-blur-sm flex items-center gap-1.5">
                <Lightbulb size={11} /> Prueba con estas consultas
              </p>
              <div className="space-y-2 pb-1">
                {SUGERENCIAS_POR_CATEGORIA.map(cat => {
                  const palette: Record<string, { text: string; border: string; bg: string; hover: string; chip: string }> = {
                    emerald: { text: "text-emerald-300", border: "border-emerald-700/50", bg: "bg-emerald-900/25", hover: "hover:bg-emerald-800/45", chip: "text-emerald-400" },
                    amber:   { text: "text-amber-200",   border: "border-amber-700/50",   bg: "bg-amber-900/20",   hover: "hover:bg-amber-800/40",   chip: "text-amber-400"   },
                    cyan:    { text: "text-cyan-200",    border: "border-cyan-700/50",    bg: "bg-cyan-900/20",    hover: "hover:bg-cyan-800/40",    chip: "text-cyan-400"    },
                  };
                  const p = palette[cat.color] || palette.emerald;
                  const Icono = cat.Icono;
                  return (
                    <div key={cat.nombre}>
                      <div className={`flex items-center gap-1.5 mb-1 px-1 ${p.chip}`}>
                        <Icono size={11} />
                        <span className="text-[10px] font-semibold uppercase tracking-wide">{cat.nombre}</span>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {cat.items.map(s => (
                          <button key={s} onClick={() => enviarMensaje(s)}
                            className={`px-2.5 py-1 text-[10px] font-medium rounded-full border transition-all active:scale-95 whitespace-nowrap ${p.text} ${p.border} ${p.bg} ${p.hover}`}>
                            {s}
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* INPUT */}
          <div className="px-3 pb-3 pt-2.5 border-t border-[#1a4a3a] flex-shrink-0 bg-[#081a14]/60">
            {isAdmin ? (
              <>
                <div className="flex items-center gap-2 bg-[#0a1f18] border border-[#1a4a3a] rounded-xl px-3 py-2 focus-within:border-emerald-500/60 focus-within:shadow-[0_0_0_3px_rgba(16,185,129,0.12)] transition-all">
                  <input ref={inputRef} type="text"
                    placeholder={escuchando ? "Escuchando… habla ahora" : cargando ? "Procesando tu consulta..." : PLACEHOLDERS[placeholderIdx]}
                    value={input} onChange={e => setInput(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && !e.shiftKey && enviarMensaje()}
                    disabled={cargando} maxLength={500}
                    className="flex-1 bg-transparent text-white text-sm placeholder-gray-500 focus:outline-none disabled:opacity-50"/>
                  {vozSoportada && (
                    <button onClick={toggleMicrofono} disabled={cargando}
                      title={escuchando ? "Detener micrófono" : "Hablar (voz a texto)"}
                      className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all active:scale-95 disabled:opacity-40 ${
                        escuchando
                          ? "bg-red-500 text-white animate-pulse shadow-[0_0_0_3px_rgba(239,68,68,0.25)]"
                          : "bg-[#1a3d30] text-emerald-300 hover:bg-[#22503e] hover:text-emerald-200"}`}>
                      {escuchando ? <MicOff size={16}/> : <Mic size={16}/>}
                    </button>
                  )}
                  <button onClick={() => enviarMensaje()} disabled={cargando || !input.trim()}
                    title="Enviar (Enter)"
                    className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center text-white transition-all hover:scale-105 active:scale-95 shadow-[0_2px_8px_rgba(16,185,129,0.35)] disabled:shadow-none">
                    {cargando
                      ? <span className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin"/>
                      : <SendIcon/>}
                  </button>
                </div>
                <div className="flex items-center justify-between mt-1 px-1">
                  <p className="text-[9px] text-gray-600">
                    <kbd className="px-1 py-0.5 bg-[#1a3d30] rounded border border-[#2a5a45] text-gray-400">Enter</kbd> para enviar
                  </p>
                  {input.length > 400 && (
                    <p className="text-[10px] text-amber-400">{500 - input.length} restantes</p>
                  )}
                </div>
              </>
            ) : (
              /* Mensaje de solo lectura para no-admins */
              <div className="flex items-center gap-2 bg-[#0a1f18] border border-[#1a4a3a]/50 rounded-xl px-3 py-2.5 opacity-60">
                <LockIcon/>
                <p className="text-gray-500 text-xs">Solo el administrador puede escribir</p>
              </div>
            )}
          </div>

        </div>
      )}

      {/* ── MODAL DE ERROR ── visible en pantalla para que el usuario sepa qué pasó ── */}
      {errorModal && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm px-4"
          onClick={() => setErrorModal(null)}
        >
          <div
            className="chat-window w-full max-w-sm bg-[#0a1f18] border border-[#9a7c28]/60 rounded-2xl shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
            role="alertdialog"
            aria-modal="true"
          >
            <div className="flex items-center gap-2.5 px-4 py-3 bg-gradient-to-r from-[#7a1f1f] to-[#9a2c2c]">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none"
                stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
              </svg>
              <h3 className="text-white font-semibold text-sm flex-1">{errorModal.titulo}</h3>
            </div>
            <div className="px-4 py-4">
              <p className="text-gray-200 text-sm leading-relaxed">{errorModal.mensaje}</p>
            </div>
            <div className="px-4 pb-4 flex justify-end">
              <button
                onClick={() => setErrorModal(null)}
                className="px-4 py-2 rounded-lg bg-gradient-to-br from-[#D2B858] to-[#9a7c28] text-black text-sm font-semibold hover:scale-105 active:scale-95 transition-transform"
              >
                Entendido
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default ChatFlotante;