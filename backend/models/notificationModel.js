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

async function createNotification(userId, title, message, type = 'info') {
  await pool.query(
    `
    INSERT INTO notifications (user_id, title, message, type)
    VALUES (?, ?, ?, ?)
  `,
    [userId, title, message, type],
  )
}

/** Batch insert in chunks for admin donor broadcasts. Pass `connection` to include in a transaction. */
async function insertNotificationsBulk(userIds, title, message, type = 'info', connection = null) {
  if (!userIds?.length) return
  const queryFn = connection ? connection.query.bind(connection) : pool.query.bind(pool)
  const chunkSize = 250
  for (let i = 0; i < userIds.length; i += chunkSize) {
    const chunk = userIds.slice(i, i + chunkSize)
    const placeholders = chunk.map(() => '(?, ?, ?, ?)').join(', ')
    const params = chunk.flatMap((uid) => [uid, title, message, type])
    await queryFn(
      `
      INSERT INTO notifications (user_id, title, message, type)
      VALUES ${placeholders}
    `,
      params,
    )
  }
}

module.exports = {
  getUserNotifications,
  markNotificationRead,
  createNotification,
  insertNotificationsBulk,
}

