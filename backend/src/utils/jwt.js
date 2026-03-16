const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-key-change-in-production';
const TOKEN_EXPIRY = '24h';

/**
 * Generate JWT token
 * @param {Object} payload - Data to encode in token (sub, type, businessId, etc.)
 * @returns {Object} Token and expiration info
 */
function generateToken(payload) {
  const token = jwt.sign(payload, JWT_SECRET, {
    expiresIn: TOKEN_EXPIRY
  });
  
  return {
    token,
    expiresIn: TOKEN_EXPIRY
  };
}

/**
 * Verify JWT token
 * @param {String} token - Token to verify
 * @returns {Object} Decoded payload or null if invalid
 */
function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (error) {
    return null;
  }
}

module.exports = {
  generateToken,
  verifyToken
};