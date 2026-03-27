const { pool } = require('../db')

const ALLOWED_BLOOD_TYPES = new Set(['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'])
const ALLOWED_COMPONENT_TYPES = new Set(['whole_blood', 'platelets', 'plasma'])

function isValidIsoDate(value) {
  if (!value || typeof value !== 'string') return false
  // Expect `YYYY-MM-DD` (frontend uses <input type="date">)
  return /^\d{4}-\d{2}-\d{2}$/.test(value)
}

function parsePositiveInt(value) {
  const n = typeof value === 'number' ? value : parseInt(String(value), 10)
  if (Number.isNaN(n) || n <= 0) return null
  return n
}

const createOrganizationDonationController = async (req, res) => {
  const { organizationId, donationDate, items } = req.body || {}

  const orgId = parseInt(String(organizationId), 10)
  if (Number.isNaN(orgId) || orgId <= 0) {
    return res.status(400).json({ message: 'organizationId must be a positive integer' })
  }
  if (!isValidIsoDate(donationDate)) {
    return res.status(400).json({ message: 'donationDate must be a valid YYYY-MM-DD date string' })
  }
  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ message: 'items must be a non-empty array' })
  }

  const normalizedItems = []
  for (const [idx, item] of items.entries()) {
    const bloodType = item?.bloodType
    const units = parsePositiveInt(item?.units)
    const expirationDate = item?.expirationDate
    const componentType = item?.componentType || 'whole_blood'

    if (!ALLOWED_BLOOD_TYPES.has(bloodType)) {
      return res.status(400).json({ message: `items[${idx}].bloodType is invalid` })
    }
    if (!ALLOWED_COMPONENT_TYPES.has(componentType)) {
      return res.status(400).json({ message: `items[${idx}].componentType is invalid` })
    }
    if (!units) {
      return res.status(400).json({ message: `items[${idx}].units must be a positive integer` })
    }
    if (!isValidIsoDate(expirationDate)) {
      return res
        .status(400)
        .json({ message: `items[${idx}].expirationDate must be a valid YYYY-MM-DD date string` })
    }
    normalizedItems.push({ bloodType, units, expirationDate, componentType })
  }

  let conn
  try {
    conn = await pool.getConnection()
    await conn.beginTransaction()

    const [orgRows] = await conn.query(`SELECT id, name FROM organizations WHERE id = ? LIMIT 1`, [orgId])
    if (!orgRows || orgRows.length === 0) {
      await conn.rollback()
      return res.status(404).json({ message: 'Organization not found' })
    }

    const createdBy = req.user?.id || null

    const insertedInventory = []
    for (const item of normalizedItems) {
      let result
      try {
        const [r1] = await conn.query(
          `
            INSERT INTO blood_inventory
              (blood_type, units, available_units, expiration_date, status, added_by, hospital_id, component_type)
            VALUES (?, ?, ?, ?, 'available', ?, NULL, ?)
          `,
          [item.bloodType, item.units, item.units, item.expirationDate, createdBy, item.componentType],
        )
        result = r1
      } catch (invError) {
        // Backwards compatibility if `component_type` column doesn't exist yet.
        if (invError && (invError.code === 'ER_BAD_FIELD_ERROR' || invError.message?.includes('component_type'))) {
          const [r2] = await conn.query(
            `
              INSERT INTO blood_inventory
                (blood_type, units, available_units, expiration_date, status, added_by, hospital_id)
              VALUES (?, ?, ?, ?, 'available', ?, NULL)
            `,
            [item.bloodType, item.units, item.units, item.expirationDate, createdBy],
          )
          result = r2
        } else {
          throw invError
        }
      }
      insertedInventory.push({
        inventoryId: result.insertId,
        bloodType: item.bloodType,
        units: item.units,
        expirationDate: item.expirationDate,
        componentType: item.componentType,
      })
    }

    // Optional donation logging tables (won't block inventory creation)
    let donationLog = null
    try {
      const [donationResult] = await conn.query(
        `
          INSERT INTO organization_donations (organization_id, donation_date, created_by)
          VALUES (?, ?, ?)
        `,
        [orgId, donationDate, createdBy],
      )
      const donationId = donationResult.insertId

      for (const inv of insertedInventory) {
        try {
          await conn.query(
            `
              INSERT INTO organization_donation_items
                (donation_id, blood_type, units, expiration_date, inventory_id, component_type)
              VALUES (?, ?, ?, ?, ?, ?)
            `,
            [donationId, inv.bloodType, inv.units, inv.expirationDate, inv.inventoryId, inv.componentType],
          )
        } catch (itemError) {
          if (itemError && (itemError.code === 'ER_BAD_FIELD_ERROR' || itemError.message?.includes('component_type'))) {
            await conn.query(
              `
                INSERT INTO organization_donation_items
                  (donation_id, blood_type, units, expiration_date, inventory_id)
                VALUES (?, ?, ?, ?, ?)
              `,
              [donationId, inv.bloodType, inv.units, inv.expirationDate, inv.inventoryId],
            )
          } else {
            throw itemError
          }
        }
      }

      donationLog = { donationId, donationDate }
    } catch (logError) {
      if (logError && (logError.code === 'ER_NO_SUCH_TABLE' || logError.errno === 1146)) {
        donationLog = { skipped: true, reason: 'donation_log_tables_missing' }
      } else {
        throw logError
      }
    }

    await conn.commit()
    return res.status(201).json({
      organization: { id: orgRows[0].id, name: orgRows[0].name },
      donationDate,
      inventoryBatches: insertedInventory,
      donationLog,
    })
  } catch (error) {
    if (conn) {
      try {
        await conn.rollback()
      } catch {}
    }
    if (error && (error.code === 'ER_NO_SUCH_TABLE' || error.errno === 1146)) {
      return res.status(500).json({
        message:
          'A required table is missing. Ensure `organizations` and `blood_inventory` tables exist in the database.',
      })
    }
    console.error('Create organization donation error:', error)
    return res.status(500).json({ message: 'Failed to create organization donation entry' })
  } finally {
    if (conn) conn.release()
  }
}

module.exports = {
  createOrganizationDonationController,
}

