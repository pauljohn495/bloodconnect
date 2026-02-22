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

    // Calculate status based on expiration date (don't store near_expiry in DB)
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const sevenDaysFromNow = new Date(today)
    sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7)
    
    const updatedRows = await Promise.all(
      rows.map(async (row) => {
        const expirationDate = new Date(row.expiration_date)
        expirationDate.setHours(0, 0, 0, 0)
        
        let displayStatus = row.status
        let dbStatus = row.status
        
        // Check if expired - only update DB for expired status
        if (expirationDate < today) {
          displayStatus = 'expired'
          dbStatus = 'expired'
        }
        // Check if near expiry (within 7 days) - calculate for display only, keep DB as 'available'
        else if (expirationDate <= sevenDaysFromNow && row.status !== 'expired') {
          displayStatus = 'near_expiry' // For display only
          dbStatus = 'available' // Keep in database as available
        }
        // If expired in DB but no longer expired (shouldn't happen, but handle it)
        else if (row.status === 'expired' && expirationDate >= today) {
          displayStatus = expirationDate <= sevenDaysFromNow ? 'near_expiry' : 'available'
          dbStatus = 'available'
        }
        // Otherwise keep as available
        else {
          displayStatus = 'available'
          dbStatus = 'available'
        }
        
        // Only update database if status actually changed (for expired status)
        if (dbStatus !== row.status && dbStatus === 'expired') {
          await pool.query('UPDATE blood_inventory SET status = ? WHERE id = ?', [
            dbStatus,
            row.id,
          ])
        }
        
        return {
          ...row,
          status: displayStatus, // Return calculated status for display
          component_type: row.component_type || 'whole_blood',
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
  const { bloodType, componentType, unitsRequested, notes } = req.body

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

    const component = componentType || 'whole_blood'

    // Try to insert with component_type if column exists
    let result
    try {
      const [result1] = await pool.query(
        `
        INSERT INTO blood_requests (hospital_id, blood_type, component_type, units_requested, notes)
        VALUES (?, ?, ?, ?, ?)
      `,
        [hospitalId, bloodType, component, intUnits, notes || null],
      )
      result = result1
    } catch (error) {
      // If component_type column doesn't exist, insert without it
      if (error.code === 'ER_BAD_FIELD_ERROR' || error.message.includes('component_type')) {
        const [result2] = await pool.query(
          `
          INSERT INTO blood_requests (hospital_id, blood_type, units_requested, notes)
          VALUES (?, ?, ?, ?)
        `,
          [hospitalId, bloodType, intUnits, notes || null],
        )
        result = result2
      } else {
        throw error
      }
    }

    res.status(201).json({
      id: result.insertId,
      hospitalId,
      bloodType,
      componentType: component,
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

// ===== Hospital Analytics =====

// GET /api/hospital/analytics/wastage-predictions
router.get('/analytics/wastage-predictions', async (req, res) => {
  try {
    const hospitalId = await getHospitalIdForUser(req.user.id)
    if (!hospitalId) {
      return res.status(400).json({ message: 'Hospital record not found for this user' })
    }

    const today = new Date()
    today.setHours(0, 0, 0, 0)

    // Get historical wastage data for this hospital (last 90 days)
    const [historicalWastage] = await pool.query(
      `
      SELECT 
        blood_type,
        COUNT(*) as wasted_count,
        SUM(available_units) as wasted_units
      FROM blood_inventory
      WHERE status = 'expired'
        AND hospital_id = ?
        AND expiration_date >= DATE_SUB(CURDATE(), INTERVAL 90 DAY)
      GROUP BY blood_type
    `,
      [hospitalId],
    )

    // Get current inventory at risk for this hospital
    const [atRiskInventory] = await pool.query(
      `
      SELECT 
        id,
        blood_type,
        available_units,
        expiration_date,
        status,
        DATEDIFF(expiration_date, CURDATE()) as days_until_expiry
      FROM blood_inventory
      WHERE hospital_id = ?
        AND status = 'available'
        AND expiration_date > CURDATE()
        AND available_units > 0
      ORDER BY expiration_date ASC
    `,
      [hospitalId],
    )

    // Calculate wastage rates by blood type
    const wastageRates = {}
    historicalWastage.forEach((item) => {
      wastageRates[item.blood_type] = {
        wastedUnits: item.wasted_units || 0,
        wastedCount: item.wasted_count || 0,
      }
    })

    // Calculate risk scores for each inventory item
    const inventoryWithRisk = atRiskInventory.map((item) => {
      const daysUntilExpiry = item.days_until_expiry || 0
      const bloodType = item.blood_type

      // Days until expiry factor (0-40 points)
      let expiryFactor = 0
      if (daysUntilExpiry <= 3) expiryFactor = 40
      else if (daysUntilExpiry <= 7) expiryFactor = 30
      else if (daysUntilExpiry <= 14) expiryFactor = 20
      else if (daysUntilExpiry <= 30) expiryFactor = 10
      else expiryFactor = 5

      // Historical wastage factor (0-30 points)
      const wastageRate = wastageRates[bloodType]?.wastedUnits || 0
      const wastageFactor = Math.min(30, (wastageRate / 10) * 5)

      // Inventory level factor (0-30 points): high inventory = higher risk
      const inventoryFactor = item.available_units > 20 ? 30 : item.available_units > 10 ? 15 : 0

      const riskScore = Math.min(100, Math.round(expiryFactor + wastageFactor + inventoryFactor))

      return {
        ...item,
        riskScore,
        expiryFactor,
        wastageFactor: Math.round(wastageFactor),
        inventoryFactor,
      }
    })

    // Calculate predicted wastage
    const predictWastage = (days) => {
      const expiringSoon = inventoryWithRisk.filter(
        (item) => item.days_until_expiry <= days && item.days_until_expiry > 0,
      )
      const avgWastageRate = 0.15
      return expiringSoon.reduce((sum, item) => {
        const wastageProbability = item.riskScore / 100
        return sum + Math.round(item.available_units * wastageProbability * avgWastageRate)
      }, 0)
    }

    const predictedWastage = {
      next7Days: predictWastage(7),
      next14Days: predictWastage(14),
      next30Days: predictWastage(30),
    }

    // Group by blood type
    const wastageByBloodType = {}
    inventoryWithRisk.forEach((item) => {
      if (!wastageByBloodType[item.blood_type]) {
        wastageByBloodType[item.blood_type] = {
          bloodType: item.blood_type,
          totalAtRisk: 0,
          highRiskUnits: 0,
          averageRiskScore: 0,
          items: [],
        }
      }
      wastageByBloodType[item.blood_type].totalAtRisk += item.available_units
      wastageByBloodType[item.blood_type].items.push(item)
      if (item.riskScore >= 70) {
        wastageByBloodType[item.blood_type].highRiskUnits += item.available_units
      }
    })

    Object.keys(wastageByBloodType).forEach((bloodType) => {
      const group = wastageByBloodType[bloodType]
      const avgRisk =
        group.items.length > 0
          ? group.items.reduce((sum, item) => sum + item.riskScore, 0) / group.items.length
          : 0
      group.averageRiskScore = Math.round(avgRisk)
    })

    res.json({
      inventoryWithRisk: inventoryWithRisk.sort((a, b) => b.riskScore - a.riskScore),
      predictedWastage,
      wastageByBloodType: Object.values(wastageByBloodType),
      summary: {
        totalAtRisk: inventoryWithRisk.reduce((sum, item) => sum + item.available_units, 0),
        highRiskItems: inventoryWithRisk.filter((item) => item.riskScore >= 70).length,
        averageRiskScore:
          inventoryWithRisk.length > 0
            ? Math.round(
                inventoryWithRisk.reduce((sum, item) => sum + item.riskScore, 0) / inventoryWithRisk.length,
              )
            : 0,
      },
    })
  } catch (error) {
    console.error('Hospital wastage predictions error:', error)
    res.status(500).json({ message: 'Failed to fetch wastage predictions' })
  }
})

// GET /api/hospital/analytics/historical-wastage
router.get('/analytics/historical-wastage', async (req, res) => {
  try {
    const hospitalId = await getHospitalIdForUser(req.user.id)
    if (!hospitalId) {
      return res.status(400).json({ message: 'Hospital record not found for this user' })
    }

    const { days = 90 } = req.query

    // Get wastage by date for this hospital
    const [wastageByDate] = await pool.query(
      `
      SELECT 
        DATE(expiration_date) as date,
        blood_type,
        SUM(available_units) as wasted_units,
        COUNT(*) as wasted_count
      FROM blood_inventory
      WHERE status = 'expired'
        AND hospital_id = ?
        AND expiration_date >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
      GROUP BY DATE(expiration_date), blood_type
      ORDER BY date DESC
    `,
      [hospitalId, parseInt(days, 10)],
    )

    // Get wastage by blood type for this hospital
    const [wastageByBloodType] = await pool.query(
      `
      SELECT 
        blood_type,
        SUM(available_units) as total_wasted,
        COUNT(*) as count
      FROM blood_inventory
      WHERE status = 'expired'
        AND hospital_id = ?
        AND expiration_date >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
      GROUP BY blood_type
      ORDER BY total_wasted DESC
    `,
      [hospitalId, parseInt(days, 10)],
    )

    // Get total wastage directly from database
    const [totalWastageResult] = await pool.query(
      `
      SELECT COALESCE(SUM(available_units), 0) as total_wastage
      FROM blood_inventory
      WHERE status = 'expired'
        AND hospital_id = ?
        AND expiration_date >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
    `,
      [hospitalId, parseInt(days, 10)],
    )

    const totalWastage = Number(totalWastageResult[0]?.total_wastage || 0)

    const formattedWastageByBloodType = wastageByBloodType.map((item) => ({
      ...item,
      total_wasted: Number(item.total_wasted || 0),
      count: Number(item.count || 0),
    }))

    res.json({
      wastageByDate,
      wastageByBloodType: formattedWastageByBloodType,
      totalWastage,
      period: parseInt(days, 10),
    })
  } catch (error) {
    console.error('Hospital historical wastage error:', error)
    res.status(500).json({ message: 'Failed to fetch historical wastage' })
  }
})

module.exports = router


