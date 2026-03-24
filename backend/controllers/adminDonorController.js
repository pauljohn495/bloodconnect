const { pool } = require('../db')

const getDonorsController = async (req, res) => {
  try {
    const [rows] = await pool.query(
      `
      SELECT id, username, email, full_name, phone, blood_type, last_donation_date, created_at, status
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
      INSERT INTO users (username, email, password_hash, role, full_name, phone, blood_type, status, last_donation_date)
      VALUES (?, ?, ?, 'donor', ?, ?, ?, 'active', NULL)
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
      SELECT id, full_name, phone, blood_type, status, last_donation_date
      FROM users
      WHERE id = ? AND role = 'donor'
      LIMIT 1
    `,
      [donorId],
    )

    if (users.length === 0) return res.status(404).json({ message: 'Donor not found' })

    const donor = users[0]
    const [rows] = await pool.query(
      `
      SELECT 
        COALESCE(component_type, 'whole_blood') AS component_type,
        COUNT(*) AS completed_count,
        MAX(reviewed_at) AS last_completed_at
      FROM schedule_requests
      WHERE user_id = ? AND status = 'completed'
      GROUP BY COALESCE(component_type, 'whole_blood')
    `,
      [donorId],
    )

    const now = new Date()
    const base = {
      whole_blood: { componentType: 'whole_blood', cooldownDays: DONATION_COOLDOWNS.whole_blood, lastCompletedAt: null, completedCount: 0 },
      platelets: { componentType: 'platelets', cooldownDays: DONATION_COOLDOWNS.platelets, lastCompletedAt: null, completedCount: 0 },
      plasma: { componentType: 'plasma', cooldownDays: DONATION_COOLDOWNS.plasma, lastCompletedAt: null, completedCount: 0 },
    }

    rows.forEach((row) => {
      const key = row.component_type || 'whole_blood'
      if (base[key]) {
        base[key].lastCompletedAt = row.last_completed_at
        base[key].completedCount = Number(row.completed_count || 0)
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

    return res.json({
      donor: {
        id: donor.id,
        fullName: donor.full_name,
        phone: donor.phone,
        bloodType: donor.blood_type,
        status: donor.status,
        lastDonationDate: donor.last_donation_date,
      },
      stats,
      totalDonations,
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
      SET full_name = ?, blood_type = ?, phone = ?, status = ?
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

module.exports = {
  getDonorsController,
  createDonorController,
  getDonorDetailsController,
  updateDonorController,
  deleteDonorController,
}

