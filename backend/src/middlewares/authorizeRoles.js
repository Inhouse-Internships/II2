const AppError = require('../utils/appError');

function authorizeRoles(...roles) {
  const allowedRoles = roles.flat();
  return (req, res, next) => {
    if (!req.user || !allowedRoles.includes(req.user.role)) {
      return next(new AppError(403, 'Forbidden: insufficient role'));
    }
    next();
  };
}

module.exports = authorizeRoles;
