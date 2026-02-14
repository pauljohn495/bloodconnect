const express = require('express')

const { pool } = require('../db')
const auth = require('../middleware/auth')

const router = express.Router()

// All hospital routes require hospital role
router.use(auth(['hospital']))

// Helper to get hospital id for current user
async function getHospitalIdForUser(userId) {
  const [rows] = await pool.query('SELECT id FROM hospitals WHERE user_id = ?', [userId])
  return rows[0]?.id || null
}

// GET /api/hospital/inventory
router.get('/inventory', async (req, res) => {
  try {
    const hospitalId = await getHospitalIdForUser(req.user.id)
    if (!hospitalId) {
      return res.status(400).json({ message: 'Hospital record not found for this user' })
    }

    const [rows] = await pool.query(
      `
      SELECT *
      FROM blood_inventory
      WHERE hospital_id = ?
      ORDER BY created_at DESC
    `,
      [hospitalId],
    )

    // Update status based on expiration date
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const sevenDaysFromNow = new Date(today)
    sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7)
    
    const updatedRows = await Promise.all(
      rows.map(async (row) => {
        const expirationDate = new Date(row.expiration_date)
        expirationDate.setHours(0, 0, 0, 0)
        
        let newStatus = row.status
        
        // Check if expired
        if (expirationDate < today) {
          newStatus = 'expired'
        }
        // Check if near expiry (within 7 days) and not already expired
        else if (expirationDate <= sevenDaysFromNow && row.status !== 'expired') {
          newStatus = 'near_expiry'
        }
        // If status was near_expiry but no longer within 7 days, set back to available
        else if (row.status === 'near_expiry' && expirationDate > sevenDaysFromNow) {
          newStatus = 'available'
        }
        
        // Update status in database if it changed
        if (newStatus !== row.status) {
          await pool.query('UPDATE blood_inventory SET status = ? WHERE id = ?', [
            newStatus,
            row.id,
          ])
        }
        
        return {
          ...row,
          status: newStatus,
        }
      })
    )

    res.json(updatedRows)
  } catch (error) {
    console.error('Hospital inventory error:', error)
    res.status(500).json({ message: 'Failed to fetch hospital inventory' })
  }
})

// POST /api/hospital/requests
router.post('/requests', async (req, res) => {
  const { bloodType, unitsRequested, notes } = req.body

  if (!bloodType || !unitsRequested) {
    return res
      .status(400)
      .json({ message: 'bloodType and unitsRequested are required' })
  }

  try {
    const hospitalId = await getHospitalIdForUser(req.user.id)
    if (!hospitalId) {
      return res.status(400).json({ message: 'Hospital record not found for this user' })
    }

    const intUnits = parseInt(unitsRequested, 10)
    if (Number.isNaN(intUnits) || intUnits <= 0) {
      return res
        .status(400)
        .json({ message: 'unitsRequested must be a positive integer' })
    }

    const [result] = await pool.query(
      `
      INSERT INTO blood_requests (hospital_id, blood_type, units_requested, notes)
      VALUES (?, ?, ?, ?)
    `,
      [hospitalId, bloodType, intUnits, notes || null],
    )

    res.status(201).json({
      id: result.insertId,
      hospitalId,
      bloodType,
      unitsRequested: intUnits,
      status: 'pending',
      notes: notes || null,
    })
  } catch (error) {
    console.error('Create hospital request error:', error)
    res.status(500).json({ message: 'Failed to create blood request' })
  }
})

// GET /api/hospital/requests
router.get('/requests', async (req, res) => {
  try {
    const hospitalId = await getHospitalIdForUser(req.user.id)
    if (!hospitalId) {
      return res.status(400).json({ message: 'Hospital record not found for this user' })
    }

    const [rows] = await pool.query(
      `
      SELECT *
      FROM blood_requests
      WHERE hospital_id = ?
      ORDER BY request_date DESC
    `,
      [hospitalId],
    )

    res.json(rows)
  } catch (error) {
    console.error('Fetch hospital requests error:', error)
    res.status(500).json({ message: 'Failed to fetch hospital requests' })
  }
})

module.exports = router


