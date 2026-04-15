const { pool } = require('../db')
const { approvePendingDonorProfile, rejectPendingDonorProfile } = require('../models/userModel')
const { createNotification } = require('../models/notificationModel')

const getDonorsController = async (req, res) => {
  try {
    const [rows] = await pool.query(
      `
      SELECT id, username, email, full_name, phone, blood_type, last_donation_date, created_at, status,
             profile_image_url, pending_profile_json, profile_update_requested_at
      FROM users
      WHERE role = 'donor'
      ORDER BY created_at DESC
    `,
    )
    res.json(rows)
  } catch (error) {
    console.error('Fetch donors error:', error)
    res.status(500).json({ message: 'Failed to fetch donors' })
  }
}

const createDonorController = async (req, res) => {
  const { donorName, bloodType, contactPhone, contactEmail, username, password } = req.body

  if (!donorName || !bloodType || !contactPhone) {
    return res
      .status(400)
      .json({ message: 'donorName, bloodType and contactPhone are required' })
  }

  try {
    let finalUsername =
      (username && username.trim()) || `donor_${String(contactPhone).replace(/\D/g, '')}`
    const finalPassword = (password && password.trim()) || Math.random().toString(36).slice(-10)

    for (let i = 0; i < 5; i += 1) {
      const [existingUserByUsername] = await pool.query(
        'SELECT id FROM users WHERE username = ? LIMIT 1',
        [finalUsername],
      )
      if (existingUserByUsername.length === 0) break
      finalUsername = `${finalUsername}_${Math.floor(Math.random() * 1000)}`
    }

    const [existingUserByPhone] = await pool.query(
      'SELECT id FROM users WHERE phone = ? LIMIT 1',
      [contactPhone],
    )
    if (existingUserByPhone.length > 0) {
      return res.status(400).json({ message: 'Mobile number is already registered' })
    }

    if (contactEmail) {
      const [existingUserByEmail] = await pool.query(
        'SELECT id FROM users WHERE email = ? LIMIT 1',
        [contactEmail],
      )
      if (existingUserByEmail.length > 0) {
        return res.status(400).json({ message: 'Email is already registered' })
      }
    }

    const bcrypt = require('bcryptjs')
    const passwordHash = await bcrypt.hash(finalPassword, 10)

    const safeEmail =
      contactEmail && contactEmail.trim() !== ''
        ? contactEmail.trim()
        : `${contactPhone}@noemail.bloodconnect`

    const [result] = await pool.query(
      `
      INSERT INTO users (username, email, password_hash, role, full_name, phone, blood_type, status, last_donation_date, is_manual_donor)
      VALUES (?, ?, ?, 'donor', ?, ?, ?, 'active', NULL, 1)
    `,
      [finalUsername, safeEmail, passwordHash, donorName, contactPhone, bloodType],
    )

    res.status(201).json({
      id: result.insertId,
      donorName,
      bloodType,
      contactPhone,
      contactEmail: contactEmail || null,
      username: finalUsername,
    })
  } catch (error) {
    console.error('Create donor error:', error)
    res.status(500).json({ message: 'Failed to create donor' })
  }
}

