// controllers/controllerBotInteligente/bienvenida.controller.js
// ════════════════════════════════════════════════════════════════════════════
// SALUDO DE BIENVENIDA DINÁMICO — Asistente Aqua (ERP Grupo Aqua)
// Genera, con Claude, un saludo 100% personalizado al iniciar sesión:
//   - por nombre del usuario (del JWT)
//   - según el momento del día (zona America/Guayaquil)
//   - alineado a lo que el dashboard REALMENTE ofrece (ventas, cartera, metas, rutas)
// Aislado en su propio archivo para no acoplarse al chat.controller.js.
// Incluye caché corto (dedupe de doble-montaje) y fallback determinista si la IA falla.
// ════════════════════════════════════════════════════════════════════════════

const { claudeChat } = require("../../services/chatbotservicio/claude.client");

// Caché corto en memoria: evita llamar a la IA en montajes dobles (React StrictMode)
// o recargas seguidas. Clave = usuario+franja, TTL 3 min. No mata el dinamismo:
// el saludo cambia por franja horaria y por sesión.
const CACHE_TTL_MS = 3 * 60 * 1000;
const cacheBienvenida = new Map(); // "USUARIO::franja" -> { texto, ts }

// ── Momento del día en zona horaria del negocio ──────────────────────────────
function momentoDelDia() {
  const hora = Number(
    new Intl.DateTimeFormat("en-US", {
      timeZone: "America/Guayaquil",
      hour: "2-digit",
      hour12: false,
    }).format(new Date())
  );
  if (hora < 12) return { saludo: "buenos días", franja: "manana" };
  if (hora < 19) return { saludo: "buenas tardes", franja: "tarde" };
  return { saludo: "buenas noches", franja: "noche" };
}

// Capitaliza un nombre tipo login ("CGILCES" -> "Cgilces", "juan perez" -> "Juan Perez")
function presentarNombre(usuario) {
  const limpio = (usuario || "").toString().trim();
  if (!limpio) return "";
  return limpio
    .toLowerCase()
    .split(/\s+/)
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join(" ");
}

function capitalizar(t) {
  return t ? t.charAt(0).toUpperCase() + t.slice(1) : t;
}

// ── Saludo de respaldo (si la IA no responde): igual de premium, determinista ─
function saludoFallback(nombre, saludo, esVendedor) {
  const coma = nombre ? `, ${nombre}` : "";
  const cola = esVendedor
    ? "¿Revisamos tus ventas de hoy o tu avance de metas?"
    : "¿Quieres que empecemos por las ventas de hoy, la cartera vencida o el avance de metas?";
  return `${capitalizar(saludo)}${coma} 👋 Soy tu Asistente Aqua, listo para ayudarte. ${cola}`;
}

// ── Handler: GET /api/bot/bienvenida ─────────────────────────────────────────
async function bienvenidaHandler(req, res) {
  try {
    const { usuario, rol } = req.user || {};
    const nombre = presentarNombre(usuario);
    const esVendedor = (rol || "").toString().toUpperCase() === "VENDEDOR";
    const { saludo, franja } = momentoDelDia();

    // Caché corto
    const cacheKey = `${usuario || "anon"}::${franja}`;
    const hit = cacheBienvenida.get(cacheKey);
    if (hit && Date.now() - hit.ts < CACHE_TTL_MS) {
      return res.json({ respuesta: hit.texto });
    }

    const fechaLegible = new Intl.DateTimeFormat("es-EC", {
      timeZone: "America/Guayaquil",
      weekday: "long",
      day: "numeric",
      month: "long",
    }).format(new Date());

    const capacidades = esVendedor
      ? "sus ventas del día, el avance de sus metas y la cobertura de su ruta"
      : "las ventas del día, la cartera vencida, el cumplimiento de metas o el desempeño por ruta y por vendedor";

    const system = `Eres el "Asistente Aqua", la inteligencia de negocios integrada en el ERP de Grupo Aqua (distribución de agua, botellón, hielo y descartable).

Tu única tarea: redactar UN saludo de bienvenida cuando el usuario inicia sesión en el dashboard.

Reglas estrictas:
- Salúdalo por su nombre, de forma cálida, profesional y premium.
- Usa el saludo según el momento del día indicado (buenos días / buenas tardes / buenas noches).
- Menciona SOLO 1 o 2 cosas que puede revisar (de: ${capacidades}). No enumeres todo.
- MUY BREVE: máximo 2 oraciones cortas. Texto natural en español. NADA de JSON, listas ni viñetas.
- Tono ejecutivo y cercano. Como máximo 1 emoji discreto.
- NUNCA inventes cifras ni datos: solo invitas a consultar, no des números.
- Varía la redacción (no repitas frases hechas en cada saludo).`;

    const userMsg = `Nombre del usuario: ${nombre || "(sin nombre)"}
Momento del día: ${saludo}
Fecha: ${fechaLegible}
Rol: ${esVendedor ? "VENDEDOR" : "ADMINISTRADOR"}

Redacta el saludo de bienvenida ahora.`;

    let texto = "";
    try {
      texto = await claudeChat({
        system,
        messages: [{ role: "user", content: userMsg }],
        maxTokens: 220,
        temperature: 0.85,
      });
    } catch (e) {
      console.warn("⚠️  Bienvenida IA falló, uso fallback:", e.message);
    }

    if (!texto || !texto.trim()) {
      texto = saludoFallback(nombre, saludo, esVendedor);
    }
    texto = texto.trim();

    cacheBienvenida.set(cacheKey, { texto, ts: Date.now() });
    return res.json({ respuesta: texto });
  } catch (error) {
    console.error("❌ ERROR bienvenida:", error);
    // Nunca dejes al front sin saludo
    return res.json({
      respuesta:
        "¡Hola! Soy tu Asistente Aqua. ¿En qué te puedo ayudar hoy: ventas, cartera o metas?",
    });
  }
}

module.exports = { bienvenidaHandler };
