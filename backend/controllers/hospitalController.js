const {
  getHospitalIdForUser,
  getHospitalInventory,
  updateInventoryStatusToExpired,
  getInventoryItemForHospital,
  createHospitalDonation,
  getHospitalDonations,
  createHospitalRequest,
  getHospitalRequests,
  getHospitalHistoricalWastage,
  getHospitalWastagePredictions,
} = require('../models/hospitalModel')
const { successResponse, errorResponse } = require('../utils/response')

async function resolveHospitalIdOrBadRequest(userId, res) {
  const hospitalId = await getHospitalIdForUser(userId)
  if (!hospitalId) {
    errorResponse(res, {
      statusCode: 400,
      message: 'Hospital record not found for this user',
    })
    return null
  }
  return hospitalId
}

async function getInventory(req, res, next) {
  try {
    const hospitalId = await resolveHospitalIdOrBadRequest(req.user.id, res)
    if (!hospitalId) return

    const rows = await getHospitalInventory(hospitalId)

    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const sevenDaysFromNow = new Date(today)
    sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7)

    const updatedRows = await Promise.all(
      rows.map(async (row) => {
        const expirationDate = new Date(row.expiration_date)
        expirationDate.setHours(0, 0, 0, 0)

        let displayStatus = row.status
        let dbStatus = row.status

        if (expirationDate < today) {
          displayStatus = 'expired'
          dbStatus = 'expired'
        } else if (expirationDate <= sevenDaysFromNow && row.status !== 'expired') {
          displayStatus = 'near_expiry'
          dbStatus = 'available'
        } else if (row.status === 'expired' && expirationDate >= today) {
          displayStatus = expirationDate <= sevenDaysFromNow ? 'near_expiry' : 'available'
          dbStatus = 'available'
        } else {
          displayStatus = 'available'
          dbStatus = 'available'
        }

        if (dbStatus !== row.status && dbStatus === 'expired') {
          await updateInventoryStatusToExpired(row.id, dbStatus)
        }

        return {
          ...row,
          status: displayStatus,
          component_type: row.component_type || 'whole_blood',
        }
      }),
    )

    return successResponse(res, {
      message: 'Hospital inventory fetched successfully',
      data: updatedRows,
    })
  } catch (error) {
    return next(error)
  }
}

async function donateFromInventory(req, res, next) {
  try {
    const hospitalId = await resolveHospitalIdOrBadRequest(req.user.id, res)
    if (!hospitalId) return

    const { inventoryId, units } = req.validatedDonation

    const item = await getInventoryItemForHospital(inventoryId, hospitalId)
    if (!item) {
      return errorResponse(res, {
        statusCode: 404,
        message: 'Inventory item not found for this hospital',
      })
    }

    if (item.status === 'expired') {
      return errorResponse(res, {
        statusCode: 400,
        message: 'Cannot donate from an expired inventory item',
      })
    }

    if (item.available_units < units) {
      return errorResponse(res, {
        statusCode: 400,
        message: `Insufficient units available. Requested ${units}, available ${item.available_units}.`,
      })
    }

    await createHospitalDonation({
      hospitalId,
      inventoryId: item.id,
      bloodType: item.blood_type,
      componentType: item.component_type,
      units,
    })

    return successResponse(res, {
      message: 'Donation recorded and inventory updated successfully',
      data: {
        donated: {
          hospitalId,
          inventoryId: item.id,
          bloodType: item.blood_type,
          componentType: item.component_type,
          units,
        },
      },
    })
  } catch (error) {
    return next(error)
  }
}

async function getDonations(req, res, next) {
  try {
    const hospitalId = await resolveHospitalIdOrBadRequest(req.user.id, res)
    if (!hospitalId) return

    const donations = await getHospitalDonations(hospitalId)

    return successResponse(res, {
      message: 'Hospital donation history fetched successfully',
      data: donations,
    })
  } catch (error) {
    return next(error)
  }
}

async function createRequestHandler(req, res, next) {
  try {
    const hospitalId = await resolveHospitalIdOrBadRequest(req.user.id, res)
    if (!hospitalId) return

    const { bloodType, componentType, unitsRequested, notes, priority } = req.validatedRequest

    const created = await createHospitalRequest({
      hospitalId,
      bloodType,
      componentType,
      unitsRequested,
      notes,
      priority,
    })

    return successResponse(res, {
      statusCode: 201,
      message: 'Blood request created successfully',
      data: created,
    })
  } catch (error) {
    return next(error)
  }
}

async function getRequests(req, res, next) {
  try {
    const hospitalId = await resolveHospitalIdOrBadRequest(req.user.id, res)
    if (!hospitalId) return

    const requests = await getHospitalRequests(hospitalId)

    return successResponse(res, {
      message: 'Hospital requests fetched successfully',
      data: requests,
    })
  } catch (error) {
    return next(error)
  }
}

async function getWastagePredictions(req, res, next) {
  try {
    const hospitalId = await resolveHospitalIdOrBadRequest(req.user.id, res)
    if (!hospitalId) return

    const result = await getHospitalWastagePredictions(hospitalId)

    return successResponse(res, {
      message: 'Hospital wastage predictions fetched successfully',
      data: result,
    })
  } catch (error) {
    return next(error)
  }
}

async function getHistoricalWastage(req, res, next) {
  try {
    const hospitalId = await resolveHospitalIdOrBadRequest(req.user.id, res)
    if (!hospitalId) return

    const { days = 90 } = req.query
    const intDays = parseInt(days, 10) || 90

    const result = await getHospitalHistoricalWastage(hospitalId, intDays)

    return successResponse(res, {
      message: 'Hospital historical wastage fetched successfully',
      data: result,
    })
  } catch (error) {
    return next(error)
  }
}

module.exports = {
  getInventory,
  donateFromInventory,
  getDonations,
  createRequestHandler,
  getRequests,
  getWastagePredictions,
  getHistoricalWastage,
}

