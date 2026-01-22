const express = require('express');
const router = express.Router();
const db = require('../db');
const auth = require('../middleware/auth');

router.get('/my', auth(['CLIENT','ADMIN','STAFF']), async (req, res) => {
  const userId = req.user.id
  const role = req.user.role

  try {
    // CLIENT: solo sus tickets
    // STAFF/ADMIN: opcional, aquí puedes devolver todos o también solo los suyos
    const sql = `
      SELECT
        t.*,
        e.name AS event_name,
        e.image_url AS event_image_url
      FROM tickets t
      JOIN ticket_types tt ON tt.id = t.ticket_type_id
      JOIN events e ON e.id = tt.event_id
      WHERE ($1 = 'CLIENT' AND t.owner_user_id = $2)
         OR ($1 <> 'CLIENT')
      ORDER BY t.created_at DESC
      LIMIT 200
    `

    const { rows } = await db.query(sql, [role, userId])
    res.json(rows)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'SERVER_ERROR' })
  }
})


// GET /api/tickets/search?q=texto
router.get('/search', auth(['ADMIN','STAFF']), async (req, res) => {
  const q = (req.query.q || '').trim()

  if (!q || q.length < 2) {
    return res.status(400).json({ error: 'QUERY_TOO_SHORT' })
  }

  try {
    const like = `%${q}%`

    const { rows } = await db.query(
      `
      SELECT
        t.*,
        e.name as event_name,
        e.image_url AS event_image_url
      FROM tickets t
      JOIN ticket_types tt ON tt.id = t.ticket_type_id
      JOIN events e ON e.id = tt.event_id
      WHERE
        (
          COALESCE(t.holder_name, '') ILIKE $1 OR
          COALESCE(t.holder_email, '') ILIKE $1 OR
          COALESCE(t.holder_phone, '') ILIKE $1 OR
          COALESCE(t.holder_cc, '') ILIKE $1 OR
          COALESCE(e.name, '') ILIKE $1 OR
          CAST(t.id AS TEXT) ILIKE $1 OR
          CAST(t.unique_code AS TEXT) ILIKE $1
        )
      ORDER BY t.created_at DESC
      LIMIT 50;
      `,
      [like]
    )

    res.json(rows)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'SERVER_ERROR' })
  }
})

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
