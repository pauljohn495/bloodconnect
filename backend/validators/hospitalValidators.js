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
  const { bloodType, bloodTypes, componentType, unitsRequested, notes, priority } = req.body

  // `items` is the current multi-type format. Keep the original single-type
  // payload working for existing integrations.
  const rawItems = Array.isArray(req.body.items)
    ? req.body.items
    : bloodTypes
      ? bloodTypes.map((type, index) => ({ bloodType: type, unitsRequested: Array.isArray(unitsRequested) ? unitsRequested[index] : unitsRequested }))
      : [{ bloodType, unitsRequested }]

  if (!rawItems.length) {
    return errorResponse(res, {
      statusCode: 400,
      message: 'At least one blood type and quantity are required',
    })
  }
  const seenRequests = new Set()
  const items = []
  for (const item of rawItems) {
    const itemBloodType = String(item?.bloodType || '').trim().toUpperCase()
    const intUnits = parseInt(item?.unitsRequested, 10)
    if (!itemBloodType || Number.isNaN(intUnits) || intUnits <= 0) {
      return errorResponse(res, { statusCode: 400, message: 'Each blood type must have a positive whole-unit quantity' })
    }
    const itemComponentType = String(item?.componentType || componentType || 'whole_blood').toLowerCase()
    const itemPriority = String(item?.priority || priority || 'normal').toLowerCase()
    if (!['whole_blood', 'platelets', 'plasma'].includes(itemComponentType)) {
      return errorResponse(res, { statusCode: 400, message: 'componentType must be whole_blood, platelets, or plasma' })
    }
    if (!['normal', 'urgent', 'critical'].includes(itemPriority)) {
      return errorResponse(res, { statusCode: 400, message: 'priority must be one of: normal, urgent, critical' })
    }
    const requestKey = `${itemBloodType}:${itemComponentType}:${itemPriority}`
    if (seenRequests.has(requestKey)) {
      return errorResponse(res, { statusCode: 400, message: 'Duplicate blood type, component, and priority combinations are not allowed' })
    }
    seenRequests.add(requestKey)
    items.push({ bloodType: itemBloodType, unitsRequested: intUnits, componentType: itemComponentType, priority: itemPriority, notes: item?.notes ?? notes ?? null })
  }

  // Normalize and validate priority (optional)
  const normalizedPriority = (priority || 'normal').toLowerCase()
  const allowedPriorities = ['normal', 'urgent', 'critical']
  if (!allowedPriorities.includes(normalizedPriority)) {
    return errorResponse(res, {
      statusCode: 400,
      message: 'priority must be one of: normal, urgent, critical',
    })
  }

  req.validatedRequest = {
    items,
    // Legacy fields keep controller callers compatible.
    bloodType: items[0].bloodType,
    componentType: items[0].componentType,
    unitsRequested: items[0].unitsRequested,
    notes: items[0].notes,
    priority: items[0].priority || normalizedPriority,
  }

  return next()
}

module.exports = {
  validateInventoryDonation,
  validateHospitalRequest,
}

