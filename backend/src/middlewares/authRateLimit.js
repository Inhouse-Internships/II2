/**
 * Strict rate limiter for authentication endpoints.
 * User requested to remove this feature.
 */

// Pass-through middleware (effectively removing the limit)
const authRateLimit = (req, res, next) => {
  next();
};

module.exports = authRateLimit;
