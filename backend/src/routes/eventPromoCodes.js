const express = require('express')
const router = express.Router()
const db = require('../db')
const auth = require('../middleware/auth')

async function ensureEventManageAccess(req, eventId) {
  const eventRes = await db.query(
    'SELECT id, created_by_user_id FROM events WHERE id = $1 LIMIT 1',
    [eventId]
  )

  if (!eventRes.rows.length) {
    const err = new Error('EVENT_NOT_FOUND')
    err.statusCode = 404
    throw err
  }

  const event = eventRes.rows[0]
  const isAdmin = req.user.role === 'ADMIN'
  const isOwner = Number(event.created_by_user_id) === Number(req.user.id)
  const staffRes = await db.query(
    'SELECT 1 FROM event_staff WHERE event_id = $1 AND user_id = $2 LIMIT 1',
    [eventId, req.user.id]
  )
  const isEventStaff = !!staffRes.rows.length

  if (!isAdmin && !isOwner && !isEventStaff) {
    const err = new Error('FORBIDDEN')
    err.statusCode = 403
    throw err
  }

  return event
}

function normalizePromoPayload(body = {}) {
  const discountType = String(body.discount_type || '').trim().toUpperCase()
  const code = String(body.code || '').trim().toUpperCase()

  return {
    code,
    discount_type: discountType,
    discount_value:
      body.discount_value === '' || body.discount_value == null
        ? null
        : Number(body.discount_value),
    discount_cents:
      body.discount_cents === '' || body.discount_cents == null
        ? null
        : Number(body.discount_cents),
    max_discount_cents:
      body.max_discount_cents === '' || body.max_discount_cents == null
        ? null
        : Number(body.max_discount_cents),
    min_order_cents:
      body.min_order_cents === '' || body.min_order_cents == null
        ? 0
        : Number(body.min_order_cents),
    starts_at: body.starts_at || null,
    ends_at: body.ends_at || null,
    max_uses:
      body.max_uses === '' || body.max_uses == null
        ? null
        : Number(body.max_uses),
    active: body.active !== false
  }
}

function validatePromoPayload(payload) {
  if (!payload.code) throw new Error('PROMO_CODE_REQUIRED')
  if (!['PERCENT', 'FIXED'].includes(payload.discount_type)) {
    throw new Error('PROMO_DISCOUNT_TYPE_INVALID')
  }
  if (payload.discount_type === 'PERCENT') {
    if (!Number.isFinite(payload.discount_value) || payload.discount_value <= 0 || payload.discount_value > 100) {
      throw new Error('PROMO_DISCOUNT_VALUE_INVALID')
    }
  }
  if (payload.discount_type === 'FIXED') {
    if (!Number.isFinite(payload.discount_cents) || payload.discount_cents < 0) {
      throw new Error('PROMO_DISCOUNT_CENTS_INVALID')
    }
  }
}

router.get('/:eventId/promo-codes', auth(['ADMIN', 'STAFF']), async (req, res) => {
  try {
    const eventId = Number(req.params.eventId)
    await ensureEventManageAccess(req, eventId)

    const promoRes = await db.query(
      `
      SELECT *
      FROM event_promo_codes
      WHERE event_id = $1
      ORDER BY created_at DESC, id DESC
      `,
      [eventId]
    )

    const benefitsRes = await db.query(
      `
      SELECT *
      FROM promo_code_benefits
      WHERE promo_code_id = ANY($1::int[])
      ORDER BY id ASC
      `,
      [promoRes.rows.map(row => Number(row.id))]
    )

    const benefitMap = new Map()
    for (const benefit of benefitsRes.rows) {
      const key = Number(benefit.promo_code_id)
      const list = benefitMap.get(key) || []
      list.push(benefit)
      benefitMap.set(key, list)
    }

    const payload = promoRes.rows.map(row => ({
      ...row,
      benefits: benefitMap.get(Number(row.id)) || []
    }))

    return res.json(payload)
  } catch (err) {
    console.error(err)
    return res.status(err.statusCode || 500).json({ error: err.message || 'SERVER_ERROR' })
  }
})

router.post('/:eventId/promo-codes', auth(['ADMIN', 'STAFF']), async (req, res) => {
  try {
    const eventId = Number(req.params.eventId)
    await ensureEventManageAccess(req, eventId)

    const payload = normalizePromoPayload(req.body)
    validatePromoPayload(payload)

    const { rows } = await db.query(
      `
      INSERT INTO event_promo_codes
      (
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
        active
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
      RETURNING *
      `,
      [
        eventId,
        payload.code,
        payload.discount_type,
        payload.discount_value,
        payload.discount_cents,
        payload.max_discount_cents,
        payload.min_order_cents,
        payload.starts_at,
        payload.ends_at,
        payload.max_uses,
        payload.active
      ]
    )

    return res.status(201).json({ ...rows[0], benefits: [] })
  } catch (err) {
    console.error(err)
    return res.status(400).json({ error: err.message || 'SERVER_ERROR' })
  }
})

