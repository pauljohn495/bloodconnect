const express = require('express')

const { pool } = require('../db')
const auth = require('../middleware/auth')

const router = express.Router()

// All admin routes require admin role
router.use(auth(['admin']))

// GET /api/admin/dashboard-summary
router.get('/dashboard-summary', async (req, res) => {
  try {
    const [[bloodStockRows], [donorSummaryRows], [pendingRequestsRows], [countsRows]] =
      await Promise.all([
        pool.query('SELECT * FROM v_blood_stock_summary'),
        // Donor summary derived directly from users/donations instead of a DB view
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
        componentType: req.component_type || 'whole_blood',
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

// GET /api/admin/donors - list donor users
router.get('/donors', async (req, res) => {
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
})

// POST /api/admin/donors - create donor user (admin side)
router.post('/donors', async (req, res) => {
  const { donorName, bloodType, contactPhone, contactEmail, username, password } = req.body

  if (!donorName || !bloodType || !contactPhone || !username || !password) {
    return res
      .status(400)
      .json({ message: 'donorName, bloodType, contactPhone, username and password are required' })
  }

  try {
    // Ensure username is unique
    const [existingUserByUsername] = await pool.query(
      'SELECT id FROM users WHERE username = ? LIMIT 1',
      [username],
    )
    if (existingUserByUsername.length > 0) {
      return res.status(400).json({ message: 'Username is already taken' })
    }

    // Ensure phone is unique
    const [existingUserByPhone] = await pool.query(
      'SELECT id FROM users WHERE phone = ? LIMIT 1',
      [contactPhone],
    )
    if (existingUserByPhone.length > 0) {
      return res.status(400).json({ message: 'Mobile number is already registered' })
    }

    // Ensure email uniqueness if provided
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
    const passwordHash = await bcrypt.hash(password, 10)

    const safeEmail =
      contactEmail && contactEmail.trim() !== ''
        ? contactEmail.trim()
        : `${contactPhone}@noemail.bloodconnect`

    const [result] = await pool.query(
      `
      INSERT INTO users (username, email, password_hash, role, full_name, phone, blood_type, status, last_donation_date)
      VALUES (?, ?, ?, 'donor', ?, ?, ?, 'active', NULL)
    `,
      [username, safeEmail, passwordHash, donorName, contactPhone, bloodType],
    )

    res.status(201).json({
      id: result.insertId,
      donorName,
      bloodType,
      contactPhone,
      contactEmail: contactEmail || null,
      username,
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

    // Add default component_type if column doesn't exist
    const rowsWithComponent = rows.map((row) => ({
      ...row,
      component_type: row.component_type || 'whole_blood', // Default to whole_blood if not specified
    }))

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
      rowsWithComponent.map(async (row) => {
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
  const { bloodType, units, expirationDate, hospitalId, componentType } = req.body

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

    // Check if component_type column exists, if not default to 'whole_blood'
    const component = componentType || 'whole_blood'

    // Try to insert with component_type if column exists
    let result
    try {
      const [result1] = await pool.query(
        `
        INSERT INTO blood_inventory
          (blood_type, units, available_units, expiration_date, status, added_by, hospital_id, component_type)
        VALUES (?, ?, ?, ?, 'available', ?, ?, ?)
      `,
        [bloodType, intUnits, intUnits, expirationDate, req.user.id, hospitalId || null, component],
      )
      result = result1
    } catch (error) {
      // If component_type column doesn't exist, insert without it
      if (error.code === 'ER_BAD_FIELD_ERROR' || error.message.includes('component_type')) {
        const [result2] = await pool.query(
          `
          INSERT INTO blood_inventory
            (blood_type, units, available_units, expiration_date, status, added_by, hospital_id)
          VALUES (?, ?, ?, ?, 'available', ?, ?)
        `,
          [bloodType, intUnits, intUnits, expirationDate, req.user.id, hospitalId || null],
        )
        result = result2
      } else {
        throw error
      }
    }

    res.status(201).json({
      id: result.insertId,
      bloodType,
      units: intUnits,
      availableUnits: intUnits,
      expirationDate,
      hospitalId: hospitalId || null,
      componentType: component,
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

        // Get current inventory item (include component_type when available)
        const [inventoryRows] = await pool.query(
          `
          SELECT 
            id,
            available_units,
            blood_type,
            expiration_date,
            COALESCE(component_type, 'whole_blood') AS component_type
          FROM blood_inventory
          WHERE id = ?
            AND status = ?
            AND (hospital_id IS NULL OR hospital_id = 0)
        `,
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
        const component = inventory.component_type || 'whole_blood'
        const [existingDest] = await pool.query(
          `
          SELECT 
            id,
            available_units
          FROM blood_inventory
          WHERE hospital_id = ?
            AND blood_type = ?
            AND expiration_date = ?
            AND COALESCE(component_type, 'whole_blood') = ?
            AND status = ?
        `,
          [
            hospitalId,
            inventory.blood_type,
            inventory.expiration_date,
            component,
            'available',
          ],
        )

        if (existingDest.length > 0) {
          // Update existing inventory
          await pool.query(
            'UPDATE blood_inventory SET available_units = available_units + ?, units = units + ? WHERE id = ?',
            [units, units, existingDest[0].id],
          )
        } else {
          // Create new inventory entry for hospital, preserving component_type when the column exists
          try {
            await pool.query(
              `
              INSERT INTO blood_inventory 
                (blood_type, units, available_units, expiration_date, status, added_by, hospital_id, component_type)
              VALUES (?, ?, ?, ?, 'available', ?, ?, ?)
            `,
              [
                inventory.blood_type,
                units,
                units,
                inventory.expiration_date,
                req.user.id,
                hospitalId,
                component,
              ],
            )
          } catch (error) {
            if (
              error.code === 'ER_BAD_FIELD_ERROR' ||
              (error.message && error.message.includes('component_type'))
            ) {
              await pool.query(
                `
                INSERT INTO blood_inventory 
                  (blood_type, units, available_units, expiration_date, status, added_by, hospital_id)
                VALUES (?, ?, ?, ?, 'available', ?, ?)
              `,
                [
                  inventory.blood_type,
                  units,
                  units,
                  inventory.expiration_date,
                  req.user.id,
                  hospitalId,
                ],
              )
            } else {
              throw error
            }
          }
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
    // Add default component_type if column doesn't exist
    const rowsWithComponent = rows.map((row) => ({
      ...row,
      component_type: row.component_type || 'whole_blood',
    }))
    res.json(rowsWithComponent)
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

    // Get historical wastage data (last 90 days) - grouped by blood_type and component_type
    const [historicalWastage] = await pool.query(
      `
      SELECT 
        blood_type,
        COALESCE(component_type, 'whole_blood') as component_type,
        COUNT(*) as wasted_count,
        SUM(available_units) as wasted_units
      FROM blood_inventory
      WHERE status = 'expired'
        AND expiration_date >= DATE_SUB(CURDATE(), INTERVAL 90 DAY)
      GROUP BY blood_type, component_type
    `,
    )

    // Get current inventory at risk
    const [atRiskInventory] = await pool.query(
      `
      SELECT 
        id,
        blood_type,
        COALESCE(component_type, 'whole_blood') as component_type,
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

    // Get demand patterns (last 30 days) - grouped by blood_type and component_type
    const [demandData] = await pool.query(
      `
      SELECT 
        blood_type,
        COALESCE(component_type, 'whole_blood') as component_type,
        SUM(units_requested) as total_demand,
        COUNT(*) as request_count
      FROM blood_requests
      WHERE request_date >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
        AND status IN ('pending', 'approved', 'fulfilled')
      GROUP BY blood_type, component_type
    `,
    )

    // Get total inventory by blood type and component type
    const [inventorySummary] = await pool.query(
      `
      SELECT 
        blood_type,
        COALESCE(component_type, 'whole_blood') as component_type,
        SUM(available_units) as total_available,
        SUM(CASE WHEN DATEDIFF(expiration_date, CURDATE()) <= 7 AND DATEDIFF(expiration_date, CURDATE()) > 0 THEN available_units ELSE 0 END) as near_expiry_units,
        SUM(CASE WHEN DATEDIFF(expiration_date, CURDATE()) <= 7 THEN available_units ELSE 0 END) as expiring_7days
      FROM blood_inventory
      WHERE status = 'available'
        AND expiration_date > CURDATE()
        AND available_units > 0
      GROUP BY blood_type, component_type
    `,
    )

    // Calculate wastage rates by blood type and component type
    const wastageRates = {}
    historicalWastage.forEach((item) => {
      const key = `${item.blood_type}_${item.component_type || 'whole_blood'}`
      wastageRates[key] = {
        wastedUnits: item.wasted_units || 0,
        wastedCount: item.wasted_count || 0,
      }
    })

    // Calculate demand factors by blood type and component type
    const demandFactors = {}
    const totalDemand = demandData.reduce((sum, item) => sum + (item.total_demand || 0), 0)
    demandData.forEach((item) => {
      const key = `${item.blood_type}_${item.component_type || 'whole_blood'}`
      demandFactors[key] = totalDemand > 0 ? (item.total_demand || 0) / totalDemand : 0
    })

    // Calculate risk scores for each inventory item
    const inventoryWithRisk = atRiskInventory.map((item) => {
      const daysUntilExpiry = item.days_until_expiry || 0
      const bloodType = item.blood_type
      const componentType = item.component_type || 'whole_blood'
      const key = `${bloodType}_${componentType}`

      // Days until expiry factor (0-40 points): fewer days = higher risk
      let expiryFactor = 0
      if (daysUntilExpiry <= 3) expiryFactor = 40
      else if (daysUntilExpiry <= 7) expiryFactor = 30
      else if (daysUntilExpiry <= 14) expiryFactor = 20
      else if (daysUntilExpiry <= 30) expiryFactor = 10
      else expiryFactor = 5

      // Historical wastage factor (0-30 points)
      const wastageRate = wastageRates[key]?.wastedUnits || 0
      const wastageFactor = Math.min(30, (wastageRate / 10) * 5) // Scale based on historical wastage

      // Demand factor (0-20 points): low demand = higher risk
      const demandFactor = demandFactors[key] || 0
      const demandRiskFactor = demandFactor < 0.1 ? 20 : demandFactor < 0.2 ? 10 : 5

      // Inventory level factor (0-10 points): high inventory = higher risk
      const inventorySummaryItem = inventorySummary.find(
        (inv) => inv.blood_type === bloodType && (inv.component_type || 'whole_blood') === componentType,
      )
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

    // Group by blood type and component type for summary
    const wastageByBloodType = {}
    inventoryWithRisk.forEach((item) => {
      const componentType = item.component_type || 'whole_blood'
      const key = `${item.blood_type}_${componentType}`
      if (!wastageByBloodType[key]) {
        wastageByBloodType[key] = {
          bloodType: item.blood_type,
          componentType: componentType,
          totalAtRisk: 0,
          highRiskUnits: 0,
          averageRiskScore: 0,
          items: [],
        }
      }
      wastageByBloodType[key].totalAtRisk += item.available_units
      wastageByBloodType[key].items.push(item)
      if (item.riskScore >= 70) {
        wastageByBloodType[key].highRiskUnits += item.available_units
      }
    })

    // Calculate average risk scores
    Object.keys(wastageByBloodType).forEach((key) => {
      const group = wastageByBloodType[key]
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
        COALESCE(bi.component_type, 'whole_blood') as component_type,
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
        COALESCE(br.component_type, 'whole_blood') as component_type,
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
      // Find matching pending requests (match by blood_type AND component_type)
      const matchingRequests = pendingRequests.filter(
        (req) =>
          req.blood_type === inventory.blood_type &&
          (req.component_type || 'whole_blood') === (inventory.component_type || 'whole_blood') &&
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
              componentType: inventory.component_type || 'whole_blood',
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

    // Action 2: High inventory with low demand (by blood_type and component_type)
    const [lowDemandBloodTypes] = await pool.query(
      `
      SELECT 
        bi.blood_type,
        COALESCE(bi.component_type, 'whole_blood') as component_type,
        SUM(bi.available_units) as total_inventory,
        COALESCE(SUM(br.units_requested), 0) as total_demand
      FROM blood_inventory bi
      LEFT JOIN blood_requests br ON bi.blood_type = br.blood_type 
        AND COALESCE(bi.component_type, 'whole_blood') = COALESCE(br.component_type, 'whole_blood')
        AND br.status = 'pending'
        AND br.request_date >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)
      WHERE bi.status = 'available'
        AND bi.expiration_date > CURDATE()
        AND bi.available_units > 0
        AND (bi.hospital_id IS NULL OR bi.hospital_id = 0)
      GROUP BY bi.blood_type, bi.component_type
      HAVING total_inventory > 30 AND total_demand < 5
    `,
    )

    lowDemandBloodTypes.forEach((item) => {
      const componentLabel = item.component_type === 'whole_blood' ? 'Whole Blood' : item.component_type === 'platelets' ? 'Platelets' : 'Plasma'
      priorityActions.push({
        type: 'inventory_adjustment',
        priority: 'medium',
        title: `Reduce Donations: ${item.blood_type} ${componentLabel}`,
        description: `High inventory (${item.total_inventory} units) with low demand (${item.total_demand} units requested). Consider reducing donation targets.`,
        bloodType: item.blood_type,
        componentType: item.component_type,
        action: `Adjust donation collection targets for ${item.blood_type} ${componentLabel}`,
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

    // Get wastage by date (grouped by blood_type and component_type)
    const [wastageByDate] = await pool.query(
      `
      SELECT 
        DATE(expiration_date) as date,
        blood_type,
        COALESCE(component_type, 'whole_blood') as component_type,
        SUM(available_units) as wasted_units,
        COUNT(*) as wasted_count
      FROM blood_inventory
      WHERE status = 'expired'
        AND expiration_date >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
      GROUP BY DATE(expiration_date), blood_type, component_type
      ORDER BY date DESC
    `,
      [parseInt(days, 10)],
    )

    // Get wastage by blood type and component type
    const [wastageByBloodType] = await pool.query(
      `
      SELECT 
        blood_type,
        COALESCE(component_type, 'whole_blood') as component_type,
        SUM(available_units) as total_wasted,
        COUNT(*) as count
      FROM blood_inventory
      WHERE status = 'expired'
        AND expiration_date >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
      GROUP BY blood_type, component_type
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

// ===== Schedule Requests =====

// GET /api/admin/schedule-requests - get all schedule requests
router.get('/schedule-requests', async (req, res) => {
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
    // Add default component_type if column doesn't exist
    const rowsWithComponent = rows.map((row) => ({
      ...row,
      component_type: row.component_type || 'whole_blood',
    }))
    res.json(rowsWithComponent)
  } catch (error) {
    console.error('Fetch schedule requests error:', error)
    res.status(500).json({ message: 'Failed to fetch schedule requests' })
  }
})

// GET /api/admin/schedule-requests/:id - get schedule request details
router.get('/schedule-requests/:id', async (req, res) => {
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

    if (rows.length === 0) {
      return res.status(404).json({ message: 'Schedule request not found' })
    }

    const request = rows[0]
    // Parse JSON fields
    if (request.health_screening_answers && typeof request.health_screening_answers === 'string') {
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
})

// PATCH /api/admin/schedule-requests/:id/approve - approve schedule request
router.patch('/schedule-requests/:id/approve', async (req, res) => {
  const { id } = req.params
  const { adminNotes } = req.body

  try {
    // Get the request first to get user_id and preferred date/time
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

    // Update request status
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

    // Create notification for donor
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
})

// PATCH /api/admin/schedule-requests/:id/reject - reject schedule request
router.patch('/schedule-requests/:id/reject', async (req, res) => {
  const { id } = req.params
  const { rejectionReason } = req.body

  if (!rejectionReason || rejectionReason.trim() === '') {
    return res.status(400).json({ message: 'rejectionReason is required' })
  }

  try {
    // Get the request first to get user_id
    const [requestRows] = await pool.query(
      'SELECT user_id FROM schedule_requests WHERE id = ?',
      [id],
    )

    if (requestRows.length === 0) {
      return res.status(404).json({ message: 'Schedule request not found' })
    }

    const userId = requestRows[0].user_id

    // Update request status
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

    // Create notification for donor
    await pool.query(
      `
      INSERT INTO notifications (user_id, title, message, type)
      VALUES (?, ?, ?, 'warning')
    `,
      [
        userId,
        'Schedule Request Rejected',
        `Your schedule request was rejected. Reason: ${rejectionReason}`,
      ],
    )

    res.json({ message: 'Schedule request rejected successfully' })
  } catch (error) {
    console.error('Reject schedule request error:', error)
    res.status(500).json({ message: 'Failed to reject schedule request' })
  }
})

// PATCH /api/admin/schedule-requests/:id/complete - complete schedule request
router.patch('/schedule-requests/:id/complete', async (req, res) => {
  const { id } = req.params

  try {
    // Get the request first to get user_id
    const [requestRows] = await pool.query(
      'SELECT user_id FROM schedule_requests WHERE id = ?',
      [id],
    )

    if (requestRows.length === 0) {
      return res.status(404).json({ message: 'Schedule request not found' })
    }

    const userId = requestRows[0].user_id

    // Update request status to 'completed'
    // Depending on the DB you might also want to update last_donation_date for the donor user
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

    // Let's also update the user's last_donation_date since the donation is completed
    await pool.query(
      `
      UPDATE users
      SET last_donation_date = NOW()
      WHERE id = ?
      `,
      [userId]
    )

    // Create notification for donor
    await pool.query(
      `
      INSERT INTO notifications (user_id, title, message, type)
      VALUES (?, ?, ?, 'success')
    `,
      [
        userId,
        'Donation Completed',
        `Your scheduled donation has been successfully completed. Thank you for your donation!`,
      ],
    )

    res.json({ message: 'Schedule request completed successfully' })
  } catch (error) {
    console.error('Complete schedule request error:', error)
    res.status(500).json({ message: 'Failed to complete schedule request' })
  }
})

module.exports = router


