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

async function ensureHospitalLocationColumns() {
  if (!(await columnExists('hospitals', 'latitude'))) {
    await pool.query('ALTER TABLE hospitals ADD COLUMN latitude DECIMAL(10, 7) NULL')
    console.log('Schema: added hospitals.latitude')
  }
  if (!(await columnExists('hospitals', 'longitude'))) {
    await pool.query('ALTER TABLE hospitals ADD COLUMN longitude DECIMAL(10, 7) NULL')
    console.log('Schema: added hospitals.longitude')
  }
}

async function ensureExpiredUnitsTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS expired_units (
      id INT PRIMARY KEY AUTO_INCREMENT,
      inventory_id INT NULL,
      blood_type VARCHAR(5) NOT NULL,
      component_type ENUM('whole_blood', 'platelets', 'plasma') NOT NULL DEFAULT 'whole_blood',
      units_expired INT NOT NULL,
      hospital_id INT NULL,
      expiration_date DATE NULL,
      expired_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      notes VARCHAR(255) NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      CONSTRAINT fk_expired_units_inventory
        FOREIGN KEY (inventory_id) REFERENCES blood_inventory(id)
        ON DELETE SET NULL,
      INDEX idx_expired_units_blood_component (blood_type, component_type),
      INDEX idx_expired_units_hospital (hospital_id),
      INDEX idx_expired_units_expired_at (expired_at)
    )
  `)
  console.log('Schema: ensured expired_units table')
}

async function backfillExpiredUnitsFromInventory() {
  const [result] = await pool.query(
    `
      INSERT INTO expired_units (
        inventory_id,
        blood_type,
        component_type,
        units_expired,
        hospital_id,
        expiration_date,
        expired_at,
        notes
      )
      SELECT
        bi.id AS inventory_id,
        bi.blood_type,
        COALESCE(bi.component_type, 'whole_blood') AS component_type,
        COALESCE(bi.available_units, 0) AS units_expired,
        bi.hospital_id,
        bi.expiration_date,
        NOW() AS expired_at,
        'Backfilled from existing expired inventory rows'
      FROM blood_inventory bi
      LEFT JOIN expired_units eu ON eu.inventory_id = bi.id
      WHERE bi.status = 'expired'
        AND eu.id IS NULL
    `,
  )

  const inserted = Number(result?.affectedRows || 0)
  console.log(`Schema: backfilled expired_units rows: ${inserted}`)
}

async function ensureDonorRecallSmsLogTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS donor_recall_sms_log (
      id INT PRIMARY KEY AUTO_INCREMENT,
      user_id INT NOT NULL,
      kind ENUM('manual', 'eligible', 'reminder') NOT NULL,
      ref_last_donation_date DATE NULL,
      phone_number VARCHAR(32) NOT NULL,
      message_body TEXT NOT NULL,
      success TINYINT(1) NOT NULL DEFAULT 1,
      semaphore_message_id VARCHAR(64) NULL,
      error_message VARCHAR(512) NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_donor_recall_user_kind_ref (user_id, kind, ref_last_donation_date),
      UNIQUE KEY uniq_donor_recall_cycle (user_id, kind, ref_last_donation_date),
      CONSTRAINT fk_donor_recall_sms_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `)
  console.log('Schema: ensured donor_recall_sms_log table')
}

async function tableExists(tableName) {
  const [rows] = await pool.query(
    `SELECT COUNT(*) AS c FROM INFORMATION_SCHEMA.TABLES
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?`,
    [tableName],
  )
  return Number(rows[0]?.c || 0) > 0
}

/**
 * Donor schedule completion: actual donation time, units, recorder;
 * links donations row to inventory for audit.
 */
