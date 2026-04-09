const express = require('express')
const router = express.Router()
const crypto = require('crypto')
const db = require('../db')
const auth = require('../middleware/auth')
const cryptoService = require('../services/cryptoService')

// Firma de integridad para Wompi Checkout
function integritySig({ reference, amountInCents, currency, secret }) {
  const raw = `${reference}${amountInCents}${currency}${secret}`
  return crypto.createHash('sha256').update(raw).digest('hex')
}

async function getEventWompiConfig(eventId) {
  const { rows } = await db.query(
    `
    SELECT
      event_id,
      environment,
      wompi_public_key,
      wompi_integrity_secret_enc,
      wompi_integrity_secret_iv,
      wompi_private_key_enc,
      wompi_private_key_iv,
      wompi_events_secret_enc,
      wompi_events_secret_iv,
      is_active,
      enable_wompi
    FROM event_payment_config
    WHERE event_id = $1
    LIMIT 1
    `,
    [eventId]
  )

  if (!rows.length) return null

  const row = rows[0]

  return {
    event_id: row.event_id,
    environment: row.environment,
    wompi_public_key: row.wompi_public_key,
    wompi_integrity_secret:
      row.wompi_integrity_secret_enc && row.wompi_integrity_secret_iv
        ? cryptoService.decrypt(
            row.wompi_integrity_secret_enc,
            row.wompi_integrity_secret_iv
          )
        : null,
    wompi_private_key:
      row.wompi_private_key_enc && row.wompi_private_key_iv
        ? cryptoService.decrypt(
            row.wompi_private_key_enc,
            row.wompi_private_key_iv
          )
        : null,
    wompi_events_secret:
      row.wompi_events_secret_enc && row.wompi_events_secret_iv
        ? cryptoService.decrypt(
            row.wompi_events_secret_enc,
            row.wompi_events_secret_iv
          )
        : null,
    is_active: !!row.is_active,
    enable_wompi: !!row.enable_wompi
  }
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
      `
      SELECT
        id,
        price_cents,
        price_pesos,
        event_id,
        status,
        sales_start_at,
        sales_end_at,
        stock_total
      FROM ticket_types
      WHERE id = ANY($1::int[])
      `,
      [typeIds]
    )

    if (typeRows.length !== typeIds.length) {
      throw new Error('TICKET_TYPE_NOT_FOUND')
    }

    const typeById = Object.fromEntries(typeRows.map(t => [Number(t.id), t]))

    // Asegurar que todos los tickets sean del mismo evento
    const eventIds = [...new Set(typeRows.map(t => Number(t.event_id)))]
    if (eventIds.length !== 1) {
      throw new Error('MULTI_EVENT_CHECKOUT_NOT_ALLOWED')
    }

    const eventId = eventIds[0]

    let totalCents = 0
    let totalPesos = 0

    for (const it of items) {
      const qty = Number(it.quantity) || 0
      if (qty <= 0) throw new Error('INVALID_QUANTITY')

      const type = typeById[Number(it.ticketTypeId)]
      if (!type) throw new Error('TICKET_TYPE_NOT_FOUND')

      // Validación básica de disponibilidad/estado sin romper tu flujo actual
      const now = new Date()

      if (type.status === 'HIDDEN') {
        throw new Error(`TICKET_TYPE_HIDDEN_${type.id}`)
      }

      if (type.sales_start_at && now < new Date(type.sales_start_at)) {
        throw new Error(`TICKET_TYPE_NOT_STARTED_${type.id}`)
      }

      if (type.sales_end_at && now > new Date(type.sales_end_at)) {
        throw new Error(`TICKET_TYPE_EXPIRED_${type.id}`)
      }

      totalCents += Number(type.price_cents) * qty
      totalPesos += Number(type.price_pesos || 0) * qty
    }

    const reference = `CT-${Date.now()}-${String(userId).padStart(4, '0')}`
    const currency = 'COP'

    // Crear orden PENDING
    const { rows: orderRows } = await client.query(
      `
      INSERT INTO orders
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
      )   VALUES (
        $1, 'PENDING',
        $2, $3, $1,
        'WOMPI', now(), $4, 'PENDING',
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

    const order = orderRows[0]

    // Guardar items
    for (const it of items) {
      await client.query(
        `
        INSERT INTO order_items (order_id, ticket_type_id, quantity)
        VALUES ($1,$2,$3)
        `,
        [order.id, Number(it.ticketTypeId), Number(it.quantity)]
      )
    }

    await client.query('COMMIT')

    // 1) intenta usar config por evento
    const eventConfig = await getEventWompiConfig(eventId)

    // 2) fallback a env para no romper nada
    const publicKey =
      eventConfig?.is_active && eventConfig?.enable_wompi && eventConfig?.wompi_public_key
        ? eventConfig.wompi_public_key
        : process.env.WOMPI_PUBLIC_KEY

    const secret =
      eventConfig?.is_active && eventConfig?.enable_wompi && eventConfig?.wompi_integrity_secret
        ? eventConfig.wompi_integrity_secret
        : process.env.WOMPI_INTEGRITY_SECRET

    const redirectUrl = process.env.WOMPI_REDIRECT_URL

    if (!publicKey || !secret || !redirectUrl) {
      return res.status(500).json({ error: 'WOMPI_CONFIG_MISSING' })
    }

    const signature = integritySig({
      reference,
      amountInCents: totalCents,
      currency,
      secret
    })

    return res.json({
      orderId: order.id,
      eventId,
      checkout: {
        publicKey,
        currency,
        amountInCents: totalCents,
        reference,
        signature,
        redirectUrl,
        source: eventConfig?.is_active && eventConfig?.enable_wompi ? 'EVENT_CONFIG' : 'ENV'
      }
    })
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {})
    console.error(e)
    return res.status(500).json({ error: e.message || 'SERVER_ERROR' })
  } finally {
    client.release()
  }
})

module.exports = router
/*

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
      )   VALUES (
        $1, 'PENDING',
        $2, $3, $1,
        'WOMPI', now(), $4, 'PENDING',
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

*/