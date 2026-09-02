const express = require('express')
const cors = require('cors')
const dotenv = require('dotenv')

dotenv.config()

const { pool, testConnection } = require('./db')
const {
  ensureUserRoleEnumIncludesSuperAdmin,
  ensureDonorProfileColumns,
  ensureHospitalLocationColumns,
  ensureExpiredUnitsTable,
  backfillExpiredUnitsFromInventory,
  ensureDonorRecallSmsLogTable,
  ensureScheduleDonationTrackingColumns,
  ensureFeatureFlagTables,
  ensureHomePostsTable,
  ensureMbdTables,
  ensureMbdRequestsTable,
  ensureRc143VolunteersTable,
  ensureDonorNotificationBroadcastsTable,
  ensurePrcActivitiesTable,
  ensureRequestGroupsAndEventNotifications,
} = require('./ensureSchema')
const { getPublicAnnouncementsController } = require('./controllers/adminAnnouncementController')
const { getPublicHomePostsController } = require('./controllers/adminHomePostController')
const { getPublicFeatureFlagsController } = require('./controllers/featureFlagController')
const {
  getDonorDonationRankingController,
  getOrganizationDonationRankingController,
  getMunicipalityDonationRankingController,
} = require('./controllers/adminDonationRankingController')
const authRoutes = require('./routes/authRoutes')
const adminRoutes = require('./routes/adminRoutes')
const hospitalRoutes = require('./routes/hospitalRoutes')
const userRoutes = require('./routes/userRoutes')
const notificationRoutes = require('./routes/notificationRoutes')
const errorHandler = require('./middleware/errorHandler')
const { startHospitalInventoryAlertScheduler } = require('./services/hospitalInventoryAlertService')
const { startDonorRecallScheduler } = require('./services/donorRecallScheduler')
const { startEventNotificationScheduler } = require('./services/eventNotificationService')

const app = express()
const PORT = process.env.PORT || 3000
const HOST = process.env.HOST || '0.0.0.0'

if (process.env.NODE_ENV === 'production' && !process.env.JWT_SECRET) {
  throw new Error('JWT_SECRET must be set when NODE_ENV=production')
}

// Allow requests from the frontend (no cookies/sessions, we use JWT headers)
const DEFAULT_DEV_ORIGINS = [
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:4173',
  'http://127.0.0.1:4173',
]
const envOrigins = [process.env.FRONTEND_URL, process.env.FRONTEND_ORIGIN]
  .filter(Boolean)
  .join(',')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean)
const allowedOrigins = [...new Set([...DEFAULT_DEV_ORIGINS, ...envOrigins])]

app.use(
  cors({
    origin(origin, callback) {
      if (!origin) {
        return callback(null, true)
      }
      if (allowedOrigins.includes(origin)) {
        return callback(null, true)
      }
      return callback(null, false)
    },
  }),
)
app.use(express.json({ limit: '16mb' }))

// Lightweight request timing for staging performance checks. It logs no bodies,
// credentials, tokens, or query-string values.
app.use('/api', (req, res, next) => {
  const startedAt = process.hrtime.bigint()
  res.on('finish', () => {
    const durationMs = Number(process.hrtime.bigint() - startedAt) / 1e6
    console.log(`[api] ${req.method} ${req.path} ${res.statusCode} ${durationMs.toFixed(1)}ms`)
  })
  next()
})

// Simple health check
app.get('/api/health', async (req, res) => {
  try {
    await pool.query('SELECT 1')
    return res.json({ status: 'ok', database: 'connected' })
  } catch (error) {
    console.error('Health check failed:', error)
    return res.status(503).json({ status: 'degraded', database: 'unavailable' })
  }
})

// Public announcements (donors / landing — no auth)
app.get('/api/announcements', getPublicAnnouncementsController)
app.get('/api/home-posts', getPublicHomePostsController)
app.get('/api/rankings/donors', getDonorDonationRankingController)
app.get('/api/rankings/organizations', getOrganizationDonationRankingController)
app.get('/api/rankings/municipalities', getMunicipalityDonationRankingController)

// Effective feature flags for all portals (no auth; safe visibility only)
app.get('/api/feature-flags', getPublicFeatureFlagsController)

// Route mounting
app.use('/api/auth', authRoutes)
app.use('/api/admin', adminRoutes)
app.use('/api/hospital', hospitalRoutes)
app.use('/api/user', userRoutes)
app.use('/api/notifications', notificationRoutes)

// Fallback 404 handler for API
app.use('/api', (req, res) => {
  return errorResponse(res, {
    statusCode: 404,
    message: 'API route not found',
  })
})

// Global error handler (must be registered after all routes/middleware)
app.use(errorHandler)

async function start() {
  try {
    const ok = await testConnection()
    if (ok) {
      console.log('✅ Database connection successful')
      try {
        await ensureUserRoleEnumIncludesSuperAdmin()
        await ensureDonorProfileColumns()
        await ensureHospitalLocationColumns()
        await ensureExpiredUnitsTable()
        await backfillExpiredUnitsFromInventory()
        await ensureDonorRecallSmsLogTable()
        await ensureScheduleDonationTrackingColumns()
        await ensureFeatureFlagTables()
        await ensureHomePostsTable()
        await ensureRc143VolunteersTable()
        await ensureMbdTables()
        await ensureMbdRequestsTable()
        await ensureDonorNotificationBroadcastsTable()
        await ensurePrcActivitiesTable()
        await ensureRequestGroupsAndEventNotifications()
        startHospitalInventoryAlertScheduler()
        startDonorRecallScheduler()
        startEventNotificationScheduler()
      } catch (migrationError) {
        console.error('❌ Schema migration failed:', migrationError.message)
        process.exit(1)
      }
    } else {
      console.error('❌ Database connection test failed')
    }
  } catch (error) {
    console.error('❌ Database connection failed:', error.message)
  }

  app.listen(PORT, HOST, () => {
    console.log(`Server is running on ${HOST}:${PORT}`)
  })
}

start()
