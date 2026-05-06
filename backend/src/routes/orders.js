const express = require('express');
const router = express.Router();
const db = require('../db');
const auth = require('../middleware/auth');
const { signTicketPayload } = require('../services/cryptoService');
const { v4: uuidv4 } = require('uuid');
const axios = require('axios');
const { sendTicketsEmailForOrder, sendAdminNotification, sendOrderCancelledEmail } = require('../services/emailService');
const multer = require('multer');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const nodeCrypto = require('crypto');



// ===== Transacciones robustas usando tu db.js =====
async function withTransaction(fn) {
  const client = await db.getClient();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    try { await client.query('ROLLBACK'); } catch (_) {}
    throw err;
  } finally {
    client.release();
  }
}

// ===== Multer (memory) para recibir imagen sin guardar en disco =====
const uploadReceipt = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 6 * 1024 * 1024 }, // 6MB
  fileFilter: (req, file, cb) => {
    const ok = ['image/png', 'image/jpeg', 'image/webp'].includes(file.mimetype);
    if (!ok) return cb(new Error('Solo PNG/JPG/WEBP'));
    cb(null, true);
  }
});

// ===== Cloudflare R2 (S3 compatible) =====
const r2 = new S3Client({
  region: 'auto',
  endpoint: process.env.R2_ENDPOINT, // ej: https://<accountid>.r2.cloudflarestorage.com
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY
  }
});

function slugifyFolderName(name) {
  return String(name || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'evento';
}

// Sube el comprobante a R2 y devuelve URL pública (o URL base + key)
async function uploadReceiptToR2({ client, orderId, file }) {
  const bucket = process.env.R2_BUCKET;
  const publicBase = process.env.R2_PUBLIC_BASE_URL;

  if (!bucket) throw new Error('R2_BUCKET missing');
  if (!publicBase) throw new Error('R2_PUBLIC_BASE_URL missing');

  // 1) Obtener evento(s) asociados a la orden
  const { rows } = await client.query(
    `SELECT DISTINCT e.id AS event_id, e.name AS event_name
       FROM order_items oi
       JOIN ticket_types tt ON tt.id = oi.ticket_type_id
       JOIN events e ON e.id = tt.event_id
      WHERE oi.order_id = $1`,
    [orderId]
  );

  if (rows.length === 0) throw new Error('ORDEN_SIN_EVENTO');

  // 2) Carpeta según cantidad de eventos
  let folder = 'multi_event';
  if (rows.length === 1) {
    const { event_id, event_name } = rows[0];
    folder = `${slugifyFolderName(event_name)}-${event_id}`;
  }

  // 3) Extensión segura
  const ext =
    file.mimetype === 'image/png' ? 'png' :
    file.mimetype === 'image/webp' ? 'webp' : 'jpg';

  // 4) Key final
  const random = nodeCrypto.randomBytes(4).toString('hex');
  const key = `${folder}/order_${orderId}_${Date.now()}_${random}.${ext}`;


  await r2.send(new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    Body: file.buffer,
    ContentType: file.mimetype
  }));

  return { key, url: `${publicBase}/${key}` };
}



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

        const reference = `CT-${Date.now()}-${String(userId).padStart(4, '0')}`


    // Crear orden (por ahora siempre PAID)
    const orderResult = await client.query(
      `INSERT INTO orders
      (
        user_id,
        status,
        total_cents,
        total_pesos,
        created_by_user_id,
        payment_provider,
        paid_at,
        payment_reference,
        payment_status,
        payment_amount_cents,
        payment_currency,
        buyer_name,
        buyer_email,
        buyer_phone,
        buyer_cc
      )
      VALUES
      (
        $1, 'PAID',
        $2, $3, $1,
        'MANUAL', now(), $4, 'APPROVED',
        $2, 'COP',
        $5, $6, $7, $8
      )
      RETURNING *`,
      [
        userId,
        totalCents,
        totalPesos,
        reference,
        customer.name,
        customer.email,
        customer.phone || null,
        customer.cc || null
      ]
    );
    const order = orderResult.rows[0];

