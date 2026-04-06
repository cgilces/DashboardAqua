const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { AppUser } = require('../../models');
const config = require('../../config');

const loginAttempts = {};
const MAX_ATTEMPTS = 5;
const BLOCK_TIME = 5 * 60 * 1000;

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
<<<<<<< HEAD
        rol: user.rol,
        rutas_asignadas: user.rutas_asignadas
          ? Array.isArray(user.rutas_asignadas)
            ? user.rutas_asignadas
            : user.rutas_asignadas.split(',').map(r => r.trim())
          : []
=======
        rol: user.rol
>>>>>>> 3e145c1ea3658674e887177a34c1260b43081e2c
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