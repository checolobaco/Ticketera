const express = require('express');
const router = express.Router();
const db = require('../db');
const auth = require('../middleware/auth');
const { sendSingleTicketEmail, sendMultipleTicketsEmail } = require('../services/emailService');
const { getTicketBenefitClaims, redeemTicketBenefit } = require('../services/promoBenefitsService');

/**
 * Obtiene los IDs de los eventos asignados a un usuario STAFF.
 * Consulta tanto la tabla `event_staff` como el campo CSV `users.event_id`.
 */
async function getStaffAssignedEventIds(userId) {
  const { rows: staffRows } = await db.query(
    `SELECT DISTINCT event_id FROM event_staff WHERE user_id = $1`,
    [userId]
  );

  const { rows: linkRows } = await db.query(
    `SELECT DISTINCT event_id FROM user_event_links WHERE user_id = $1`,
    [userId]
  );

  const { rows: userRows } = await db.query(
    `SELECT event_id FROM users WHERE id = $1 LIMIT 1`,
    [userId]
  );

  const eventIds = new Set([
    ...staffRows.map(r => Number(r.event_id)),
    ...linkRows.map(r => Number(r.event_id))
  ]);

  if (userRows.length && userRows[0].event_id) {
    String(userRows[0].event_id)
      .split(',')
      .map(s => s.trim())
      .filter(Boolean)
      .forEach(id => {
        const num = Number(id);
        if (Number.isFinite(num) && num > 0) eventIds.add(num);
      });
  }

  return Array.from(eventIds);
}

// GET /api/tickets/my
// ADMIN: Ve todos los tickets de todos los eventos
// STAFF: Solo ve los tickets de los eventos que tiene asignados
// CLIENT: Solo ve los tickets de su propiedad (owner_user_id)
router.get('/my', auth(['CLIENT', 'ADMIN', 'STAFF']), async (req, res) => {
  const userId = req.user.id;
  const role = req.user.role;

  try {
    if (role === 'ADMIN') {
      const sql = `
        SELECT
          t.*,
          tt.name AS ticket_type_name,
          tt.entry_deadline_time,
          tt.lateness_surcharge_fee,
          tt.requires_admin_approval_if_late,
          e.name AS event_name,
          e.cover_image_url AS event_cover_image_url
        FROM tickets t
        JOIN ticket_types tt ON tt.id = t.ticket_type_id
        JOIN events e ON e.id = tt.event_id
        ORDER BY t.created_at DESC
        LIMIT 200
      `;
      const { rows } = await db.query(sql);
      return res.json(rows);
    }

    if (role === 'STAFF') {
      const assignedEventIds = await getStaffAssignedEventIds(userId);

      if (!assignedEventIds.length) {
        return res.json([]);
      }

      const sql = `
        SELECT
          t.*,
          tt.name AS ticket_type_name,
          tt.entry_deadline_time,
          tt.lateness_surcharge_fee,
          tt.requires_admin_approval_if_late,
          e.name AS event_name,
          e.cover_image_url AS event_cover_image_url
        FROM tickets t
        JOIN ticket_types tt ON tt.id = t.ticket_type_id
        JOIN events e ON e.id = tt.event_id
        WHERE e.id = ANY($1::int[])
        ORDER BY t.created_at DESC
        LIMIT 200
      `;
      const { rows } = await db.query(sql, [assignedEventIds]);
      return res.json(rows);
    }

    // CLIENT / GUEST: Buscar boletas asociadas al ID de usuario, email, teléfono o cédula
    let userEmail = String(req.user.email || '').trim().toLowerCase();
    let userPhone = String(req.user.telefon || '').replace(/\D/g, '');
    let userCc = String(req.user.cedula || '').trim();

    try {
      const uRes = await db.query(`SELECT email, telefon, cedula FROM users WHERE id = $1 LIMIT 1`, [userId]);
      if (uRes.rows.length) {
        const u = uRes.rows[0];
        if (!userEmail && u.email) userEmail = String(u.email).trim().toLowerCase();
        if (!userPhone && u.telefon) userPhone = String(u.telefon).replace(/\D/g, '');
        if (!userCc && u.cedula) userCc = String(u.cedula).trim();
      }
    } catch (uErr) {
      console.warn('⚠️ Aviso consultando datos de usuario:', uErr.message);
    }

    // 1. Auto-vincular tickets que coincidan estrictamente con los datos del usuario
    try {
      if (userEmail || userPhone || userCc) {
        await db.query(`
          UPDATE tickets
          SET owner_user_id = $1
          WHERE owner_user_id IS NULL
            AND (
              ($2 <> '' AND (LOWER(holder_email) = $2 OR EXISTS (SELECT 1 FROM orders o WHERE o.id = tickets.order_id AND LOWER(o.buyer_email) = $2)))
              OR ($2 = '' AND $3 <> '' AND LENGTH($3) >= 7 AND (REGEXP_REPLACE(COALESCE(holder_phone, ''), '\\D', '', 'g') = $3 OR EXISTS (SELECT 1 FROM orders o WHERE o.id = tickets.order_id AND REGEXP_REPLACE(COALESCE(o.buyer_phone, ''), '\\D', '', 'g') = $3)))
              OR ($2 = '' AND $4 <> '' AND (holder_cc = $4 OR EXISTS (SELECT 1 FROM orders o WHERE o.id = tickets.order_id AND o.buyer_cc = $4)))
            )
        `, [userId, userEmail, userPhone, userCc]);
      }
    } catch (linkErr) {
      console.warn('⚠️ Aviso auto-vinculando tickets:', linkErr.message);
    }

    // 2. Obtener todas las boletas vinculadas al usuario (Prioriza Email si existe)
    const sql = `
      SELECT DISTINCT
        t.*,
        tt.name AS ticket_type_name,
        e.name AS event_name,
        e.cover_image_url AS event_cover_image_url,
        e.image_url AS event_image_url
      FROM tickets t
      JOIN ticket_types tt ON tt.id = t.ticket_type_id
      JOIN events e ON e.id = tt.event_id
      LEFT JOIN orders o ON o.id = t.order_id
      WHERE (
        ($1 <> '' AND (LOWER(t.holder_email) = $1 OR LOWER(o.buyer_email) = $1))
        OR ($1 = '' AND $2 <> '' AND LENGTH($2) >= 7 AND (REGEXP_REPLACE(COALESCE(t.holder_phone, ''), '\\D', '', 'g') = $2 OR REGEXP_REPLACE(COALESCE(o.buyer_phone, ''), '\\D', '', 'g') = $2))
        OR ($1 = '' AND $3 <> '' AND (t.holder_cc = $3 OR o.buyer_cc = $3))
      )
      ORDER BY t.created_at DESC
      LIMIT 200
    `;
    const { rows } = await db.query(sql, [userEmail, userPhone, userCc]);
    return res.json(rows);

  } catch (err) {
    console.error('GET /api/tickets/my error:', err);
    res.status(500).json({ error: 'SERVER_ERROR' });
  }
});

