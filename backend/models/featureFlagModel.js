const { pool } = require('../db')
const { REGISTRY, PORTALS } = require('../config/featureRegistry')

function defaultFlagsByPortal() {
  const byPortal = {}
  for (const p of PORTALS) {
    byPortal[p] = {}
  }
  for (const entry of REGISTRY) {
    byPortal[entry.portal][entry.key] = true
  }
  return byPortal
}

async function fetchOverridesMap() {
  const [rows] = await pool.query(
    'SELECT portal, flag_key, enabled FROM feature_flag_overrides',
  )
  const map = new Map()
  for (const row of rows) {
    map.set(`${row.portal}:${row.flag_key}`, Boolean(Number(row.enabled)))
  }
  return map
}

async function getEffectiveFlagsByPortal() {
  const overrides = await fetchOverridesMap()
  const byPortal = defaultFlagsByPortal()
  for (const entry of REGISTRY) {
    const k = `${entry.portal}:${entry.key}`
    if (overrides.has(k)) {
      byPortal[entry.portal][entry.key] = overrides.get(k)
    }
  }
  return byPortal
}

async function getOverride(portal, flagKey) {
  const [rows] = await pool.query(
    'SELECT enabled FROM feature_flag_overrides WHERE portal = ? AND flag_key = ? LIMIT 1',
    [portal, flagKey],
  )
  if (!rows.length) return null
  return Boolean(Number(rows[0].enabled))
}

async function insertAudit(client, { userId, portal, flagKey, previousEnabled, newEnabled }) {
  await client.query(
    `INSERT INTO feature_flag_audit (user_id, portal, flag_key, previous_enabled, new_enabled)
     VALUES (?, ?, ?, ?, ?)`,
    [
      userId,
      portal,
      flagKey,
      previousEnabled === null || previousEnabled === undefined ? null : previousEnabled ? 1 : 0,
      newEnabled ? 1 : 0,
    ],
  )
}

/**
 * @param {Array<{ portal: string, key: string, enabled: boolean }>} updates
 * @param {number} userId
 */
async function applyUpdates(updates, userId) {
  const connection = await pool.getConnection()
  try {
    await connection.beginTransaction()
    for (const { portal, key, enabled } of updates) {
      const [existing] = await connection.query(
        'SELECT enabled FROM feature_flag_overrides WHERE portal = ? AND flag_key = ? LIMIT 1',
        [portal, key],
      )
      let previous = null
      if (existing.length) {
        previous = Boolean(Number(existing[0].enabled))
      } else {
        previous = true
      }
      await insertAudit(connection, {
        userId,
        portal,
        flagKey: key,
        previousEnabled: previous,
        newEnabled: enabled,
      })
      await connection.query(
        `INSERT INTO feature_flag_overrides (portal, flag_key, enabled, updated_by_user_id)
         VALUES (?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE enabled = VALUES(enabled), updated_by_user_id = VALUES(updated_by_user_id)`,
        [portal, key, enabled ? 1 : 0, userId],
      )
    }
    await connection.commit()
  } catch (e) {
    await connection.rollback()
    throw e
  } finally {
    connection.release()
  }
}

module.exports = {
  getEffectiveFlagsByPortal,
  getOverride,
  applyUpdates,
  defaultFlagsByPortal,
}
