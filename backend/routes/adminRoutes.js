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
            SELECT SUM(d.units_donated)
            FROM donations d
            WHERE d.hospital_id = h.id
              AND d.status = 'completed'
          ),
          0
        ) AS total_donated_units
      FROM hospitals h
      JOIN users u ON h.user_id = u.id
      ORDER BY h.created_at DESC
    `,
    )
    res.json(rows)
  } catch (error) {
    console.error('Fetch hospitals error:', error)
    res.status(500).json({ message: 'Failed to fetch hospitals' })
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
    const passwordHash = await bcrypt.hash(password, 10)

    const conn = await pool.getConnection()
    try {
      await conn.beginTransaction()

      const [userResult] = await conn.query(
        `
        INSERT INTO users (username, email, password_hash, role, full_name)
        VALUES (?, ?, ?, 'hospital', ?)
      `,
        [username, email, passwordHash, hospitalName],
      )

      const userId = userResult.insertId

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
      throw error
    } finally {
      conn.release()
    }
  } catch (error) {
    console.error('Create hospital error:', error)
    res.status(500).json({ message: 'Failed to create hospital' })
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
  const { hospitalId, transfers } = req.body

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

  if (!['approved', 'rejected', 'cancelled', 'fulfilled'].includes(status)) {
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

module.exports = router


