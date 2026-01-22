const express = require('express')
const router = express.Router()
const db = require('../db')
const bcrypt = require('bcryptjs')
const jwt = require('jsonwebtoken')

router.post('/register', async (req, res) => {
  const { name, email, password } = req.body || {}
  if (!name || !email || !password) return res.status(400).json({ error: 'MISSING_FIELDS' })

  const existing = await db.query(`SELECT id FROM users WHERE email = $1`, [email.trim().toLowerCase()])
  if (existing.rows.length) return res.status(409).json({ error: 'EMAIL_IN_USE' })

  const hash = await bcrypt.hash(password, 10)

  const ins = await db.query(
    `INSERT INTO users (name, email, password_hash, role)
     VALUES ($1,$2,$3,'CLIENT')
     RETURNING id, name, role`,
    [name.trim(), email.trim().toLowerCase(), hash]
  )

  const user = ins.rows[0]
  const token = jwt.sign(
    { id: user.id, role: user.role, name: user.name },
    process.env.JWT_SECRET,
    { expiresIn: '8h' }
  )

  res.json({ token, user })
})

module.exports = router
