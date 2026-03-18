const { errorResponse } = require('../utils/response');

function validateRequest(validators = []) {
  return (req, res, next) => {
    const errors = [];

    validators.forEach((validator) => {
      const result = validator(req);
      if (typeof result === 'string' && result) {
        errors.push(result);
      }
    });

    if (errors.length > 0) {
      return errorResponse(res, {}, 'Validation failed', 400, errors);
    }

    next();
  };
}

module.exports = validateRequest;
