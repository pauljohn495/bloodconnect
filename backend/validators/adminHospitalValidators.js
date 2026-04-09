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
  const { hospitalName, username, email, password, latitude, longitude } = req.body

  if (!hospitalName || !username || !email || !password) {
    return errorResponse(res, {
      statusCode: 400,
      message: 'hospitalName, username, email and password are required',
    })
  }

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
  const { hospitalName, email, username, latitude, longitude } = req.body

  if (!hospitalName || !email || !username) {
    return errorResponse(res, {
      statusCode: 400,
      message: 'hospitalName, email, and username are required',
    })
  }

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

