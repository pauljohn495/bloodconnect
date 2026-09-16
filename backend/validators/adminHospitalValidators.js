const { errorResponse } = require('../utils/response')

const EMAIL_PATTERN = /^[^@\s]+@[^@\s]+\.[^@\s]+$/
const USERNAME_PATTERN = /^[a-zA-Z0-9_.-]{3,50}$/

function validateAccountFields({ hospitalName, username, email, password, passwordRequired }, res) {
  if (String(hospitalName).trim().length > 160) {
    return errorResponse(res, { statusCode: 400, message: 'hospitalName must be 160 characters or fewer' })
  }
  if (!USERNAME_PATTERN.test(String(username).trim())) {
    return errorResponse(res, { statusCode: 400, message: 'username must be 3-50 characters and use only letters, numbers, dots, hyphens, or underscores' })
  }
  const cleanEmail = String(email).trim().toLowerCase()
  if (cleanEmail.length > 254 || !EMAIL_PATTERN.test(cleanEmail)) {
    return errorResponse(res, { statusCode: 400, message: 'Invalid email format' })
  }
  if ((passwordRequired || password) && (typeof password !== 'string' || password.length < 8 || password.length > 128)) {
    return errorResponse(res, { statusCode: 400, message: 'Password must be 8-128 characters' })
  }
  return null
}

function validateHospitalIdParam(req, res, next) {
  const { id } = req.params
  const hospitalId = Number(id)

  if (!Number.isSafeInteger(hospitalId) || hospitalId <= 0) {
    return errorResponse(res, {
      statusCode: 400,
      message: 'Invalid hospital id',
    })
  }

  req.hospitalId = hospitalId
  return next()
}

function validateCreateHospital(req, res, next) {
  const { hospitalName, username, email, password, latitude, longitude } = req.body || {}

  if (!hospitalName || !username || !email || !password) {
    return errorResponse(res, {
      statusCode: 400,
      message: 'hospitalName, username, email and password are required',
    })
  }

  const accountError = validateAccountFields({ hospitalName, username, email, password, passwordRequired: true }, res)
  if (accountError) return accountError

  const lat = Number(latitude)
  const lng = Number(longitude)
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return errorResponse(res, {
      statusCode: 400,
      message: 'latitude and longitude are required',
    })
  }
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    return errorResponse(res, {
      statusCode: 400,
      message: 'Invalid latitude/longitude range',
    })
  }

  return next()
}

function validateUpdateHospital(req, res, next) {
  const { hospitalName, email, username, latitude, longitude } = req.body || {}

  if (!hospitalName || !email || !username) {
    return errorResponse(res, {
      statusCode: 400,
      message: 'hospitalName, email, and username are required',
    })
  }

  const accountError = validateAccountFields({ hospitalName, username, email, password: req.body.password, passwordRequired: false }, res)
  if (accountError) return accountError

  const lat = Number(latitude)
  const lng = Number(longitude)
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return errorResponse(res, {
      statusCode: 400,
      message: 'latitude and longitude are required',
    })
  }
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    return errorResponse(res, {
      statusCode: 400,
      message: 'Invalid latitude/longitude range',
    })
  }

  return next()
}

module.exports = {
  validateHospitalIdParam,
  validateCreateHospital,
  validateUpdateHospital,
}

