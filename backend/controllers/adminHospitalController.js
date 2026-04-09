const {
  getDashboardSummary,
  getHospitalsWithRequests,
  createHospital,
  updateHospital,
  deleteHospital,
} = require('../models/adminHospitalModel')
const { successResponse } = require('../utils/response')

async function getDashboardSummaryController(req, res, next) {
  try {
    const summary = await getDashboardSummary()
    return successResponse(res, {
      message: 'Dashboard summary fetched successfully',
      data: summary,
    })
  } catch (error) {
    return next(error)
  }
}

async function getHospitalsController(req, res, next) {
  try {
    const hospitals = await getHospitalsWithRequests()
    return successResponse(res, {
      message: 'Hospitals fetched successfully',
      data: hospitals,
    })
  } catch (error) {
    return next(error)
  }
}

async function createHospitalController(req, res, next) {
  try {
    const { hospitalName, username, email, password, latitude, longitude } = req.body

    const created = await createHospital({
      hospitalName,
      username,
      email,
      password,
      latitude,
      longitude,
      createdByUserId: req.user.id,
    })

    return successResponse(res, {
      statusCode: 201,
      message: 'Hospital created successfully',
      data: created,
    })
  } catch (error) {
    return next(error)
  }
}

async function updateHospitalController(req, res, next) {
  try {
    const { hospitalId } = req
    const { hospitalName, email, username, password, latitude, longitude } = req.body

    await updateHospital({
      hospitalId,
      hospitalName,
      email,
      username,
      password,
      latitude,
      longitude,
    })

    return successResponse(res, {
      message: 'Hospital updated successfully',
      data: { id: hospitalId },
    })
  } catch (error) {
    return next(error)
  }
}

async function deleteHospitalController(req, res, next) {
  try {
    const { hospitalId } = req

    await deleteHospital(hospitalId)

    return successResponse(res, {
      message: 'Hospital deleted',
      data: { id: hospitalId },
    })
  } catch (error) {
    return next(error)
  }
}

module.exports = {
  getDashboardSummaryController,
  getHospitalsController,
  createHospitalController,
  updateHospitalController,
  deleteHospitalController,
}

