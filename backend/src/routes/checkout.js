const express = require('express')
const router = express.Router()
const crypto = require('crypto')
const db = require('../db')
const auth = require('../middleware/auth')

// Firma de integridad para Wompi Checkout
function integritySig({ reference, amountInCents, currency, secret }) {
  const raw = `${reference}${amountInCents}${currency}${secret}`
  return crypto.createHash('sha256').update(raw).digest('hex')
}


// POST /api/checkout/start (CLIENT)
router.post('/start', auth(['CLIENT', 'ADMIN']), async (req, res) => {
  const userId = req.user.id
  const { items, customer } = req.body

  if (!customer?.name || !customer?.email) {
    return res.status(400).json({ error: 'Faltan datos del cliente (name,email)' })
  }
  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'Items requeridos' })
  }

  const client = await db.getClient()
  try {
    await client.query('BEGIN')

    const typeIds = items.map(i => Number(i.ticketTypeId))
    const { rows: typeRows } = await client.query(
      `SELECT id, price_cents, price_pesos, event_id FROM ticket_types WHERE id = ANY($1::int[])`,
      [typeIds]
    )
    if (typeRows.length !== typeIds.length) throw new Error('TICKET_TYPE_NOT_FOUND')

    const typeById = Object.fromEntries(typeRows.map(t => [t.id, t]))
    
    let totalCents = 0
    let totalPesos = 0

    for (const it of items) {
      const qty = Number(it.quantity) || 0
      if (qty <= 0) throw new Error('INVALID_QUANTITY')

      const type = typeById[Number(it.ticketTypeId)]
      if (!type) throw new Error('TICKET_TYPE_NOT_FOUND')

      totalCents += Number(type.price_cents) * qty
      totalPesos += Number(type.price_pesos) * qty
    }

    const reference = `CT-${Date.now()}-${String(userId).padStart(4, '0')}`
    const currency = 'COP'

    // Crear orden PENDING
    const { rows: orderRows } = await client.query(
      `INSERT INTO orders
      (
        user_id,
        status,
        total_cents,
        total_pesos,
        payment_provider,
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
        $1, 'PENDING',
        $2, $3,
        'WOMPI', $4, 'PENDING',
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
    )

    const order = orderRows[0]

    // Guardar items
    for (const it of items) {
      await client.query(
        `INSERT INTO order_items (order_id, ticket_type_id, quantity)
         VALUES ($1,$2,$3)`,
        [order.id, Number(it.ticketTypeId), Number(it.quantity)]
      )
    }

    await client.query('COMMIT')

    const publicKey = process.env.WOMPI_PUBLIC_KEY
    const secret = process.env.WOMPI_INTEGRITY_SECRET
    const redirectUrl = process.env.WOMPI_REDIRECT_URL

    if (!publicKey || !secret || !redirectUrl) {
      return res.status(500).json({ error: 'WOMPI_ENV_MISSING' })
    }

    const signature = integritySig({
      reference,
      amountInCents: totalCents,
      currency,
      secret
    })

    return res.json({
      orderId: order.id,
      checkout: { publicKey, currency, amountInCents: totalCents, reference, signature, redirectUrl }
    })
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {})
    console.error(e)
    return res.status(500).json({ error: 'SERVER_ERROR' })
  } finally {
    client.release()
  }
})

module.exports = router
