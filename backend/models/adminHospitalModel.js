const { pool } = require('../db')

async function getDashboardSummary() {
  const [[bloodStockRows], [donorSummaryRows], [pendingRequestsRows], [countsRows]] =
    await Promise.all([
      pool.query('SELECT * FROM v_blood_stock_summary'),
      pool.query(`
        SELECT 
          u.blood_type,
          COUNT(*) AS donor_count,
          MAX(u.last_donation_date) AS last_donation_date
        FROM users u
        WHERE u.role = 'donor'
        GROUP BY u.blood_type
      `),
      pool.query('SELECT * FROM v_pending_requests_summary'),
      pool.query(`
        SELECT
          (SELECT COUNT(*) FROM hospitals WHERE is_active = TRUE) AS partnerHospitals,
          (SELECT COUNT(*) FROM users WHERE role = 'donor') AS totalDonors,
          (SELECT COUNT(*) FROM blood_requests WHERE status = 'pending') AS pendingRequests,
          (SELECT COUNT(*) FROM donations WHERE status = 'completed') + 
          COALESCE((SELECT SUM(units_transferred) FROM blood_transfers), 0) AS completedDonations
      `),
    ])

  return {
    bloodStock: bloodStockRows,
    donorSummary: donorSummaryRows,
    pendingRequestsSummary: pendingRequestsRows,
    counts: countsRows[0] || {},
  }
}

async function getHospitalsWithRequests() {
  const [rows] = await pool.query(
    `
    SELECT
      h.id,
      h.hospital_name,
      h.latitude,
      h.longitude,
      h.is_active,
      h.created_at,
      u.username,
      u.email,
      COALESCE(
        (
          SELECT SUM(bi.available_units)
          FROM blood_inventory bi
          WHERE bi.hospital_id = h.id
            AND bi.status = 'available'
            AND bi.expiration_date > CURDATE()
        ),
        0
      ) AS total_available_units,
      COALESCE(
        (
          SELECT SUM(bt.units_transferred)
          FROM blood_transfers bt
          WHERE bt.hospital_id = h.id
        ),
        0
      ) AS total_donated_units
    FROM hospitals h
    LEFT JOIN users u ON h.user_id = u.id
    ORDER BY h.created_at DESC
  `,
  )

  const [approvedRequests] = await pool.query(
    `
    SELECT 
      br.id,
      br.hospital_id,
      br.blood_type,
      COALESCE(br.component_type, 'whole_blood') as component_type,
      br.units_requested,
      br.units_approved,
      br.status,
      br.request_date,
      COALESCE(
        (
          SELECT SUM(bt.units_transferred)
          FROM blood_transfers bt
          WHERE bt.hospital_id = br.hospital_id
            AND bt.blood_type COLLATE utf8mb4_unicode_ci = br.blood_type COLLATE utf8mb4_unicode_ci
            AND bt.transfer_date >= br.request_date
        ),
        0
      ) as units_fulfilled
    FROM blood_requests br
    WHERE br.status IN ('approved', 'partially_fulfilled')
    ORDER BY br.hospital_id, br.request_date ASC
  `,
  )

  const requestsWithFulfillment = approvedRequests.map((req) => {
    const unitsFulfilled = req.units_fulfilled || 0
    const unitsRequested = req.units_requested || 0
    const remainingBalance = Math.max(0, unitsRequested - unitsFulfilled)
    const isFullyFulfilled = remainingBalance === 0
    const isPartiallyFulfilled = unitsFulfilled > 0 && remainingBalance > 0

    return {
      ...req,
      unitsFulfilled,
      remainingBalance,
      isFullyFulfilled,
      isPartiallyFulfilled,
    }
  })

  const requestedBloodMap = {}
  requestsWithFulfillment.forEach((req) => {
    if (!requestedBloodMap[req.hospital_id]) {
      requestedBloodMap[req.hospital_id] = []
    }
    requestedBloodMap[req.hospital_id].push({
      requestId: req.id,
      bloodType: req.blood_type,
      componentType: req.component_type || 'whole_blood',
      unitsRequested: req.units_requested,
      unitsFulfilled: req.unitsFulfilled,
      remainingBalance: req.remainingBalance,
      status: req.isFullyFulfilled
        ? 'fulfilled'
        : req.isPartiallyFulfilled
        ? 'partially_fulfilled'
        : 'approved',
      requestDate: req.request_date,
    })
  })

  const hospitalsWithRequests = rows.map((hospital) => ({
    ...hospital,
    requestedBlood: requestedBloodMap[hospital.id] || null,
  }))

  return hospitalsWithRequests || []
}

