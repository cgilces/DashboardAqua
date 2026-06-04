// utils/mailer.js
// Envío de correos vía SMTP (Gmail).
// Requiere en el .env:
//   SMTP_HOST=smtp.gmail.com
//   SMTP_PORT=587
//   SMTP_SECURE=false
//   SMTP_USER=tucuenta@gmail.com
//   SMTP_PASS=xxxxxxxxxxxxxxxx   (App Password de 16 caracteres, NO la clave normal)
//   SMTP_FROM="Nombre <tucuenta@gmail.com>"   (opcional)
require("dotenv").config();
const nodemailer = require("nodemailer");

const SMTP_HOST = process.env.SMTP_HOST;
const SMTP_PORT = Number(process.env.SMTP_PORT) || 587;
const SMTP_SECURE = String(process.env.SMTP_SECURE).toLowerCase() === "true";
const SMTP_USER = process.env.SMTP_USER;
const SMTP_PASS = process.env.SMTP_PASS;
const SMTP_FROM = process.env.SMTP_FROM || SMTP_USER;

const emailConfigurado = Boolean(SMTP_HOST && SMTP_USER && SMTP_PASS);

let transporter = null;
if (emailConfigurado) {
  transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: SMTP_PORT,
    secure: SMTP_SECURE, // false para STARTTLS en el puerto 587
    auth: {
      user: SMTP_USER,
      pass: SMTP_PASS,
    },
  });
}

/**
 * Envía el código de verificación para crear una cuenta.
 * @param {string} destino   correo destino
 * @param {string} codigo    código de 6 dígitos
 * @param {string} usuario   nombre de usuario que se intenta crear
 */
async function enviarCodigoVerificacion(destino, codigo, usuario) {
  // Fallback de desarrollo: si no hay SMTP configurado, imprime el código
  // en consola para no bloquear las pruebas locales.
  if (!emailConfigurado) {
    console.warn(
      "⚠️  SMTP_HOST / SMTP_USER / SMTP_PASS no configurados en .env. " +
      "No se envió correo real."
    );
    console.log(`📧 [DEV] Código de verificación para "${usuario}" → ${destino}: ${codigo}`);
    return { ok: true, dev: true };
  }

  const html = `
    <div style="font-family:Segoe UI,Arial,sans-serif;max-width:480px;margin:0 auto;background:#0d2218;border-radius:16px;overflow:hidden;border:1px solid rgba(4,108,94,0.35)">
      <div style="background:linear-gradient(135deg,#00c896,#007a5e);padding:20px 24px">
        <h1 style="margin:0;color:#fff;font-size:18px;letter-spacing:1px">Dashboard Grupo Aqua</h1>
      </div>
      <div style="padding:28px 24px;color:#e8f5f0">
        <p style="margin:0 0 16px;font-size:14px">Se solicitó crear una cuenta de <b>administrador</b> con el usuario:</p>
        <p style="margin:0 0 20px;font-size:16px;font-weight:bold;color:#7dd4b0">${usuario}</p>
        <p style="margin:0 0 12px;font-size:14px">Tu código de verificación es:</p>
        <div style="font-size:34px;font-weight:bold;letter-spacing:10px;color:#00c896;background:#0a1f18;border:1px solid #1a4a3a;border-radius:12px;padding:16px;text-align:center">${codigo}</div>
        <p style="margin:20px 0 0;font-size:12px;color:#9fc7b8">Este código expira en 10 minutos. Si no solicitaste esta cuenta, ignora este correo y no se creará nada.</p>
      </div>
      <div style="padding:14px 24px;background:#091510;color:#5a7a6e;font-size:11px;text-align:center">
        Dpto. Sistemas — Grupo Aqua S.A.
      </div>
    </div>`;

  await transporter.sendMail({
    from: SMTP_FROM,
    to: destino,
    subject: `Código de verificación para crear cuenta: ${codigo}`,
    text: `Código de verificación para crear la cuenta "${usuario}": ${codigo}. Expira en 10 minutos.`,
    html,
  });

  return { ok: true, dev: false };
}

module.exports = { enviarCodigoVerificacion, emailConfigurado };
