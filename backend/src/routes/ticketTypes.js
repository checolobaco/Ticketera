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
router.post('/', auth(['ADMIN' , 'STAFF']), async (req, res) => {
  const {
    event_id,
    name,
    price_cents,
    price_pesos,
    stock_total,
    entries_per_ticket,
    sales_start_at,
    sales_end_at,
    status
  } = req.body;

  try {
    const entriesPerTicket = Number(entries_per_ticket ?? 1);

    if (!Number.isInteger(entriesPerTicket) || entriesPerTicket < 1) {
      return res.status(400).json({ error: 'entries_per_ticket inválido' });
    }

    const { rows } = await db.query(
      `INSERT INTO ticket_types (
        event_id,
        name,
        price_cents,
        price_pesos,
        stock_total,
        entries_per_ticket,
        sales_start_at,
        sales_end_at,
        status
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
      RETURNING *`,
      [
        Number(event_id),
        name,
        Number(price_cents || 0),
        Number(price_pesos || 0),
        Number(stock_total || 0),
        entriesPerTicket,
        sales_start_at || null,
        sales_end_at || null,
        status || 'ACTIVE'
      ]
    );

    res.status(201).json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'SERVER_ERROR' });
  }
});

router.patch('/:id', auth(['ADMIN' , 'STAFF']), async (req, res) => {
  const { id } = req.params;
  const {
    name,
    price_cents,
    price_pesos,
    stock_total,
    entries_per_ticket,
    sales_start_at,
    sales_end_at,
    status
  } = req.body;

  try {
    const entriesPerTicket = Number(entries_per_ticket ?? 1);

    if (!Number.isInteger(entriesPerTicket) || entriesPerTicket < 1) {
      return res.status(400).json({ error: 'entries_per_ticket inválido' });
    }

    const { rows } = await db.query(
      `UPDATE ticket_types
       SET
         name = $1,
         price_cents = $2,
         price_pesos = $3,
         stock_total = $4,
         entries_per_ticket = $5,
         sales_start_at = $6,
         sales_end_at = $7,
         status = $8,
         updated_at = now()
       WHERE id = $9
       RETURNING *`,
      [
        name,
        Number(price_cents || 0),
        Number(price_pesos || 0),
        Number(stock_total || 0),
        entriesPerTicket,
        sales_start_at || null,
        sales_end_at || null,
        status || 'ACTIVE',
        id
      ]
    );

    if (!rows.length) return res.sendStatus(404);

    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'SERVER_ERROR' });
  }
});

module.exports = router;