const { errorResponse } = require('../utils/response')

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  // If the error already has a statusCode, use it; otherwise default to 500
  const statusCode = err.statusCode || 500
  const message = err.message || 'Internal server error'

  // Optional extra details for non-production environments
  const errors =
    process.env.NODE_ENV === 'development' && err.errors
      ? err.errors
      : undefined

  if (process.env.NODE_ENV === 'development') {
    // Log full error in development for easier debugging
    // eslint-disable-next-line no-console
    console.error('Unhandled error:', err)
  }

  return errorResponse(res, { statusCode, message, errors })
}

module.exports = errorHandler

