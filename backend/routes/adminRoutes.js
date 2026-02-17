const express = require('express')

const { pool } = require('../db')
const auth = require('../middleware/auth')

const router = express.Router()

// All admin routes require admin role
router.use(auth(['admin']))

// GET /api/admin/dashboard-summary
router.get('/dashboard-summary', async (req, res) => {
  try {
    const [[bloodStockRows], [donorSummaryRows], [pendingRequestsRows], [countsRows]] = await Promise.all([
      pool.query('SELECT * FROM v_blood_stock_summary'),
      pool.query('SELECT * FROM v_active_donors_summary'),
      pool.query('SELECT * FROM v_pending_requests_summary'),
      pool.query(`
        SELECT
          (SELECT COUNT(*) FROM hospitals WHERE is_active = TRUE) AS partnerHospitals,
          (SELECT COUNT(*) FROM donors) AS totalDonors,
          (SELECT COUNT(*) FROM blood_requests WHERE status = 'pending') AS pendingRequests,
          (SELECT COUNT(*) FROM donations WHERE status = 'completed') + 
          COALESCE((SELECT SUM(units_transferred) FROM blood_transfers), 0) AS completedDonations
      `),
    ])

    res.json({
      bloodStock: bloodStockRows,
      donorSummary: donorSummaryRows,
      pendingRequestsSummary: pendingRequestsRows,
      counts: countsRows[0] || {},
    })
  } catch (error) {
    console.error('Dashboard summary error:', error)
    res.status(500).json({ message: 'Failed to fetch dashboard summary' })
  }
})

// ===== Hospitals / Partners =====

// GET /api/admin/hospitals
router.get('/hospitals', async (req, res) => {
  try {
    const [rows] = await pool.query(
      `
      SELECT
        h.id,
        h.hospital_name,
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

    // Get individual approved requests for each hospital (not grouped)
    const [approvedRequests] = await pool.query(
      `
      SELECT 
        br.id,
        br.hospital_id,
        br.blood_type,
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

    // Calculate remaining balance and fulfillment status for each request
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

    // Group requests by hospital_id
    const requestedBloodMap = {}
    requestsWithFulfillment.forEach((req) => {
      if (!requestedBloodMap[req.hospital_id]) {
        requestedBloodMap[req.hospital_id] = []
      }
      requestedBloodMap[req.hospital_id].push({
        requestId: req.id,
        bloodType: req.blood_type,
        unitsRequested: req.units_requested,
        unitsFulfilled: req.unitsFulfilled,
        remainingBalance: req.remainingBalance,
        status: req.isFullyFulfilled ? 'fulfilled' : req.isPartiallyFulfilled ? 'partially_fulfilled' : 'approved',
        requestDate: req.request_date,
      })
    })

    // Add requested blood information to each hospital
    const hospitalsWithRequests = rows.map((hospital) => ({
      ...hospital,
      requestedBlood: requestedBloodMap[hospital.id] || null,
    }))

    res.json(hospitalsWithRequests || [])
  } catch (error) {
    console.error('Fetch hospitals error:', error)
    res.status(500).json({ 
      message: 'Failed to fetch hospitals',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    })
  }
})

// POST /api/admin/hospitals
router.post('/hospitals', async (req, res) => {
  const { hospitalName, username, email, password } = req.body

  if (!hospitalName || !username || !email || !password) {
    return res
      .status(400)
      .json({ message: 'hospitalName, username, email and password are required' })
  }

  const bcrypt = require('bcryptjs')

  try {
    // Check if username or email already exists
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
        return res.status(400).json({ message: 'Username already exists' })
      }
      if (existing.email === email) {
        return res.status(400).json({ message: 'Email already exists' })
      }
    }

    // Check if user already has a hospital record
    if (existingUsers.length > 0) {
      const [existingHospital] = await pool.query(
        `
        SELECT id FROM hospitals WHERE user_id = ?
      `,
        [existingUsers[0].id],
      )
      if (existingHospital.length > 0) {
        return res.status(400).json({ message: 'User already has a hospital account' })
      }
    }

    const passwordHash = await bcrypt.hash(password, 10)

    const conn = await pool.getConnection()
    try {
      await conn.beginTransaction()

      // Check again within transaction
      const [checkUsers] = await conn.query(
        `
        SELECT id FROM users WHERE username = ? OR email = ?
      `,
        [username, email],
      )

      if (checkUsers.length > 0) {
        await conn.rollback()
        return res.status(400).json({ message: 'Username or email already exists' })
      }

      const [userResult] = await conn.query(
        `
        INSERT INTO users (username, email, password_hash, role, full_name)
        VALUES (?, ?, ?, 'hospital', ?)
      `,
        [username, email, passwordHash, hospitalName],
      )

      const userId = userResult.insertId

      // Check if hospital already exists for this user_id
      const [checkHospital] = await conn.query(
        `
        SELECT id FROM hospitals WHERE user_id = ?
      `,
        [userId],
      )

      if (checkHospital.length > 0) {
        await conn.rollback()
        return res.status(400).json({ message: 'Hospital record already exists for this user' })
      }

      const [hospitalResult] = await conn.query(
        `
        INSERT INTO hospitals (user_id, hospital_name, created_by)
        VALUES (?, ?, ?)
      `,
        [userId, hospitalName, req.user.id],
      )

      await conn.commit()

      res.status(201).json({
        id: hospitalResult.insertId,
        userId,
        hospitalName,
      })
    } catch (error) {
      await conn.rollback()
      console.error('Create hospital transaction error:', error)
      
      // Handle specific MySQL errors
      if (error.code === 'ER_DUP_ENTRY') {
        if (error.sqlMessage.includes('user_id')) {
          return res.status(400).json({ message: 'User already has a hospital record. Please use a different username or email.' })
        }
        if (error.sqlMessage.includes('username')) {
          return res.status(400).json({ message: 'Username already exists' })
        }
        if (error.sqlMessage.includes('email')) {
          return res.status(400).json({ message: 'Email already exists' })
        }
        return res.status(400).json({ message: 'Duplicate entry. This record may already exist.' })
      }
      
      throw error
    } finally {
      conn.release()
    }
  } catch (error) {
    console.error('Create hospital error:', error)
    res.status(500).json({ 
      message: error.message || 'Failed to create hospital',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    })
  }
})

