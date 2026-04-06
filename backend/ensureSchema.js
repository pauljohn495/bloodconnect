const { pool } = require('./db')

async function columnExists(tableName, columnName) {
  const [rows] = await pool.query(
    `SELECT COUNT(*) AS c FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
    [tableName, columnName],
  )
  return rows[0].c > 0
}

/** Adds donor profile / manual-entry flags used by admin donor details and profile sync. */
async function ensureDonorProfileColumns() {
  if (!(await columnExists('users', 'profile_image_url'))) {
    await pool.query('ALTER TABLE users ADD COLUMN profile_image_url MEDIUMTEXT NULL')
    console.log('Schema: added users.profile_image_url')
  }
  if (!(await columnExists('users', 'is_manual_donor'))) {
    await pool.query(
      'ALTER TABLE users ADD COLUMN is_manual_donor TINYINT(1) NOT NULL DEFAULT 0',
    )
    console.log('Schema: added users.is_manual_donor')
  }
  if (!(await columnExists('users', 'pending_profile_json'))) {
    await pool.query('ALTER TABLE users ADD COLUMN pending_profile_json MEDIUMTEXT NULL')
    console.log('Schema: added users.pending_profile_json')
  }
  if (!(await columnExists('users', 'profile_update_requested_at'))) {
    await pool.query(
      'ALTER TABLE users ADD COLUMN profile_update_requested_at DATETIME NULL',
    )
    console.log('Schema: added users.profile_update_requested_at')
  }
}

module.exports = { ensureDonorProfileColumns }
