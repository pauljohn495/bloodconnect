const { pool } = require('../db')
const { ensureBloodRequestStatusSupportsDelivery } = require('../utils/requestStatusSchema')

async function getHospitalIdForUser(userId) {
  const [rows] = await pool.query('SELECT id FROM hospitals WHERE user_id = ?', [userId])
  return rows[0]?.id || null
}

async function getHospitalInventory(hospitalId) {
  const [rows] = await pool.query(
    `
    SELECT *
    FROM blood_inventory
    WHERE hospital_id = ?
    ORDER BY created_at DESC
  `,
    [hospitalId],
  )
  return rows
}

async function updateInventoryStatusToExpired(inventoryId, status) {
  await pool.query('UPDATE blood_inventory SET status = ? WHERE id = ?', [status, inventoryId])
}

async function getInventoryItemForHospital(inventoryId, hospitalId) {
  const [rows] = await pool.query(
    `
    SELECT 
      id,
      hospital_id,
      blood_type,
      COALESCE(component_type, 'whole_blood') as component_type,
      available_units,
      expiration_date,
      status
    FROM blood_inventory
    WHERE id = ? AND hospital_id = ?
  `,
    [inventoryId, hospitalId],
  )
  return rows[0] || null
}

async function createHospitalDonation({ connection, hospitalId, inventoryId, bloodType, componentType, units }) {
  const conn = connection || (await pool.getConnection())
  let externalConnection = !!connection

  try {
    if (!externalConnection) {
      await conn.beginTransaction()
    }

    await conn.query('UPDATE blood_inventory SET available_units = available_units - ? WHERE id = ?', [
      units,
      inventoryId,
    ])

    await conn.query(
      `
      INSERT INTO hospital_donations
        (hospital_id, inventory_id, blood_type, component_type, units, donation_date)
      VALUES (?, ?, ?, ?, ?, NOW())
    `,
      [hospitalId, inventoryId, bloodType, componentType, units],
    )

    if (!externalConnection) {
      await conn.commit()
    }
  } catch (error) {
    if (!externalConnection) {
      await conn.rollback()
    }
    throw error
  } finally {
    if (!externalConnection) {
      conn.release()
    }
  }
}

async function getHospitalDonations(hospitalId) {
  const [rows] = await pool.query(
    `
    SELECT 
      id,
      inventory_id,
      blood_type,
      COALESCE(component_type, 'whole_blood') as component_type,
      units,
      donation_date
    FROM hospital_donations
    WHERE hospital_id = ?
    ORDER BY donation_date DESC
  `,
    [hospitalId],
  )
  return rows
}

async function createHospitalRequest({ hospitalId, bloodType, componentType, unitsRequested, notes, priority }) {
  const component = componentType || 'whole_blood'
  const safePriority = priority || 'normal'

  let result
  try {
    const [result1] = await pool.query(
      `
      INSERT INTO blood_requests (hospital_id, blood_type, component_type, units_requested, notes, priority)
      VALUES (?, ?, ?, ?, ?, ?)
    `,
      [hospitalId, bloodType, component, unitsRequested, notes || null, safePriority],
    )
    result = result1
  } catch (error) {
    if (error.code === 'ER_BAD_FIELD_ERROR' || (error.message && error.message.includes('component_type'))) {
      // Fallback when priority/component_type columns don't exist:
      // embed priority as a tag in notes so we can recover it later.
      const priorityTag = `[PRIORITY:${safePriority}]`
      const storedNotes = notes && notes.length > 0 ? `${priorityTag} ${notes}` : priorityTag

      const [result2] = await pool.query(
        `
        INSERT INTO blood_requests (hospital_id, blood_type, units_requested, notes)
        VALUES (?, ?, ?, ?)
      `,
        [hospitalId, bloodType, unitsRequested, storedNotes],
      )
      result = result2
    } else {
      throw error
    }
  }

  return {
    id: result.insertId,
    hospitalId,
    bloodType,
    componentType: component,
    unitsRequested,
    notes: notes || null,
    priority: safePriority,
    status: 'pending',
  }
}

async function getHospitalRequests(hospitalId) {
  try {
    // Try to order by priority when column exists
    const [rowsWithPriority] = await pool.query(
      `
      SELECT *
      FROM blood_requests
      WHERE hospital_id = ?
      ORDER BY
        CASE 
          WHEN status = 'pending' THEN 0
          ELSE 1
        END,
        CASE 
          WHEN priority = 'critical' THEN 0
          WHEN priority = 'urgent' THEN 1
          WHEN priority = 'normal' OR priority IS NULL THEN 2
          ELSE 3
        END,
        request_date DESC
    `,
      [hospitalId],
    )
    const normalized = rowsWithPriority.map((row) => {
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
        notes: cleanNotes,
        priority,
      }
    })
    return normalized
  } catch (error) {
    if (error.code === 'ER_BAD_FIELD_ERROR') {
      const [rowsFallback] = await pool.query(
        `
        SELECT *
        FROM blood_requests
        WHERE hospital_id = ?
        ORDER BY request_date DESC
      `,
        [hospitalId],
      )
      const normalized = rowsFallback.map((row) => {
        let priority = 'normal'
        let cleanNotes = row.notes

        if (typeof row.notes === 'string' && row.notes.startsWith('[PRIORITY:')) {
          const match = row.notes.match(/^\[PRIORITY:([a-zA-Z]+)\]\s*(.*)$/)
          if (match) {
            priority = match[1].toLowerCase()
            cleanNotes = match[2] || null
          }
        }

        return {
          ...row,
          notes: cleanNotes,
          priority,
        }
      })
      return normalized
    }
    throw error
  }
}

