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

// POST /api/auth/register-donor
router.post('/register-donor', async (req, res) => {
  const { fullName, username, email, password, phone, bloodType } = req.body

  if (!fullName || !username || !password || !bloodType || !phone) {
    return res
      .status(400)
      .json({ message: 'fullName, username, phone, bloodType and password are required' })
  }

  try {
    // Check if username already exists
    const [existingUserByUsername] = await pool.query(
      'SELECT id FROM users WHERE username = ? LIMIT 1',
      [username],
    )

    if (existingUserByUsername.length > 0) {
      return res.status(400).json({ message: 'Username is already taken' })
    }

    // Check if phone already exists (one account per mobile number)
    const [existingUserByPhone] = await pool.query(
      'SELECT id FROM users WHERE phone = ? LIMIT 1',
      [phone],
    )

    if (existingUserByPhone.length > 0) {
      return res.status(400).json({ message: 'Mobile number is already registered' })
    }

    // Check if user already exists with this email (if provided)
    if (email) {
      const [existing] = await pool.query(
        'SELECT id FROM users WHERE email = ? LIMIT 1',
        [email],
      )

      if (existing.length > 0) {
        return res.status(400).json({ message: 'Email is already registered' })
      }
    }

    const passwordHash = await bcrypt.hash(password, 10)

    // If email is not provided but DB requires non-null + likely unique,
    // generate a synthetic email based on phone so it is never NULL.
    const safeEmail =
      email && email.trim() !== ''
        ? email.trim()
        : `${phone}@noemail.bloodconnect`

    // Create user and linked donor inside a transaction
    const conn = await pool.getConnection()
    try {
      await conn.beginTransaction()

      await conn.query(
        `
        INSERT INTO users (username, email, password_hash, role, full_name, phone, blood_type, status, last_donation_date)
        VALUES (?, ?, ?, 'donor', ?, ?, ?, 'active', NULL)
      `,
        [
          username, // explicit username for login identifier
          safeEmail,
          passwordHash,
          fullName,
          phone,
          bloodType,
        ],
      )

      await conn.commit()

      res.status(201).json({
        message: 'Donor registered successfully. You can now log in.',
      })
    } catch (error) {
      await conn.rollback()
      console.error('Register donor transaction error:', error)
      res.status(500).json({ message: 'Failed to register donor' })
    } finally {
      conn.release()
    }
  } catch (error) {
    console.error('Register donor error:', error)
    res.status(500).json({ message: 'Failed to register donor' })
  }
})

module.exports = router

