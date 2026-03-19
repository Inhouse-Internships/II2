const User = require('../models/User');
const AppError = require('../utils/appError');
const asyncHandler = require('../utils/asyncHandler');
const { verifyToken } = require('../utils/jwt');

function extractToken(req) {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.split(' ')[1];
  }
  return null;
}

const authenticate = asyncHandler(async (req, res, next) => {
  const token = extractToken(req);

  if (!token) {
    throw new AppError(401, 'Authentication token missing');
  }

  // Will throw JsonWebTokenError / TokenExpiredError if invalid — caught by errorHandler
  const decoded = verifyToken(token);
  const userId = decoded.sub || decoded.id;

  // Fetch user with tokenVersion for revocation check
  const user = await User.findById(userId)
    .select('-password +tokenVersion')
    .lean();

  if (!user) {
    throw new AppError(401, 'Authentication failed: user not found');
  }

  // Token version check: invalidates tokens issued before password change / logout
  // `decoded.tv` is the version embedded at sign time; `user.tokenVersion` is current.
  // If the JWT was signed before tv was introduced, decoded.tv will be undefined — allow
  // it for backward compatibility (remove this fallback after all tokens expire).
  const jwtTv = decoded.tv;
  if (jwtTv !== undefined && jwtTv !== (user.tokenVersion || 0)) {
    throw new AppError(401, 'Session has been invalidated. Please log in again.');
  }

  // Remove tokenVersion from req.user (internal field, not for downstream use)
  const { tokenVersion: _tv, ...safeUser } = user;

  req.user = safeUser;
  req.tokenPayload = decoded;
  next();
});

module.exports = authenticate;
