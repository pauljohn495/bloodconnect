const { errorResponse } = require('../utils/response')

function validateInventoryDonation(req, res, next) {
  const { inventoryId, units } = req.body

  if (!inventoryId || !units) {
    return errorResponse(res, {
      statusCode: 400,
      message: 'inventoryId and units are required',
    })
  }

  const intUnits = parseInt(units, 10)
  if (Number.isNaN(intUnits) || intUnits <= 0) {
    return errorResponse(res, {
      statusCode: 400,
      message: 'units must be a positive integer',
    })
  }

  req.validatedDonation = {
    inventoryId,
    units: intUnits,
  }

  return next()
}

function validateHospitalRequest(req, res, next) {
  const { bloodType, componentType, unitsRequested, notes } = req.body

  if (!bloodType || !unitsRequested) {
    return errorResponse(res, {
      statusCode: 400,
      message: 'bloodType and unitsRequested are required',
    })
  }

  const intUnits = parseInt(unitsRequested, 10)
  if (Number.isNaN(intUnits) || intUnits <= 0) {
    return errorResponse(res, {
      statusCode: 400,
      message: 'unitsRequested must be a positive integer',
    })
  }

  req.validatedRequest = {
    bloodType,
    componentType: componentType || 'whole_blood',
    unitsRequested: intUnits,
    notes: notes || null,
  }

  return next()
}

module.exports = {
  validateInventoryDonation,
  validateHospitalRequest,
}

