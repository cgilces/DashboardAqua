// utils/interceptorErrores.ts
// ════════════════════════════════════════════════════════════════════════════
// Instala el "cazador" GLOBAL de errores de la app. Una sola llamada al
// arrancar (main.tsx) cubre:
//   1) Fallos de red y errores 5xx en CUALQUIER fetch (sin reescribir cada
//      llamada). Lee el mensaje real del backend.
//   2) Promesas rechazadas sin catch (unhandledrejection).
//   3) Errores JS no capturados (window.error).
// El <ErrorModalGlobal/> muestra el modal descriptivo.
//
// Una llamada fetch puede excluirse del modal global enviando la cabecera
// HEADER_SIN_MODAL (la usan el chatbot y el TTS, que tienen su propio manejo).
// ════════════════════════════════════════════════════════════════════════════

import {
  notificarErrorGlobal,
  mensajeDesdeRespuesta,
  HEADER_SIN_MODAL,
} from "./errorGlobal";

let instalado = false;

function pideSinModal(init?: RequestInit, input?: RequestInfo | URL): boolean {
  const h = init?.headers;
  if (h) {
    if (h instanceof Headers) { if (h.has(HEADER_SIN_MODAL)) return true; }
    else if (Array.isArray(h)) { if (h.some(([k]) => k.toLowerCase() === HEADER_SIN_MODAL.toLowerCase())) return true; }
    else if (Object.keys(h).some((k) => k.toLowerCase() === HEADER_SIN_MODAL.toLowerCase())) return true;
  }
  // También si la propia Request trae la cabecera.
  if (input instanceof Request && input.headers.has(HEADER_SIN_MODAL)) return true;
  return false;
}

export function instalarInterceptorErrores(): void {
  if (instalado || typeof window === "undefined") return;
  instalado = true;

  // ── 1) Interceptor de fetch ───────────────────────────────────────────────
  const fetchOriginal = window.fetch.bind(window);
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url =
      typeof input === "string" ? input :
      input instanceof URL ? input.href :
      input instanceof Request ? input.url : "";
    // El chatbot y el TTS (/api/bot/*) ya muestran su propio modal/fallback.
    const esDominioBot = url.includes("/api/bot/");
    const silenciar = esDominioBot || pideSinModal(init, input);
    try {
      const res = await fetchOriginal(input, init);
      // 401 = sesión expirada (lo maneja el guard/redirección). 4xx = error de
      // negocio que cada pantalla suele mostrar. Solo alertamos de fallos del
      // servidor (>=500, incluye 503 "sin créditos").
      if (!silenciar && res.status >= 500) {
        const mensaje = await mensajeDesdeRespuesta(res);
        notificarErrorGlobal({
          titulo: "Ocurrió un problema",
          mensaje,
          detalle: `HTTP ${res.status}`,
        });
      }
      return res;
    } catch (err) {
      // fetch rechaza = fallo de red / servidor caído / CORS.
      if (!silenciar) {
        notificarErrorGlobal({
          titulo: "Sin conexión con el servidor",
          mensaje:
            "No se pudo contactar con el servidor. Revisa tu conexión a internet e intenta de nuevo en unos momentos.",
          detalle: err instanceof Error ? err.message : undefined,
        });
      }
      throw err; // se respeta el flujo original de quien llamó
    }
  };

  // ── 2) Promesas rechazadas sin catch ──────────────────────────────────────
  window.addEventListener("unhandledrejection", (e) => {
    const motivo: any = e.reason;
    // Los fallos de fetch ya los reporta el interceptor de arriba.
    if (motivo instanceof TypeError && /fetch/i.test(String(motivo.message))) return;
    notificarErrorGlobal({
      titulo: "Error inesperado",
      mensaje:
        "Ocurrió un error inesperado en la aplicación. Si el problema continúa, recarga la página o avisa al administrador.",
      detalle: motivo instanceof Error ? motivo.message : String(motivo ?? ""),
    });
  });

  // ── 3) Errores JS no capturados ────────────────────────────────────────────
  window.addEventListener("error", (e) => {
    if (!e?.message) return;
    // Ignora errores de carga de recursos (img/script) que no son de la app.
    if (e.target && e.target !== window) return;
    notificarErrorGlobal({
      titulo: "Error inesperado",
      mensaje:
        "Ocurrió un error inesperado en la aplicación. Si el problema continúa, recarga la página o avisa al administrador.",
      detalle: e.message,
    });
  });
}
