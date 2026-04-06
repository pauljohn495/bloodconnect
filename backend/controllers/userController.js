const {
  getUserById,
  setPendingDonorProfile,
  updateUserProfile,
  getUserDonations,
  getUserBloodAvailability,
  getDonationEligibility,
  getUserScheduleRequests,
  hasPendingScheduleRequest,
  getLastCompletedScheduleForComponent,
  createScheduleRequest,
} = require('../models/userModel')
const { successResponse } = require('../utils/response')

// Cooldown periods in days by donation component type
const DONATION_COOLDOWNS = {
  whole_blood: 90,
  platelets: 14,
  plasma: 28,
}

function buildUserMePayload(user) {
  const { pending_profile_json, ...rest } = user
  let pendingProfile = null
  if (pending_profile_json) {
    try {
      pendingProfile = JSON.parse(pending_profile_json)
    } catch {
      pendingProfile = null
    }
  }
  return {
    ...rest,
    pending_profile: pendingProfile,
    pendingProfile,
    profile_update_requested_at: user.profile_update_requested_at,
    profileUpdateRequestedAt: user.profile_update_requested_at,
  }
}

async function getMe(req, res, next) {
  try {
    const user = await getUserById(req.user.id)
    if (!user) {
      const error = new Error('User not found')
      error.statusCode = 404
      throw error
    }

    return successResponse(res, {
      message: 'User profile fetched successfully',
      data: buildUserMePayload(user),
    })
  } catch (error) {
    return next(error)
  }
}

async function updateMe(req, res, next) {
  const { fullName, phone, bloodType, profileImageUrl } = req.body

  try {
    if (req.user.role === 'donor') {
      const updated = await setPendingDonorProfile(req.user.id, {
        fullName,
        phone,
        bloodType,
        profileImageUrl,
      })
      if (!updated) {
        const error = new Error('User not found')
        error.statusCode = 404
        throw error
      }
      const user = await getUserById(req.user.id)
      return successResponse(res, {
        message: 'Your profile changes were submitted for admin approval.',
        data: buildUserMePayload(user),
      })
    }

    const updated = await updateUserProfile(req.user.id, {
      fullName,
      phone,
      bloodType,
      profileImageUrl,
    })
    if (!updated) {
      const error = new Error('User not found')
      error.statusCode = 404
      throw error
    }

    const user = await getUserById(req.user.id)

    return successResponse(res, {
      message: 'User profile updated successfully',
      data: buildUserMePayload(user),
    })
  } catch (error) {
    return next(error)
  }
}

async function getDonationsController(req, res, next) {
  try {
    const donations = await getUserDonations(req.user.id)
    return successResponse(res, {
      message: 'Donation history fetched successfully',
      data: donations,
    })
  } catch (error) {
    return next(error)
  }
}

async function getBloodAvailabilityController(req, res, next) {
  try {
    const availability = await getUserBloodAvailability(req.user.id)
    return successResponse(res, {
      message: 'Blood availability summary fetched successfully',
      data: availability,
    })
  } catch (error) {
    return next(error)
  }
}

async function getDonationEligibilityController(req, res, next) {
  try {
    const result = await getDonationEligibility(req.user.id, DONATION_COOLDOWNS)
    return successResponse(res, {
      message: 'Donation eligibility fetched successfully',
      data: result,
    })
  } catch (error) {
    return next(error)
  }
}

async function getScheduleRequestsController(req, res, next) {
  try {
    const rows = await getUserScheduleRequests(req.user.id)
    return successResponse(res, {
      message: 'Schedule requests fetched successfully',
      data: rows,
    })
  } catch (error) {
    return next(error)
  }
}

async function createScheduleRequestController(req, res, next) {
  const {
    preferredDate,
    preferredTime,
    componentType,
    lastDonationDate,
    weight,
    healthScreeningAnswers,
    notes,
  } = req.validatedScheduleRequest

  try {
    if (await hasPendingScheduleRequest(req.user.id)) {
      const error = new Error(
        'You already have a pending schedule request. Please wait for it to be reviewed.',
      )
      error.statusCode = 400
      throw error
    }

    const component = componentType || 'whole_blood'

    const cooldownDays = DONATION_COOLDOWNS[component] || 0
    if (cooldownDays > 0) {
      const last = await getLastCompletedScheduleForComponent(req.user.id, component)
      if (last && last.reviewed_at) {
        const lastDate = new Date(last.reviewed_at)
        const nextEligible = new Date(lastDate)
        nextEligible.setDate(nextEligible.getDate() + cooldownDays)
        const now = new Date()

        if (nextEligible > now) {
          const humanComponent =
            component === 'whole_blood'
              ? 'Whole Blood'
              : component === 'platelets'
              ? 'Platelets'
              : component === 'plasma'
              ? 'Plasma'
              : component

          const error = new Error(
            `You are still in cooldown for ${humanComponent}. You can donate this type again on ${nextEligible.toLocaleDateString()}.`,
          )
          error.statusCode = 400
          error.errors = {
            componentType: component,
            nextEligibleDate: nextEligible.toISOString(),
          }
          throw error
        }
      }
    }

    const id = await createScheduleRequest({
      userId: req.user.id,
      preferredDate,
      preferredTime,
      componentType,
      lastDonationDate,
      weight,
      healthScreeningAnswers,
      notes,
    })

    return successResponse(res, {
      statusCode: 201,
      message: 'Schedule request submitted successfully',
      data: { id },
    })
  } catch (error) {
    return next(error)
  }
}

module.exports = {
  getMe,
  updateMe,
  getDonationsController,
  getBloodAvailabilityController,
  getDonationEligibilityController,
  getScheduleRequestsController,
  createScheduleRequestController,
}

