const express = require('express');
const router = express.Router();
const db = require('../db');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { jwtSecret, jwtRefreshSecret } = require('../config');
const auth = require('../middleware/auth');
const { sendForgotPasswordEmail, sendOTPEmail } = require('../services/emailService');
const { sendOTPWhatsApp } = require('../services/whatsappService');

function mergeEventIdsCsv(currentValue, newEventId) {
  const currentIds = String(currentValue || '')
    .split(',')
    .map(v => v.trim())
    .filter(Boolean);

  const normalizedNewId = String(newEventId).trim();

  const set = new Set(currentIds);
  if (normalizedNewId) set.add(normalizedNewId);

  return Array.from(set).join(',');
}

async function appendUserEventId(userId, eventId) {
  if (!userId || !eventId) return;

  const numEventId = Number(eventId);
  if (Number.isFinite(numEventId) && numEventId > 0) {
    await db.query(
      `INSERT INTO user_event_links (user_id, event_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
      [userId, numEventId]
    );
  }

  const userResult = await db.query(
    `SELECT event_id FROM users WHERE id = $1 LIMIT 1`,
    [userId]
  );

  if (!userResult.rows.length) return;

  const currentValue = userResult.rows[0].event_id;
  const nextValue = mergeEventIdsCsv(currentValue, eventId);

  await db.query(
    `UPDATE users SET event_id = $2 WHERE id = $1`,
    [userId, nextValue]
  );
}

/**
 * Genera el par de tokens (Access Token + Refresh Token)
 * S4: El Access Token contiene SOLO datos mínimos identificadores (id, role, email). NUNCA teléfono ni cédula.
 * S2: Access Token de vida corta (15m en prod, 1h por defecto) y Refresh Token de 7 días.
 */
function generateTokens(user) {
  const accessToken = jwt.sign(
    {
      id: user.id,
      role: user.role,
      email: user.email
    },
    jwtSecret,
    { expiresIn: '1h' }
  );

  const refreshToken = jwt.sign(
    { id: user.id },
    jwtRefreshSecret,
    { expiresIn: '7d' }
  );

  return { accessToken, refreshToken };
}

// POST /api/auth/register
router.post('/register', async (req, res) => {
  try {
    const { name, email, password, eventId, telefon, cedula } = req.body;

    if (!name || !email || !password || !telefon || !cedula) {
      return res.status(400).json({
        message: 'name, email, password, telefon y cedula son requeridos'
      });
    }

    const cleanEmail = email.trim().toLowerCase();

    const existing = await db.query(
      `SELECT id FROM users WHERE email = $1 LIMIT 1`,
      [cleanEmail]
    );

    if (existing.rows.length) {
      return res.status(409).json({ message: 'El correo ya está registrado' });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const insertResult = await db.query(
      `
      INSERT INTO users (
        name,
        email,
        password_hash,
        role,
        event_id,
        telefon,
        cedula
      )
      VALUES ($1, $2, $3, 'CLIENT', $4, $5, $6)
      RETURNING
        id,
        name,
        email,
        telefon,
        cedula,
        role,
        event_id
      `,
      [
        name.trim(),
        cleanEmail,
        passwordHash,
        eventId ? String(eventId) : null,
        telefon.trim(),
        cedula.trim()
      ]
    );

    const user = insertResult.rows[0];
    const { accessToken, refreshToken } = generateTokens(user);

    return res.json({
      token: accessToken,
      refreshToken,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        telefon: user.telefon,
        cedula: user.cedula,
        role: user.role,
        event_id: user.event_id
      }
    });
  } catch (error) {
    console.error('POST /api/auth/register error:', error);
    return res.status(500).json({ message: 'Error registrando usuario' });
  }
});

const WEAK_PASSWORDS = [
  '1234', '12345', '123456', '1234567', '12345678', '123456789', '1234567890',
  'password', 'contrasena', 'contraseña', 'admin', 'admin123', 'ticketera',
  '0000', '1111', 'qwerty', 'abc123'
];

function isWeakPassword(pwd) {
  if (!pwd) return true;
  const clean = String(pwd).trim().toLowerCase();
  if (clean.length < 6) return true;
  return WEAK_PASSWORDS.includes(clean);
}

// POST /api/auth/login
router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'EMAIL_AND_PASSWORD_REQUIRED' });
  }

  try {
    const cleanEmail = String(email).trim().toLowerCase();

    const { rows } = await db.query(
      `SELECT id, name, telefon, cedula, email, password_hash, role, event_id, must_change_password
       FROM users
       WHERE LOWER(email) = $1
       LIMIT 1`,
      [cleanEmail]
    );

    if (rows.length === 0) {
      return res.status(401).json({ error: 'INVALID_CREDENTIALS' });
    }

    const user = rows[0];
    const ok = await bcrypt.compare(password, user.password_hash);

    if (!ok) {
      return res.status(401).json({ error: 'INVALID_CREDENTIALS' });
    }

    const hasWeakPwd = isWeakPassword(password);
    const mustChangePwd = hasWeakPwd || !!user.must_change_password;

    if (mustChangePwd && !user.must_change_password) {
      try {
        await db.query(`UPDATE users SET must_change_password = true WHERE id = $1`, [user.id]);
      } catch (e) {
        console.warn('Warning updating must_change_password:', e.message);
      }
    }

    const { accessToken, refreshToken } = generateTokens(user);

    res.json({
      token: accessToken,
      refreshToken,
      must_change_password: mustChangePwd,
      user: {
        id: user.id,
        name: user.name,
        role: user.role,
        email: user.email,
        telefon: user.telefon,
        cedula: user.cedula,
        event_id: user.event_id,
        must_change_password: mustChangePwd
      }
    });
  } catch (err) {
    console.error('POST /api/auth/login error:', err);
    res.status(500).json({ error: 'SERVER_ERROR' });
  }
});

/**
 * S2: POST /api/auth/refresh
 * Permite renovar el Access Token vencido mediante el Refresh Token.
 */
router.post('/refresh', async (req, res) => {
  const { refreshToken } = req.body;

  if (!refreshToken) {
    return res.status(400).json({ error: 'REFRESH_TOKEN_REQUIRED' });
  }

  try {
    const payload = jwt.verify(refreshToken, jwtRefreshSecret);
    const userId = payload.id;

    const { rows } = await db.query(
      `SELECT id, name, email, role, telefon, cedula, event_id, must_change_password FROM users WHERE id = $1 LIMIT 1`,
      [userId]
    );

    if (!rows.length) {
      return res.status(401).json({ error: 'USER_NOT_FOUND' });
    }

    const user = rows[0];
    const newTokens = generateTokens(user);

    return res.json({
      token: newTokens.accessToken,
      refreshToken: newTokens.refreshToken,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        telefon: user.telefon,
        cedula: user.cedula,
        event_id: user.event_id,
        must_change_password: !!user.must_change_password
      }
    });
  } catch (err) {
    return res.status(401).json({ error: 'INVALID_REFRESH_TOKEN' });
  }
});

/**
 * S4: GET /api/auth/me
 * Endpoint protegido para obtener los datos completos del perfil del usuario autenticado de forma segura.
 */
router.get('/me', auth(['CLIENT', 'STAFF', 'ADMIN']), async (req, res) => {
  try {
    const userId = req.user.id;

    const { rows } = await db.query(
      `SELECT id, name, email, role, telefon, cedula, event_id, must_change_password, created_at
       FROM users
       WHERE id = $1
       LIMIT 1`,
      [userId]
    );

    if (!rows.length) {
      return res.status(404).json({ error: 'USER_NOT_FOUND' });
    }

    return res.json({ user: rows[0] });
  } catch (err) {
    console.error('GET /api/auth/me error:', err);
    return res.status(500).json({ error: 'SERVER_ERROR' });
  }
});

/**
 * POST /api/auth/change-password
 * Obliga o permite cambiar la contraseña al usuario autenticado.
 */
router.post('/change-password', auth(['CLIENT', 'STAFF', 'ADMIN']), async (req, res) => {
  try {
    const userId = req.user.id;
    const { currentPassword, newPassword } = req.body;

    if (!newPassword || !String(newPassword).trim()) {
      return res.status(400).json({ error: 'NEW_PASSWORD_REQUIRED', message: 'La nueva contraseña es requerida.' });
    }

    const cleanNew = String(newPassword).trim();

    if (cleanNew.length < 6) {
      return res.status(400).json({ error: 'PASSWORD_TOO_SHORT', message: 'La contraseña debe tener al menos 6 caracteres.' });
    }

    if (isWeakPassword(cleanNew)) {
      return res.status(400).json({
        error: 'WEAK_PASSWORD',
        message: 'La nueva contraseña es demasiado sencilla (ej: 1234). Por favor elige una contraseña más segura.'
      });
    }

    if (currentPassword) {
      const userRes = await db.query(`SELECT password_hash FROM users WHERE id = $1 LIMIT 1`, [userId]);
      if (userRes.rows.length) {
        const match = await bcrypt.compare(String(currentPassword), userRes.rows[0].password_hash);
        if (!match) {
          return res.status(400).json({ error: 'INVALID_CURRENT_PASSWORD', message: 'La contraseña actual no es correcta.' });
        }
      }
    }

    const passwordHash = await bcrypt.hash(cleanNew, 10);

    await db.query(
      `UPDATE users SET password_hash = $1, must_change_password = false WHERE id = $2`,
      [passwordHash, userId]
    );

    const { rows } = await db.query(
      `SELECT id, name, email, role, telefon, cedula, event_id FROM users WHERE id = $1 LIMIT 1`,
      [userId]
    );

    const updatedUser = rows[0] || {};
    updatedUser.must_change_password = false;

    return res.json({
      ok: true,
      message: '¡Tu contraseña ha sido actualizada con éxito!',
      user: updatedUser
    });
  } catch (error) {
    console.error('POST /api/auth/change-password error:', error);
    return res.status(500).json({ error: 'SERVER_ERROR', message: 'Error actualizando contraseña.' });
  }
});

router.patch('/me/link-event', auth(['CLIENT', 'STAFF', 'ADMIN']), async (req, res) => {
  try {
    const { eventId } = req.body;
    const userId = req.user.id;

    if (!eventId) {
      return res.status(400).json({ message: 'eventId es requerido' });
    }

    await appendUserEventId(userId, eventId);

    return res.json({ ok: true });
  } catch (error) {
    console.error('PATCH /api/auth/me/link-event error:', error);
    return res.status(500).json({ message: 'Error asociando evento al usuario' });
  }
});

/**
 * POST /api/auth/forgot-password
 * Solicitud de recuperación de contraseña por correo electrónico.
 */
router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;

    if (!email || !String(email).trim()) {
      return res.status(400).json({ error: 'EMAIL_REQUIRED', message: 'El correo electrónico es requerido.' });
    }

    const cleanEmail = String(email).trim().toLowerCase();

    // 1. Buscar usuario
    const { rows } = await db.query(
      `SELECT id, name, email FROM users WHERE LOWER(email) = $1 LIMIT 1`,
      [cleanEmail]
    );

    // Por seguridad, si el usuario no existe respondemos con éxito para prevenir enumeración de usuarios
    if (!rows.length) {
      return res.json({
        ok: true,
        message: 'Si el correo electrónico está registrado, recibirás las instrucciones en tu bandeja de entrada.'
      });
    }

    const user = rows[0];

    // 2. Generar un token aleatorio seguro de 32 bytes (64 caracteres hex)
    const token = crypto.randomBytes(32).toString('hex');

    // 3. Eliminar tokens previos pendientes para este usuario
    await db.query(
      `DELETE FROM password_resets WHERE user_id = $1`,
      [user.id]
    );

    // 4. Guardar nuevo token que expira en 1 hora
    await db.query(
      `INSERT INTO password_resets (user_id, email, token, expires_at)
       VALUES ($1, $2, $3, NOW() + INTERVAL '1 hour')`,
      [user.id, user.email, token]
    );

    // 5. Construir enlace para el frontend
    const frontendUrl = process.env.FRONTEND_URL || 'https://salicaceous-morton-hinderingly.ngrok-free.dev';
    const resetLink = `${frontendUrl}/reset-password?token=${token}&email=${encodeURIComponent(user.email)}`;

    // 6. Enviar correo de restablecimiento
    await sendForgotPasswordEmail({
      toEmail: user.email,
      userName: user.name,
      resetLink
    });

    return res.json({
      ok: true,
      message: 'Si el correo electrónico está registrado, recibirás las instrucciones en tu bandeja de entrada.'
    });
  } catch (error) {
    console.error('POST /api/auth/forgot-password error:', error);
    return res.status(500).json({ error: 'SERVER_ERROR', message: 'No se pudo procesar la solicitud de recuperación.' });
  }
});

/**
 * POST /api/auth/reset-password
 * Restablecimiento efectivo de la contraseña usando el token recibido por correo.
 */
router.post('/reset-password', async (req, res) => {
  try {
    const { token, newPassword } = req.body;

    if (!token || !String(token).trim()) {
      return res.status(400).json({ error: 'TOKEN_REQUIRED', message: 'El token de recuperación es requerido.' });
    }

    if (!newPassword || String(newPassword).length < 6) {
      return res.status(400).json({ error: 'PASSWORD_TOO_SHORT', message: 'La contraseña debe tener al menos 6 caracteres.' });
    }

    const cleanToken = String(token).trim();

    // 1. Buscar token activo y no expirado
    const { rows } = await db.query(
      `SELECT id, user_id, email, expires_at
       FROM password_resets
       WHERE token = $1 AND expires_at > NOW()
       LIMIT 1`,
      [cleanToken]
    );

    if (!rows.length) {
      return res.status(400).json({
        error: 'TOKEN_INVALID_OR_EXPIRED',
        message: 'El enlace de recuperación es inválido o ha expirado. Por favor solicita uno nuevo.'
      });
    }

    const resetRecord = rows[0];

    // 2. Hashear nueva contraseña
    const passwordHash = await bcrypt.hash(String(newPassword), 10);

    // 3. Actualizar contraseña del usuario
    await db.query(
      `UPDATE users SET password_hash = $1 WHERE id = $2`,
      [passwordHash, resetRecord.user_id]
    );

    // 4. Eliminar el token usado
    await db.query(
      `DELETE FROM password_resets WHERE id = $1`,
      [resetRecord.id]
    );

    return res.json({
      ok: true,
      message: '¡Tu contraseña ha sido restablecida con éxito! Ya puedes iniciar sesión con tu nueva contraseña.'
    });
  } catch (error) {
    console.error('POST /api/auth/reset-password error:', error);
    return res.status(500).json({ error: 'SERVER_ERROR', message: 'Error al restablecer la contraseña.' });
  }
});

async function findOrCreateGuestUser({ name, email, phone, cc }) {
  const cleanEmail = String(email || '').trim().toLowerCase();
  const cleanName = String(name || 'Cliente Invitado').trim();
  const cleanPhone = String(phone || '').replace(/\D/g, '');
  const cleanCc = String(cc || '').trim();

  // 1. Buscar si ya existe usuario por email
  const { rows } = await db.query(
    `SELECT id, role, email, name, telefon, cedula FROM users WHERE LOWER(email) = $1 LIMIT 1`,
    [cleanEmail]
  );

  if (rows.length > 0) {
    const u = rows[0];
    if ((!u.telefon && cleanPhone) || (!u.cedula && cleanCc)) {
      await db.query(
        `UPDATE users SET telefon = COALESCE(NULLIF(telefon, ''), $2), cedula = COALESCE(NULLIF(cedula, ''), $3) WHERE id = $1`,
        [u.id, cleanPhone || null, cleanCc || null]
      );
    }
    return u;
  }

  // 2. Si no existe, crear usuario transparente
  const randomPassword = crypto.randomBytes(16).toString('hex');
  const passwordHash = await bcrypt.hash(randomPassword, 10);

  const { rows: newRows } = await db.query(
    `INSERT INTO users (name, email, password_hash, role, telefon, cedula, must_change_password)
     VALUES ($1, $2, $3, 'CLIENT', $4, $5, false)
     RETURNING id, role, email, name, telefon, cedula`,
    [cleanName, cleanEmail, passwordHash, cleanPhone || null, cleanCc || null]
  );

  return newRows[0];
}

/**
 * POST /api/auth/request-otp
 * Solicita código de verificación de 4 dígitos enviado por Correo y WhatsApp
 * Body: { identifier } (email, phone o cc)
 */
router.post('/request-otp', async (req, res) => {
  try {
    const { identifier } = req.body;
    const raw = String(identifier || '').trim();
    if (!raw || raw.length < 3) {
      return res.status(400).json({
        error: 'INVALID_IDENTIFIER',
        message: 'Por favor ingresa un correo, teléfono o cédula válido.'
      });
    }

    const cleanEmail = raw.toLowerCase();
    const cleanDigits = raw.replace(/\D/g, '');

    // Buscar en orders / tickets / usuarios para comprobar si existe alguna boleta o usuario
    const { rows } = await db.query(
      `SELECT DISTINCT
          o.buyer_name,
          o.buyer_email,
          o.buyer_phone,
          o.buyer_cc,
          u.email as user_email,
          u.name as user_name,
          u.telefon as user_phone,
          u.cedula as user_cc
       FROM orders o
       LEFT JOIN users u ON u.id = o.user_id
       WHERE LOWER(o.buyer_email) = $1
          OR LOWER(u.email) = $1
          OR ($2 <> '' AND o.buyer_phone LIKE $3)
          OR ($2 <> '' AND u.telefon LIKE $3)
          OR ($2 <> '' AND o.buyer_cc = $2)
          OR ($2 <> '' AND u.cedula = $2)
       LIMIT 5`,
      [cleanEmail, cleanDigits, `%${cleanDigits}`]
    );

    let targetEmail = null;
    let targetPhone = null;
    let targetName = 'Cliente';

    if (rows.length > 0) {
      const match = rows[0];
      targetEmail = match.buyer_email || match.user_email || (cleanEmail.includes('@') ? cleanEmail : null);
      targetPhone = match.buyer_phone || match.user_phone || (cleanDigits.length >= 7 ? cleanDigits : null);
      targetName = match.buyer_name || match.user_name || 'Cliente';
    } else {
      if (cleanEmail.includes('@')) {
        targetEmail = cleanEmail;
      } else if (cleanDigits.length >= 7) {
        targetPhone = cleanDigits;
      } else {
        return res.status(404).json({
          error: 'NOT_FOUND',
          message: 'No se encontraron compras o boletas asociadas a la información ingresada.'
        });
      }
    }

    // Generar OTP de 4 dígitos
    const otpCode = Math.floor(1000 + Math.random() * 9000).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutos

    // Guardar OTP en BD
    await db.query(
      `INSERT INTO guest_otps (email, phone, cc, otp_code, expires_at)
       VALUES ($1, $2, $3, $4, $5)`,
      [targetEmail || cleanEmail, targetPhone || cleanDigits, cleanDigits || null, otpCode, expiresAt]
    );

    let emailSent = false;

    // Enviar código OTP EXCLUSIVAMENTE por correo electrónico
    if (!targetEmail && cleanEmail.includes('@')) {
      targetEmail = cleanEmail;
    }

    if (!targetEmail) {
      return res.status(400).json({
        error: 'EMAIL_REQUIRED',
        message: 'Por favor ingresa un correo electrónico válido o una cédula/teléfono con correo asociado.'
      });
    }

    const emailResult = await sendOTPEmail({ toEmail: targetEmail, otpCode, name: targetName });
    emailSent = emailResult.success;

    const maskEmail = (em) => em ? em.replace(/(^.{2})(.*)(?=@)/, (gp1, gp2, gp3) => gp2 + '*'.repeat(Math.max(gp3.length, 2))) : null;

    return res.json({
      ok: true,
      otpSent: true,
      sentTo: {
        email: maskEmail(targetEmail),
        emailSent
      },
      message: `Hemos enviado tu código de acceso de 4 dígitos a tu correo electrónico (${maskEmail(targetEmail)}).`
    });

  } catch (error) {
    console.error('POST /api/auth/request-otp error:', error);
    return res.status(500).json({ error: 'SERVER_ERROR', message: 'Error enviando el código de verificación.' });
  }
});

/**
 * POST /api/auth/verify-otp
 * Valida el OTP de 4 dígitos y devuelve un token JWT
 * Body: { identifier, otpCode }
 */
router.post('/verify-otp', async (req, res) => {
  try {
    const { identifier, otpCode } = req.body;
    const cleanId = String(identifier || '').trim().toLowerCase();
    const cleanDigits = String(identifier || '').replace(/\D/g, '');
    const cleanCode = String(otpCode || '').trim();

    if (!cleanId || !cleanCode) {
      return res.status(400).json({ error: 'MISSING_FIELDS', message: 'Identificador y código son requeridos.' });
    }

    // Buscar OTP activo en BD
    const { rows } = await db.query(
      `SELECT id, email, phone, cc, expires_at
       FROM guest_otps
       WHERE (LOWER(email) = $1 OR phone LIKE $2 OR cc = $3)
         AND otp_code = $4
         AND expires_at > NOW()
         AND used = false
       ORDER BY created_at DESC
       LIMIT 1`,
      [cleanId, `%${cleanDigits}`, cleanDigits, cleanCode]
    );

    if (!rows.length) {
      return res.status(400).json({
        error: 'INVALID_OR_EXPIRED_OTP',
        message: 'Código de verificación incorrecto o ha expirado. Solicita uno nuevo.'
      });
    }

    const otpRecord = rows[0];

    // Marcar como usado
    await db.query(`UPDATE guest_otps SET used = true WHERE id = $1`, [otpRecord.id]);

    // Buscar o crear usuario transparente
    const user = await findOrCreateGuestUser({
      name: 'Cliente Invitado',
      email: otpRecord.email || cleanId,
      phone: otpRecord.phone || cleanDigits,
      cc: otpRecord.cc || cleanDigits
    });

    const tokenPayload = {
      id: user.id,
      role: user.role,
      email: user.email,
      name: user.name
    };

    const token = jwt.sign(tokenPayload, jwtSecret, { expiresIn: '7d' });
    const refreshToken = jwt.sign(tokenPayload, jwtRefreshSecret, { expiresIn: '30d' });

    return res.json({
      ok: true,
      token,
      refreshToken,
      user: {
        id: user.id,
        role: user.role,
        email: user.email,
        name: user.name,
        telefon: user.telefon,
        cedula: user.cedula
      }
    });

  } catch (error) {
    console.error('POST /api/auth/verify-otp error:', error);
    return res.status(500).json({ error: 'SERVER_ERROR', message: 'Error al verificar el código.' });
  }
});

module.exports = router;
module.exports.findOrCreateGuestUser = findOrCreateGuestUser;
