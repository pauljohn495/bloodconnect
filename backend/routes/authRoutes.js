const express = require('express')

const auth = require('../middleware/auth')
const { createRateLimit } = require('../middleware/security')
const { login, registerDonor, loginWithGoogle, completeGoogleDonorProfile } = require('../controllers/authController')
const {
  validateLogin,
  validateRegisterDonor,
  validateGoogleLogin,
  validateCompleteGoogleDonorProfile,
} = require('../validators/authValidators')

const router = express.Router()
const authRateLimit = createRateLimit({ windowMs: 15 * 60 * 1000, max: 15 })

// POST /api/auth/login
router.post('/login', authRateLimit, validateLogin, login)

// POST /api/auth/register-donor
router.post('/register-donor', authRateLimit, validateRegisterDonor, registerDonor)

// POST /api/auth/google
router.post('/google', authRateLimit, validateGoogleLogin, loginWithGoogle)

// POST /api/auth/complete-google-donor-profile
router.post(
  '/complete-google-donor-profile',
  auth(['donor']),
  validateCompleteGoogleDonorProfile,
  completeGoogleDonorProfile,
)

module.exports = router

