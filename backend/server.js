const express = require('express')
const cors = require('cors')
const dotenv = require('dotenv')

const { pool, testConnection } = require('./db')
const {
  ensureDonorProfileColumns,
  ensureHospitalLocationColumns,
  ensureExpiredUnitsTable,
  backfillExpiredUnitsFromInventory,
} = require('./ensureSchema')
const { getPublicAnnouncementsController } = require('./controllers/adminAnnouncementController')
const authRoutes = require('./routes/authRoutes')
const adminRoutes = require('./routes/adminRoutes')
const hospitalRoutes = require('./routes/hospitalRoutes')
const userRoutes = require('./routes/userRoutes')
const notificationRoutes = require('./routes/notificationRoutes')
const errorHandler = require('./middleware/errorHandler')
const { successResponse, errorResponse } = require('./utils/response')
const { startHospitalInventoryAlertScheduler } = require('./services/hospitalInventoryAlertService')

dotenv.config()

const app = express()
const PORT = process.env.PORT || 3000

// Allow requests from the frontend (no cookies/sessions, we use JWT headers)
const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN || 'http://localhost:5173'
app.use(cors({ origin: FRONTEND_ORIGIN }))
app.use(express.json({ limit: '8mb' }))

// Simple health check
app.get('/api/health', async (req, res) => {
  try {
    await pool.query('SELECT 1')
    return successResponse(res, {
      message: 'Health check OK',
      data: { ok: true },
    })
  } catch (error) {
    console.error('Health check failed:', error)
    return errorResponse(res, {
      statusCode: 500,
      message: 'Database not available',
    })
  }
})

// Public announcements (donors / landing — no auth)
app.get('/api/announcements', getPublicAnnouncementsController)

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
        await ensureDonorProfileColumns()
        await ensureHospitalLocationColumns()
        await ensureExpiredUnitsTable()
        await backfillExpiredUnitsFromInventory()
        startHospitalInventoryAlertScheduler()
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

  app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`)
  })
}

start()