const getDonorDetailsController = async (req, res) => {
  const { id } = req.params
  const donorId = parseInt(id, 10)

  if (Number.isNaN(donorId)) {
    return res.status(400).json({ message: 'Invalid donor id' })
  }

  const DONATION_COOLDOWNS = { whole_blood: 90, platelets: 14, plasma: 28 }

  try {
    const [users] = await pool.query(
      `
      SELECT id, full_name, phone, blood_type, status, last_donation_date, profile_image_url, is_manual_donor
      FROM users
      WHERE id = ? AND role = 'donor'
      LIMIT 1
    `,
      [donorId],
    )

    if (users.length === 0) return res.status(404).json({ message: 'Donor not found' })

    const donor = users[0]

    const mergeDonationStats = async () => {
      const mergeMap = {}
      const bump = (ct, cnt, last) => {
        const key = ct || 'whole_blood'
        if (!mergeMap[key]) mergeMap[key] = { completed_count: 0, last_completed_at: null }
        mergeMap[key].completed_count += Number(cnt || 0)
        if (last) {
          const prev = mergeMap[key].last_completed_at
          if (!prev || new Date(last) > new Date(prev)) mergeMap[key].last_completed_at = last
        }
      }

      try {
        const [donAgg] = await pool.query(
          `
          SELECT 
            COALESCE(component_type, 'whole_blood') AS component_type,
            COUNT(*) AS completed_count,
            MAX(donation_date) AS last_completed_at
          FROM donations
          WHERE user_id = ? AND status = 'completed'
          GROUP BY COALESCE(component_type, 'whole_blood')
        `,
          [donorId],
        )
        donAgg.forEach((r) => bump(r.component_type, r.completed_count, r.last_completed_at))
      } catch (e) {
        if (!(e && (e.code === 'ER_NO_SUCH_TABLE' || e.errno === 1146))) throw e
      }

      try {
        const [orphan] = await pool.query(
          `
          SELECT 
            COALESCE(sr.component_type, 'whole_blood') AS component_type,
            COUNT(*) AS completed_count,
            MAX(sr.actual_donation_at) AS last_completed_at
          FROM schedule_requests sr
          LEFT JOIN donations d ON d.schedule_request_id = sr.id
          WHERE sr.user_id = ? AND sr.status = 'completed' AND d.id IS NULL
            AND sr.actual_donation_at IS NOT NULL
          GROUP BY COALESCE(sr.component_type, 'whole_blood')
        `,
          [donorId],
        )
        orphan.forEach((r) => bump(r.component_type, r.completed_count, r.last_completed_at))
      } catch (e) {
        if (
          e &&
          (e.code === 'ER_BAD_FIELD_ERROR' ||
            e.message?.includes('schedule_request_id') ||
            e.code === 'ER_NO_SUCH_COLUMN')
        ) {
          /* Older DB without schedule_request_id on donations — skip orphan bucket to avoid double counts. */
        } else {
          throw e
        }
      }
      return mergeMap
    }

    const mergeMap = await mergeDonationStats()

    const now = new Date()
    const base = {
      whole_blood: { componentType: 'whole_blood', cooldownDays: DONATION_COOLDOWNS.whole_blood, lastCompletedAt: null, completedCount: 0 },
      platelets: { componentType: 'platelets', cooldownDays: DONATION_COOLDOWNS.platelets, lastCompletedAt: null, completedCount: 0 },
      plasma: { componentType: 'plasma', cooldownDays: DONATION_COOLDOWNS.plasma, lastCompletedAt: null, completedCount: 0 },
    }

    Object.keys(base).forEach((key) => {
      const m = mergeMap[key]
      if (m) {
        base[key].completedCount = m.completed_count
        base[key].lastCompletedAt = m.last_completed_at
      }
    })

    const stats = {}
    let totalDonations = 0
    Object.values(base).forEach((entry) => {
      const { componentType, cooldownDays, lastCompletedAt, completedCount } = entry
      let isEligible = true
      let nextEligibleAt = null
      if (lastCompletedAt && cooldownDays && cooldownDays > 0) {
        const next = new Date(new Date(lastCompletedAt))
        next.setDate(next.getDate() + cooldownDays)
        if (next > now) {
          isEligible = false
          nextEligibleAt = next.toISOString()
        }
      }
      totalDonations += completedCount
      stats[componentType] = {
        componentType,
        cooldownDays,
        lastCompletedAt: lastCompletedAt ? new Date(lastCompletedAt).toISOString() : null,
        completedCount,
        isEligible,
        nextEligibleAt,
      }
    })

    const isManualDonor = Boolean(donor.is_manual_donor)
    const profileImageUrl = donor.profile_image_url || null

    let donationHistory = []
    try {
      const [dhRows] = await pool.query(
        `
        SELECT 
          d.id,
          d.donation_date,
          d.units_donated,
          COALESCE(d.component_type, 'whole_blood') AS component_type,
          d.inventory_id,
          u.full_name AS recorded_by_name
        FROM donations d
        LEFT JOIN users u ON d.recorded_by = u.id
        WHERE d.user_id = ?
        ORDER BY d.donation_date DESC
        LIMIT 25
      `,
        [donorId],
      )
      donationHistory = dhRows.map((r) => ({
        id: r.id,
        donationDate: r.donation_date ? new Date(r.donation_date).toISOString() : null,
        unitsDonated: Number(r.units_donated || 0),
        componentType: r.component_type || 'whole_blood',
        inventoryId: r.inventory_id != null ? Number(r.inventory_id) : null,
        recordedByName: r.recorded_by_name || null,
      }))
    } catch (histErr) {
      if (
        histErr &&
        (histErr.code === 'ER_BAD_FIELD_ERROR' ||
          histErr.code === 'ER_NO_SUCH_TABLE' ||
          histErr.errno === 1146)
      ) {
        donationHistory = []
      } else {
        throw histErr
      }
    }

    return res.json({
      donor: {
        id: donor.id,
        fullName: donor.full_name,
        phone: donor.phone,
        bloodType: donor.blood_type,
        status: donor.status,
        lastDonationDate: donor.last_donation_date,
        profileImageUrl,
        isManualDonor,
      },
      stats,
      totalDonations,
      donationHistory,
    })
  } catch (error) {
    console.error('Fetch donor details error:', error)
    return res.status(500).json({ message: 'Failed to fetch donor details' })
  }
}

