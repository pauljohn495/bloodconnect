const { pool } = require('../db')
const { ensureBloodRequestStatusSupportsDelivery } = require('../utils/requestStatusSchema')

async function ensureRequestStatusHistory(conn) {
  await conn.query(`
    CREATE TABLE IF NOT EXISTS blood_request_status_history (
      id BIGINT AUTO_INCREMENT PRIMARY KEY,
      request_id BIGINT NOT NULL,
      previous_status VARCHAR(32) NOT NULL,
      new_status VARCHAR(32) NOT NULL,
      changed_by BIGINT NULL,
      notes TEXT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_blood_request_status_history_request (request_id, created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `)
}

async function changeRequestStatus({ requestId, status, unitsApproved, notes, userId }) {
  const conn = await pool.getConnection()
  try {
    await conn.beginTransaction()
    await ensureRequestStatusHistory(conn)
    const [rows] = await conn.query('SELECT id, status, units_requested FROM blood_requests WHERE id = ? FOR UPDATE', [requestId])
    if (!rows.length) {
      const error = new Error('Request not found')
      error.statusCode = 404
      throw error
    }
    const request = rows[0]
    const currentStatus = (request.status || 'pending').toLowerCase()
    const allowed = {
      pending: ['approved', 'rejected', 'cancelled'],
      approved: ['delivered', 'partially_fulfilled', 'fulfilled', 'cancelled'],
      partially_fulfilled: ['delivered', 'fulfilled', 'cancelled'],
      delivered: ['received'],
    }
    if (!(allowed[currentStatus] || []).includes(status)) {
      const error = new Error(`Cannot change a ${currentStatus} request to ${status}`)
      error.statusCode = 409
      throw error
    }
    const approvedUnits = status === 'approved' ? (unitsApproved ?? request.units_requested) : unitsApproved ?? null
    let query = 'UPDATE blood_requests SET status = ?, units_approved = COALESCE(?, units_approved), notes = COALESCE(?, notes)'
    const params = [status, approvedUnits, notes ?? null]
    if (status === 'approved') { query += ', approved_by = ?, approved_at = NOW()'; params.push(userId) }
    await conn.query(`${query} WHERE id = ?`, [...params, requestId])
    await conn.query('INSERT INTO blood_request_status_history (request_id, previous_status, new_status, changed_by, notes) VALUES (?, ?, ?, ?, ?)', [requestId, currentStatus, status, userId, notes ?? null])
    await conn.commit()
    return { previousStatus: currentStatus, status }
  } catch (error) {
    await conn.rollback()
    throw error
  } finally { conn.release() }
}

const createTransferController = async (req, res) => {
  const { hospitalId, transfers, requestFulfillments } = req.body

  if (!hospitalId || !Array.isArray(transfers) || transfers.length === 0) {
    return res.status(400).json({ message: 'hospitalId and transfers array are required' })
  }

  try {
    await ensureBloodRequestStatusSupportsDelivery()

    const [hospitalRows] = await pool.query('SELECT id FROM hospitals WHERE id = ?', [hospitalId])
    if (hospitalRows.length === 0) {
      return res.status(404).json({ message: 'Hospital not found' })
    }

    await pool.query('START TRANSACTION')
    try {
      const transferResults = []

      for (const transfer of transfers) {
        const { inventoryId, units } = transfer
        if (!inventoryId || !units || units <= 0) {
          throw new Error('Invalid transfer data: inventoryId and positive units required')
        }

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

        await pool.query(
          'UPDATE blood_inventory SET available_units = available_units - ? WHERE id = ?',
          [units, inventoryId],
        )

        await pool.query(
          `INSERT INTO blood_transfers 
           (source_inventory_id, hospital_id, blood_type, units_transferred, transferred_by, transfer_date)
           VALUES (?, ?, ?, ?, ?, NOW())`,
          [inventoryId, hospitalId, inventory.blood_type, units, req.user.id],
        )

        const expirationDate = inventory.expiration_date
        const componentType = inventory.component_type || 'whole_blood'
        if (!expirationDate) {
          throw new Error(`Inventory item ${inventoryId} has no expiration date and cannot be transferred`)
        }

        const [existingDestinationRows] = await pool.query(
          `
          SELECT id
          FROM blood_inventory
          WHERE hospital_id = ?
            AND blood_type = ?
            AND expiration_date = ?
            AND COALESCE(component_type, 'whole_blood') = ?
            AND status = 'available'
          LIMIT 1
        `,
          [hospitalId, inventory.blood_type, expirationDate, componentType],
        )

        if (existingDestinationRows.length > 0) {
          await pool.query(
            `
            UPDATE blood_inventory
            SET available_units = available_units + ?, units = units + ?
            WHERE id = ?
          `,
            [units, units, existingDestinationRows[0].id],
          )
        } else {
          try {
            await pool.query(
              `
              INSERT INTO blood_inventory
                (blood_type, units, available_units, expiration_date, status, added_by, hospital_id, component_type)
              VALUES (?, ?, ?, ?, 'available', ?, ?, ?)
            `,
              [inventory.blood_type, units, units, expirationDate, req.user.id, hospitalId, componentType],
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
                [inventory.blood_type, units, units, expirationDate, req.user.id, hospitalId],
              )
            } else {
              throw error
            }
          }
        }

        transferResults.push({
          inventoryId,
          bloodType: inventory.blood_type,
          units,
        })
      }

      if (requestFulfillments && Array.isArray(requestFulfillments)) {
        for (const fulfillment of requestFulfillments) {
          const { requestId, unitsTransferred } = fulfillment
          if (!requestId || !unitsTransferred || unitsTransferred <= 0) continue

          const [requestRows] = await pool.query(
            'SELECT id, units_requested, status FROM blood_requests WHERE id = ?',
            [requestId],
          )
          if (requestRows.length === 0) continue

          const request = requestRows[0]
          let newStatus = request.status
          if (request.status === 'approved' || request.status === 'partially_fulfilled') {
            newStatus = 'delivered'
          }

          await pool.query(
            `UPDATE blood_requests 
             SET status = ?, units_approved = COALESCE(units_approved, ?)
             WHERE id = ?`,
            [newStatus, unitsTransferred, requestId],
          )

          try {
            await pool.query(
              `UPDATE blood_requests
               SET delivered_at = COALESCE(delivered_at, NOW())
               WHERE id = ?`,
              [requestId],
            )
          } catch (err) {
            if (err.code !== 'ER_BAD_FIELD_ERROR') throw err
          }
        }
      }

      await pool.query('COMMIT')
      res.json({ message: 'Transfer completed successfully', transfers: transferResults })
    } catch (error) {
      await pool.query('ROLLBACK')
      throw error
    }
  } catch (error) {
    console.error('Transfer error:', error)
    res.status(500).json({ message: error.message || 'Failed to transfer blood stocks' })
  }
}

