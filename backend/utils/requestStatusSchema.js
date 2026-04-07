const { pool } = require('../db')

let ensurePromise = null

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

    if (dataType !== 'enum') return
    if (columnType.includes("'delivered'") && columnType.includes("'received'")) return

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

module.exports = { ensureBloodRequestStatusSupportsDelivery }
