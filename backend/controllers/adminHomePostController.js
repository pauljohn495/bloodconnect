const { pool } = require('../db')

const ALLOWED_CATEGORIES = new Set(['top_donors', 'top_organizers', 'top_municipality'])
const IMAGE_DATA_URL_PATTERN = /^data:image\/(?:png|jpe?g|webp|gif);base64,/i
const MAX_IMAGES = 8
const MAX_IMAGE_LENGTH = 3_000_000
const MAX_TOTAL_IMAGE_LENGTH = 12_000_000

function validateImageUrls(raw) {
  if (raw === undefined) return []
  if (!Array.isArray(raw)) return null
  if (raw.length > MAX_IMAGES) return null

  let totalLength = 0
  for (const value of raw) {
    if (typeof value !== 'string') return null
    totalLength += value.length
    const validDataImage = value.length <= MAX_IMAGE_LENGTH && IMAGE_DATA_URL_PATTERN.test(value)
    const validRemoteImage = value.length <= 2048 && /^https?:\/\//i.test(value)
    if ((!validDataImage && !validRemoteImage) || totalLength > MAX_TOTAL_IMAGE_LENGTH) return null
  }
  return raw
}

/**
 * Parse image_urls from DB (stored as JSON array string or null).
 * Returns an array of data URL strings.
 */
function parseImageUrls(raw) {
  if (!raw) return []
  if (Array.isArray(raw)) return raw
  try {
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

const mapPost = (row) => ({
  id: row.id,
  category: row.category,
  title: row.title,
  body: row.body,
  image_urls: parseImageUrls(row.image_urls),
  is_published: !!row.is_published,
  created_at: row.created_at,
  updated_at: row.updated_at,
})

const getHomePostsController = async (req, res) => {
  try {
    const [rows] = await pool.query(
      `
      SELECT id, category, title, body, image_urls, is_published, created_at, updated_at
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

  // imageUrls: array of base64 data URL strings
  const imageUrlsRaw = req.body?.imageUrls
  const imageUrls = validateImageUrls(imageUrlsRaw)
  if (!imageUrls) return res.status(400).json({ message: `imageUrls must contain at most ${MAX_IMAGES} supported images` })
  const imageUrlsJson = imageUrls.length > 0 ? JSON.stringify(imageUrls) : null

  if (!title) return res.status(400).json({ message: 'title is required' })
  if (title.length > 255) return res.status(400).json({ message: 'title must be 255 characters or fewer' })
  if (!body.trim()) return res.status(400).json({ message: 'body is required' })
  if (body.length > 50_000) return res.status(400).json({ message: 'body must be 50,000 characters or fewer' })

  try {
    const [result] = await pool.query(
      `
      INSERT INTO home_posts (category, title, body, image_urls, is_published)
      VALUES (?, ?, ?, ?, ?)
    `,
      [category, title, body, imageUrlsJson, isPublished],
    )
    const [rows] = await pool.query(
      `
      SELECT id, category, title, body, image_urls, is_published, created_at, updated_at
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
  if (!Number.isSafeInteger(id) || id < 1) return res.status(400).json({ message: 'Invalid post id' })

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
    if (title.length > 255) return res.status(400).json({ message: 'title must be 255 characters or fewer' })
    fields.push('title = ?')
    values.push(title)
  }

  if (req.body?.body !== undefined) {
    const body = String(req.body.body)
    if (!body.trim()) return res.status(400).json({ message: 'body cannot be empty' })
    if (body.length > 50_000) return res.status(400).json({ message: 'body must be 50,000 characters or fewer' })
    fields.push('body = ?')
    values.push(body)
  }

  if (req.body?.imageUrls !== undefined) {
    const imageUrls = validateImageUrls(req.body.imageUrls)
    if (!imageUrls) return res.status(400).json({ message: `imageUrls must contain at most ${MAX_IMAGES} supported images` })
    fields.push('image_urls = ?')
    values.push(imageUrls.length > 0 ? JSON.stringify(imageUrls) : null)
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
      SELECT id, category, title, body, image_urls, is_published, created_at, updated_at
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
  if (!Number.isSafeInteger(id) || id < 1) return res.status(400).json({ message: 'Invalid post id' })

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
    // Return up to 6 most recent published posts for the landing page
    const requestedLimit = Number.parseInt(String(req.query?.limit || '6'), 10)
    const limit = Math.min(Math.max(Number.isFinite(requestedLimit) ? requestedLimit : 6, 1), 20)
    const [rows] = await pool.query(
      `
      SELECT id, category, title, body, image_urls, is_published, created_at, updated_at
      FROM home_posts
      WHERE is_published = 1
      ORDER BY created_at DESC
      LIMIT ?
    `,
      [limit],
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
