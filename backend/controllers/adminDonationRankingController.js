const { pool } = require('../db')

const getOrganizationDonationRankingController = async (req, res) => {
  const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 20, 1), 200)
  try {
    const [rows] = await pool.query(
      `
        SELECT
          o.id as organization_id,
          o.name as organization_name,
          COALESCE(SUM(contributions.units), 0) as total_units_donated
        FROM organizations o
        JOIN (
          SELECT od.organization_id, SUM(odi.units) AS units
          FROM organization_donations od
          JOIN organization_donation_items odi ON odi.donation_id = od.id
          GROUP BY od.organization_id

          UNION ALL

          SELECT e.organization_id, COUNT(d.id) AS units
          FROM mbd_events e
          JOIN mbd_donor_records d ON d.mbd_event_id = e.id
          WHERE e.organization_id IS NOT NULL AND e.deleted_at IS NULL
          GROUP BY e.organization_id
        ) contributions ON contributions.organization_id = o.id
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
          u.profile_image_url as profile_image_url,
          COALESCE(SUM(d.units_donated), 0) as total_units_donated
        FROM donations d
        JOIN users u ON u.id = d.user_id
        WHERE u.role = 'donor'
        GROUP BY u.id, u.full_name, u.username, u.blood_type, u.profile_image_url
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
        profileImageUrl: r.profile_image_url || null,
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
              u.profile_image_url as profile_image_url,
              COUNT(*) as total_units_donated
            FROM schedule_requests sr
            JOIN users u ON u.id = sr.user_id
            WHERE u.role = 'donor' AND sr.status = 'completed' AND sr.actual_donation_at IS NOT NULL
            GROUP BY u.id, u.full_name, u.username, u.blood_type, u.profile_image_url
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
            profileImageUrl: r.profile_image_url || null,
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

const getMunicipalityDonationRankingController = async (req, res) => {
  const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 20, 1), 200)
  try {
    const [rows] = await pool.query(
      `
        SELECT m.id AS municipality_id, m.name AS municipality_name, COUNT(e.id) AS donor_count
        FROM municipalities m
        LEFT JOIN mbd_donor_records d ON d.municipality_id = m.id
        LEFT JOIN mbd_events e ON e.id = d.mbd_event_id AND e.deleted_at IS NULL
        GROUP BY m.id, m.name
        ORDER BY donor_count DESC, m.name ASC
        LIMIT ?
      `,
      [limit],
    )
    return res.json(rows.map((r) => ({ municipalityId: r.municipality_id, municipalityName: r.municipality_name, donorCount: Number(r.donor_count || 0) })))
  } catch (error) {
    console.error('Fetch municipality ranking error:', error)
    return res.status(500).json({ message: 'Failed to fetch municipality ranking' })
  }
}

module.exports = {
  getOrganizationDonationRankingController,
  getDonorDonationRankingController,
  getMunicipalityDonationRankingController,
}

