const express = require('express')

const auth = require('../middleware/auth')
const { login, registerDonor, loginWithGoogle, completeGoogleDonorProfile } = require('../controllers/authController')
const {
  validateLogin,
  validateRegisterDonor,
  validateGoogleLogin,
  validateCompleteGoogleDonorProfile,
} = require('../validators/authValidators')

const router = express.Router()

// POST /api/auth/login
router.post('/login', validateLogin, login)

// POST /api/auth/register-donor
router.post('/register-donor', validateRegisterDonor, registerDonor)

// POST /api/auth/google
router.post('/google', validateGoogleLogin, loginWithGoogle)

// POST /api/auth/complete-google-donor-profile
router.post(
  '/complete-google-donor-profile',
  auth(['donor']),
  validateCompleteGoogleDonorProfile,
  completeGoogleDonorProfile,
)

module.exports = router