// PUT /api/admin/hospitals/:id
router.put('/hospitals/:id', async (req, res) => {
  const { id } = req.params
  const hospitalId = parseInt(id, 10)
  const { hospitalName, email, username, password } = req.body

  if (Number.isNaN(hospitalId)) {
    return res.status(400).json({ message: 'Invalid hospital id' })
  }

  if (!hospitalName || !email || !username) {
    return res.status(400).json({ message: 'hospitalName, email, and username are required' })
  }

  try {
    const [rows] = await pool.query('SELECT user_id FROM hospitals WHERE id = ? LIMIT 1', [
      hospitalId,
    ])

    const hospital = rows[0]
    if (!hospital) {
      return res.status(404).json({ message: 'Hospital not found' })
    }

    const conn = await pool.getConnection()
    try {
      await conn.beginTransaction()

      // Update user information
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

      // Update hospital name
      await conn.query('UPDATE hospitals SET hospital_name = ? WHERE id = ?', [
        hospitalName,
        hospitalId,
      ])

      await conn.commit()

      res.json({ message: 'Hospital updated successfully' })
    } catch (error) {
      await conn.rollback()
      throw error
    } finally {
      conn.release()
    }
  } catch (error) {
    console.error('Update hospital error:', error)
    res.status(500).json({ message: 'Failed to update hospital' })
  }
})

// DELETE /api/admin/hospitals/:id
router.delete('/hospitals/:id', async (req, res) => {
  const { id } = req.params
  const hospitalId = parseInt(id, 10)

  if (Number.isNaN(hospitalId)) {
    return res.status(400).json({ message: 'Invalid hospital id' })
  }

  try {
    const [rows] = await pool.query('SELECT user_id FROM hospitals WHERE id = ? LIMIT 1', [
      hospitalId,
    ])

    const hospital = rows[0]
    if (!hospital) {
      return res.status(404).json({ message: 'Hospital not found' })
    }

    // Deleting the linked user will cascade-delete the hospital (FK ON DELETE CASCADE)
    await pool.query('DELETE FROM users WHERE id = ?', [hospital.user_id])

    res.json({ message: 'Hospital deleted' })
  } catch (error) {
    console.error('Delete hospital error:', error)
    res.status(500).json({ message: 'Failed to delete hospital' })
  }
})

