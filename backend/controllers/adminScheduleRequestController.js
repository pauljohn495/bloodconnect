const { pool } = require('../db')

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
        sr.status,
        sr.created_at,
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
        reviewer.full_name AS reviewer_name
      FROM schedule_requests sr
      JOIN users u ON sr.user_id = u.id
      LEFT JOIN users reviewer ON sr.reviewed_by = reviewer.id
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
  try {
    const [requestRows] = await pool.query('SELECT user_id FROM schedule_requests WHERE id = ?', [id])
    if (requestRows.length === 0) {
      return res.status(404).json({ message: 'Schedule request not found' })
    }
    const userId = requestRows[0].user_id

    const [result] = await pool.query(
      `
      UPDATE schedule_requests
      SET status = 'completed',
          reviewed_by = COALESCE(reviewed_by, ?),
          reviewed_at = NOW()
      WHERE id = ?
    `,
      [req.user.id, id],
    )
    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Schedule request not found' })
    }

    await pool.query(
      `
      UPDATE users
      SET last_donation_date = NOW()
      WHERE id = ?
      `,
      [userId],
    )

    await pool.query(
      `
      INSERT INTO notifications (user_id, title, message, type)
      VALUES (?, ?, ?, 'success')
    `,
      [userId, 'Donation Completed', 'Your scheduled donation has been successfully completed. Thank you for your donation!'],
    )

    res.json({ message: 'Schedule request completed successfully' })
  } catch (error) {
    console.error('Complete schedule request error:', error)
    res.status(500).json({ message: 'Failed to complete schedule request' })
  }
}

module.exports = {
  getScheduleRequestsController,
  getScheduleRequestDetailsController,
  approveScheduleRequestController,
  rejectScheduleRequestController,
  completeScheduleRequestController,
}

