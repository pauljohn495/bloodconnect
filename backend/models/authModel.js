const { pool } = require('../db')

async function findUserByIdentifier(identifier) {
  const [rows] = await pool.query(
    `
    SELECT id, username, email, password_hash, role, full_name, status, phone, blood_type
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

async function findUserByEmail(email) {
  const [rows] = await pool.query(
    `
    SELECT id, username, email, password_hash, role, full_name, status, phone, blood_type
    FROM users
    WHERE email = ?
    LIMIT 1
  `,
    [email],
  )
  return rows[0] || null
}

async function getUniqueUsername(baseUsername) {
  const normalized = (baseUsername || 'user').toLowerCase().replace(/[^a-z0-9._-]/g, '')
  const seed = normalized || 'user'
  let candidate = seed
  let suffix = 1

  while (await isUsernameTaken(candidate)) {
    candidate = `${seed}${suffix}`
    suffix += 1
  }

  return candidate
}

async function isUsernameTakenByOtherUser(username, userId) {
  const [rows] = await pool.query('SELECT id FROM users WHERE username = ? AND id <> ? LIMIT 1', [
    username,
    userId,
  ])
  return rows.length > 0
}

async function isPhoneTakenByOtherUser(phone, userId) {
  const [rows] = await pool.query('SELECT id FROM users WHERE phone = ? AND id <> ? LIMIT 1', [phone, userId])
  return rows.length > 0
}

async function createUser({
  fullName,
  username,
  email,
  phone,
  bloodType,
  passwordHash,
  role = 'donor',
  status = 'active',
}) {
  const safeEmail =
    email && email.trim() !== '' ? email.trim() : `${phone}@noemail.bloodconnect`
  const safeRole = 'donor'
  const safePhone = phone && phone.trim() !== '' ? phone.trim() : null
  const safeBloodType = bloodType && bloodType.trim() !== '' ? bloodType.trim() : null

  const conn = await pool.getConnection()
  try {
    await conn.beginTransaction()

    await conn.query(
      `
      INSERT INTO users (username, email, password_hash, role, full_name, phone, blood_type, status, last_donation_date, is_manual_donor)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL, 0)
    `,
      [username, safeEmail, passwordHash, safeRole, fullName, safePhone, safeBloodType, status],
    )

    await conn.commit()
  } catch (error) {
    await conn.rollback()
    throw error
  } finally {
    conn.release()
  }
}

async function updateDonorGoogleProfile({ userId, username, phone, bloodType }) {
  const [result] = await pool.query(
    `
      UPDATE users
      SET username = ?, phone = ?, blood_type = ?
      WHERE id = ? AND role = 'donor'
    `,
    [username, phone, bloodType, userId],
  )
  return result.affectedRows > 0
}

module.exports = {
  findUserByIdentifier,
  findUserByEmail,
  isUsernameTaken,
  isUsernameTakenByOtherUser,
  isPhoneTaken,
  isPhoneTakenByOtherUser,
  isEmailTaken,
  getUniqueUsername,
  createUser,
  updateDonorGoogleProfile,
}

