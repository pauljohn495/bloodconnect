const { pool } = require('../db')

const normalizeComponentType = (value) => {
  const v = (value || 'whole_blood').toString().toLowerCase()
  if (v === 'platelets') return 'platelets'
  if (v === 'plasma') return 'plasma'
  return 'whole_blood'
}

/** Calendar Y-M-D in the server local timezone (for users.last_donation_date). */
const toYmdLocal = (d) => {
  const dt = new Date(d)
  if (Number.isNaN(dt.getTime())) return null
  const y = dt.getFullYear()
  const m = String(dt.getMonth() + 1).padStart(2, '0')
  const day = String(dt.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

const isValidYmd = (value) => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value.trim())

const getScheduleRequestsController = async (req, res) => {
  try {
    const [rows] = await pool.query(
      `
      SELECT 
        sr.id,
        sr.user_id,
        sr.preferred_date,
        sr.preferred_time,
        sr.component_type,
        sr.requested_blood_type,
        sr.status,
        sr.created_at,
        sr.actual_donation_at,
        sr.units_donated,
        u.full_name AS donor_name,
        u.email,
        u.phone
      FROM schedule_requests sr
      JOIN users u ON sr.user_id = u.id
      ORDER BY sr.created_at DESC
    `,
    )
    const rowsWithComponent = rows.map((row) => ({
      ...row,
      component_type: row.component_type || 'whole_blood',
    }))
    res.json(rowsWithComponent)
  } catch (error) {
    console.error('Fetch schedule requests error:', error)
    res.status(500).json({ message: 'Failed to fetch schedule requests' })
  }
}

const getScheduleRequestDetailsController = async (req, res) => {
  const { id } = req.params
  try {
    const [rows] = await pool.query(
      `
      SELECT 
        sr.*,
        u.full_name AS donor_name,
        u.email,
        u.phone,
        u.blood_type,
        reviewer.full_name AS reviewer_name,
        recorder.full_name AS recorded_by_name
      FROM schedule_requests sr
      JOIN users u ON sr.user_id = u.id
      LEFT JOIN users reviewer ON sr.reviewed_by = reviewer.id
      LEFT JOIN users recorder ON sr.recorded_by = recorder.id
      WHERE sr.id = ?
    `,
      [id],
    )

    if (rows.length === 0) return res.status(404).json({ message: 'Schedule request not found' })

    const request = rows[0]
    if (
      request.health_screening_answers &&
      typeof request.health_screening_answers === 'string'
    ) {
      try {
        request.health_screening_answers = JSON.parse(request.health_screening_answers)
      } catch {
        request.health_screening_answers = {}
      }
    }

    res.json(request)
  } catch (error) {
    console.error('Fetch schedule request details error:', error)
    res.status(500).json({ message: 'Failed to fetch schedule request details' })
  }
}

const approveScheduleRequestController = async (req, res) => {
  const { id } = req.params
  const { adminNotes } = req.body
  try {
    const [requestRows] = await pool.query(
      'SELECT user_id, preferred_date, preferred_time FROM schedule_requests WHERE id = ?',
      [id],
    )
    if (requestRows.length === 0) {
      return res.status(404).json({ message: 'Schedule request not found' })
    }

    const userId = requestRows[0].user_id
    const preferredDate = new Date(requestRows[0].preferred_date).toLocaleDateString()
    const preferredTime = requestRows[0].preferred_time

    const [result] = await pool.query(
      `
      UPDATE schedule_requests
      SET status = 'approved',
          admin_notes = ?,
          reviewed_by = ?,
          reviewed_at = NOW()
      WHERE id = ?
    `,
      [adminNotes || null, req.user.id, id],
    )

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Schedule request not found' })
    }

    await pool.query(
      `
      INSERT INTO notifications (user_id, title, message, type)
      VALUES (?, ?, ?, 'info')
    `,
      [
        userId,
        'Schedule Request Approved',
        `Your schedule request has been approved. Preferred date: ${preferredDate} at ${preferredTime}. ${adminNotes ? `Admin notes: ${adminNotes}` : ''}`,
      ],
    )

    res.json({ message: 'Schedule request approved successfully' })
  } catch (error) {
    console.error('Approve schedule request error:', error)
    res.status(500).json({ message: 'Failed to approve schedule request' })
  }
}

