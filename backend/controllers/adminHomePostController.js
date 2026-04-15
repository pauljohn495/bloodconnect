const { pool } = require('../db')

const ALLOWED_CATEGORIES = new Set(['top_donors', 'top_organizers', 'top_municipality'])

const mapPost = (row) => ({
  id: row.id,
  category: row.category,
  title: row.title,
  body: row.body,
  is_published: !!row.is_published,
  created_at: row.created_at,
  updated_at: row.updated_at,
})

const getHomePostsController = async (req, res) => {
  try {
    const [rows] = await pool.query(
      `
      SELECT id, category, title, body, is_published, created_at, updated_at
      FROM home_posts
      ORDER BY FIELD(category, 'top_donors', 'top_organizers', 'top_municipality'), updated_at DESC
    `,
    )
    return res.json(rows.map(mapPost))
  } catch (error) {
    if (error && (error.code === 'ER_NO_SUCH_TABLE' || error.errno === 1146)) {
      return res.json([])
    }
    console.error('List home posts error:', error)
    return res.status(500).json({ message: 'Failed to fetch posts' })
  }
}

const createHomePostController = async (req, res) => {
  const categoryInput = String(req.body?.category || '').toLowerCase().trim()
  const category = ALLOWED_CATEGORIES.has(categoryInput) ? categoryInput : 'top_donors'
  const title = String(req.body?.title || '').trim()
  const body = String(req.body?.body || '')
  const isPublished = req.body?.isPublished ? 1 : 0

  if (!title) return res.status(400).json({ message: 'title is required' })
  if (!body.trim()) return res.status(400).json({ message: 'body is required' })

  try {
    const [result] = await pool.query(
      `
      INSERT INTO home_posts (category, title, body, is_published)
      VALUES (?, ?, ?, ?)
    `,
      [category, title, body, isPublished],
    )
    const [rows] = await pool.query(
      `
      SELECT id, category, title, body, is_published, created_at, updated_at
      FROM home_posts
      WHERE id = ?
    `,
      [result.insertId],
    )
    return res.status(201).json(mapPost(rows[0]))
  } catch (error) {
    console.error('Create home post error:', error)
    return res.status(500).json({ message: 'Failed to create post' })
  }
}

const updateHomePostController = async (req, res) => {
  const id = Number(req.params.id)
  if (!Number.isFinite(id) || id < 1) return res.status(400).json({ message: 'Invalid post id' })

  const fields = []
  const values = []

  if (req.body?.category !== undefined) {
    const category = String(req.body.category).toLowerCase().trim()
    if (!ALLOWED_CATEGORIES.has(category)) {
      return res.status(400).json({ message: 'category must be top_donors, top_organizers, or top_municipality' })
    }
    fields.push('category = ?')
    values.push(category)
  }

  if (req.body?.title !== undefined) {
    const title = String(req.body.title).trim()
    if (!title) return res.status(400).json({ message: 'title cannot be empty' })
    fields.push('title = ?')
    values.push(title)
  }

  if (req.body?.body !== undefined) {
    const body = String(req.body.body)
    if (!body.trim()) return res.status(400).json({ message: 'body cannot be empty' })
    fields.push('body = ?')
    values.push(body)
  }

  if (req.body?.isPublished !== undefined) {
    fields.push('is_published = ?')
    values.push(req.body.isPublished ? 1 : 0)
  }

  if (fields.length === 0) return res.status(400).json({ message: 'No fields to update' })

  values.push(id)
  try {
    const [result] = await pool.query(
      `UPDATE home_posts SET ${fields.join(', ')} WHERE id = ?`,
      values,
    )
    if (!result.affectedRows) return res.status(404).json({ message: 'Post not found' })
    const [rows] = await pool.query(
      `
      SELECT id, category, title, body, is_published, created_at, updated_at
      FROM home_posts
      WHERE id = ?
    `,
      [id],
    )
    return res.json(mapPost(rows[0]))
  } catch (error) {
    console.error('Update home post error:', error)
    return res.status(500).json({ message: 'Failed to update post' })
  }
}

const deleteHomePostController = async (req, res) => {
  const id = Number(req.params.id)
  if (!Number.isFinite(id) || id < 1) return res.status(400).json({ message: 'Invalid post id' })

  try {
    const [result] = await pool.query('DELETE FROM home_posts WHERE id = ?', [id])
    if (!result.affectedRows) return res.status(404).json({ message: 'Post not found' })
    return res.json({ ok: true, id })
  } catch (error) {
    console.error('Delete home post error:', error)
    return res.status(500).json({ message: 'Failed to delete post' })
  }
}

const getPublicHomePostsController = async (req, res) => {
  try {
    const [rows] = await pool.query(
      `
      SELECT id, category, title, body, is_published, created_at, updated_at
      FROM home_posts
      WHERE is_published = 1
      ORDER BY FIELD(category, 'top_donors', 'top_organizers', 'top_municipality'), updated_at DESC
    `,
    )
    return res.json(rows.map(mapPost))
  } catch (error) {
    if (error && (error.code === 'ER_NO_SUCH_TABLE' || error.errno === 1146)) {
      return res.json([])
    }
    console.error('Public home posts error:', error)
    return res.status(500).json({ message: 'Failed to fetch home posts' })
  }
}

module.exports = {
  getHomePostsController,
  createHomePostController,
  updateHomePostController,
  deleteHomePostController,
  getPublicHomePostsController,
}