const updateDonorController = async (req, res) => {
  const donorId = parseInt(req.params.id, 10)
  const { donorName, bloodType, contactPhone, status } = req.body

  if (Number.isNaN(donorId)) {
    return res.status(400).json({ message: 'Invalid donor id' })
  }

  if (!donorName || !bloodType || !contactPhone) {
    return res.status(400).json({ message: 'donorName, bloodType and contactPhone are required' })
  }

  try {
    const [existingDonor] = await pool.query(
      `SELECT id FROM users WHERE id = ? AND role = 'donor' LIMIT 1`,
      [donorId],
    )
    if (existingDonor.length === 0) {
      return res.status(404).json({ message: 'Donor not found' })
    }

    const [existingPhone] = await pool.query(
      `SELECT id FROM users WHERE phone = ? AND id <> ? LIMIT 1`,
      [contactPhone, donorId],
    )
    if (existingPhone.length > 0) {
      return res.status(400).json({ message: 'Mobile number is already registered' })
    }

    const finalStatus = status === 'inactive' ? 'inactive' : 'active'
    await pool.query(
      `
      UPDATE users
      SET full_name = ?, blood_type = ?, phone = ?, status = ?,
          pending_profile_json = NULL, profile_update_requested_at = NULL
      WHERE id = ? AND role = 'donor'
    `,
      [donorName, bloodType, contactPhone, finalStatus, donorId],
    )

    return res.json({ message: 'Donor updated successfully' })
  } catch (error) {
    console.error('Update donor error:', error)
    return res.status(500).json({ message: 'Failed to update donor' })
  }
}

const approveDonorProfileUpdateController = async (req, res) => {
  const donorId = parseInt(req.params.id, 10)
  if (Number.isNaN(donorId)) {
    return res.status(400).json({ message: 'Invalid donor id' })
  }
  try {
    const result = await approvePendingDonorProfile(donorId)
    if (!result.ok) {
      if (result.code === 'NOT_FOUND') return res.status(404).json({ message: 'Donor not found' })
      if (result.code === 'NO_PENDING') {
        return res.status(400).json({ message: 'No pending profile update for this donor' })
      }
      if (result.code === 'PHONE_TAKEN') {
        return res.status(400).json({ message: 'Pending phone number is already registered to another user' })
      }
      if (result.code === 'INVALID_PENDING') {
        return res.status(500).json({ message: 'Invalid pending profile data' })
      }
      return res.status(500).json({ message: 'Failed to approve profile update' })
    }
    try {
      await createNotification(
        donorId,
        'Profile update approved',
        'Your profile update was approved. Your profile now reflects your submitted changes.',
        'info',
      )
    } catch (notifErr) {
      console.error('Notify donor after profile approval:', notifErr)
    }
    return res.json({ message: 'Profile update approved' })
  } catch (error) {
    console.error('Approve donor profile error:', error)
    return res.status(500).json({ message: 'Failed to approve profile update' })
  }
}

const rejectDonorProfileUpdateController = async (req, res) => {
  const donorId = parseInt(req.params.id, 10)
  if (Number.isNaN(donorId)) {
    return res.status(400).json({ message: 'Invalid donor id' })
  }
  try {
    const updated = await rejectPendingDonorProfile(donorId)
    if (!updated) {
      const [rows] = await pool.query(`SELECT id FROM users WHERE id = ? AND role = 'donor'`, [donorId])
      if (rows.length === 0) return res.status(404).json({ message: 'Donor not found' })
      return res.status(400).json({ message: 'No pending profile update for this donor' })
    }
    try {
      await createNotification(
        donorId,
        'Profile update rejected',
        'Your profile update was rejected. Your profile was left unchanged.',
        'warning',
      )
    } catch (notifErr) {
      console.error('Notify donor after profile rejection:', notifErr)
    }
    return res.json({ message: 'Profile update rejected' })
  } catch (error) {
    console.error('Reject donor profile error:', error)
    return res.status(500).json({ message: 'Failed to reject profile update' })
  }
}

const deleteDonorController = async (req, res) => {
  const donorId = parseInt(req.params.id, 10)

  if (Number.isNaN(donorId)) {
    return res.status(400).json({ message: 'Invalid donor id' })
  }

  try {
    const [existingDonor] = await pool.query(
      `SELECT id FROM users WHERE id = ? AND role = 'donor' LIMIT 1`,
      [donorId],
    )
    if (existingDonor.length === 0) {
      return res.status(404).json({ message: 'Donor not found' })
    }

    await pool.query(`DELETE FROM users WHERE id = ? AND role = 'donor'`, [donorId])
    return res.json({ message: 'Donor deleted successfully' })
  } catch (error) {
    console.error('Delete donor error:', error)
    return res.status(500).json({ message: 'Failed to delete donor' })
  }
}

