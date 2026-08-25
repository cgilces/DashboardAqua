// src/auth/provider.js
// Implementa la interfaz OAuthServerProvider del SDK de MCP
// (server/auth/provider.d.ts). El router oficial del SDK
// (server/auth/router.js → mcpAuthRouter) hace todo el trabajo de protocolo
// (validar client_id/redirect_uri, PKCE local, forma de los endpoints); acá
// solo se decide QUÉ pasa en cada paso:
//   authorize()               -> redirige a Google (no autentica nosotros)
//   exchangeAuthorizationCode -> ya con el login de Google + hd verificados
//                                 (eso pasó en /oauth/google/callback), emite
//                                 nuestro propio access token + refresh token
//   exchangeRefreshToken      -> rota el refresh token, emite un access token nuevo
//   verifyAccessToken         -> valida nuestro JWT para proteger /mcp
const { InvalidGrantError, InvalidTokenError } = require("@modelcontextprotocol/sdk/server/auth/errors.js");
const store = require("./store");
const memoria = require("./memoria");
const { urlAutorizacionGoogle } = require("./google");
const { firmarAccessToken, verificarAccessToken } = require("./accessToken");

function googleCallbackUrl() {
  return new URL("/oauth/google/callback", process.env.MCP_ISSUER_URL).href;
}

const provider = {
  clientsStore: {
    getClient: store.getClient,
    registerClient: store.registerClient,
  },

  // No hacemos PKCE local nosotros mismos "en dos pasos" — el router del SDK
  // ya hace la validación S256 estándar contra el codeChallenge que devolvemos
  // en challengeForAuthorizationCode. skipLocalPkceValidation queda en false
  // (default) a propósito.

  async authorize(client, params, res) {
    const pendienteId = memoria.guardarPendiente({
      clientId: client.client_id,
      redirectUri: params.redirectUri,
      codeChallenge: params.codeChallenge,
      state: params.state,
    });

    const url = urlAutorizacionGoogle({
      redirectUri: googleCallbackUrl(),
      state: pendienteId,
    });

    res.redirect(url);
  },

  async challengeForAuthorizationCode(_client, authorizationCode) {
    const datos = memoria.consultarCodigo(authorizationCode);
    if (!datos) throw new InvalidGrantError("código de autorización inválido o expirado");
    return datos.codeChallenge;
  },

  async exchangeAuthorizationCode(client, authorizationCode) {
    const datos = memoria.consumirCodigo(authorizationCode);
    if (!datos) throw new InvalidGrantError("código de autorización inválido, expirado o ya usado");
    if (datos.clientId !== client.client_id) {
      throw new InvalidGrantError("el código de autorización no pertenece a este client_id");
    }

    const { token: accessToken, expiresIn } = firmarAccessToken({
      clientId: client.client_id,
      email: datos.email,
    });
    const refreshToken = await store.emitirRefreshToken({ clientId: client.client_id, email: datos.email });

    return {
      access_token: accessToken,
      token_type: "Bearer",
      expires_in: expiresIn,
      refresh_token: refreshToken,
      scope: "ventas:read",
    };
  },

  async exchangeRefreshToken(client, refreshToken) {
    const rotado = await store.rotarRefreshToken(refreshToken);
    if (!rotado) throw new InvalidGrantError("refresh token inválido, revocado o expirado");
    if (rotado.clientId !== client.client_id) {
      throw new InvalidGrantError("el refresh token no pertenece a este client_id");
    }

    const { token: accessToken, expiresIn } = firmarAccessToken({
      clientId: client.client_id,
      email: rotado.email,
    });

    return {
      access_token: accessToken,
      token_type: "Bearer",
      expires_in: expiresIn,
      refresh_token: rotado.token, // rotado: el anterior ya quedó revocado
      scope: "ventas:read",
    };
  },

  async verifyAccessToken(token) {
    try {
      return verificarAccessToken(token);
    } catch (err) {
      throw new InvalidTokenError(err.message);
    }
  },
};

module.exports = { provider, googleCallbackUrl };
