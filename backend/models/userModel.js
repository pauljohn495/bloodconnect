const { pool } = require('../db')

async function getUserById(userId) {
  const [rows] = await pool.query(
    `
    SELECT id, username, email, role, full_name, phone, blood_type, status, created_at, updated_at, last_donation_date,
           profile_image_url, is_manual_donor, pending_profile_json, profile_update_requested_at
    FROM users
    WHERE id = ?
  `,
    [userId],
  )
  return rows[0] || null
}

async function setPendingDonorProfile(userId, { fullName, phone, bloodType, profileImageUrl }) {
  const snapshot = {
    fullName: fullName ?? null,
    phone: phone ?? null,
    bloodType: bloodType ?? null,
    profileImageUrl: profileImageUrl !== undefined ? profileImageUrl : null,
  }
  const [result] = await pool.query(
    `
    UPDATE users
    SET pending_profile_json = ?, profile_update_requested_at = NOW()
    WHERE id = ? AND role = 'donor'
  `,
    [JSON.stringify(snapshot), userId],
  )
  return result.affectedRows > 0
}

async function approvePendingDonorProfile(donorId) {
  const conn = await pool.getConnection()
  try {
    await conn.beginTransaction()
    const [rows] = await conn.query(
      `SELECT pending_profile_json FROM users WHERE id = ? AND role = 'donor' FOR UPDATE`,
      [donorId],
    )
    if (rows.length === 0) {
      await conn.rollback()
      return { ok: false, code: 'NOT_FOUND' }
    }
    const pendingRaw = rows[0].pending_profile_json
    if (!pendingRaw) {
      await conn.rollback()
      return { ok: false, code: 'NO_PENDING' }
    }
    let pending
    try {
      pending = JSON.parse(pendingRaw)
    } catch {
      await conn.rollback()
      return { ok: false, code: 'INVALID_PENDING' }
    }
    const newPhone = pending.phone
    if (newPhone) {
      const [conflict] = await conn.query(
        `SELECT id FROM users WHERE phone = ? AND id <> ? LIMIT 1`,
        [newPhone, donorId],
      )
      if (conflict.length > 0) {
        await conn.rollback()
        return { ok: false, code: 'PHONE_TAKEN' }
      }
    }
    await conn.query(
      `
      UPDATE users
      SET full_name = ?,
          phone = ?,
          blood_type = ?,
          profile_image_url = ?,
          pending_profile_json = NULL,
          profile_update_requested_at = NULL
      WHERE id = ? AND role = 'donor'
    `,
      [
        pending.fullName ?? null,
        pending.phone ?? null,
        pending.bloodType ?? null,
        pending.profileImageUrl ?? null,
        donorId,
      ],
    )
    await conn.commit()
    return { ok: true }
  } catch (error) {
    await conn.rollback()
    throw error
  } finally {
    conn.release()
  }
}

async function rejectPendingDonorProfile(donorId) {
  const [result] = await pool.query(
    `
    UPDATE users
    SET pending_profile_json = NULL, profile_update_requested_at = NULL
    WHERE id = ? AND role = 'donor' AND pending_profile_json IS NOT NULL
  `,
    [donorId],
  )
  return result.affectedRows > 0
}

async function updateUserProfile(userId, { fullName, phone, bloodType, profileImageUrl }) {
  const sets = []
  const vals = []
  if (fullName !== undefined) {
    sets.push('full_name = COALESCE(?, full_name)')
    vals.push(fullName ?? null)
  }
  if (phone !== undefined) {
    sets.push('phone = COALESCE(?, phone)')
    vals.push(phone ?? null)
  }
  if (bloodType !== undefined) {
    sets.push('blood_type = COALESCE(?, blood_type)')
    vals.push(bloodType ?? null)
  }
  if (profileImageUrl !== undefined) {
    sets.push('profile_image_url = ?')
    vals.push(profileImageUrl || null)
  }
  if (sets.length === 0) return false
  vals.push(userId)
  const [result] = await pool.query(`UPDATE users SET ${sets.join(', ')} WHERE id = ?`, vals)
  return result.affectedRows > 0
}

