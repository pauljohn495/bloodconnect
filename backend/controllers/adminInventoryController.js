const { pool } = require('../db')

const getInventoryController = async (req, res) => {
  try {
    const { hospitalId } = req.query

    let query = 'SELECT * FROM blood_inventory'
    const params = []
    if (hospitalId) {
      query += ' WHERE hospital_id = ?'
      params.push(hospitalId)
    } else {
      query += ' WHERE hospital_id IS NULL'
    }
    query += ' ORDER BY created_at DESC'

    const [rows] = await pool.query(query, params)
    const rowsWithComponent = rows.map((row) => ({
      ...row,
      component_type: row.component_type || 'whole_blood',
    }))

    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const sevenDaysFromNow = new Date(today)
    sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7)

    const [approvedRequests] = await pool.query(
      `
      SELECT blood_type, SUM(units_requested) as total_units_requested, COUNT(*) as request_count
      FROM blood_requests
      WHERE status = 'approved'
      GROUP BY blood_type
    `,
    )

    const requestedBloodMap = {}
    approvedRequests.forEach((req) => {
      requestedBloodMap[req.blood_type] = { units: req.total_units_requested, count: req.request_count }
    })

    const updatedRows = await Promise.all(
      rowsWithComponent.map(async (row) => {
        const expirationDate = new Date(row.expiration_date)
        expirationDate.setHours(0, 0, 0, 0)

        let displayStatus = row.status
        let dbStatus = row.status
        if (expirationDate < today) {
          displayStatus = 'expired'
          dbStatus = 'expired'
        } else if (expirationDate <= sevenDaysFromNow && row.status !== 'expired') {
          displayStatus = 'near_expiry'
          dbStatus = 'available'
        } else if (row.status === 'expired' && expirationDate >= today) {
          displayStatus = expirationDate <= sevenDaysFromNow ? 'near_expiry' : 'available'
          dbStatus = 'available'
        } else {
          displayStatus = 'available'
          dbStatus = 'available'
        }

        if (dbStatus !== row.status && dbStatus === 'expired') {
          await pool.query('UPDATE blood_inventory SET status = ? WHERE id = ?', [dbStatus, row.id])
        }

        const requestedBlood = requestedBloodMap[row.blood_type] || null
        return {
          ...row,
          status: displayStatus,
          requestedBlood: requestedBlood
            ? { bloodType: row.blood_type, units: requestedBlood.units, requestCount: requestedBlood.count }
            : null,
        }
      }),
    )

    res.json(updatedRows)
  } catch (error) {
    console.error('Fetch inventory error:', error)
    res.status(500).json({ message: 'Failed to fetch inventory' })
  }
}

const createInventoryController = async (req, res) => {
  const { bloodType, units, expirationDate, hospitalId, componentType } = req.body
  if (!bloodType || !units || !expirationDate) {
    return res.status(400).json({ message: 'bloodType, units and expirationDate are required' })
  }
  try {
    const intUnits = parseInt(units, 10)
    if (Number.isNaN(intUnits) || intUnits <= 0) {
      return res.status(400).json({ message: 'units must be a positive integer' })
    }
    const component = componentType || 'whole_blood'

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
}

const updateInventoryController = async (req, res) => {
  const { id } = req.params
  const { bloodType, units, expirationDate, componentType } = req.body
  if (!bloodType || !units || !expirationDate) {
    return res.status(400).json({ message: 'bloodType, units and expirationDate are required' })
  }
  try {
    const inventoryId = parseInt(id, 10)
    const intUnits = parseInt(units, 10)
    if (Number.isNaN(inventoryId) || inventoryId <= 0) {
      return res.status(400).json({ message: 'Invalid inventory id' })
    }
    if (Number.isNaN(intUnits) || intUnits <= 0) {
      return res.status(400).json({ message: 'units must be a positive integer' })
    }

    const [existingRows] = await pool.query('SELECT id FROM blood_inventory WHERE id = ?', [inventoryId])
    if (existingRows.length === 0) return res.status(404).json({ message: 'Inventory item not found' })
    const component = componentType || 'whole_blood'

    try {
      await pool.query(
        `
        UPDATE blood_inventory
        SET blood_type = ?, units = ?, available_units = ?, expiration_date = ?, status = 'available', component_type = ?
        WHERE id = ?
      `,
        [bloodType, intUnits, intUnits, expirationDate, component, inventoryId],
      )
    } catch (error) {
      if (error.code === 'ER_BAD_FIELD_ERROR' || error.message.includes('component_type')) {
        await pool.query(
          `
          UPDATE blood_inventory
          SET blood_type = ?, units = ?, available_units = ?, expiration_date = ?, status = 'available'
          WHERE id = ?
        `,
          [bloodType, intUnits, intUnits, expirationDate, inventoryId],
        )
      } else {
        throw error
      }
    }

    return res.json({
      id: inventoryId,
      bloodType,
      units: intUnits,
      availableUnits: intUnits,
      expirationDate,
      componentType: component,
    })
  } catch (error) {
    console.error('Update inventory error:', error)
    return res.status(500).json({ message: 'Failed to update inventory' })
  }
}

const deleteInventoryController = async (req, res) => {
  const { id } = req.params
  try {
    const inventoryId = parseInt(id, 10)
    if (Number.isNaN(inventoryId) || inventoryId <= 0) {
      return res.status(400).json({ message: 'Invalid inventory id' })
    }
    const [result] = await pool.query('DELETE FROM blood_inventory WHERE id = ?', [inventoryId])
    if (result.affectedRows === 0) return res.status(404).json({ message: 'Inventory item not found' })
    return res.json({ message: 'Inventory item deleted' })
  } catch (error) {
    console.error('Delete inventory error:', error)
    return res.status(500).json({ message: 'Failed to delete inventory' })
  }
}

module.exports = {
  getInventoryController,
  createInventoryController,
  updateInventoryController,
  deleteInventoryController,
}

