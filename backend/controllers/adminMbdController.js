const { pool } = require('../db')
const bcrypt = require('bcryptjs')

const BLOOD_TYPES = new Set(['A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-', 'A', 'B', 'O', 'AB'])
const REMARKS = new Set(['S', 'D', 'T'])
const DEFERRAL_KEYS = [
  'low_hbg',
  'menstruation',
  'high_bp',
  'low_bp',
  'vaccinations',
  'underweight',
  'tattoo_piercing',
  'antibiotic_therapy_or_medication',
  'less_than_3_months_from_last_donations',
  'surgical_operations',
  'dental_extraction',
  'cough_colds',
  'fever',
  'lack_of_sleep',
  'alcohol_intake_less_than_12_hrs',
]

const CUSTOM_DEFERRAL_LABELS_KEY = '_custom_labels'

function normalizeDeferralCounts(raw) {
  let parsed = raw
  if (typeof raw === 'string' && raw.trim()) {
    try {
      parsed = JSON.parse(raw)
    } catch {
      parsed = null
    }
  }
  const out = {}
  DEFERRAL_KEYS.forEach((key) => {
    const value = parsed && Object.prototype.hasOwnProperty.call(parsed, key) ? Number(parsed[key]) : 0
    out[key] = Number.isFinite(value) && value > 0 ? Math.floor(value) : 0
  })
  if (parsed && typeof parsed === 'object') {
    Object.keys(parsed).forEach((key) => {
      if (key.startsWith('custom_')) {
        const value = Number(parsed[key])
        out[key] = Number.isFinite(value) && value > 0 ? Math.floor(value) : 0
      }
    })
    const labels = parsed[CUSTOM_DEFERRAL_LABELS_KEY]
    if (labels && typeof labels === 'object' && !Array.isArray(labels)) {
      const normalizedLabels = {}
      Object.keys(labels).forEach((key) => {
        if (!key.startsWith('custom_')) return
        const label = String(labels[key] || '').trim()
        if (label) normalizedLabels[key] = label
      })
      if (Object.keys(normalizedLabels).length) {
        out[CUSTOM_DEFERRAL_LABELS_KEY] = normalizedLabels
      }
    }
  }
  return out
}

const mapEventRow = (row) => ({
  id: row.id,
  name: row.name,
  organizer_name: row.organizer_name != null ? String(row.organizer_name) : '',
  event_date: row.event_date,
  location: row.location,
  donor_count: row.donor_count != null ? Number(row.donor_count) : 0,
  deferral_counts: normalizeDeferralCounts(row.deferral_counts_json || null),
  created_at: row.created_at,
  updated_at: row.updated_at,
})

const mapDonorRow = (row) => ({
  id: row.id,
  mbd_event_id: row.mbd_event_id,
  donor_name: row.donor_name,
  barcode: row.barcode,
  blood_type: row.blood_type,
  donor_number: row.donor_number,
  assigned_donor_id: row.assigned_donor_id,
  age: row.age != null ? Number(row.age) : null,
  gender: row.gender,
  bag_type: row.bag_type,
  remarks_sd: row.remarks_sd,
  num_donations: row.num_donations != null ? Number(row.num_donations) : 0,
  transferred_donor_user_id:
    row.transferred_donor_user_id != null ? Number(row.transferred_donor_user_id) : null,
  created_at: row.created_at,
  updated_at: row.updated_at,
})

function normalizeBloodType(raw) {
  const value = String(raw || '').trim().toUpperCase()
  if (!value) return ''
  if (value === 'AB+' || value === 'AB-') return value
  if (value === 'A+' || value === 'A-') return value
  if (value === 'B+' || value === 'B-') return value
  if (value === 'O+' || value === 'O-') return value
  if (value === 'AB') return 'AB'
  if (value === 'A') return 'A'
  if (value === 'B') return 'B'
  if (value === 'O') return 'O'
  return value
}

