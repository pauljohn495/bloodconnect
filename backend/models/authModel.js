const { pool } = require('../db')

async function findUserByIdentifier(identifier) {
  const [rows] = await pool.query(
    `
    SELECT id, username, email, password_hash, role, full_name, status
    FROM users
    WHERE (email = ? OR username = ?)
    LIMIT 1
  `,
    [identifier, identifier],
  )
  return rows[0] || null
}

async function isUsernameTaken(username) {
  const [rows] = await pool.query('SELECT id FROM users WHERE username = ? LIMIT 1', [username])
  return rows.length > 0
}

async function isPhoneTaken(phone) {
  const [rows] = await pool.query('SELECT id FROM users WHERE phone = ? LIMIT 1', [phone])
  return rows.length > 0
}

async function isEmailTaken(email) {
  const [rows] = await pool.query('SELECT id FROM users WHERE email = ? LIMIT 1', [email])
  return rows.length > 0
}

async function createDonorUser({ fullName, username, email, phone, bloodType, passwordHash }) {
  const safeEmail =
    email && email.trim() !== '' ? email.trim() : `${phone}@noemail.bloodconnect`

  const conn = await pool.getConnection()
  try {
    await conn.beginTransaction()

    await conn.query(
      `
      INSERT INTO users (username, email, password_hash, role, full_name, phone, blood_type, status, last_donation_date)
      VALUES (?, ?, ?, 'donor', ?, ?, ?, 'active', NULL)
    `,
      [username, safeEmail, passwordHash, fullName, phone, bloodType],
    )

    await conn.commit()
  } catch (error) {
    await conn.rollback()
    throw error
  } finally {
    conn.release()
  }
}

module.exports = {
  findUserByIdentifier,
  isUsernameTaken,
  isPhoneTaken,
  isEmailTaken,
  createDonorUser,
}

