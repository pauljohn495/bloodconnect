require('dotenv').config()

const bcrypt = require('bcryptjs')
const mysql = require('mysql2/promise')

const SOURCE_DB = process.env.DB_NAME || 'bloodconnect'
const TARGET_DB = process.env.SIMULATION_DB_NAME || `${SOURCE_DB}_simulation`
const DATABASE_NAME_PATTERN = /^[a-zA-Z0-9_]+$/
const DAY_MS = 24 * 60 * 60 * 1000

if (!DATABASE_NAME_PATTERN.test(SOURCE_DB) || !DATABASE_NAME_PATTERN.test(TARGET_DB)) {
  throw new Error('Database names may contain only letters, numbers, and underscores')
}
if (TARGET_DB === SOURCE_DB || !TARGET_DB.toLowerCase().endsWith('_simulation')) {
  throw new Error('Refusing to continue: SIMULATION_DB_NAME must be different from DB_NAME and end in _simulation')
}

const sqlDate = (date) => date.toISOString().slice(0, 10)
const sqlDateTime = (date) => `${sqlDate(date)} ${date.toISOString().slice(11, 19)}`
const offsetDate = (reference, days, hour = 12) => {
  const date = new Date(reference.getTime() + days * DAY_MS)
  date.setUTCHours(hour, 0, 0, 0)
  return date
}

const splitUnits = (total, pieces = 4) => {
  const base = Math.floor(total / pieces)
  const remainder = total % pieces
  return Array.from({ length: pieces }, (_, index) => base + (index < remainder ? 1 : 0))
}

