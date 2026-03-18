function successResponse(res, data = {}, message = 'Success', status = 200, meta) {
  const payload = {
    success: true,
    message,
    data
  };

  if (meta !== undefined) {
    payload.meta = meta;
  }

  return res.status(status).json(payload);
}

function errorResponse(res, error = {}, message = 'Error', status = 500, details) {
  const payload = {
    success: false,
    message,
    error
  };

  if (details !== undefined) {
    payload.details = details;
  }

  return res.status(status).json(payload);
}

module.exports = {
  successResponse,
  errorResponse
};
