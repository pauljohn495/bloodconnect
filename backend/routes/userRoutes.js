const express = require('express')

const { pool } = require('../db')
const auth = require('../middleware/auth')

const router = express.Router()

// Cooldown periods in days by donation component type
const DONATION_COOLDOWNS = {
  whole_blood: 90,
  platelets: 14,
  plasma: 28,
}

// All user routes require any authenticated user
router.use(auth(['admin', 'hospital', 'donor', 'recipient']))

// GET /api/user/me
router.get('/me', async (req, res) => {
  try {
    const [rows] = await pool.query(
      `
      SELECT id, username, email, role, full_name, phone, blood_type, status, created_at, updated_at
      FROM users
      WHERE id = ?
    `,
      [req.user.id],
    )

    if (!rows[0]) {
      return res.status(404).json({ message: 'User not found' })
    }

    res.json(rows[0])
  } catch (error) {
    console.error('Fetch current user error:', error)
    res.status(500).json({ message: 'Failed to fetch user profile' })
  }
})

// PUT /api/user/me
router.put('/me', async (req, res) => {
  const { fullName, phone, bloodType } = req.body

  try {
    const [result] = await pool.query(
      `
      UPDATE users
      SET full_name = COALESCE(?, full_name),
          phone = COALESCE(?, phone),
          blood_type = COALESCE(?, blood_type)
      WHERE id = ?
    `,
      [fullName ?? null, phone ?? null, bloodType ?? null, req.user.id],
    )

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'User not found' })
    }

    const [rows] = await pool.query(
      `
      SELECT id, username, email, role, full_name, phone, blood_type, status, created_at, updated_at
      FROM users
      WHERE id = ?
    `,
      [req.user.id],
    )

    res.json(rows[0])
  } catch (error) {
    console.error('Update current user error:', error)
    res.status(500).json({ message: 'Failed to update user profile' })
  }
})

// GET /api/user/donations - donation history for donor user
router.get('/donations', async (req, res) => {
  try {
    const [rows] = await pool.query(
      `
      SELECT id, blood_type, donation_date, location, hospital_id, status, units_donated
      FROM donations
      WHERE user_id = ?
      ORDER BY donation_date DESC
    `,
      [req.user.id],
    )

    res.json(rows)
  } catch (error) {
    console.error('Fetch user donations error:', error)
    res.status(500).json({ message: 'Failed to fetch donation history' })
  }
})

// GET /api/user/blood-availability - simple summary for the user blood type
router.get('/blood-availability', async (req, res) => {
  try {
    const [userRows] = await pool.query(
      'SELECT blood_type FROM users WHERE id = ?',
      [req.user.id],
    )

    const bloodType = userRows[0]?.blood_type
    if (!bloodType) {
      return res.json({ bloodType: null, totalAvailable: 0 })
    }

    const [rows] = await pool.query(
      `
      SELECT blood_type, total_available
      FROM v_blood_stock_summary
      WHERE blood_type = ?
    `,
      [bloodType],
    )

    const summary = rows[0] || { blood_type: bloodType, total_available: 0 }

    res.json({
      bloodType: summary.blood_type,
      totalAvailable: summary.total_available,
    })
  } catch (error) {
    console.error('Blood availability error:', error)
    res.status(500).json({ message: 'Failed to fetch blood availability' })
  }
})

// ===== Schedule Requests =====

