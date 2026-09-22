// test/mcp-session-recovery.test.js
// Prueba del fix de código de error para sesión MCP inválida/perdida
// (incidente 2026-09-22 — ver TODO.md). Reproduce EXACTAMENTE el escenario
// real: un cliente que ya tenía una sesión válida, y el servidor la perdió
// (restart real en producción; acá se simula mandando un mcp-session-id que
// el servidor nunca emitió — desde la perspectiva del handler de
// server.js, "sessionId presente pero no está en `transports`" es EL MISMO
// código, tanto si es porque el proceso se reinició como si el id nunca
// existió — no hace falta reiniciar el proceso de verdad para probarlo).
//
// Dos heurísticas de cliente simuladas, porque el reporte real (Cowork)
// mostró que NO todos los clientes se recuperan solos del mismo modo:
//  - `clienteGenerico`: heurística ciega ("cualquier fallo -> reinicializo
//    y reintento"), sin mirar el código de error — la categoría que YA
//    funcionaba en producción con el 400/-32000 viejo (confirmado con los
//    logs reales de nginx: 400 seguido de un initialize nuevo en el mismo
//    segundo, para IPs distintas, repetidamente).
//  - `clienteEspecifico`: heurística estricta, que solo reintenta si ve la
//    señal EXACTA que el propio SDK documenta para "sesión perdida" (404 +
//    código JSON-RPC -32001 "Session not found",
//    ver node_modules/@modelcontextprotocol/sdk WebStandardStreamableHTTPServerTransport)
//    — la categoría que representa el caso real reportado (Cowork), que no
//    se recuperaba con el 400/-32000 genérico porque ese no es el código
//    que el spec documenta para este caso.
//
// Requisito explícito del usuario antes de mergear: no alcanza con probar
// que el cliente estricto ahora se recupera — hay que confirmar que el
// cliente genérico (que ya funcionaba) SIGUE funcionando igual de bien
// después del cambio. Este archivo prueba ambas invariantes contra el
// código YA CORREGIDO (lo que queda corriendo en el repo). La comparación
// contra el código viejo (confirmando que el genérico también recuperaba
// con 400/-32000, y que el específico NO) se corrió manualmente antes de
// aplicar el fix — ver TODO.md para esa evidencia "antes/después".
require("dotenv").config();
process.env.PORT = "8798";
process.env.MCP_ISSUER_URL = "http://localhost:8798";

const crypto = require("crypto");
const memoria = require("../src/auth/memoria");

const BASE = process.env.MCP_ISSUER_URL;

function esperar(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function pkcePair() {
  const verifier = crypto.randomBytes(32).toString("base64url");
  const challenge = crypto.createHash("sha256").update(verifier).digest("base64url");
  return { verifier, challenge };
}

function asegurar(condicion, mensaje) {
  if (!condicion) throw new Error("FALLÓ: " + mensaje);
  console.log("OK:", mensaje);
}

async function obtenerAccessTokenReal() {
  const registerRes = await fetch(`${BASE}/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      redirect_uris: ["http://127.0.0.1:9999/callback"],
      token_endpoint_auth_method: "client_secret_post",
      grant_types: ["authorization_code", "refresh_token"],
      response_types: ["code"],
      client_name: "session-recovery-test-client",
    }),
  });
  const client = await registerRes.json();

  const { verifier, challenge } = pkcePair();
  const authorizeUrl = new URL(`${BASE}/authorize`);
  authorizeUrl.searchParams.set("client_id", client.client_id);
  authorizeUrl.searchParams.set("redirect_uri", client.redirect_uris[0]);
  authorizeUrl.searchParams.set("response_type", "code");
  authorizeUrl.searchParams.set("code_challenge", challenge);
  authorizeUrl.searchParams.set("code_challenge_method", "S256");
  authorizeUrl.searchParams.set("state", "estado-test");

  const authRes = await fetch(authorizeUrl, { redirect: "manual" });
  const location = authRes.headers.get("location");
  const googleUrl = new URL(location);
  const pendienteId = googleUrl.searchParams.get("state");
  const pendiente = memoria.tomarPendiente(pendienteId);
  const nuestroCode = memoria.emitirCodigo({
    clientId: pendiente.clientId,
    codeChallenge: pendiente.codeChallenge,
    email: "gerente@aqua.com.ec",
  });

  const tokenRes = await fetch(`${BASE}/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code: nuestroCode,
      code_verifier: verifier,
      client_id: client.client_id,
      client_secret: client.client_secret,
      redirect_uri: client.redirect_uris[0],
    }),
  });
  const tokens = await tokenRes.json();
  return tokens.access_token;
}

// Request cruda con un mcp-session-id que el servidor NUNCA emitió — mismo
// código de servidor que "sesión perdida por restart" (ver comentario del
// archivo).
async function llamarConSesionDesconocida(accessToken, sessionIdFalso, id) {
  return fetch(`${BASE}/mcp`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json, text/event-stream",
      Authorization: `Bearer ${accessToken}`,
      "mcp-session-id": sessionIdFalso,
    },
    body: JSON.stringify({ jsonrpc: "2.0", id, method: "tools/list" }),
  });
}

