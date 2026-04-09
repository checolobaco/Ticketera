const express = require('express')
const router = express.Router()
const db = require('../db')
const auth = require('../middleware/auth')

async function canManageEvent(req, eventId) {
  const ev = await db.query(
    'SELECT id, created_by_user_id FROM events WHERE id = $1',
    [eventId]
  )

  if (!ev.rowCount) return { ok: false, status: 404 }

  const isOwner =
    Number(ev.rows[0].created_by_user_id) === Number(req.user.id)

  const isAdmin = req.user.role === 'ADMIN'

  if (!isAdmin && !isOwner) {
    return { ok: false, status: 403 }
  }

  return { ok: true, event: ev.rows[0] }
}

router.get('/:id/staff', auth(['ADMIN', 'STAFF']), async (req, res) => {
  try {
    const { id } = req.params

    const access = await canManageEvent(req, id)
    if (!access.ok) return res.sendStatus(access.status)

    const { rows } = await db.query(
      `
      SELECT
        es.event_id,
        es.user_id,
        es.role,
        es.can_edit_event,
        es.can_manage_ticket_types,
        es.can_manage_wompi,
        es.created_at,
        u.name,
        u.email
      FROM event_staff es
      INNER JOIN users u ON u.id = es.user_id
      WHERE es.event_id = $1
      ORDER BY es.created_at DESC
      `,
      [id]
    )

    return res.json(rows)
  } catch (err) {
    console.error(err)
    return res.status(500).json({ error: 'SERVER_ERROR' })
  }
})

router.post('/:id/staff', auth(['ADMIN', 'STAFF']), async (req, res) => {
  try {
    const { id } = req.params
    const {
      user_id,
      email,
      can_edit_event = false,
      can_manage_ticket_types = false,
      can_manage_wompi = false
    } = req.body

    const access = await canManageEvent(req, id)
    if (!access.ok) return res.sendStatus(access.status)

    let targetUser = null

    if (user_id) {
      const userRes = await db.query(
        `SELECT id, name, email, role FROM users WHERE id = $1`,
        [Number(user_id)]
      )
      if (!userRes.rowCount) {
        return res.status(404).json({ error: 'USER_NOT_FOUND' })
      }
      targetUser = userRes.rows[0]
    } else if (email && String(email).trim()) {
      const userRes = await db.query(
        `SELECT id, name, email, role FROM users WHERE LOWER(email) = LOWER($1)`,
        [String(email).trim()]
      )
      if (!userRes.rowCount) {
        return res.status(404).json({ error: 'USER_EMAIL_NOT_FOUND' })
      }
      targetUser = userRes.rows[0]
    } else {
      return res.status(400).json({ error: 'USER_ID_OR_EMAIL_REQUIRED' })
    }

    const { rows } = await db.query(
      `
      INSERT INTO event_staff
      (
        event_id,
        user_id,
        role,
        can_edit_event,
        can_manage_ticket_types,
        can_manage_wompi
      )
      VALUES ($1,$2,'STAFF',$3,$4,$5)
      ON CONFLICT (event_id, user_id)
      DO UPDATE SET
        role = 'STAFF',
        can_edit_event = EXCLUDED.can_edit_event,
        can_manage_ticket_types = EXCLUDED.can_manage_ticket_types,
        can_manage_wompi = EXCLUDED.can_manage_wompi
      RETURNING *
      `,
      [
        id,
        Number(targetUser.id),
        !!can_edit_event,
        !!can_manage_ticket_types,
        !!can_manage_wompi
      ]
    )

    return res.status(201).json({
      ...rows[0],
      user: {
        id: targetUser.id,
        name: targetUser.name,
        email: targetUser.email
      }
    })
  } catch (err) {
    console.error(err)
    return res.status(500).json({ error: 'SERVER_ERROR' })
  }
})

router.delete('/:id/staff/:userId', auth(['ADMIN', 'STAFF']), async (req, res) => {
  try {
    const { id, userId } = req.params

    const access = await canManageEvent(req, id)
    if (!access.ok) return res.sendStatus(access.status)

    await db.query(
      `DELETE FROM event_staff WHERE event_id = $1 AND user_id = $2`,
      [id, userId]
    )

    return res.sendStatus(204)
  } catch (err) {
    console.error(err)
    return res.status(500).json({ error: 'SERVER_ERROR' })
  }
})

router.get('/:id/manual-purchase-access', auth(['ADMIN', 'STAFF', 'CLIENT']), async (req, res) => {
  try {
    const { id } = req.params

    const { rows: evRows } = await db.query(
      `
      SELECT
        e.id,
        e.created_by_user_id,
        COALESCE(epc.enable_manual, false) AS enable_manual,
        COALESCE(epc.enable_wompi, false) AS enable_wompi,
        COALESCE(epc.enable_receipt, false) AS enable_receipt,
        COALESCE(epc.is_active, true) AS payment_config_active
      FROM events e
      LEFT JOIN event_payment_config epc ON epc.event_id = e.id
      WHERE e.id = $1
      `,
      [id]
    )

    if (!evRows.length) return res.sendStatus(404)

    const event = evRows[0]

    const { rows: staffRows } = await db.query(
      `
      SELECT role
      FROM event_staff
      WHERE event_id = $1 AND user_id = $2
      LIMIT 1
      `,
      [id, req.user.id]
    )

    const isAdmin = req.user.role === 'ADMIN'
    const isOwner = Number(event.created_by_user_id) === Number(req.user.id)
    const isEventStaff = !!staffRows.length && staffRows[0].role === 'STAFF'

    const canConfirmManualPurchase =
      !!event.enable_manual && (isAdmin || isOwner || isEventStaff)

    return res.json({
      event_id: Number(id),
      enable_manual: !!event.enable_manual,
      enable_wompi: !!event.enable_wompi,
      enable_receipt: !!event.enable_receipt,
      payment_config_active: !!event.payment_config_active,
      is_admin: isAdmin,
      is_owner: isOwner,
      is_event_staff: isEventStaff,
      can_confirm_manual_purchase: canConfirmManualPurchase
    })
  } catch (err) {
    console.error(err)
    return res.status(500).json({ error: 'SERVER_ERROR' })
  }
})

module.exports = router