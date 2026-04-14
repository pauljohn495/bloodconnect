const { successResponse, errorResponse } = require('../utils/response')
const {
  REGISTRY,
  PORTALS,
  assertValidPortal,
  assertValidFlagKey,
  buildRouteCheckList,
} = require('../config/featureRegistry')
const { getEffectiveFlagsByPortal, applyUpdates } = require('../models/featureFlagModel')

async function getPublicFeatureFlagsController(req, res) {
  try {
    const byPortal = await getEffectiveFlagsByPortal()
       return successResponse(res, {
      message: 'Feature flags',
      data: {
        flags: byPortal,
        routeChecks: buildRouteCheckList(),
      },
    })
  } catch (err) {
    console.error('getPublicFeatureFlagsController', err)
    return errorResponse(res, { statusCode: 500, message: 'Failed to load feature flags' })
  }
}

async function getAdminFeatureFlagsController(req, res) {
  try {
    const byPortal = await getEffectiveFlagsByPortal()
    return successResponse(res, {
      message: 'Feature flags (admin)',
      data: {
        flags: byPortal,
        routeChecks: buildRouteCheckList(),
        registry: REGISTRY,
        portals: PORTALS,
      },
    })
  } catch (err) {
    console.error('getAdminFeatureFlagsController', err)
    return errorResponse(res, { statusCode: 500, message: 'Failed to load feature flags' })
  }
}

async function putAdminFeatureFlagsController(req, res) {
  try {
    const updates = req.body?.updates
    if (!Array.isArray(updates) || updates.length === 0) {
      return errorResponse(res, { statusCode: 400, message: 'Body must include a non-empty updates array' })
    }

    const normalized = []
    for (const u of updates) {
      const portal = u.portal
      const key = u.key
      if (typeof u.enabled !== 'boolean') {
        return errorResponse(res, { statusCode: 400, message: 'Each update must include enabled (boolean)' })
      }
      assertValidPortal(portal)
      const entry = assertValidFlagKey(key)
      if (entry.portal !== portal) {
        return errorResponse(res, {
          statusCode: 400,
          message: `Flag ${key} belongs to portal "${entry.portal}", not "${portal}"`,
        })
      }
      normalized.push({ portal, key, enabled: u.enabled })
    }

    await applyUpdates(normalized, req.user.id)
    const byPortal = await getEffectiveFlagsByPortal()
    return successResponse(res, {
      message: 'Feature flags updated',
      data: { flags: byPortal, routeChecks: buildRouteCheckList() },
    })
  } catch (err) {
    if (err.statusCode) {
      return errorResponse(res, { statusCode: err.statusCode, message: err.message })
    }
    console.error('putAdminFeatureFlagsController', err)
    return errorResponse(res, { statusCode: 500, message: 'Failed to update feature flags' })
  }
}

module.exports = {
  getPublicFeatureFlagsController,
  getAdminFeatureFlagsController,
  putAdminFeatureFlagsController,
}