// ===== Donors =====

// GET /api/admin/donors
router.get('/donors', async (req, res) => {
  try {
    const [rows] = await pool.query(
      `
      SELECT *
      FROM donors
      ORDER BY created_at DESC
    `,
    )
    res.json(rows)
  } catch (error) {
    console.error('Fetch donors error:', error)
    res.status(500).json({ message: 'Failed to fetch donors' })
  }
})

// POST /api/admin/donors
router.post('/donors', async (req, res) => {
  const { donorName, bloodType, contactPhone, contactEmail } = req.body

  if (!donorName || !bloodType || !contactPhone) {
    return res
      .status(400)
      .json({ message: 'donorName, bloodType and contactPhone are required' })
  }

  try {
    const [result] = await pool.query(
      `
      INSERT INTO donors (donor_name, blood_type, contact_phone, contact_email)
      VALUES (?, ?, ?, ?)
    `,
      [donorName, bloodType, contactPhone, contactEmail || null],
    )

    res.status(201).json({
      id: result.insertId,
      donorName,
      bloodType,
      contactPhone,
      contactEmail: contactEmail || null,
    })
  } catch (error) {
    console.error('Create donor error:', error)
    res.status(500).json({ message: 'Failed to create donor' })
  }
})

// ===== Blood Inventory =====

// GET /api/admin/inventory
router.get('/inventory', async (req, res) => {
  try {
    const { hospitalId } = req.query
    
    let query = 'SELECT * FROM blood_inventory'
    let params = []
    
    if (hospitalId) {
      query += ' WHERE hospital_id = ?'
      params.push(hospitalId)
    } else {
      // For central inventory, show items where hospital_id is NULL
      query += ' WHERE hospital_id IS NULL'
    }
    
    query += ' ORDER BY created_at DESC'
    
    const [rows] = await pool.query(query, params)
    
    // Calculate status based on expiration date (don't store near_expiry in DB)
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const sevenDaysFromNow = new Date(today)
    sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7)
    
    // Get approved requests grouped by blood type (only non-fulfilled)
    const [approvedRequests] = await pool.query(
      `
      SELECT 
        blood_type,
        SUM(units_requested) as total_units_requested,
        COUNT(*) as request_count
      FROM blood_requests
      WHERE status = 'approved'
      GROUP BY blood_type
    `,
    )
    
    // Create a map of blood type to requested units
    const requestedBloodMap = {}
    approvedRequests.forEach((req) => {
      requestedBloodMap[req.blood_type] = {
        units: req.total_units_requested,
        count: req.request_count,
      }
    })
    
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
        
        // Add requested blood information if there are approved requests for this blood type
        const requestedBlood = requestedBloodMap[row.blood_type] || null
        
        return {
          ...row,
          status: displayStatus, // Return calculated status for display
          requestedBlood: requestedBlood
            ? {
                bloodType: row.blood_type,
                units: requestedBlood.units,
                requestCount: requestedBlood.count,
              }
            : null,
        }
      }),
    )
    
    res.json(updatedRows)
  } catch (error) {
    console.error('Fetch inventory error:', error)
    res.status(500).json({ message: 'Failed to fetch inventory' })
  }
})

// POST /api/admin/inventory
router.post('/inventory', async (req, res) => {
  const { bloodType, units, expirationDate, hospitalId } = req.body

  if (!bloodType || !units || !expirationDate) {
    return res
      .status(400)
      .json({ message: 'bloodType, units and expirationDate are required' })
  }

  try {
    const intUnits = parseInt(units, 10)
    if (Number.isNaN(intUnits) || intUnits <= 0) {
      return res.status(400).json({ message: 'units must be a positive integer' })
    }

    const [result] = await pool.query(
      `
      INSERT INTO blood_inventory
        (blood_type, units, available_units, expiration_date, status, added_by, hospital_id)
      VALUES (?, ?, ?, ?, 'available', ?, ?)
    `,
      [bloodType, intUnits, intUnits, expirationDate, req.user.id, hospitalId || null],
    )

    res.status(201).json({
      id: result.insertId,
      bloodType,
      units: intUnits,
      availableUnits: intUnits,
      expirationDate,
      hospitalId: hospitalId || null,
    })
  } catch (error) {
    console.error('Create inventory error:', error)
    res.status(500).json({ message: 'Failed to add inventory' })
  }
})

