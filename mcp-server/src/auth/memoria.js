// src/auth/memoria.js
// Estado de vida muy corta (minutos) que no necesita sobrevivir un restart:
// 1) `pendientes`: mientras dura el round-trip hacia Google (entre nuestro
//    /authorize y nuestro /oauth/google/callback).
// 2) `codigos`: nuestro propio código de autorización (entre el callback de
//    Google y el POST /token de Claude) — de un solo uso.
// Si el proceso se reinicia a mitad de un login, el usuario simplemente
// tiene que reintentar — no hay nada valioso que perder acá.
const crypto = require("crypto");

const TTL_PENDIENTE_MS = 10 * 60 * 1000; // 10 min: alcanza para el consent de Google
const TTL_CODIGO_MS = 2 * 60 * 1000; // 2 min: código de un solo uso

const pendientes = new Map();
const codigos = new Map();

function limpiarExpirados(mapa) {
  const ahora = Date.now();
  for (const [clave, valor] of mapa) {
    if (valor.expiraEn < ahora) mapa.delete(clave);
  }
}

function guardarPendiente(datos) {
  limpiarExpirados(pendientes);
  const id = crypto.randomBytes(24).toString("base64url");
  pendientes.set(id, { ...datos, expiraEn: Date.now() + TTL_PENDIENTE_MS });
  return id;
}

function tomarPendiente(id) {
  limpiarExpirados(pendientes);
  const valor = pendientes.get(id);
  if (!valor) return null;
  pendientes.delete(id); // un solo uso
  return valor;
}

function emitirCodigo(datos) {
  limpiarExpirados(codigos);
  const code = crypto.randomBytes(32).toString("base64url");
  codigos.set(code, { ...datos, expiraEn: Date.now() + TTL_CODIGO_MS });
  return code;
}

function consultarCodigo(code) {
  limpiarExpirados(codigos);
  return codigos.get(code) || null;
}

function consumirCodigo(code) {
  const valor = consultarCodigo(code);
  if (!valor) return null;
  codigos.delete(code); // un solo uso
  return valor;
}

module.exports = { guardarPendiente, tomarPendiente, emitirCodigo, consultarCodigo, consumirCodigo };
