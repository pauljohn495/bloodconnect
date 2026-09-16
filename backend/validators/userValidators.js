const { errorResponse } = require('../utils/response')

const BLOOD_TYPES = new Set(['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'])
const PHONE_PATTERN = /^\+?[0-9][0-9\s()-]{6,24}$/
const IMAGE_DATA_URL_PATTERN = /^data:image\/(?:png|jpe?g|webp|gif);base64,/i

function validateUpdateMe(req, res, next) {
  const { fullName, phone, bloodType, profileImageUrl } = req.body || {}

  if (!fullName && !phone && !bloodType && profileImageUrl === undefined) {
    return errorResponse(res, {
      statusCode: 400,
      message: 'At least one of fullName, phone, bloodType, or profileImageUrl must be provided',
    })
  }

  if (fullName !== undefined && (typeof fullName !== 'string' || !fullName.trim() || fullName.trim().length > 120)) {
    return errorResponse(res, { statusCode: 400, message: 'fullName must be non-empty text with 120 characters or fewer' })
  }
  if (phone !== undefined && (typeof phone !== 'string' || !PHONE_PATTERN.test(phone.trim()))) {
    return errorResponse(res, { statusCode: 400, message: 'Invalid mobile number format' })
  }
  if (bloodType !== undefined && !BLOOD_TYPES.has(String(bloodType).trim().toUpperCase())) {
    return errorResponse(res, { statusCode: 400, message: 'bloodType must be a valid ABO/Rh type' })
  }
  if (profileImageUrl !== undefined && profileImageUrl !== null) {
    const isImageData = typeof profileImageUrl === 'string' && IMAGE_DATA_URL_PATTERN.test(profileImageUrl) && profileImageUrl.length <= 3_000_000
    const isRemoteImage = typeof profileImageUrl === 'string' && profileImageUrl.length <= 2048 && /^https:\/\//i.test(profileImageUrl)
    if (!isImageData && !isRemoteImage) {
      return errorResponse(res, { statusCode: 400, message: 'profileImageUrl must be a supported image no larger than 3 MB when encoded' })
    }
  }

  if (fullName !== undefined) req.body.fullName = fullName.trim()
  if (phone !== undefined) req.body.phone = phone.trim()
  if (bloodType !== undefined) req.body.bloodType = String(bloodType).trim().toUpperCase()

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
  } = req.body || {}

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

  if (numericWeight < 20 || numericWeight > 500) {
    return errorResponse(res, { statusCode: 400, message: 'weight must be between 20 and 500 kilograms' })
  }

  if (!['whole_blood', 'platelets', 'plasma'].includes(componentType || 'whole_blood')) {
    return errorResponse(res, { statusCode: 400, message: 'componentType must be whole_blood, platelets, or plasma' })
  }

  const dateMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(preferredDate))
  const parsedDate = dateMatch
    ? new Date(Number(dateMatch[1]), Number(dateMatch[2]) - 1, Number(dateMatch[3]))
    : null
  const validDate = parsedDate && parsedDate.getFullYear() === Number(dateMatch[1]) && parsedDate.getMonth() === Number(dateMatch[2]) - 1 && parsedDate.getDate() === Number(dateMatch[3])
  const validTime = /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(String(preferredTime))
  if (!validDate || !validTime) {
    return errorResponse(res, { statusCode: 400, message: 'preferredDate and preferredTime must use valid date and time formats' })
  }

  if (typeof healthScreeningAnswers !== 'object' || Array.isArray(healthScreeningAnswers)) {
    return errorResponse(res, { statusCode: 400, message: 'healthScreeningAnswers must be an object' })
  }

  if (JSON.stringify(healthScreeningAnswers).length > 20_000) {
    return errorResponse(res, { statusCode: 400, message: 'healthScreeningAnswers is too large' })
  }

  if (notes != null && (typeof notes !== 'string' || notes.length > 2000)) {
    return errorResponse(res, { statusCode: 400, message: 'notes must be text with 2000 characters or fewer' })
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

