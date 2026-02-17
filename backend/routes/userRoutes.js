const express = require('express')

const { pool } = require('../db')
const auth = require('../middleware/auth')

const router = express.Router()

// All user routes require any authenticated user
router.use(auth(['admin', 'hospital', 'donor', 'recipient']))

// GET /api/user/me
router.get('/me', async (req, res) => {
  try {
    const [rows] = await pool.query(
      `
      SELECT id, username, email, role, full_name, phone, blood_type, status, created_at, updated_at
      FROM users
      WHERE id = ?
    `,
      [req.user.id],
    )

    if (!rows[0]) {
      return res.status(404).json({ message: 'User not found' })
    }

    res.json(rows[0])
  } catch (error) {
    console.error('Fetch current user error:', error)
    res.status(500).json({ message: 'Failed to fetch user profile' })
  }
})

// PUT /api/user/me
router.put('/me', async (req, res) => {
  const { fullName, phone, bloodType } = req.body

  try {
    const [result] = await pool.query(
      `
      UPDATE users
      SET full_name = COALESCE(?, full_name),
          phone = COALESCE(?, phone),
          blood_type = COALESCE(?, blood_type)
      WHERE id = ?
    `,
      [fullName ?? null, phone ?? null, bloodType ?? null, req.user.id],
    )

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'User not found' })
    }

    const [rows] = await pool.query(
      `
      SELECT id, username, email, role, full_name, phone, blood_type, status, created_at, updated_at
      FROM users
      WHERE id = ?
    `,
      [req.user.id],
    )

    res.json(rows[0])
  } catch (error) {
    console.error('Update current user error:', error)
    res.status(500).json({ message: 'Failed to update user profile' })
  }
})

// GET /api/user/donations - donation history for donor user
router.get('/donations', async (req, res) => {
  try {
    const [rows] = await pool.query(
      `
      SELECT id, blood_type, donation_date, location, hospital_id, status, units_donated
      FROM donations
      WHERE user_id = ?
      ORDER BY donation_date DESC
    `,
      [req.user.id],
    )

    res.json(rows)
  } catch (error) {
    console.error('Fetch user donations error:', error)
    res.status(500).json({ message: 'Failed to fetch donation history' })
  }
})

// GET /api/user/blood-availability - simple summary for the user blood type
router.get('/blood-availability', async (req, res) => {
  try {
    const [userRows] = await pool.query(
      'SELECT blood_type FROM users WHERE id = ?',
      [req.user.id],
    )

    const bloodType = userRows[0]?.blood_type
    if (!bloodType) {
      return res.json({ bloodType: null, totalAvailable: 0 })
    }

    const [rows] = await pool.query(
      `
      SELECT blood_type, total_available
      FROM v_blood_stock_summary
      WHERE blood_type = ?
    `,
      [bloodType],
    )

    const summary = rows[0] || { blood_type: bloodType, total_available: 0 }

    res.json({
      bloodType: summary.blood_type,
      totalAvailable: summary.total_available,
    })
  } catch (error) {
    console.error('Blood availability error:', error)
    res.status(500).json({ message: 'Failed to fetch blood availability' })
  }
})

module.exports = router


