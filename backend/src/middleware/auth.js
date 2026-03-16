const { verifyToken } = require('../utils/jwt');

/**
 * Verify JWT and attach decoded user to req.user
 */
function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      success: false,
      error: 'Unauthorized - missing token',
      code: 'MISSING_TOKEN'
    });
  }

  const token = authHeader.split(' ')[1];
  const decoded = verifyToken(token);

  if (!decoded) {
    return res.status(401).json({
      success: false,
      error: 'Unauthorized - invalid token',
      code: 'INVALID_TOKEN'
    });
  }

  req.user = decoded;
  next();
}

/**
 * Ensure the authenticated user is a business and owns the :businessId param
 */
function requireBusiness(req, res, next) {
  const businessId = parseInt(req.params.businessId);

  if (req.user.type !== 'business') {
    return res.status(403).json({
      success: false,
      error: 'Forbidden - business account required',
      code: 'FORBIDDEN'
    });
  }

  if (req.user.businessId !== businessId) {
    return res.status(403).json({
      success: false,
      error: 'Forbidden - access denied to this business',
      code: 'FORBIDDEN'
    });
  }

  next();
}

/**
 * Ensure the authenticated user is a customer and owns the :customerId param
 */
function requireCustomer(req, res, next) {
  const customerId = parseInt(req.params.customerId);

  if (req.user.type !== 'customer') {
    return res.status(403).json({
      success: false,
      error: 'Forbidden - customer account required',
      code: 'FORBIDDEN'
    });
  }

  if (req.user.customerId !== customerId) {
    return res.status(403).json({
      success: false,
      error: 'Forbidden - access denied to this customer',
      code: 'FORBIDDEN'
    });
  }

  next();
}

module.exports = { authenticate, requireBusiness, requireCustomer };
