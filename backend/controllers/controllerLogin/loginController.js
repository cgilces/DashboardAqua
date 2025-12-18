const bcrypt = require('bcryptjs');
const { AppUser } = require('../../models');



// Control de intentos fallidos en memoria
const loginAttempts = {};
const MAX_ATTEMPTS = 5;
const BLOCK_TIME = 5 * 60 * 1000; // 5 minutos

const login = async (req, res) => {
  const ip = req.ip || req.connection.remoteAddress;

  try {
    let { usuario, clave } = req.body;

    // --- VALIDACIÓN DE CAMPOS VACÍOS ---
    if (!usuario || !clave) {
      return res.status(400).json({
        ok: false,
        msg: "Usuario y contraseña son obligatorios"
      });
    }

    usuario = usuario.toString().trim().toUpperCase();
    clave = clave.toString().trim();

    // --- DETECTAR SI ESTÁ INGRESANDO UN CORREO ---
    const esEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(usuario);
    if (esEmail) {
      return res.status(400).json({
        ok: false,
        msg: "Debe ingresar su usuario, no un correo electrónico"
      });
    }

    // --- VERIFICAR BLOQUEO POR INTENTOS ---
    if (loginAttempts[ip] && loginAttempts[ip].blockedUntil > Date.now()) {
      const remaining = Math.ceil((loginAttempts[ip].blockedUntil - Date.now()) / 1000);
      return res.status(429).json({
        ok: false,
        msg: `Demasiados intentos fallidos. Intente nuevamente en ${remaining} segundos`
      });
    }

    // --- BUSCAR USUARIO ---
    const user = await AppUser.findOne({
      where: { usuario }
    });

    if (!user) {
      registerFailedAttempt(ip);
      return res.status(404).json({
        ok: false,
        msg: "El usuario ingresado no existe"
      });
    }

    // --- VALIDAR CONTRASEÑA ---
    const isMatch = await bcrypt.compare(clave, user.clave);

    if (!isMatch) {
      registerFailedAttempt(ip);
      return res.status(401).json({
        ok: false,
        msg: "La contraseña ingresada es incorrecta"
      });
    }

    // --- LOGIN EXITOSO ---
    resetAttempts(ip);

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
      }
    });

  } catch (error) {
    console.error("Error en login:", error);

    return res.status(500).json({
      ok: false,
      msg: "Error interno del servidor"
    });
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

module.exports = { login };
