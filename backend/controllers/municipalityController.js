const { pool } = require('../db')

async function listMunicipalitiesController(req, res) {
  try {
    const [rows] = await pool.query(`
      SELECT m.id, m.name, m.created_at, COUNT(d.id) AS donor_count
      FROM municipalities m
      LEFT JOIN mbd_donor_records d ON d.municipality_id = m.id
      GROUP BY m.id, m.name, m.created_at
      ORDER BY m.name ASC
    `)
    return res.json(rows.map((row) => ({ ...row, donor_count: Number(row.donor_count || 0) })))
  } catch (error) {
    console.error('List municipalities error:', error)
    return res.status(500).json({ message: 'Failed to load municipalities' })
  }
}

async function createMunicipalityController(req, res) {
  const name = String(req.body?.name ?? req.body?.municipalityName ?? '').trim()
  if (!name) return res.status(400).json({ message: 'Municipality name is required' })
  try {
    const [result] = await pool.query('INSERT INTO municipalities (name) VALUES (?)', [name])
    return res.status(201).json({ id: result.insertId, name, donor_count: 0 })
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') return res.status(409).json({ message: 'A municipality with this name already exists' })
    console.error('Create municipality error:', error)
    return res.status(500).json({ message: 'Failed to create municipality' })
  }
}

module.exports = { listMunicipalitiesController, createMunicipalityController }
