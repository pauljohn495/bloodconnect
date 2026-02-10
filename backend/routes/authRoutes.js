const express = require('express')
const bcrypt = require('bcryptjs')
const jwt = require('jsonwebtoken')

const { pool } = require('../db')

const router = express.Router()

// POST /api/auth/login
router.post('/login', async (req, res) => {
  const { identifier, password, role } = req.body

  if (!identifier || !password) {
    return res.status(400).json({ message: 'Identifier and password are required' })
  }

  try {
    const [rows] = await pool.query(
      `
      SELECT id, username, email, password_hash, role, full_name, status
      FROM users
      WHERE (email = ? OR username = ?)
      LIMIT 1
    `,
      [identifier, identifier],
    )

    const user = rows[0]
    if (!user) {
      return res.status(401).json({ message: 'Invalid credentials' })
    }

    if (role && user.role !== role) {
      return res.status(403).json({ message: 'User does not have the requested role' })
    }

    if (user.status !== 'active') {
      return res.status(403).json({ message: 'User account is not active' })
    }

    const passwordMatch = await bcrypt.compare(password, user.password_hash)
    if (!passwordMatch) {
      return res.status(401).json({ message: 'Invalid credentials' })
    }

    const tokenPayload = {
      id: user.id,
      role: user.role,
      fullName: user.full_name,
      email: user.email,
    }

    const token = jwt.sign(tokenPayload, process.env.JWT_SECRET || 'dev-secret', {
      expiresIn: '8h',
    })

    res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
        fullName: user.full_name,
        status: user.status,
      },
    })
  } catch (error) {
    console.error('Login error:', error)
    res.status(500).json({ message: 'Failed to login' })
  }
})

module.exports = router


