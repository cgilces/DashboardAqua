// utils/limpiarVoz.ts
// Normaliza texto markdown para que la voz (TTS) lo lea natural y coherente:
// nada de "guion", "asterisco", "barra", "signo de dolares" ni emojis descritos.
// Convierte tablas, vinetas, moneda y numeros a una forma hablable.

export function limpiarParaVoz(texto: string): string {
  let s = texto || "";

  // Codigo y links markdown
  s = s.replace(/```[\s\S]*?```/g, " ").replace(/`([^`]+)`/g, "$1");
  s = s.replace(/\[([^\]]+)\]\([^)]*\)/g, "$1");

  // Tablas, vinetas y separadores -> frases
  const lineas = s.split(/\r?\n/).map((linea) => {
    let l = linea.trim();
    if (!l) return "";
    if (/^[|\-\s:]+$/.test(l) && /[-|]/.test(l)) return "";   // separador de tabla / "---"
    if (l.startsWith("|") || / \| /.test(l)) {                 // fila de tabla
      const celdas = l.replace(/^\||\|$/g, "").split("|").map((c) => c.trim()).filter(Boolean);
      if (celdas.length === 2) return celdas.join(": ") + ".";
      if (celdas.length > 2)  return celdas.join(". ") + ".";
      return celdas.join(" ");
    }
    return l.replace(/^\s*[-•*]\s+/, "").replace(/^\s*\d+\.\s+/, "");
  });
  s = lineas.filter(Boolean).join(". ");


  // Moneda y numeros legibles
  s = s.replace(/\$\s?(\d[\d.,]*)/g, "$1 dolares");          // $3.130,33 -> 3.130,33 dolares
  s = s.replace(/(\d[\d.,]*)\s?(?:USD|usd)\b/g, "$1 dolares");
  s = s.replace(/(\d)\.(?=\d{3}(\D|$))/g, "$1");             // miles: 3.130 -> 3130
  s = s.replace(/(\d)\.(?=\d{3}(\D|$))/g, "$1");             // otra pasada (1.234.567)
  s = s.replace(/(\d+),(\d+)/g, "$1 con $2");                // decimal: 3130,33 -> "3130 con 33"
  s = s.replace(/(\d)\s?%/g, "$1 por ciento");

  // Guiones aislados (conserva palabras compuestas)
  s = s.replace(/(^|\s)[-–—]+(\s|$)/g, " ");

  // Lista blanca: solo letras, numeros, espacios y puntuacion de habla.
  // Todo lo demas ($, |, *, #, ~, emojis, simbolos...) se elimina -> no se "describe".
  s = s.replace(/[^\p{L}\p{N}\s.,:;¿?¡!()%°-]/gu, " ");

  // Limpieza final
  s = s
    .replace(/\s+([.,;:!?])/g, "$1")
    .replace(/([.,;:])\1+/g, "$1")
    .replace(/\.\s*\./g, ".")
    .replace(/\s{2,}/g, " ")
    .trim();

  return s;
}
