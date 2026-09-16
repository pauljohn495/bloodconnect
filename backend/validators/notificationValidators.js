const { errorResponse } = require('../utils/response')

function validateNotificationIdParam(req, res, next) {
  const { id } = req.params
  const notificationId = Number(id)

  if (!Number.isSafeInteger(notificationId) || notificationId <= 0) {
    return errorResponse(res, {
      statusCode: 400,
      message: 'Invalid notification id',
    })
  }

  req.notificationId = notificationId
  return next()
}

module.exports = {
  validateNotificationIdParam,
}