// POST /api/admin/transfer
router.post('/transfer', async (req, res) => {
  const { hospitalId, transfers, requestFulfillments } = req.body

  if (!hospitalId || !Array.isArray(transfers) || transfers.length === 0) {
    return res.status(400).json({ message: 'hospitalId and transfers array are required' })
  }

  try {
    // Verify hospital exists
    const [hospitalRows] = await pool.query('SELECT id FROM hospitals WHERE id = ?', [hospitalId])
    if (hospitalRows.length === 0) {
      return res.status(404).json({ message: 'Hospital not found' })
    }

    // Start transaction
    await pool.query('START TRANSACTION')

    try {
      const transferResults = []

      for (const transfer of transfers) {
        const { inventoryId, units } = transfer

        if (!inventoryId || !units || units <= 0) {
          throw new Error('Invalid transfer data: inventoryId and positive units required')
        }

        // Get current inventory item
        const [inventoryRows] = await pool.query(
          'SELECT id, available_units, blood_type, expiration_date FROM blood_inventory WHERE id = ? AND status = ? AND (hospital_id IS NULL OR hospital_id = 0)',
          [inventoryId, 'available'],
        )

        if (inventoryRows.length === 0) {
          throw new Error(`Inventory item ${inventoryId} not found or not available`)
        }

        const inventory = inventoryRows[0]
        if (inventory.available_units < units) {
          throw new Error(
            `Insufficient units: requested ${units}, available ${inventory.available_units}`,
          )
        }

        // Update source inventory (reduce available units)
        await pool.query(
          'UPDATE blood_inventory SET available_units = available_units - ? WHERE id = ?',
          [units, inventoryId],
        )

        // Create or update destination inventory
        const [existingDest] = await pool.query(
          'SELECT id, available_units FROM blood_inventory WHERE hospital_id = ? AND blood_type = ? AND expiration_date = ? AND status = ?',
          [hospitalId, inventory.blood_type, inventory.expiration_date, 'available'],
        )

        if (existingDest.length > 0) {
          // Update existing inventory
          await pool.query(
            'UPDATE blood_inventory SET available_units = available_units + ?, units = units + ? WHERE id = ?',
            [units, units, existingDest[0].id],
          )
        } else {
          // Create new inventory entry for hospital
          await pool.query(
            `INSERT INTO blood_inventory 
             (blood_type, units, available_units, expiration_date, status, added_by, hospital_id)
             VALUES (?, ?, ?, ?, 'available', ?, ?)`,
            [
              inventory.blood_type,
              units,
              units,
              inventory.expiration_date,
              req.user.id,
              hospitalId,
            ],
          )
        }

        // Record transfer in blood_transfers table
        await pool.query(
          `INSERT INTO blood_transfers 
           (source_inventory_id, hospital_id, blood_type, units_transferred, transferred_by, transfer_date)
           VALUES (?, ?, ?, ?, ?, NOW())`,
          [inventoryId, hospitalId, inventory.blood_type, units, req.user.id],
        )

        transferResults.push({
          inventoryId,
          bloodType: inventory.blood_type,
          units,
        })
      }

      // Handle request fulfillment if provided
      if (requestFulfillments && Array.isArray(requestFulfillments)) {
        for (const fulfillment of requestFulfillments) {
          const { requestId, unitsTransferred } = fulfillment
          
          if (!requestId || !unitsTransferred || unitsTransferred <= 0) continue

          // Get current request status and units
          const [requestRows] = await pool.query(
            'SELECT id, units_requested, status FROM blood_requests WHERE id = ?',
            [requestId],
          )

          if (requestRows.length === 0) continue

          const request = requestRows[0]
          
          // Calculate total fulfilled units (existing + new)
          const [transferRows] = await pool.query(
            `SELECT COALESCE(SUM(units_transferred), 0) as total_fulfilled
             FROM blood_transfers bt
             INNER JOIN blood_requests br ON bt.blood_type COLLATE utf8mb4_unicode_ci = br.blood_type COLLATE utf8mb4_unicode_ci
             WHERE bt.hospital_id = ? 
               AND br.id = ?
               AND bt.transfer_date >= br.request_date`,
            [hospitalId, requestId],
          )

          const totalFulfilled = transferRows[0]?.total_fulfilled || 0
          const remainingBalance = request.units_requested - totalFulfilled

          // Update request status based on fulfillment
          let newStatus = request.status
          if (remainingBalance <= 0) {
            newStatus = 'fulfilled'
          } else if (totalFulfilled > 0) {
            newStatus = 'partially_fulfilled'
          }

          await pool.query(
            `UPDATE blood_requests 
             SET status = ?, units_approved = COALESCE(units_approved, ?)
             WHERE id = ?`,
            [newStatus, totalFulfilled, requestId],
          )
        }
      }

      // Commit transaction
      await pool.query('COMMIT')

      res.json({
        message: 'Transfer completed successfully',
        transfers: transferResults,
      })
    } catch (error) {
      // Rollback on error
      await pool.query('ROLLBACK')
      throw error
    }
  } catch (error) {
    console.error('Transfer error:', error)
    res.status(500).json({ message: error.message || 'Failed to transfer blood stocks' })
  }
})

