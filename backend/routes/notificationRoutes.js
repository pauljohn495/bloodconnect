const express = require('express')

const auth = require('../middleware/auth')
const { listNotifications, markAsRead } = require('../controllers/notificationController')
const { validateNotificationIdParam } = require('../validators/notificationValidators')

const router = express.Router()

// All notification routes require any authenticated user
router.use(auth(['admin', 'hospital', 'donor', 'recipient']))

// GET /api/notifications
router.get('/', listNotifications)

// PATCH /api/notifications/:id/read
router.patch('/:id/read', validateNotificationIdParam, markAsRead)

module.exports = router


