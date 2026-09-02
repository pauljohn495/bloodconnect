const mysql = require('mysql2/promise')

function getSslConfig() {
  if (String(process.env.DB_SSL).toLowerCase() !== 'true') return undefined

  const ssl = { rejectUnauthorized: true }
  if (process.env.DB_SSL_CA_BASE64) {
    ssl.ca = Buffer.from(process.env.DB_SSL_CA_BASE64, 'base64').toString('utf8')
  } else if (process.env.DB_SSL_CA) {
    // Useful for providers that accept a multiline certificate environment value.
    ssl.ca = process.env.DB_SSL_CA.replace(/\\n/g, '\n')
  }
  return ssl
}

const isProduction = process.env.NODE_ENV === 'production'
const pool = mysql.createPool({
  host: process.env.DB_HOST || (isProduction ? undefined : 'localhost'),
  port: process.env.DB_PORT ? Number(process.env.DB_PORT) : 3306,
  user: process.env.DB_USER || (isProduction ? undefined : 'root'),
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || (isProduction ? undefined : 'bloodconnect'),
  ssl: getSslConfig(),
  waitForConnections: true,
  connectionLimit: Number(process.env.DB_CONNECTION_LIMIT || 10),
  queueLimit: 0,
})

async function testConnection() {
  const [rows] = await pool.query('SELECT 1 AS ok')
  return rows[0].ok === 1
}

module.exports = {
  pool,
  testConnection,
}