/**
 * Walk-in / admin-only donor: record donation + inventory without a schedule request
 * (e.g. manually created donors who never booked online).
 */
const recordWalkInDonationController = async (req, res) => {
  const donorId = parseInt(req.params.id, 10)
  if (Number.isNaN(donorId)) {
    return res.status(400).json({ message: 'Invalid donor id' })
  }

  const { unitsDonated, expirationDate: expirationRaw, componentType: compRaw } = req.body || {}

  const units = parseInt(String(unitsDonated ?? ''), 10)
  if (Number.isNaN(units) || units < 1 || units > 50) {
    return res.status(400).json({ message: 'unitsDonated must be between 1 and 50' })
  }

  const expirationYmd = typeof expirationRaw === 'string' ? expirationRaw.trim() : ''
  if (!/^\d{4}-\d{2}-\d{2}$/.test(expirationYmd)) {
    return res.status(400).json({ message: 'expirationDate is required (YYYY-MM-DD)' })
  }

  const componentType = (() => {
    const v = (compRaw || 'whole_blood').toString().toLowerCase()
    if (v === 'platelets') return 'platelets'
    if (v === 'plasma') return 'plasma'
    return 'whole_blood'
  })()

  const adminId = req.user?.id || null

  let conn
  try {
    conn = await pool.getConnection()
    await conn.beginTransaction()

    const [userRows] = await conn.query(
      `SELECT id, blood_type FROM users WHERE id = ? AND role = 'donor' LIMIT 1 FOR UPDATE`,
      [donorId],
    )
    if (userRows.length === 0) {
      await conn.rollback()
      return res.status(404).json({ message: 'Donor not found' })
    }

    const bloodType = userRows[0].blood_type
    if (!bloodType) {
      await conn.rollback()
      return res.status(400).json({ message: 'Donor blood type is missing' })
    }

    const donationAt = new Date()
    if (Number.isNaN(donationAt.getTime())) {
      await conn.rollback()
      return res.status(500).json({ message: 'Could not record donation time' })
    }

    const donationYmd = (() => {
      const dt = new Date(donationAt)
      const y = dt.getFullYear()
      const m = String(dt.getMonth() + 1).padStart(2, '0')
      const day = String(dt.getDate()).padStart(2, '0')
      return `${y}-${m}-${day}`
    })()

    if (expirationYmd < donationYmd) {
      await conn.rollback()
      return res.status(400).json({ message: 'Expiration date must be on or after the donation date' })
    }

    const maxExp = new Date(donationAt)
    maxExp.setDate(maxExp.getDate() + 400)
    const maxYmd = (() => {
      const dt = new Date(maxExp)
      const y = dt.getFullYear()
      const m = String(dt.getMonth() + 1).padStart(2, '0')
      const day = String(dt.getDate()).padStart(2, '0')
      return `${y}-${m}-${day}`
    })()
    if (expirationYmd > maxYmd) {
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
        VALUES (?, ?, ?, NULL, NULL, 'completed', ?, NULL, ?, ?, ?)
      `,
        [donorId, bloodType, donationAt, units, adminId, componentType, inventoryId],
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
          [donorId, bloodType, donationAt, units],
        )
        donationRowId = donResult2.insertId
      } else {
        throw donErr
      }
    }

    await conn.query(`UPDATE users SET last_donation_date = ? WHERE id = ?`, [donationYmd, donorId])

    await conn.query(
      `
      INSERT INTO notifications (user_id, title, message, type)
      VALUES (?, ?, ?, 'success')
    `,
      [
        donorId,
        'Donation recorded',
        `Your donation of ${units} unit(s) was recorded. Thank you for saving lives!`,
      ],
    )

    await conn.commit()

    return res.json({
      message: 'Walk-in donation recorded and inventory updated',
      donationId: donationRowId,
      inventoryId,
      actualDonationAt: donationAt.toISOString(),
      expirationDate: expirationYmd,
      unitsDonated: units,
      componentType,
    })
  } catch (error) {
    if (conn) await conn.rollback()
    console.error('Record walk-in donation error:', error)
    return res.status(500).json({ message: 'Failed to record donation' })
  } finally {
    if (conn) conn.release()
  }
}

module.exports = {
  getDonorsController,
  createDonorController,
  getDonorDetailsController,
  updateDonorController,
  approveDonorProfileUpdateController,
  rejectDonorProfileUpdateController,
  deleteDonorController,
  recordWalkInDonationController,
}