// GET /api/tickets/search?q=texto
// ADMIN: busca en todos los eventos
// STAFF: busca solo en los eventos asignados
router.get('/search', auth(['ADMIN', 'STAFF']), async (req, res) => {
  const q = (req.query.q || '').trim();

  if (!q || q.length < 2) {
    return res.status(400).json({ error: 'QUERY_TOO_SHORT' });
  }

  try {
    const like = `%${q}%`;

    if (req.user.role === 'STAFF') {
      const assignedEventIds = await getStaffAssignedEventIds(req.user.id);
      if (!assignedEventIds.length) {
        return res.json([]);
      }

      const { rows } = await db.query(
        `
        SELECT
          t.*,
          e.name as event_name,
          e.cover_image_url AS event_cover_image_url
        FROM tickets t
        JOIN ticket_types tt ON tt.id = t.ticket_type_id
        JOIN events e ON e.id = tt.event_id
        WHERE
          e.id = ANY($2::int[]) AND
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
        [like, assignedEventIds]
      );
      return res.json(rows);
    }

    // ADMIN: Buscar en todos los eventos
    const { rows } = await db.query(
      `
      SELECT
        t.*,
        e.name as event_name,
        e.cover_image_url AS event_cover_image_url
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
    );

    res.json(rows);
  } catch (err) {
    console.error('GET /api/tickets/search error:', err);
    res.status(500).json({ error: 'SERVER_ERROR' });
  }
});

// GET /api/tickets/:id
router.get('/:id', auth(['ADMIN', 'STAFF', 'CLIENT']), async (req, res) => {
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

    const ticket = rows[0];

    // STAFF: Verificar que el ticket pertenezca a un evento asignado
    if (req.user.role === 'STAFF') {
      const assignedEventIds = await getStaffAssignedEventIds(req.user.id);
      if (!assignedEventIds.includes(Number(ticket.event_id))) {
        return res.status(403).json({ error: 'FORBIDDEN' });
      }
    }

    // CLIENT: Verificar propiedad o coincidencia de datos
    if (req.user.role === 'CLIENT') {
      const isOwner = Number(ticket.owner_user_id) === Number(req.user.id);
      const userEmail = String(req.user.email || '').trim().toLowerCase();
      const userPhone = String(req.user.telefon || '').replace(/\D/g, '');
      const userCc = String(req.user.cedula || '').trim();

      const holderEmail = String(ticket.holder_email || '').trim().toLowerCase();
      const buyerEmail = String(ticket.buyer_email || '').trim().toLowerCase();
      const emailMatch = userEmail && (holderEmail === userEmail || buyerEmail === userEmail);

      const holderPhone = String(ticket.holder_phone || '').replace(/\D/g, '');
      const buyerPhone = String(ticket.buyer_phone || '').replace(/\D/g, '');
      const phoneMatch = userPhone && (holderPhone.endsWith(userPhone) || userPhone.endsWith(holderPhone) || buyerPhone.endsWith(userPhone) || userPhone.endsWith(buyerPhone));

      const holderCc = String(ticket.holder_cc || '').trim();
      const buyerCc = String(ticket.buyer_cc || '').trim();
      const ccMatch = userCc && (holderCc === userCc || buyerCc === userCc);

      if (!isOwner && !emailMatch && !phoneMatch && !ccMatch) {
        return res.status(403).json({ error: 'FORBIDDEN' });
      }
    }

    res.json(ticket);
  } catch (err) {
    console.error('GET /api/tickets/:id error:', err);
    res.status(500).json({ error: 'SERVER_ERROR' });
  }
});

