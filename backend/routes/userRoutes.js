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
const { createMbdRequestController, listMyMbdRequestsController } = require('../controllers/mbdRequestController')
const { getMyRc143VolunteerStatusController } = require('../controllers/rc143VolunteerController')

const router = express.Router()
const authenticatedUser = auth(['admin', 'hospital', 'donor'])
const donorOnly = auth(['donor'])

// GET /api/user/me
router.get('/me', authenticatedUser, getMe)

// PUT /api/user/me
router.put('/me', authenticatedUser, validateUpdateMe, updateMe)

// GET /api/user/donations - donation history for donor user
router.get('/donations', donorOnly, getDonationsController)

// GET /api/user/blood-availability - simple summary for the user blood type
router.get('/blood-availability', donorOnly, getBloodAvailabilityController)

// ===== Schedule Requests =====

// GET /api/user/donation-eligibility - per-component cooldown / eligibility
router.get('/donation-eligibility', donorOnly, getDonationEligibilityController)

// GET /api/user/schedule-requests - get donor's schedule requests
router.get('/schedule-requests', donorOnly, getScheduleRequestsController)

// POST /api/user/schedule-requests - create schedule request
router.post('/schedule-requests', donorOnly, validateScheduleRequest, createScheduleRequestController)

router.post('/mbd-requests', donorOnly, createMbdRequestController)
router.get('/mbd-requests', donorOnly, listMyMbdRequestsController)
router.get('/rc143-volunteer-status', donorOnly, getMyRc143VolunteerStatusController)

module.exports = router

