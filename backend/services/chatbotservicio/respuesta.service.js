const OpenAI = require("openai");
const config = require("../../db");

const openai = new OpenAI({
  apiKey: config.OPENAI_API_KEY
});

async function generarRespuesta(pregunta, datos) {
  if (!datos || datos.length === 0) {
    return "No existe información en la base de datos.";
  }

  const completion = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    temperature: 0.2,
    messages: [
      {
        role: "system",
        content: `
Responde únicamente con la información proporcionada.
No inventes datos.
        `
      },
      {
        role: "user",
        content: `
Pregunta:
${pregunta}

Datos:
${JSON.stringify(datos)}
        `
      }
    ]
  });

  return completion.choices[0].message.content;
}

module.exports = { generarRespuesta };