/**
 * Bootstrap a super_admin user when no API/UI path exists yet.
 *
 * Create (default):
 *   node scripts/createSuperAdmin.js --username superadmin --email you@example.com --password "YourPass" --name "Super Admin"
 *
 * Or set in backend/.env (optional):
 *   SEED_SUPERADMIN_USERNAME, SEED_SUPERADMIN_EMAIL, SEED_SUPERADMIN_PASSWORD, SEED_SUPERADMIN_FULL_NAME
 *
 * Promote an existing account (by username or email):
 *   node scripts/createSuperAdmin.js promote --identifier myadmin
 *   node scripts/createSuperAdmin.js promote --identifier myadmin --password "NewPass"
 */
const path = require('path')
require('dotenv').config({ path: path.join(__dirname, '../.env') })

const bcrypt = require('bcryptjs')
const { pool } = require('../db')
const { createAdmin } = require('../models/adminUserModel')
const { ensureUserRoleEnumIncludesSuperAdmin } = require('../ensureSchema')

function parseArgs(argv) {
  const out = {}
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i]
    if (!a.startsWith('--')) continue
    const key = a.slice(2)
    const next = argv[i + 1]
    if (next && !next.startsWith('--')) {
      out[key] = next
      i += 1
    } else {
      out[key] = true
    }
  }
  return out
}

async function findAnyUser(identifier) {
  const [rows] = await pool.query(
    'SELECT id, username, email, role FROM users WHERE username = ? OR email = ? LIMIT 1',
    [identifier, identifier],
  )
  return rows[0] || null
}

async function promote({ identifier, password }) {
  if (!identifier) {
    console.error('Missing --identifier (username or email).')
    process.exit(1)
  }
  const user = await findAnyUser(identifier)
  if (!user) {
    console.error('No user found with that username or email.')
    process.exit(1)
  }
  let passwordHash = null
  if (password) {
    passwordHash = await bcrypt.hash(password, 10)
  }
  if (passwordHash) {
    await pool.query(`UPDATE users SET role = 'super_admin', password_hash = ? WHERE id = ?`, [
      passwordHash,
      user.id,
    ])
    console.log(`Updated user id=${user.id} (${user.username}) to super_admin and set new password.`)
  } else {
    await pool.query(`UPDATE users SET role = 'super_admin' WHERE id = ?`, [user.id])
    console.log(`Updated user id=${user.id} (${user.username}) to super_admin (password unchanged).`)
  }
}

async function create({ username, email, password, fullName }) {
  if (!username || !email || !password || !fullName) {
    console.error('Missing fields. Required: --username, --email, --password, --name')
    console.error('Example: node scripts/createSuperAdmin.js --username superadmin --email a@b.com --password "Secret1!" --name "Super Admin"')
    process.exit(1)
  }

  const [byUser] = await pool.query(
    'SELECT id, username, role FROM users WHERE username = ? LIMIT 1',
    [username],
  )
  if (byUser.length) {
    console.error(`Username "${username}" is already taken (id=${byUser[0].id}). Use: promote --identifier ${username}`)
    process.exit(1)
  }
  const [byEmail] = await pool.query('SELECT id, email, role FROM users WHERE email = ? LIMIT 1', [email])
  if (byEmail.length) {
    console.error(`Email "${email}" is already taken (id=${byEmail[0].id}). Use: promote --identifier ${email}`)
    process.exit(1)
  }

  const id = await createAdmin({
    fullName,
    email,
    username,
    password,
    role: 'super_admin',
  })
  console.log(`Created super_admin user id=${id} username=${username}`)
  console.log('Sign in at /superadmin/login with this account.')
}

async function main() {
  await ensureUserRoleEnumIncludesSuperAdmin()

  const argv = process.argv.slice(2)
  const first = argv[0]
  if (first === 'promote') {
    const flags = parseArgs(argv.slice(1))
    await promote({ identifier: flags.identifier, password: flags.password })
    await pool.end()
    return
  }

  const flags = parseArgs(argv)
  let username = flags.username || process.env.SEED_SUPERADMIN_USERNAME
  let email = flags.email || process.env.SEED_SUPERADMIN_EMAIL
  let password = flags.password || process.env.SEED_SUPERADMIN_PASSWORD
  let fullName = flags.name || process.env.SEED_SUPERADMIN_FULL_NAME

  if (!username || !email || !password || !fullName) {
    console.error('Provide --username, --email, --password, --name or set SEED_SUPERADMIN_* in .env')
    console.error('')
    console.error(' Create:  node scripts/createSuperAdmin.js --username superadmin --email you@site.com --password "YourPass" --name "Super Admin"')
    console.error('  Promote: node scripts/createSuperAdmin.js promote --identifier existinguser [--password "NewPass"]')
    process.exit(1)
  }

  await create({ username, email, password, fullName })
  await pool.end()
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
