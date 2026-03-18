const jwt = require('jsonwebtoken');
const env = require('../config/env');

function signToken(payload, options = {}) {
  return jwt.sign(payload, env.JWT_SECRET, {
    expiresIn: env.JWT_EXPIRES_IN,
    issuer: env.JWT_ISSUER,
    ...options
  });
}

function verifyToken(token) {
  return jwt.verify(token, env.JWT_SECRET, {
    issuer: env.JWT_ISSUER
  });
}

module.exports = {
  signToken,
  verifyToken
};