async function insertMany(connection, table, columns, rows) {
  if (rows.length === 0) return
  await connection.query(
    `INSERT INTO \`${TARGET_DB}\`.\`${table}\` (${columns.map((column) => `\`${column}\``).join(', ')}) VALUES ?`,
    [rows],
  )
}

async function main() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    ssl: String(process.env.DB_SSL).toLowerCase() === 'true'
      ? { rejectUnauthorized: true, ...(process.env.DB_SSL_CA_BASE64 ? { ca: Buffer.from(process.env.DB_SSL_CA_BASE64, 'base64').toString('utf8') } : {}) }
      : undefined,
  })

  const referenceDate = new Date()
  referenceDate.setUTCHours(12, 0, 0, 0)
  const periodStart = offsetDate(referenceDate, -183)
  const passwordHash = await bcrypt.hash('Simulation123!', 10)

  try {
    console.log(`Creating isolated simulation database: ${TARGET_DB}`)
    await connection.query(`DROP DATABASE IF EXISTS \`${TARGET_DB}\``)
    await connection.query(`CREATE DATABASE \`${TARGET_DB}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`)

    const [tables] = await connection.query(
      `SELECT TABLE_NAME FROM information_schema.tables WHERE table_schema = ? AND table_type = 'BASE TABLE' ORDER BY TABLE_NAME`,
      [SOURCE_DB],
    )
    if (tables.length === 0) throw new Error(`Source database ${SOURCE_DB} has no base tables to clone`)
    await connection.query('SET FOREIGN_KEY_CHECKS = 0')
    for (const { TABLE_NAME: table } of tables) {
      await connection.query(`CREATE TABLE \`${TARGET_DB}\`.\`${table}\` LIKE \`${SOURCE_DB}\`.\`${table}\``)
    }
    await connection.query('SET FOREIGN_KEY_CHECKS = 1')
    await connection.query(`CREATE TABLE \`${TARGET_DB}\`.simulation_metadata (id INT PRIMARY KEY, reference_date DATETIME NOT NULL, period_start DATE NOT NULL, period_end DATE NOT NULL, seed_version VARCHAR(32) NOT NULL)`)

    const users = [
      [900001, 'simulation_admin', 'simulation.admin@bloodconnect.test', passwordHash, 'admin', 'Simulation Administrator', '09000000001', null, null, 'active', 0, 'SIM-ADMIN'],
      [900002, 'simulation_hospital_1', 'simulation.hospital1@bloodconnect.test', passwordHash, 'hospital', 'Simulation General Hospital', '09000000002', null, null, 'active', 0, 'SIM-HOSP-1'],
      [900003, 'simulation_hospital_2', 'simulation.hospital2@bloodconnect.test', passwordHash, 'hospital', 'Simulation Community Hospital', '09000000003', null, null, 'active', 0, 'SIM-HOSP-2'],
    ]
    const bloodTypes = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-']
    const componentTypes = ['whole_blood', 'platelets', 'plasma']
    let donorId = 901000
    for (const bloodType of bloodTypes) {
      for (let index = 1; index <= 25; index += 1) {
        donorId += 1
        const daysSinceDonation = index <= 10 ? 120 + index : index <= 18 ? 50 + index : 5 + index
        users.push([
          donorId,
          `sim_donor_${donorId}`,
          `sim.donor.${donorId}@bloodconnect.test`,
          passwordHash,
          'donor',
          `Simulation Donor ${bloodType} ${String(index).padStart(2, '0')}`,
          `0917${String(donorId).slice(-7).padStart(7, '0')}`,
          bloodType,
          sqlDate(offsetDate(referenceDate, -daysSinceDonation)),
          'active',
          1,
          `SIM-${bloodType.replace('+', 'P').replace('-', 'N')}-${String(index).padStart(3, '0')}`,
        ])
      }
    }
    await insertMany(connection, 'users', ['id', 'username', 'email', 'password_hash', 'role', 'full_name', 'phone', 'blood_type', 'last_donation_date', 'status', 'is_manual_donor', 'assigned_donor_id'], users)

    const hospitals = [
      [900101, 900002, 'Simulation General Hospital', 'Controlled Test Site 1', '09000000002', 'simulation.hospital1@bloodconnect.test', 1, 900001, 14.5995, 120.9842],
      [900102, 900003, 'Simulation Community Hospital', 'Controlled Test Site 2', '09000000003', 'simulation.hospital2@bloodconnect.test', 1, 900001, 14.6091, 121.0223],
    ]
    await insertMany(connection, 'hospitals', ['id', 'user_id', 'hospital_name', 'address', 'contact_phone', 'contact_email', 'is_active', 'created_by', 'latitude', 'longitude'], hospitals)

    const inventory = []
    let inventoryId = 910000
    const addInventory = (bloodType, component, units, expiryOffset, hospitalId = null, status = 'available') => {
      inventoryId += 1
      inventory.push([inventoryId, bloodType, component, units, units, 0, sqlDate(offsetDate(referenceDate, expiryOffset)), status, 900001, hospitalId, sqlDateTime(offsetDate(referenceDate, -20))])
      return inventoryId
    }
    addInventory('O+', 'whole_blood', 12, 30)
    addInventory('O+', 'whole_blood', 8, 4)
    addInventory('A+', 'whole_blood', 60, 44)
    addInventory('AB+', 'whole_blood', 80, 44)
    addInventory('B+', 'platelets', 12, 2)
    addInventory('A-', 'plasma', 20, 5)
    addInventory('A-', 'plasma', 2, 19, 900101)
    const expiredONegativeId = addInventory('O-', 'whole_blood', 5, -12, null, 'expired')
    addInventory('AB-', 'whole_blood', 25, 50)
    addInventory('A+', 'platelets', 10, 19, 900102)
    addInventory('O+', 'plasma', 40, 39, 900102)
    addInventory('B-', 'whole_blood', 2, 35)
    addInventory('B-', 'platelets', 1, 35)
    addInventory('B-', 'plasma', 1, 35)

    const scenarioKeys = new Set(['O+|whole_blood', 'A+|whole_blood', 'AB+|whole_blood', 'B+|platelets', 'A-|plasma', 'O-|whole_blood', 'AB-|whole_blood', 'A+|platelets', 'O+|plasma', 'B-|whole_blood', 'B-|platelets', 'B-|plasma'])
    for (const bloodType of bloodTypes) {
      for (const component of componentTypes) {
        if (!scenarioKeys.has(`${bloodType}|${component}`)) addInventory(bloodType, component, 45, 45)
      }
    }
    await insertMany(connection, 'blood_inventory', ['id', 'blood_type', 'component_type', 'units', 'available_units', 'reserved_units', 'expiration_date', 'status', 'added_by', 'hospital_id', 'created_at'], inventory)

    const demandProfile = (bloodType, component, monthIndex) => {
      if (bloodType === 'O+' && component === 'whole_blood') return [30, 32, 35, 38, 30, 60][monthIndex]
      if (bloodType === 'A+' && component === 'whole_blood') return [24, 26, 28, 30, 30, 30][monthIndex]
      if (bloodType === 'AB+' && component === 'whole_blood') return [35, 34, 33, 32, 30, 10][monthIndex]
      if (bloodType === 'O-' && component === 'whole_blood') return [5, 5, 5, 5, 5, 5][monthIndex]
      const base = 8 + bloodTypes.indexOf(bloodType) + componentTypes.indexOf(component) * 2
      return base + (monthIndex % 2)
    }
    const requests = []
    let requestId = 920000
    const monthOffsets = [-165, -135, -105, -75, -45, -15]
    for (const bloodType of bloodTypes) {
      for (const component of componentTypes) {
        monthOffsets.forEach((monthOffset, monthIndex) => {
          splitUnits(demandProfile(bloodType, component, monthIndex)).forEach((units, sliceIndex) => {
            if (units <= 0) return
            requestId += 1
            const date = offsetDate(referenceDate, monthOffset + [-4, -2, 0, 2][sliceIndex], 9)
            requests.push([requestId, 900101, bloodType, component, units, 'normal', units, 'delivered', sqlDateTime(date), 900001, sqlDateTime(date), sqlDateTime(date), 'SIMULATION: fulfilled demand history'])
          })
        })
      }
    }
    const addPending = (id, hospitalId, bloodType, component, units, daysAgo, priority) => {
      requests.push([id, hospitalId, bloodType, component, units, priority, 0, 'pending', sqlDateTime(offsetDate(referenceDate, -daysAgo, 8)), null, null, null, 'SIMULATION: controlled pending request'])
    }
    addPending(929901, 900101, 'O-', 'whole_blood', 8, 4, 'critical')
    addPending(929902, 900101, 'A-', 'plasma', 15, 7, 'urgent')
    addPending(929903, 900101, 'O+', 'plasma', 20, 6, 'urgent')
    addPending(929904, 900101, 'O+', 'whole_blood', 10, 5, 'normal')
    addPending(929905, 900102, 'A+', 'platelets', 5, 3, 'normal')
    await insertMany(connection, 'blood_requests', ['id', 'hospital_id', 'blood_type', 'component_type', 'units_requested', 'priority', 'units_approved', 'status', 'request_date', 'approved_by', 'approved_at', 'fulfilled_at', 'notes'], requests)

    const donations = []
    let donationId = 930000
    for (const user of users.filter((row) => row[4] === 'donor')) {
      for (const daysAgo of [170, 110, 50]) {
        donationId += 1
        donations.push([donationId, user[0], user[7], sqlDate(offsetDate(referenceDate, -daysAgo)), 'Simulation Blood Center', null, 'completed', 1, null, sqlDateTime(offsetDate(referenceDate, -daysAgo)), 'whole_blood'])
      }
    }
    await insertMany(connection, 'donations', ['id', 'user_id', 'blood_type', 'donation_date', 'location', 'hospital_id', 'status', 'units_donated', 'inventory_id', 'created_at', 'component_type'], donations)

    const expiredRows = [[940001, expiredONegativeId, 'O-', 'whole_blood', 5, null, sqlDate(offsetDate(referenceDate, -12)), sqlDateTime(offsetDate(referenceDate, -12)), 'SIMULATION: controlled expired batch']]
    await insertMany(connection, 'expired_units', ['id', 'inventory_id', 'blood_type', 'component_type', 'units_expired', 'hospital_id', 'expiration_date', 'expired_at', 'notes'], expiredRows)
    await connection.query(`INSERT INTO \`${TARGET_DB}\`.simulation_metadata VALUES (1, ?, ?, ?, '1.0')`, [sqlDateTime(referenceDate), sqlDate(periodStart), sqlDate(referenceDate)])

    console.log('Simulation database created successfully.')
    console.log(`Reference date: ${sqlDate(referenceDate)}`)
    console.log(`Records: ${users.length} users, ${hospitals.length} hospitals, ${inventory.length} inventory batches, ${requests.length} requests, ${donations.length} donations`)
    console.log('Test admin: simulation_admin / Simulation123!')
    console.log(`Start the backend with DB_NAME=${TARGET_DB}`)
  } finally {
    await connection.end()
  }
}

main().catch((error) => {
  console.error('Failed to create analytics simulation database:', error.message)
  process.exit(1)
})
