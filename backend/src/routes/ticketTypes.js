const express = require('express');
const router = express.Router();
const db = require('../db');
const auth = require('../middleware/auth');

// GET /api/ticket-types?eventId=1
router.get('/', async (req, res) => {
  const { eventId } = req.query;

  try {
    let query = 'SELECT * FROM ticket_types';
    const params = [];

    if (eventId) {
      query += ' WHERE event_id = $1';
      params.push(eventId);
    }

    query += ' ORDER BY id ASC';

    const { rows } = await db.query(query, params);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'SERVER_ERROR' });
  }
});

// POST /api/ticket-types (ADMIN)
router.post('/', auth(['ADMIN']), async (req, res) => {
  const { event_id, name, price_cents, stock_total } = req.body;

  try {
    const { rows } = await db.query(
      `INSERT INTO ticket_types (event_id, name, price_cents, stock_total)
       VALUES ($1,$2,$3,$4) RETURNING *`,
      [event_id, name, price_cents, stock_total]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'SERVER_ERROR' });
  }
});

module.exports = router;