// ✅ Guardar los items de la orden en order_items
    for (const item of items) {
      const qty = Number(item.quantity) || 0;

      await client.query(
        `INSERT INTO order_items (order_id, ticket_type_id, quantity)
         VALUES ($1, $2, $3)`,
        [order.id, item.ticketTypeId, qty]
      );
    }

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
        const allowedEntries = Number(type.entries_per_ticket || 1);

        const ticketResult = await client.query(
          `INSERT INTO tickets
            (
              order_id,
              ticket_type_id,
              unique_code,
              qr_payload,
              status,
              allowed_entries,
              used_entries,
              created_by_user_id,
              owner_user_id,
              holder_name,
              holder_email,
              holder_phone,
              holder_cc
            )
          VALUES ($1,$2,$3,$4,'ACTIVE',$5,0,$6,$7,$8,$9,$10,$11)
          RETURNING *`,
          [
            order.id,
            type.id,
            tid,
            qrPayload,
            allowedEntries,
            createdBy,
            ownerUserId,
            customer.name,
            customer.email,
            customer.phone || null,
            customer.cc || null
          ]
        );
        createdTickets.push(ticketResult.rows[0]);
      }
    }

    await client.query('COMMIT');

try {
      // No usamos 'await' aquí si quieres que la respuesta al cliente sea instantánea
      // Pero si prefieres asegurar que el proceso inicie antes de responder, déjalo con await
      await sendTicketsEmailForOrder(order.id); 
      console.log(`✅ Envío automático iniciado para orden: ${order.id}`);
    } catch (mailErr) {
      // Si falla el correo, no detenemos la respuesta 201, 
      // porque la compra ya se guardó correctamente.
      console.error(`⚠️ Error en envío automático (Orden ${order.id}):`, mailErr.message);
    }
    // ----------------------------------

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
       VALUES ($1,$2,'PENDING22',$3,'WOMPI')
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

// POST /api/orders/:id/resend-email
// Fuerza el reenvío del correo de tickets
/*
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
*/
router.post('/:id/resend-email', async (req, res) => {
  try {
    const orderId = req.params.id;
    const { toEmail } = req.body; // <--- CAPTURAMOS EL CORREO DEL FRONTEND

    // Forzamos el estado a PENDING
    await db.query(
      `UPDATE orders SET email_status = 'PENDING', email_sent_at = NULL WHERE id = $1`,
      [orderId]
    );

    // Pasamos el orderId Y el toEmail (si existe)
    const result = await sendTicketsEmailForOrder(orderId, toEmail); 
    
    res.json({ success: true, result });
  } catch (err) {
    console.error("Error en resend-email order:", err);
    res.status(500).json({ error: 'No se pudo reenviar el correo' });
  }
});