router.patch('/:eventId/promo-codes/:promoCodeId', auth(['ADMIN', 'STAFF']), async (req, res) => {
  try {
    const eventId = Number(req.params.eventId)
    const promoCodeId = Number(req.params.promoCodeId)
    await ensureEventManageAccess(req, eventId)

    const payload = normalizePromoPayload(req.body)
    validatePromoPayload(payload)

    const { rows } = await db.query(
      `
      UPDATE event_promo_codes
      SET
        code = $3,
        discount_type = $4,
        discount_value = $5,
        discount_cents = $6,
        max_discount_cents = $7,
        min_order_cents = $8,
        starts_at = $9,
        ends_at = $10,
        max_uses = $11,
        active = $12,
        updated_at = now()
      WHERE id = $1
        AND event_id = $2
      RETURNING *
      `,
      [
        promoCodeId,
        eventId,
        payload.code,
        payload.discount_type,
        payload.discount_value,
        payload.discount_cents,
        payload.max_discount_cents,
        payload.min_order_cents,
        payload.starts_at,
        payload.ends_at,
        payload.max_uses,
        payload.active
      ]
    )

    if (!rows.length) {
      return res.status(404).json({ error: 'PROMO_CODE_NOT_FOUND' })
    }

    const benefitsRes = await db.query(
      'SELECT * FROM promo_code_benefits WHERE promo_code_id = $1 ORDER BY id ASC',
      [promoCodeId]
    )

    return res.json({ ...rows[0], benefits: benefitsRes.rows })
  } catch (err) {
    console.error(err)
    return res.status(400).json({ error: err.message || 'SERVER_ERROR' })
  }
})

router.delete('/:eventId/promo-codes/:promoCodeId', auth(['ADMIN', 'STAFF']), async (req, res) => {
  try {
    const eventId = Number(req.params.eventId)
    const promoCodeId = Number(req.params.promoCodeId)
    await ensureEventManageAccess(req, eventId)

    await db.query(
      'DELETE FROM event_promo_codes WHERE id = $1 AND event_id = $2',
      [promoCodeId, eventId]
    )

    return res.sendStatus(204)
  } catch (err) {
    console.error(err)
    return res.status(err.statusCode || 500).json({ error: err.message || 'SERVER_ERROR' })
  }
})

router.post('/:eventId/promo-codes/:promoCodeId/benefits', auth(['ADMIN', 'STAFF']), async (req, res) => {
  try {
    const eventId = Number(req.params.eventId)
    const promoCodeId = Number(req.params.promoCodeId)
    await ensureEventManageAccess(req, eventId)

    const benefit_name = String(req.body.benefit_name || '').trim()
    const benefit_description = String(req.body.benefit_description || '').trim()
    const quantity_per_ticket = Number(req.body.quantity_per_ticket || 1)
    const active = req.body.active !== false

    if (!benefit_name) {
      return res.status(400).json({ error: 'BENEFIT_NAME_REQUIRED' })
    }

    const { rows } = await db.query(
      `
      INSERT INTO promo_code_benefits
      (
        promo_code_id,
        benefit_name,
        benefit_description,
        quantity_per_ticket,
        active
      )
      VALUES ($1,$2,$3,$4,$5)
      RETURNING *
      `,
      [
        promoCodeId,
        benefit_name,
        benefit_description || null,
        quantity_per_ticket,
        active
      ]
    )

    return res.status(201).json(rows[0])
  } catch (err) {
    console.error(err)
    return res.status(400).json({ error: err.message || 'SERVER_ERROR' })
  }
})

router.patch('/:eventId/promo-codes/:promoCodeId/benefits/:benefitId', auth(['ADMIN', 'STAFF']), async (req, res) => {
  try {
    const eventId = Number(req.params.eventId)
    const benefitId = Number(req.params.benefitId)
    await ensureEventManageAccess(req, eventId)

    const benefit_name = String(req.body.benefit_name || '').trim()
    const benefit_description = String(req.body.benefit_description || '').trim()
    const quantity_per_ticket = Number(req.body.quantity_per_ticket || 1)
    const active = req.body.active !== false

    if (!benefit_name) {
      return res.status(400).json({ error: 'BENEFIT_NAME_REQUIRED' })
    }

    const { rows } = await db.query(
      `
      UPDATE promo_code_benefits
      SET
        benefit_name = $2,
        benefit_description = $3,
        quantity_per_ticket = $4,
        active = $5,
        updated_at = now()
      WHERE id = $1
      RETURNING *
      `,
      [benefitId, benefit_name, benefit_description || null, quantity_per_ticket, active]
    )

    if (!rows.length) {
      return res.status(404).json({ error: 'BENEFIT_NOT_FOUND' })
    }

    return res.json(rows[0])
  } catch (err) {
    console.error(err)
    return res.status(400).json({ error: err.message || 'SERVER_ERROR' })
  }
})

router.delete('/:eventId/promo-codes/:promoCodeId/benefits/:benefitId', auth(['ADMIN', 'STAFF']), async (req, res) => {
  try {
    const eventId = Number(req.params.eventId)
    const benefitId = Number(req.params.benefitId)
    await ensureEventManageAccess(req, eventId)

    await db.query('DELETE FROM promo_code_benefits WHERE id = $1', [benefitId])
    return res.sendStatus(204)
  } catch (err) {
    console.error(err)
    return res.status(err.statusCode || 500).json({ error: err.message || 'SERVER_ERROR' })
  }
})

module.exports = router
