/**
 * Validate business signup input
 * @param {Object} data - Request data
 * @returns {Object} { isValid, errors }
 */
function validateBusinessSignup(data) {
  const errors = [];

  // Check name
  if (!data.name || typeof data.name !== 'string' || data.name.trim().length === 0) {
    errors.push('Name is required and must be a non-empty string');
  }

  // Check phone number
  if (!data.phoneNumber || typeof data.phoneNumber !== 'string') {
    errors.push('Phone number is required and must be a string');
  }

  // Basic phone format validation (E.164 format: +country-code followed by digits)
  const phoneRegex = /^\+[1-9]\d{1,14}$/;
  if (data.phoneNumber && !phoneRegex.test(data.phoneNumber)) {
    errors.push('Phone number must be in E.164 format (e.g., +1234567890)');
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Validate customer signup input
 * @param {Object} data - Request data
 * @returns {Object} { isValid, errors }
 */
function validateCustomerSignup(data) {
  const errors = [];

  if (!data.phoneNumber || typeof data.phoneNumber !== 'string') {
    errors.push('Phone number is required');
  }

  const phoneRegex = /^\+[1-9]\d{1,14}$/;
  if (data.phoneNumber && !phoneRegex.test(data.phoneNumber)) {
    errors.push('Phone number must be in E.164 format');
  }

  if (!data.businessId || typeof data.businessId !== 'number') {
    errors.push('Business ID is required and must be a number');
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

module.exports = {
  validateBusinessSignup,
  validateCustomerSignup
};