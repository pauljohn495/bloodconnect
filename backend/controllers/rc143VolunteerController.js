const { pool } = require('../db')

function cleanDetails(body = {}) {
  return {
    organization: String(body.organization || '').trim(),
    occupation: String(body.occupation || '').trim(),
    contact: String(body.contact || '').trim(),
    address: String(body.address || '').trim(),
    contactNumber: String(body.contactNumber || '').trim(),
  }
}

async function donorExists(userId) {
  const [rows] = await pool.query("SELECT id FROM users WHERE id = ? AND role = 'donor' LIMIT 1", [userId])
  return rows.length > 0
}

async function listRc143VolunteersController(req, res) {
  try {
    const [rows] = await pool.query(`
      SELECT v.id, v.user_id AS sourceUserId, u.role AS sourceUserRole,
             COALESCE(u.full_name, u.username, CONCAT('User #', u.id)) AS fullName,
             v.organization, v.occupation, v.contact, v.address,
             v.contact_number AS contactNumber, v.created_at AS registeredAt, v.updated_at AS updatedAt,
             (SELECT COUNT(*) FROM mbd_donor_records d WHERE d.rc143_volunteer_id = v.id) AS donorCount
      FROM rc143_volunteers v INNER JOIN users u ON u.id = v.user_id
      ORDER BY v.created_at DESC
    `)
    return res.json(rows)
  } catch (error) {
    console.error('List RC143 volunteers error:', error)
    return res.status(500).json({ message: 'Failed to load RC143 volunteers' })
  }
}

async function createRc143VolunteerController(req, res) {
  const userId = Number(req.body?.userId)
  if (!Number.isInteger(userId) || userId < 1 || !(await donorExists(userId))) return res.status(400).json({ message: 'Select an existing donor user.' })
  const d = cleanDetails(req.body)
  try {
    const [result] = await pool.query(
      'INSERT INTO rc143_volunteers (user_id, organization, occupation, contact, address, contact_number) VALUES (?, ?, ?, ?, ?, ?)',
      [userId, d.organization, d.occupation, d.contact, d.address, d.contactNumber],
    )
    return res.status(201).json({ id: result.insertId, message: 'Volunteer registered' })
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') return res.status(409).json({ message: 'This donor is already an RC143 volunteer.' })
    console.error('Create RC143 volunteer error:', error)
    return res.status(500).json({ message: 'Failed to register RC143 volunteer' })
  }
}

async function updateRc143VolunteerController(req, res) {
  const userId = Number(req.body?.userId)
  if (!Number.isInteger(userId) || userId < 1 || !(await donorExists(userId))) return res.status(400).json({ message: 'Select an existing donor user.' })
  const d = cleanDetails(req.body)
  try {
    const [result] = await pool.query(
      'UPDATE rc143_volunteers SET user_id = ?, organization = ?, occupation = ?, contact = ?, address = ?, contact_number = ? WHERE id = ?',
      [userId, d.organization, d.occupation, d.contact, d.address, d.contactNumber, req.params.id],
    )
    if (!result.affectedRows) return res.status(404).json({ message: 'RC143 volunteer not found' })
    return res.json({ message: 'Volunteer updated' })
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') return res.status(409).json({ message: 'This donor is already an RC143 volunteer.' })
    console.error('Update RC143 volunteer error:', error)
    return res.status(500).json({ message: 'Failed to update RC143 volunteer' })
  }
}

async function deleteRc143VolunteerController(req, res) {
  try {
    const [result] = await pool.query('DELETE FROM rc143_volunteers WHERE id = ?', [req.params.id])
    if (!result.affectedRows) return res.status(404).json({ message: 'RC143 volunteer not found' })
    return res.json({ message: 'Volunteer deleted' })
  } catch (error) {
    console.error('Delete RC143 volunteer error:', error)
    return res.status(500).json({ message: 'Failed to delete RC143 volunteer' })
  }
}

async function getMyRc143VolunteerStatusController(req, res) {
  try {
    const [rows] = await pool.query('SELECT id FROM rc143_volunteers WHERE user_id = ? LIMIT 1', [req.user.id])
    return res.json({ isRc143Volunteer: rows.length > 0 })
  } catch (error) {
    console.error('Get RC143 volunteer status error:', error)
    return res.status(500).json({ message: 'Failed to load RC143 volunteer status' })
  }
}

async function isRc143Volunteer(userId) {
  const [rows] = await pool.query('SELECT id FROM rc143_volunteers WHERE user_id = ? LIMIT 1', [userId])
  return rows.length > 0
}

module.exports = { listRc143VolunteersController, createRc143VolunteerController, updateRc143VolunteerController, deleteRc143VolunteerController, getMyRc143VolunteerStatusController, isRc143Volunteer }
