import React, { useState, useRef, useEffect, useCallback } from "react";
import { useAuth } from "../../components/auth/AuthContext";

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
  totalRegistros?: number;
  expirado?: boolean;
}

// ═══════════════════════════════════════════════════
// CONSTANTES
// ═══════════════════════════════════════════════════
const STORAGE_KEY        = "aqua_chat_mensajes";
const STORAGE_ABIERTO    = "aqua_chat_abierto";
const MAX_MENSAJES_LOCAL = 30;
const PDF_TTL_MS         = 30 * 60 * 1000;

const MSG_BIENVENIDA: Mensaje = {
  tipo: "bot",
  texto: "Hola 👋 Soy el asistente del ERP Grupo Aqua. Puedo responder consultas y generar **reportes PDF**. ¿En qué te puedo ayudar?",
  timestamp: new Date().toISOString(),
};

const SUGERENCIAS = [
  "Ventas de hoy", "Reporte ventas mes", "Top productos",
  "Reporte por vendedor", "Top clientes", "Reporte visitas",
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
  pdfUrl: string; pdfNombre: string; totalRegistros: number; expirado?: boolean;
}> = ({ pdfUrl, pdfNombre, totalRegistros, expirado }) => {
  const [descargando, setDescargando] = useState(false);
  const [descargado,  setDescargado]  = useState(false);

  if (expirado) return (
    <div className="mt-2 rounded-xl border border-red-800/40 bg-red-950/30 px-3 py-2.5">
      <p className="text-red-400 text-xs font-medium">⏱ Este reporte expiró (30 min)</p>
      <p className="text-gray-500 text-[11px] mt-0.5">Vuelve a solicitarlo para regenerarlo.</p>
    </div>
  );

  const descargar = async () => {
    setDescargando(true);
    try {
      const token = localStorage.getItem("app_token") || "";
      const res   = await fetch(`http://localhost:5000${pdfUrl}`, {
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
        <PDFIcon /><span className="text-black font-bold text-xs uppercase tracking-wide">Reporte PDF Listo</span>
      </div>
      <div className="px-3 py-2.5">
        <p className="text-gray-300 text-xs truncate mb-0.5">{pdfNombre.replace(/_/g," ").replace(".pdf","")}</p>
        <p className="text-emerald-400 text-[11px]">{totalRegistros} registros exportados</p>
      </div>
      <div className="px-3 pb-3">
        <button onClick={descargar} disabled={descargando}
          className={`w-full py-2 rounded-lg text-xs font-bold uppercase tracking-wide transition-all flex items-center justify-center gap-2 shadow-[0_4px_12px_rgba(210,184,88,0.3)]
            ${descargado
              ? "bg-emerald-600 text-white"
              : "bg-gradient-to-r from-[#D2B858] to-[#b89e3f] text-black hover:from-[#e8cc6a] disabled:opacity-60"}`}>
          {descargando ? (
            <><span className="w-3 h-3 border-2 border-black/40 border-t-black rounded-full animate-spin"/>Descargando...</>
          ) : descargado ? <>✓ Descargado</> : <><PDFIcon/>Descargar Reporte</>}
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

  const mensajesEndRef = useRef<HTMLDivElement>(null);
  const inputRef       = useRef<HTMLInputElement>(null);

  useEffect(() => { guardarMensajes(mensajes); }, [mensajes]);

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
      await fetch("http://localhost:5000/api/bot/limpiar", {
        method: "POST", headers: { Authorization: `Bearer ${token}` },
      });
    } catch {}
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
      const res   = await fetch("http://localhost:5000/api/bot/chat", {
        method:  "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body:    JSON.stringify({ mensaje: texto }),
      });
      if (res.status === 401) { localStorage.clear(); window.location.href = "/"; return; }
      if (!res.ok) throw new Error(`Error ${res.status}`);

      const data      = await res.json();
      const nuevoBot: Mensaje = {
        tipo:           "bot",
        texto:          data.respuesta || "Sin respuesta.",
        timestamp:      new Date().toISOString(),
        esPDF:          data.esPDF    || false,
        pdfUrl:         data.pdfUrl,
        pdfNombre:      data.pdfNombre,
        totalRegistros: data.totalRegistros,
      };
      setMensajes(prev => [...prev, nuevoBot]);

      if (!abierto) {
        setUnreadCount(c => c + 1);
        reproducirNotificacion();
        if ("vibrate" in navigator) navigator.vibrate([80, 40, 80]);
      }
    } catch {
      setMensajes(prev => [...prev, {
        tipo: "bot", texto: "⚠️ No pude conectarme con el servidor.",
        timestamp: new Date().toISOString(),
      }]);
    } finally { setCargando(false); }
  };

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
        className={`fixed bottom-6 right-6 w-16 h-16 rounded-full z-50 bg-gradient-to-br from-[#D2B858] to-[#9a7c28] flex items-center justify-center shadow-[0_8px_28px_rgba(210,184,88,0.5)] transition-all duration-300 hover:scale-110 active:scale-95 ${!abierto ? "pulse-ring" : ""}`}>
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
        <div className="chat-window fixed bottom-24 right-6 w-[340px] sm:w-[400px] h-[570px] bg-[#0d2b22] border border-[#1a4a3a] rounded-2xl shadow-[0_24px_60px_rgba(0,0,0,0.55)] flex flex-col overflow-hidden z-50">

          {/* HEADER */}
          <div className="bg-gradient-to-r from-[#014434] to-[#025f4b] px-4 py-3 flex items-center justify-between border-b border-[#1a4a3a] flex-shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-[#D2B858] flex items-center justify-center shadow-md flex-shrink-0">
                <BotIcon/>
              </div>
              <div>
                <p className="text-white font-semibold text-sm leading-tight">Asistente Aqua</p>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"/>
                  <span className="text-emerald-300 text-[11px]">Consultas · Reportes PDF</span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-1">
              {isAdmin && (
                <button onClick={limpiarChat} title="Limpiar conversación"
                  className="text-gray-400 hover:text-amber-400 transition p-1.5 rounded-md hover:bg-white/10">
                  <TrashIcon/>
                </button>
              )}
              <button onClick={() => setAbierto(false)}
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
                  <div className={m.tipo === "bot" ? "pr-5" : ""}>{renderMarkdown(m.texto)}</div>
                  {m.esPDF && m.pdfUrl && (
                    <PDFCard pdfUrl={m.pdfUrl} pdfNombre={m.pdfNombre || "reporte.pdf"}
                      totalRegistros={m.totalRegistros || 0} expirado={m.expirado}/>
                  )}
                  {m.tipo === "bot" && (
                    <button onClick={() => copiarMensaje(m.texto, i)} title="Copiar respuesta"
                      className="copy-btn absolute top-2 right-2 p-1 rounded text-gray-500 hover:text-emerald-300 hover:bg-white/10 transition">
                      {copiado === i ? <span className="text-[10px] text-emerald-400 font-bold">✓</span> : <CopyIcon/>}
                    </button>
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

          {/* SUGERENCIAS — solo admin */}
          {isAdmin && mostrarSugerencias && (
            <div className="px-3 pb-2 flex-shrink-0">
              <p className="text-[10px] text-gray-500 mb-1.5 px-1">Prueba con:</p>
              <div className="flex flex-wrap gap-1.5">
                {SUGERENCIAS.map(s => (
                  <button key={s} onClick={() => enviarMensaje(s)}
                    className="px-2.5 py-1 text-[10px] text-emerald-300 border border-emerald-700/60 rounded-full bg-emerald-900/30 hover:bg-emerald-800/50 transition whitespace-nowrap">
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* INPUT */}
          <div className="px-3 pb-3 pt-2 border-t border-[#1a4a3a] flex-shrink-0">
            {isAdmin ? (
              <>
                <div className="flex items-center gap-2 bg-[#0a1f18] border border-[#1a4a3a] rounded-xl px-3 py-2">
                  <input ref={inputRef} type="text"
                    placeholder="Escribe una consulta o corrección..."
                    value={input} onChange={e => setInput(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && !e.shiftKey && enviarMensaje()}
                    disabled={cargando} maxLength={500}
                    className="flex-1 bg-transparent text-white text-sm placeholder-gray-500 focus:outline-none disabled:opacity-50"/>
                  <button onClick={() => enviarMensaje()} disabled={cargando || !input.trim()}
                    className="w-8 h-8 rounded-lg bg-emerald-500 hover:bg-emerald-400 disabled:opacity-40 flex items-center justify-center text-white transition-all hover:scale-105 active:scale-95">
                    <SendIcon/>
                  </button>
                </div>
                {input.length > 400 && (
                  <p className="text-[10px] text-right mt-1 pr-1 text-amber-400">{500 - input.length} caracteres restantes</p>
                )}
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
    </>
  );
};

export default ChatFlotante;