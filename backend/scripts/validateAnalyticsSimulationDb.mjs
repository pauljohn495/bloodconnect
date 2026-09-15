import assert from 'node:assert/strict'
import mysql from 'mysql2/promise'
import dotenv from 'dotenv'
import {
  calculateShortageForecast,
  calculateTransferRecommendations,
  calculateUsageTrends,
} from '../../frontend/src/admin/analyticsEngine.js'

dotenv.config()
const sourceDb = process.env.DB_NAME || 'bloodconnect'
const targetArgIndex = process.argv.indexOf('--target')
const cliTarget = targetArgIndex >= 0 ? process.argv[targetArgIndex + 1] : null
const targetDb = cliTarget || process.env.SIMULATION_DB_NAME || `${sourceDb}_simulation`
if (!/^[a-zA-Z0-9_]+_simulation$/i.test(targetDb) || targetDb === sourceDb) {
  throw new Error('SIMULATION_DB_NAME must be separate from DB_NAME and end in _simulation')
}

const connection = await mysql.createConnection({
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: targetDb,
  ssl: String(process.env.DB_SSL).toLowerCase() === 'true'
    ? { rejectUnauthorized: true, ...(process.env.DB_SSL_CA_BASE64 ? { ca: Buffer.from(process.env.DB_SSL_CA_BASE64, 'base64').toString('utf8') } : {}) }
    : undefined,
})

const failures = []
let checks = 0
const check = (label, actual, expected, tolerance = 0) => {
  checks += 1
  try {
    if (tolerance) assert.ok(Math.abs(actual - expected) <= tolerance, `expected ${expected}, received ${actual}`)
    else assert.deepEqual(actual, expected)
  } catch (error) {
    failures.push({ label, expected, actual, message: error.message })
  }
}

try {
  const [[metadata]] = await connection.query('SELECT * FROM simulation_metadata WHERE id = 1')
  const now = new Date(metadata.reference_date)
  now.setUTCHours(12, 0, 0, 0)
  const [inventory] = await connection.query('SELECT * FROM blood_inventory ORDER BY id')
  const [requests] = await connection.query('SELECT br.*, h.hospital_name FROM blood_requests br JOIN hospitals h ON h.id = br.hospital_id ORDER BY br.id')
  const [hospitals] = await connection.query('SELECT * FROM hospitals ORDER BY id')
  const [[counts]] = await connection.query(`SELECT (SELECT COUNT(*) FROM users WHERE role='donor') donors, (SELECT COUNT(*) FROM donations) donations, (SELECT COUNT(*) FROM blood_requests WHERE status='delivered') delivered_requests, (SELECT COUNT(*) FROM blood_requests WHERE status='pending') pending_requests`)

  check('donor count', Number(counts.donors), 200)
  check('donation count', Number(counts.donations), 600)
  check('delivered history is flooded', Number(counts.delivered_requests) >= 500, true)
  check('controlled pending request count', Number(counts.pending_requests), 5)

  const shortage = calculateShortageForecast({ inventory, requests, now }).rows
  const trends = calculateUsageTrends({ requests, now, periodDays: 30 })
  const prescriptions = calculateTransferRecommendations({ inventory, requests, hospitals, now })
  const forecast = (key) => shortage.find((row) => `${row.bloodType}|${row.componentType}` === key)
  const trend = (key) => trends.find((row) => row.key === key)

  check('O+ current demand', trend('O+|whole_blood')?.currentUnits, 60)
  check('O+ previous demand', trend('O+|whole_blood')?.previousUnits, 30)
  check('O+ predicted seven-day demand', trend('O+|whole_blood')?.expectedDemandNext7Days, 14, 0.000001)
  check('O+ trend', trend('O+|whole_blood')?.trendKey, 'increasing')
  check('O+ demand risk', trend('O+|whole_blood')?.demandRiskKey, 'high')
  check('O+ usable stock', forecast('O+|whole_blood')?.usableStock, 20)
  check('O+ shortage days', forecast('O+|whole_blood')?.estimatedDaysRemaining, '10')
  check('O+ shortage status', forecast('O+|whole_blood')?.supplyStatusKey, 'sufficient')
  check('A+ stable trend', trend('A+|whole_blood')?.trendKey, 'stable')
  check('AB+ decreasing trend', trend('AB+|whole_blood')?.trendKey, 'decreasing')
  check('AB+ unusual drop', trend('AB+|whole_blood')?.unusualKey, 'drop')
  check('B+ platelet expiry risk', forecast('B+|platelets')?.supplyStatusKey, 'low')
  check('O- out of stock', forecast('O-|whole_blood')?.supplyStatusKey, 'critical_out')
  check('B- whole-blood low-stock warning', forecast('B-|whole_blood')?.supplyStatusKey, 'low')
  check('B- platelet low-stock warning', forecast('B-|platelets')?.supplyStatusKey, 'low')
  check('B- plasma low-stock warning', forecast('B-|plasma')?.supplyStatusKey, 'low')

  const expectedPrescriptions = [
    [929901, 'critical', null, 0, 'Contact donors / coordinate external supply'],
    [929902, 'urgent', 'central', 13, 'Dispatch from Central Inventory'],
    [929903, 'urgent', 'h:900102', 20, 'Transfer from another hospital'],
    [929904, 'normal', 'central', 10, 'Dispatch from Central Inventory'],
    [929905, 'normal', null, 0, 'Already covered by current on-hand stock'],
  ]
  check('prescriptive ordering', prescriptions.map((row) => row.requestId), expectedPrescriptions.map((row) => row[0]))
  for (const [id, priority, source, units, recommendation] of expectedPrescriptions) {
    const actual = prescriptions.find((row) => row.requestId === id)
    check(`${id} priority`, actual?.priority, priority)
    check(`${id} source`, actual?.sourceLocationKey ?? null, source)
    check(`${id} suggested units`, actual?.suggestedUnits, units)
    check(`${id} recommendation`, actual?.recommendation, recommendation)
  }

  console.log(`Database analytics simulation: ${failures.length ? 'FAIL' : 'PASS'}`)
  console.log(`Checks: ${checks - failures.length}/${checks} passed`)
  console.log(`Database: ${targetDb}`)
  if (failures.length) {
    failures.forEach((failure) => console.error(`FAIL: ${failure.label} (${failure.message})`))
    process.exitCode = 1
  }
} finally {
  await connection.end()
}