function normalizeUserBloodTypeFromMbd(raw) {
  const value = String(raw || '').trim().toUpperCase()
  if (!value) return null
  const validUserTypes = new Set(['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'])
  if (validUserTypes.has(value)) return value
  if (value === 'A' || value === 'B' || value === 'AB' || value === 'O') return `${value}+`
  return null
}

function parseEventId(req) {
  const id = Number(req.params.id)
  if (!Number.isFinite(id) || id < 1) return null
  return id
}

function parseDonorId(req) {
  const id = Number(req.params.donorId)
  if (!Number.isFinite(id) || id < 1) return null
  return id
}

async function generateUniqueUsername(base = 'mbd_donor') {
  const seed = String(base || 'mbd_donor')
    .toLowerCase()
    .replace(/[^a-z0-9._-]/g, '')
    .slice(0, 30) || 'mbd_donor'
  let idx = 0
  while (idx < 1000) {
    const candidate = idx === 0 ? seed : `${seed}${idx}`
    const [rows] = await pool.query('SELECT id FROM users WHERE username = ? LIMIT 1', [candidate])
    if (!rows.length) return candidate
    idx += 1
  }
  return `${seed}_${Date.now()}`
}

const listMbdEventsController = async (req, res) => {
  try {
    const [rows] = await pool.query(
      `
      SELECT
        e.id,
        e.name,
        e.organizer_name,
        e.event_date,
        e.location,
        e.deferral_counts_json,
        e.created_at,
        e.updated_at,
        (SELECT COUNT(*) FROM mbd_donor_records d WHERE d.mbd_event_id = e.id) AS donor_count
      FROM mbd_events e
      ORDER BY e.event_date DESC, e.id DESC
    `,
    )
    return res.json(rows.map(mapEventRow))
  } catch (error) {
    if (error && (error.code === 'ER_NO_SUCH_TABLE' || error.errno === 1146)) {
      return res.status(500).json({
        message: 'MBD tables are missing. Restart the server to run schema migration.',
      })
    }
    console.error('List MBD events error:', error)
    return res.status(500).json({ message: 'Failed to fetch MBD events' })
  }
}

const createMbdEventController = async (req, res) => {
  const name = req.body.name != null ? String(req.body.name).trim() : ''
  const organizerName =
    req.body.organizerName != null
      ? String(req.body.organizerName).trim()
      : req.body.organizer_name != null
        ? String(req.body.organizer_name).trim()
        : ''
  const eventDate = req.body.eventDate != null ? String(req.body.eventDate).trim() : ''
  const eventDateAlt = req.body.event_date != null ? String(req.body.event_date).trim() : ''
  const dateNorm = eventDate || eventDateAlt
  const location = req.body.location != null ? String(req.body.location).trim() : ''

  if (!name) {
    return res.status(400).json({ message: 'name is required' })
  }
  if (!organizerName) {
    return res.status(400).json({ message: 'organizerName is required' })
  }
  if (!dateNorm) {
    return res.status(400).json({ message: 'eventDate is required' })
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateNorm)) {
    return res.status(400).json({ message: 'eventDate must be YYYY-MM-DD' })
  }
  if (!location) {
    return res.status(400).json({ message: 'location is required' })
  }

  try {
    const [result] = await pool.query(
      `
      INSERT INTO mbd_events (name, organizer_name, event_date, location, deferral_counts_json)
      VALUES (?, ?, ?, ?, ?)
    `,
      [name, organizerName, dateNorm, location, JSON.stringify(normalizeDeferralCounts(null))],
    )

    const [rows] = await pool.query(
      `
      SELECT
        e.id,
        e.name,
        e.organizer_name,
        e.event_date,
        e.location,
        e.deferral_counts_json,
        e.created_at,
        e.updated_at,
        0 AS donor_count
      FROM mbd_events e
      WHERE e.id = ?
    `,
      [result.insertId],
    )

    return res.status(201).json(mapEventRow(rows[0]))
  } catch (error) {
    if (error && (error.code === 'ER_NO_SUCH_TABLE' || error.errno === 1146)) {
      return res.status(500).json({
        message: 'MBD tables are missing. Restart the server to run schema migration.',
      })
    }
    console.error('Create MBD event error:', error)
    return res.status(500).json({ message: 'Failed to create MBD event' })
  }
}

