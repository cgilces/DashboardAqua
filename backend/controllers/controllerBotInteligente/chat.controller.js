const { generarSQL } = require("../../services/chatbotservicio/openai.service");
const { ejecutarSQL } = require("../../services/chatbotservicio/query.service");
const { validarSQL, aplicarLimite } = require("../../utils/sqlValidator");

const OpenAI = require("openai");
require("dotenv").config();

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

function esPreguntaSQL(mensaje) {
  const texto = mensaje.toLowerCase();

  const palabrasClave = [

    // 🔹 Ventas
    "venta", "vendio", "vendido", "factura", "orden",
    "consumo", "monto", "total", "ingreso", "recaudacion",

    // 🔹 Clientes
    "cliente", "clientes", "saldo", "credito",
    "negocio", "tipo de negocio", "direccion",

    // 🔹 Productos
    "producto", "productos", "cantidad",
    "categoria", "precio", "detalle",

    // 🔹 Rutas
    "ruta", "rutas", "preventas", "televenta",
    "vip", "despacho", "secuencia",

    // 🔹 Usuarios
    "usuario", "usuarios", "vendedor",
    "despachador", "admin", "rol",

    // 🔹 Visitas
    "visita", "visitas", "accion",
    "ruptura", "comentario",

    // 🔹 Tiempo
    "hoy", "ayer", "semana", "mes",
    "año", "fecha", "rango", "periodo",

    // 🔹 Sincronización
    "sincronizacion", "sincronizacion ventas",
    "estado sync", "registros sincronizados",

    // 🔹 Geolocalización
    "latitud", "longitud", "ubicacion",

    // 🔹 Estado
    "estado", "activo", "inactivo",
    "proceso", "proceso de venta", "proceso de sincronizacion",

    //otros términos relacionados con el negocio o sistema pueden ser añadidos aquí
    "hielo",
    "agua",
    "botellon",
    "botellones",
    "galon",
    "galones",
    "pack",
    "producto",
    "categoria",
    "unidades"
  ];

  return palabrasClave.some(p => texto.includes(p));
}


async function generarRespuestaHumana(pregunta, datos) {

  const completion = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    temperature: 0.4,
    messages: [
      {
        role: "system",
        content: `
Eres un asistente ejecutivo del ERP Grupo Aqua.

Tu función es transformar resultados de consultas SQL
en respuestas claras, profesionales y elegantes.

Reglas:

- No mostrar nombres técnicos de columnas.
- No mencionar tablas.
- No mostrar JSON.
- Usar lenguaje empresarial.
- Si el valor es 0, explicar que no hubo movimientos.
- Si hay un solo resultado, responder en singular.
- Si hay múltiples resultados, presentar enumeración clara.
- Usar formato numérico hispano (1.250,50).
- Mantener tono cordial y profesional.
- No inventar información.
`
      },
      {
        role: "user",
        content: `
Pregunta del usuario:
${pregunta}

Resultados obtenidos:
${JSON.stringify(datos)}
`
      }
    ]
  });

  return completion.choices[0].message.content.trim();
}

async function chatHandler(req, res) {
  console.log("----- INICIO CHAT HANDLER -----");
  const fechaSistema = new Date();
  const fechaSistemaISO = fechaSistema.toISOString().split("T")[0];

  try {
    const { mensaje } = req.body;
    const { usuario, rol, seller_code } = req.user;

    console.log("Mensaje:", mensaje);
    console.log("Usuario:", usuario);
    console.log("Rol:", rol);
    console.log("Seller_code:", seller_code);

    if (!mensaje) {
      return res.status(400).json({ respuesta: "Mensaje vacío." });
    }

    if (!esPreguntaSQL(mensaje)) {
      return res.json({
        respuesta: "Solo puedo responder consultas relacionadas con ventas y datos del sistema."
      });
    }

    // 1️⃣ Generar SQL
    let sql = await generarSQL(mensaje, rol, seller_code);
    console.log("🧠 SQL generado:", sql);


    if (sql.trim().toUpperCase().startsWith("SELECT 1 WHERE FALSE")) {
      return res.json({
        respuesta: "No logré interpretar la consulta dentro del contexto del sistema. ¿Podrías reformularla indicando si se trata de ventas, clientes, productos o rutas?"
      });
    }

    // 2️⃣ Validar SQL
    if (!validarSQL(sql)) {
      console.log("❌ SQL inválido");
      return res.json({ respuesta: "Consulta no permitida." });
    }

    // 3️⃣ Aplicar límite
    sql = aplicarLimite(sql, 200);
    console.log("📏 SQL con límite aplicado:", sql);

    // 4️⃣ Ejecutar
    const datos = await ejecutarSQL(sql);
    console.log("📊 Datos obtenidos:", datos);
    console.log("📊 Total registros reales:", datos?.length);

    if (!datos || datos.length === 0) {
      return res.json({
        respuesta: "No se encontró información asociada a los criterios consultados."
      });
    }

    // 5️⃣ Generar respuesta profesional y humana
    const respuestaHumana = await generarRespuestaHumana(mensaje, datos);

    console.log("✅ Respuesta profesional enviada al usuario.");

    return res.json({ respuesta: respuestaHumana });

  } catch (error) {
    console.error("❌ ERROR EN CHAT:", error);
    return res.status(500).json({
      respuesta: "Ocurrió un error procesando la consulta."
    });
  }
}

module.exports = { chatHandler };