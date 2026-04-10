const { pool } = require('../db')
const { sendSemaphoreSms, normalizePhilippinePhone, isSemaphoreConfigured } = require('./semaphoreSmsService')

const DEFAULT_TIMEZONE = 'Asia/Manila'

function getCooldownDays() {
  const n = parseInt(process.env.DONOR_RECALL_COOLDOWN_DAYS || '90', 10)
  return Number.isNaN(n) || n <= 0 ? 90 : n
}

function getReminderDaysBeforeEligible() {
  const n = parseInt(process.env.DONOR_RECALL_REMINDER_DAYS_BEFORE || '2', 10)
  return Number.isNaN(n) || n < 0 ? 2 : n
}

function getBrandName() {
  return (process.env.DONOR_RECALL_BRAND_NAME || 'BloodConnect').trim() || 'BloodConnect'
}

/** YYYY-MM-DD in a given IANA timezone */
function todayDateStringInTimezone(timezone) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date())
}

/** Add N calendar days to YYYY-MM-DD → YYYY-MM-DD */
function addCalendarDays(isoDateStr, daysToAdd) {
  const [y, m, d] = isoDateStr.split('-').map((x) => parseInt(x, 10))
  const dt = new Date(Date.UTC(y, m - 1, d))
  dt.setUTCDate(dt.getUTCDate() + daysToAdd)
  const yy = dt.getUTCFullYear()
  const mm = String(dt.getUTCMonth() + 1).padStart(2, '0')
  const dd = String(dt.getUTCDate()).padStart(2, '0')
  return `${yy}-${mm}-${dd}`
}

function maxDateString(a, b) {
  if (!a) return b
  if (!b) return a
  return a > b ? a : b
}

function toYmd(value) {
  if (value == null) return null
  const s = String(value)
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10)
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    const y = value.getFullYear()
    const m = String(value.getMonth() + 1).padStart(2, '0')
    const d = String(value.getDate()).padStart(2, '0')
    return `${y}-${m}-${d}`
  }
  return s.length >= 10 ? s.slice(0, 10) : s
}

/**
 * Last whole-blood donation date for recall: max(schedule completed WB, users.last_donation_date).
 * @returns {Promise<string|null>} YYYY-MM-DD or null
 */
async function getReferenceLastDonationDate(userId) {
  const [wbRows] = await pool.query(
    `
    SELECT MAX(DATE(sr.reviewed_at)) AS wb_last
    FROM schedule_requests sr
    WHERE sr.user_id = ?
      AND sr.status = 'completed'
      AND COALESCE(sr.component_type, 'whole_blood') = 'whole_blood'
  `,
    [userId],
  )

  const [userRows] = await pool.query(
    `SELECT DATE(last_donation_date) AS u_last FROM users WHERE id = ? LIMIT 1`,
    [userId],
  )

  const wb = wbRows[0]?.wb_last ? toYmd(wbRows[0].wb_last) : null
  const u = userRows[0]?.u_last ? toYmd(userRows[0].u_last) : null
  const ref = maxDateString(wb, u)
  return ref || null
}

function buildManualMessage(fullName) {
  const brand = getBrandName()
  const first = (fullName || 'Donor').trim().split(/\s+/)[0] || 'Donor'
  return `Hi ${first}, this is ${brand}. We invite you to schedule your next blood donation when you can. Thank you for supporting our blood bank.`
}

function buildEligibleMessage(fullName) {
  const brand = getBrandName()
  const first = (fullName || 'Donor').trim().split(/\s+/)[0] || 'Donor'
  return `Hi ${first}, you are eligible to donate whole blood again today (${brand}). Please schedule your visit. Thank you.`
}

function buildReminderMessage(fullName) {
  const brand = getBrandName()
  const first = (fullName || 'Donor').trim().split(/\s+/)[0] || 'Donor'
  return `Hi ${first}, reminder from ${brand}: you will be eligible to donate whole blood again in 2 days. Plan your visit soon. Thank you.`
}

async function wasRecallAlreadySent(userId, kind, refLastDonationDate) {
  const [rows] = await pool.query(
    `
    SELECT id FROM donor_recall_sms_log
    WHERE user_id = ? AND kind = ? AND (
      (? IS NULL AND ref_last_donation_date IS NULL)
      OR (ref_last_donation_date = ?)
    )
    LIMIT 1
  `,
    [userId, kind, refLastDonationDate, refLastDonationDate],
  )
  return rows.length > 0
}