// GET /api/tickets/:id/wallet
router.get('/:id/wallet', async (req, res) => {
  if (process.env.ENABLE_GOOGLE_WALLET !== 'true') {
    return res.status(503).send('Google Wallet no está habilitado en este momento.');
  }

  const ticketId = req.params.id;
  try {
    const { rows } = await db.query(
      `SELECT t.*, e.name as event_name, e.image_url as event_image_url, e.ticket_image_url,
              v.name as venue_name, v.address as venue_address, tt.event_id, tt.entry_deadline_time
       FROM tickets t
       JOIN ticket_types tt ON t.ticket_type_id = tt.id
       JOIN events e ON tt.event_id = e.id
       LEFT JOIN venues v ON e.venue_id = v.id
       WHERE t.id = $1`,
      [ticketId]
    );
    
    if (rows.length === 0) {
      return res.status(404).send('Ticket no encontrado');
    }

    const ticketRow = rows[0];

    const eventData = {
      id: ticketRow.event_id,
      name: ticketRow.event_name,
      image_url: ticketRow.event_image_url,
      ticket_image_url: ticketRow.ticket_image_url
    };

    const venueData = {
      name: ticketRow.venue_name,
      address: ticketRow.venue_address
    };

    const { generateWalletJwtUrl } = require('../services/googleWalletService');
    const walletUrl = await generateWalletJwtUrl(ticketRow, eventData, venueData);

    // Redirigir al usuario a Google Wallet
    res.redirect(302, walletUrl);
  } catch (err) {
    console.error('GET /api/tickets/:id/wallet error:', err);
    res.status(500).send('Error generando pase de Google Wallet');
  }
});

router.get('/:id/benefits', auth(['ADMIN', 'STAFF', 'CLIENT']), async (req, res) => {
  try {
    const ticketId = Number(req.params.id);

    const { rows } = await db.query(
      `SELECT t.id, t.owner_user_id, tt.event_id
       FROM tickets t
       JOIN ticket_types tt ON tt.id = t.ticket_type_id
       WHERE t.id = $1
       LIMIT 1`,
      [ticketId]
    );

    if (!rows.length) {
      return res.status(404).json({ error: 'NOT_FOUND' });
    }

    if (req.user.role === 'CLIENT' && Number(rows[0].owner_user_id) !== Number(req.user.id)) {
      return res.status(403).json({ error: 'FORBIDDEN' });
    }

    if (req.user.role === 'STAFF') {
      const assignedEventIds = await getStaffAssignedEventIds(req.user.id);
      if (!assignedEventIds.includes(Number(rows[0].event_id))) {
        return res.status(403).json({ error: 'FORBIDDEN' });
      }
    }

    const claims = await getTicketBenefitClaims(ticketId);
    return res.json(claims);
  } catch (err) {
    console.error('GET /api/tickets/:id/benefits error:', err);
    return res.status(500).json({ error: 'SERVER_ERROR' });
  }
});

