const express = require('express')

const auth = require('../middleware/auth')
const {
  getMe,
  updateMe,
  getDonationsController,
  getBloodAvailabilityController,
  getDonationEligibilityController,
  getScheduleRequestsController,
  createScheduleRequestController,
} = require('../controllers/userController')
const { validateUpdateMe, validateScheduleRequest } = require('../validators/userValidators')

const router = express.Router()

// All user routes require any authenticated user
router.use(auth(['admin', 'hospital', 'donor']))

// GET /api/user/me
router.get('/me', getMe)

// PUT /api/user/me
router.put('/me', validateUpdateMe, updateMe)

// GET /api/user/donations - donation history for donor user
router.get('/donations', getDonationsController)

// GET /api/user/blood-availability - simple summary for the user blood type
router.get('/blood-availability', getBloodAvailabilityController)

// ===== Schedule Requests =====

// GET /api/user/donation-eligibility - per-component cooldown / eligibility
router.get('/donation-eligibility', getDonationEligibilityController)

// GET /api/user/schedule-requests - get donor's schedule requests
router.get('/schedule-requests', getScheduleRequestsController)

// POST /api/user/schedule-requests - create schedule request
router.post('/schedule-requests', validateScheduleRequest, createScheduleRequestController)

module.exports = router

