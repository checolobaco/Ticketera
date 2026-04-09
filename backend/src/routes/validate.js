const express = require('express');
const router = express.Router();
const db = require('../db');
const deviceAuth = require('../middleware/deviceAuth');
const { verifyTicketPayload } = require('../services/cryptoService');

// POST /api/validate-ticket
// Body: { payload: {...} }
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

    const client = await db.getClient();

    try {
      await client.query('BEGIN');

      const { rows } = await client.query(
        `
        SELECT *
        FROM tickets
        WHERE unique_code = $1
        FOR UPDATE
        `,
        [tid]
      );

      if (rows.length === 0) {
        await client.query(
          `INSERT INTO checkins (ticket_id, device_id, result, reason, raw_payload)
           VALUES (NULL, $1, 'INVALID', 'NOT_FOUND', $2)`,
          [device.id, JSON.stringify(payload)]
        );

        await client.query('COMMIT');
        return res.status(404).json({ valid: false, reason: 'NOT_FOUND' });
      }

      const ticket = rows[0];
      const allowedEntries = Number(ticket.allowed_entries || 1);
      const usedEntries = Number(ticket.used_entries || 0);

      if (ticket.status !== 'ACTIVE' && ticket.status !== 'USED') {
        await client.query(
          `INSERT INTO checkins (ticket_id, device_id, result, reason, raw_payload)
           VALUES ($1, $2, 'INVALID', 'INACTIVE', $3)`,
          [ticket.id, device.id, JSON.stringify(payload)]
        );

        await client.query('COMMIT');
        return res.json({ valid: false, reason: 'INACTIVE' });
      }

      if (usedEntries >= allowedEntries) {
        await client.query(
          `INSERT INTO checkins (ticket_id, device_id, result, reason, raw_payload)
           VALUES ($1, $2, 'DUPLICATE', 'LIMIT_REACHED', $3)`,
          [ticket.id, device.id, JSON.stringify(payload)]
        );

        await client.query('COMMIT');
        return res.json({
          valid: false,
          reason: 'LIMIT_REACHED',
          allowedEntries,
          usedEntries
        });
      }

      const nextUsedEntries = usedEntries + 1;
      const nextStatus = nextUsedEntries >= allowedEntries ? 'USED' : 'ACTIVE';

      await client.query(
        `
        UPDATE tickets
        SET
          used_entries = $2,
          status = $3,
          used_at = CASE
            WHEN $4::boolean THEN NOW()
            ELSE used_at
          END
        WHERE id = $1
        `,
        [
          ticket.id,
          nextUsedEntries,
          nextStatus,
          nextStatus === 'USED'
        ]
      );

      await client.query(
        `INSERT INTO checkins (ticket_id, device_id, result, reason, raw_payload)
         VALUES ($1, $2, 'VALID', 'OK', $3)`,
        [ticket.id, device.id, JSON.stringify(payload)]
      );

      await client.query('COMMIT');

      return res.json({
        valid: true,
        reason: 'OK',
        eventId: eid,
        usedEntries: nextUsedEntries,
        allowedEntries,
        remainingEntries: Math.max(0, allowedEntries - nextUsedEntries),
        completed: nextUsedEntries >= allowedEntries
      });
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } catch (err) {
    console.error(err);
    return res.status(500).json({ valid: false, reason: 'SERVER_ERROR' });
  }
});

module.exports = router;