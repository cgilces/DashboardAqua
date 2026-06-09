const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { AppUser } = require('../../models');
const config = require('../../config');
const { enviarCodigoVerificacion } = require('../../utils/mailer');

const loginAttempts = {};
const MAX_ATTEMPTS = 5;
const BLOCK_TIME = 5 * 60 * 1000;

// --- REGISTRO POR CÓDIGO DE VERIFICACIÓN ---
// El código siempre se envía a este correo de control.
const CORREO_VERIFICACION = 'cgilces@aqua.com.ec';
const CODIGO_TTL = 10 * 60 * 1000;        // 10 minutos de vigencia
const MAX_INTENTOS_CODIGO = 5;            // intentos de código por solicitud
// Registros pendientes en memoria, keyed por usuario normalizado:
//   { codigo, expira, intentos }
const registrosPendientes = {};

const generarCodigo = () => String(Math.floor(100000 + Math.random() * 900000));

const login = async (req, res) => {
  const ip = req.ip || req.connection.remoteAddress;
  const isDev = process.env.NODE_ENV !== "production";

  try {
    let { usuario, clave } = req.body;

    if (!usuario || !clave) {
      return res.status(400).json({
        ok: false,
        msg: "Usuario y contraseña son obligatorios"
      });
    }

    usuario = usuario.toString().trim().toUpperCase();
    clave = clave.toString().trim();

    const esEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(usuario);
    if (esEmail) {
      return res.status(400).json({
        ok: false,
        msg: "Debe ingresar su usuario, no un correo electrónico"
      });
    }

    if (loginAttempts[ip] && loginAttempts[ip].blockedUntil > Date.now()) {
      const remaining = Math.ceil((loginAttempts[ip].blockedUntil - Date.now()) / 1000);
      return res.status(429).json({
        ok: false,
        msg: `Demasiados intentos fallidos. Intente nuevamente en ${remaining} segundos`
      });
    }

    const user = await AppUser.findOne({ where: { usuario } });

    if (!user) {
      registerFailedAttempt(ip);
      return res.status(404).json({
        ok: false,
        msg: "El usuario ingresado no existe"
      });
    }

    const isMatch = await bcrypt.compare(clave, user.clave);

    if (!isMatch) {
      registerFailedAttempt(ip);
      return res.status(401).json({
        ok: false,
        msg: "La contraseña ingresada es incorrecta"
      });
    }

    resetAttempts(ip);

    // 🔥 GENERAR TOKEN JWT
    const token = jwt.sign(
      {
        id: user.id,
        usuario: user.usuario,
        rol: user.rol,
        rutas_asignadas: user.rutas_asignadas
          ? Array.isArray(user.rutas_asignadas)
            ? user.rutas_asignadas
            : user.rutas_asignadas.split(',').map(r => r.trim())
          : []
      },
      config.JWT_SECRET,
      {
        expiresIn: config.JWT_EXPIRES_IN,
        algorithm: "HS256"
      }
    );

    if (isDev) {
      console.log("----- LOGIN EXITOSO -----");
      console.log("Usuario:", user.usuario);
      console.log("Rol:", user.rol);
      console.log("Token generado (parcial):", token.substring(0, 20) + "...");
    }

    return res.status(200).json({
      ok: true,
      msg: "Login exitoso",
      user: {
        id: user.id,
        usuario: user.usuario,
        rol: user.rol,
        rutas_asignadas: user.rutas_asignadas
          ? Array.isArray(user.rutas_asignadas)
            ? user.rutas_asignadas
            : user.rutas_asignadas.split(',').map(r => r.trim())
          : [],
        creado_en: user.creado_en
      },
      token
    });

  } catch (error) {
    console.error("Error en login:", error);

    return res.status(500).json({
      ok: false,
      msg: "Error interno del servidor"
    });
  }
};

/* =============================
   VALIDACIÓN COMÚN DE DATOS DE REGISTRO
============================= */
const validarDatosRegistro = (usuario, clave) => {
  if (!usuario || !clave) {
    return "Usuario y contraseña son obligatorios";
  }
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(usuario)) {
    return "El usuario no puede ser un correo electrónico";
  }
  if (usuario.length < 3) {
    return "El usuario debe tener al menos 3 caracteres";
  }
  if (clave.length < 6) {
    return "La contraseña debe tener al menos 6 caracteres";
  }
  return null;
};

