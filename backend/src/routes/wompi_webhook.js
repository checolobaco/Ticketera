const express = require('express')
const crypto = require('crypto')
const db = require('../db')
const { v4: uuidv4 } = require('uuid')
const { signTicketPayload } = require('../services/cryptoService')

const router = express.Router()

function sha256Hex(s) {
  return crypto.createHash('sha256').update(s).digest('hex')
}

function getByPath(obj, path) {
  return path.split('.').reduce((acc, key) => (acc && acc[key] !== undefined ? acc[key] : undefined), obj);
}

function computeWebhookChecksum({ body, secret }) {
  const props = body?.signature?.properties || []
  const tx = body?.data?.transaction
  const ts = body?.timestamp // <- OBLIGATORIO

  if (!tx || !Array.isArray(props) || props.length === 0) return null
  if (typeof ts !== 'number' && typeof ts !== 'string') return null

  const values = props.map((p) => {
    // p: "transaction.id", "transaction.status"...
    const key = p.replace('transaction.', '')
    const v = tx[key]
    return v == null ? '' : String(v)
  })

  const raw = values.join('') + String(ts) + secret
  return sha256Hex(raw)
}



router.post('/', async (req, res) => {
  try {
    // req.body llega como Buffer si lo montas con express.raw()
    const rawBody = req.body
    const body = Buffer.isBuffer(rawBody)
      ? JSON.parse(rawBody.toString('utf8'))
      : rawBody

    const tx = body?.data?.transaction
    const checksum = body?.signature?.checksum

    if (!tx || !checksum) return res.status(400).json({ error: 'INVALID_WEBHOOK_BODY' })

    // ✅ ESTE es el secreto correcto para webhooks (Events/Webhook Secret)
    const eventsSecret = process.env.WOMPI_EVENTS_SECRET
    if (!eventsSecret) return res.status(500).json({ error: 'WOMPI_EVENTS_SECRET_MISSING' })

    const expected = computeWebhookChecksum({ body, secret: eventsSecret })
    if (!expected) return res.status(400).json({ error: 'INVALID_SIGNATURE_DATA' })

    if (expected !== checksum) return res.status(401).json({ error: 'INVALID_SIGNATURE' })

    const reference = tx.reference
    if (!reference) return res.status(400).json({ error: 'MISSING_REFERENCE' })

    const client = await db.getClient()
    try {
      await client.query('BEGIN')

      // Lock de la orden (idempotencia)
      const { rows: orderRows } = await client.query(
        `SELECT * FROM orders WHERE payment_reference = $1 FOR UPDATE`,
        [reference]
      )

      if (!orderRows.length) {
        await client.query('ROLLBACK')
        return res.status(404).json({ error: 'ORDER_NOT_FOUND', reference })
      }

      const order = orderRows[0]

      // Guardar info de transacción siempre
      await client.query(
        `UPDATE orders
         SET payment_provider = 'WOMPI',
             payment_status = $2,
             wompi_transaction_id = $3,
             payment_amount_cents = $4,
             payment_currency = COALESCE($5, payment_currency)
         WHERE id = $1`,
        [order.id, tx.status, tx.id, tx.amount_in_cents, tx.currency]
      )

      // Si no está aprobada, terminamos
      if (tx.status !== 'APPROVED') {
        await client.query('COMMIT')
        return res.status(200).json({ ok: true, status: tx.status })
      }

      // Si ya está pagada, NO duplicar tickets
      if (order.status === 'PAID') {
        await client.query(
          `UPDATE orders SET paid_at = COALESCE(paid_at, NOW()) WHERE id = $1`,
          [order.id]
        )
        await client.query('COMMIT')
        return res.status(200).json({ ok: true, alreadyPaid: true })
      }

      // ✅ Marcar orden pagada
      await client.query(
        `UPDATE orders
         SET status='PAID',
             paid_at=NOW()
         WHERE id=$1`,
        [order.id]
      )

      // ✅ Leer items
      const { rows: items } = await client.query(
        `SELECT ticket_type_id, quantity FROM order_items WHERE order_id=$1`,
        [order.id]
      )

      // ✅ Generar tickets
      let created = 0

      for (const it of items) {
        const qty = Number(it.quantity || 0)
        if (qty <= 0) continue

        const { rows: typeRows } = await client.query(
          `SELECT id, event_id FROM ticket_types WHERE id=$1`,
          [it.ticket_type_id]
        )
        if (!typeRows.length) continue
        const type = typeRows[0]

        for (let i = 0; i < qty; i++) {
          const tid = uuidv4()
          const exp = null
          const sig = signTicketPayload({ tid, eid: type.event_id, exp })

          const payloadObj = { t: 'TICKET', tid, eid: type.event_id, exp, sig }
          const qrPayload = JSON.stringify(payloadObj)

          await client.query(
            `INSERT INTO tickets
              (order_id, ticket_type_id, unique_code, qr_payload, status,
               holder_name, holder_email, holder_phone, holder_cc,
               created_by_user_id, owner_user_id)
             VALUES ($1,$2,$3,$4,'ACTIVE',$5,$6,$7,$8,$9,$10)`,
            [
              order.id,
              type.id,
              tid,          // uuid ok
              qrPayload,
              order.buyer_name,
              order.buyer_email,
              order.buyer_phone,
              order.buyer_cc,
              order.created_by_user_id || order.user_id || null,
              order.user_id || null,
            ]
          )

          created += 1
        }
      }
      const { sendTicketsEmailForOrder } = require('../services/emailService')


      await client.query('COMMIT')

      sendTicketsEmailForOrder(order.id)
      .then(r => console.log('EMAIL_RESULT', r))
      .catch(e => console.error('EMAIL_ERROR', e))
        
      return res.status(200).json({ ok: true, createdTickets: created })
    } catch (e) {
      await client.query('ROLLBACK').catch(() => {})
      console.error('WEBHOOK_DB_ERROR', e)
      return res.status(500).json({ error: 'DB_ERROR' })
    } finally {
      client.release()
    }

  } catch (e) {
    console.error('WEBHOOK_FATAL_ERROR')
    console.error(e)
    console.error(e?.stack)
    return res.status(500).json({
      error: 'WEBHOOK_ERROR',
      message: e.message,
    })
  }
})

module.exports = router
