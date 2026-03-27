const { pool } = require('../db')

const getOrganizationDonationRankingController = async (req, res) => {
  const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 20, 1), 200)
  try {
    const [rows] = await pool.query(
      `
        SELECT 
          o.id as organization_id,
          o.name as organization_name,
          COALESCE(SUM(odi.units), 0) as total_units_donated
        FROM organization_donations od
        JOIN organizations o ON o.id = od.organization_id
        JOIN organization_donation_items odi ON odi.donation_id = od.id
        GROUP BY o.id, o.name
        ORDER BY total_units_donated DESC, o.name ASC
        LIMIT ?
      `,
      [limit],
    )

    return res.json(
      rows.map((r) => ({
        organizationId: r.organization_id,
        organizationName: r.organization_name,
        totalUnitsDonated: Number(r.total_units_donated || 0),
      })),
    )
  } catch (error) {
    if (error && (error.code === 'ER_NO_SUCH_TABLE' || error.errno === 1146)) {
      return res.status(500).json({
        message:
          'Donation ranking tables are missing. Please create `organization_donations` and `organization_donation_items` tables.',
      })
    }
    console.error('Fetch organization donation ranking error:', error)
    return res.status(500).json({ message: 'Failed to fetch organization donation ranking' })
  }
}

const getDonorDonationRankingController = async (req, res) => {
  const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 20, 1), 200)
  try {
    const [rows] = await pool.query(
      `
        SELECT 
          u.id as donor_id,
          COALESCE(u.full_name, u.username) as donor_name,
          u.blood_type as blood_type,
          COALESCE(SUM(d.units_donated), 0) as total_units_donated
        FROM donations d
        JOIN users u ON u.id = d.user_id
        WHERE u.role = 'donor'
        GROUP BY u.id, u.full_name, u.username, u.blood_type
        ORDER BY total_units_donated DESC, donor_name ASC
        LIMIT ?
      `,
      [limit],
    )

    return res.json(
      rows.map((r) => ({
        donorId: r.donor_id,
        donorName: r.donor_name,
        bloodType: r.blood_type,
        totalUnitsDonated: Number(r.total_units_donated || 0),
      })),
    )
  } catch (error) {
    // Fallback: derive ranking from completed schedule requests (treat each completion as 1 unit)
    if (error && (error.code === 'ER_NO_SUCH_TABLE' || error.errno === 1146)) {
      try {
        const [rows] = await pool.query(
          `
            SELECT
              u.id as donor_id,
              COALESCE(u.full_name, u.username) as donor_name,
              u.blood_type as blood_type,
              COUNT(*) as total_units_donated
            FROM schedule_requests sr
            JOIN users u ON u.id = sr.user_id
            WHERE u.role = 'donor' AND sr.status = 'completed'
            GROUP BY u.id, u.full_name, u.username, u.blood_type
            ORDER BY total_units_donated DESC, donor_name ASC
            LIMIT ?
          `,
          [limit],
        )
        return res.json(
          rows.map((r) => ({
            donorId: r.donor_id,
            donorName: r.donor_name,
            bloodType: r.blood_type,
            totalUnitsDonated: Number(r.total_units_donated || 0),
          })),
        )
      } catch (fallbackError) {
        console.error('Fallback donor ranking error:', fallbackError)
        return res.status(500).json({ message: 'Failed to fetch donor donation ranking' })
      }
    }
    console.error('Fetch donor donation ranking error:', error)
    return res.status(500).json({ message: 'Failed to fetch donor donation ranking' })
  }
}

module.exports = {
  getOrganizationDonationRankingController,
  getDonorDonationRankingController,
}