const rejectScheduleRequestController = async (req, res) => {
  const { id } = req.params
  const { rejectionReason } = req.body

  if (!rejectionReason || rejectionReason.trim() === '') {
    return res.status(400).json({ message: 'rejectionReason is required' })
  }

  try {
    const [requestRows] = await pool.query('SELECT user_id FROM schedule_requests WHERE id = ?', [id])
    if (requestRows.length === 0) {
      return res.status(404).json({ message: 'Schedule request not found' })
    }
    const userId = requestRows[0].user_id

    const [result] = await pool.query(
      `
      UPDATE schedule_requests
      SET status = 'rejected',
          rejection_reason = ?,
          reviewed_by = ?,
          reviewed_at = NOW()
      WHERE id = ?
    `,
      [rejectionReason, req.user.id, id],
    )

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Schedule request not found' })
    }

    await pool.query(
      `
      INSERT INTO notifications (user_id, title, message, type)
      VALUES (?, ?, ?, 'warning')
    `,
      [userId, 'Schedule Request Rejected', `Your schedule request was rejected. Reason: ${rejectionReason}`],
    )

    res.json({ message: 'Schedule request rejected successfully' })
  } catch (error) {
    console.error('Reject schedule request error:', error)
    res.status(500).json({ message: 'Failed to reject schedule request' })
  }
}