router.post('/manual-reserve', auth(['CLIENT','STAFF','ADMIN']), async (req, res) => {
  const { buyer_name, buyer_email, buyer_phone, buyer_cc, items } = req.body;

  //console.log('Received manual-reserve request body:', req.body);

  const userId = req.user.id;
  // items: [{ ticket_type_id: 1, quantity: 2 }, ...]

  if (!buyer_phone || !buyer_cc || !buyer_email || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'buyer_phone, buyer_cc, buyer_email e items son requeridos' });
  }

  try {
    const order = await withTransaction(async (client) => {
      const ids = items.map(i => Number(i.ticket_type_id));

      // Asumo ticket_types tiene price_cents (o algo similar).
      // AJUSTA nombres de columnas si en tu DB son distintos.
      const { rows: types } = await client.query(
        `SELECT id, price_cents
           FROM ticket_types
          WHERE id = ANY($1::int[])`,
        [ids]
      );

      if (types.length !== ids.length) throw new Error('ticket_type_id inválido');

      const priceMap = new Map(types.map(t => [t.id, Number(t.price_cents)]));

      const total_cents = items.reduce((acc, it) => {
        const unit = priceMap.get(Number(it.ticket_type_id));
        return acc + unit * Number(it.quantity);
      }, 0);

      const total_pesos = Math.round(total_cents / 100); // si manejas centavos; si no, cambia esto.

      const { rows: [newOrder] } = await client.query(
        `INSERT INTO orders (status, user_id, created_by_user_id, payment_provider, buyer_name
        , buyer_email, buyer_phone, buyer_cc, payment_amount_cents,total_cents, total_pesos, payment_currency)
         VALUES ('WAITING_PAYMENT', $1, $2, 'COMPROBANTE', $3, $4, $5, $6, $7, $8, $9, 'COP')
         RETURNING id, status, total_cents, total_pesos, created_at`,
        [userId, userId, buyer_name || null, buyer_email, buyer_phone || null, buyer_cc || null, total_cents, total_cents, total_pesos]
      );

      for (const it of items) {
        await client.query(
          `INSERT INTO order_items (order_id, ticket_type_id, quantity)
           VALUES ($1, $2, $3)`,
          [newOrder.id, Number(it.ticket_type_id), Number(it.quantity)]
        );
      }

      return newOrder;
    });

    return res.status(201).json({ ok: true, order });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

//router.patch('/upload-receipt/:id', uploadReceipt.single('receipt'), 
//  async (req,res)=>{
router.patch('/upload-receipt/:id',auth(['CLIENT','STAFF','ADMIN']),uploadReceipt.single('receipt'),
  async (req, res) => {
    const orderId = Number(req.params.id);

//    console.log('✅ HIT upload-receipt route', req.params.id);

    if (!req.file) return res.status(400).json({ error: 'Falta archivo receipt' });

    try {
      const result = await withTransaction(async (client) => {
        const { rows: [order] } = await client.query(
          `SELECT id, status FROM orders WHERE id = $1 FOR UPDATE`,
          [orderId]
        );
        if (!order) throw new Error('ORDEN_NO_ENCONTRADA');

        // No permitir re-subida una vez ya pasó a revisión o pagado/cancelado
        if (order.status !== 'WAITING_PAYMENT') {
          const err = new Error('COMPROBANTE_YA_ENVIADO');
          err.httpStatus = 400;
          throw err;
        }

        if (!['WAITING_PAYMENT','PENDING_APPROVAL'].includes(order.status)) {
          throw new Error(`No se puede subir comprobante en status=${order.status}`);
        }

        // ✅ AQUÍ sí existe "client"
        const { url: receiptUrl } = await uploadReceiptToR2({ client, orderId, file: req.file });
        //const receiptUrl = 'https://proof.cloud-tickets.com/test.jpg';


        const { rows: [saved] } = await client.query(
          `UPDATE orders
              SET payment_receipt_url = $1,
                  status = 'PENDING_APPROVAL'
            WHERE id = $2
            RETURNING id, status, payment_receipt_url`,
          [receiptUrl, orderId]
        );

        const { rows: admins } = await client.query(
          `SELECT DISTINCT epc.email_adm
             FROM order_items oi
             JOIN ticket_types tt ON tt.id = oi.ticket_type_id
             JOIN events e ON e.id = tt.event_id
             JOIN event_payment_config epc ON epc.event_id = e.id
            WHERE oi.order_id = $1
              AND epc.email_adm IS NOT NULL
              AND epc.email_adm <> ''`,
          [orderId]
        );

        return { saved, adminEmails: admins.map(r => r.email_adm), receiptUrl };
      });

      // email admin fuera de tx
      try {
        await sendAdminNotification({
          adminEmails: result.adminEmails,orderId,
          receiptUrl: result.receiptUrl
        });

} catch (err) {
  console.error('UPLOAD_RECEIPT_ERROR:', {
    message: err.message,
    name: err.name,
    code: err.code,
    statusCode: err.$metadata?.httpStatusCode,
    stack: err.stack
  });
  return res.status(500).json({
    error: err.message,
    name: err.name,
    code: err.code,
    statusCode: err.$metadata?.httpStatusCode
  });
}

//      } catch (e) {
  //      console.error('sendAdminNotification failed:', e.message);
    //  }

      return res.json({ ok: true, order: result.saved });

    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }
);

router.get('/:eventId/pending', auth(['ADMIN','STAFF']), async (req,res)=>{

  const { eventId } = req.params

  const result = await db.query(`
  
    SELECT
      o.id,
      o.status,
      o.buyer_name,
      o.buyer_email,
      o.buyer_phone,
      o.payment_receipt_url,
      o.created_at

    FROM orders o
    JOIN order_items oi ON oi.order_id = o.id
    JOIN ticket_types tt ON tt.id = oi.ticket_type_id

    WHERE
      tt.event_id = $1
      AND o.status = 'PENDING_APPROVAL'

    GROUP BY o.id

    ORDER BY o.created_at DESC

  `,[eventId])

  res.json(result.rows)

})

router.get('/:eventId', auth(['ADMIN','STAFF']), async (req,res)=>{

  const { eventId } = req.params

  const result = await db.query(`
  
    SELECT
      o.id,
      o.status,
      o.buyer_name,
      o.buyer_email,
      o.buyer_phone,
      o.payment_receipt_url,
      o.created_at

    FROM orders o
    JOIN order_items oi ON oi.order_id = o.id
    JOIN ticket_types tt ON tt.id = oi.ticket_type_id

    WHERE
      tt.event_id = $1

    GROUP BY o.id

    ORDER BY o.created_at DESC

  `,[eventId])

  res.json(result.rows)

})

router.post('/approve-order/:id', auth(['ADMIN' , 'STAFF']), async (req, res) => {
  const orderId = Number(req.params.id);
  
  console.log('Received manual-reserve request body:', req.params);

  try {
    const tx = await withTransaction(async (client) => {
      const { rows: [order] } = await client.query(
        `SELECT id, status, user_id, created_by_user_id, 
                buyer_name, buyer_email, buyer_phone, buyer_cc
           FROM orders
          WHERE id = $1
          FOR UPDATE`,
        [orderId]
      );
      if (!order) throw new Error('ORDEN_NO_ENCONTRADA');

      if (order.status === 'PAID') {
        return { orderId, alreadyPaid: true };
      }

      if (order.status !== 'PENDING_APPROVAL') {
        throw new Error(`No se puede aprobar en status=${order.status}`);
      }

 //     console.log ('User ID from order:', userId);
//console.log(order);
      // Evitar duplicados
      const { rows: [tc] } = await client.query(
        `SELECT COUNT(*)::int AS c FROM tickets WHERE order_id = $1`,
        [orderId]
      );
      //const userId = order.user_id;
      

      const reference = `CT-${Date.now()}-${String(order.user_id).padStart(4, '0')}`

   //   console.log('Received manual-reserve request body:', order);

      await client.query(
        `UPDATE orders SET status = 'PAID', paid_at = NOW(), payment_reference = $2, payment_status='APPROVED' WHERE id = $1`,
        [orderId, reference]
      );
// ✅ Traer items de la orden (order_items)
const { rows: items } = await client.query(
  `SELECT ticket_type_id, quantity
     FROM order_items
    WHERE order_id = $1`,
  [orderId]
);

if (!items.length) throw new Error('ORDEN_SIN_ITEMS');
      // Traemos event_id por cada ticket_type para poder crear el payload QR
const typeIds = items.map(i => Number(i.ticket_type_id));
const { rows: typeRows } = await client.query(
  `SELECT id AS ticket_type_id, event_id, entries_per_ticket
     FROM ticket_types
    WHERE id = ANY($1::int[])`,
  [typeIds]
);

const eventMap = new Map(typeRows.map(r => [Number(r.ticket_type_id), Number(r.event_id)]));
const entriesMap = new Map(typeRows.map(r => [Number(r.ticket_type_id), Number(r.entries_per_ticket || 1)]));

// Datos del holder desde la orden (o lo que uses)
const holder_name  = order.buyer_name || 'Cliente';
const holder_email = order.buyer_email || null;
const holder_phone = order.buyer_phone || null;
const holder_cc    = order.buyer_cc || null;

// status del ticket (ajusta si tu enum es otro)
const ticket_status = 'ACTIVE';

// created_by_user_id y owner_user_id como ya lo dejaste
const adminUserId = req.user?.id || null;
const created_by_user_id = adminUserId || order.created_by_user_id || null;
const owner_user_id = order.user_id || null;

for (const it of items) {
  const ticketTypeId = Number(it.ticket_type_id);
  const eid = eventMap.get(ticketTypeId);
  const allowedEntries = entriesMap.get(ticketTypeId) || 1;
  
  if (!eid) throw new Error(`EVENT_ID_NO_ENCONTRADO_PARA_TICKET_TYPE ${ticketTypeId}`);

  const qty = Number(it.quantity);

  for (let i = 0; i < qty; i++) {
    const tid = uuidv4();   // ✅ este será el identificador único del ticket
    const exp = null;

    // ✅ firma según tu estándar
    const sig = signTicketPayload({ tid, eid, exp });

    const payloadObj = {
      t: 'TICKET',
      tid,
      eid,
      exp,
      hn: holder_name,
      he: holder_email,
      hp: holder_phone || null,
      sig
    };

    const qr_payload = JSON.stringify(payloadObj);

    // ✅ Recomendación: usa tid también como unique_code
    const unique_code = tid;

    await client.query(
      `INSERT INTO tickets (
        order_id,
        ticket_type_id,
        unique_code,
        qr_payload,
        status,
        allowed_entries,
        used_entries,
        created_by_user_id,
        owner_user_id,
        holder_name,
        holder_email,
        holder_phone,
        holder_cc
      ) VALUES ($1,$2,$3,$4,$5,$6,0,$7,$8,$9,$10,$11,$12)`,
      [
        orderId,
        ticketTypeId,
        unique_code,
        qr_payload,
        ticket_status,
        allowedEntries,
        created_by_user_id,
        owner_user_id,
        holder_name,
        holder_email,
        holder_phone,
        holder_cc
      ]
    );
  }
}

      return { orderId, alreadyPaid: false };
    });

    // Email fuera de la tx (tu función lee tickets y genera PDFs)
    if (!tx.alreadyPaid) {
      await sendTicketsEmailForOrder(orderId);
    }

    return res.json({ ok: true, ...tx, emailTriggered: !tx.alreadyPaid });

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

router.post('/cancel-order/:id', auth(['ADMIN', 'STAFF']), async (req, res) => {
  const orderId = Number(req.params.id);

  try {
    const tx = await withTransaction(async (client) => {
      const { rows: [order] } = await client.query(
        `SELECT id, status
           FROM orders
          WHERE id = $1
          FOR UPDATE`,
        [orderId]
      );

      if (!order) throw new Error('ORDEN_NO_ENCONTRADA');

      if (order.status === 'PAID') {
        throw new Error('NO_SE_PUEDE_CANCELAR_ORDEN_PAGADA');
      }

      if (order.status !== 'PENDING_APPROVAL') {
        throw new Error(`No se puede cancelar en status=${order.status}`);
      }

      await client.query(
        `UPDATE orders
            SET status = 'CANCELLED',
                payment_status = 'REJECTED'
          WHERE id = $1`,
        [orderId]
      );

      return { orderId, cancelled: true };
    });

    let emailTriggered = false;
    let emailError = null;

    if (tx.cancelled) {
      try {
        await sendOrderCancelledEmail(orderId);
        emailTriggered = true;
      } catch (e) {
        console.error('Error sending cancellation email:', e);
        emailError = e.message;
      }
    }

    return res.json({ ok: true, ...tx, emailTriggered, emailError });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

module.exports = router;