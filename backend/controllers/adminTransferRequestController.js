const { pool } = require('../db')
const {
  ensureBloodRequestStatusSupportsDelivery,
  ensureBloodRequestTransferAllocations,
} = require('../utils/requestStatusSchema')

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
    await ensureBloodRequestTransferAllocations()
    await ensureRequestStatusHistory(pool)

    const [hospitalRows] = await pool.query('SELECT id FROM hospitals WHERE id = ?', [hospitalId])
    if (hospitalRows.length === 0) {
      return res.status(404).json({ message: 'Hospital not found' })
    }

    const conn = await pool.getConnection()
    try {
      await conn.beginTransaction()
      const transferResults = []

      for (const transfer of transfers) {
        const inventoryId = Number(transfer.inventoryId)
        const units = Number(transfer.units)
        if (!Number.isInteger(inventoryId) || inventoryId <= 0 || !Number.isInteger(units) || units <= 0) {
          const error = new Error('Invalid transfer data: inventoryId and units must be positive integers')
          error.statusCode = 400
          throw error
        }

        const [inventoryRows] = await conn.query(
          `
          SELECT 
            id,
            available_units,
            blood_type,
            expiration_date,
            status,
            COALESCE(component_type, 'whole_blood') AS component_type
          FROM blood_inventory
          WHERE id = ?
            AND status IN ('available', 'near_expiry')
            AND expiration_date >= CURDATE()
            AND (hospital_id IS NULL OR hospital_id = 0)
          FOR UPDATE
        `,
          [inventoryId],
        )

        if (inventoryRows.length === 0) {
          const error = new Error(`Inventory item ${inventoryId} not found, expired, or not available`)
          error.statusCode = 409
          throw error
        }

        const inventory = inventoryRows[0]
        if (Number(inventory.available_units) < units) {
          const error = new Error(
            `Insufficient units: requested ${units}, available ${inventory.available_units}`,
          )
          error.statusCode = 409
          throw error
        }

        await conn.query(
          'UPDATE blood_inventory SET available_units = available_units - ? WHERE id = ?',
          [units, inventoryId],
        )

        const [transferInsert] = await conn.query(
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

        const [existingDestinationRows] = await conn.query(
          `
          SELECT id
          FROM blood_inventory
          WHERE hospital_id = ?
            AND blood_type = ?
            AND expiration_date = ?
            AND COALESCE(component_type, 'whole_blood') = ?
            AND status IN ('available', 'near_expiry')
          LIMIT 1
          FOR UPDATE
        `,
          [hospitalId, inventory.blood_type, expirationDate, componentType],
        )

        if (existingDestinationRows.length > 0) {
          await conn.query(
            `
            UPDATE blood_inventory
            SET available_units = available_units + ?, units = units + ?
            WHERE id = ?
          `,
            [units, units, existingDestinationRows[0].id],
          )
        } else {
          try {
            await conn.query(
              `
              INSERT INTO blood_inventory
                (blood_type, units, available_units, expiration_date, status, added_by, hospital_id, component_type)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            `,
              [inventory.blood_type, units, units, expirationDate, inventory.status, req.user.id, hospitalId, componentType],
            )
          } catch (error) {
            if (
              error.code === 'ER_BAD_FIELD_ERROR' ||
              (error.message && error.message.includes('component_type'))
            ) {
              await conn.query(
                `
                INSERT INTO blood_inventory
                  (blood_type, units, available_units, expiration_date, status, added_by, hospital_id)
                VALUES (?, ?, ?, ?, ?, ?, ?)
              `,
                [inventory.blood_type, units, units, expirationDate, inventory.status, req.user.id, hospitalId],
              )
            } else {
              throw error
            }
          }
        }

        transferResults.push({
          transferId: transferInsert.insertId,
          inventoryId,
          bloodType: inventory.blood_type,
          componentType,
          units,
          remainingUnits: units,
        })
      }

      if (requestFulfillments && Array.isArray(requestFulfillments)) {
        for (const fulfillment of requestFulfillments) {
          const requestId = Number(fulfillment.requestId)
          const unitsTransferred = Number(fulfillment.unitsTransferred)
          if (!Number.isInteger(requestId) || requestId <= 0 || !Number.isInteger(unitsTransferred) || unitsTransferred <= 0) {
            const error = new Error('Each request fulfillment must have positive integer requestId and unitsTransferred values')
            error.statusCode = 400
            throw error
          }

          const [requestRows] = await conn.query(
            `SELECT id, hospital_id, blood_type,
                    COALESCE(component_type, 'whole_blood') AS component_type,
                    units_requested, units_approved, status
             FROM blood_requests
             WHERE id = ? AND hospital_id = ?
             FOR UPDATE`,
            [requestId, hospitalId],
          )
          if (requestRows.length === 0) {
            const error = new Error(`Request ${requestId} does not belong to the destination hospital`)
            error.statusCode = 400
            throw error
          }

          const request = requestRows[0]
          const currentStatus = String(request.status || '').toLowerCase()
          if (!['approved', 'partially_fulfilled'].includes(currentStatus)) {
            const error = new Error(`Request ${requestId} cannot receive a transfer while ${currentStatus}`)
            error.statusCode = 409
            throw error
          }

          const [[allocationRow]] = await conn.query(
            'SELECT COALESCE(SUM(units_allocated), 0) AS allocated FROM blood_request_transfer_allocations WHERE request_id = ?',
            [requestId],
          )
          const targetUnits = Number(request.units_approved || request.units_requested || 0)
          const previouslyAllocated = Number(allocationRow?.allocated || 0)
          const remainingDemand = Math.max(0, targetUnits - previouslyAllocated)
          if (unitsTransferred > remainingDemand) {
            const error = new Error(`Request ${requestId} needs only ${remainingDemand} more unit(s), not ${unitsTransferred}`)
            error.statusCode = 409
            throw error
          }

          let unitsToAllocate = unitsTransferred
          const matchingTransfers = transferResults.filter(
            (item) =>
              item.bloodType === request.blood_type &&
              item.componentType === request.component_type &&
              item.remainingUnits > 0,
          )
          for (const item of matchingTransfers) {
            if (unitsToAllocate === 0) break
            const allocated = Math.min(unitsToAllocate, item.remainingUnits)
            await conn.query(
              `INSERT INTO blood_request_transfer_allocations
                 (request_id, transfer_id, units_allocated)
               VALUES (?, ?, ?)`,
              [requestId, item.transferId, allocated],
            )
            item.remainingUnits -= allocated
            unitsToAllocate -= allocated
          }

          if (unitsToAllocate > 0) {
            const error = new Error(
              `Selected transfers do not contain enough ${request.blood_type} ${request.component_type} units for request ${requestId}`,
            )
            error.statusCode = 409
            throw error
          }

          const totalAllocated = previouslyAllocated + unitsTransferred
          const newStatus = totalAllocated >= targetUnits ? 'delivered' : 'partially_fulfilled'
          await conn.query('UPDATE blood_requests SET status = ? WHERE id = ?', [newStatus, requestId])
          await conn.query(
            `INSERT INTO blood_request_status_history
               (request_id, previous_status, new_status, changed_by, notes)
             VALUES (?, ?, ?, ?, ?)`,
            [requestId, currentStatus, newStatus, req.user.id, `${unitsTransferred} unit(s) allocated to this request`],
          )

          if (newStatus === 'delivered') {
            await conn.query(
              `UPDATE blood_requests
               SET delivered_at = COALESCE(delivered_at, NOW())
               WHERE id = ?`,
              [requestId],
            )
          }
        }
      }

      await conn.commit()
      res.json({
        message: 'Transfer completed successfully',
        transfers: transferResults.map(({ remainingUnits, ...result }) => result),
      })
    } catch (error) {
      await conn.rollback()
      throw error
    } finally {
      conn.release()
    }
  } catch (error) {
    console.error('Transfer error:', error)
    res.status(error.statusCode || 500).json({ message: error.message || 'Failed to transfer blood stocks' })
  }
}

const getTransfersController = async (req, res) => {
  try {
    const parsedLimit = Number.parseInt(req.query.limit, 10)
    const limit = Math.min(Math.max(Number.isFinite(parsedLimit) ? parsedLimit : 10, 1), 100)
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
    await ensureBloodRequestTransferAllocations()
    let rows
    try {
      const [rowsWithPriority] = await pool.query(
        `
        SELECT br.*,
          COALESCE(
            (SELECT SUM(rta.units_allocated)
             FROM blood_request_transfer_allocations rta
             WHERE rta.request_id = br.id),
            CASE WHEN br.status IN ('delivered', 'received', 'fulfilled')
              THEN COALESCE(br.units_approved, br.units_requested)
              ELSE 0
            END
          ) AS actual_fulfilled_units,
          h.hospital_name
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
          SELECT br.*,
            COALESCE(
              (SELECT SUM(rta.units_allocated)
               FROM blood_request_transfer_allocations rta
               WHERE rta.request_id = br.id),
              CASE WHEN br.status IN ('delivered', 'received', 'fulfilled')
                THEN COALESCE(br.units_approved, br.units_requested)
                ELSE 0
              END
            ) AS actual_fulfilled_units,
            h.hospital_name
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