const completeScheduleRequestController = async (req, res) => {
  const { id } = req.params
  const { unitsDonated, expirationDate: expirationDateRaw } = req.body || {}

  const adminId = req.user?.id || null

  let conn
  try {
    conn = await pool.getConnection()
    await conn.beginTransaction()

    const [rows] = await conn.query(
      `
      SELECT sr.id, sr.user_id, sr.status, sr.component_type,
             sr.requested_blood_type,
             u.blood_type AS donor_blood_type
      FROM schedule_requests sr
      INNER JOIN users u ON sr.user_id = u.id
      WHERE sr.id = ?
      FOR UPDATE
    `,
      [id],
    )

    if (rows.length === 0) {
      await conn.rollback()
      return res.status(404).json({ message: 'Schedule request not found' })
    }

    const row = rows[0]
    if (row.status !== 'approved') {
      await conn.rollback()
      return res
        .status(400)
        .json({ message: 'Only approved appointments can be recorded as donations' })
    }

    const requestedType =
      row.requested_blood_type != null ? String(row.requested_blood_type).trim() : ''
    const isBloodRequestFulfillment = requestedType.length > 0

    if (isBloodRequestFulfillment) {
      const completedAt = new Date()
      if (Number.isNaN(completedAt.getTime())) {
        await conn.rollback()
        return res.status(500).json({ message: 'Could not record completion time' })
      }

      await conn.query(
        `
        UPDATE schedule_requests
        SET status = 'completed',
            reviewed_by = COALESCE(reviewed_by, ?),
            reviewed_at = ?,
            actual_donation_at = NULL,
            units_donated = NULL,
            recorded_by = NULL
        WHERE id = ?
      `,
        [adminId, completedAt, id],
      )

      const userId = row.user_id
      await conn.query(
        `
        INSERT INTO notifications (user_id, title, message, type)
        VALUES (?, ?, ?, 'success')
      `,
        [
          userId,
          'Blood request completed',
          `Your blood request (${requestedType}) has been marked complete.`,
        ],
      )

      await conn.commit()

      return res.json({
        message: 'Blood request marked complete',
        mode: 'blood_request',
        completedAt: completedAt.toISOString(),
      })
    }

    const units = parseInt(String(unitsDonated ?? ''), 10)
    if (Number.isNaN(units) || units < 1 || units > 50) {
      await conn.rollback()
      return res.status(400).json({ message: 'unitsDonated must be between 1 and 50' })
    }

    const expirationYmd = typeof expirationDateRaw === 'string' ? expirationDateRaw.trim() : ''
    if (!isValidYmd(expirationYmd)) {
      await conn.rollback()
      return res.status(400).json({ message: 'expirationDate is required (YYYY-MM-DD)' })
    }

    // Donation / collection time = server time when admin confirms (click)
    const donationAt = new Date()
    if (Number.isNaN(donationAt.getTime())) {
      await conn.rollback()
      return res.status(500).json({ message: 'Could not record donation time' })
    }

    const userId = row.user_id
    const bloodType = row.donor_blood_type
    if (!bloodType) {
      await conn.rollback()
      return res.status(400).json({ message: 'Donor blood type is missing' })
    }

    const componentType = normalizeComponentType(row.component_type)

    const donationYmd = toYmdLocal(donationAt)
    if (!donationYmd) {
      await conn.rollback()
      return res.status(500).json({ message: 'Could not resolve donation date' })
    }

    if (expirationYmd < donationYmd) {
      await conn.rollback()
      return res.status(400).json({ message: 'Expiration date must be on or after the donation date' })
    }

    const maxExp = new Date(donationAt)
    maxExp.setDate(maxExp.getDate() + 400)
    const maxYmd = toYmdLocal(maxExp)
    if (maxYmd && expirationYmd > maxYmd) {
      await conn.rollback()
      return res.status(400).json({ message: 'Expiration date is too far in the future' })
    }

    let inventoryId = null
    try {
      const [invResult] = await conn.query(
        `
        INSERT INTO blood_inventory
          (blood_type, units, available_units, expiration_date, status, added_by, hospital_id, component_type)
        VALUES (?, ?, ?, ?, 'available', ?, NULL, ?)
      `,
        [bloodType, units, units, expirationYmd, adminId, componentType],
      )
      inventoryId = invResult.insertId
    } catch (invErr) {
      if (invErr && (invErr.code === 'ER_BAD_FIELD_ERROR' || invErr.message?.includes('component_type'))) {
        const [invResult2] = await conn.query(
          `
          INSERT INTO blood_inventory
            (blood_type, units, available_units, expiration_date, status, added_by, hospital_id)
          VALUES (?, ?, ?, ?, 'available', ?, NULL)
        `,
          [bloodType, units, units, expirationYmd, adminId],
        )
        inventoryId = invResult2.insertId
      } else {
        throw invErr
      }
    }

    let donationRowId = null
    try {
      const [donResult] = await conn.query(
        `
        INSERT INTO donations (
          user_id, blood_type, donation_date, location, hospital_id, status, units_donated,
          schedule_request_id, recorded_by, component_type, inventory_id
        )
        VALUES (?, ?, ?, NULL, NULL, 'completed', ?, ?, ?, ?, ?)
      `,
        [userId, bloodType, donationAt, units, id, adminId, componentType, inventoryId],
      )
      donationRowId = donResult.insertId
    } catch (donErr) {
      if (
        donErr &&
        (donErr.code === 'ER_BAD_FIELD_ERROR' ||
          donErr.code === 'ER_NO_SUCH_COLUMN' ||
          donErr.message?.includes('schedule_request_id'))
      ) {
        const [donResult2] = await conn.query(
          `
          INSERT INTO donations (user_id, blood_type, donation_date, location, hospital_id, status, units_donated)
          VALUES (?, ?, ?, NULL, NULL, 'completed', ?)
        `,
          [userId, bloodType, donationAt, units],
        )
        donationRowId = donResult2.insertId
      } else {
        throw donErr
      }
    }

    await conn.query(
      `
      UPDATE schedule_requests
      SET status = 'completed',
          reviewed_by = COALESCE(reviewed_by, ?),
          reviewed_at = ?,
          actual_donation_at = ?,
          units_donated = ?,
          recorded_by = ?
      WHERE id = ?
    `,
      [adminId, donationAt, donationAt, units, adminId, id],
    )

    await conn.query(`UPDATE users SET last_donation_date = ? WHERE id = ?`, [donationYmd, userId])

    await conn.query(
      `
      INSERT INTO notifications (user_id, title, message, type)
      VALUES (?, ?, ?, 'success')
    `,
      [
        userId,
        'Donation recorded',
        `Your donation of ${units} unit(s) was recorded. Thank you for saving lives!`,
      ],
    )

    await conn.commit()

    return res.json({
      message: 'Donation recorded and inventory updated',
      donationId: donationRowId,
      inventoryId,
      actualDonationAt: donationAt.toISOString(),
      expirationDate: expirationYmd,
      unitsDonated: units,
    })
  } catch (error) {
    if (conn) await conn.rollback()
    console.error('Complete schedule request error:', error)
    if (error && error.code === 'ER_BAD_FIELD_ERROR' && error.message?.includes('actual_donation_at')) {
      return res.status(500).json({
        message:
          'Database schema is outdated. Restart the server to run migrations (schedule donation columns).',
      })
    }
    return res.status(500).json({ message: 'Failed to record donation' })
  } finally {
    if (conn) conn.release()
  }
}

module.exports = {
  getScheduleRequestsController,
  getScheduleRequestDetailsController,
  approveScheduleRequestController,
  rejectScheduleRequestController,
  completeScheduleRequestController,
}

