const express = require('express');
const router = express.Router();
const db = require('../db');
const auth = require('../middleware/auth');

// GET /api/tickets/:id
router.get('/:id', auth(['ADMIN','STAFF','CLIENT']), async (req, res) => {
  const ticketId = req.params.id;
  try {
    const { rows } = await db.query(
      `SELECT t.*, tt.event_id
       FROM tickets t
       JOIN ticket_types tt ON t.ticket_type_id = tt.id
       WHERE t.id = $1`,
      [ticketId]
    );
    if (rows.length === 0) {
      return res.status(404).json({ error: 'NOT_FOUND' });
    }
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'SERVER_ERROR' });
  }
});

// PATCH /api/tickets/:id/assign-nfc
// Body: { nfc_uid }
router.patch('/:id/assign-nfc', auth(['ADMIN','STAFF']), async (req, res) => {
  const ticketId = req.params.id;
  const { nfc_uid } = req.body;

  if (!nfc_uid) {
    return res.status(400).json({ error: 'NO_NFC_UID' });
  }

  try {
    const { rows } = await db.query(
      `UPDATE tickets
       SET nfc_uid = $1
       WHERE id = $2
       RETURNING *`,
      [nfc_uid, ticketId]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'NOT_FOUND' });
    }

    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'SERVER_ERROR' });
  }
});

module.exports = router;
