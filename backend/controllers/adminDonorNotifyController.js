const { pool } = require('../db')
const { successResponse } = require('../utils/response')
const { insertNotificationsBulk } = require('../models/notificationModel')

const WHOLE_BLOOD_COOLDOWN_DAYS = 90
const VALID_BLOOD_TYPES = new Set(['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'])

function normalizeBloodTypesInput(raw) {
  if (raw == null) return null
  if (!Array.isArray(raw)) {
    const err = new Error('bloodTypes must be an array or null')
    err.statusCode = 400
    throw err
  }
  const out = [...new Set(raw.map((t) => String(t || '').trim().toUpperCase()).filter(Boolean))]
  for (const t of out) {
    if (!VALID_BLOOD_TYPES.has(t)) {
      const err = new Error(`Invalid blood type: ${t}`)
      err.statusCode = 400
      throw err
    }
  }
  if (out.length === 0) return null
  return out
}

function buildRecipientSql(eligibleOnly, bloodTypes) {
  const conditions = [`u.role = 'donor'`, `u.status = 'active'`]
  const params = []
  if (eligibleOnly) {
    conditions.push(
      `(u.last_donation_date IS NULL OR DATE_ADD(u.last_donation_date, INTERVAL ${WHOLE_BLOOD_COOLDOWN_DAYS} DAY) <= CURDATE())`,
    )
  }
  if (bloodTypes && bloodTypes.length > 0) {
    const ph = bloodTypes.map(() => '?').join(', ')
    conditions.push(`UPPER(TRIM(u.blood_type)) IN (${ph})`)
    params.push(...bloodTypes)
  }
  return { whereSql: conditions.join(' AND '), params }
}

async function previewDonorNotifyController(req, res, next) {
  try {
    const eligibleOnly = req.body?.eligibleOnly !== false
    const bloodTypes = normalizeBloodTypesInput(req.body?.bloodTypes ?? null)

    const { whereSql, params } = buildRecipientSql(eligibleOnly, bloodTypes)
    const [rows] = await pool.query(`SELECT COUNT(*) AS c FROM users u WHERE ${whereSql}`, params)
    return successResponse(res, {
      message: 'Recipient count computed',
      data: { count: Number(rows[0]?.c || 0) },
    })
  } catch (e) {
    return next(e)
  }
}

async function sendDonorNotifyController(req, res, next) {
  const title = typeof req.body?.title === 'string' ? req.body.title.trim() : ''
  const message = typeof req.body?.message === 'string' ? req.body.message.trim() : ''
  const eligibleOnly = req.body?.eligibleOnly !== false
  let bloodTypes
  try {
    bloodTypes = normalizeBloodTypesInput(req.body?.bloodTypes ?? null)
  } catch (e) {
    return next(e)
  }

  if (!title || title.length > 255) {
    const err = new Error('Message title is required (max 255 characters)')
    err.statusCode = 400
    return next(err)
  }
  if (!message || message.length > 8000) {
    const err = new Error('Message content is required (max 8000 characters)')
    err.statusCode = 400
    return next(err)
  }

  const adminId = req.user?.id || null
  const sentByName =
    (req.user?.fullName && String(req.user.fullName).trim()) ||
    (req.user?.email && String(req.user.email).trim()) ||
    (adminId ? `Admin #${adminId}` : 'Admin')

  const { whereSql, params } = buildRecipientSql(eligibleOnly, bloodTypes)

  let conn
  try {
    conn = await pool.getConnection()
    await conn.beginTransaction()

    const [idRows] = await conn.query(`SELECT u.id FROM users u WHERE ${whereSql}`, params)
    const userIds = idRows.map((r) => r.id)

    if (userIds.length === 0) {
      await conn.rollback()
      const err = new Error('No recipients match your criteria. Adjust filters or blood types and try again.')
      err.statusCode = 400
      return next(err)
    }

    await insertNotificationsBulk(userIds, title, message, 'info', conn)

    const bloodJson =
      bloodTypes && bloodTypes.length > 0 ? JSON.stringify(bloodTypes) : null

    await conn.query(
      `
      INSERT INTO donor_notification_broadcasts
        (title, message, sent_by_user_id, sent_by_name, recipient_count, eligible_only, blood_types_json)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `,
      [title, message, adminId, sentByName, userIds.length, eligibleOnly ? 1 : 0, bloodJson],
    )

    await conn.commit()

    return successResponse(res, {
      message: 'Notifications sent successfully',
      data: {
        recipientCount: userIds.length,
        title,
      },
    })
  } catch (e) {
    if (conn) await conn.rollback()
    return next(e)
  } finally {
    if (conn) conn.release()
  }
}

async function listDonorNotifyHistoryController(req, res, next) {
  try {
    const limit = Math.min(Number.parseInt(String(req.query?.limit || '50'), 10) || 50, 100)
    const [rows] = await pool.query(
      `
      SELECT id, title, message, sent_by_name, recipient_count, eligible_only, blood_types_json, created_at
      FROM donor_notification_broadcasts
      ORDER BY created_at DESC
      LIMIT ?
    `,
      [limit],
    )

    const data = rows.map((r) => ({
      id: r.id,
      title: r.title,
      message: r.message,
      sentBy: r.sent_by_name || '—',
      totalRecipients: Number(r.recipient_count || 0),
      eligibleOnly: Boolean(r.eligible_only),
      bloodTypes: (() => {
        if (!r.blood_types_json) return null
        try {
          const p = JSON.parse(r.blood_types_json)
          return Array.isArray(p) ? p : null
        } catch {
          return null
        }
      })(),
      createdAt: r.created_at ? new Date(r.created_at).toISOString() : null,
    }))

    return successResponse(res, {
      message: 'Broadcast history loaded',
      data,
    })
  } catch (e) {
    return next(e)
  }
}

module.exports = {
  previewDonorNotifyController,
  sendDonorNotifyController,
  listDonorNotifyHistoryController,
}
