const { errorResponse } = require('../utils/response')

function validateHospitalIdParam(req, res, next) {
  const { id } = req.params
  const hospitalId = parseInt(id, 10)

  if (Number.isNaN(hospitalId)) {
    return errorResponse(res, {
      statusCode: 400,
      message: 'Invalid hospital id',
    })
  }

  req.hospitalId = hospitalId
  return next()
}

function validateCreateHospital(req, res, next) {
  const { hospitalName, username, email, password } = req.body

  if (!hospitalName || !username || !email || !password) {
    return errorResponse(res, {
      statusCode: 400,
      message: 'hospitalName, username, email and password are required',
    })
  }

  return next()
}

function validateUpdateHospital(req, res, next) {
  const { hospitalName, email, username } = req.body

  if (!hospitalName || !email || !username) {
    return errorResponse(res, {
      statusCode: 400,
      message: 'hospitalName, email, and username are required',
    })
  }

  return next()
}

module.exports = {
  validateHospitalIdParam,
  validateCreateHospital,
  validateUpdateHospital,
}