router.post('/:id/benefits/:claimId/redeem', auth(['ADMIN', 'STAFF']), async (req, res) => {
  const client = await db.getClient();

  try {
    const ticketId = Number(req.params.id);
    const claimId = Number(req.params.claimId);

    // STAFF: Verificar asignación de evento antes de canjear beneficio
    if (req.user.role === 'STAFF') {
      const { rows: tRows } = await db.query(
        `SELECT tt.event_id FROM tickets t JOIN ticket_types tt ON tt.id = t.ticket_type_id WHERE t.id = $1 LIMIT 1`,
        [ticketId]
      );
      if (tRows.length) {
        const assignedEventIds = await getStaffAssignedEventIds(req.user.id);
        if (!assignedEventIds.includes(Number(tRows[0].event_id))) {
          client.release();
          return res.status(403).json({ error: 'FORBIDDEN' });
        }
      }
    }

    await client.query('BEGIN');

    const updated = await redeemTicketBenefit({
      client,
      ticketId,
      claimId
    });

    await client.query('COMMIT');
    return res.json(updated);
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('POST /api/tickets/:id/benefits/:claimId/redeem error:', err);

    if (err.message === 'BENEFIT_NOT_FOUND') {
      return res.status(404).json({ error: err.message });
    }

    if (err.message === 'BENEFIT_ALREADY_REDEEMED') {
      return res.status(400).json({ error: err.message });
    }

    return res.status(500).json({ error: 'SERVER_ERROR' });
  } finally {
    client.release();
  }
});

// PATCH /api/tickets/:id/assign-nfc
router.patch('/:id/assign-nfc', auth(['ADMIN', 'STAFF']), async (req, res) => {
  const ticketId = req.params.id;
  const { nfc_uid } = req.body;

  if (!nfc_uid) {
    return res.status(400).json({ error: 'NO_NFC_UID' });
  }

  try {
    if (req.user.role === 'STAFF') {
      const { rows: tRows } = await db.query(
        `SELECT tt.event_id FROM tickets t JOIN ticket_types tt ON tt.id = t.ticket_type_id WHERE t.id = $1 LIMIT 1`,
        [ticketId]
      );
      if (tRows.length) {
        const assignedEventIds = await getStaffAssignedEventIds(req.user.id);
        if (!assignedEventIds.includes(Number(tRows[0].event_id))) {
          return res.status(403).json({ error: 'FORBIDDEN' });
        }
      }
    }

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
    console.error('PATCH /api/tickets/:id/assign-nfc error:', err);
    res.status(500).json({ error: 'SERVER_ERROR' });
  }
});

// POST /api/tickets/:id/resend-email
router.post('/:id/resend-email', auth(['ADMIN', 'STAFF', 'CLIENT']), async (req, res) => {
  try {
    const ticketId = Number(req.params.id);
    const { toEmail } = req.body;

    if (!ticketId) return res.status(400).json({ error: 'INVALID_TICKET_ID' });
    if (!toEmail) return res.status(400).json({ error: 'MISSING_EMAIL' });

    const ok = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(toEmail).trim());
    if (!ok) return res.status(400).json({ error: 'INVALID_EMAIL' });

    // 🔒 Si es CLIENT, solo puede reenviar tickets suyos
    if (req.user.role === 'CLIENT') {
      const { rows } = await db.query(
        `SELECT owner_user_id FROM tickets WHERE id = $1 LIMIT 1`,
        [ticketId]
      );
      if (!rows.length) return res.status(404).json({ error: 'TICKET_NOT_FOUND' });

      if (Number(rows[0].owner_user_id) !== Number(req.user.id)) {
        return res.status(403).json({ error: 'FORBIDDEN' });
      }
    }

    // 🔒 Si es STAFF, solo puede reenviar de eventos asignados
    if (req.user.role === 'STAFF') {
      const { rows } = await db.query(
        `SELECT tt.event_id FROM tickets t JOIN ticket_types tt ON tt.id = t.ticket_type_id WHERE t.id = $1 LIMIT 1`,
        [ticketId]
      );
      if (rows.length) {
        const assignedEventIds = await getStaffAssignedEventIds(req.user.id);
        if (!assignedEventIds.includes(Number(rows[0].event_id))) {
          return res.status(403).json({ error: 'FORBIDDEN' });
        }
      }
    }

    const r = await sendSingleTicketEmail({ ticketId, toEmail: String(toEmail).trim() });
    if (r?.error) return res.status(400).json(r);

    return res.json({ success: true });
  } catch (e) {
    console.error('POST /api/tickets/:id/resend-email error:', e);
    return res.status(500).json({ error: 'SERVER_ERROR' });
  }
});