const listMbdDonorsController = async (req, res) => {
  const eventId = parseEventId(req)
  if (!eventId) {
    return res.status(400).json({ message: 'Invalid MBD event id' })
  }

  try {
    const [exists] = await pool.query('SELECT id FROM mbd_events WHERE id = ? LIMIT 1', [eventId])
    if (!exists.length) {
      return res.status(404).json({ message: 'MBD event not found' })
    }

    const [rows] = await pool.query(
      `
      SELECT
        id,
        mbd_event_id,
        donor_name,
        barcode,
        blood_type,
        donor_number,
        assigned_donor_id,
        age,
        gender,
        bag_type,
        remarks_sd,
        num_donations,
        transferred_donor_user_id,
        created_at,
        updated_at
      FROM mbd_donor_records
      WHERE mbd_event_id = ?
      ORDER BY id ASC
    `,
      [eventId],
    )
    return res.json(rows.map(mapDonorRow))
  } catch (error) {
    if (error && (error.code === 'ER_NO_SUCH_TABLE' || error.errno === 1146)) {
      return res.status(500).json({
        message: 'MBD tables are missing. Restart the server to run schema migration.',
      })
    }
    console.error('List MBD donors error:', error)
    return res.status(500).json({ message: 'Failed to fetch donor records' })
  }
}

