const { pool } = require('../db')

async function logExpiredInventoryIfMissing({
  inventoryId,
  bloodType,
  componentType = 'whole_blood',
  unitsExpired = 0,
  hospitalId = null,
  expirationDate = null,
  notes = null,
}) {
  if (!inventoryId || !bloodType) return

  const [existing] = await pool.query(
    'SELECT id FROM expired_units WHERE inventory_id = ? LIMIT 1',
    [inventoryId],
  )
  if (existing.length > 0) return

  await pool.query(
    `
      INSERT INTO expired_units
        (inventory_id, blood_type, component_type, units_expired, hospital_id, expiration_date, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `,
    [inventoryId, bloodType, componentType, unitsExpired, hospitalId, expirationDate, notes],
  )
}

module.exports = { logExpiredInventoryIfMissing }