// POST /api/tickets/:id/resend-whatsapp
router.post('/:id/resend-whatsapp', auth(['ADMIN', 'STAFF', 'CLIENT']), async (req, res) => {
  try {
    const ticketId = Number(req.params.id);
    const { toPhone } = req.body;

    if (!ticketId) return res.status(400).json({ error: 'INVALID_TICKET_ID' });

    // 1. Obtener la orden asociada al ticket
    const { rows } = await db.query(
      `SELECT t.order_id, t.owner_user_id, tt.event_id, o.buyer_phone
       FROM tickets t
       JOIN ticket_types tt ON tt.id = t.ticket_type_id
       JOIN orders o ON o.id = t.order_id
       WHERE t.id = $1 LIMIT 1`,
      [ticketId]
    );

    if (!rows.length) return res.status(404).json({ error: 'TICKET_NOT_FOUND' });
    const ticketInfo = rows[0];

    // 🔒 Permisos CLIENT
    if (req.user.role === 'CLIENT' && Number(ticketInfo.owner_user_id) !== Number(req.user.id)) {
      return res.status(403).json({ error: 'FORBIDDEN' });
    }

    // 🔒 Permisos STAFF
    if (req.user.role === 'STAFF') {
      const assignedEventIds = await getStaffAssignedEventIds(req.user.id);
      if (!assignedEventIds.includes(Number(ticketInfo.event_id))) {
        return res.status(403).json({ error: 'FORBIDDEN' });
      }
    }

    const recipientPhone = String(toPhone || ticketInfo.buyer_phone || '').trim();
    if (!recipientPhone) {
      return res.status(400).json({ error: 'MISSING_PHONE', message: 'Se requiere un número de teléfono para enviar por WhatsApp' });
    }

    const { sendTicketsWhatsAppForOrder } = require('../services/whatsappService');
    const result = await sendTicketsWhatsAppForOrder(ticketInfo.order_id, recipientPhone);

    return res.json({ success: true, result });
  } catch (e) {
    console.error('POST /api/tickets/:id/resend-whatsapp error:', e);
    return res.status(500).json({ error: 'SERVER_ERROR', message: e.message });
  }
});

router.post('/bulk-resend-email', auth(['ADMIN', 'STAFF', 'CLIENT']), async (req, res) => {
  try {
    const { ticketIds, toEmail } = req.body;
    const emailStr = String(toEmail).trim();

    if (!Array.isArray(ticketIds) || ticketIds.length === 0) {
      return res.status(400).json({ error: 'INVALID_TICKET_IDS' });
    }
    if (!emailStr || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailStr)) {
      return res.status(400).json({ error: 'INVALID_EMAIL' });
    }

    // 🔒 Validación para CLIENT
    if (req.user.role === 'CLIENT') {
      const { rows } = await db.query(
        `SELECT id FROM tickets WHERE id = ANY($1) AND owner_user_id = $2`,
        [ticketIds.map(Number), req.user.id]
      );
      if (rows.length !== ticketIds.length) {
        return res.status(403).json({ error: 'FORBIDDEN_SOME_TICKETS_NOT_OWNED' });
      }
    }

    // 🔒 Validación para STAFF
    if (req.user.role === 'STAFF') {
      const assignedEventIds = await getStaffAssignedEventIds(req.user.id);
      const { rows } = await db.query(
        `SELECT DISTINCT tt.event_id
         FROM tickets t
         JOIN ticket_types tt ON tt.id = t.ticket_type_id
         WHERE t.id = ANY($1)`,
        [ticketIds.map(Number)]
      );
      const hasUnassignedEvent = rows.some(r => !assignedEventIds.includes(Number(r.event_id)));
      if (hasUnassignedEvent) {
        return res.status(403).json({ error: 'FORBIDDEN_UNASSIGNED_EVENT' });
      }
    }

    const r = await sendMultipleTicketsEmail({
      ticketIds: ticketIds.map(Number),
      toEmail: emailStr
    });

    if (r?.error) return res.status(400).json(r);

    return res.json({ success: true, count: ticketIds.length });
  } catch (e) {
    console.error('Error en bulk-resend:', e);
    return res.status(500).json({ error: 'SERVER_ERROR' });
  }
});

module.exports = router;
