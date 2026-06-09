// utils/vozNavegador.ts
// Voz de respaldo del navegador (SpeechSynthesis) a nivel premium:
//  - Elige la MEJOR voz en español disponible (neural/Google/Microsoft).
//  - Espera a que el navegador cargue las voces (evita usar una voz por defecto).
//  - Trocea el texto por frases para evitar el corte de Chrome (~15s) en textos largos.
//  - Limpia el texto (sin símbolos/emojis/markdown) antes de hablar.

import { limpiarParaVoz } from "./limpiarVoz";

let vozCache: SpeechSynthesisVoice | null = null;

function elegirVoz(): SpeechSynthesisVoice | null {
  const synth = window.speechSynthesis;
  if (!synth) return null;
  const voces = synth.getVoices();
  if (!voces.length) return null;

  const es = voces.filter((v) => /^es/i.test(v.lang));
  const pool = es.length ? es : voces;

  // Preferencias de calidad (de mejor a aceptable)
  const criterios: ((v: SpeechSynthesisVoice) => boolean)[] = [
    (v) => /natural|neural|premium|enhanced/i.test(v.name),
    (v) => /google/i.test(v.name),
    (v) => /microsoft/i.test(v.name),
    (v) => /^es-(US|MX|ES|419)/i.test(v.lang),
    (v) => v.localService === false, // voces de red suelen ser mejores
  ];
  for (const c of criterios) {
    const encontrada = pool.find(c);
    if (encontrada) return encontrada;
  }
  return pool[0] || null;
}

// Llamar una vez al montar la app/los componentes de voz.
export function precargarVoces(): void {
  try {
    const synth = window.speechSynthesis;
    if (!synth) return;
    const set = () => { const v = elegirVoz(); if (v) vozCache = v; };
    set();
    synth.addEventListener?.("voiceschanged", set);
  } catch { /* sin TTS */ }
}

// Trocea el texto por oraciones en bloques ≤ max para evitar el corte de Chrome.
function trocear(s: string, max = 200): string[] {
  const oraciones = s.match(/[^.!?]+[.!?]*\s*/g) || [s];
  const trozos: string[] = [];
  let buf = "";
  for (const o of oraciones) {
    if ((buf + o).length > max && buf) { trozos.push(buf.trim()); buf = o; }
    else buf += o;
  }
  if (buf.trim()) trozos.push(buf.trim());
  return trozos.length ? trozos : [s];
}

// Habla un texto con la voz del navegador. Resuelve cuando termina.
// onStart se invoca cuando empieza a sonar (para animar el visualizador).
export function hablarConNavegador(texto: string, onStart?: () => void): Promise<void> {
  return new Promise<void>((resolve) => {
    try {
      const synth = window.speechSynthesis;
      if (!synth) { resolve(); return; }
      let limpio = limpiarParaVoz(texto);
      if (!limpio) { resolve(); return; }
      // Las respuestas muy largas no se leen enteras (el texto queda visible en el chat).
      if (limpio.length > 600) {
        const corte = limpio.slice(0, 600);
        limpio = corte.slice(0, corte.lastIndexOf(". ") + 1) || corte;
      }

      synth.cancel();
      if (!vozCache) vozCache = elegirVoz();

      const trozos = trocear(limpio);
      let inicioAvisado = false;
      const terminar = () => resolve();

      trozos.forEach((tz, idx) => {
        const u = new SpeechSynthesisUtterance(tz);
        u.lang = vozCache?.lang || "es-ES";
        u.rate = 1.05;
        u.pitch = 1;
        if (vozCache) u.voice = vozCache;
        if (idx === 0) {
          u.onstart = () => { if (!inicioAvisado) { inicioAvisado = true; onStart?.(); } };
        }
        if (idx === trozos.length - 1) {
          u.onend = terminar;
          u.onerror = terminar;
        }
        synth.speak(u);
      });

      // Salvaguarda: si por alguna razón no dispara onend, resolver tras un margen amplio.
      const margen = 3000 + limpio.length * 80;
      setTimeout(() => resolve(), margen);
    } catch { resolve(); }
  });
}

export function detenerNavegador(): void {
  try { window.speechSynthesis?.cancel(); } catch { /* noop */ }
}
