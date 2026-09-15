require('dotenv').config()

const bcrypt = require('bcryptjs')
const { createHash } = require('node:crypto')
const { readFile } = require('node:fs/promises')
const path = require('node:path')
const mysql = require('mysql2/promise')

const DAY_MS = 86_400_000
const ADMIN_ID = 900001
const DONOR_ID_START = 901001
const DONORS_PER_BLOOD_TYPE = 25
const REQUEST_ID_START = 9_500_001
const INVENTORY_ID_START = 9_600_001
const DONATION_ID_START = 9_700_001
const EXPIRED_ID_START = 9_800_001
const OLD_HOSPITAL_IDS = [900101, 900102]
const BLOOD_TYPES = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-']
const EXPECTED_HASHES = {
  'blood_units.csv': 'a04a6b7863f7418c9ef355697c29255dda8d45f5e89c94d5cf1b70027300b8fc',
  'blood_usage_history.csv': '7d6d657d37bcafa36d4a333dc9b3b2b1e9ab92fa4c9453ab99542864cf710f6c',
  'donations_supply.csv': 'eef0affc3bbb9425bd684858782b89363864c9e9138429fe63e159752ecdba9a',
  'expected_test_scenarios.csv': 'af3ec9f9d2e45ebc308ca7ec8b0d731f1cf9955885eb1eabc67d9778aa4da677',
  'hospital_requests.csv': '88d04210249bb83ef2966bd0249f332c2c1841abb1ca9c141ff79f35760ed91b',
  'inventory_history.csv': '6802afdb64b69f338b9605bb2ae53337565e6c1f5431f38408b58d1fc5463b19',
}

const argValue = (name) => {
  const index = process.argv.indexOf(name)
  return index >= 0 ? process.argv[index + 1] : null
}

const datasetDir = argValue('--dataset')
const targetDb = argValue('--target') || process.env.DB_NAME
const targetAsOf = argValue('--as-of')
const confirmed = process.argv.includes('--confirm-test-deployment')

if (!datasetDir || !targetDb || !targetAsOf) {
  throw new Error('--dataset, --target, and --as-of are required')
}
if (!/^[a-zA-Z0-9_]+$/.test(targetDb)) {
  throw new Error('The target database name may contain only letters, numbers, and underscores')
}
if (!/^\d{4}-\d{2}-\d{2}$/.test(targetAsOf) || Number.isNaN(Date.parse(`${targetAsOf}T00:00:00Z`))) {
  throw new Error('--as-of must be a valid YYYY-MM-DD date')
}

function parseCsv(text) {
  const rows = []
  let row = []
  let field = ''
  let quoted = false
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index]
    if (quoted) {
      if (char === '"' && text[index + 1] === '"') { field += '"'; index += 1 }
      else if (char === '"') quoted = false
      else field += char
    } else if (char === '"') quoted = true
    else if (char === ',') { row.push(field); field = '' }
    else if (char === '\n') { row.push(field.replace(/\r$/, '')); rows.push(row); row = []; field = '' }
    else field += char
  }
  if (field.length || row.length) { row.push(field.replace(/\r$/, '')); rows.push(row) }
  const headers = rows.shift().map((value) => value.replace(/^\uFEFF/, ''))
  return rows.filter((values) => values.some((value) => value !== '')).map((values) =>
    Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ''])))
}

const n = (value) => Number(value || 0)
const utcDate = (value) => new Date(`${value}T00:00:00Z`)
const ymd = (value) => value.toISOString().slice(0, 10)
const addDays = (value, days) => ymd(new Date(utcDate(value).getTime() + days * DAY_MS))
const componentName = (value) => value.toLowerCase().replace(' ', '_')
const bloodCode = (value) => value.replace('+', 'P').replace('-', 'N')
const qualified = (table) => `\`${targetDb}\`.\`${table}\``

