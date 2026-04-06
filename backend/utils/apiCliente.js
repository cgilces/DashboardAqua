// utils/apiCliente.js
const axios = require("axios");
const {
  API_URL,
  USUARIO,
  CLAVE,
  CONTEXTO,
  INTERVALO_REFRESH_MS,
} = require("../config/config");

let sesionActual = null;
let autenticando = false;

// ======================================================
// 🔑 FUNCIÓN PARA INICIAR SESIÓN (login + renovación automática)
// ======================================================
const iniciarSesion = async () => {
  if (autenticando) return;
  autenticando = true;

  try {
    const body = {
      action: "login",
      login: USUARIO,
      password: CLAVE,
      context: CONTEXTO,
    };

    const res = await axios.post(API_URL, body, {
      headers: { "Content-Type": "application/json" },
    });

    const session_id = res.data?.session_id;
    if (!session_id) {
      console.error("❌ [API] No se obtuvo session_id en el login:", res.data);
      // reintentar en 5 minutos
      setTimeout(iniciarSesion, 5 * 60 * 1000);
      return;
    }

    sesionActual = session_id;
    console.log(`[API] Nueva sesión obtenida y cacheada: ${session_id}`);

    // 🔁 Programar renovación automática
    const intervalo = INTERVALO_REFRESH_MS || 30 * 60 * 1000; // 30 minutos por defecto
    setTimeout(iniciarSesion, intervalo);
  } catch (err) {
    console.error("❌ [API] Error al iniciar sesión:", err.message);
    // reintento en 5 minutos si falla
    setTimeout(iniciarSesion, 5 * 60 * 1000);
  } finally {
    autenticando = false;
  }
};

// ======================================================
// 🔄 FUNCIÓN PARA OBTENER SESIÓN ACTUAL
// ======================================================
const obtenerSesionActual = async () => {
  if (!sesionActual) {
    console.warn("[API] No hay sesión activa, iniciando login...");
    await iniciarSesion();
  }
  return sesionActual;
};

// ======================================================
// 🚀 EXPORTS
// ======================================================
module.exports = {
  iniciarSesion,
  obtenerSesionActual,
};