/* =============================
   PASO 1 — SOLICITAR CÓDIGO
   Valida los datos, genera un código y lo envía por correo
   a cgilces@aqua.com.ec. No crea nada todavía.
============================= */
const solicitarCodigo = async (req, res) => {
  try {
    let { usuario, clave } = req.body;
    usuario = (usuario || "").toString().trim().toUpperCase();
    clave = (clave || "").toString().trim();

    const errorValidacion = validarDatosRegistro(usuario, clave);
    if (errorValidacion) {
      return res.status(400).json({ ok: false, msg: errorValidacion });
    }

    // Verificar si el usuario ya existe
    const existente = await AppUser.findOne({ where: { usuario } });
    if (existente) {
      return res.status(409).json({ ok: false, msg: "El usuario ya existe" });
    }

    // Generar y guardar código pendiente
    const codigo = generarCodigo();
    registrosPendientes[usuario] = {
      codigo,
      expira: Date.now() + CODIGO_TTL,
      intentos: 0,
    };

    // Enviar correo (con fallback a consola en dev)
    try {
      await enviarCodigoVerificacion(CORREO_VERIFICACION, codigo, usuario);
    } catch (mailErr) {
      console.error("Error enviando correo de verificación:", mailErr);
      delete registrosPendientes[usuario];
      return res.status(502).json({
        ok: false,
        msg: "No se pudo enviar el código de verificación. Intenta más tarde."
      });
    }

    return res.status(200).json({
      ok: true,
      msg: `Se envió un código de verificación a ${CORREO_VERIFICACION}`,
    });

  } catch (error) {
    console.error("Error en solicitarCodigo:", error);
    return res.status(500).json({ ok: false, msg: "Error interno del servidor" });
  }
};

/* =============================
   PASO 2 — CONFIRMAR REGISTRO
   Verifica el código y, si es correcto, crea el usuario ADMIN.
============================= */
const confirmarRegistro = async (req, res) => {
  try {
    let { usuario, clave, codigo } = req.body;
    usuario = (usuario || "").toString().trim().toUpperCase();
    clave = (clave || "").toString().trim();
    codigo = (codigo || "").toString().trim();

    const errorValidacion = validarDatosRegistro(usuario, clave);
    if (errorValidacion) {
      return res.status(400).json({ ok: false, msg: errorValidacion });
    }

    if (!codigo) {
      return res.status(400).json({ ok: false, msg: "Debes ingresar el código de verificación" });
    }

    const pendiente = registrosPendientes[usuario];
    if (!pendiente) {
      return res.status(400).json({
        ok: false,
        msg: "No hay una solicitud activa para este usuario. Solicita un nuevo código."
      });
    }

    if (Date.now() > pendiente.expira) {
      delete registrosPendientes[usuario];
      return res.status(400).json({
        ok: false,
        msg: "El código expiró. Solicita uno nuevo."
      });
    }

    if (pendiente.intentos >= MAX_INTENTOS_CODIGO) {
      delete registrosPendientes[usuario];
      return res.status(429).json({
        ok: false,
        msg: "Demasiados intentos fallidos. Solicita un nuevo código."
      });
    }

    if (codigo !== pendiente.codigo) {
      pendiente.intentos += 1;
      return res.status(401).json({ ok: false, msg: "Código de verificación incorrecto" });
    }

    // Revalidar que el usuario no se haya creado mientras tanto
    const existente = await AppUser.findOne({ where: { usuario } });
    if (existente) {
      delete registrosPendientes[usuario];
      return res.status(409).json({ ok: false, msg: "El usuario ya existe" });
    }

    // Código correcto → crear usuario ADMIN
    const salt = await bcrypt.genSalt(10);
    const claveHasheada = await bcrypt.hash(clave, salt);

    const nuevo = await AppUser.create({
      usuario,
      clave: claveHasheada,
      rol: "ADMIN",
      rutas_asignadas: []
    });

    delete registrosPendientes[usuario];

    return res.status(201).json({
      ok: true,
      msg: "Usuario administrador creado exitosamente",
      user: {
        id: nuevo.id,
        usuario: nuevo.usuario,
        rol: nuevo.rol,
        rutas_asignadas: nuevo.rutas_asignadas
      }
    });

  } catch (error) {
    console.error("Error en confirmarRegistro:", error);
    return res.status(500).json({ ok: false, msg: "Error interno del servidor" });
  }
};

// --- CONTROL DE INTENTOS ---
const registerFailedAttempt = (ip) => {
  if (!loginAttempts[ip]) {
    loginAttempts[ip] = { count: 1, blockedUntil: null };
  } else {
    loginAttempts[ip].count += 1;
  }

  if (loginAttempts[ip].count >= MAX_ATTEMPTS) {
    loginAttempts[ip].blockedUntil = Date.now() + BLOCK_TIME;
    console.log(`🔐 IP bloqueada ${ip} por demasiados intentos fallidos`);
  }
};

const resetAttempts = (ip) => {
  if (loginAttempts[ip]) delete loginAttempts[ip];
};

module.exports = { login, solicitarCodigo, confirmarRegistro };