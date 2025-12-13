const express = require('express');
const router = express.Router();
const db = require('../db');
const auth = require('../middleware/auth');
const { signTicketPayload } = require('../services/cryptoService');
const { v4: uuidv4 } = require('uuid');

// POST /api/orders
// Crea una orden "PAID" y genera tickets asociados
// Body: { items: [ { ticketTypeId, quantity } ] }
// POST /api/orders
// Crea una orden "PAID" y genera tickets asociados
// Body: { customer: { name, email, phone }, items: [ { ticketTypeId, quantity } ] }
router.post('/', auth(['ADMIN','STAFF','CLIENT']), async (req, res) => {
  const userId = req.user.id;
  const { customer, items } = req.body;

  // Validar datos básicos del cliente
  if (!customer || !customer.name || !customer.email) {
    return res.status(400).json({ error: 'Faltan datos del cliente (name, email)' });
  }

  const client = await db.getClient();
  try {
    await client.query('BEGIN');

    const typeIds = items.map(i => i.ticketTypeId);
    const { rows: typeRows } = await client.query(
      `SELECT * FROM ticket_types WHERE id = ANY($1::int[])`,
      [typeIds]
    );

    if (typeRows.length !== typeIds.length) {
      throw new Error('TICKET_TYPE_NOT_FOUND');
    }

    const typeById = {};
    typeRows.forEach(t => {
      typeById[t.id] = t;
    });

    // Calcular total
    let totalCents = 0;
    items.forEach(item => {
      const type = typeById[item.ticketTypeId];
      if (!type) throw new Error('TICKET_TYPE_NOT_FOUND');
      const qty = Number(item.quantity) || 0;
      if (qty <= 0) throw new Error('INVALID_QUANTITY');
      totalCents += type.price_cents * qty;
    });

    // Crear orden (por ahora siempre PAID)
    const orderResult = await client.query(
      `INSERT INTO orders (user_id, status, total_cents)
       VALUES ($1,'PAID',$2) RETURNING *`,
      [userId, totalCents]
    );
    const order = orderResult.rows[0];

    const createdTickets = [];

    // Generar tickets
    for (const item of items) {
      const type = typeById[item.ticketTypeId];
      const qty = Number(item.quantity);

      for (let i = 0; i < qty; i++) {
        const tid = uuidv4();          // identificador único del ticket
        const exp = null;              // si quieres, aquí puedes poner timestamp de expiración
        const sig = signTicketPayload({
          tid,
          eid: type.event_id,
          exp
        });

        // Payload que irá dentro del QR (y que también puede ir en NFC)
        const payloadObj = {
          t: 'TICKET',
          tid,                         // usamos la variable tid
          eid: type.event_id,          // id del evento
          exp,                         // expiración (null si no se usa)
          // 👤 datos básicos del titular
          hn: customer.name,           // holder name
          he: customer.email,          // holder email
          hp: customer.phone || null,  // holder phone
          sig                           // firma del payload
        };

        const qrPayload = JSON.stringify(payloadObj);

        
        const ticketResult = await client.query(
          `INSERT INTO tickets
            (order_id,
            ticket_type_id,
            unique_code,
            qr_payload,
            status,
            holder_name,
            holder_email,
            holder_phone)
          VALUES ($1,$2,$3,$4,'ACTIVE',$5,$6,$7)
          RETURNING *`,
          [
            order.id,
            type.id,
            tid,
            qrPayload,
            customer.name,
            customer.email,
            customer.phone || null
          ]
        );

        createdTickets.push(ticketResult.rows[0]);
      }
    }

    await client.query('COMMIT');

    res.status(201).json({
      order,
      tickets: createdTickets
    });
  } catch (err) {
    console.error(err);
    await client.query('ROLLBACK').catch(() => {});
    if (err.message === 'TICKET_TYPE_NOT_FOUND') {
      return res.status(400).json({ error: 'TICKET_TYPE_NOT_FOUND' });
    }
    if (err.message === 'INVALID_QUANTITY') {
      return res.status(400).json({ error: 'INVALID_QUANTITY' });
    }
    res.status(500).json({ error: 'SERVER_ERROR' });
  } finally {
    client.release();
  }
});

// GET /api/orders (simple listado del usuario autenticado)
router.get('/', auth(['ADMIN','STAFF','CLIENT']), async (req, res) => {
  const userId = req.user.id;

  try {
    const { rows } = await db.query(
      `SELECT * FROM orders WHERE user_id = $1 ORDER BY created_at DESC`,
      [userId]
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'SERVER_ERROR' });
  }
});

module.exports = router;
