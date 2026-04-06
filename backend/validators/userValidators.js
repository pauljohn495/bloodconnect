const { errorResponse } = require('../utils/response')

function validateUpdateMe(req, res, next) {
  const { fullName, phone, bloodType, profileImageUrl } = req.body

  if (!fullName && !phone && !bloodType && profileImageUrl === undefined) {
    return errorResponse(res, {
      statusCode: 400,
      message: 'At least one of fullName, phone, bloodType, or profileImageUrl must be provided',
    })
  }

  return next()
}

function validateScheduleRequest(req, res, next) {
  const {
    preferredDate,
    preferredTime,
    componentType,
    lastDonationDate,
    weight,
    healthScreeningAnswers,
    notes,
  } = req.body

  if (!preferredDate || !preferredTime || !weight || !healthScreeningAnswers) {
    return errorResponse(res, {
      statusCode: 400,
      message: 'preferredDate, preferredTime, weight, and healthScreeningAnswers are required',
    })
  }

  // Basic numeric check for weight
  const numericWeight = Number(weight)
  if (Number.isNaN(numericWeight) || numericWeight <= 0) {
    return errorResponse(res, {
      statusCode: 400,
      message: 'weight must be a positive number',
    })
  }

  req.validatedScheduleRequest = {
    preferredDate,
    preferredTime,
    componentType: componentType || 'whole_blood',
    lastDonationDate: lastDonationDate || null,
    weight: numericWeight,
    healthScreeningAnswers,
    notes: notes || null,
  }

  return next()
}

module.exports = {
  validateUpdateMe,
  validateScheduleRequest,
}

