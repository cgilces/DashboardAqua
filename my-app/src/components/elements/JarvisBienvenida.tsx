import React, { useEffect, useRef, useState } from "react";
import { useAuth } from "../auth/AuthContext";
import { API_BASE_URL } from "../../config";
import { Mic, Volume2, X, Square } from "lucide-react";
import { hablarConNavegador, precargarVoces, detenerNavegador } from "../../utils/vozNavegador";

// ════════════════════════════════════════════════════════════════════════════
// MODAL "JARVIS" — saludo por voz + MODO CONVERSACIÓN manos libres
// 1) Tras el login saluda con voz (ElevenLabs) y muestra ondas que reaccionan
//    al audio real (Web Audio API). No muestra el texto del saludo.
// 2) "Hablar con JARVIS" NO cierra el modal: entra en modo conversación →
//    escucha (micrófono) → consulta /api/bot/chat → responde con voz → vuelve a
//    escuchar. También abre el ChatFlotante por si se prefiere escribir.
// ════════════════════════════════════════════════════════════════════════════

const SESSION_FLAG    = "jarvis_saludar";
const SESSION_HABLADO = "jarvis_modal_sesion";
const VELOCIDAD_VOZ   = 1.07; // un pelín más rápido, manteniendo el tono (natural)

const vozPreferida = () => {
  try { return localStorage.getItem("aqua_chat_voz") !== "false"; } catch { return true; }
};

// ¿La transcripción del micrófono es una consulta real? (filtra ruido/vacío)
const esConsultaValida = (t: string) => {
  const limpio = (t || "").trim().replace(/\s+/g, " ");
  return limpio.length >= 4;
};

// ¿La respuesta es un mensaje genérico de aclaración/ayuda? (no tiene sentido en voz)
const esRespuestaInutil = (t: string) => {
  const s = (t || "").toLowerCase();
  return (
    /mensaje\s+(qued[oó]|est[aá])\s+incompleto/.test(s) ||
    /podr[ií]as?\s+(contarme|decirme|especificar|indicar|aclarar)/.test(s) ||
    /cu[eé]ntame\s+(con\s+)?m[aá]s\s+detalle/.test(s) ||
    /no\s+(entend[ií]|comprend[ií]|capt[eé]|qued[oó]\s+claro)/.test(s) ||
    /¿?\s*en\s+qu[eé]\s+(te\s+)?puedo\s+ayudar/.test(s) ||
    /falta\s+(el\s+)?contexto/.test(s) ||
    /qu[eé]\s+informaci[oó]n\s+(necesitas|deseas|requieres)/.test(s) ||
    /reformula|s[eé]\s+m[aá]s\s+espec[ií]fico/.test(s)
  );
};

// Rectángulo redondeado (compat con navegadores sin ctx.roundRect)
function barraRedondeada(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const rad = Math.min(r, w / 2, h / 2);
  g.beginPath();
  g.moveTo(x + rad, y);
  g.arcTo(x + w, y, x + w, y + h, rad);
  g.arcTo(x + w, y + h, x, y + h, rad);
  g.arcTo(x, y + h, x, y, rad);
  g.arcTo(x, y, x + w, y, rad);
  g.closePath();
  g.fill();
}

type Estado = "idle" | "escuchando" | "pensando" | "hablando";

