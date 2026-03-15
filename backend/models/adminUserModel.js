const { pool } = require('../db')
const bcrypt = require('bcryptjs')

async function getAllAdmins() {
  const [rows] = await pool.query(
    `
    SELECT id, username, email, full_name, role, status, created_at
    FROM users
    WHERE role IN ('admin', 'super_admin')
    ORDER BY created_at DESC
  `,
  )
  return rows
}

async function createAdmin({ fullName, email, username, password, role = 'admin' }) {
  const passwordHash = await bcrypt.hash(password, 10)

  const [result] = await pool.query(
    `
    INSERT INTO users (username, email, password_hash, role, full_name, status)
    VALUES (?, ?, ?, ?, ?, 'active')
  `,
    [username, email, passwordHash, role, fullName],
  )

  return result.insertId
}

async function updateAdmin(id, { fullName, email, username, role, status }) {
  const [result] = await pool.query(
    `
    UPDATE users
    SET full_name = ?, email = ?, username = ?, role = ?, status = ?
    WHERE id = ? AND role IN ('admin', 'super_admin')
  `,
    [fullName, email, username, role, status, id],
  )

  return result.affectedRows > 0
}

async function deleteAdmin(id) {
  const [result] = await pool.query(
    `
    DELETE FROM users
    WHERE id = ? AND role IN ('admin', 'super_admin')
  `,
    [id],
  )

  return result.affectedRows > 0
}

async function findAdminById(id) {
  const [rows] = await pool.query(
    `
    SELECT id, username, email, full_name, role, status
    FROM users
    WHERE id = ? AND role IN ('admin', 'super_admin')
    LIMIT 1
  `,
    [id],
  )
  return rows[0] || null
}

async function isUsernameTaken(username, excludeId = null) {
  let query = 'SELECT id FROM users WHERE username = ? AND role IN (\'admin\', \'super_admin\')'
  const params = [username]

  if (excludeId) {
    query += ' AND id != ?'
    params.push(excludeId)
  }

  query += ' LIMIT 1'

  const [rows] = await pool.query(query, params)
  return rows.length > 0
}

async function isEmailTaken(email, excludeId = null) {
  let query = 'SELECT id FROM users WHERE email = ? AND role IN (\'admin\', \'super_admin\')'
  const params = [email]

  if (excludeId) {
    query += ' AND id != ?'
    params.push(excludeId)
  }

  query += ' LIMIT 1'

  const [rows] = await pool.query(query, params)
  return rows.length > 0
}

module.exports = {
  getAllAdmins,
  createAdmin,
  updateAdmin,
  deleteAdmin,
  findAdminById,
  isUsernameTaken,
  isEmailTaken,
}