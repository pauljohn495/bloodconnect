const { pool } = require('../db')

const mapRow = (row) => ({
  id: row.id,
  title: row.title,
  description: row.description != null ? String(row.description) : '',
  activity_date: row.activity_date
    ? typeof row.activity_date === 'string'
      ? row.activity_date.slice(0, 10)
      : row.activity_date
    : null,
  created_at: row.created_at,
  updated_at: row.updated_at,
})

function parseId(req) {
  const id = Number(req.params.id)
  if (!Number.isFinite(id) || id < 1) return null
  return id
}

const listPrcActivitiesController = async (req, res) => {
  try {
    const upcoming = req.query.upcoming === '1' || req.query.upcoming === 'true'
    const qRaw = req.query.q != null ? String(req.query.q).trim() : ''
    const limitParam = parseInt(req.query.limit, 10)

    let sql = `
      SELECT id, title, description, activity_date, created_at, updated_at
      FROM prc_activities
      WHERE 1=1
    `
    const params = []

    if (upcoming) {
      sql += ` AND activity_date >= CURDATE()`
    }

    if (qRaw) {
      sql += ` AND (title LIKE ? OR description LIKE ?)`
      const like = `%${qRaw}%`
      params.push(like, like)
    }

    if (upcoming) {
      sql += ` ORDER BY activity_date ASC, id ASC`
      const lim = Number.isFinite(limitParam) && limitParam > 0 ? Math.min(limitParam, 50) : 8
      sql += ` LIMIT ?`
      params.push(lim)
    } else {
      sql += ` ORDER BY activity_date ASC, id ASC`
      const lim = Number.isFinite(limitParam) && limitParam > 0 ? Math.min(limitParam, 5000) : 2000
      sql += ` LIMIT ?`
      params.push(lim)
    }

    const [rows] = await pool.query(sql, params)
    return res.json(rows.map(mapRow))
  } catch (error) {
    if (error && (error.code === 'ER_NO_SUCH_TABLE' || error.errno === 1146)) {
      return res.status(500).json({
        message: 'PRC activities table is missing. Restart the server to run schema migration.',
      })
    }
    console.error('listPrcActivitiesController', error)
    return res.status(500).json({ message: 'Failed to load PRC activities' })
  }
}

const createPrcActivityController = async (req, res) => {
  const title = req.body.title != null ? String(req.body.title).trim() : ''
  const description = req.body.description != null ? String(req.body.description) : ''
  const activityDate =
    req.body.activityDate != null
      ? String(req.body.activityDate).trim()
      : req.body.activity_date != null
        ? String(req.body.activity_date).trim()
        : ''

  if (!title) {
    return res.status(400).json({ message: 'title is required' })
  }
  if (!activityDate || !/^\d{4}-\d{2}-\d{2}$/.test(activityDate)) {
    return res.status(400).json({ message: 'activityDate must be YYYY-MM-DD' })
  }

  try {
    const [result] = await pool.query(
      `
      INSERT INTO prc_activities (title, description, activity_date)
      VALUES (?, ?, ?)
    `,
      [title, description, activityDate],
    )

    const [rows] = await pool.query(
      `
      SELECT id, title, description, activity_date, created_at, updated_at
      FROM prc_activities
      WHERE id = ?
    `,
      [result.insertId],
    )

    return res.status(201).json(mapRow(rows[0]))
  } catch (error) {
    if (error && (error.code === 'ER_NO_SUCH_TABLE' || error.errno === 1146)) {
      return res.status(500).json({
        message: 'PRC activities table is missing. Restart the server to run schema migration.',
      })
    }
    console.error('createPrcActivityController', error)
    return res.status(500).json({ message: 'Failed to create activity' })
  }
}

const updatePrcActivityController = async (req, res) => {
  const id = parseId(req)
  if (!id) {
    return res.status(400).json({ message: 'Invalid id' })
  }

  const title = req.body.title != null ? String(req.body.title).trim() : ''
  const description = req.body.description != null ? String(req.body.description) : ''
  const activityDate =
    req.body.activityDate != null
      ? String(req.body.activityDate).trim()
      : req.body.activity_date != null
        ? String(req.body.activity_date).trim()
        : ''

  if (!title) {
    return res.status(400).json({ message: 'title is required' })
  }
  if (!activityDate || !/^\d{4}-\d{2}-\d{2}$/.test(activityDate)) {
    return res.status(400).json({ message: 'activityDate must be YYYY-MM-DD' })
  }

  try {
    const [result] = await pool.query(
      `
      UPDATE prc_activities
      SET title = ?, description = ?, activity_date = ?
      WHERE id = ?
    `,
      [title, description, activityDate, id],
    )

    if (!result.affectedRows) {
      return res.status(404).json({ message: 'Activity not found' })
    }

    const [rows] = await pool.query(
      `
      SELECT id, title, description, activity_date, created_at, updated_at
      FROM prc_activities
      WHERE id = ?
    `,
      [id],
    )

    return res.json(mapRow(rows[0]))
  } catch (error) {
    if (error && (error.code === 'ER_NO_SUCH_TABLE' || error.errno === 1146)) {
      return res.status(500).json({
        message: 'PRC activities table is missing. Restart the server to run schema migration.',
      })
    }
    console.error('updatePrcActivityController', error)
    return res.status(500).json({ message: 'Failed to update activity' })
  }
}

const deletePrcActivityController = async (req, res) => {
  const id = parseId(req)
  if (!id) {
    return res.status(400).json({ message: 'Invalid id' })
  }

  try {
    const [result] = await pool.query('DELETE FROM prc_activities WHERE id = ?', [id])
    if (!result.affectedRows) {
      return res.status(404).json({ message: 'Activity not found' })
    }
    return res.status(204).send()
  } catch (error) {
    if (error && (error.code === 'ER_NO_SUCH_TABLE' || error.errno === 1146)) {
      return res.status(500).json({
        message: 'PRC activities table is missing. Restart the server to run schema migration.',
      })
    }
    console.error('deletePrcActivityController', error)
    return res.status(500).json({ message: 'Failed to delete activity' })
  }
}

module.exports = {
  listPrcActivitiesController,
  createPrcActivityController,
  updatePrcActivityController,
  deletePrcActivityController,
}