async function insertRecallLog({
  userId,
  kind,
  refLastDonationDate,
  phoneNumber,
  messageBody,
  success,
  semaphoreMessageId,
  errorMessage,
}) {
  await pool.query(
    `
    INSERT INTO donor_recall_sms_log
      (user_id, kind, ref_last_donation_date, phone_number, message_body, success, semaphore_message_id, error_message)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `,
    [
      userId,
      kind,
      refLastDonationDate,
      phoneNumber,
      messageBody,
      success ? 1 : 0,
      semaphoreMessageId || null,
      errorMessage || null,
    ],
  )
}

/**
 * Manual recall from admin — always attempts send; logs each attempt.
 */
async function sendManualRecallSms({ donorId, customMessage }) {
  const [users] = await pool.query(
    `SELECT id, full_name, phone, status FROM users WHERE id = ? AND role = 'donor' LIMIT 1`,
    [donorId],
  )
  if (users.length === 0) {
    return { ok: false, statusCode: 404, message: 'Donor not found' }
  }

  const donor = users[0]
  const phone = normalizePhilippinePhone(donor.phone)
  if (!phone) {
    return { ok: false, statusCode: 400, message: 'Donor has no valid mobile number' }
  }

  const message = (customMessage && String(customMessage).trim()) || buildManualMessage(donor.full_name)
  const result = await sendSemaphoreSms({ to: donor.phone, message })

  await insertRecallLog({
    userId: donorId,
    kind: 'manual',
    refLastDonationDate: null,
    phoneNumber: phone,
    messageBody: message,
    success: result.ok,
    semaphoreMessageId: result.messageId || null,
    errorMessage: result.ok ? null : result.error,
  })

  if (!result.ok) {
    return { ok: false, statusCode: 502, message: result.error || 'Failed to send SMS' }
  }

  return { ok: true, message: 'SMS sent', messageId: result.messageId || null }
}

/**
 * Daily job: reminder (eligible_date - 2) and eligible (exact eligible day).
 */
async function runDailyDonorRecallJob() {
  const tz = process.env.DONOR_RECALL_TIMEZONE || DEFAULT_TIMEZONE
  const today = todayDateStringInTimezone(tz)
  const cooldown = getCooldownDays()
  const reminderBefore = getReminderDaysBeforeEligible()

  if (!isSemaphoreConfigured()) {
    console.warn('[Donor Recall] SEMAPHORE_API_KEY missing. Skipping automatic recall job.')
    return { skipped: true, reason: 'no_semaphore' }
  }

  const [donors] = await pool.query(
    `
    SELECT id, full_name, phone, status
    FROM users
    WHERE role = 'donor' AND status = 'active'
      AND phone IS NOT NULL AND TRIM(phone) <> ''
  `,
  )

  let reminders = 0
  let eligibles = 0
  let errors = 0

  for (const d of donors) {
    const userId = d.id
    const ref = await getReferenceLastDonationDate(userId)
    if (!ref) continue

    const eligibleOn = addCalendarDays(ref, cooldown)
    const reminderOn = addCalendarDays(ref, cooldown - reminderBefore)

    const phone = normalizePhilippinePhone(d.phone)
    if (!phone) continue

    if (today === reminderOn) {
      const already = await wasRecallAlreadySent(userId, 'reminder', ref)
      if (!already) {
        const msg = buildReminderMessage(d.full_name)
        const result = await sendSemaphoreSms({ to: d.phone, message: msg })
        await insertRecallLog({
          userId,
          kind: 'reminder',
          refLastDonationDate: ref,
          phoneNumber: phone,
          messageBody: msg,
          success: result.ok,
          semaphoreMessageId: result.messageId || null,
          errorMessage: result.ok ? null : result.error,
        })
        if (result.ok) reminders += 1
        else errors += 1
      }
    }

    if (today === eligibleOn) {
      const already = await wasRecallAlreadySent(userId, 'eligible', ref)
      if (!already) {
        const msg = buildEligibleMessage(d.full_name)
        const result = await sendSemaphoreSms({ to: d.phone, message: msg })
        await insertRecallLog({
          userId,
          kind: 'eligible',
          refLastDonationDate: ref,
          phoneNumber: phone,
          messageBody: msg,
          success: result.ok,
          semaphoreMessageId: result.messageId || null,
          errorMessage: result.ok ? null : result.error,
        })
        if (result.ok) eligibles += 1
        else errors += 1
      }
    }
  }

  console.log(
    `[Donor Recall] ${today} (${tz}): reminders=${reminders}, eligible-day=${eligibles}, send_errors=${errors}`,
  )
  return { today, reminders, eligibles, errors }
}

module.exports = {
  getCooldownDays,
  getReminderDaysBeforeEligible,
  getReferenceLastDonationDate,
  sendManualRecallSms,
  runDailyDonorRecallJob,
  buildManualMessage,
}
