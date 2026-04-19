const { pool } = require('../db')

const BLOOD_TYPES = new Set(['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'])
const REMARKS = new Set(['S', 'D'])

const mapEventRow = (row) => ({
  id: row.id,
  name: row.name,
  organizer_name: row.organizer_name != null ? String(row.organizer_name) : '',
  event_date: row.event_date,
  location: row.location,
  donor_count: row.donor_count != null ? Number(row.donor_count) : 0,
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
  age: row.age != null ? Number(row.age) : null,
  gender: row.gender,
  bag_type: row.bag_type,
  remarks_sd: row.remarks_sd,
  num_donations: row.num_donations != null ? Number(row.num_donations) : 0,
  created_at: row.created_at,
  updated_at: row.updated_at,
})

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
      INSERT INTO mbd_events (name, organizer_name, event_date, location)
      VALUES (?, ?, ?, ?)
    `,
      [name, organizerName, dateNorm, location],
    )

    const [rows] = await pool.query(
      `
      SELECT
        e.id,
        e.name,
        e.organizer_name,
        e.event_date,
        e.location,
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
        age,
        gender,
        bag_type,
        remarks_sd,
        num_donations,
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
  const donorNumber =
    req.body.donorNumber != null
      ? String(req.body.donorNumber).trim()
      : req.body.donor_number != null
        ? String(req.body.donor_number).trim()
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
  const numRaw = req.body.numDonations != null ? req.body.numDonations : req.body.num_donations

  if (!donorName) {
    return res.status(400).json({ message: 'donorName is required' })
  }
  if (!BLOOD_TYPES.has(bloodTypeRaw)) {
    return res.status(400).json({
      message: 'bloodType must be one of A+, A-, B+, B-, AB+, AB-, O+, O-',
    })
  }
  if (!REMARKS.has(remarksRaw)) {
    return res.status(400).json({ message: 'remarksSd must be S or D' })
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
        age,
        gender,
        bag_type,
        remarks_sd,
        num_donations
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
      [
        eventId,
        donorName,
        barcode || null,
        bloodTypeRaw,
        donorNumber || null,
        age,
        gender || null,
        bagType || null,
        remarksRaw,
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
        age,
        gender,
        bag_type,
        remarks_sd,
        num_donations,
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
  const donorNumber =
    req.body.donorNumber != null
      ? String(req.body.donorNumber).trim()
      : req.body.donor_number != null
        ? String(req.body.donor_number).trim()
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
  const numRaw = req.body.numDonations != null ? req.body.numDonations : req.body.num_donations

  if (!donorName) {
    return res.status(400).json({ message: 'donorName is required' })
  }
  if (!BLOOD_TYPES.has(bloodTypeRaw)) {
    return res.status(400).json({
      message: 'bloodType must be one of A+, A-, B+, B-, AB+, AB-, O+, O-',
    })
  }
  if (!REMARKS.has(remarksRaw)) {
    return res.status(400).json({ message: 'remarksSd must be S or D' })
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
        bloodTypeRaw,
        donorNumber || null,
        age,
        gender || null,
        bagType || null,
        remarksRaw,
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
        age,
        gender,
        bag_type,
        remarks_sd,
        num_donations,
        created_at,
        updated_at
      FROM mbd_donor_records
      WHERE id = ? AND mbd_event_id = ?
    `,
      [donorId, eventId],
    )

    return res.json(mapDonorRow(rows[0]))
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

module.exports = {
  listMbdEventsController,
  createMbdEventController,
  listMbdDonorsController,
  createMbdDonorController,
  updateMbdDonorController,
  deleteMbdDonorController,
}
