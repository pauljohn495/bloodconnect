const { pool } = require('../db')
const { isRc143Volunteer } = require('./rc143VolunteerController')

const clean = (value, max) => String(value || '').trim().slice(0, max)

async function createRc143ActivityRequest(req, res) {
  const title = clean(req.body?.title, 255)
  const details = clean(req.body?.details, 2000)
  const location = clean(req.body?.location, 512)
  if (!title || !location) return res.status(400).json({ message: 'Title and location are required' })
  try {
    if (!(await isRc143Volunteer(req.user.id))) return res.status(403).json({ message: 'Only registered RC143 volunteers can submit activity requests' })
    const [result] = await pool.query(
      'INSERT INTO rc143_activity_requests (volunteer_user_id, title, details, location) VALUES (?, ?, ?, ?)',
      [req.user.id, title, details || null, location],
    )
    return res.status(201).json({ id: result.insertId, message: 'RC143 activity request submitted' })
  } catch (error) {
    console.error('Create RC143 activity request error:', error)
    return res.status(500).json({ message: 'Failed to submit RC143 activity request' })
  }
}

async function listMyRc143ActivityRequests(req, res) {
  try {
    const [rows] = await pool.query(
      'SELECT id, title, details, location, status, created_at AS requestedAt, reviewed_at AS reviewedAt FROM rc143_activity_requests WHERE volunteer_user_id = ? ORDER BY created_at DESC',
      [req.user.id],
    )
    return res.json(rows)
  } catch (error) {
    console.error('List my RC143 activity requests error:', error)
    return res.status(500).json({ message: 'Failed to load RC143 activity requests' })
  }
}

async function listRc143ActivityRequests(req, res) {
  try {
    const [rows] = await pool.query(`
      SELECT r.id, r.title, r.details, r.location, r.status, r.created_at AS requestedAt, r.reviewed_at AS reviewedAt,
             COALESCE(u.full_name, u.username, CONCAT('User #', u.id)) AS volunteerName, r.volunteer_user_id AS volunteerId
      FROM rc143_activity_requests r INNER JOIN users u ON u.id = r.volunteer_user_id
      ORDER BY r.created_at DESC`)
    return res.json(rows)
  } catch (error) {
    console.error('List RC143 activity requests error:', error)
    return res.status(500).json({ message: 'Failed to load RC143 activity requests' })
  }
}

async function updateRc143ActivityRequestStatus(req, res) {
  const status = String(req.body?.status || '').toLowerCase()
  if (!['approved', 'rejected'].includes(status)) return res.status(400).json({ message: 'Status must be approved or rejected' })
  try {
    const [result] = await pool.query(
      "UPDATE rc143_activity_requests SET status = ?, reviewed_at = NOW(), reviewed_by = ? WHERE id = ? AND status = 'pending'",
      [status, req.user.id, req.params.id],
    )
    if (!result.affectedRows) return res.status(404).json({ message: 'Pending RC143 activity request not found' })
    return res.json({ message: `RC143 activity request ${status}`, status })
  } catch (error) {
    console.error('Update RC143 activity request error:', error)
    return res.status(500).json({ message: 'Failed to update RC143 activity request' })
  }
}

module.exports = { createRc143ActivityRequest, listMyRc143ActivityRequests, listRc143ActivityRequests, updateRc143ActivityRequestStatus }
