const express = require('express');
const router = express.Router();
const db = require('../db');
const auth = require('../middleware/auth');
const { signTicketPayload } = require('../services/cryptoService');
const { v4: uuidv4 } = require('uuid');
const axios = require('axios');

// Importamos el servicio de email para el reenvío
const { sendTicketsEmailForOrder } = require('../services/emailService');

// POST /api/orders
// Crea una orden "PAID" y genera tickets asociados
// Body: { customer: { name, email, phone }, items: [ { ticketTypeId, quantity } ] }
router.post('/', auth(['ADMIN','STAFF','CLIENT']), async (req, res) => {
  const userId = req.user.id;
  const { customer, items } = req.body;
  const createdBy = req.user.id;
  const ownerUserId = req.user.id;
  // Validar datos básicos del cliente
  if (!customer || !customer.name || !customer.email || !customer.cc) {
    return res.status(400).json({ error: 'Faltan datos del cliente (name, email, cc)' });
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
    let totalCents = 0
    let totalPesos = 0

    items.forEach(item => {
      const type = typeById[item.ticketTypeId];
      if (!type) throw new Error('TICKET_TYPE_NOT_FOUND');
      const qty = Number(item.quantity) || 0;
      if (qty <= 0) throw new Error('INVALID_QUANTITY');
      totalCents += type.price_cents * qty;
      totalPesos += type.price_pesos * qty;
    });

    // Crear orden (por ahora siempre PAID)
    const orderResult = await client.query(
      `INSERT INTO orders (user_id, created_by_user_id, status, total_cents, total_pesos)
      VALUES ($1,$2,'PAID',$3,$4) RETURNING *`,
      [ownerUserId, createdBy, totalCents, totalPesos]
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
            (order_id, ticket_type_id, unique_code, qr_payload, status,
            created_by_user_id, owner_user_id,
            holder_name, holder_email, holder_phone, holder_cc)
          VALUES ($1,$2,$3,$4,'ACTIVE',$5,$6,$7,$8,$9,$10)
          RETURNING *`,
          [
            order.id, type.id, tid, qrPayload,
            createdBy, ownerUserId,
            customer.name, customer.email, customer.phone || null, customer.cc || null
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

router.post('/checkout', auth(['CLIENT']), async (req, res) => {
  const userId = req.user.id
  const { customer, items } = req.body

  const client = await db.getClient()
  try {
    await client.query('BEGIN')

    // 1) calcular total
    const typeIds = items.map(i => i.ticketTypeId)
    const { rows: types } = await client.query(
      `SELECT * FROM ticket_types WHERE id = ANY($1::int[])`,
      [typeIds]
    )

    let totalCents = 0
    items.forEach(i => {
      const t = types.find(x => x.id === i.ticketTypeId)
      totalCents += t.price_cents * i.quantity
    })

    // 2) crear orden PENDING
    const orderRes = await client.query(
      `INSERT INTO orders
        (user_id, created_by_user_id, status, total_cents, payment_provider)
       VALUES ($1,$2,'PENDING',$3,'WOMPI')
       RETURNING *`,
      [userId, userId, totalCents]
    )

    const order = orderRes.rows[0]

    // 3) crear checkout en Wompi
    const wompiRes = await axios.post(
      'https://production.wompi.co/v1/transactions',
      {
        amount_in_cents: totalCents,
        currency: 'COP',
        customer_email: customer.email,
        reference: `ORDER-${order.id}`,
        redirect_url: `${process.env.FRONTEND_URL}/payment-result`
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.WOMPI_PUBLIC_KEY}`
        }
      }
    )

    const paymentRef = wompiRes.data.data.reference

    await client.query(
      `UPDATE orders SET payment_ref = $1 WHERE id = $2`,
      [paymentRef, order.id]
    )

    await client.query('COMMIT')

    res.json({
      checkoutUrl: wompiRes.data.data.payment_method?.url,
      orderId: order.id
    })

  } catch (err) {
    await client.query('ROLLBACK')
    console.error(err)
    res.status(500).json({ error: 'CHECKOUT_FAILED' })
  } finally {
    client.release()
  }
})