async function getUserDonations(userId) {
  const [rows] = await pool.query(
    `
    SELECT id, blood_type, donation_date, location, hospital_id, status, units_donated
    FROM donations
    WHERE user_id = ?
    ORDER BY donation_date DESC
  `,
    [userId],
  )
  return rows
}

async function getUserBloodAvailability(userId) {
  const [userRows] = await pool.query(
    'SELECT blood_type FROM users WHERE id = ?',
    [userId],
  )

  const bloodType = userRows[0]?.blood_type
  if (!bloodType) {
    return {
      bloodType: null,
      totalAvailable: 0,
      nearExpiry: 0,
    }
  }

  const [rows] = await pool.query(
    `
    SELECT 
      blood_type,
      COALESCE(SUM(available_units), 0) AS total_available,
      COALESCE(
        SUM(
          CASE 
            WHEN DATEDIFF(expiration_date, CURDATE()) <= 7 
                 AND DATEDIFF(expiration_date, CURDATE()) > 0 
            THEN available_units 
            ELSE 0 
          END
        ),
        0
      ) AS near_expiry_units
    FROM blood_inventory
    WHERE blood_type = ?
      AND status = 'available'
      AND expiration_date > CURDATE()
      AND (hospital_id IS NULL OR hospital_id = 0)
    GROUP BY blood_type
  `,
    [bloodType],
  )

  const summary = rows[0] || { blood_type: bloodType, total_available: 0, near_expiry_units: 0 }

  return {
    bloodType: summary.blood_type,
    totalAvailable: Number(summary.total_available || 0),
    nearExpiry: Number(summary.near_expiry_units || 0),
  }
}

async function getDonationEligibility(userId, cooldowns) {
  const [rows] = await pool.query(
    `
    SELECT 
      COALESCE(component_type, 'whole_blood') AS component_type,
      MAX(actual_donation_at) AS last_completed_at
    FROM schedule_requests
    WHERE user_id = ? 
      AND status = 'completed'
      AND actual_donation_at IS NOT NULL
    GROUP BY COALESCE(component_type, 'whole_blood')
  `,
    [userId],
  )

  const now = new Date()

  const base = {
    whole_blood: { componentType: 'whole_blood', cooldownDays: cooldowns.whole_blood, lastCompletedAt: null },
    platelets: { componentType: 'platelets', cooldownDays: cooldowns.platelets, lastCompletedAt: null },
    plasma: { componentType: 'plasma', cooldownDays: cooldowns.plasma, lastCompletedAt: null },
  }

  rows.forEach((row) => {
    const key = row.component_type || 'whole_blood'
    if (base[key]) {
      base[key].lastCompletedAt = row.last_completed_at
    }
  })

  const result = {}

  Object.values(base).forEach((entry) => {
    const { componentType, cooldownDays, lastCompletedAt } = entry
    let isEligible = true
    let nextEligibleAt = null

    if (lastCompletedAt && cooldownDays && cooldownDays > 0) {
      const last = new Date(lastCompletedAt)
      const next = new Date(last)
      next.setDate(next.getDate() + cooldownDays)

      if (next > now) {
        isEligible = false
        nextEligibleAt = next.toISOString()
      }
    }

    result[componentType] = {
      componentType,
      cooldownDays,
      lastCompletedAt: lastCompletedAt ? new Date(lastCompletedAt).toISOString() : null,
      isEligible,
      nextEligibleAt,
    }
  })

  return result
}

async function getUserScheduleRequests(userId) {
  const [rows] = await pool.query(
    `
    SELECT 
      id,
      preferred_date,
      preferred_time,
      component_type,
      requested_blood_type,
      last_donation_date,
      weight,
      health_screening_answers,
      notes,
      status,
      admin_notes,
      rejection_reason,
      reviewed_at,
      actual_donation_at,
      units_donated,
      created_at
    FROM schedule_requests
    WHERE user_id = ?
    ORDER BY created_at DESC
  `,
    [userId],
  )
  return rows
}

