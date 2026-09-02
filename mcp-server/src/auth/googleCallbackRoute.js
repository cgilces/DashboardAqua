// src/auth/googleCallbackRoute.js
// Recibe la vuelta de Google después del consentimiento. Este endpoint NO es
// parte del router OAuth del SDK (mcpAuthRouter) — es el punto donde de
// verdad se decide si la cuenta entra o no, antes de que exista ningún
// código/token nuestro.
const express = require("express");
const memoria = require("./memoria");
const store = require("./store");
const { verificarLoginGoogle, AccesoDenegadoError } = require("./google");
const { googleCallbackUrl } = require("./provider");

const router = express.Router();

function paginaRechazo(motivo) {
  return `<!doctype html>
<html><head><meta charset="utf-8"><title>Acceso denegado</title></head>
<body style="font-family:sans-serif;max-width:480px;margin:80px auto;text-align:center">
  <h1 style="color:#b00020">Acceso denegado</h1>
  <p>${motivo}</p>
  <p style="color:#666;font-size:14px">Solo cuentas de Google del dominio autorizado pueden usar este conector.</p>
</body></html>`;
}

router.get("/oauth/google/callback", async (req, res) => {
  const { code, state, error: errorGoogle } = req.query;

  const pendiente = state ? memoria.tomarPendiente(state) : null;

  // Sin `state` válido no sabemos a qué redirect_uri devolver el error —
  // no hay a dónde redirigir con seguridad, se muestra la página directa.
  if (!pendiente) {
    res.status(400).send(paginaRechazo("La sesión de login expiró o es inválida. Intenta conectar de nuevo desde Claude."));
    return;
  }

  const rechazar = async (motivo, email) => {
    await store.registrarIntentoLogin({ email, hd: undefined, allowed: false, reason: motivo });
    const url = new URL(pendiente.redirectUri);
    url.searchParams.set("error", "access_denied");
    url.searchParams.set("error_description", motivo);
    if (pendiente.state) url.searchParams.set("state", pendiente.state);
    res.redirect(url.href);
  };

  if (errorGoogle) {
    await rechazar(`Google reportó: ${errorGoogle}`);
    return;
  }

  try {
    const { email, hd } = await verificarLoginGoogle({ code, redirectUri: googleCallbackUrl() });

    // Login de Google válido Y del dominio correcto: acá (y solo acá) se
    // emite nuestro propio código de autorización.
    await store.registrarIntentoLogin({ email, hd, allowed: true, reason: null });

    const nuestroCode = memoria.emitirCodigo({
      clientId: pendiente.clientId,
      codeChallenge: pendiente.codeChallenge,
      email,
    });

    const url = new URL(pendiente.redirectUri);
    url.searchParams.set("code", nuestroCode);
    if (pendiente.state) url.searchParams.set("state", pendiente.state);
    res.redirect(url.href);
  } catch (err) {
    if (err instanceof AccesoDenegadoError) {
      const email = typeof err.detalle === "string" && err.detalle.includes("@") ? err.detalle : undefined;
      await rechazar(err.motivo, email);
      return;
    }
    console.error("Error inesperado en /oauth/google/callback:", err);
    await rechazar("Error inesperado validando el login con Google");
  }
});

module.exports = router;
