const { pool } = require('../db')

async function getUserNotifications(userId) {
  const [rows] = await pool.query(
    `
    SELECT id, title, message, type, is_read, created_at
    FROM notifications
    WHERE user_id = ?
    ORDER BY created_at DESC
  `,
    [userId],
  )
  return rows
}

async function markNotificationRead(userId, notificationId) {
  const [result] = await pool.query(
    `
    UPDATE notifications
    SET is_read = TRUE
    WHERE id = ? AND user_id = ?
  `,
    [notificationId, userId],
  )
  return result.affectedRows > 0
}

module.exports = {
  getUserNotifications,
  markNotificationRead,
}

