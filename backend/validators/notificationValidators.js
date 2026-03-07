const { errorResponse } = require('../utils/response')

function validateNotificationIdParam(req, res, next) {
  const { id } = req.params
  const notificationId = parseInt(id, 10)

  if (Number.isNaN(notificationId)) {
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

