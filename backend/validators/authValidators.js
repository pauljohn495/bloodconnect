const { errorResponse } = require('../utils/response')

function validateLogin(req, res, next) {
  const { identifier, password, role } = req.body

  if (!identifier || !password) {
    return errorResponse(res, {
      statusCode: 400,
      message: 'Identifier and password are required',
    })
  }

  if (role && !['admin', 'hospital', 'donor', 'recipient'].includes(role)) {
    return errorResponse(res, {
      statusCode: 400,
      message: 'Invalid role value',
    })
  }

  return next()
}

function validateRegisterDonor(req, res, next) {
  const { fullName, username, email, password, phone, bloodType } = req.body

  if (!fullName || !username || !password || !bloodType || !phone) {
    return errorResponse(res, {
      statusCode: 400,
      message: 'fullName, username, phone, bloodType and password are required',
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

module.exports = {
  validateLogin,
  validateRegisterDonor,
}