// GET /api/user/donation-eligibility - per-component cooldown / eligibility
router.get('/donation-eligibility', async (req, res) => {
  try {
    // Get latest completed schedule per component type
    const [rows] = await pool.query(
      `
      SELECT 
        COALESCE(component_type, 'whole_blood') AS component_type,
        MAX(reviewed_at) AS last_completed_at
      FROM schedule_requests
      WHERE user_id = ? AND status = 'completed'
      GROUP BY COALESCE(component_type, 'whole_blood')
    `,
      [req.user.id],
    )

    const now = new Date()

    const base = {
      whole_blood: { componentType: 'whole_blood', cooldownDays: DONATION_COOLDOWNS.whole_blood, lastCompletedAt: null },
      platelets: { componentType: 'platelets', cooldownDays: DONATION_COOLDOWNS.platelets, lastCompletedAt: null },
      plasma: { componentType: 'plasma', cooldownDays: DONATION_COOLDOWNS.plasma, lastCompletedAt: null },
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

    res.json(result)
  } catch (error) {
    console.error('Donation eligibility error:', error)
    res.status(500).json({ message: 'Failed to fetch donation eligibility' })
  }
})

// GET /api/user/schedule-requests - get donor's schedule requests
router.get('/schedule-requests', async (req, res) => {
  try {
    const [rows] = await pool.query(
      `
      SELECT 
        id,
        preferred_date,
        preferred_time,
        component_type,
        last_donation_date,
        weight,
        health_screening_answers,
        notes,
        status,
        admin_notes,
        rejection_reason,
        reviewed_at,
        created_at
      FROM schedule_requests
      WHERE user_id = ?
      ORDER BY created_at DESC
    `,
      [req.user.id],
    )

    res.json(rows)
  } catch (error) {
    console.error('Fetch schedule requests error:', error)
    res.status(500).json({ message: 'Failed to fetch schedule requests' })
  }
})

// POST /api/user/schedule-requests - create schedule request
router.post('/schedule-requests', async (req, res) => {
  const {
    preferredDate,
    preferredTime,
    componentType,
    lastDonationDate,
    weight,
    healthScreeningAnswers,
    notes,
  } = req.body

  if (!preferredDate || !preferredTime || !weight || !healthScreeningAnswers) {
    return res
      .status(400)
      .json({ message: 'preferredDate, preferredTime, weight, and healthScreeningAnswers are required' })
  }

  try {
    // Check if there's already a pending request
    const [pendingRequests] = await pool.query(
      'SELECT id FROM schedule_requests WHERE user_id = ? AND status = ?',
      [req.user.id, 'pending'],
    )

    if (pendingRequests.length > 0) {
      return res.status(400).json({
        message: 'You already have a pending schedule request. Please wait for it to be reviewed.',
      })
    }

    const component = componentType || 'whole_blood'

    // Enforce cooldown based on last completed schedule for this component type
    const cooldownDays = DONATION_COOLDOWNS[component] || 0
    if (cooldownDays > 0) {
      const [lastRows] = await pool.query(
        `
        SELECT reviewed_at
        FROM schedule_requests
        WHERE user_id = ? 
          AND status = 'completed'
          AND COALESCE(component_type, 'whole_blood') = ?
        ORDER BY reviewed_at DESC
        LIMIT 1
      `,
        [req.user.id, component],
      )

      if (lastRows.length > 0 && lastRows[0].reviewed_at) {
        const last = new Date(lastRows[0].reviewed_at)
        const nextEligible = new Date(last)
        nextEligible.setDate(nextEligible.getDate() + cooldownDays)
        const now = new Date()

        if (nextEligible > now) {
          const humanComponent =
            component === 'whole_blood'
              ? 'Whole Blood'
              : component === 'platelets'
                ? 'Platelets'
                : component === 'plasma'
                  ? 'Plasma'
                  : component

          return res.status(400).json({
            message: `You are still in cooldown for ${humanComponent}. You can donate this type again on ${nextEligible.toLocaleDateString()}.`,
            componentType: component,
            nextEligibleDate: nextEligible.toISOString(),
          })
        }
      }
    }

    // Try to insert with component_type if column exists
    let result
    try {
      const [result1] = await pool.query(
        `
        INSERT INTO schedule_requests 
          (user_id, preferred_date, preferred_time, component_type, last_donation_date, weight, health_screening_answers, notes, status)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending')
      `,
        [
          req.user.id,
          preferredDate,
          preferredTime,
          component,
          lastDonationDate || null,
          weight,
          JSON.stringify(healthScreeningAnswers),
          notes || null,
        ],
      )
      result = result1
    } catch (error) {
      // If component_type column doesn't exist, insert without it
      if (error.code === 'ER_BAD_FIELD_ERROR' || (error.message && error.message.includes('component_type'))) {
        const [result2] = await pool.query(
          `
          INSERT INTO schedule_requests 
            (user_id, preferred_date, preferred_time, last_donation_date, weight, health_screening_answers, notes, status)
          VALUES (?, ?, ?, ?, ?, ?, ?, 'pending')
        `,
          [
            req.user.id,
            preferredDate,
            preferredTime,
            lastDonationDate || null,
            weight,
            JSON.stringify(healthScreeningAnswers),
            notes || null,
          ],
        )
        result = result2
      } else {
        throw error
      }
    }

    res.status(201).json({
      id: result.insertId,
      message: 'Schedule request submitted successfully',
    })
  } catch (error) {
    console.error('Create schedule request error:', error)
    res.status(500).json({ message: 'Failed to create schedule request' })
  }
})

module.exports = router


