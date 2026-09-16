const { errorResponse } = require('../utils/response')

const BLOOD_TYPES = new Set(['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'])
const USERNAME_PATTERN = /^[a-zA-Z0-9_.-]{3,50}$/
const PHONE_PATTERN = /^\+?[0-9][0-9\s()-]{6,24}$/

function cleanText(value) {
  return typeof value === 'string' ? value.trim() : ''
}

function validationError(res, message) {
  return errorResponse(res, { statusCode: 400, message })
}

function validateLogin(req, res, next) {
  req.body = req.body || {}
  const { identifier, password, role, loginMode } = req.body

  const cleanIdentifier = cleanText(identifier)
  if (!cleanIdentifier) return validationError(res, 'Identifier is required')
  if (cleanIdentifier.length > 254) return validationError(res, 'Identifier is too long')
  req.body.identifier = cleanIdentifier

  if (role && !['admin', 'super_admin', 'hospital', 'donor', 'recipient'].includes(role)) {
    return errorResponse(res, {
      statusCode: 400,
      message: 'Invalid role value',
    })
  }

  if (loginMode && !['default', 'id', 'phone'].includes(loginMode)) {
    return errorResponse(res, {
      statusCode: 400,
      message: 'Invalid login mode',
    })
  }

  const normalizedRole = role === 'recipient' ? 'donor' : role
  const isDonorIdMode = loginMode === 'id' || loginMode === 'phone'
  if (!isDonorIdMode && !password) {
    return errorResponse(res, {
      statusCode: 400,
      message: 'Password is required',
    })
  }

  if (isDonorIdMode && normalizedRole && normalizedRole !== 'donor') {
    return errorResponse(res, {
      statusCode: 400,
      message: 'Donor ID login is only available for donor/recipient account type',
    })
  }

  return next()
}

function validateRegisterDonor(req, res, next) {
  req.body = req.body || {}
  const { fullName, username, email, password, phone, bloodType } = req.body
  const cleanFullName = cleanText(fullName)
  const cleanUsername = cleanText(username)
  const cleanEmail = cleanText(email).toLowerCase()
  const cleanPhone = cleanText(phone)
  const cleanBloodType = cleanText(bloodType).toUpperCase()

  if (!cleanFullName || !cleanUsername || !password || !cleanPhone) {
    return errorResponse(res, {
      statusCode: 400,
      message: 'fullName, username, phone and password are required',
    })
  }

  if (cleanFullName.length > 120) return validationError(res, 'Full name must be 120 characters or fewer')
  if (!USERNAME_PATTERN.test(cleanUsername)) return validationError(res, 'Username must be 3-50 characters and use only letters, numbers, dots, hyphens, or underscores')
  if (typeof password !== 'string' || password.length < 8 || password.length > 128) return validationError(res, 'Password must be 8-128 characters')
  if (!PHONE_PATTERN.test(cleanPhone)) return validationError(res, 'Invalid mobile number format')
  if (!BLOOD_TYPES.has(cleanBloodType)) return validationError(res, 'bloodType must be a valid ABO/Rh type')

  // Basic email format check when provided
  if (cleanEmail && (cleanEmail.length > 254 || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(cleanEmail))) {
    return errorResponse(res, {
      statusCode: 400,
      message: 'Invalid email format',
    })
  }

  Object.assign(req.body, {
    fullName: cleanFullName,
    username: cleanUsername,
    email: cleanEmail || null,
    phone: cleanPhone,
    bloodType: cleanBloodType,
  })

  return next()
}

function validateGoogleLogin(req, res, next) {
  const { credential, role } = req.body || {}

  if (typeof credential !== 'string' || !credential.trim() || credential.length > 8192) {
    return errorResponse(res, {
      statusCode: 400,
      message: 'Google credential is required',
    })
  }

  if (role && !['donor', 'recipient'].includes(role)) {
    return errorResponse(res, {
      statusCode: 400,
      message: 'Google login is only available for donor/recipient account type',
    })
  }

  return next()
}

function validateCompleteGoogleDonorProfile(req, res, next) {
  req.body = req.body || {}
  const { username, bloodType, phone } = req.body
  const cleanUsername = cleanText(username)
  const cleanBloodType = cleanText(bloodType).toUpperCase()
  const cleanPhone = cleanText(phone)

  if (!cleanUsername || !cleanBloodType || !cleanPhone) {
    return errorResponse(res, {
      statusCode: 400,
      message: 'username, bloodType and phone are required',
    })
  }

  if (!USERNAME_PATTERN.test(cleanUsername)) return validationError(res, 'Username must be 3-50 characters and use only letters, numbers, dots, hyphens, or underscores')
  if (!BLOOD_TYPES.has(cleanBloodType)) return validationError(res, 'bloodType must be a valid ABO/Rh type')
  if (!PHONE_PATTERN.test(cleanPhone)) return validationError(res, 'Invalid mobile number format')

  Object.assign(req.body, {
    username: cleanUsername,
    bloodType: cleanBloodType,
    phone: cleanPhone,
  })

  return next()
}

module.exports = {
  validateLogin,
  validateRegisterDonor,
  validateGoogleLogin,
  validateCompleteGoogleDonorProfile,
}

