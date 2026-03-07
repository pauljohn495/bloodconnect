const {
  getUserNotifications,
  markNotificationRead,
} = require('../models/notificationModel')
const { successResponse } = require('../utils/response')

async function listNotifications(req, res, next) {
  try {
    const notifications = await getUserNotifications(req.user.id)
    return successResponse(res, {
      message: 'Notifications fetched successfully',
      data: notifications,
    })
  } catch (error) {
    return next(error)
  }
}

async function markAsRead(req, res, next) {
  try {
    const { notificationId } = req

    const updated = await markNotificationRead(req.user.id, notificationId)
    if (!updated) {
      const error = new Error('Notification not found')
      error.statusCode = 404
      throw error
    }

    return successResponse(res, {
      message: 'Notification marked as read',
      data: { id: notificationId },
    })
  } catch (error) {
    return next(error)
  }
}

module.exports = {
  listNotifications,
  markAsRead,
}

