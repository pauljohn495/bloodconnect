const dotenv = require('dotenv')
const bcrypt = require('bcryptjs')

dotenv.config()

const { pool } = require('../db')

async function main() {
  const username = process.env.DEV_ADMIN_USERNAME || 'admin'
  const email = process.env.DEV_ADMIN_EMAIL || 'admin@bloodconnect.local'
  const password = process.env.DEV_ADMIN_PASSWORD || 'admin123'

  try {
    console.log('🔐 Creating development admin user...')

    // Check if user already exists
    const [existing] = await pool.query(
      'SELECT id FROM users WHERE username = ? OR email = ? LIMIT 1',
      [username, email],
    )

    if (existing.length > 0) {
      console.log('ℹ️ Admin user already exists with this username/email. Skipping creation.')
      process.exit(0)
    }

    const passwordHash = await bcrypt.hash(password, 10)

    const [result] = await pool.query(
      `
      INSERT INTO users (username, email, password_hash, role, full_name, status)
      VALUES (?, ?, ?, 'admin', 'Development Admin', 'active')
    `,
      [username, email, passwordHash],
    )

    console.log('✅ Admin user created successfully:')
    console.log(`   ID:       ${result.insertId}`)
    console.log(`   Username: ${username}`)
    console.log(`   Email:    ${email}`)
    console.log(`   Password: ${password}`)

    process.exit(0)
  } catch (error) {
    console.error('❌ Failed to create admin user:', error.message)
    process.exit(1)
  }
}

main()


