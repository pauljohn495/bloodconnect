const express = require('express')

const { pool } = require('../db')
const auth = require('../middleware/auth')

const router = express.Router()

// All notification routes require any authenticated user
router.use(auth(['admin', 'hospital', 'donor', 'recipient']))

// GET /api/notifications
router.get('/', async (req, res) => {
  try {
    const [rows] = await pool.query(
      `
      SELECT id, title, message, type, is_read, created_at
      FROM notifications
      WHERE user_id = ?
      ORDER BY created_at DESC
    `,
      [req.user.id],
    )

    res.json(rows)
  } catch (error) {
    console.error('Fetch notifications error:', error)
    res.status(500).json({ message: 'Failed to fetch notifications' })
  }
})

// PATCH /api/notifications/:id/read
router.patch('/:id/read', async (req, res) => {
  const { id } = req.params

  try {
    const [result] = await pool.query(
      `
      UPDATE notifications
      SET is_read = TRUE
      WHERE id = ? AND user_id = ?
    `,
      [id, req.user.id],
    )

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Notification not found' })
    }

    res.json({ message: 'Notification marked as read' })
  } catch (error) {
    console.error('Mark notification read error:', error)
    res.status(500).json({ message: 'Failed to mark notification as read' })
  }
})

module.exports = router