const createMbdDonorController = async (req, res) => {
  const eventId = parseEventId(req)
  if (!eventId) {
    return res.status(400).json({ message: 'Invalid MBD event id' })
  }

  const donorName =
    req.body.donorName != null
      ? String(req.body.donorName).trim()
      : req.body.donor_name != null
        ? String(req.body.donor_name).trim()
        : ''
  const barcode = req.body.barcode != null ? String(req.body.barcode).trim() : ''
  const bloodTypeRaw =
    req.body.bloodType != null
      ? String(req.body.bloodType).trim()
      : req.body.blood_type != null
        ? String(req.body.blood_type).trim()
        : ''
  const bloodType = normalizeBloodType(bloodTypeRaw)
  const donorNumber =
    req.body.donorNumber != null
      ? String(req.body.donorNumber).trim()
      : req.body.donor_number != null
        ? String(req.body.donor_number).trim()
        : ''
  const assignedDonorId =
    req.body.assignedDonorId != null
      ? String(req.body.assignedDonorId).trim()
      : req.body.assigned_donor_id != null
        ? String(req.body.assigned_donor_id).trim()
        : ''
  const ageRaw = req.body.age
  const gender = req.body.gender != null ? String(req.body.gender).trim() : ''
  const bagType = req.body.bagType != null ? String(req.body.bagType).trim() : req.body.bag_type != null ? String(req.body.bag_type).trim() : ''
  const remarksRaw =
    req.body.remarksSd != null
      ? String(req.body.remarksSd).trim().toUpperCase()
      : req.body.remarks_sd != null
        ? String(req.body.remarks_sd).trim().toUpperCase()
        : ''
  const remarks = remarksRaw ? remarksRaw : null
  const numRaw = req.body.numDonations != null ? req.body.numDonations : req.body.num_donations

  if (!donorName) {
    return res.status(400).json({ message: 'donorName is required' })
  }
  if (!BLOOD_TYPES.has(bloodType)) {
    return res.status(400).json({
      message: 'bloodType must be one of A+, A-, B+, B-, O+, O-, AB+, AB-',
    })
  }
  if (remarks != null && !REMARKS.has(remarks)) {
    return res.status(400).json({ message: 'remarksSd must be S, D, T, or empty' })
  }

  let age = null
  if (ageRaw !== undefined && ageRaw !== null && String(ageRaw).trim() !== '') {
    age = Number(ageRaw)
    if (!Number.isFinite(age) || age < 0 || age > 130) {
      return res.status(400).json({ message: 'age must be a valid number' })
    }
  }

  let numDonations = 1
  if (numRaw !== undefined && numRaw !== null && String(numRaw).trim() !== '') {
    numDonations = Number(numRaw)
    if (!Number.isFinite(numDonations) || numDonations < 0) {
      return res.status(400).json({ message: 'numDonations must be a non-negative number' })
    }
  }

  try {
    const [exists] = await pool.query('SELECT id FROM mbd_events WHERE id = ? LIMIT 1', [eventId])
    if (!exists.length) {
      return res.status(404).json({ message: 'MBD event not found' })
    }

    const [result] = await pool.query(
      `
      INSERT INTO mbd_donor_records (
        mbd_event_id,
        donor_name,
        barcode,
        blood_type,
        donor_number,
        assigned_donor_id,
        age,
        gender,
        bag_type,
        remarks_sd,
        num_donations
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
      [
        eventId,
        donorName,
        barcode || null,
        bloodType,
        donorNumber || null,
        assignedDonorId || null,
        age,
        gender || null,
        bagType || null,
        remarks,
        numDonations,
      ],
    )

    const [rows] = await pool.query(
      `
      SELECT
        id,
        mbd_event_id,
        donor_name,
        barcode,
        blood_type,
        donor_number,
        assigned_donor_id,
        age,
        gender,
        bag_type,
        remarks_sd,
        num_donations,
        transferred_donor_user_id,
        created_at,
        updated_at
      FROM mbd_donor_records
      WHERE id = ?
    `,
      [result.insertId],
    )

    return res.status(201).json(mapDonorRow(rows[0]))
  } catch (error) {
    if (error && (error.code === 'ER_NO_SUCH_TABLE' || error.errno === 1146)) {
      return res.status(500).json({
        message: 'MBD tables are missing. Restart the server to run schema migration.',
      })
    }
    console.error('Create MBD donor error:', error)
    return res.status(500).json({ message: 'Failed to create donor record' })
  }
}

const updateMbdDonorController = async (req, res) => {
  const eventId = parseEventId(req)
  const donorId = parseDonorId(req)
  if (!eventId || !donorId) {
    return res.status(400).json({ message: 'Invalid id' })
  }

  const donorName =
    req.body.donorName != null
      ? String(req.body.donorName).trim()
      : req.body.donor_name != null
        ? String(req.body.donor_name).trim()
        : ''
  const barcode = req.body.barcode != null ? String(req.body.barcode).trim() : ''
  const bloodTypeRaw =
    req.body.bloodType != null
      ? String(req.body.bloodType).trim()
      : req.body.blood_type != null
        ? String(req.body.blood_type).trim()
        : ''
  const bloodType = normalizeBloodType(bloodTypeRaw)
  const donorNumber =
    req.body.donorNumber != null
      ? String(req.body.donorNumber).trim()
      : req.body.donor_number != null
        ? String(req.body.donor_number).trim()
        : ''
  const assignedDonorId =
    req.body.assignedDonorId != null
      ? String(req.body.assignedDonorId).trim()
      : req.body.assigned_donor_id != null
        ? String(req.body.assigned_donor_id).trim()
        : ''
  const ageRaw = req.body.age
  const gender = req.body.gender != null ? String(req.body.gender).trim() : ''
  const bagType = req.body.bagType != null ? String(req.body.bagType).trim() : req.body.bag_type != null ? String(req.body.bag_type).trim() : ''
  const remarksRaw =
    req.body.remarksSd != null
      ? String(req.body.remarksSd).trim().toUpperCase()
      : req.body.remarks_sd != null
        ? String(req.body.remarks_sd).trim().toUpperCase()
        : ''
  const remarks = remarksRaw ? remarksRaw : null
  const numRaw = req.body.numDonations != null ? req.body.numDonations : req.body.num_donations

  if (!donorName) {
    return res.status(400).json({ message: 'donorName is required' })
  }
  if (!BLOOD_TYPES.has(bloodType)) {
    return res.status(400).json({
      message: 'bloodType must be one of A+, A-, B+, B-, O+, O-, AB+, AB-',
    })
  }
  if (remarks != null && !REMARKS.has(remarks)) {
    return res.status(400).json({ message: 'remarksSd must be S, D, T, or empty' })
  }

  let age = null
  if (ageRaw !== undefined && ageRaw !== null && String(ageRaw).trim() !== '') {
    age = Number(ageRaw)
    if (!Number.isFinite(age) || age < 0 || age > 130) {
      return res.status(400).json({ message: 'age must be a valid number' })
    }
  }

  let numDonations = 1
  if (numRaw !== undefined && numRaw !== null && String(numRaw).trim() !== '') {
    numDonations = Number(numRaw)
    if (!Number.isFinite(numDonations) || numDonations < 0) {
      return res.status(400).json({ message: 'numDonations must be a non-negative number' })
    }
  }

  try {
    const [result] = await pool.query(
      `
      UPDATE mbd_donor_records
      SET
        donor_name = ?,
        barcode = ?,
        blood_type = ?,
        donor_number = ?,
        assigned_donor_id = ?,
        age = ?,
        gender = ?,
        bag_type = ?,
        remarks_sd = ?,
        num_donations = ?
      WHERE id = ? AND mbd_event_id = ?
    `,
      [
        donorName,
        barcode || null,
        bloodType,
        donorNumber || null,
        assignedDonorId || null,
        age,
        gender || null,
        bagType || null,
        remarks,
        numDonations,
        donorId,
        eventId,
      ],
    )

    if (!result.affectedRows) {
      return res.status(404).json({ message: 'Donor record not found for this MBD event' })
    }

    const [rows] = await pool.query(
      `
      SELECT
        id,
        mbd_event_id,
        donor_name,
        barcode,
        blood_type,
        donor_number,
        assigned_donor_id,
        age,
        gender,
        bag_type,
        remarks_sd,
        num_donations,
        transferred_donor_user_id,
        created_at,
        updated_at
      FROM mbd_donor_records
      WHERE id = ? AND mbd_event_id = ?
    `,
      [donorId, eventId],
    )

    const updated = mapDonorRow(rows[0])
    if (updated.transferred_donor_user_id && assignedDonorId) {
      await pool.query(
        `UPDATE users SET assigned_donor_id = ? WHERE id = ? AND role = 'donor'`,
        [assignedDonorId, updated.transferred_donor_user_id],
      )
    }

    return res.json(updated)
  } catch (error) {
    if (error && (error.code === 'ER_NO_SUCH_TABLE' || error.errno === 1146)) {
      return res.status(500).json({
        message: 'MBD tables are missing. Restart the server to run schema migration.',
      })
    }
    console.error('Update MBD donor error:', error)
    return res.status(500).json({ message: 'Failed to update donor record' })
  }
}

const deleteMbdDonorController = async (req, res) => {
  const eventId = parseEventId(req)
  const donorId = parseDonorId(req)
  if (!eventId || !donorId) {
    return res.status(400).json({ message: 'Invalid id' })
  }

  try {
    const [result] = await pool.query(
      'DELETE FROM mbd_donor_records WHERE id = ? AND mbd_event_id = ?',
      [donorId, eventId],
    )
    if (!result.affectedRows) {
      return res.status(404).json({ message: 'Donor record not found for this MBD event' })
    }
    return res.status(204).send()
  } catch (error) {
    if (error && (error.code === 'ER_NO_SUCH_TABLE' || error.errno === 1146)) {
      return res.status(500).json({
        message: 'MBD tables are missing. Restart the server to run schema migration.',
      })
    }
    console.error('Delete MBD donor error:', error)
    return res.status(500).json({ message: 'Failed to delete donor record' })
  }
}

const transferMbdDonorToDonorListController = async (req, res) => {
  const eventId = parseEventId(req)
  const donorId = parseDonorId(req)
  if (!eventId || !donorId) {
    return res.status(400).json({ message: 'Invalid id' })
  }

  const conn = await pool.getConnection()
  try {
    await conn.beginTransaction()
    const [rows] = await conn.query(
      `
      SELECT
        id,
        donor_name,
        barcode,
        blood_type,
        donor_number,
        assigned_donor_id,
        transferred_donor_user_id,
        remarks_sd
      FROM mbd_donor_records
      WHERE id = ? AND mbd_event_id = ?
      LIMIT 1
      FOR UPDATE
    `,
      [donorId, eventId],
    )
    if (!rows.length) {
      await conn.rollback()
      return res.status(404).json({ message: 'Donor record not found for this MBD event' })
    }
    const mbdDonor = rows[0]
    const status = mbdDonor.remarks_sd ? 'discontinued' : 'active'
    const normalizedUserBloodType = normalizeUserBloodTypeFromMbd(mbdDonor.blood_type)
    const donorNumber = String(mbdDonor.donor_number || '').trim()
    const assignedDonorId = String(mbdDonor.assigned_donor_id || '').trim()
    let targetUserId = mbdDonor.transferred_donor_user_id ? Number(mbdDonor.transferred_donor_user_id) : null

    if (!targetUserId && mbdDonor.barcode) {
      const [existingByBarcode] = await conn.query(
        "SELECT id FROM users WHERE role = 'donor' AND barcode = ? LIMIT 1",
        [mbdDonor.barcode],
      )
      if (existingByBarcode.length) targetUserId = Number(existingByBarcode[0].id)
    }

    let transferablePhone = donorNumber || null
    if (transferablePhone) {
      const params = [transferablePhone]
      let phoneSql = "SELECT id FROM users WHERE role = 'donor' AND phone = ?"
      if (targetUserId) {
        phoneSql += ' AND id <> ?'
        params.push(targetUserId)
      }
      phoneSql += ' LIMIT 1'
      const [existingPhone] = await conn.query(phoneSql, params)
      if (existingPhone.length) transferablePhone = null
    }

    if (targetUserId) {
      await conn.query(
        `
        UPDATE users
        SET
          full_name = COALESCE(NULLIF(?, ''), full_name),
          blood_type = COALESCE(NULLIF(?, ''), blood_type),
          phone = CASE WHEN (phone IS NULL OR TRIM(phone) = '') THEN ? ELSE phone END,
          status = ?,
          is_manual_donor = 1,
          barcode = COALESCE(NULLIF(?, ''), barcode),
          assigned_donor_id = COALESCE(NULLIF(?, ''), assigned_donor_id)
        WHERE id = ? AND role = 'donor'
      `,
        [
          mbdDonor.donor_name || '',
          normalizedUserBloodType || '',
          transferablePhone,
          status,
          mbdDonor.barcode || '',
          assignedDonorId,
          targetUserId,
        ],
      )
    } else {
      const usernameBase = `mbd_${(mbdDonor.barcode || mbdDonor.donor_name || 'donor').toLowerCase()}`
      const username = await generateUniqueUsername(usernameBase)
      const passwordHash = await bcrypt.hash(`mbd-${Date.now()}-${Math.random()}`, 10)
      const safeEmail = `${username}@noemail.bloodconnect`
      const [insertResult] = await conn.query(
        `
        INSERT INTO users (
          username, email, password_hash, role, full_name, phone, blood_type, status, last_donation_date, is_manual_donor, barcode, assigned_donor_id
        )
        VALUES (?, ?, ?, 'donor', ?, ?, ?, ?, NULL, 1, ?, ?)
      `,
        [
          username,
          safeEmail,
          passwordHash,
          mbdDonor.donor_name || '',
          transferablePhone,
          normalizedUserBloodType,
          status,
          mbdDonor.barcode || null,
          assignedDonorId || null,
        ],
      )
      targetUserId = Number(insertResult.insertId)
    }

    await conn.query(
      'UPDATE mbd_donor_records SET transferred_donor_user_id = ? WHERE id = ? AND mbd_event_id = ?',
      [targetUserId, donorId, eventId],
    )

    await conn.commit()
    return res.status(mbdDonor.transferred_donor_user_id ? 200 : 201).json({
      message: mbdDonor.transferred_donor_user_id
        ? 'Donor already in donor list; synced latest data'
        : 'Donor added to donor list',
      donorUserId: targetUserId,
      alreadyTransferred: Boolean(mbdDonor.transferred_donor_user_id),
    })
  } catch (error) {
    await conn.rollback()
    if (error && (error.code === 'ER_NO_SUCH_TABLE' || error.errno === 1146)) {
      return res.status(500).json({
        message: 'MBD tables are missing. Restart the server to run schema migration.',
      })
    }
    console.error('Transfer MBD donor error:', error)
    return res.status(500).json({ message: 'Failed to transfer donor to donor list' })
  } finally {
    conn.release()
  }
}

const getMbdDeferralsController = async (req, res) => {
  const eventId = parseEventId(req)
  if (!eventId) {
    return res.status(400).json({ message: 'Invalid MBD event id' })
  }
  try {
    const [rows] = await pool.query(
      'SELECT id, deferral_counts_json FROM mbd_events WHERE id = ? LIMIT 1',
      [eventId],
    )
    if (!rows.length) {
      return res.status(404).json({ message: 'MBD event not found' })
    }
    return res.json({ deferral_counts: normalizeDeferralCounts(rows[0].deferral_counts_json || null) })
  } catch (error) {
    if (error && (error.code === 'ER_NO_SUCH_TABLE' || error.errno === 1146)) {
      return res.status(500).json({
        message: 'MBD tables are missing. Restart the server to run schema migration.',
      })
    }
    console.error('Get MBD deferrals error:', error)
    return res.status(500).json({ message: 'Failed to fetch deferral data' })
  }
}

const updateMbdDeferralsController = async (req, res) => {
  const eventId = parseEventId(req)
  if (!eventId) {
    return res.status(400).json({ message: 'Invalid MBD event id' })
  }
  const nextCounts = normalizeDeferralCounts(req.body?.deferralCounts ?? req.body?.deferral_counts ?? null)
  try {
    const [result] = await pool.query(
      'UPDATE mbd_events SET deferral_counts_json = ? WHERE id = ?',
      [JSON.stringify(nextCounts), eventId],
    )
    if (!result.affectedRows) {
      return res.status(404).json({ message: 'MBD event not found' })
    }
    return res.json({ deferral_counts: nextCounts })
  } catch (error) {
    if (error && (error.code === 'ER_NO_SUCH_TABLE' || error.errno === 1146)) {
      return res.status(500).json({
        message: 'MBD tables are missing. Restart the server to run schema migration.',
      })
    }
    console.error('Update MBD deferrals error:', error)
    return res.status(500).json({ message: 'Failed to save deferral data' })
  }
}

const deleteMbdEventController = async (req, res) => {
  const eventId = parseEventId(req)
  if (!eventId) {
    return res.status(400).json({ message: 'Invalid MBD event id' })
  }
  try {
    // Delete donor records first (cascade-safe fallback)
    await pool.query('DELETE FROM mbd_donor_records WHERE mbd_event_id = ?', [eventId])
    const [result] = await pool.query('DELETE FROM mbd_events WHERE id = ?', [eventId])
    if (!result.affectedRows) {
      return res.status(404).json({ message: 'MBD event not found' })
    }
    return res.json({ message: 'MBD event deleted' })
  } catch (error) {
    if (error && (error.code === 'ER_NO_SUCH_TABLE' || error.errno === 1146)) {
      return res.status(500).json({
        message: 'MBD tables are missing. Restart the server to run schema migration.',
      })
    }
    console.error('Delete MBD event error:', error)
    return res.status(500).json({ message: 'Failed to delete MBD event' })
  }
}

module.exports = {
  listMbdEventsController,
  createMbdEventController,
  listMbdDonorsController,
  createMbdDonorController,
  updateMbdDonorController,
  deleteMbdDonorController,
  deleteMbdEventController,
  transferMbdDonorToDonorListController,
  getMbdDeferralsController,
  updateMbdDeferralsController,
}