async function inicializarSesionCruda(accessToken, id) {
  const res = await fetch(`${BASE}/mcp`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json, text/event-stream", Authorization: `Bearer ${accessToken}` },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id,
      method: "initialize",
      params: { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "recovery-test", version: "1.0" } },
    }),
  });
  const sessionId = res.headers.get("mcp-session-id");
  return { res, sessionId };
}

async function llamarToolsList(accessToken, sessionId, id) {
  return fetch(`${BASE}/mcp`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json, text/event-stream",
      Authorization: `Bearer ${accessToken}`,
      "mcp-session-id": sessionId,
    },
    body: JSON.stringify({ jsonrpc: "2.0", id, method: "tools/list" }),
  });
}

// Heurística "genérica" — cualquier fallo (status >= 400, sin mirar el
// código) dispara reinicializar + reintentar. Representa los clientes que
// YA se autorecuperaban con el 400/-32000 viejo.
async function clienteGenerico(accessToken, sessionIdFalso) {
  const primerIntento = await llamarConSesionDesconocida(accessToken, sessionIdFalso, 1);
  if (primerIntento.status < 400) return { recuperado: true, statusFinal: primerIntento.status };

  const { sessionId: nuevaSesion } = await inicializarSesionCruda(accessToken, 2);
  const reintento = await llamarToolsList(accessToken, nuevaSesion, 3);
  return { recuperado: reintento.status < 400, statusFinal: reintento.status };
}

// Heurística "específica" — solo reintenta si ve LA SEÑAL EXACTA que el
// propio SDK documenta (404 + -32001). Representa el caso real reportado
// (Cowork): con el 400/-32000 viejo, esta heurística NO reconoce la señal
// y no reintenta — se queda fallada. Con el 404/-32001 nuevo, sí.
async function clienteEspecifico(accessToken, sessionIdFalso) {
  const primerIntento = await llamarConSesionDesconocida(accessToken, sessionIdFalso, 1);
  if (primerIntento.status < 400) return { recuperado: true, statusFinal: primerIntento.status, vioSenalEsperada: null };

  const cuerpo = await primerIntento.json().catch(() => null);
  const vioSenalEsperada = primerIntento.status === 404 && cuerpo?.error?.code === -32001;
  if (!vioSenalEsperada) {
    return { recuperado: false, statusFinal: primerIntento.status, vioSenalEsperada, cuerpo };
  }

  const { sessionId: nuevaSesion } = await inicializarSesionCruda(accessToken, 2);
  const reintento = await llamarToolsList(accessToken, nuevaSesion, 3);
  return { recuperado: reintento.status < 400, statusFinal: reintento.status, vioSenalEsperada };
}

async function main() {
  require("../src/server");
  await esperar(800);

  const accessToken = await obtenerAccessTokenReal();
  asegurar(!!accessToken, "se obtuvo un access_token real por el flujo OAuth completo");

  const sessionIdFalso = crypto.randomUUID();

  console.log("\n=== Respuesta cruda del servidor ante sesión desconocida ===");
  const respuestaCruda = await llamarConSesionDesconocida(accessToken, sessionIdFalso, 99);
  const cuerpoCrudo = await respuestaCruda.json();
  console.log("status:", respuestaCruda.status, "body:", JSON.stringify(cuerpoCrudo));
  asegurar(respuestaCruda.status === 404, `sesión desconocida -> HTTP 404 (llegó: ${respuestaCruda.status})`);
  asegurar(cuerpoCrudo.error?.code === -32001, `código JSON-RPC -32001 "Session not found" (llegó: ${cuerpoCrudo.error?.code})`);

  console.log("\n=== Regresión: cliente GENÉRICO (heurística ciega, ya funcionaba antes) ===");
  const resultadoGenerico = await clienteGenerico(accessToken, crypto.randomUUID());
  asegurar(resultadoGenerico.recuperado, `cliente genérico se recupera igual que antes (status final: ${resultadoGenerico.statusFinal})`);

  console.log("\n=== Fix: cliente ESPECÍFICO (heurística estricta del spec, el caso real reportado) ===");
  const resultadoEspecifico = await clienteEspecifico(accessToken, crypto.randomUUID());
  asegurar(resultadoEspecifico.vioSenalEsperada === true, "cliente específico SÍ reconoce la señal 404/-32001 documentada por el SDK");
  asegurar(resultadoEspecifico.recuperado, `cliente específico ahora se recupera (status final: ${resultadoEspecifico.statusFinal}) — antes del fix NO se recuperaba con esta misma heurística`);

  console.log("\n=== Caso sin session-id y sin ser un initialize válido: sigue siendo 400 (genuinamente malformado) ===");
  const malformado = await fetch(`${BASE}/mcp`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json, text/event-stream", Authorization: `Bearer ${accessToken}` },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list" }),
  });
  const cuerpoMalformado = await malformado.json();
  asegurar(malformado.status === 400, `sin session-id y sin initialize -> sigue en 400 (llegó: ${malformado.status})`);
  asegurar(cuerpoMalformado.error?.code === -32000, `código -32000 sin cambios para este caso distinto (llegó: ${cuerpoMalformado.error?.code})`);

  console.log("\nMCP SESSION RECOVERY TEST OK");
  process.exit(0);
}

main().catch((err) => {
  console.error("\nMCP SESSION RECOVERY TEST FALLÓ:", err);
  process.exit(1);
});