async function ensureScheduleDonationTrackingColumns() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS donations (
      id INT PRIMARY KEY AUTO_INCREMENT,
      user_id INT NOT NULL,
      blood_type VARCHAR(5) NOT NULL,
      donation_date DATETIME NOT NULL,
      location VARCHAR(255) NULL,
      hospital_id INT NULL,
      status VARCHAR(32) NOT NULL DEFAULT 'completed',
      units_donated INT NOT NULL DEFAULT 1,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_donations_user_date (user_id, donation_date),
      CONSTRAINT fk_donations_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `)
  console.log('Schema: ensured donations table')

  if (!(await columnExists('donations', 'schedule_request_id'))) {
    await pool.query(
      'ALTER TABLE donations ADD COLUMN schedule_request_id INT NULL, ADD INDEX idx_donations_schedule (schedule_request_id)',
    )
    console.log('Schema: added donations.schedule_request_id')
  }
  if (!(await columnExists('donations', 'recorded_by'))) {
    await pool.query(
      'ALTER TABLE donations ADD COLUMN recorded_by INT NULL, ADD INDEX idx_donations_recorded_by (recorded_by)',
    )
    console.log('Schema: added donations.recorded_by')
  }
  if (!(await columnExists('donations', 'component_type'))) {
    await pool.query(
      "ALTER TABLE donations ADD COLUMN component_type VARCHAR(32) NOT NULL DEFAULT 'whole_blood'",
    )
    console.log('Schema: added donations.component_type')
  }
  if (!(await columnExists('donations', 'inventory_id'))) {
    await pool.query(
      'ALTER TABLE donations ADD COLUMN inventory_id INT NULL, ADD INDEX idx_donations_inventory (inventory_id)',
    )
    console.log('Schema: added donations.inventory_id')
  }

  if (!(await tableExists('schedule_requests'))) {
    console.log('Schema: schedule_requests table missing — skip schedule donation columns')
    return
  }

  if (!(await columnExists('schedule_requests', 'actual_donation_at'))) {
    await pool.query('ALTER TABLE schedule_requests ADD COLUMN actual_donation_at DATETIME NULL')
    console.log('Schema: added schedule_requests.actual_donation_at')
  }
  if (!(await columnExists('schedule_requests', 'units_donated'))) {
    await pool.query('ALTER TABLE schedule_requests ADD COLUMN units_donated INT NULL')
    console.log('Schema: added schedule_requests.units_donated')
  }
  if (!(await columnExists('schedule_requests', 'recorded_by'))) {
    await pool.query('ALTER TABLE schedule_requests ADD COLUMN recorded_by INT NULL')
    console.log('Schema: added schedule_requests.recorded_by')
  }
  if (!(await columnExists('schedule_requests', 'requested_blood_type'))) {
    await pool.query('ALTER TABLE schedule_requests ADD COLUMN requested_blood_type VARCHAR(8) NULL')
    console.log('Schema: added schedule_requests.requested_blood_type')
  }
}

/** MySQL ENUM on users.role must list super_admin or inserts/updates with that role fail. */
async function ensureUserRoleEnumIncludesSuperAdmin() {
  const [rows] = await pool.query(
    `SELECT COLUMN_TYPE, IS_NULLABLE, COLUMN_DEFAULT
     FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'role'`,
  )
  const row = rows[0]
  if (!row) return
  const columnType = row.COLUMN_TYPE || ''
  if (!columnType.toLowerCase().startsWith('enum')) return
  if (columnType.includes('super_admin')) return

  const newType = `${columnType.slice(0, -1)},'super_admin')`
  const nullPart = row.IS_NULLABLE === 'YES' ? 'NULL' : 'NOT NULL'
  let defaultPart = ''
  if (row.COLUMN_DEFAULT !== null && row.COLUMN_DEFAULT !== undefined) {
    const raw = row.COLUMN_DEFAULT
    if (raw !== '' && String(raw).toUpperCase() !== 'NULL') {
      defaultPart = ` DEFAULT '${String(raw).replace(/'/g, "''")}'`
    }
  }
  await pool.query(`ALTER TABLE users MODIFY COLUMN role ${newType} ${nullPart}${defaultPart}`)
  console.log('Schema: extended users.role enum with super_admin')
}

async function ensureFeatureFlagTables() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS feature_flag_overrides (
      portal VARCHAR(32) NOT NULL,
      flag_key VARCHAR(128) NOT NULL,
      enabled TINYINT(1) NOT NULL,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      updated_by_user_id INT NULL,
      PRIMARY KEY (portal, flag_key),
      INDEX idx_feature_flag_overrides_updated (updated_at),
      CONSTRAINT fk_feature_flag_updated_by FOREIGN KEY (updated_by_user_id) REFERENCES users(id) ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS feature_flag_audit (
      id INT PRIMARY KEY AUTO_INCREMENT,
      user_id INT NOT NULL,
      portal VARCHAR(32) NOT NULL,
      flag_key VARCHAR(128) NOT NULL,
      previous_enabled TINYINT(1) NULL,
      new_enabled TINYINT(1) NOT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_feature_flag_audit_created (created_at),
      CONSTRAINT fk_feature_flag_audit_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `)
  console.log('Schema: ensured feature_flag_overrides / feature_flag_audit tables')
}

async function ensureHomePostsTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS home_posts (
      id INT PRIMARY KEY AUTO_INCREMENT,
      category ENUM('top_donors', 'top_organizers', 'top_municipality') NOT NULL,
      title VARCHAR(255) NOT NULL,
      body MEDIUMTEXT NOT NULL,
      is_published TINYINT(1) NOT NULL DEFAULT 0,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_home_posts_category (category),
      INDEX idx_home_posts_published (is_published),
      INDEX idx_home_posts_updated_at (updated_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `)
  console.log('Schema: ensured home_posts table')
}

module.exports = {
  ensureUserRoleEnumIncludesSuperAdmin,
  ensureDonorProfileColumns,
  ensureHospitalLocationColumns,
  ensureExpiredUnitsTable,
  backfillExpiredUnitsFromInventory,
  ensureDonorRecallSmsLogTable,
  ensureScheduleDonationTrackingColumns,
  ensureFeatureFlagTables,
  ensureHomePostsTable,
}