// GET /api/admin/transfers
router.get('/transfers', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10
    const [rows] = await pool.query(
      `
      SELECT 
        bt.id,
        bt.blood_type,
        bt.units_transferred,
        bt.transfer_date,
        h.hospital_name,
        u.full_name AS transferred_by_name
      FROM blood_transfers bt
      JOIN hospitals h ON bt.hospital_id = h.id
      LEFT JOIN users u ON bt.transferred_by = u.id
      ORDER BY bt.transfer_date DESC
      LIMIT ?
    `,
      [limit],
    )
    res.json(rows)
  } catch (error) {
    console.error('Fetch transfers error:', error)
    res.status(500).json({ message: 'Failed to fetch transfers' })
  }
})

// ===== Blood Requests (from hospitals) =====

// GET /api/admin/requests
router.get('/requests', async (req, res) => {
  try {
    const [rows] = await pool.query(
      `
      SELECT br.*, h.hospital_name
      FROM blood_requests br
      JOIN hospitals h ON br.hospital_id = h.id
      ORDER BY br.request_date DESC
    `,
    )
    res.json(rows)
  } catch (error) {
    console.error('Fetch requests error:', error)
    res.status(500).json({ message: 'Failed to fetch requests' })
  }
})

// PATCH /api/admin/requests/:id/status
router.patch('/requests/:id/status', async (req, res) => {
  const { id } = req.params
  const { status, unitsApproved, notes } = req.body

  if (!['approved', 'rejected', 'cancelled', 'fulfilled', 'partially_fulfilled'].includes(status)) {
    return res.status(400).json({ message: 'Invalid status value' })
  }

  try {
    const [result] = await pool.query(
      `
      UPDATE blood_requests
      SET status = ?, units_approved = COALESCE(?, units_approved), approved_by = ?, approved_at = NOW(), notes = COALESCE(?, notes)
      WHERE id = ?
    `,
      [status, unitsApproved ?? null, req.user.id, notes ?? null, id],
    )

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Request not found' })
    }

    res.json({ message: 'Request updated' })
  } catch (error) {
    console.error('Update request status error:', error)
    res.status(500).json({ message: 'Failed to update request status' })
  }
})

// ===== Analytics & Wastage Reduction =====