const getTransfersController = async (req, res) => {
  try {
    const limit = parseInt(req.query.limit, 10) || 10
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
}

const getRequestsController = async (req, res) => {
  try {
    let rows
    try {
      const [rowsWithPriority] = await pool.query(
        `
        SELECT br.*, h.hospital_name
        FROM blood_requests br
        JOIN hospitals h ON br.hospital_id = h.id
        ORDER BY
          CASE 
            WHEN br.status = 'pending' THEN 0
            ELSE 1
          END,
          CASE 
            WHEN br.priority = 'critical' THEN 0
            WHEN br.priority = 'urgent' THEN 1
            WHEN br.priority = 'normal' OR br.priority IS NULL THEN 2
            ELSE 3
          END,
          br.request_date DESC
      `,
      )
      rows = rowsWithPriority
    } catch (err) {
      if (err.code === 'ER_BAD_FIELD_ERROR') {
        const [rowsFallback] = await pool.query(
          `
          SELECT br.*, h.hospital_name
          FROM blood_requests br
          JOIN hospitals h ON br.hospital_id = h.id
          ORDER BY br.request_date DESC
        `,
        )
        rows = rowsFallback
      } else {
        throw err
      }
    }

    const rowsWithComponent = rows.map((row) => {
      let priority = (row.priority || 'normal').toLowerCase()
      let cleanNotes = row.notes
      if ((!row.priority || row.priority === null) && typeof row.notes === 'string' && row.notes.startsWith('[PRIORITY:')) {
        const match = row.notes.match(/^\[PRIORITY:([a-zA-Z]+)\]\s*(.*)$/)
        if (match) {
          priority = match[1].toLowerCase()
          cleanNotes = match[2] || null
        }
      }
      return {
        ...row,
        component_type: row.component_type || 'whole_blood',
        notes: cleanNotes,
        priority,
      }
    })
    res.json(rowsWithComponent)
  } catch (error) {
    console.error('Fetch requests error:', error)
    res.status(500).json({ message: 'Failed to fetch requests' })
  }
}

const updateRequestStatusController = async (req, res) => {
  const { id } = req.params
  const { status, unitsApproved, notes } = req.body

  if (!['approved', 'rejected', 'cancelled', 'fulfilled', 'partially_fulfilled', 'delivered', 'received'].includes(status)) {
    return res.status(400).json({ message: 'Invalid status value' })
  }

  try {
    await ensureBloodRequestStatusSupportsDelivery()

    await changeRequestStatus({ requestId: id, status, unitsApproved, notes, userId: req.user.id })
    res.json({ message: 'Request updated' })
  } catch (error) {
    console.error('Update request status error:', error)
    res.status(error.statusCode || 500).json({ message: error.message || 'Failed to update request status' })
  }
}

const restoreRequestController = async (req, res) => {
  try {
    await ensureBloodRequestStatusSupportsDelivery()
    const conn = await pool.getConnection()
    try {
      await conn.beginTransaction()
      await ensureRequestStatusHistory(conn)
      const [rows] = await conn.query('SELECT id, status FROM blood_requests WHERE id = ? FOR UPDATE', [req.params.id])
      if (!rows.length) return res.status(404).json({ message: 'Request not found' })
      const previousStatus = (rows[0].status || '').toLowerCase()
      if (!['approved', 'rejected'].includes(previousStatus)) return res.status(409).json({ message: 'Only approved or rejected requests can be restored to pending' })
      await conn.query("UPDATE blood_requests SET status = 'pending', units_approved = NULL WHERE id = ?", [req.params.id])
      await conn.query("INSERT INTO blood_request_status_history (request_id, previous_status, new_status, changed_by, notes) VALUES (?, ?, 'pending', ?, ?)", [req.params.id, previousStatus, req.user.id, 'Restored by administrator'])
      await conn.commit()
      return res.json({ message: 'Request restored to pending' })
    } catch (error) { await conn.rollback(); throw error } finally { conn.release() }
  } catch (error) {
    console.error('Restore request error:', error)
    return res.status(error.statusCode || 500).json({ message: error.message || 'Failed to restore request' })
  }
}

module.exports = {
  createTransferController,
  getTransfersController,
  getRequestsController,
  updateRequestStatusController,
  restoreRequestController,
}

