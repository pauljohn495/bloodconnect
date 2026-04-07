const { pool } = require('../db')
const { ensureBloodRequestStatusSupportsDelivery } = require('../utils/requestStatusSchema')

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

    let query = `
      UPDATE blood_requests
      SET status = ?, units_approved = COALESCE(?, units_approved), notes = COALESCE(?, notes)
    `
    const params = [status, unitsApproved ?? null, notes ?? null]

    if (status === 'approved') {
      query += `, approved_by = ?, approved_at = NOW()`
      params.push(req.user.id)
    }

    if (status === 'delivered') {
      try {
        const [result] = await pool.query(
          `${query}, delivered_at = COALESCE(delivered_at, NOW()) WHERE id = ?`,
          [...params, id],
        )
        if (result.affectedRows === 0) {
          return res.status(404).json({ message: 'Request not found' })
        }
        return res.json({ message: 'Request updated' })
      } catch (err) {
        if (err.code !== 'ER_BAD_FIELD_ERROR') throw err
      }
    }

    if (status === 'received') {
      try {
        const [result] = await pool.query(
          `${query}, received_at = COALESCE(received_at, NOW()) WHERE id = ?`,
          [...params, id],
        )
        if (result.affectedRows === 0) {
          return res.status(404).json({ message: 'Request not found' })
        }
        return res.json({ message: 'Request updated' })
      } catch (err) {
        if (err.code !== 'ER_BAD_FIELD_ERROR') throw err
      }
    }

    const [result] = await pool.query(`${query} WHERE id = ?`, [...params, id])

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Request not found' })
    }

    res.json({ message: 'Request updated' })
  } catch (error) {
    console.error('Update request status error:', error)
    res.status(500).json({ message: 'Failed to update request status' })
  }
}

module.exports = {
  createTransferController,
  getTransfersController,
  getRequestsController,
  updateRequestStatusController,
}

