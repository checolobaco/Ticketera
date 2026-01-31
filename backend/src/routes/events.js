const express = require('express')
const router = express.Router()
const db = require('../db')
const auth = require('../middleware/auth')
const cryptoService = require('../services/cryptoService') // ✅ existe en tu proyecto

function makeShareSlug() {
  return Math.random().toString(36).slice(2, 12)
}

/**
 * GET /api/events
 * - Público: devuelve todos (con venue)
 * GET /api/events?mine=1 (requiere auth ADMIN/STAFF)
 * - ADMIN: todos
 * - STAFF: solo created_by_user_id = req.user.id
 */
router.get('/', async (req, res) => {
  try {
    const mine = String(req.query.mine || '') === '1'

    // mine=1 requiere auth
    if (mine) {
      const header = req.headers.authorization || ''
      const token = header.replace('Bearer ', '')
      if (!token) return res.status(401).json({ error: 'NO_TOKEN' })

      return auth(['ADMIN', 'STAFF'])(req, res, async () => {
        const q = req.user.role === 'ADMIN'
          ? `
            SELECT e.*, v.name as venue_name
            FROM events e
            LEFT JOIN venues v ON e.venue_id = v.id
            ORDER BY e.start_datetime DESC
          `
          : `
            SELECT e.*, v.name as venue_name
            FROM events e
            LEFT JOIN venues v ON e.venue_id = v.id
            WHERE e.created_by_user_id = $1
            ORDER BY e.start_datetime DESC
          `

        const params = req.user.role === 'ADMIN' ? [] : [req.user.id]
        const { rows } = await db.query(q, params)
        return res.json(rows)
      })
    }

    // público: todos
    const { rows } = await db.query(`
      SELECT e.*, v.name as venue_name
      FROM events e
      LEFT JOIN venues v ON e.venue_id = v.id
      ORDER BY e.start_datetime ASC
    `)
    return res.json(rows)
  } catch (err) {
    console.error(err)
    return res.status(500).json({ error: 'SERVER_ERROR' })
  }
})

/**
 * POST /api/events
 * Crea evento y guarda owner + share_slug + image_url
 */
router.post('/', auth(['ADMIN', 'STAFF']), async (req, res) => {
  const { name, description, start_datetime, end_datetime, image_url } = req.body

  if (!name || !start_datetime) {
    return res.status(400).json({ error: 'VALIDATION_ERROR' })
  }

  const share_slug = makeShareSlug()

  const { rows } = await db.query(`
    INSERT INTO events (name, description, start_datetime, end_datetime, image_url, share_slug, created_by_user_id)
    VALUES ($1,$2,$3,$4,$5,$6,$7)
    RETURNING *
  `, [
    name,
    description || null,
    start_datetime,
    end_datetime || null,
    image_url || null,
    share_slug,
    req.user.id
  ])

  return res.status(201).json(rows[0])
})

/**
 * PUT /api/events/:id/payment-config
 * Upsert Wompi config (ownership enforced)
 */
router.put('/:id/payment-config', auth(['ADMIN', 'STAFF']), async (req, res) => {
  try {
    const { id } = req.params
    const {
      environment,
      wompi_public_key,
      wompi_integrity_secret,
      wompi_private_key,
      is_active
    } = req.body

    const ev = await db.query('select created_by_user_id from events where id = $1', [id])
    if (!ev.rowCount) return res.sendStatus(404)

    if (req.user.role !== 'ADMIN' && Number(ev.rows[0].created_by_user_id) !== Number(req.user.id)) {
      return res.sendStatus(403)
    }

    const encIntegrity = wompi_integrity_secret ? cryptoService.encrypt(wompi_integrity_secret) : null
    const encPrivate = wompi_private_key ? cryptoService.encrypt(wompi_private_key) : null

    await db.query(`
      INSERT INTO event_payment_config
        (event_id, environment, wompi_public_key,
         wompi_integrity_secret_enc, wompi_integrity_secret_iv,
         wompi_private_key_enc, wompi_private_key_iv,
         is_active)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
      ON CONFLICT (event_id) DO UPDATE SET
        environment = EXCLUDED.environment,
        wompi_public_key = EXCLUDED.wompi_public_key,
        wompi_integrity_secret_enc = EXCLUDED.wompi_integrity_secret_enc,
        wompi_integrity_secret_iv = EXCLUDED.wompi_integrity_secret_iv,
        wompi_private_key_enc = EXCLUDED.wompi_private_key_enc,
        wompi_private_key_iv = EXCLUDED.wompi_private_key_iv,
        is_active = EXCLUDED.is_active,
        updated_at = now()
    `, [
      id,
      environment,
      wompi_public_key,
      encIntegrity?.data ?? null,
      encIntegrity?.iv ?? null,
      encPrivate?.data ?? null,
      encPrivate?.iv ?? null,
      is_active ?? true
    ])

    return res.sendStatus(204)
  } catch (err) {
    console.error(err)
    return res.status(500).json({ error: 'SERVER_ERROR' })
  }
})

module.exports = router
