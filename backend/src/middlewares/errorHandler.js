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

  // Log ALL errors to the console temporarily
  console.error(`ERROR [${req.method} ${req.url}] Status: ${normalized.statusCode}:`, err.message);
  if (err.stack) console.error(err.stack);

  // Still follow production rules for the response body if you want, 
  // but let's at least show the message and details.
  const debugError = { stack: err.stack }; // Temporarily show stack in response too

  return res.status(normalized.statusCode).json({
    success: false,
    message: normalized.message,
    details: normalized.details,
    error: debugError
  });
}

module.exports = errorHandler;
