const { pool } = require('../db')

const ALLOWED_TYPES = new Set(['blood_drive', 'urgent_need', 'general'])
const ALLOWED_STATUS = new Set(['upcoming', 'ongoing', 'completed'])

const mapRow = (row) => ({
  id: row.id,
  title: row.title,
  description: row.description,
  announcement_type: row.announcement_type,
  event_starts_at: row.event_starts_at,
  location: row.location,
  status: row.status,
  created_at: row.created_at,
  updated_at: row.updated_at,
})

/** Mark past events as completed (event time has passed). */
async function expirePastAnnouncements() {
  await pool.query(
    `
    UPDATE announcements
    SET status = 'completed'
    WHERE status IN ('upcoming', 'ongoing')
      AND event_starts_at < NOW()
  `,
  )
}

const getAnnouncementsController = async (req, res) => {
  try {
    await expirePastAnnouncements()
    const [rows] = await pool.query(
      `
      SELECT id, title, description, announcement_type, event_starts_at, location, status, created_at, updated_at
      FROM announcements
      ORDER BY event_starts_at ASC, id ASC
    `,
    )
    return res.json(rows.map(mapRow))
  } catch (error) {
    if (error && (error.code === 'ER_NO_SUCH_TABLE' || error.errno === 1146)) {
      return res.status(500).json({
        message:
          'Announcements table is missing. Run `backend/database/announcements.sql` on your database.',
      })
    }
    console.error('List announcements error:', error)
    return res.status(500).json({ message: 'Failed to fetch announcements' })
  }
}

const createAnnouncementController = async (req, res) => {
  const {
    title,
    description,
    announcementType,
    eventStartsAt,
    location: loc,
    status,
  } = req.body

  if (!title || !String(title).trim()) {
    return res.status(400).json({ message: 'title is required' })
  }
  if (!eventStartsAt) {
    return res.status(400).json({ message: 'eventStartsAt is required' })
  }

  const announcementTypeNorm = (announcementType || 'general').toLowerCase()
  if (!ALLOWED_TYPES.has(announcementTypeNorm)) {
    return res.status(400).json({
      message: 'announcementType must be blood_drive, urgent_need, or general',
    })
  }

  const statusNorm = (status || 'upcoming').toLowerCase()
  if (!ALLOWED_STATUS.has(statusNorm)) {
    return res.status(400).json({
      message: 'status must be upcoming, ongoing, or completed',
    })
  }

  const locationStr = loc != null ? String(loc) : ''

  try {
    const [result] = await pool.query(
      `
      INSERT INTO announcements (title, description, announcement_type, event_starts_at, location, status)
      VALUES (?, ?, ?, ?, ?, ?)
    `,
      [
        String(title).trim(),
        description != null ? String(description) : '',
        announcementTypeNorm,
        eventStartsAt,
        locationStr,
        statusNorm,
      ],
    )

    const [rows] = await pool.query(
      `
      SELECT id, title, description, announcement_type, event_starts_at, location, status, created_at, updated_at
      FROM announcements WHERE id = ?
    `,
      [result.insertId],
    )

    return res.status(201).json(mapRow(rows[0]))
  } catch (error) {
    if (error && (error.code === 'ER_NO_SUCH_TABLE' || error.errno === 1146)) {
      return res.status(500).json({
        message:
          'Announcements table is missing. Run `backend/database/announcements.sql` on your database.',
      })
    }
    console.error('Create announcement error:', error)
    return res.status(500).json({ message: 'Failed to create announcement' })
  }
}

