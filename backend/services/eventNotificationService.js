const cron = require('node-cron')
const nodemailer = require('nodemailer')
const { pool } = require('../db')
const { insertNotificationsBulk } = require('../models/notificationModel')

function transporter() {
  if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS) return null
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: String(process.env.SMTP_SECURE || '').toLowerCase() === 'true',
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  })
}

async function sendEmailRecipients(recipients, subject, text) {
  const mailer = transporter()
  if (!mailer) return
  const from = process.env.SMTP_FROM || process.env.SMTP_USER
  await Promise.allSettled(recipients.filter((r) => r.email && !r.email.endsWith('@noemail.bloodconnect')).map((r) =>
    mailer.sendMail({ from, to: r.email, subject, text }),
  ))
}

async function notifyUsers({ whereSql, params = [], title, message, type = 'info', deliveryKey = null }) {
  const conn = await pool.getConnection()
  try {
    await conn.beginTransaction()
    if (deliveryKey) {
      const [existing] = await conn.query('SELECT event_key FROM admin_event_notification_deliveries WHERE event_key = ? FOR UPDATE', [deliveryKey])
      if (existing.length) { await conn.rollback(); return false }
      await conn.query('INSERT INTO admin_event_notification_deliveries (event_key) VALUES (?)', [deliveryKey])
    }
    const [users] = await conn.query(`SELECT id, email FROM users WHERE ${whereSql}`, params)
    await insertNotificationsBulk(users.map((u) => u.id), title, message, type, conn)
    await conn.commit()
    sendEmailRecipients(users, title, message).catch((error) => console.error('[Notifications] Email delivery failed:', error.message))
    return true
  } catch (error) { await conn.rollback(); throw error } finally { conn.release() }
}

async function notifyAdmins(title, message, deliveryKey) {
  return notifyUsers({ whereSql: "role IN ('admin', 'super_admin') AND status = 'active'", title, message, type: 'warning', deliveryKey })
}

async function notifyNewHospitalRequest({ hospitalId, items, requestGroupId }) {
  const [rows] = await pool.query('SELECT hospital_name FROM hospitals WHERE id = ?', [hospitalId])
  const hospitalName = rows[0]?.hospital_name || 'A hospital'
  const summary = items.map((i) => `${i.bloodType} (${i.unitsRequested} units)`).join(', ')
  return notifyAdmins('New hospital blood request', `${hospitalName} submitted a blood request: ${summary}.`, `hospital-request:${requestGroupId || items[0]?.id}`)
}

/**
 * Send a newly published announcement immediately.  Claiming the announcement
 * in the same delivery table used by the scheduler prevents a second message
 * when the event's start time is reached.
 */
async function notifyNewAnnouncement(announcement) {
  const message = [
    announcement.description,
    announcement.location ? `Location: ${announcement.location}` : '',
    announcement.event_starts_at ? `Starts: ${new Date(announcement.event_starts_at).toLocaleString('en-PH', { timeZone: process.env.NOTIFICATION_TIMEZONE || 'Asia/Manila' })}` : '',
  ].filter(Boolean).join('\n\n') || 'New announcement from BloodConnect.'

  const conn = await pool.getConnection()
  try {
    await conn.beginTransaction()
    const [claim] = await conn.query(
      'INSERT IGNORE INTO announcement_notification_deliveries (announcement_id) VALUES (?)',
      [announcement.id],
    )
    if (!claim.affectedRows) {
      await conn.rollback()
      return false
    }
    const [donors] = await conn.query("SELECT id, email FROM users WHERE role = 'donor' AND status = 'active'")
    await insertNotificationsBulk(donors.map((donor) => donor.id), announcement.title, message, 'info', conn)
    await conn.commit()
    sendEmailRecipients(donors, announcement.title, message).catch((error) => console.error('[Announcements] Email delivery failed:', error.message))
    return true
  } catch (error) {
    await conn.rollback()
    throw error
  } finally {
    conn.release()
  }
}

async function notifyNewMbdEvent(event) {
  const message = [
    `A mobile blood donation (MBD) schedule has been posted.`,
    `Date: ${event.event_date}`,
    `Location: ${event.location}`,
    event.organizer_name ? `Organizer: ${event.organizer_name}` : '',
  ].filter(Boolean).join('\n\n')

  return notifyUsers({
    whereSql: "role = 'donor' AND status = 'active'",
    title: event.name,
    message,
    type: 'info',
    deliveryKey: `mbd-event:${event.id}`,
  })
}

async function deliverDueAnnouncementNotifications() {
  const [announcements] = await pool.query(`
    SELECT a.id, a.title, a.description, a.location, a.event_starts_at
    FROM announcements a
    LEFT JOIN announcement_notification_deliveries d ON d.announcement_id = a.id
    WHERE d.announcement_id IS NULL AND a.status IN ('upcoming', 'ongoing') AND a.event_starts_at <= NOW()
  `)
  for (const announcement of announcements) {
    const conn = await pool.getConnection()
    try {
      await conn.beginTransaction()
      const [claim] = await conn.query('INSERT IGNORE INTO announcement_notification_deliveries (announcement_id) VALUES (?)', [announcement.id])
      if (!claim.affectedRows) { await conn.rollback(); continue }
      const [donors] = await conn.query("SELECT id, email FROM users WHERE role = 'donor' AND status = 'active'")
      const message = [announcement.description, announcement.location ? `Location: ${announcement.location}` : ''].filter(Boolean).join('\n\n')
      await insertNotificationsBulk(donors.map((d) => d.id), announcement.title, message || 'New announcement from BloodConnect.', 'info', conn)
      await conn.commit()
      sendEmailRecipients(donors, announcement.title, message || 'New announcement from BloodConnect.').catch((error) => console.error('[Announcements] Email delivery failed:', error.message))
    } catch (error) { await conn.rollback(); console.error('[Announcements] Delivery failed:', error.message) } finally { conn.release() }
  }
}

async function notifyExpiringInventory() {
  const [items] = await pool.query(`SELECT id, blood_type, COALESCE(component_type, 'whole_blood') AS component_type, available_units, expiration_date, DATEDIFF(DATE(expiration_date), CURDATE()) AS days_left FROM blood_inventory WHERE status = 'available' AND available_units > 0 AND DATEDIFF(DATE(expiration_date), CURDATE()) BETWEEN 0 AND 7`)
  for (const item of items) {
    await notifyAdmins('Action required: blood inventory nearing expiration', `${item.available_units} unit(s) of ${item.blood_type} (${item.component_type.replace('_', ' ')}) expire in ${item.days_left} day(s). Review the inventory in the admin system.`, `inventory-expiry:${item.id}`).catch((error) => console.error('[Expiry notifications] Failed:', error.message))
  }
}

function startEventNotificationScheduler() {
  cron.schedule('* * * * *', async () => {
    await deliverDueAnnouncementNotifications()
    await notifyExpiringInventory()
  }, { timezone: process.env.NOTIFICATION_TIMEZONE || 'Asia/Manila' })
  deliverDueAnnouncementNotifications().catch((error) => console.error('[Announcements] Startup check failed:', error.message))
  notifyExpiringInventory().catch((error) => console.error('[Expiry notifications] Startup check failed:', error.message))
}

module.exports = {
  startEventNotificationScheduler,
  deliverDueAnnouncementNotifications,
  notifyNewHospitalRequest,
  notifyNewAnnouncement,
  notifyNewMbdEvent,
}
