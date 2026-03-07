function successResponse(res, { message = 'Request processed successfully', data = null, statusCode = 200 } = {}) {
  return res.status(statusCode).json({
    status: 'success',
    message,
    data,
  });
}

function errorResponse(res, { message = 'Request failed', statusCode = 500, errors = null } = {}) {
  return res.status(statusCode).json({
    status: 'error',
    message,
    errors,
  });
}

module.exports = {
  successResponse,
  errorResponse,
};

