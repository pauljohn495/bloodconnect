const express = require('express')

const auth = require('../middleware/auth')
const {
  getInventory,
  donateFromInventory,
  getDonations,
  createRequestHandler,
  getRequests,
  getWastagePredictions,
  getHistoricalWastage,
} = require('../controllers/hospitalController')
const { validateInventoryDonation, validateHospitalRequest } = require('../validators/hospitalValidators')

const router = express.Router()

// All hospital routes require hospital role
router.use(auth(['hospital']))

// GET /api/hospital/inventory
router.get('/inventory', getInventory)

// POST /api/hospital/inventory/donate
router.post('/inventory/donate', validateInventoryDonation, donateFromInventory)

// GET /api/hospital/donations
router.get('/donations', getDonations)

// POST /api/hospital/requests
router.post('/requests', validateHospitalRequest, createRequestHandler)

// GET /api/hospital/requests
router.get('/requests', getRequests)

// ===== Hospital Analytics =====

// GET /api/hospital/analytics/wastage-predictions
router.get('/analytics/wastage-predictions', getWastagePredictions)

// GET /api/hospital/analytics/historical-wastage
router.get('/analytics/historical-wastage', getHistoricalWastage)

module.exports = router

