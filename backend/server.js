const express = require('express')
const cors = require('cors')
const dotenv = require('dotenv')

const { pool, testConnection } = require('./db')
const authRoutes = require('./routes/authRoutes')
const adminRoutes = require('./routes/adminRoutes')
const hospitalRoutes = require('./routes/hospitalRoutes')
const userRoutes = require('./routes/userRoutes')
const notificationRoutes = require('./routes/notificationRoutes')

dotenv.config()

const app = express()
const PORT = process.env.PORT || 3000

// Allow requests from the frontend (no cookies/sessions, we use JWT headers)
const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN || 'http://localhost:5173'
app.use(cors({ origin: FRONTEND_ORIGIN }))
app.use(express.json())

// Simple health check
app.get('/api/health', async (req, res) => {
  try {
    await pool.query('SELECT 1')
    res.json({ ok: true })
  } catch (error) {
    console.error('Health check failed:', error)
    res.status(500).json({ ok: false, error: 'Database not available' })
  }
})

// Route mounting
app.use('/api/auth', authRoutes)
app.use('/api/admin', adminRoutes)
app.use('/api/hospital', hospitalRoutes)
app.use('/api/user', userRoutes)
app.use('/api/notifications', notificationRoutes)

// Fallback 404 handler for API
app.use('/api', (req, res) => {
  res.status(404).json({ message: 'API route not found' })
})

app.listen(PORT, async () => {
  console.log(`Server is running on port ${PORT}`)
  try {
    const ok = await testConnection()
    if (ok) {
      console.log('✅ Database connection successful')
    } else {
      console.error('❌ Database connection test failed')
    }
  } catch (error) {
    console.error('❌ Database connection failed:', error.message)
  }
})
