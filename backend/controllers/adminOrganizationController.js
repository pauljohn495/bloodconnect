const { pool } = require('../db')

const getOrganizationsController = async (req, res) => {
  try {
    const [rows] = await pool.query(
      `
      SELECT id, name, contact_number, email, address, created_at
      FROM organizations
      ORDER BY created_at DESC
    `,
    )
    return res.json(rows)
  } catch (error) {
    // Helpful error if the table wasn't created yet
    if (error && (error.code === 'ER_NO_SUCH_TABLE' || error.errno === 1146)) {
      return res.status(500).json({
        message:
          'Organizations table is missing. Please create the `organizations` table in the database.',
      })
    }
    console.error('Fetch organizations error:', error)
    return res.status(500).json({ message: 'Failed to fetch organizations' })
  }
}

const createOrganizationController = async (req, res) => {
  const { organizationName, contactNumber, emailAddress, address } = req.body

  if (!organizationName || !contactNumber || !emailAddress || !address) {
    return res.status(400).json({
      message: 'organizationName, contactNumber, emailAddress and address are required',
    })
  }

  try {
    const [existingEmail] = await pool.query(
      `SELECT id FROM organizations WHERE email = ? LIMIT 1`,
      [emailAddress],
    )
    if (existingEmail.length > 0) {
      return res.status(400).json({ message: 'Email is already registered' })
    }

    const [result] = await pool.query(
      `
      INSERT INTO organizations (name, contact_number, email, address)
      VALUES (?, ?, ?, ?)
    `,
      [organizationName, contactNumber, emailAddress, address],
    )

    return res.status(201).json({
      id: result.insertId,
      name: organizationName,
      contact_number: contactNumber,
      email: emailAddress,
      address,
    })
  } catch (error) {
    if (error && (error.code === 'ER_NO_SUCH_TABLE' || error.errno === 1146)) {
      return res.status(500).json({
        message:
          'Organizations table is missing. Please create the `organizations` table in the database.',
      })
    }
    console.error('Create organization error:', error)
    return res.status(500).json({ message: 'Failed to create organization' })
  }
}

module.exports = {
  getOrganizationsController,
  createOrganizationController,
}