async function hasPendingScheduleRequest(userId) {
  const [rows] = await pool.query(
    'SELECT id FROM schedule_requests WHERE user_id = ? AND status = ?',
    [userId, 'pending'],
  )
  return rows.length > 0
}

async function getLastCompletedScheduleForComponent(userId, component) {
  const [rows] = await pool.query(
    `
    SELECT actual_donation_at AS reviewed_at
    FROM schedule_requests
    WHERE user_id = ? 
      AND status = 'completed'
      AND COALESCE(component_type, 'whole_blood') = ?
      AND actual_donation_at IS NOT NULL
    ORDER BY actual_donation_at DESC
    LIMIT 1
  `,
    [userId, component],
  )
  return rows[0] || null
}

async function createScheduleRequest({
  userId,
  preferredDate,
  preferredTime,
  componentType,
  lastDonationDate,
  weight,
  healthScreeningAnswers,
  notes,
  requestedBloodType,
}) {
  const component = componentType || 'whole_blood'

  let result
  try {
    const [result1] = await pool.query(
      `
      INSERT INTO schedule_requests 
        (user_id, preferred_date, preferred_time, component_type, requested_blood_type, last_donation_date, weight, health_screening_answers, notes, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')
    `,
      [
        userId,
        preferredDate,
        preferredTime,
        component,
        requestedBloodType || null,
        lastDonationDate || null,
        weight,
        JSON.stringify(healthScreeningAnswers),
        notes || null,
      ],
    )
    result = result1
  } catch (error) {
    const isBadField = error.code === 'ER_BAD_FIELD_ERROR'
    const msg = String(error.message || '')

    if (isBadField && msg.includes('component_type')) {
      try {
        const [result2] = await pool.query(
          `
        INSERT INTO schedule_requests 
          (user_id, preferred_date, preferred_time, requested_blood_type, last_donation_date, weight, health_screening_answers, notes, status)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending')
      `,
          [
            userId,
            preferredDate,
            preferredTime,
            requestedBloodType || null,
            lastDonationDate || null,
            weight,
            JSON.stringify(healthScreeningAnswers),
            notes || null,
          ],
        )
        result = result2
      } catch (err2) {
        if (err2.code === 'ER_BAD_FIELD_ERROR' && String(err2.message || '').includes('requested_blood_type')) {
          const [result3] = await pool.query(
            `
          INSERT INTO schedule_requests 
            (user_id, preferred_date, preferred_time, last_donation_date, weight, health_screening_answers, notes, status)
          VALUES (?, ?, ?, ?, ?, ?, ?, 'pending')
        `,
            [
              userId,
              preferredDate,
              preferredTime,
              lastDonationDate || null,
              weight,
              JSON.stringify(healthScreeningAnswers),
              notes || null,
            ],
          )
          result = result3
        } else {
          throw err2
        }
      }
    } else if (isBadField && msg.includes('requested_blood_type')) {
      const [result4] = await pool.query(
        `
      INSERT INTO schedule_requests 
        (user_id, preferred_date, preferred_time, component_type, last_donation_date, weight, health_screening_answers, notes, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending')
    `,
        [
          userId,
          preferredDate,
          preferredTime,
          component,
          lastDonationDate || null,
          weight,
          JSON.stringify(healthScreeningAnswers),
          notes || null,
        ],
      )
      result = result4
    } else {
      throw error
    }
  }

  return result.insertId
}

module.exports = {
  getUserById,
  setPendingDonorProfile,
  approvePendingDonorProfile,
  rejectPendingDonorProfile,
  updateUserProfile,
  getUserDonations,
  getUserBloodAvailability,
  getDonationEligibility,
  getUserScheduleRequests,
  hasPendingScheduleRequest,
  getLastCompletedScheduleForComponent,
  createScheduleRequest,
}