async function insertBatches(connection, table, columns, rows, batchSize = 500) {
  for (let index = 0; index < rows.length; index += batchSize) {
    await connection.query(
      `INSERT INTO ${qualified(table)} (${columns.map((column) => `\`${column}\``).join(', ')}) VALUES ?`,
      [rows.slice(index, index + batchSize)],
    )
  }
}

async function scalar(connection, sql, params = []) {
  const [[row]] = await connection.query(sql, params)
  return Number(Object.values(row)[0] || 0)
}

async function tableExists(connection, table) {
  return Boolean(await scalar(
    connection,
    'SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = ? AND table_name = ?',
    [targetDb, table],
  ))
}

async function loadDataset() {
  const names = Object.keys(EXPECTED_HASHES)
  const rawFiles = Object.fromEntries(await Promise.all(names.map(async (name) => [
    name,
    await readFile(path.join(datasetDir, name), 'utf8'),
  ])))
  for (const name of names) {
    const actual = createHash('sha256').update(rawFiles[name]).digest('hex')
    if (actual !== EXPECTED_HASHES[name]) {
      throw new Error(`Dataset hash mismatch for ${name}`)
    }
  }

  const usage = parseCsv(rawFiles['blood_usage_history.csv'])
  const inventory = parseCsv(rawFiles['inventory_history.csv'])
  const supply = parseCsv(rawFiles['donations_supply.csv'])
  const requests = parseCsv(rawFiles['hospital_requests.csv'])
  const scenarios = parseCsv(rawFiles['expected_test_scenarios.csv'])
  const unitCount = parseCsv(rawFiles['blood_units.csv']).length
  const expectedCounts = [
    [usage.length, 52_560, 'blood usage'],
    [inventory.length, 52_560, 'inventory history'],
    [supply.length, 52_560, 'donation supply'],
    [requests.length, 33_017, 'hospital requests'],
    [scenarios.length, 15, 'expected scenarios'],
    [unitCount, 49_190, 'blood units'],
  ]
  for (const [actual, expected, label] of expectedCounts) {
    if (actual !== expected) throw new Error(`${label} row count mismatch: ${actual}/${expected}`)
  }
  return { usage, inventory, supply, requests }
}

function buildImportRows(dataset, hospitalIds, passwordHash) {
  const { usage, inventory, supply, requests } = dataset
  const sourceDates = [...new Set(usage.map((row) => row.date))].sort()
  const originIndexes = []
  for (let index = 30; index <= sourceDates.length - 7; index += 7) originIndexes.push(index)
  const sourceOrigin = sourceDates[originIndexes.at(-1)]
  const sourcePriorDate = addDays(sourceOrigin, -1)
  const shiftDays = Math.round((utcDate(targetAsOf) - utcDate(sourceOrigin)) / DAY_MS)
  const shiftDate = (date) => addDays(date, shiftDays)
  const sourceFutureEnd = addDays(sourceOrigin, 6)

  const priorityScore = { Normal: 1, Urgent: 2, Critical: 3 }
  const priorityByDay = new Map()
  for (const row of requests) {
    const mapKey = `${row.request_date}|${row.hospital_id}|${row.blood_type}|${row.component}`
    const current = priorityByDay.get(mapKey) || 'Normal'
    if ((priorityScore[row.priority] || 1) > (priorityScore[current] || 1)) {
      priorityByDay.set(mapKey, row.priority)
    }
  }

  const donorPools = {}
  const donorRows = []
  let donorId = DONOR_ID_START - 1
  for (const bloodType of BLOOD_TYPES) {
    donorPools[bloodType] = []
    for (let index = 1; index <= DONORS_PER_BLOOD_TYPE; index += 1) {
      donorId += 1
      donorPools[bloodType].push(donorId)
      donorRows.push({
        id: donorId,
        username: `controlled_2025_donor_${donorId}`,
        email: `controlled.2025.${donorId}@noemail.bloodconnect`,
        passwordHash,
        fullName: `Controlled 2025 Donor ${bloodType} ${String(index).padStart(2, '0')}`,
        bloodType,
        assignedDonorId: `CD25-${bloodCode(bloodType)}-${String(index).padStart(3, '0')}`,
        age: 18 + ((index * 7 + BLOOD_TYPES.indexOf(bloodType)) % 43),
        gender: index % 2 === 0 ? 'Female' : 'Male',
        lastDonationDate: null,
      })
    }
  }

  const supplyStart = supply[0].date
  const weeklySupply = new Map()
  for (const row of supply) {
    if (row.date >= sourceOrigin || n(row.units_received) <= 0) continue
    const bucket = Math.floor((utcDate(row.date) - utcDate(supplyStart)) / DAY_MS / 7)
    const mapKey = `${bucket}|${row.blood_type}|${componentName(row.component)}`
    const current = weeklySupply.get(mapKey) || {
      bloodType: row.blood_type,
      componentType: componentName(row.component),
      units: 0,
      latestDate: row.date,
    }
    current.units += n(row.units_received)
    if (row.date > current.latestDate) current.latestDate = row.date
    weeklySupply.set(mapKey, current)
  }

  const donorOffsets = Object.fromEntries(BLOOD_TYPES.map((bloodType) => [bloodType, 0]))
  const lastDonationByDonor = new Map()
  const donationRows = []
  let donationIdValue = DONATION_ID_START
  const sortedSupply = [...weeklySupply.values()].sort((a, b) =>
    a.latestDate.localeCompare(b.latestDate) ||
    a.bloodType.localeCompare(b.bloodType) ||
    a.componentType.localeCompare(b.componentType))
  for (const item of sortedSupply) {
    let unitsRemaining = item.units
    while (unitsRemaining > 0) {
      const units = Math.min(99, unitsRemaining)
      const pool = donorPools[item.bloodType]
      const assignedDonor = pool[donorOffsets[item.bloodType] % pool.length]
      donorOffsets[item.bloodType] += 1
      const donationDate = shiftDate(item.latestDate)
      donationRows.push([
        donationIdValue++, assignedDonor, item.bloodType, donationDate,
        'Controlled 2025 synthetic weekly supply', null, 'completed', units,
        null, `${donationDate} 12:00:00`, item.componentType,
      ])
      if (!lastDonationByDonor.has(assignedDonor) || donationDate > lastDonationByDonor.get(assignedDonor)) {
        lastDonationByDonor.set(assignedDonor, donationDate)
      }
      unitsRemaining -= units
    }
  }
  donorRows.forEach((donor) => { donor.lastDonationDate = lastDonationByDonor.get(donor.id) || null })

  const userRows = donorRows.map((donor) => [
    donor.id, donor.username, donor.email, donor.passwordHash, 'donor', donor.fullName,
    null, donor.bloodType, donor.lastDonationDate, 'active', 1, donor.assignedDonorId,
    donor.age, donor.gender,
  ])

  const historicalRequestRows = []
  let requestIdValue = REQUEST_ID_START
  for (const row of usage) {
    if (row.date >= sourceOrigin || n(row.units_requested) <= 0) continue
    const mapKey = `${row.date}|${row.hospital_id}|${row.blood_type}|${row.component}`
    const shiftedDate = shiftDate(row.date)
    historicalRequestRows.push([
      requestIdValue++, hospitalIds.get(row.hospital_id), row.blood_type,
      componentName(row.component), n(row.units_requested),
      (priorityByDay.get(mapKey) || 'Normal').toLowerCase(), n(row.units_fulfilled),
      'delivered', `${shiftedDate} 12:00:00`, ADMIN_ID, `${shiftedDate} 12:00:00`,
      `${shiftedDate} 12:00:00`,
      `CONTROLLED2025: predictive history; original_date=${row.date}`,
    ])
  }

  const pendingBySeries = new Map()
  for (const row of usage) {
    if (row.date < sourceOrigin || row.date > sourceFutureEnd || n(row.units_requested) <= 0) continue
    const seriesKey = `${row.hospital_id}|${row.blood_type}|${row.component}`
    const current = pendingBySeries.get(seriesKey) || {
      hospitalId: row.hospital_id,
      bloodType: row.blood_type,
      component: row.component,
      units: 0,
      priority: 'Normal',
    }
    current.units += n(row.units_requested)
    const dayPriority = priorityByDay.get(`${row.date}|${seriesKey}`) || 'Normal'
    if ((priorityScore[dayPriority] || 1) > (priorityScore[current.priority] || 1)) {
      current.priority = dayPriority
    }
    pendingBySeries.set(seriesKey, current)
  }
  const pendingRequestRows = [...pendingBySeries.values()].map((row) => [
    requestIdValue++, hospitalIds.get(row.hospitalId), row.bloodType,
    componentName(row.component), row.units, row.priority.toLowerCase(), 0,
    'pending', `${targetAsOf} 08:00:00`, null, null, null,
    `CONTROLLED2025: prescriptive hidden horizon ${sourceOrigin}..${sourceFutureEnd}`,
  ])

  const inventoryRows = []
  let inventoryIdValue = INVENTORY_ID_START
  for (const row of inventory.filter((item) => item.date === sourcePriorDate)) {
    const stock = n(row.closing_inventory)
    const expiring = Math.min(stock, n(row.near_expiry_units))
    const common = [row.blood_type, componentName(row.component)]
    if (expiring > 0) {
      inventoryRows.push([
        inventoryIdValue++, ...common, expiring, expiring, 0, addDays(targetAsOf, 3),
        'available', ADMIN_ID, hospitalIds.get(row.hospital_id), `${addDays(targetAsOf, -1)} 12:00:00`,
      ])
    }
    if (stock - expiring > 0) {
      const laterUnits = stock - expiring
      inventoryRows.push([
        inventoryIdValue++, ...common, laterUnits, laterUnits, 0, addDays(targetAsOf, 30),
        'available', ADMIN_ID, hospitalIds.get(row.hospital_id), `${addDays(targetAsOf, -1)} 12:00:00`,
      ])
    }
    if (stock === 0) {
      inventoryRows.push([
        inventoryIdValue++, ...common, 0, 0, 0, addDays(targetAsOf, 30),
        'available', ADMIN_ID, hospitalIds.get(row.hospital_id), `${addDays(targetAsOf, -1)} 12:00:00`,
      ])
    }
  }

  const expiredRows = []
  let expiredIdValue = EXPIRED_ID_START
  for (const row of inventory) {
    if (row.date >= sourceOrigin || n(row.units_expired) <= 0) continue
    const shiftedDate = shiftDate(row.date)
    expiredRows.push([
      expiredIdValue++, null, row.blood_type, componentName(row.component),
      n(row.units_expired), hospitalIds.get(row.hospital_id), shiftedDate,
      `${shiftedDate} 12:00:00`, `CONTROLLED2025: original_date=${row.date}`,
    ])
  }

  return {
    sourceOrigin,
    sourceFutureEnd,
    sourcePriorDate,
    shiftDays,
    userRows,
    historicalRequestRows,
    pendingRequestRows,
    inventoryRows,
    donationRows,
    expiredRows,
  }
}

async function main() {
  console.log('Reading and validating the exact controlled 2025 dataset...')
  const dataset = await loadDataset()
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    ssl: String(process.env.DB_SSL).toLowerCase() === 'true'
      ? {
          rejectUnauthorized: true,
          ...(process.env.DB_SSL_CA_BASE64
            ? { ca: Buffer.from(process.env.DB_SSL_CA_BASE64, 'base64').toString('utf8') }
            : {}),
        }
      : undefined,
  })

  try {
    if (!await scalar(connection, 'SELECT COUNT(*) FROM information_schema.schemata WHERE schema_name = ?', [targetDb])) {
      throw new Error(`Target database ${targetDb} does not exist`)
    }

    const [hospitalRows] = await connection.query(`SELECT id, hospital_name FROM ${qualified('hospitals')}`)
    const hospitalIds = new Map()
    const sourceHospitals = [...new Map(dataset.inventory.map((row) => [row.hospital_id, row.hospital_name]))]
    for (const [sourceId, hospitalName] of sourceHospitals) {
      const match = hospitalRows.find((row) => row.hospital_name === hospitalName)
      if (!match) throw new Error(`Target hospital not found: ${sourceId} / ${hospitalName}`)
      hospitalIds.set(sourceId, match.id)
    }

    const [adminRows] = await connection.query(
      `SELECT id, username, password_hash FROM ${qualified('users')} WHERE id = ?`,
      [ADMIN_ID],
    )
    if (adminRows.length && adminRows[0].username !== 'simulation_admin') {
      throw new Error(`User ID ${ADMIN_ID} is not the controlled admin; refusing to replace it`)
    }
    const passwordHash = adminRows[0]?.password_hash || await bcrypt.hash('Simulation123!', 10)
    const rows = buildImportRows(dataset, hospitalIds, passwordHash)

    const oldCounts = {
      donors: await scalar(connection, `SELECT COUNT(*) FROM ${qualified('users')} WHERE assigned_donor_id LIKE 'SIM-%' AND id BETWEEN 901001 AND 901200`),
      hospitals: await scalar(connection, `SELECT COUNT(*) FROM ${qualified('hospitals')} WHERE id IN (900101, 900102) AND hospital_name LIKE 'Simulation %'`),
      inventory: await scalar(connection, `SELECT COUNT(*) FROM ${qualified('blood_inventory')} WHERE id BETWEEN 910001 AND 910026`),
      requests: await scalar(connection, `SELECT COUNT(*) FROM ${qualified('blood_requests')} WHERE id BETWEEN 920001 AND 929999 AND notes LIKE 'SIMULATION:%'`),
      donations: await scalar(connection, `SELECT COUNT(*) FROM ${qualified('donations')} WHERE id BETWEEN 930001 AND 930600 AND user_id BETWEEN 901001 AND 901200`),
      expired: await scalar(connection, `SELECT COUNT(*) FROM ${qualified('expired_units')} WHERE id = 940001 AND notes LIKE 'SIMULATION:%'`),
    }
    const existingCorrectRows = await scalar(
      connection,
      `SELECT
        (SELECT COUNT(*) FROM ${qualified('users')} WHERE assigned_donor_id LIKE 'CD25-%') +
        (SELECT COUNT(*) FROM ${qualified('blood_requests')} WHERE notes LIKE 'CONTROLLED2025:%') +
        (SELECT COUNT(*) FROM ${qualified('donations')} WHERE location LIKE 'Controlled 2025%')`,
    )
    if (existingCorrectRows > 0) {
      throw new Error('Controlled 2025 rows already exist in the target; no data was changed')
    }

    const rangeCollisions = {
      donorIds: await scalar(connection, `SELECT COUNT(*) FROM ${qualified('users')} WHERE id BETWEEN 901001 AND 901200 AND assigned_donor_id NOT LIKE 'SIM-%'`),
      requestIds: await scalar(connection, `SELECT COUNT(*) FROM ${qualified('blood_requests')} WHERE id BETWEEN ? AND ?`, [REQUEST_ID_START, REQUEST_ID_START + rows.historicalRequestRows.length + rows.pendingRequestRows.length - 1]),
      inventoryIds: await scalar(connection, `SELECT COUNT(*) FROM ${qualified('blood_inventory')} WHERE id BETWEEN ? AND ?`, [INVENTORY_ID_START, INVENTORY_ID_START + rows.inventoryRows.length - 1]),
      donationIds: await scalar(connection, `SELECT COUNT(*) FROM ${qualified('donations')} WHERE id BETWEEN ? AND ?`, [DONATION_ID_START, DONATION_ID_START + rows.donationRows.length - 1]),
      expiredIds: await scalar(connection, `SELECT COUNT(*) FROM ${qualified('expired_units')} WHERE id BETWEEN ? AND ?`, [EXPIRED_ID_START, EXPIRED_ID_START + rows.expiredRows.length - 1]),
    }
    if (Object.values(rangeCollisions).some(Boolean)) {
      throw new Error(`Controlled 2025 ID range collision: ${JSON.stringify(rangeCollisions)}. No data was changed.`)
    }

    let interactionCount = await scalar(
      connection,
      `SELECT COUNT(*) FROM ${qualified('blood_transfers')}
       WHERE source_inventory_id BETWEEN 910001 AND 910026
          OR hospital_id IN (900101, 900102)
          OR transferred_by BETWEEN 901001 AND 901200`,
    )
    if (await tableExists(connection, 'blood_request_transfer_allocations')) {
      interactionCount += await scalar(
        connection,
        `SELECT COUNT(*) FROM ${qualified('blood_request_transfer_allocations')}
         WHERE request_id IN (
           SELECT id FROM ${qualified('blood_requests')}
           WHERE id BETWEEN 920001 AND 929999 AND notes LIKE 'SIMULATION:%'
         )`,
      )
    }
    if (await tableExists(connection, 'blood_request_status_history')) {
      interactionCount += await scalar(
        connection,
        `SELECT COUNT(*) FROM ${qualified('blood_request_status_history')}
         WHERE request_id IN (
           SELECT id FROM ${qualified('blood_requests')}
           WHERE id BETWEEN 920001 AND 929999 AND notes LIKE 'SIMULATION:%'
         )`,
      )
    }
    interactionCount += await scalar(
      connection,
      `SELECT COUNT(*) FROM ${qualified('schedule_requests')} WHERE user_id BETWEEN 901001 AND 901200`,
    )
    if (interactionCount > 0) {
      throw new Error(`The earlier simulation rows have ${interactionCount} later interactions; refusing automatic replacement`)
    }

    console.log(`Target database: ${targetDb}`)
    console.log(`Exact dataset hashes: 6/6 matched`)
    console.log(`Evaluation origin: ${rows.sourceOrigin}; mapped to ${targetAsOf} (${rows.shiftDays >= 0 ? '+' : ''}${rows.shiftDays} days)`)
    console.log(`Existing simulation rows to replace: ${Object.entries(oldCounts).map(([key, value]) => `${key}=${value}`).join(', ')}`)
    console.log(`Controlled 2025 rows planned: donors=${rows.userRows.length}, predictive requests=${rows.historicalRequestRows.length}, prescriptive requests=${rows.pendingRequestRows.length}, inventory=${rows.inventoryRows.length}, donation summaries=${rows.donationRows.length}, expired history=${rows.expiredRows.length}`)

    if (!confirmed) {
      console.log('Dry run passed. Rerun with --confirm-test-deployment to replace only the earlier simulation import.')
      return
    }

    await connection.beginTransaction()
    try {
      await connection.query(
        `DELETE FROM ${qualified('admin_event_notification_deliveries')}
         WHERE event_key REGEXP '^inventory-expiry:9100(0[1-9]|1[0-9]|2[0-6])$'`,
      )
      if (await tableExists(connection, 'notifications')) {
        await connection.query(
          `DELETE FROM ${qualified('notifications')}
           WHERE user_id IN (900002, 900003) OR user_id BETWEEN 901001 AND 901200`,
        )
      }
      await connection.query(`DELETE FROM ${qualified('expired_units')} WHERE id = 940001 AND notes LIKE 'SIMULATION:%'`)
      await connection.query(`DELETE FROM ${qualified('donations')} WHERE id BETWEEN 930001 AND 930600 AND user_id BETWEEN 901001 AND 901200`)
      await connection.query(`DELETE FROM ${qualified('blood_requests')} WHERE id BETWEEN 920001 AND 929999 AND notes LIKE 'SIMULATION:%'`)
      await connection.query(`DELETE FROM ${qualified('blood_inventory')} WHERE id BETWEEN 910001 AND 910026`)
      await connection.query(`DELETE FROM ${qualified('hospitals')} WHERE id IN (900101, 900102) AND hospital_name LIKE 'Simulation %'`)
      await connection.query(`DELETE FROM ${qualified('users')} WHERE id IN (900002, 900003) AND username LIKE 'simulation_hospital_%'`)
      await connection.query(`DELETE FROM ${qualified('users')} WHERE id BETWEEN 901001 AND 901200 AND assigned_donor_id LIKE 'SIM-%'`)

      if (adminRows.length) {
        await connection.query(
          `UPDATE ${qualified('users')}
           SET full_name = 'Controlled 2025 Administrator', status = 'active'
           WHERE id = ? AND username = 'simulation_admin'`,
          [ADMIN_ID],
        )
      } else {
        await connection.query(
          `INSERT INTO ${qualified('users')}
            (id, username, email, password_hash, role, full_name, phone, status,
             is_manual_donor, assigned_donor_id)
           VALUES (?, 'simulation_admin', 'controlled.2025.admin@noemail.bloodconnect', ?,
                   'admin', 'Controlled 2025 Administrator', NULL, 'active', 0, 'CD25-ADMIN')`,
          [ADMIN_ID, passwordHash],
        )
      }

      await insertBatches(connection, 'users', [
        'id', 'username', 'email', 'password_hash', 'role', 'full_name', 'phone',
        'blood_type', 'last_donation_date', 'status', 'is_manual_donor',
        'assigned_donor_id', 'age', 'gender',
      ], rows.userRows)
      await insertBatches(connection, 'blood_inventory', [
        'id', 'blood_type', 'component_type', 'units', 'available_units',
        'reserved_units', 'expiration_date', 'status', 'added_by', 'hospital_id', 'created_at',
      ], rows.inventoryRows)
      await insertBatches(connection, 'blood_requests', [
        'id', 'hospital_id', 'blood_type', 'component_type', 'units_requested',
        'priority', 'units_approved', 'status', 'request_date', 'approved_by',
        'approved_at', 'fulfilled_at', 'notes',
      ], [...rows.historicalRequestRows, ...rows.pendingRequestRows])
      await insertBatches(connection, 'donations', [
        'id', 'user_id', 'blood_type', 'donation_date', 'location', 'hospital_id',
        'status', 'units_donated', 'inventory_id', 'created_at', 'component_type',
      ], rows.donationRows)
      await insertBatches(connection, 'expired_units', [
        'id', 'inventory_id', 'blood_type', 'component_type', 'units_expired',
        'hospital_id', 'expiration_date', 'expired_at', 'notes',
      ], rows.expiredRows)
      await connection.query(
        `INSERT IGNORE INTO ${qualified('admin_event_notification_deliveries')} (event_key)
         SELECT CONCAT('inventory-expiry:', id)
         FROM ${qualified('blood_inventory')}
         WHERE id BETWEEN ? AND ?`,
        [INVENTORY_ID_START, INVENTORY_ID_START + rows.inventoryRows.length - 1],
      )
      await connection.commit()
    } catch (error) {
      await connection.rollback()
      throw error
    }

    console.log('Controlled 2025 predictive/prescriptive dataset imported successfully.')
    console.log('The earlier small simulation import was removed; pre-existing deployment records were preserved.')
  } finally {
    await connection.end()
  }
}

main().catch((error) => {
  console.error(`Controlled 2025 import failed: ${error.message}`)
  process.exit(1)
})
