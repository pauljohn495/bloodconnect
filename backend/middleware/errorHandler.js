const { errorResponse } = require('../utils/response')

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  // If the error already has a statusCode, use it; otherwise default to 500
  const requestedStatus = Number(err.statusCode || err.status || 500)
  const statusCode = requestedStatus >= 400 && requestedStatus < 600 ? requestedStatus : 500
  const exposeMessage = statusCode < 500 || process.env.NODE_ENV === 'development'
  const message = exposeMessage ? (err.message || 'Request failed') : 'Internal server error'

  // Optional extra details for non-production environments
  const errors =
    process.env.NODE_ENV === 'development' && err.errors
      ? err.errors
      : undefined

  if (process.env.NODE_ENV === 'development') {
    // Log full error in development for easier debugging
    // eslint-disable-next-line no-console
    console.error('Unhandled error:', err)
  } else if (statusCode >= 500) {
    console.error('Unhandled server error:', err?.code || err?.name || 'Error')
  }

  return errorResponse(res, { statusCode, message, errors })
}

module.exports = errorHandler