const JarvisBienvenida: React.FC = () => {
  const { user } = useAuth();
  const [visible, setVisible]             = useState(false);
  const [cargando, setCargando]           = useState(false);
  const [reproduciendo, setReproduciendo] = useState(false);
  const [necesitaTap, setNecesitaTap]     = useState(false);
  const [conversando, setConversando]     = useState(false);
  const [estado, setEstado]               = useState<Estado>("idle");
  const [aviso, setAviso]                 = useState("");

  const textoRef         = useRef("");
  const audioRef         = useRef<HTMLAudioElement | null>(null);
  const audioCtxRef      = useRef<AudioContext | null>(null);
  const analyserRef      = useRef<AnalyserNode | null>(null);     // ondas del TTS
  const micAnalyserRef   = useRef<AnalyserNode | null>(null);     // ondas del micrófono
  const canvasRef        = useRef<HTMLCanvasElement | null>(null);
  const sourceRef        = useRef<MediaElementAudioSourceNode | null>(null);
  const mediaStreamRef   = useRef<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef        = useRef<Blob[]>([]);
  const reproduciendoRef = useRef(false);
  const conversandoRef   = useRef(false);
  const escucharRef      = useRef<() => void>(() => {});
  const preguntarRef     = useRef<(t: string) => void>(() => {});
  const transcribirRef   = useRef<(b: Blob) => void>(() => {});
  const estadoRef        = useRef<Estado>("idle");
  const yaPedido         = useRef(false);
  const silenceTimerRef  = useRef<any>(null);   // temporizador de silencio (VAD)
  const recordTimerRef   = useRef<any>(null);   // tope máximo de grabación
  const vadRafRef        = useRef<number>(0);    // loop de detección de voz
  const huboVozRef       = useRef(false);        // ¿se detectó voz en esta grabación?
  const manualStopRef    = useRef(false);        // ¿se detuvo a propósito?
  const reintentosRef    = useRef(0);            // reintentos sin voz
  const ttsFallbackRef   = useRef(false);        // TTS por navegador (sin ElevenLabs)
  const sttFallbackRef   = useRef(false);        // STT por navegador (sin ElevenLabs)
  const srRef            = useRef<any>(null);     // SpeechRecognition del navegador (fallback)

  useEffect(() => { reproduciendoRef.current = reproduciendo; }, [reproduciendo]);
  useEffect(() => { conversandoRef.current = conversando; }, [conversando]);
  useEffect(() => { estadoRef.current = estado; }, [estado]);
  useEffect(() => { precargarVoces(); }, []); // carga la mejor voz del navegador

  // Mostrar tras login.
  useEffect(() => {
    if (!user || yaPedido.current) return;
    let saludar = false;
    try { saludar = sessionStorage.getItem(SESSION_FLAG) === "1"; } catch {}
    if (!saludar) return;
    yaPedido.current = true;
    try { sessionStorage.removeItem(SESSION_FLAG); } catch {}
    iniciar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  // Prepara/reanuda el AudioContext dentro de un gesto del usuario (clic),
  // para que el audio y el visualizador funcionen sin quedar mudos.
  const prepararAudio = () => {
    try {
      const Ctx = (window.AudioContext || (window as any).webkitAudioContext);
      if (!Ctx) return;
      let ctx = audioCtxRef.current;
      if (!ctx) {
        ctx = new Ctx();
        audioCtxRef.current = ctx;
        const an = ctx.createAnalyser();
        an.fftSize = 128;
        an.smoothingTimeConstant = 0.8;
        an.connect(ctx.destination);
        analyserRef.current = an;
      }
      if (ctx.state === "suspended") ctx.resume().catch(() => {});
    } catch {}
  };

  // Continúa el bucle de conversación (o queda en reposo) tras hablar.
  const seguirTrasHablar = () => {
    if (conversandoRef.current) escucharRef.current();
    else setEstado("idle");
  };

  // ── Voz de respaldo del NAVEGADOR (premium: mejor voz es, troceado, sin cortes) ─
  const hablarNavegador = async (t: string) => {
    ttsFallbackRef.current = true;
    await hablarConNavegador(t, () => { setReproduciendo(true); setEstado("hablando"); });
    setReproduciendo(false);
    ttsFallbackRef.current = false;
  };

  // ── Reproducir un texto con voz (ElevenLabs → fallback navegador) ──────────
  const hablar = async (t: string) => {
    if (!vozPreferida() || !t) { seguirTrasHablar(); return; }
    ttsFallbackRef.current = false;

    // 1) Intentar ElevenLabs (voz premium con ondas reactivas).
    try {
      const token = localStorage.getItem("app_token") || "";
      const res = await fetch(`${API_BASE_URL}/api/bot/voz`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ texto: t }),
      });
      if (res.ok) {
        const blob = await res.blob();
        const url  = URL.createObjectURL(blob);
        const audio = new Audio(url);
        audio.playbackRate = VELOCIDAD_VOZ;
        audio.volume = 1;
        (audio as any).preservesPitch = true;
        (audio as any).mozPreservesPitch = true;
        (audio as any).webkitPreservesPitch = true;
        audioRef.current = audio;

        try {
          const Ctx = (window.AudioContext || (window as any).webkitAudioContext);
          if (Ctx) {
            let ctx = audioCtxRef.current;
            if (!ctx) {
              ctx = new Ctx();
              audioCtxRef.current = ctx;
              const an = ctx.createAnalyser();
              an.fftSize = 128;
              an.smoothingTimeConstant = 0.8;
              an.connect(ctx.destination);
              analyserRef.current = an;
            }
            if (ctx.state === "suspended") { try { await ctx.resume(); } catch {} }
            if (ctx.state === "running") {
              try { sourceRef.current?.disconnect(); } catch {}
              const source = ctx.createMediaElementSource(audio);
              source.connect(analyserRef.current as AnalyserNode);
              sourceRef.current = source;
            }
          }
        } catch { /* sin visualizador: audio directo */ }

        audio.onplay  = () => { setReproduciendo(true); setEstado("hablando"); };
        audio.onpause = () => setReproduciendo(false);
        audio.onerror = () => { URL.revokeObjectURL(url); setReproduciendo(false); };
        audio.onended = () => {
          URL.revokeObjectURL(url);
          setReproduciendo(false);
          seguirTrasHablar();
        };
        await audio.play().catch(async () => {
          // Autoplay bloqueado → intentar voz del navegador.
          await hablarNavegador(t);
          seguirTrasHablar();
        });
        return;
      }
      // res no OK (p.ej. 402 sin créditos) → fallback navegador.
    } catch { /* error de red → fallback navegador */ }

    // 2) Fallback: voz del navegador.
    await hablarNavegador(t);
    seguirTrasHablar();
  };

  // ── Consultar al backend y responder con voz ──────────────────────────────
  const preguntar = async (texto: string) => {
    setEstado("pensando");
    const ctrl = new AbortController();
    const to = setTimeout(() => ctrl.abort(), 45000); // no quedarse "Pensando…" para siempre
    try {
      const token = localStorage.getItem("app_token") || "";
      const res = await fetch(`${API_BASE_URL}/api/bot/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ mensaje: texto }),
        signal: ctrl.signal,
      });
      clearTimeout(to);
      const data = await res.json();
      const t = (data?.respuesta || "").trim();
      // Respuesta vacía o de aclaración genérica: no se habla; seguir escuchando.
      if (!t || esRespuestaInutil(t)) {
        if (conversandoRef.current) escucharRef.current(); else setEstado("idle");
        return;
      }
      // Reflejar en el ChatFlotante (el modal NO muestra texto, solo voz).
      window.dispatchEvent(new CustomEvent("jarvis:turno", { detail: { pregunta: texto, respuesta: t } }));
      await hablar(t);
    } catch {
      clearTimeout(to);
      if (conversandoRef.current) escucharRef.current(); else setEstado("idle");
    }
  };
  useEffect(() => { preguntarRef.current = preguntar; });

  // ── Transcribir el audio grabado (ElevenLabs STT en el servidor) ───────────
  const transcribir = async (blob: Blob) => {
    setEstado("pensando");
    const ctrl = new AbortController();
    const to = setTimeout(() => ctrl.abort(), 30000);
    try {
      const token = localStorage.getItem("app_token") || "";
      const res = await fetch(`${API_BASE_URL}/api/bot/transcribir`, {
        method: "POST",
        headers: { "Content-Type": blob.type || "audio/webm", Authorization: `Bearer ${token}` },
        body: blob,
        signal: ctrl.signal,
      });
      clearTimeout(to);
      if (!res.ok) {
        // STT de servidor no disponible (p.ej. sin créditos) → usar dictado del navegador.
        sttFallbackRef.current = true;
        try { sessionStorage.setItem("jarvis_stt_navegador", "1"); } catch {}
        if (res.status === 402) setAviso("Sin créditos de voz premium: usando dictado del navegador.");
        if (conversandoRef.current) escucharRef.current(); else setEstado("idle");
        return;
      }
      const data = await res.json();
      const texto = (data?.texto || "").trim();
      if (texto && esConsultaValida(texto)) {
        reintentosRef.current = 0;
        preguntarRef.current(texto);
      } else if (conversandoRef.current) {
        escucharRef.current(); // no se entendió → seguir escuchando
      } else {
        setEstado("idle");
      }
    } catch {
      clearTimeout(to);
      sttFallbackRef.current = true; // error de red → fallback navegador
      if (conversandoRef.current) escucharRef.current(); else setEstado("idle");
    }
  };
  useEffect(() => { transcribirRef.current = transcribir; });

  // ── Dictado de respaldo del NAVEGADOR (SpeechRecognition) — sin ElevenLabs ──
  const escucharNavegador = () => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) { setAviso("Sin créditos de voz y tu navegador no soporta dictado."); setEstado("idle"); return; }
    const prev = srRef.current;
    if (prev) { prev.onresult = null; prev.onend = null; prev.onerror = null; try { prev.abort?.(); } catch {} srRef.current = null; }
    if (silenceTimerRef.current) { clearTimeout(silenceTimerRef.current); silenceTimerRef.current = null; }
    manualStopRef.current = false;
    try { audioRef.current?.pause(); } catch {}
    setReproduciendo(false);

    const rec = new SR();
    rec.lang = "es-EC";
    rec.continuous = true;
    rec.interimResults = true;
    rec.maxAlternatives = 1;
    let finalBuf = "";
    let ultimoInterim = "";
    const rearmar = () => {
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = setTimeout(() => { manualStopRef.current = true; try { rec.stop(); } catch {} }, 1300);
    };
    rec.onresult = (e: any) => {
      let interim = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const tr = e.results[i][0].transcript;
        if (e.results[i].isFinal) finalBuf += tr + " "; else interim += tr;
      }
      ultimoInterim = interim;
      if (interim.trim() || finalBuf.trim()) rearmar();
    };
    rec.onerror = (ev: any) => {
      if (ev?.error === "not-allowed" || ev?.error === "service-not-allowed") {
        manualStopRef.current = true; setAviso("Permite el acceso al micrófono para hablar.");
      }
    };
    rec.onend = () => {
      if (silenceTimerRef.current) { clearTimeout(silenceTimerRef.current); silenceTimerRef.current = null; }
      if (recordTimerRef.current) { clearTimeout(recordTimerRef.current); recordTimerRef.current = null; }
      srRef.current = null;
      const texto = (finalBuf.trim() || ultimoInterim.trim());
      if (texto && esConsultaValida(texto)) { reintentosRef.current = 0; preguntarRef.current(texto); return; }
      if (conversandoRef.current && !manualStopRef.current && reintentosRef.current < 4) {
        reintentosRef.current += 1;
        setTimeout(() => escucharRef.current(), 250);
      } else {
        reintentosRef.current = 0;
        setEstado("idle");
        if (conversandoRef.current) setAviso("No te escuché. Toca el micrófono para hablar.");
      }
    };
    rec.onstart = () => { setAviso(""); };
    srRef.current = rec;
    setEstado("escuchando");
    try { rec.start(); }
    catch { setEstado("idle"); srRef.current = null; return; }
    // Tope máximo de escucha (si el navegador no cierra solo) → evita que se quede colgado.
    if (recordTimerRef.current) clearTimeout(recordTimerRef.current);
    recordTimerRef.current = setTimeout(() => { manualStopRef.current = true; try { rec.stop(); } catch {} }, 10000);
  };

  // ── Escuchar (grabar) al usuario: MediaRecorder + VAD (voz/silencio) ───────
  const escuchar = async () => {
    // Si el STT de servidor no está disponible (sin créditos), usar el dictado del navegador.
    let sttCaido = sttFallbackRef.current;
    try { sttCaido = sttCaido || sessionStorage.getItem("jarvis_stt_navegador") === "1"; } catch {}
    if (sttCaido) { sttFallbackRef.current = true; escucharNavegador(); return; }
    manualStopRef.current = false;
    setAviso("");
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      setAviso("Tu navegador no permite grabar audio.");
      setEstado("idle");
      return;
    }
    try { audioRef.current?.pause(); } catch {}
    setReproduciendo(false);

    try {
      // Reusar el stream del micrófono durante toda la conversación.
      let stream = mediaStreamRef.current;
      if (!stream || !stream.active) {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
        });
        mediaStreamRef.current = stream;
      }

      // Analizador del micrófono: VAD + ondas reactivas a tu voz.
      const Ctx = (window.AudioContext || (window as any).webkitAudioContext);
      let micAnalyser = micAnalyserRef.current;
      if (Ctx) {
        const ctx = audioCtxRef.current || new Ctx();
        audioCtxRef.current = ctx;
        if (ctx.state === "suspended") { try { await ctx.resume(); } catch {} }
        if (!micAnalyser) {
          const src = ctx.createMediaStreamSource(stream);
          micAnalyser = ctx.createAnalyser();
          micAnalyser.fftSize = 512;
          micAnalyser.smoothingTimeConstant = 0.7;
          src.connect(micAnalyser); // NO se conecta a destination (evita eco)
          micAnalyserRef.current = micAnalyser;
        }
      }

      const mime = MediaRecorder.isTypeSupported("audio/webm;codecs=opus") ? "audio/webm;codecs=opus"
        : MediaRecorder.isTypeSupported("audio/webm") ? "audio/webm"
        : MediaRecorder.isTypeSupported("audio/mp4") ? "audio/mp4" : "";
      const rec = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream);
      mediaRecorderRef.current = rec;
      chunksRef.current = [];
      huboVozRef.current = false;

      rec.ondataavailable = (e: BlobEvent) => { if (e.data && e.data.size) chunksRef.current.push(e.data); };
      rec.onstop = () => {
        if (silenceTimerRef.current) { clearTimeout(silenceTimerRef.current); silenceTimerRef.current = null; }
        if (recordTimerRef.current) { clearTimeout(recordTimerRef.current); recordTimerRef.current = null; }
        if (vadRafRef.current) { cancelAnimationFrame(vadRafRef.current); vadRafRef.current = 0; }
        mediaRecorderRef.current = null;
        const blob = new Blob(chunksRef.current, { type: rec.mimeType || mime || "audio/webm" });
        chunksRef.current = [];
        const tuvoVoz = huboVozRef.current && blob.size >= 1400;
        if (tuvoVoz) { transcribirRef.current(blob); return; }
        // No se detectó voz suficiente.
        if (conversandoRef.current && !manualStopRef.current && reintentosRef.current < 3) {
          reintentosRef.current += 1;
          setTimeout(() => escucharRef.current(), 200);
        } else {
          reintentosRef.current = 0;
          setEstado("idle");
        }
      };

      // Detección de voz/silencio (VAD).
      const UMBRAL = 14;     // nivel medio (0..255) para considerar "voz"
      const SIL_MS = 1100;   // silencio tras voz para cerrar la frase
      const buf = micAnalyser ? new Uint8Array(micAnalyser.frequencyBinCount) : null;
      // Sin analizador (navegador sin Web Audio): no hay VAD; aceptar lo grabado
      // para que la parada manual o el tope de tiempo igual transcriban.
      if (!buf) huboVozRef.current = true;
      const vad = () => {
        vadRafRef.current = requestAnimationFrame(vad);
        if (!micAnalyser || !buf) return;
        micAnalyser.getByteFrequencyData(buf);
        let sum = 0; for (let i = 0; i < buf.length; i++) sum += buf[i];
        const nivel = sum / buf.length;
        if (nivel > UMBRAL) {
          huboVozRef.current = true;
          if (silenceTimerRef.current) { clearTimeout(silenceTimerRef.current); silenceTimerRef.current = null; }
        } else if (huboVozRef.current && !silenceTimerRef.current) {
          silenceTimerRef.current = setTimeout(() => {
            try { mediaRecorderRef.current?.stop(); } catch {}
          }, SIL_MS);
        }
      };

      setEstado("escuchando");
      rec.start();
      vad();
      // Tope máximo de grabación (seguridad).
      recordTimerRef.current = setTimeout(() => { try { mediaRecorderRef.current?.stop(); } catch {} }, 12000);
    } catch (err: any) {
      if (err?.name === "NotAllowedError" || err?.name === "SecurityError") {
        setAviso("Permite el acceso al micrófono para hablar.");
      } else {
        setAviso("No se pudo acceder al micrófono.");
      }
      setEstado("idle");
    }
  };
  useEffect(() => { escucharRef.current = escuchar; });

  const iniciar = async () => {
    setVisible(true);
    setCargando(true);
    try { sessionStorage.setItem(SESSION_HABLADO, "1"); } catch {}
    try {
      const token = localStorage.getItem("app_token") || "";
      const res = await fetch(`${API_BASE_URL}/api/bot/bienvenida`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      const t = (data?.respuesta || "").trim() || "¡Bienvenido! Soy tu Asistente Aqua.";
      textoRef.current = t;
      setCargando(false);
      hablar(t);
    } catch {
      textoRef.current = "¡Bienvenido! Soy tu Asistente Aqua.";
      setCargando(false);
    }
  };

  // ── Entrar en modo conversación (no cierra el modal) ───────────────────────
  const iniciarConversacion = () => {
    prepararAudio(); // dentro del gesto del clic
    setConversando(true);
    conversandoRef.current = true;
    setNecesitaTap(false);
    reintentosRef.current = 0;
    try { audioRef.current?.pause(); } catch {}
    setReproduciendo(false);
    window.dispatchEvent(new CustomEvent("jarvis:abrir-chat")); // abrir también el chat
    escuchar();
  };

  // Libera el micrófono (graba/timers/stream) — al detener o cerrar.
  const liberarMicro = () => {
    if (vadRafRef.current) { cancelAnimationFrame(vadRafRef.current); vadRafRef.current = 0; }
    if (silenceTimerRef.current) { clearTimeout(silenceTimerRef.current); silenceTimerRef.current = null; }
    if (recordTimerRef.current) { clearTimeout(recordTimerRef.current); recordTimerRef.current = null; }
    const rec = mediaRecorderRef.current;
    if (rec) { rec.onstop = null as any; try { rec.stop(); } catch {} mediaRecorderRef.current = null; }
    const sr = srRef.current;
    if (sr) { sr.onresult = null; sr.onend = null; sr.onerror = null; try { sr.abort?.(); } catch {} srRef.current = null; }
    try { mediaStreamRef.current?.getTracks().forEach(t => t.stop()); } catch {}
    mediaStreamRef.current = null;
    micAnalyserRef.current = null;
  };

  const detenerTodo = () => {
    conversandoRef.current = false;
    setConversando(false);
    manualStopRef.current = true;
    reintentosRef.current = 0;
    liberarMicro();
    try { audioRef.current?.pause(); } catch {}
    detenerNavegador(); // cortar también la voz del navegador
    setReproduciendo(false);
    setEstado("idle");
  };

  const cerrar = () => {
    detenerTodo();
    audioRef.current = null;
    setVisible(false);
  };

  // Botón micrófono dentro de la conversación: hablar / detener la grabación.
  const toggleMic = () => {
    if (estado === "escuchando") {
      manualStopRef.current = true; // detención manual: envía lo dicho si hubo voz
      try { mediaRecorderRef.current?.stop(); } catch {}
      try { srRef.current?.stop(); } catch {}
      return;
    }
    prepararAudio(); // dentro del gesto del clic
    reintentosRef.current = 0;
    escuchar();
  };

  // Limpieza al desmontar.
  useEffect(() => () => { liberarMicro(); try { audioRef.current?.pause(); } catch {} }, []);

  // ── VISUALIZADOR DE ONDAS ──────────────────────────────────────────────────
  useEffect(() => {
    if (!visible) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const g = canvas.getContext("2d");
    if (!g) return;

    const dpr = window.devicePixelRatio || 1;
    const cssW = canvas.clientWidth || 150;
    const cssH = canvas.clientHeight || 80;
    canvas.width  = Math.round(cssW * dpr);
    canvas.height = Math.round(cssH * dpr);
    g.setTransform(dpr, 0, 0, dpr, 0, 0);

    const N = 28;
    const data = new Uint8Array(256);
    let t = 0;
    let raf = 0;

    const render = () => {
      raf = requestAnimationFrame(render);
      t += 0.06;
      g.clearRect(0, 0, cssW, cssH);

      // Mientras escucha → ondas del micrófono (tu voz). Mientras habla → ondas del TTS.
      const escuchando = estadoRef.current === "escuchando" && micAnalyserRef.current;
      const playing = reproduciendoRef.current && analyserRef.current && !ttsFallbackRef.current;
      const fallbackHablando = reproduciendoRef.current && ttsFallbackRef.current; // voz del navegador
      const analyser = escuchando ? micAnalyserRef.current : (playing ? analyserRef.current : null);
      const activo = !!escuchando || !!playing;
      if (analyser && activo) analyser.getByteFrequencyData(data);
      const bins = analyser ? analyser.frequencyBinCount : 64;

      const gap  = cssW / N;
      const barW = gap * 0.55;
      const midY = cssH / 2;

      for (let i = 0; i < N; i++) {
        const centro = 1 - Math.abs(i - (N - 1) / 2) / ((N - 1) / 2);
        let amp: number;
        if (analyser && activo) {
          const idx = Math.floor((i / N) * (bins * 0.7));
          const boost = escuchando ? 1.6 : 1; // el micro suele dar niveles más bajos
          amp = Math.min(1, (data[idx] / 255) * boost) * (0.35 + 0.65 * centro);
        } else if (fallbackHablando) {
          // Voz del navegador (sin analizador): onda animada de "hablando".
          amp = (0.3 + 0.32 * Math.abs(Math.sin(t * 3 + i * 0.6))) * (0.4 + 0.6 * centro);
        } else {
          amp = (0.12 + 0.12 * Math.abs(Math.sin(t + i * 0.5))) * (0.4 + 0.6 * centro);
        }
        const barH = Math.max(3, amp * cssH);
        const x = i * gap + (gap - barW) / 2;
        const y = midY - barH / 2;
        const grad = g.createLinearGradient(0, y, 0, y + barH);
        grad.addColorStop(0, "#e8cc6a");
        grad.addColorStop(0.5, "#D2B858");
        grad.addColorStop(1, "#10b981");
        g.fillStyle = grad;
        barraRedondeada(g, x, y, barW, barH, barW / 2);
      }
    };
    render();
    return () => cancelAnimationFrame(raf);
  }, [visible]);

  if (!visible) return null;

  const statusTxt = cargando ? "Conectando…"
    : estado === "escuchando" ? "Escuchando…"
    : estado === "pensando" ? "Pensando…"
    : (reproduciendo || estado === "hablando") ? "Hablando…"
    : conversando ? "Toca el micrófono para hablar"
    : "Listo para ayudarte";

  return (
    <div
      className={`fixed inset-0 z-[100] flex p-4 ${
        conversando
          ? "items-start justify-center pt-8 bg-transparent pointer-events-none"
          : "items-center justify-center bg-black/60 backdrop-blur-sm"
      }`}
      style={{ animation: "jarvisFade 0.3s ease-out both" }}
      onClick={conversando ? undefined : cerrar}
    >
      <style>{`
        @keyframes jarvisFade { from{opacity:0} to{opacity:1} }
        @keyframes jarvisPop { from{opacity:0;transform:translateY(16px) scale(0.96)} to{opacity:1;transform:translateY(0) scale(1)} }
        @keyframes jarvisRing { 0%{box-shadow:0 0 0 0 rgba(210,184,88,0.5)} 70%{box-shadow:0 0 0 22px rgba(210,184,88,0)} 100%{box-shadow:0 0 0 0 rgba(210,184,88,0)} }
        .jarvis-card { animation: jarvisPop 0.35s cubic-bezier(0.34,1.56,0.64,1) both; }
        .jarvis-ring { animation: jarvisRing 2.2s ease-out infinite; }
      `}</style>

      <div
        className={`jarvis-card pointer-events-auto relative w-full rounded-3xl border border-[#D2B858]/30 bg-gradient-to-b from-[#0d2b22] to-[#06140f] shadow-[0_30px_80px_rgba(0,0,0,0.7)] overflow-hidden ${conversando ? "max-w-sm" : "max-w-md"}`}
        onClick={e => e.stopPropagation()}
      >
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(210,184,88,0.18),transparent_55%)] pointer-events-none" />

        <button onClick={cerrar} title="Cerrar"
          className="absolute top-3 right-3 z-10 p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition">
          <X size={18} />
        </button>

        <div className="relative px-7 pt-9 pb-7 flex flex-col items-center text-center">
          <p className="text-[11px] uppercase tracking-[0.2em] text-[#D2B858] font-bold mb-1">Asistente Aqua</p>
          <p className="text-emerald-300/80 text-[13px] mb-4">{statusTxt}</p>

          {/* Anillo + ondas */}
          <div className={`jarvis-ring relative w-40 h-40 rounded-full bg-gradient-to-br from-[#10261d] to-[#0a1c15] border flex items-center justify-center mb-3 ${estado === "escuchando" ? "border-emerald-400/50" : "border-[#D2B858]/25"}`}>
            <div className="absolute inset-0 rounded-full bg-[radial-gradient(circle_at_50%_50%,rgba(16,185,129,0.12),transparent_70%)]" />
            <canvas ref={canvasRef} className="w-[140px] h-[76px] relative" />
          </div>

          {necesitaTap && !conversando && !cargando && (
            <button onClick={() => { setNecesitaTap(false); hablar(textoRef.current); }}
              className="mt-1 mb-1 inline-flex items-center gap-1.5 text-[12px] text-[#D2B858] hover:text-[#e8cc6a] transition">
              <Volume2 size={14} /> Escuchar saludo
            </button>
          )}

          {aviso && (
            <p className="mt-1 mb-1 text-[12px] text-amber-300/90">{aviso}</p>
          )}

          {/* Acciones */}
          <div className="mt-4 w-full flex flex-col gap-2.5">
            {!conversando ? (
              <>
                <button onClick={iniciarConversacion}
                  className="w-full py-3 rounded-xl font-bold text-sm text-black bg-gradient-to-r from-[#D2B858] to-[#b89e3f] hover:from-[#e8cc6a] active:scale-[0.98] transition-all shadow-[0_6px_20px_rgba(210,184,88,0.35)] flex items-center justify-center gap-2">
                  <Mic size={17} /> Hablar con JARVIS
                </button>
                <button onClick={() => { cerrar(); setTimeout(() => window.dispatchEvent(new CustomEvent("jarvis:abrir-chat")), 50); }}
                  className="w-full py-2.5 rounded-xl font-medium text-sm text-emerald-200 bg-[#13362a] border border-[#1f4d3c] hover:bg-[#184234] active:scale-[0.98] transition-all">
                  Escribir en el chat
                </button>
              </>
            ) : (
              <div className="flex items-center gap-2.5">
                <button onClick={toggleMic}
                  disabled={estado === "pensando" || reproduciendo}
                  className={`flex-1 py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all active:scale-[0.98] disabled:opacity-50 ${
                    estado === "escuchando"
                      ? "bg-red-500 text-white animate-pulse"
                      : "text-black bg-gradient-to-r from-[#D2B858] to-[#b89e3f] hover:from-[#e8cc6a]"}`}>
                  <Mic size={17} /> {estado === "escuchando" ? "Escuchando…" : "Hablar"}
                </button>
                <button onClick={detenerTodo} title="Detener conversación"
                  className="px-4 py-3 rounded-xl text-sm font-medium text-emerald-200 bg-[#13362a] border border-[#1f4d3c] hover:bg-[#184234] active:scale-[0.98] transition-all flex items-center gap-2">
                  <Square size={14} /> Detener
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default JarvisBienvenida;