// GET /api/orders/by-reference/tickets?ref=...
router.get('/by-reference/tickets', async (req, res) => {
  const ref = (req.query.ref || '').trim()
  if (!ref) return res.status(400).json({ error: 'MISSING_REF' })

  try {
    // 1) Buscar orden por reference
    const { rows: orderRows } = await db.query(
      `SELECT id, user_id, status, payment_status, payment_reference
       FROM orders
       WHERE payment_reference = $1
       LIMIT 1`,
      [ref]
    )
    if (!orderRows.length) return res.status(404).json({ error: 'NOT_FOUND' })

    const order = orderRows[0]

    if (req.user && req.user.role === 'CLIENT' && Number(order.user_id) !== Number(req.user.id)) {
      return res.status(403).json({ error: 'FORBIDDEN' })
    }

    // 2) Si aún no está pagada, no devolvemos tickets
    if (order.status !== 'PAID') {
      return res.status(202).json({ status: order.status, payment_status: order.payment_status })
    }

    // 3) Traer tickets de ESA orden
    const { rows: tickets } = await db.query(
      `SELECT id, ticket_type_id, unique_code, qr_payload, status, created_at
       FROM tickets
       WHERE order_id = $1
       ORDER BY created_at ASC`,
      [order.id]
    )

    return res.json({ order, tickets })
  } catch (e) {
    console.error(e)
    return res.status(500).json({ error: 'SERVER_ERROR' })
  }
})

router.get('/by-reference', async (req, res) => {
  const ref = (req.query.ref || '').trim()
  if (!ref) return res.status(400).json({ error: 'MISSING_REF' })

  try {
    const { rows } = await db.query(
      `SELECT id, user_id, status, payment_status, payment_reference, total_cents, total_pesos, created_at
       FROM orders
       WHERE payment_reference = $1
       LIMIT 1`,
      [ref]
    )
    if (!rows.length) return res.status(404).json({ error: 'NOT_FOUND' })

    const order = rows[0]
    return res.json(order)
  } catch (e) {
    console.error(e)
    return res.status(500).json({ error: 'SERVER_ERROR' })
  }
})

// --- 🆕 NUEVOS SERVICIOS PARA PREVIEW Y REENVÍO ---

// GET /api/orders/:id/preview-email
// Permite ver el diseño del correo en el navegador
router.get('/:id/preview-email', async (req, res) => {
  try {
    const orderId = req.params.id;
    // Buscamos datos para la vista previa básica
    const { rows: tickets } = await db.query(
      `SELECT t.id, t.unique_code, e.name AS event_name
       FROM tickets t
       JOIN ticket_types tt ON tt.id = t.ticket_type_id
       JOIN events e ON e.id = tt.event_id
       WHERE t.order_id = $1`, [orderId]
    );

    if (!tickets.length) return res.status(404).send("Orden no encontrada o sin tickets.");

    res.send(`
      <div style="font-family:sans-serif; padding:20px; text-align:center;">
        <h2>Vista Previa de Correo (Orden #${orderId})</h2>
        <p>Evento: ${tickets[0].event_name}</p>
        <p>Tickets a generar: ${tickets.length}</p>
        <div style="border:2px dashed #ccc; padding:20px; margin-top:20px;">
          Se generarán las tarjetas con QR y se enviarán por Resend.
        </div>
      </div>
    `);
  } catch (err) {
    res.status(500).send(err.message);
  }
});

// POST /api/orders/:id/resend-email
// Fuerza el reenvío del correo de tickets
router.post('/:id/resend-email', async (req, res) => {
  try {
    const orderId = req.params.id;
    
    // Forzamos el estado a PENDING para que la función de email lo procese
    await db.query(
      `UPDATE orders SET email_status = 'PENDING', email_sent_at = NULL WHERE id = $1`,
      [orderId]
    );

    const result = await sendTicketsEmailForOrder(orderId);
    res.json({ success: true, result });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'No se pudo reenviar el correo' });
  }
});

module.exports = router;