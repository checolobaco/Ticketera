const express = require('express');
const router = express.Router();
const db = require('../db');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { jwtSecret } = require('../config');
const auth = require('../middleware/auth');


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

router.post('/register', async (req, res) => {
  try {
    const { name, email, password, eventId } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ message: 'name, email y password son requeridos' });
    }

    const existing = await db.query(
      `SELECT id FROM users WHERE email = $1 LIMIT 1`,
      [email]
    );

    if (existing.rows.length) {
      return res.status(409).json({ message: 'El correo ya está registrado' });
    }

    const bcrypt = require('bcryptjs');
    const jwt = require('jsonwebtoken');

    const passwordHash = await bcrypt.hash(password, 10);

    const insertResult = await db.query(
      `
      INSERT INTO users (name, email, password_hash, role, event_id)
      VALUES ($1, $2, $3, 'CLIENT', $4)
      RETURNING id, name, email, role, event_id
      `,
      [
        name,
        email,
        passwordHash,
        eventId ? String(eventId) : null
      ]
    );

    const user = insertResult.rows[0];

    const token = jwt.sign(
      {
        id: user.id,
        email: user.email,
        role: user.role
      },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    return res.json({
      token,
      user: {
        id: user.id,
        name: user.name,
        role: user.role
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

  try {
    const { rows } = await db.query(
      'SELECT id, name, email, password_hash, role FROM users WHERE email = $1',
      [email]
    );

    if (rows.length === 0) {
      return res.status(401).json({ error: 'INVALID_CREDENTIALS' });
    }

    const user = rows[0];
    const ok = await bcrypt.compare(password, user.password_hash);

    if (!ok) {
      return res.status(401).json({ error: 'INVALID_CREDENTIALS' });
    }

    const token = jwt.sign(
      { id: user.id, role: user.role, name: user.name },
      jwtSecret,
      { expiresIn: '8h' }
    );

    res.json({ token, user: { id: user.id, name: user.name, role: user.role } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'SERVER_ERROR' });
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

module.exports = router;
