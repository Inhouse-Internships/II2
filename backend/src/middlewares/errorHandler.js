const mongoose = require('mongoose');
const env = require('../config/env');
const { errorResponse } = require('../utils/response');

function normalizeError(error) {
  if (!error) {
    return { statusCode: 500, message: 'Internal Server Error' };
  }

  if (error.statusCode) {
    return {
      statusCode: error.statusCode,
      message: error.message,
      details: error.details
    };
  }

  if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
    return {
      statusCode: 401,
      message: 'Invalid or expired authentication token'
    };
  }

  if (error instanceof mongoose.Error.ValidationError) {
    return {
      statusCode: 400,
      message: 'Validation failed',
      details: Object.values(error.errors).map((entry) => entry.message)
    };
  }

  if (error instanceof mongoose.Error.CastError) {
    return {
      statusCode: 400,
      message: `Invalid ${error.path}`
    };
  }

  if (error.code === 11000) {
    return {
      statusCode: 409,
      message: 'Duplicate value exists',
      details: error.keyValue
    };
  }

  return {
    statusCode: 500,
    message: error.message || 'Internal Server Error'
  };
}

function errorHandler(err, req, res, next) {
  const normalized = normalizeError(err);

  // Only log server-side errors (5xx) in detail
  if (normalized.statusCode >= 500) {
    console.error(`ERROR [${req.method} ${req.url}]:`, err.message);
    console.error(err.stack);
  }
  const debugError = env.IS_PRODUCTION ? {} : { stack: err.stack };

  return errorResponse(
    res,
    debugError,
    normalized.message,
    normalized.statusCode,
    normalized.details
  );
}

module.exports = errorHandler;
