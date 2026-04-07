const cron = require('node-cron')
const nodemailer = require('nodemailer')
const { pool } = require('../db')

const DEFAULT_CRON_EXPRESSION = '0 7 * * *'
const ALERT_MILESTONE_DAYS = [7, 3, 2, 1]

function parseBoolean(value) {
  return String(value || '')
    .trim()
    .toLowerCase() === 'true'
}

function buildTransporter() {
  const host = process.env.SMTP_HOST
  const port = Number(process.env.SMTP_PORT || 587)
  const secure = parseBoolean(process.env.SMTP_SECURE)
  const user = process.env.SMTP_USER
  const pass = process.env.SMTP_PASS

  if (!host || !user || !pass) {
    return null
  }

  return nodemailer.createTransport({
    host,
    port,
    secure,
    auth: {
      user,
      pass,
    },
  })
}

async function getHospitalsWithExpiringInventory() {
  const milestonePlaceholders = ALERT_MILESTONE_DAYS.map(() => '?').join(', ')
  const [rows] = await pool.query(
    `
    SELECT
      h.id AS hospital_id,
      h.hospital_name,
      u.email AS hospital_email,
      bi.blood_type,
      COALESCE(bi.component_type, 'whole_blood') AS component_type,
      DATE(bi.expiration_date) AS expiration_date,
      DATEDIFF(DATE(bi.expiration_date), CURDATE()) AS days_until_expiry,
      SUM(bi.available_units) AS units
    FROM blood_inventory bi
    INNER JOIN hospitals h ON h.id = bi.hospital_id
    INNER JOIN users u ON u.id = h.user_id
    WHERE bi.status = 'available'
      AND bi.available_units > 0
      AND DATEDIFF(DATE(bi.expiration_date), CURDATE()) IN (${milestonePlaceholders})
      AND u.email IS NOT NULL
      AND u.email <> ''
      AND u.email LIKE '%@gmail.com'
    GROUP BY
      h.id,
      h.hospital_name,
      u.email,
      bi.blood_type,
      COALESCE(bi.component_type, 'whole_blood'),
      DATE(bi.expiration_date),
      DATEDIFF(DATE(bi.expiration_date), CURDATE())
    ORDER BY h.id ASC, expiration_date ASC, bi.blood_type ASC
  `,
    ALERT_MILESTONE_DAYS,
  )

  return rows
}

function groupRowsByHospital(rows) {
  const grouped = new Map()

  for (const row of rows) {
    const hospitalId = row.hospital_id
    if (!grouped.has(hospitalId)) {
      grouped.set(hospitalId, {
        hospitalId,
        hospitalName: row.hospital_name,
        email: row.hospital_email,
        items: [],
      })
    }

    grouped.get(hospitalId).items.push({
      bloodType: row.blood_type,
      componentType: row.component_type || 'whole_blood',
      units: Number(row.units || 0),
      expirationDate: new Date(row.expiration_date).toISOString().slice(0, 10),
      daysUntilExpiry: Number(row.days_until_expiry || 0),
    })
  }

  return Array.from(grouped.values())
}

function buildEmailBody(hospitalName, items) {
  const daysMention = Array.from(
    new Set(
      items
        .map((item) => Number(item.daysUntilExpiry))
        .filter((days) => Number.isInteger(days) && days >= 0),
    ),
  ).sort((a, b) => b - a)

  const lines = items.map(
    (item) =>
      `- Blood Type: ${item.bloodType} (${item.componentType}), Units: ${item.units}, Expiration Date: ${item.expirationDate}, Days Left: ${item.daysUntilExpiry}`,
  )

  return [
    `Dear ${hospitalName},`,
    '',
    `The following blood inventory units are about to expire in ${daysMention.join(', ')} day(s):`,
    ...lines,
    '',
    'Please prioritize these units to reduce wastage.',
    '',
    'BloodConnect System',
  ].join('\n')
}

async function sendHospitalExpiryAlert(transporter, fromEmail, hospital) {
  const milestoneLabel = Array.from(
    new Set(
      hospital.items
        .map((item) => Number(item.daysUntilExpiry))
        .filter((days) => Number.isInteger(days) && days >= 0),
    ),
  )
    .sort((a, b) => b - a)
    .join(',')
  const runDate = new Date().toISOString().slice(0, 10)
  const subject = `Blood Inventory Expiry Alert — ${hospital.hospitalName} (${milestoneLabel}d) · ${runDate}`
  const text = buildEmailBody(hospital.hospitalName, hospital.items)

  await transporter.sendMail({
    from: fromEmail,
    to: hospital.email,
    subject,
    text,
  })
}

async function runHospitalInventoryAlertCheck() {
  const transporter = buildTransporter()
  if (!transporter) {
    console.warn('[Inventory Alert] SMTP configuration missing. Skipping alert check.')
    return
  }

  const fromEmail = process.env.SMTP_FROM || process.env.SMTP_USER
  const rows = await getHospitalsWithExpiringInventory()

  if (!rows.length) {
    console.log('[Inventory Alert] No expiring blood inventory found.')
    return
  }

  const hospitals = groupRowsByHospital(rows)
  for (const hospital of hospitals) {
    await sendHospitalExpiryAlert(transporter, fromEmail, hospital)
  }

  console.log(`[Inventory Alert] Sent expiry alerts to ${hospitals.length} hospital(s).`)
}

function startHospitalInventoryAlertScheduler() {
  const cronExpression = process.env.HOSPITAL_INVENTORY_ALERT_CRON || DEFAULT_CRON_EXPRESSION
  const timezone = process.env.HOSPITAL_INVENTORY_ALERT_TIMEZONE || 'Asia/Manila'
  const runOnStartup = parseBoolean(process.env.HOSPITAL_INVENTORY_ALERT_RUN_ON_STARTUP)

  if (!cron.validate(cronExpression)) {
    console.warn(`[Inventory Alert] Invalid cron expression "${cronExpression}". Scheduler disabled.`)
    return null
  }

  const task = cron.schedule(
    cronExpression,
    async () => {
      try {
        await runHospitalInventoryAlertCheck()
      } catch (error) {
        console.error('[Inventory Alert] Scheduled check failed:', error.message)
      }
    },
    { timezone },
  )

  if (runOnStartup) {
    runHospitalInventoryAlertCheck().catch((error) => {
      console.error('[Inventory Alert] Startup check failed:', error.message)
    })
  }

  console.log(`[Inventory Alert] Scheduler started (${cronExpression}, timezone: ${timezone}).`)
  return task
}

module.exports = {
  startHospitalInventoryAlertScheduler,
  runHospitalInventoryAlertCheck,
}
