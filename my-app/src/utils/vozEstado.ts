// utils/vozEstado.ts
// Estado compartido de la voz premium (ElevenLabs) durante la sesión.
// Cuando ElevenLabs responde "sin créditos"/error, lo recordamos para ir DIRECTO
// a la voz del navegador (Google) en los siguientes mensajes, sin esperar el
// round-trip que falla. Así la voz fluye sin demoras y se mantienen ambas
// opciones (premium si hay saldo, navegador si no).
const KEY = "aqua_tts_premium_agotado";

/** ¿Ya sabemos que la voz premium no está disponible en esta sesión? */
export function ttsPremiumAgotado(): boolean {
  try { return sessionStorage.getItem(KEY) === "1"; } catch { return false; }
}

/** Marca la voz premium como no disponible (ir directo a la del navegador). */
export function marcarTtsPremiumAgotado(): void {
  try { sessionStorage.setItem(KEY, "1"); } catch { /* noop */ }
}
