const AppError = require('../utils/appError');

function notFound(req, res, next) {
  next(new AppError(404, `Route not found: ${req.originalUrl}`));
}

module.exports = notFound;
