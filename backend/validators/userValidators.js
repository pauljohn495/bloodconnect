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

const SCHEDULE_REQUEST_BLOOD_TYPES = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-']

function validateScheduleRequest(req, res, next) {
  const {
    preferredDate,
    preferredTime,
    componentType,
    lastDonationDate,
    weight,
    healthScreeningAnswers,
    notes,
    bloodType,
  } = req.body

  if (!preferredDate || !preferredTime || !weight || !healthScreeningAnswers) {
    return errorResponse(res, {
      statusCode: 400,
      message: 'preferredDate, preferredTime, weight, and healthScreeningAnswers are required',
    })
  }

  if (!bloodType || !SCHEDULE_REQUEST_BLOOD_TYPES.includes(String(bloodType).trim())) {
    return errorResponse(res, {
      statusCode: 400,
      message: 'bloodType is required and must be a valid ABO/Rh type (A+, A-, B+, B-, AB+, AB-, O+, O-)',
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
    bloodType: String(bloodType).trim(),
  }

  return next()
}

module.exports = {
  validateUpdateMe,
  validateScheduleRequest,
}

