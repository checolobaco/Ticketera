const express = require('express');
const router = express.Router();
const db = require('../db');
const deviceAuth = require('../middleware/deviceAuth');
const { verifyTicketPayload } = require('../services/cryptoService');
const {
  getTicketBenefitClaims,
  redeemTicketBenefit
} = require('../services/promoBenefitsService');

async function logCheckin(client, { ticketId = null, deviceId, result, reason, payload, extra = null }) {
  await client.query(
    `INSERT INTO checkins (ticket_id, device_id, result, reason, raw_payload)
     VALUES ($1, $2, $3, $4, $5)`,
    [
      ticketId,
      deviceId,
      result,
      extra ? `${reason}:${JSON.stringify(extra)}` : reason,
      JSON.stringify(payload)
    ]
  );
}

function mapBenefitClaims(claims) {
  return claims.map(claim => ({
    id: Number(claim.id),
    benefitName: claim.benefit_name,
    benefitDescription: claim.benefit_description || '',
    totalQuantity: Number(claim.total_quantity || 0),
    redeemedQuantity: Number(claim.redeemed_quantity || 0),
    remainingQuantity: Math.max(
      0,
      Number(claim.total_quantity || 0) - Number(claim.redeemed_quantity || 0)
    ),
    status: claim.status
  }));
}

// POST /api/validate-ticket
// Body: { payload: {...}, usage_context?: 'ENTRY'|'BENEFIT', benefit_claim_id?: number }
router.post('/', deviceAuth, async (req, res) => {
  const { payload, usage_context, benefit_claim_id } = req.body;
  const device = req.device;
  const usageContext = String(usage_context || 'ENTRY').toUpperCase();

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
        await logCheckin(client, {
          deviceId: device.id,
          result: 'INVALID',
          reason: 'NOT_FOUND',
          payload
        });

        await client.query('COMMIT');
        return res.status(404).json({ valid: false, reason: 'NOT_FOUND' });
      }

      const ticket = rows[0];
      const allowedEntries = Number(ticket.allowed_entries || 1);
      const usedEntries = Number(ticket.used_entries || 0);

      if (ticket.status !== 'ACTIVE' && ticket.status !== 'USED') {
        await logCheckin(client, {
          ticketId: ticket.id,
          deviceId: device.id,
          result: 'INVALID',
          reason: 'INACTIVE',
          payload
        });

        await client.query('COMMIT');
        return res.json({ valid: false, reason: 'INACTIVE' });
      }

      if (usageContext === 'BENEFIT') {
        const claims = await getTicketBenefitClaims(ticket.id, client);
        const mappedClaims = mapBenefitClaims(claims);

        if (!mappedClaims.length) {
          await logCheckin(client, {
            ticketId: ticket.id,
            deviceId: device.id,
            result: 'INVALID',
            reason: 'NO_BENEFITS',
            payload
          });

          await client.query('COMMIT');
          return res.json({
            valid: false,
            reason: 'NO_BENEFITS',
            eventId: eid
          });
        }

        const selectedClaimId = Number(benefit_claim_id || 0);

        if (!selectedClaimId) {
          await logCheckin(client, {
            ticketId: ticket.id,
            deviceId: device.id,
            result: 'VALID',
            reason: 'BENEFITS_AVAILABLE',
            payload
          });

          await client.query('COMMIT');
          return res.json({
            valid: true,
            reason: 'BENEFITS_AVAILABLE',
            eventId: eid,
            requiresSelection: true,
            benefitClaims: mappedClaims
          });
        }

        const updatedClaim = await redeemTicketBenefit({
          client,
          ticketId: ticket.id,
          claimId: selectedClaimId
        });

        const updatedClaims = mapBenefitClaims(
          claims.map(claim =>
            Number(claim.id) === Number(updatedClaim.id) ? updatedClaim : claim
          )
        );

        await logCheckin(client, {
          ticketId: ticket.id,
          deviceId: device.id,
          result: 'VALID',
          reason: 'BENEFIT_REDEEMED',
          payload,
          extra: { benefit_claim_id: selectedClaimId }
        });

        await client.query('COMMIT');
        return res.json({
          valid: true,
          reason: 'BENEFIT_REDEEMED',
          eventId: eid,
          benefitClaim: {
            id: Number(updatedClaim.id),
            benefitName: updatedClaim.benefit_name,
            benefitDescription: updatedClaim.benefit_description || '',
            totalQuantity: Number(updatedClaim.total_quantity || 0),
            redeemedQuantity: Number(updatedClaim.redeemed_quantity || 0),
            remainingQuantity: Math.max(
              0,
              Number(updatedClaim.total_quantity || 0) - Number(updatedClaim.redeemed_quantity || 0)
            ),
            status: updatedClaim.status
          },
          benefitClaims: updatedClaims
        });
      }

      if (usedEntries >= allowedEntries) {
        await logCheckin(client, {
          ticketId: ticket.id,
          deviceId: device.id,
          result: 'DUPLICATE',
          reason: 'LIMIT_REACHED',
          payload
        });

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

      await logCheckin(client, {
        ticketId: ticket.id,
        deviceId: device.id,
        result: 'VALID',
        reason: 'OK',
        payload
      });

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

      if (err.message === 'BENEFIT_NOT_FOUND') {
        return res.status(404).json({ valid: false, reason: err.message });
      }

      if (err.message === 'BENEFIT_ALREADY_REDEEMED') {
        return res.status(400).json({ valid: false, reason: err.message });
      }

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
