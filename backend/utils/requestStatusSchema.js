const { pool } = require('../db')

let ensurePromise = null
let ensureAllocationsPromise = null

async function columnExists(tableName, columnName) {
  const [rows] = await pool.query(
    `
    SELECT COUNT(*) AS c
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = ?
      AND COLUMN_NAME = ?
  `,
    [tableName, columnName],
  )
  return Number(rows[0]?.c || 0) > 0
}

async function ensureBloodRequestStatusSupportsDelivery() {
  if (ensurePromise) return ensurePromise

  ensurePromise = (async () => {
    const [rows] = await pool.query(
      `
      SELECT DATA_TYPE, COLUMN_TYPE
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'blood_requests'
        AND COLUMN_NAME = 'status'
      LIMIT 1
    `,
    )

    if (!rows.length) return

    const dataType = (rows[0].DATA_TYPE || '').toLowerCase()
    const columnType = (rows[0].COLUMN_TYPE || '').toLowerCase()

    if (
      dataType === 'enum' &&
      !(columnType.includes("'delivered'") && columnType.includes("'received'"))
    ) {
      await pool.query(
        `
        ALTER TABLE blood_requests
        MODIFY COLUMN status ENUM(
          'pending',
          'approved',
          'rejected',
          'cancelled',
          'partially_fulfilled',
          'fulfilled',
          'delivered',
          'received'
        ) NOT NULL DEFAULT 'pending'
      `,
      )
    }

    if (!(await columnExists('blood_requests', 'delivered_at'))) {
      await pool.query('ALTER TABLE blood_requests ADD COLUMN delivered_at DATETIME NULL')
    }

    if (!(await columnExists('blood_requests', 'received_at'))) {
      await pool.query('ALTER TABLE blood_requests ADD COLUMN received_at DATETIME NULL')
    }
  })()

  try {
    await ensurePromise
  } finally {
    ensurePromise = null
  }
}

async function ensureBloodRequestTransferAllocations() {
  if (ensureAllocationsPromise) return ensureAllocationsPromise

  ensureAllocationsPromise = (async () => {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS blood_request_transfer_allocations (
        id BIGINT AUTO_INCREMENT PRIMARY KEY,
        request_id BIGINT NOT NULL,
        transfer_id BIGINT NOT NULL,
        units_allocated INT NOT NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        received_at DATETIME NULL,
        received_by BIGINT NULL,
        UNIQUE KEY uniq_request_transfer_allocation (request_id, transfer_id),
        INDEX idx_transfer_allocation_request (request_id),
        INDEX idx_transfer_allocation_transfer (transfer_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `)
    if (!(await columnExists('blood_request_transfer_allocations', 'received_at'))) {
      await pool.query('ALTER TABLE blood_request_transfer_allocations ADD COLUMN received_at DATETIME NULL')
    }
    if (!(await columnExists('blood_request_transfer_allocations', 'received_by'))) {
      await pool.query('ALTER TABLE blood_request_transfer_allocations ADD COLUMN received_by BIGINT NULL')
    }
  })()

  try {
    await ensureAllocationsPromise
  } finally {
    ensureAllocationsPromise = null
  }
}

module.exports = {
  ensureBloodRequestStatusSupportsDelivery,
  ensureBloodRequestTransferAllocations,
}
