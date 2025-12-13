const express = require('express');
const router = express.Router();
const db = require('../db');
const auth = require('../middleware/auth');

// GET /api/events
router.get('/', async (req, res) => {
  try {
    const { rows } = await db.query(
      'SELECT e.*, v.name as venue_name FROM events e LEFT JOIN venues v ON e.venue_id = v.id ORDER BY e.start_datetime ASC'
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'SERVER_ERROR' });
  }
});

// POST /api/events  (solo ADMIN)
router.post('/', auth(['ADMIN']), async (req, res) => {
  const { venue_id, name, description, start_datetime, end_datetime } = req.body;

  try {
    const { rows } = await db.query(
      `INSERT INTO events (venue_id, name, description, start_datetime, end_datetime)
       VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [venue_id || null, name, description || null, start_datetime, end_datetime || null]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'SERVER_ERROR' });
  }
});

module.exports = router;
