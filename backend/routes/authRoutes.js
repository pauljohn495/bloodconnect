const express = require('express')

const { login, registerDonor } = require('../controllers/authController')
const { validateLogin, validateRegisterDonor } = require('../validators/authValidators')

const router = express.Router()

// POST /api/auth/login
router.post('/login', validateLogin, login)

// POST /api/auth/register-donor
router.post('/register-donor', validateRegisterDonor, registerDonor)

module.exports = router