async function createHospital({
  hospitalName,
  username,
  email,
  password,
  latitude,
  longitude,
  createdByUserId,
}) {
  const bcrypt = require('bcryptjs')

  const [existingUsers] = await pool.query(
    `
    SELECT id, username, email FROM users 
    WHERE username = ? OR email = ?
  `,
    [username, email],
  )

  if (existingUsers.length > 0) {
    const existing = existingUsers[0]
    if (existing.username === username) {
      const error = new Error('Username already exists')
      error.statusCode = 400
      throw error
    }
    if (existing.email === email) {
      const error = new Error('Email already exists')
      error.statusCode = 400
      throw error
    }
  }

  if (existingUsers.length > 0) {
    const [existingHospital] = await pool.query(
      `
      SELECT id FROM hospitals WHERE user_id = ?
    `,
      [existingUsers[0].id],
    )
    if (existingHospital.length > 0) {
      const error = new Error('User already has a hospital account')
      error.statusCode = 400
      throw error
    }
  }

  const passwordHash = await bcrypt.hash(password, 10)

  const conn = await pool.getConnection()
  try {
    await conn.beginTransaction()

    const [checkUsers] = await conn.query(
      `
      SELECT id FROM users WHERE username = ? OR email = ?
    `,
      [username, email],
    )

    if (checkUsers.length > 0) {
      await conn.rollback()
      const error = new Error('Username or email already exists')
      error.statusCode = 400
      throw error
    }

    const [userResult] = await conn.query(
      `
      INSERT INTO users (username, email, password_hash, role, full_name)
      VALUES (?, ?, ?, 'hospital', ?)
    `,
      [username, email, passwordHash, hospitalName],
    )

    const userId = userResult.insertId

    const [checkHospital] = await conn.query(
      `
      SELECT id FROM hospitals WHERE user_id = ?
    `,
      [userId],
    )

    if (checkHospital.length > 0) {
      await conn.rollback()
      const error = new Error('Hospital record already exists for this user')
      error.statusCode = 400
      throw error
    }

    const [hospitalResult] = await conn.query(
      `
      INSERT INTO hospitals (user_id, hospital_name, latitude, longitude, created_by)
      VALUES (?, ?, ?, ?, ?)
    `,
      [userId, hospitalName, Number(latitude), Number(longitude), createdByUserId],
    )

    await conn.commit()

    return {
      id: hospitalResult.insertId,
      userId,
      hospitalName,
      latitude: Number(latitude),
      longitude: Number(longitude),
    }
  } catch (error) {
    await conn.rollback()

    if (error.code === 'ER_DUP_ENTRY') {
      const friendlyError = new Error('Duplicate entry. This record may already exist.')
      friendlyError.statusCode = 400
      throw friendlyError
    }

    throw error
  } finally {
    conn.release()
  }
}

async function getHospitalWithUserId(hospitalId) {
  const [rows] = await pool.query('SELECT user_id FROM hospitals WHERE id = ? LIMIT 1', [hospitalId])
  return rows[0] || null
}

async function updateHospital({ hospitalId, hospitalName, email, username, password, latitude, longitude }) {
  const hospital = await getHospitalWithUserId(hospitalId)
  if (!hospital) {
    const error = new Error('Hospital not found')
    error.statusCode = 404
    throw error
  }

  const conn = await pool.getConnection()
  try {
    await conn.beginTransaction()

    if (password && password.trim() !== '') {
      const bcrypt = require('bcryptjs')
      const passwordHash = await bcrypt.hash(password, 10)
      await conn.query(
        'UPDATE users SET username = ?, email = ?, password_hash = ?, full_name = ? WHERE id = ?',
        [username, email, passwordHash, hospitalName, hospital.user_id],
      )
    } else {
      await conn.query(
        'UPDATE users SET username = ?, email = ?, full_name = ? WHERE id = ?',
        [username, email, hospitalName, hospital.user_id],
      )
    }

    await conn.query('UPDATE hospitals SET hospital_name = ?, latitude = ?, longitude = ? WHERE id = ?', [
      hospitalName,
      Number(latitude),
      Number(longitude),
      hospitalId,
    ])

    await conn.commit()
  } catch (error) {
    await conn.rollback()
    throw error
  } finally {
    conn.release()
  }
}

async function deleteHospital(hospitalId) {
  const hospital = await getHospitalWithUserId(hospitalId)
  if (!hospital) {
    const error = new Error('Hospital not found')
    error.statusCode = 404
    throw error
  }

  const userId = hospital.user_id
  const conn = await pool.getConnection()
  try {
    await conn.beginTransaction()

    // Remove dependent rows that reference this hospital, then the hospital row, then the login user.
    // Deleting the user first fails while hospitals.user_id still references users.id.
    await conn.query('DELETE FROM hospital_donations WHERE hospital_id = ?', [hospitalId])
    await conn.query('DELETE FROM blood_transfers WHERE hospital_id = ?', [hospitalId])
    await conn.query('DELETE FROM blood_requests WHERE hospital_id = ?', [hospitalId])
    await conn.query('DELETE FROM blood_inventory WHERE hospital_id = ?', [hospitalId])

    try {
      await conn.query('UPDATE donations SET hospital_id = NULL WHERE hospital_id = ?', [hospitalId])
    } catch (err) {
      if (err.code === 'ER_BAD_FIELD_ERROR') {
        /* column missing in older schemas */
      } else if (err.code === 'ER_BAD_NULL_ERROR') {
        await conn.query('UPDATE donations SET hospital_id = 0 WHERE hospital_id = ?', [hospitalId])
      } else {
        throw err
      }
    }

    await conn.query('DELETE FROM hospitals WHERE id = ?', [hospitalId])
    await conn.query('DELETE FROM users WHERE id = ?', [userId])

    await conn.commit()
  } catch (err) {
    await conn.rollback()
    throw err
  } finally {
    conn.release()
  }
}

module.exports = {
  getDashboardSummary,
  getHospitalsWithRequests,
  createHospital,
  updateHospital,
  deleteHospital,
}