const updateAnnouncementController = async (req, res) => {
  const id = Number(req.params.id)
  if (!Number.isFinite(id) || id < 1) {
    return res.status(400).json({ message: 'Invalid announcement id' })
  }

  const {
    title,
    description,
    announcementType,
    eventStartsAt,
    location: loc,
    status,
  } = req.body

  if (title !== undefined && !String(title).trim()) {
    return res.status(400).json({ message: 'title cannot be empty' })
  }

  const fields = []
  const values = []

  if (title !== undefined) {
    fields.push('title = ?')
    values.push(String(title).trim())
  }
  if (description !== undefined) {
    fields.push('description = ?')
    values.push(String(description))
  }
  if (announcementType !== undefined) {
    const t = String(announcementType).toLowerCase()
    if (!ALLOWED_TYPES.has(t)) {
      return res.status(400).json({
        message: 'announcementType must be blood_drive, urgent_need, or general',
      })
    }
    fields.push('announcement_type = ?')
    values.push(t)
  }
  if (eventStartsAt !== undefined) {
    fields.push('event_starts_at = ?')
    values.push(eventStartsAt)
  }
  if (loc !== undefined) {
    fields.push('location = ?')
    values.push(String(loc))
  }
  if (status !== undefined) {
    const s = String(status).toLowerCase()
    if (!ALLOWED_STATUS.has(s)) {
      return res.status(400).json({
        message: 'status must be upcoming, ongoing, or completed',
      })
    }
    fields.push('status = ?')
    values.push(s)
  }

  if (fields.length === 0) {
    return res.status(400).json({ message: 'No fields to update' })
  }

  values.push(id)

  try {
    const [result] = await pool.query(
      `UPDATE announcements SET ${fields.join(', ')} WHERE id = ?`,
      values,
    )
    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Announcement not found' })
    }

    const [rows] = await pool.query(
      `
      SELECT id, title, description, announcement_type, event_starts_at, location, status, created_at, updated_at
      FROM announcements WHERE id = ?
    `,
      [id],
    )

    return res.json(mapRow(rows[0]))
  } catch (error) {
    if (error && (error.code === 'ER_NO_SUCH_TABLE' || error.errno === 1146)) {
      return res.status(500).json({
        message:
          'Announcements table is missing. Run `backend/database/announcements.sql` on your database.',
      })
    }
    console.error('Update announcement error:', error)
    return res.status(500).json({ message: 'Failed to update announcement' })
  }
}

const deleteAnnouncementController = async (req, res) => {
  const id = Number(req.params.id)
  if (!Number.isFinite(id) || id < 1) {
    return res.status(400).json({ message: 'Invalid announcement id' })
  }

  try {
    const [result] = await pool.query(`DELETE FROM announcements WHERE id = ?`, [id])
    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Announcement not found' })
    }
    return res.json({ ok: true, id })
  } catch (error) {
    if (error && (error.code === 'ER_NO_SUCH_TABLE' || error.errno === 1146)) {
      return res.status(500).json({
        message:
          'Announcements table is missing. Run `backend/database/announcements.sql` on your database.',
      })
    }
    console.error('Delete announcement error:', error)
    return res.status(500).json({ message: 'Failed to delete announcement' })
  }
}

/** Public list for donors / login (no auth). */
const getPublicAnnouncementsController = async (req, res) => {
  const rawLimit = Number(req.query.limit)
  const limit = Math.min(Math.max(Number.isFinite(rawLimit) && rawLimit > 0 ? rawLimit : 3, 1), 100)
  const statusFilter = req.query.status ? String(req.query.status).toLowerCase() : null
  const activeOnly = req.query.activeOnly !== 'false'
  const sort = String(req.query.sort || 'nearest').toLowerCase()

  let where = '1=1'
  const whereParams = []
  if (activeOnly) {
    where += " AND status IN ('upcoming', 'ongoing')"
  } else if (statusFilter && ALLOWED_STATUS.has(statusFilter)) {
    where += ' AND status = ?'
    whereParams.push(statusFilter)
  }

  let orderSql
  const orderParams = []
  if (sort === 'priority') {
    orderSql =
      'CASE WHEN announcement_type = ? THEN 0 ELSE 1 END ASC, event_starts_at ASC, id ASC'
    orderParams.push('urgent_need')
  } else {
    orderSql = 'event_starts_at ASC, id ASC'
  }

  try {
    await expirePastAnnouncements()

    const [rows] = await pool.query(
      `
      SELECT id, title, description, announcement_type, event_starts_at, location, status, created_at
      FROM announcements
      WHERE ${where}
      ORDER BY ${orderSql}
      LIMIT ?
    `,
      [...whereParams, ...orderParams, limit],
    )
    return res.json(rows.map(mapRow))
  } catch (error) {
    if (error && (error.code === 'ER_NO_SUCH_TABLE' || error.errno === 1146)) {
      return res.json([])
    }
    console.error('Public announcements error:', error)
    return res.status(500).json({ message: 'Failed to fetch announcements' })
  }
}

module.exports = {
  getAnnouncementsController,
  createAnnouncementController,
  updateAnnouncementController,
  deleteAnnouncementController,
  getPublicAnnouncementsController,
}
