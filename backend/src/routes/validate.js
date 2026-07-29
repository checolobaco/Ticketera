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

function getRedeemableBenefitClaims(claims) {
  return claims.filter(claim => Number(claim.remainingQuantity || 0) > 0);
}

/**
 * Helper para verificar si la hora actual excede la hora límite de ingreso del tipo de ticket
 */
function isLateEntry(deadlineTimeStr) {
  if (!deadlineTimeStr || !String(deadlineTimeStr).trim()) return false;

  const now = new Date();
  const [targetHour, targetMinute] = String(deadlineTimeStr).trim().split(':').map(Number);
  
  if (isNaN(targetHour) || isNaN(targetMinute)) return false;

  const currentHour = now.getHours();
  const currentMinute = now.getMinutes();

  if (currentHour > targetHour) return true;
  if (currentHour === targetHour && currentMinute > targetMinute) return true;

  return false;
}

// POST /api/validate-ticket
// Body: { payload: {...}, usage_context?: 'ENTRY'|'BENEFIT', benefit_claim_id?: number, allow_late_override?: boolean, surcharge_paid?: number, late_notes?: string }
router.post('/', deviceAuth, async (req, res) => {
  const { payload, usage_context, benefit_claim_id, allow_late_override, surcharge_paid, late_notes } = req.body;
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
        SELECT t.*, tt.name as ticket_type_name, tt.entry_deadline_time, tt.lateness_surcharge_fee, tt.requires_admin_approval_if_late
        FROM tickets t
        LEFT JOIN ticket_types tt ON t.ticket_type_id = tt.id
        WHERE t.unique_code = $1
        FOR UPDATE OF t
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

      // FL3: Verificar fecha y estado del evento asignado
      const { rows: eventRows } = await client.query(
        `SELECT id, name, status, start_datetime, end_datetime FROM events WHERE id = $1 LIMIT 1`,
        [eid]
      );

      if (eventRows.length) {
        const event = eventRows[0];
        if (event.status === 'CANCELLED' || event.status === 'INACTIVE') {
          await logCheckin(client, {
            ticketId: ticket.id,
            deviceId: device.id,
            result: 'INVALID',
            reason: 'EVENT_INACTIVE',
            payload
          });
          await client.query('COMMIT');
          return res.json({ valid: false, reason: 'EVENT_INACTIVE' });
        }
      }

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
        const redeemableClaims = getRedeemableBenefitClaims(mappedClaims);

        if (!mappedClaims.length || !redeemableClaims.length) {
          await logCheckin(client, {
            ticketId: ticket.id,
            deviceId: device.id,
            result: 'INVALID',
            reason: mappedClaims.length ? 'BENEFIT_ALREADY_REDEEMED' : 'NO_BENEFITS',
            payload
          });

          await client.query('COMMIT');
          return res.json({
            valid: false,
            reason: mappedClaims.length ? 'BENEFIT_ALREADY_REDEEMED' : 'NO_BENEFITS',
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
            benefitClaims: redeemableClaims
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
          benefitClaims: getRedeemableBenefitClaims(updatedClaims)
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

      // ── VERIFICACIÓN DE INGRESO EXTEMPORÁNEO (HORA LÍMITE DE TICKET) ──
      const lateRestricted = isLateEntry(ticket.entry_deadline_time);

      if (lateRestricted && !allow_late_override) {
        await logCheckin(client, {
          ticketId: ticket.id,
          deviceId: device.id,
          result: 'INVALID',
          reason: 'LATE_ENTRY_RESTRICTED',
          payload,
          extra: { deadline: ticket.entry_deadline_time, surcharge: ticket.lateness_surcharge_fee }
        });

        await client.query('COMMIT');

        const now = new Date();
        const currentTimeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

        return res.json({
          valid: false,
          reason: 'LATE_ENTRY_RESTRICTED',
          ticketId: ticket.id,
          ticketTypeName: ticket.ticket_type_name || 'Ticket General',
          entryDeadline: ticket.entry_deadline_time,
          currentTime: currentTimeStr,
          surchargeFee: Number(ticket.lateness_surcharge_fee || 0),
          requiresAdminApproval: Boolean(ticket.requires_admin_approval_if_late),
          message: `Entrada extemporánea. Este ticket venció a las ${ticket.entry_deadline_time}. Requiere cobro de recargo/multa ($${Number(ticket.lateness_surcharge_fee || 0).toLocaleString()}) o autorización del Administrador.`
        });
      }
      // ─────────────────────────────────────────────────────────────────

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
          END,
          late_entry_surcharge_paid = CASE WHEN $5::boolean THEN $6::numeric ELSE late_entry_surcharge_paid END,
          late_entry_notes = CASE WHEN $5::boolean THEN $7::text ELSE late_entry_notes END
        WHERE id = $1
        `,
        [
          ticket.id,
          nextUsedEntries,
          nextStatus,
          nextStatus === 'USED',
          Boolean(allow_late_override),
          Number(surcharge_paid || 0),
          late_notes || (allow_late_override ? 'Ingreso extemporáneo autorizado por staff' : null)
        ]
      );

      await logCheckin(client, {
        ticketId: ticket.id,
        deviceId: device.id,
        result: 'VALID',
        reason: allow_late_override ? 'OK_LATE_OVERRIDE' : 'OK',
        payload,
        extra: allow_late_override ? { surcharge_paid: surcharge_paid || 0 } : null
      });

      await client.query('COMMIT');

      return res.json({
        valid: true,
        reason: allow_late_override ? 'OK_LATE_OVERRIDE' : 'OK',
        eventId: eid,
        ticketTypeName: ticket.ticket_type_name || 'Ticket',
        usedEntries: nextUsedEntries,
        allowedEntries,
        remainingEntries: Math.max(0, allowedEntries - nextUsedEntries),
        completed: nextUsedEntries >= allowedEntries,
        wasLateOverride: Boolean(allow_late_override),
        surchargePaid: Number(surcharge_paid || 0)
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
