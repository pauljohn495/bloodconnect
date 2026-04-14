const { errorResponse } = require('../utils/response')

function requireSuperAdmin(req, res, next) {
  if (!req.user || req.user.role !== 'super_admin') {
    return errorResponse(res, {
      statusCode: 403,
      message: 'Only super administrators can change module visibility.',
    })
  }
  return next()
}

module.exports = requireSuperAdmin
