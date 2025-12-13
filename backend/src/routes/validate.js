const express = require('express');
const router = express.Router();
const db = require('../db');
const deviceAuth = require('../middleware/deviceAuth');
const { verifyTicketPayload } = require('../services/cryptoService');

// POST /api/validate-ticket
// Body: { payload: {...} }   // JSON del QR o NFC
router.post('/', deviceAuth, async (req, res) => {
  const { payload } = req.body;
  const device = req.device;

  try {
    if (!payload || payload.t !== 'TICKET') {
      return res.status(400).json({ valid: false, reason: 'INVALID_TYPE' });
    }

    const { tid, eid, exp, sig } = payload;

    if (!tid || !eid || !sig) {
      return res.status(400).json({ valid: false, reason: 'INVALID_PAYLOAD' });
    }

    const isValidSignature = verifyTicketPayload({ tid, eid, exp, sig });

    if (!isValidSignature) {
      await db.query(
        `INSERT INTO checkins (ticket_id, device_id, result, reason, raw_payload)
         VALUES (NULL, $1, 'INVALID', 'BAD_SIGNATURE', $2)`,
        [device.id, JSON.stringify(payload)]
      );
      return res.status(400).json({ valid: false, reason: 'BAD_SIGNATURE' });
    }

    if (exp && Date.now() / 1000 > exp) {
      await db.query(
        `INSERT INTO checkins (ticket_id, device_id, result, reason, raw_payload)
         VALUES (NULL, $1, 'INVALID', 'EXPIRED', $2)`,
        [device.id, JSON.stringify(payload)]
      );
      return res.status(400).json({ valid: false, reason: 'EXPIRED' });
    }

    const { rows } = await db.query(
      'SELECT * FROM tickets WHERE unique_code = $1',
      [tid]
    );

    if (rows.length === 0) {
      await db.query(
        `INSERT INTO checkins (ticket_id, device_id, result, reason, raw_payload)
         VALUES (NULL, $1, 'INVALID', 'NOT_FOUND', $2)`,
        [device.id, JSON.stringify(payload)]
      );
      return res.status(404).json({ valid: false, reason: 'NOT_FOUND' });
    }

    const ticket = rows[0];

    if (ticket.status === 'USED') {
      await db.query(
        `INSERT INTO checkins (ticket_id, device_id, result, reason, raw_payload)
         VALUES ($1, $2, 'DUPLICATE', 'ALREADY_USED', $3)`,
        [ticket.id, device.id, JSON.stringify(payload)]
      );
      return res.json({
        valid: false,
        reason: 'ALREADY_USED',
        usedAt: ticket.used_at
      });
    }

    if (ticket.status !== 'ACTIVE') {
      await db.query(
        `INSERT INTO checkins (ticket_id, device_id, result, reason, raw_payload)
         VALUES ($1, $2, 'INVALID', 'INACTIVE', $3)`,
        [ticket.id, device.id, JSON.stringify(payload)]
      );
      return res.json({ valid: false, reason: 'INACTIVE' });
    }

    // marcar como usado + registrar checkin en transacción
    const client = await db.getClient();
    try {
      await client.query('BEGIN');
      await client.query(
        `UPDATE tickets SET status = 'USED', used_at = NOW()
         WHERE id = $1 AND status = 'ACTIVE'`,
        [ticket.id]
      );
      await client.query(
        `INSERT INTO checkins (ticket_id, device_id, result, reason, raw_payload)
         VALUES ($1, $2, 'VALID', 'OK', $3)`,
        [ticket.id, device.id, JSON.stringify(payload)]
      );
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }

    return res.json({ valid: true, reason: 'OK', eventId: eid });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ valid: false, reason: 'SERVER_ERROR' });
  }
});

module.exports = router;
