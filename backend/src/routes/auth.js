const express = require('express');
const router = express.Router();
const db = require('../db');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { jwtSecret, jwtRefreshSecret } = require('../config');
const auth = require('../middleware/auth');
const { sendForgotPasswordEmail } = require('../services/emailService');

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

// POST /api/auth/login
router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'EMAIL_AND_PASSWORD_REQUIRED' });
  }

  try {
    const cleanEmail = String(email).trim().toLowerCase();

    const { rows } = await db.query(
      `SELECT id, name, telefon, cedula, email, password_hash, role, event_id
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

    const { accessToken, refreshToken } = generateTokens(user);

    res.json({
      token: accessToken,
      refreshToken,
      user: {
        id: user.id,
        name: user.name,
        role: user.role,
        email: user.email,
        telefon: user.telefon,
        cedula: user.cedula,
        event_id: user.event_id
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
      `SELECT id, name, email, role, telefon, cedula, event_id FROM users WHERE id = $1 LIMIT 1`,
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
        event_id: user.event_id
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
      `SELECT id, name, email, role, telefon, cedula, event_id, created_at
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

module.exports = router;
