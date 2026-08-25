// src/auth/google.js
// Delegación del login real a Google ("Sign in with Google"), con el único
// gate de acceso: el claim `hd` (hosted domain) del id_token debe ser
// EXACTAMENTE el dominio de la empresa. Una cuenta de Google perfectamente
// válida pero de otro dominio se RECHAZA acá mismo, de forma explícita.
const { OAuth2Client } = require("google-auth-library");

function clienteGoogle(redirectUri) {
  return new OAuth2Client({
    clientId: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    redirectUri,
  });
}

function urlAutorizacionGoogle({ redirectUri, state }) {
  const client = clienteGoogle(redirectUri);
  return client.generateAuthUrl({
    access_type: "online",
    scope: ["openid", "email", "profile"],
    state,
    prompt: "select_account",
  });
}

// Intercambia el `code` de Google por tokens, verifica la FIRMA del
// id_token (no solo lo decodifica) y valida el dominio.
// Devuelve { email, hd } en éxito.
// Lanza AccesoDenegadoError con un `motivo` explícito en cualquier otro caso
// — nunca deja pasar silenciosamente una cuenta de otro dominio.
class AccesoDenegadoError extends Error {
  constructor(motivo, detalle) {
    super(motivo);
    this.motivo = motivo;
    this.detalle = detalle;
  }
}

// Función PURA (sin red, sin SDK de Google) con la decisión real de acceso,
// separada a propósito para poder probarla de forma determinista con
// payloads sintéticos — verificar la firma de un id_token real requiere
// hablar con Google, pero la REGLA DE RECHAZO en sí no depende de eso.
// Lanza AccesoDenegadoError; nunca devuelve un "false" silencioso.
function validarPayloadGoogle(payload, dominioPermitido = process.env.ALLOWED_HD) {
  if (!dominioPermitido) {
    throw new AccesoDenegadoError("ALLOWED_HD no está configurado en el servidor");
  }
  if (!payload.email_verified) {
    throw new AccesoDenegadoError("El correo de Google no está verificado", payload.email);
  }
  // Chequeo explícito de dominio — el criterio único de acceso. `hd` solo lo
  // emite Google Workspace; una cuenta @gmail.com normal no lo trae.
  if (payload.hd !== dominioPermitido) {
    throw new AccesoDenegadoError(
      `Cuenta fuera del dominio permitido (hd="${payload.hd ?? "ninguno"}", se requiere "${dominioPermitido}")`,
      payload.email
    );
  }
  return { email: payload.email, hd: payload.hd };
}

async function verificarLoginGoogle({ code, redirectUri }) {
  const client = clienteGoogle(redirectUri);

  let tokens;
  try {
    ({ tokens } = await client.getToken(code));
  } catch (err) {
    throw new AccesoDenegadoError("No se pudo canjear el código con Google", err.message);
  }

  if (!tokens.id_token) {
    throw new AccesoDenegadoError("Google no devolvió id_token");
  }

  let payload;
  try {
    const ticket = await client.verifyIdToken({
      idToken: tokens.id_token,
      audience: process.env.GOOGLE_CLIENT_ID,
    });
    payload = ticket.getPayload();
  } catch (err) {
    throw new AccesoDenegadoError("id_token de Google inválido", err.message);
  }

  return validarPayloadGoogle(payload);
}

module.exports = { urlAutorizacionGoogle, verificarLoginGoogle, validarPayloadGoogle, AccesoDenegadoError };
