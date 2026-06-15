// utils/errorGlobal.ts
// ════════════════════════════════════════════════════════════════════════════
// Bus de errores GLOBAL del dashboard.
// Cualquier parte de la app (interceptor de fetch, listeners de errores no
// capturados, Error Boundary de React) puede llamar a `notificarErrorGlobal`
// para que el <ErrorModalGlobal/> muestre un modal descriptivo en pantalla.
// ════════════════════════════════════════════════════════════════════════════

export interface ErrorGlobal {
  titulo: string;
  mensaje: string;
  detalle?: string; // info técnica opcional (status, endpoint, stack corto)
}

const EVENTO = "aqua:error-global";

// Cabecera para que una llamada fetch maneje su propio error y NO dispare el
// modal global (ej: el chatbot o el TTS, que tienen su propio fallback).
export const HEADER_SIN_MODAL = "X-Sin-Modal-Error";

// Evita spam: ignora un error idéntico si llegó hace menos de este tiempo.
const DEDUPE_MS = 3000;
let ultimoMensaje = "";
let ultimoTs = 0;

/** Dispara un error global (lo recoge el modal). */
export function notificarErrorGlobal(err: ErrorGlobal): void {
  const ahora = Date.now();
  const clave = `${err.titulo}::${err.mensaje}`;
  if (clave === ultimoMensaje && ahora - ultimoTs < DEDUPE_MS) return; // dedupe
  ultimoMensaje = clave;
  ultimoTs = ahora;

  try {
    window.dispatchEvent(new CustomEvent<ErrorGlobal>(EVENTO, { detail: err }));
  } catch {
    /* SSR / entorno sin window */
  }
}

/** Suscribe el modal al bus. Devuelve la función para desuscribir. */
export function suscribirErrorGlobal(cb: (err: ErrorGlobal) => void): () => void {
  const handler = (e: Event) => cb((e as CustomEvent<ErrorGlobal>).detail);
  window.addEventListener(EVENTO, handler);
  return () => window.removeEventListener(EVENTO, handler);
}

/**
 * Construye un mensaje legible a partir de una respuesta HTTP fallida.
 * Lee el cuerpo (clonado) buscando `respuesta`/`message`/`error` del backend.
 */
export async function mensajeDesdeRespuesta(res: Response): Promise<string> {
  try {
    const txt = await res.clone().text();
    if (txt) {
      try {
        const j = JSON.parse(txt);
        const m = j?.respuesta || j?.message || j?.mensaje ||
          (typeof j?.error === "string" ? j.error : j?.error?.message);
        if (m) return String(m);
      } catch {
        // no era JSON: usar el texto plano si es corto y legible
        if (txt.length < 300 && !txt.trim().startsWith("<")) return txt.trim();
      }
    }
  } catch {
    /* cuerpo no legible */
  }
  if (res.status >= 500) return "El servidor tuvo un problema al procesar la solicitud. Intenta de nuevo en unos momentos.";
  return `La solicitud no se pudo completar (error ${res.status}).`;
}
