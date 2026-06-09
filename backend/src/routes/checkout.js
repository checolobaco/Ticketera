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

function normalizePromoCode(code) {
  return String(code || '').trim().toUpperCase()
}

async function resolvePromoDiscount({ client, eventId, promoCode, subtotalCents, lockRow = true }) {
  const normalizedCode = normalizePromoCode(promoCode)
  if (!normalizedCode) {
    return {
      normalizedCode: '',
      discountCents: 0,
      applied: false
    }
  }

  const lockClause = lockRow ? 'FOR UPDATE' : ''

  const { rows } = await client.query(
    `
    SELECT
      id,
      event_id,
      code,
      discount_type,
      discount_value,
      discount_cents,
      max_discount_cents,
      min_order_cents,
      starts_at,
      ends_at,
      max_uses,
      used_count,
      active
    FROM event_promo_codes
    WHERE event_id = $1
      AND UPPER(code) = $2
    ${lockClause}
    LIMIT 1
    `,
    [eventId, normalizedCode]
  )

  if (!rows.length) {
    throw new Error('PROMO_CODE_NOT_FOUND')
  }

  const promo = rows[0]
  const { rows: benefitRows } = await client.query(
    `
    SELECT COUNT(*)::int AS count
    FROM promo_code_benefits
    WHERE promo_code_id = $1
      AND active = true
    `,
    [promo.id]
  )

  if (!promo.active) throw new Error('PROMO_CODE_INACTIVE')

  const now = new Date()
  if (promo.starts_at && now < new Date(promo.starts_at)) {
    throw new Error('PROMO_CODE_NOT_STARTED')
  }
  if (promo.ends_at && now > new Date(promo.ends_at)) {
    throw new Error('PROMO_CODE_EXPIRED')
  }

  const minOrderCents = Number(promo.min_order_cents || 0)
  if (subtotalCents < minOrderCents) {
    throw new Error('PROMO_CODE_MIN_ORDER_NOT_MET')
  }

  const maxUses = promo.max_uses == null ? null : Number(promo.max_uses)
  const usedCount = Number(promo.used_count || 0)
  if (maxUses !== null && usedCount >= maxUses) {
    throw new Error('PROMO_CODE_EXHAUSTED')
  }

  const discountType = String(promo.discount_type || '').toUpperCase()
  let discountCents = 0

  if (discountType === 'PERCENT') {
    const pct = Number(promo.discount_value || 0)
    if (!Number.isFinite(pct) || pct <= 0 || pct > 100) {
      throw new Error('PROMO_CODE_INVALID_CONFIG')
    }
    discountCents = Math.floor((subtotalCents * pct) / 100)
  } else if (discountType === 'FIXED') {
    const fixedDiscountRaw =
      promo.discount_cents != null ? promo.discount_cents : promo.discount_value
    discountCents = Math.floor(Number(fixedDiscountRaw || 0))
  } else {
    throw new Error('PROMO_CODE_INVALID_CONFIG')
  }

  const maxDiscountCents =
    promo.max_discount_cents == null ? null : Number(promo.max_discount_cents)

  if (maxDiscountCents !== null && Number.isFinite(maxDiscountCents)) {
    discountCents = Math.min(discountCents, Math.floor(maxDiscountCents))
  }

  discountCents = Math.max(0, Math.min(subtotalCents, Math.floor(discountCents)))
  const activeBenefitCount = Number(benefitRows[0]?.count || 0)

  return {
    promoId: Number(promo.id),
    normalizedCode,
    discountCents,
    applied: discountCents > 0,
    reservesUsage: discountCents > 0 || activeBenefitCount > 0
  }
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

function computeSubtotalCents(typeRows, items) {
  const typeById = Object.fromEntries(typeRows.map(t => [Number(t.id), t]))
  let subtotalCents = 0

  for (const it of items) {
    const qty = Number(it.quantity) || 0
    if (qty <= 0) throw new Error('INVALID_QUANTITY')

    const type = typeById[Number(it.ticketTypeId)]
    if (!type) throw new Error('TICKET_TYPE_NOT_FOUND')

    subtotalCents += Number(type.price_cents) * qty
  }

  return { typeById, subtotalCents }
}

// POST /api/checkout/start (CLIENT)
router.post('/start', auth(['CLIENT', 'ADMIN']), async (req, res) => {
  const userId = req.user.id
  const { items, customer, promoCode } = req.body

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

    const { typeById, subtotalCents } = computeSubtotalCents(typeRows, items)

    // Asegurar que todos los tickets sean del mismo evento
    const eventIds = [...new Set(typeRows.map(t => Number(t.event_id)))]
    if (eventIds.length !== 1) {
      throw new Error('MULTI_EVENT_CHECKOUT_NOT_ALLOWED')
    }

    const eventId = eventIds[0]

    for (const it of items) {
      const type = typeById[Number(it.ticketTypeId)]

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
    }

    const promo = await resolvePromoDiscount({
      client,
      eventId,
      promoCode,
      subtotalCents
    })

    const discountCents = Number(promo.discountCents || 0)
    const totalCents = Math.max(0, subtotalCents - discountCents)
    const totalPesos = Math.round(totalCents / 100)

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
        buyer_cc,
        promo_code_id,
        promo_code,
        promo_discount_cents
      )   VALUES (
        $1, 'PENDING',
        $2, $3, $1,
        'WOMPI', now(), $4, 'PENDING',
        $2, 'COP',
        $5, $6, $7, $8,
        $9, $10, $11
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
        customer.cc || null,
        promo.promoId || null,
        promo.normalizedCode || null,
        discountCents
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

    if (promo.reservesUsage && promo.promoId) {
      await client.query(
        `
        UPDATE event_promo_codes
        SET used_count = used_count + 1,
            updated_at = now()
        WHERE id = $1
        `,
        [promo.promoId]
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
      promo: {
        code: promo.normalizedCode || null,
        discountCents,
        subtotalCents,
        totalCents
      },
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
    const known400 = new Set([
      'TICKET_TYPE_NOT_FOUND',
      'INVALID_QUANTITY',
      'MULTI_EVENT_CHECKOUT_NOT_ALLOWED',
      'PROMO_CODE_NOT_FOUND',
      'PROMO_CODE_INACTIVE',
      'PROMO_CODE_NOT_STARTED',
      'PROMO_CODE_EXPIRED',
      'PROMO_CODE_MIN_ORDER_NOT_MET',
      'PROMO_CODE_EXHAUSTED',
      'PROMO_CODE_INVALID_CONFIG'
    ])

    if (known400.has(e.message)) {
      return res.status(400).json({ error: e.message })
    }

    return res.status(500).json({ error: e.message || 'SERVER_ERROR' })
  } finally {
    client.release()
  }
})

router.post('/promo-preview', auth(['CLIENT', 'ADMIN']), async (req, res) => {
  const { items, promoCode } = req.body

  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'Items requeridos' })
  }

  const client = await db.getClient()

  try {
    await client.query('BEGIN')

    const typeIds = items.map(i => Number(i.ticketTypeId))
    const { rows: typeRows } = await client.query(
      `
      SELECT id, price_cents, event_id
      FROM ticket_types
      WHERE id = ANY($1::int[])
      `,
      [typeIds]
    )

    if (typeRows.length !== typeIds.length) {
      throw new Error('TICKET_TYPE_NOT_FOUND')
    }

    const eventIds = [...new Set(typeRows.map(t => Number(t.event_id)))]
    if (eventIds.length !== 1) {
      throw new Error('MULTI_EVENT_CHECKOUT_NOT_ALLOWED')
    }

    const eventId = eventIds[0]
    const { subtotalCents } = computeSubtotalCents(typeRows, items)

    const promo = await resolvePromoDiscount({
      client,
      eventId,
      promoCode,
      subtotalCents,
      lockRow: false
    })

    await client.query('ROLLBACK')

    const discountCents = Number(promo.discountCents || 0)
    const totalCents = Math.max(0, subtotalCents - discountCents)

    return res.json({
      eventId,
      promo: {
        code: promo.normalizedCode || null,
        applied: !!promo.applied,
        discountCents,
        subtotalCents,
        totalCents
      }
    })
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {})
    console.error(e)
    const known400 = new Set([
      'TICKET_TYPE_NOT_FOUND',
      'INVALID_QUANTITY',
      'MULTI_EVENT_CHECKOUT_NOT_ALLOWED',
      'PROMO_CODE_NOT_FOUND',
      'PROMO_CODE_INACTIVE',
      'PROMO_CODE_NOT_STARTED',
      'PROMO_CODE_EXPIRED',
      'PROMO_CODE_MIN_ORDER_NOT_MET',
      'PROMO_CODE_EXHAUSTED',
      'PROMO_CODE_INVALID_CONFIG'
    ])

    if (known400.has(e.message)) {
      return res.status(400).json({ error: e.message })
    }

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
