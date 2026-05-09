const { errorResponse } = require('../utils/response')

function validateLogin(req, res, next) {
  const { identifier, password, role, loginMode } = req.body

  if (!identifier) {
    return errorResponse(res, {
      statusCode: 400,
      message: 'Identifier is required',
    })
  }

  if (role && !['admin', 'super_admin', 'hospital', 'donor', 'recipient'].includes(role)) {
    return errorResponse(res, {
      statusCode: 400,
      message: 'Invalid role value',
    })
  }

  if (loginMode && !['default', 'phone'].includes(loginMode)) {
    return errorResponse(res, {
      statusCode: 400,
      message: 'Invalid login mode',
    })
  }

  const normalizedRole = role === 'recipient' ? 'donor' : role
  const isPhoneMode = loginMode === 'phone'
  if (!isPhoneMode && !password) {
    return errorResponse(res, {
      statusCode: 400,
      message: 'Password is required',
    })
  }

  if (isPhoneMode && normalizedRole && normalizedRole !== 'donor') {
    return errorResponse(res, {
      statusCode: 400,
      message: 'Phone-number-only login is only available for donor/recipient account type',
    })
  }

  return next()
}

function validateRegisterDonor(req, res, next) {
  const { fullName, username, email, password, phone, bloodType } = req.body
  const safeRole = 'donor'

  if (!fullName || !username || !password || !phone) {
    return errorResponse(res, {
      statusCode: 400,
      message: 'fullName, username, phone and password are required',
    })
  }

  if (safeRole === 'donor' && !bloodType) {
    return errorResponse(res, {
      statusCode: 400,
      message: 'bloodType is required for donor accounts',
    })
  }

  // Basic email format check when provided
  if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return errorResponse(res, {
      statusCode: 400,
      message: 'Invalid email format',
    })
  }

  return next()
}

function validateGoogleLogin(req, res, next) {
  const { credential, role } = req.body

  if (!credential) {
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
  const { username, bloodType, phone } = req.body

  if (!username || !bloodType || !phone) {
    return errorResponse(res, {
      statusCode: 400,
      message: 'username, bloodType and phone are required',
    })
  }

  return next()
}

module.exports = {
  validateLogin,
  validateRegisterDonor,
  validateGoogleLogin,
  validateCompleteGoogleDonorProfile,
}

