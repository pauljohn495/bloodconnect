const { pool } = require('../db')

async function createMbdRequestController(req, res) {
  const title = String(req.body?.title || '').trim()
  const message = String(req.body?.message || '').trim()
  const location = String(req.body?.location || '').trim()
  if (!title || !message || !location) return res.status(400).json({ message: 'Title, message and location are required' })
  if (title.length > 255 || location.length > 512) return res.status(400).json({ message: 'Title or location is too long' })
  if (message.length > 2000) return res.status(400).json({ message: 'Message must be 2,000 characters or fewer' })
  try {
    const [result] = await pool.query(
      'INSERT INTO mbd_requests (volunteer_user_id, title, message, location) VALUES (?, ?, ?, ?)',
      [req.user.id, title, message, location],
    )
    return res.status(201).json({ id: result.insertId, message: 'MBD request submitted' })
  } catch (error) {
    console.error('Create MBD request error:', error)
    return res.status(500).json({ message: 'Failed to submit MBD request' })
  }
}

async function listMbdRequestsController(req, res) {
  try {
    const [rows] = await pool.query(`
      SELECT r.id, r.title, r.message, r.location, r.status, r.created_at, u.id AS volunteer_user_id,
             COALESCE(u.full_name, u.username, 'Unknown volunteer') AS volunteer_name,
             u.phone AS volunteer_phone
      FROM mbd_requests r INNER JOIN users u ON u.id = r.volunteer_user_id
      ORDER BY r.created_at DESC
    `)
    return res.json(rows)
  } catch (error) {
    console.error('List MBD requests error:', error)
    return res.status(500).json({ message: 'Failed to load MBD requests' })
  }
}

async function updateMbdRequestStatusController(req, res) {
  const status = String(req.body?.status || '').toLowerCase()
  if (!['approved', 'rejected'].includes(status)) return res.status(400).json({ message: 'Status must be approved or rejected' })
  try {
    const [result] = await pool.query('UPDATE mbd_requests SET status = ? WHERE id = ?', [status, req.params.id])
    if (!result.affectedRows) return res.status(404).json({ message: 'MBD request not found' })
    return res.json({ message: `MBD request ${status}`, status })
  } catch (error) {
    console.error('Update MBD request status error:', error)
    return res.status(500).json({ message: 'Failed to update MBD request' })
  }
}

async function listMyMbdRequestsController(req, res) {
  try {
    const [rows] = await pool.query(
      'SELECT id, title, message, location, status, created_at FROM mbd_requests WHERE volunteer_user_id = ? ORDER BY created_at DESC',
      [req.user.id],
    )
    return res.json(rows)
  } catch (error) {
    console.error('List my MBD requests error:', error)
    return res.status(500).json({ message: 'Failed to load MBD requests' })
  }
}

module.exports = { createMbdRequestController, listMbdRequestsController, listMyMbdRequestsController, updateMbdRequestStatusController }
