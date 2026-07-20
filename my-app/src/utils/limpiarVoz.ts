// utils/limpiarVoz.ts
// Limpia texto para que sea legible en voz (sin markdown, emojis, símbolos especiales)

export function limpiarParaVoz(texto: string): string {
  if (!texto) return "";
  let s = texto
    .replace(/```[\s\S]*?```/g, " ")         // bloques de código
    .replace(/`([^`]+)`/g, "$1")             // código inline
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1") // links markdown
    .replace(/[*_`~#]/g, " ")                // símbolos markdown
    .replace(/https?:\/\/\S+/g, "enlace")   // URLs
    .replace(/[^\p{L}\p{N}\s.,:;¿?¡!()%°-]/gu, " ") // símbolos especiales y emojis
    .replace(/\s+([.,;:!?])/g, "$1")        // espacios antes de puntuación
    .replace(/\s{2,}/g, " ")                // espacios múltiples
    .trim();
  return s;
}