async function confirmHospitalRequestReceived({ hospitalId, requestId, receivedByUserId }) {
  await ensureBloodRequestStatusSupportsDelivery()

  const conn = await pool.getConnection()
  try {
    await conn.beginTransaction()

    await conn.query(
      `
      CREATE TABLE IF NOT EXISTS hospital_request_transfer_receipts (
        id BIGINT AUTO_INCREMENT PRIMARY KEY,
        request_id BIGINT NOT NULL,
        transfer_id BIGINT NOT NULL UNIQUE,
        received_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        received_by BIGINT NULL,
        INDEX idx_receipt_request (request_id),
        INDEX idx_receipt_transfer (transfer_id)
      )
    `,
    )

    const [requestRows] = await conn.query(
      `
      SELECT id, hospital_id, blood_type, request_date, status, units_approved
      FROM blood_requests
      WHERE id = ? AND hospital_id = ?
      LIMIT 1
    `,
      [requestId, hospitalId],
    )

    if (requestRows.length === 0) {
      const error = new Error('Request not found')
      error.statusCode = 404
      throw error
    }

    const request = requestRows[0]
    const status = (request.status || '').toLowerCase()
    if (status === 'received' || status === 'fulfilled') {
      const error = new Error('Request already marked as received')
      error.statusCode = 400
      throw error
    }
    if (status !== 'delivered') {
      const error = new Error('Only delivered requests can be marked as received')
      error.statusCode = 400
      throw error
    }

    const [transferRows] = await conn.query(
      `
      SELECT
        bt.id AS transfer_id,
        bt.blood_type,
        bt.units_transferred,
        bi.expiration_date,
        COALESCE(bi.component_type, 'whole_blood') AS component_type
      FROM blood_transfers bt
      LEFT JOIN blood_inventory bi ON bi.id = bt.source_inventory_id
      LEFT JOIN hospital_request_transfer_receipts rr ON rr.transfer_id = bt.id
      WHERE bt.hospital_id = ?
        AND bt.blood_type COLLATE utf8mb4_unicode_ci = ? COLLATE utf8mb4_unicode_ci
        AND bt.transfer_date >= ?
        AND rr.transfer_id IS NULL
      ORDER BY bt.transfer_date ASC
    `,
      [hospitalId, request.blood_type, request.request_date],
    )

    if (transferRows.length === 0) {
      const error = new Error('No delivered transfer found to receive for this request')
      error.statusCode = 400
      throw error
    }

    let totalReceivedUnits = 0
    for (const row of transferRows) {
      const units = Number(row.units_transferred || 0)
      totalReceivedUnits += units
    }

    for (const row of transferRows) {
      await conn.query(
        `
        INSERT INTO hospital_request_transfer_receipts (request_id, transfer_id, received_by)
        VALUES (?, ?, ?)
      `,
        [requestId, row.transfer_id, receivedByUserId || null],
      )
    }

    await conn.query(
      `
      UPDATE blood_requests
      SET status = 'received', units_approved = COALESCE(units_approved, ?)
      WHERE id = ?
    `,
      [totalReceivedUnits || request.units_approved || null, requestId],
    )

    try {
      await conn.query(
        `
        UPDATE blood_requests
        SET received_at = COALESCE(received_at, NOW())
        WHERE id = ?
      `,
        [requestId],
      )
    } catch (err) {
      if (err.code !== 'ER_BAD_FIELD_ERROR') throw err
    }

    await conn.commit()
    return { requestId, status: 'received', unitsReceived: totalReceivedUnits }
  } catch (error) {
    await conn.rollback()
    throw error
  } finally {
    conn.release()
  }
}

async function getHospitalHistoricalWastage(hospitalId, days) {
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
    [hospitalId, days],
  )

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
    [hospitalId, days],
  )

  const [totalWastageResult] = await pool.query(
    `
    SELECT COALESCE(SUM(available_units), 0) as total_wastage
    FROM blood_inventory
    WHERE status = 'expired'
      AND hospital_id = ?
      AND expiration_date >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
  `,
    [hospitalId, days],
  )

  const totalWastage = Number(totalWastageResult[0]?.total_wastage || 0)

  const formattedWastageByBloodType = wastageByBloodType.map((item) => ({
    ...item,
    total_wasted: Number(item.total_wasted || 0),
    count: Number(item.count || 0),
  }))

  return {
    wastageByDate,
    wastageByBloodType: formattedWastageByBloodType,
    totalWastage,
    period: days,
  }
}

async function getHospitalWastagePredictions(hospitalId) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

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

  const wastageRates = {}
  historicalWastage.forEach((item) => {
    wastageRates[item.blood_type] = {
      wastedUnits: item.wasted_units || 0,
      wastedCount: item.wasted_count || 0,
    }
  })

  const inventoryWithRisk = atRiskInventory.map((item) => {
    const daysUntilExpiry = item.days_until_expiry || 0
    const bloodType = item.blood_type

    let expiryFactor = 0
    if (daysUntilExpiry <= 3) expiryFactor = 40
    else if (daysUntilExpiry <= 7) expiryFactor = 30
    else if (daysUntilExpiry <= 14) expiryFactor = 20
    else if (daysUntilExpiry <= 30) expiryFactor = 10
    else expiryFactor = 5

    const wastageRate = wastageRates[bloodType]?.wastedUnits || 0
    const wastageFactor = Math.min(30, (wastageRate / 10) * 5)

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

  return {
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
  }
}

module.exports = {
  getHospitalIdForUser,
  getHospitalInventory,
  updateInventoryStatusToExpired,
  getInventoryItemForHospital,
  createHospitalDonation,
  getHospitalDonations,
  createHospitalRequest,
  getHospitalRequests,
  confirmHospitalRequestReceived,
  getHospitalHistoricalWastage,
  getHospitalWastagePredictions,
}