// GET /api/admin/analytics/wastage-predictions
router.get('/analytics/wastage-predictions', async (req, res) => {
  try {
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    // Get historical wastage data (last 90 days)
    const [historicalWastage] = await pool.query(
      `
      SELECT 
        blood_type,
        COUNT(*) as wasted_count,
        SUM(available_units) as wasted_units
      FROM blood_inventory
      WHERE status = 'expired'
        AND expiration_date >= DATE_SUB(CURDATE(), INTERVAL 90 DAY)
      GROUP BY blood_type
    `,
    )

    // Get current inventory at risk
    const [atRiskInventory] = await pool.query(
      `
      SELECT 
        id,
        blood_type,
        available_units,
        expiration_date,
        status,
        hospital_id,
        DATEDIFF(expiration_date, CURDATE()) as days_until_expiry
      FROM blood_inventory
      WHERE status = 'available'
        AND expiration_date > CURDATE()
        AND available_units > 0
      ORDER BY expiration_date ASC
    `,
    )

    // Get demand patterns (last 30 days)
    const [demandData] = await pool.query(
      `
      SELECT 
        blood_type,
        SUM(units_requested) as total_demand,
        COUNT(*) as request_count
      FROM blood_requests
      WHERE request_date >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
        AND status IN ('pending', 'approved', 'fulfilled')
      GROUP BY blood_type
    `,
    )

    // Get total inventory by blood type
    const [inventorySummary] = await pool.query(
      `
      SELECT 
        blood_type,
        SUM(available_units) as total_available,
        SUM(CASE WHEN DATEDIFF(expiration_date, CURDATE()) <= 7 AND DATEDIFF(expiration_date, CURDATE()) > 0 THEN available_units ELSE 0 END) as near_expiry_units,
        SUM(CASE WHEN DATEDIFF(expiration_date, CURDATE()) <= 7 THEN available_units ELSE 0 END) as expiring_7days
      FROM blood_inventory
      WHERE status = 'available'
        AND expiration_date > CURDATE()
        AND available_units > 0
      GROUP BY blood_type
    `,
    )

    // Calculate wastage rates by blood type
    const wastageRates = {}
    historicalWastage.forEach((item) => {
      wastageRates[item.blood_type] = {
        wastedUnits: item.wasted_units || 0,
        wastedCount: item.wasted_count || 0,
      }
    })

    // Calculate demand factors
    const demandFactors = {}
    const totalDemand = demandData.reduce((sum, item) => sum + (item.total_demand || 0), 0)
    demandData.forEach((item) => {
      demandFactors[item.blood_type] = totalDemand > 0 ? (item.total_demand || 0) / totalDemand : 0
    })

    // Calculate risk scores for each inventory item
    const inventoryWithRisk = atRiskInventory.map((item) => {
      const daysUntilExpiry = item.days_until_expiry || 0
      const bloodType = item.blood_type

      // Days until expiry factor (0-40 points): fewer days = higher risk
      let expiryFactor = 0
      if (daysUntilExpiry <= 3) expiryFactor = 40
      else if (daysUntilExpiry <= 7) expiryFactor = 30
      else if (daysUntilExpiry <= 14) expiryFactor = 20
      else if (daysUntilExpiry <= 30) expiryFactor = 10
      else expiryFactor = 5

      // Historical wastage factor (0-30 points)
      const wastageRate = wastageRates[bloodType]?.wastedUnits || 0
      const wastageFactor = Math.min(30, (wastageRate / 10) * 5) // Scale based on historical wastage

      // Demand factor (0-20 points): low demand = higher risk
      const demandFactor = demandFactors[bloodType] || 0
      const demandRiskFactor = demandFactor < 0.1 ? 20 : demandFactor < 0.2 ? 10 : 5

      // Inventory level factor (0-10 points): high inventory = higher risk
      const inventorySummaryItem = inventorySummary.find((inv) => inv.blood_type === bloodType)
      const totalAvailable = inventorySummaryItem?.total_available || 0
      const inventoryFactor = totalAvailable > 50 ? 10 : totalAvailable > 20 ? 5 : 0

      const riskScore = Math.min(100, Math.round(expiryFactor + wastageFactor + demandRiskFactor + inventoryFactor))

      return {
        ...item,
        riskScore,
        expiryFactor,
        wastageFactor: Math.round(wastageFactor),
        demandRiskFactor,
        inventoryFactor,
      }
    })

    // Calculate predicted wastage for next 7, 14, 30 days
    const predictWastage = (days) => {
      const expiringSoon = inventoryWithRisk.filter(
        (item) => item.days_until_expiry <= days && item.days_until_expiry > 0,
      )
      const avgWastageRate = 0.15 // 15% average wastage rate (can be calculated from historical data)
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

    // Group by blood type for summary
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

    // Calculate average risk scores
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
    console.error('Wastage predictions error:', error)
    res.status(500).json({ message: 'Failed to fetch wastage predictions' })
  }
})

// GET /api/admin/analytics/wastage-prescriptions
router.get('/analytics/wastage-prescriptions', async (req, res) => {
  try {
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    // Get high-risk inventory (expiring soon or high risk score)
    const [highRiskInventory] = await pool.query(
      `
      SELECT 
        bi.id,
        bi.blood_type,
        bi.available_units,
        bi.expiration_date,
        bi.status,
        bi.hospital_id,
        DATEDIFF(bi.expiration_date, CURDATE()) as days_until_expiry
      FROM blood_inventory bi
      WHERE bi.status = 'available'
        AND bi.expiration_date > CURDATE()
        AND bi.expiration_date <= DATE_ADD(CURDATE(), INTERVAL 14 DAY)
        AND bi.available_units > 0
        AND (bi.hospital_id IS NULL OR bi.hospital_id = 0)
      ORDER BY bi.expiration_date ASC, bi.available_units DESC
    `,
    )

    // Get pending requests from hospitals
    const [pendingRequests] = await pool.query(
      `
      SELECT 
        br.id,
        br.hospital_id,
        br.blood_type,
        br.units_requested,
        br.request_date,
        h.hospital_name
      FROM blood_requests br
      JOIN hospitals h ON br.hospital_id = h.id
      WHERE br.status = 'pending'
      ORDER BY br.request_date ASC
    `,
    )

    // Get hospital inventory levels
    const [hospitalInventory] = await pool.query(
      `
      SELECT 
        hospital_id,
        blood_type,
        SUM(available_units) as total_available
      FROM blood_inventory
      WHERE hospital_id IS NOT NULL
        AND status = 'available'
        AND expiration_date > CURDATE()
      GROUP BY hospital_id, blood_type
    `,
    )

    // Generate transfer recommendations
    const transferRecommendations = []
    const processedRequests = new Set()

    highRiskInventory.forEach((inventory) => {
      // Find matching pending requests
      const matchingRequests = pendingRequests.filter(
        (req) =>
          req.blood_type === inventory.blood_type &&
          req.units_requested > 0 &&
          !processedRequests.has(req.id),
      )

      if (matchingRequests.length > 0) {
        // Prioritize by request date (older requests first)
        matchingRequests.sort((a, b) => new Date(a.request_date) - new Date(b.request_date))

        matchingRequests.forEach((request) => {
          const unitsToTransfer = Math.min(
            inventory.available_units,
            request.units_requested,
          )

          if (unitsToTransfer > 0) {
            transferRecommendations.push({
              type: 'transfer',
              priority: inventory.days_until_expiry <= 3 ? 'high' : inventory.days_until_expiry <= 7 ? 'medium' : 'low',
              inventoryId: inventory.id,
              bloodType: inventory.blood_type,
              units: unitsToTransfer,
              daysUntilExpiry: inventory.days_until_expiry,
              targetHospitalId: request.hospital_id,
              targetHospitalName: request.hospital_name,
              requestId: request.id,
              impact: `Prevent ${unitsToTransfer} units from expiring`,
              reason: `Match expiring inventory with pending request from ${request.hospital_name}`,
            })

            processedRequests.add(request.id)
            inventory.available_units -= unitsToTransfer
          }
        })
      }
    })

    // Generate priority actions
    const priorityActions = []

    // Action 1: Items expiring in next 3 days
    const expiring3Days = highRiskInventory.filter((item) => item.days_until_expiry <= 3 && item.available_units > 0)
    if (expiring3Days.length > 0) {
      const totalUnits = expiring3Days.reduce((sum, item) => sum + item.available_units, 0)
      priorityActions.push({
        type: 'urgent_alert',
        priority: 'critical',
        title: 'Critical: Blood Expiring in 3 Days',
        description: `${totalUnits} units expiring within 3 days. Immediate action required.`,
        bloodTypes: [...new Set(expiring3Days.map((item) => item.blood_type))],
        affectedUnits: totalUnits,
        action: 'Review and transfer to hospitals with high demand immediately',
      })
    }

    // Action 2: High inventory with low demand
    const [lowDemandBloodTypes] = await pool.query(
      `
      SELECT 
        bi.blood_type,
        SUM(bi.available_units) as total_inventory,
        COALESCE(SUM(br.units_requested), 0) as total_demand
      FROM blood_inventory bi
      LEFT JOIN blood_requests br ON bi.blood_type = br.blood_type 
        AND br.status = 'pending'
        AND br.request_date >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)
      WHERE bi.status = 'available'
        AND bi.expiration_date > CURDATE()
        AND bi.available_units > 0
        AND (bi.hospital_id IS NULL OR bi.hospital_id = 0)
      GROUP BY bi.blood_type
      HAVING total_inventory > 30 AND total_demand < 5
    `,
    )

    lowDemandBloodTypes.forEach((item) => {
      priorityActions.push({
        type: 'inventory_adjustment',
        priority: 'medium',
        title: `Reduce Donations: ${item.blood_type}`,
        description: `High inventory (${item.total_inventory} units) with low demand (${item.total_demand} units requested). Consider reducing donation targets.`,
        bloodType: item.blood_type,
        action: 'Adjust donation collection targets for this blood type',
      })
    })

    // Action 3: Near-expiry items without matching requests
    const unmatchedNearExpiry = highRiskInventory.filter(
      (item) =>
        item.days_until_expiry <= 7 &&
        !transferRecommendations.some((rec) => rec.inventoryId === item.id) &&
        item.available_units > 0,
    )

    if (unmatchedNearExpiry.length > 0) {
      const totalUnmatched = unmatchedNearExpiry.reduce((sum, item) => sum + item.available_units, 0)
      priorityActions.push({
        type: 'alert',
        priority: 'high',
        title: 'Near-Expiry Items Need Attention',
        description: `${totalUnmatched} units expiring within 7 days without matching requests.`,
        bloodTypes: [...new Set(unmatchedNearExpiry.map((item) => item.blood_type))],
        affectedUnits: totalUnmatched,
        action: 'Contact hospitals to check if they need these blood types',
      })
    }

    // Sort recommendations by priority
    transferRecommendations.sort((a, b) => {
      const priorityOrder = { high: 3, medium: 2, low: 1 }
      return priorityOrder[b.priority] - priorityOrder[a.priority]
    })

    res.json({
      transferRecommendations: transferRecommendations.slice(0, 20), // Top 20 recommendations
      priorityActions,
      summary: {
        totalRecommendations: transferRecommendations.length,
        criticalActions: priorityActions.filter((a) => a.priority === 'critical').length,
        estimatedWastageReduction: transferRecommendations.reduce(
          (sum, rec) => sum + (rec.units || 0),
          0,
        ),
      },
    })
  } catch (error) {
    console.error('Wastage prescriptions error:', error)
    res.status(500).json({ message: 'Failed to fetch wastage prescriptions' })
  }
})

// GET /api/admin/analytics/historical-wastage
router.get('/analytics/historical-wastage', async (req, res) => {
  try {
    const { days = 90 } = req.query

    // Get wastage by date
    const [wastageByDate] = await pool.query(
      `
      SELECT 
        DATE(expiration_date) as date,
        blood_type,
        SUM(available_units) as wasted_units,
        COUNT(*) as wasted_count
      FROM blood_inventory
      WHERE status = 'expired'
        AND expiration_date >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
      GROUP BY DATE(expiration_date), blood_type
      ORDER BY date DESC
    `,
      [parseInt(days, 10)],
    )

    // Get wastage by blood type
    const [wastageByBloodType] = await pool.query(
      `
      SELECT 
        blood_type,
        SUM(available_units) as total_wasted,
        COUNT(*) as count
      FROM blood_inventory
      WHERE status = 'expired'
        AND expiration_date >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
      GROUP BY blood_type
      ORDER BY total_wasted DESC
    `,
      [parseInt(days, 10)],
    )

    // Get total wastage directly from database for accuracy
    const [totalWastageResult] = await pool.query(
      `
      SELECT COALESCE(SUM(available_units), 0) as total_wastage
      FROM blood_inventory
      WHERE status = 'expired'
        AND expiration_date >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
    `,
      [parseInt(days, 10)],
    )

    // Calculate total wastage (ensure numbers are properly converted)
    const totalWastage = Number(totalWastageResult[0]?.total_wastage || 0)
    
    // Also ensure wastageByBloodType has proper number types
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
    console.error('Historical wastage error:', error)
    res.status(500).json({ message: 'Failed to fetch historical wastage' })
  }
})

module.exports = router


