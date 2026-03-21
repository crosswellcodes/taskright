const express = require('express');
const router = express.Router();
const { generateToken } = require('../utils/jwt');
const { validateBusinessSignup, validateCustomerSignup } = require('../utils/validators');
const businessService = require('../services/businessService');
const customerService = require('../services/customerService');

/**
 * POST /api/auth/businesses/signup
 * Create a new business account
 */
router.post('/businesses/signup', async (req, res) => {
  try {
    const { name, phoneNumber, schedulingFormat } = req.body;

    // Validate input
    const validation = validateBusinessSignup({ name, phoneNumber, schedulingFormat });
    if (!validation.isValid) {
      return res.status(400).json({
        success: false,
        error: validation.errors.join('; '),
        code: 'VALIDATION_ERROR'
      });
    }

    // Create business
    const business = await businessService.createBusiness(name, phoneNumber, schedulingFormat || 'date_based');

    // Generate token
    const { token, expiresIn } = generateToken({
      sub: business.id.toString(),
      type: 'business',
      businessId: business.id
    });

    // Return success response
    return res.status(201).json({
      success: true,
      business: {
        id: business.id,
        name: business.name,
        phoneNumber: business.phone_number,
        schedulingFormat: business.scheduling_format,
        createdAt: business.created_at
      },
      token,
      expiresIn
    });
  } catch (error) {
    // Handle specific errors
    if (error.code === 'DUPLICATE_PHONE') {
      return res.status(409).json({
        success: false,
        error: 'Phone number already registered',
        code: 'DUPLICATE_PHONE'
      });
    }

    // Handle unexpected errors
    console.error('Signup error:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
      code: 'INTERNAL_ERROR'
    });
  }
});

/**
 * POST /api/auth/businesses/login
 * Login with phone number
 */
router.post('/businesses/login', async (req, res) => {
  try {
    const { phoneNumber } = req.body;

    // Validate input
    if (!phoneNumber) {
      return res.status(400).json({
        success: false,
        error: 'Phone number is required',
        code: 'VALIDATION_ERROR'
      });
    }

    // Get business by phone
    const business = await businessService.getBusinessByPhone(phoneNumber);

    if (!business) {
      return res.status(404).json({
        success: false,
        error: 'Business not found',
        code: 'BUSINESS_NOT_FOUND'
      });
    }

    // Generate token
    const { token, expiresIn } = generateToken({
      sub: business.id.toString(),
      type: 'business',
      businessId: business.id
    });

    return res.status(200).json({
      success: true,
      business: {
        id: business.id,
        name: business.name,
        phoneNumber: business.phone_number,
        schedulingFormat: business.scheduling_format
      },
      token,
      expiresIn
    });
  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
      code: 'INTERNAL_ERROR'
    });
  }
});

/**
 * POST /api/auth/customers/signup
 * Create a new customer account
 */
router.post('/customers/signup', async (req, res) => {
  try {
    const { phoneNumber, businessId } = req.body;

    // Validate input
    const validation = validateCustomerSignup({ phoneNumber, businessId });
    if (!validation.isValid) {
      return res.status(400).json({
        success: false,
        error: validation.errors.join('; '),
        code: 'VALIDATION_ERROR'
      });
    }

    // Verify business exists
    const business = await businessService.getBusinessById(businessId);
    if (!business) {
      return res.status(404).json({
        success: false,
        error: 'Business not found',
        code: 'BUSINESS_NOT_FOUND'
      });
    }

    // Create customer
    const customer = await customerService.createCustomer(businessId, phoneNumber);

    // Generate token
    const { token, expiresIn } = generateToken({
      sub: customer.id.toString(),
      type: 'customer',
      customerId: customer.id,
      businessId: customer.business_id
    });

    return res.status(201).json({
      success: true,
      customer: {
        id: customer.id,
        businessId: customer.business_id,
        phoneNumber: customer.phone_number,
        createdAt: customer.created_at
      },
      token,
      expiresIn
    });
  } catch (error) {
    if (error.code === 'DUPLICATE_CUSTOMER') {
      return res.status(409).json({
        success: false,
        error: 'Customer with this phone already exists for this business',
        code: 'DUPLICATE_CUSTOMER'
      });
    }
    console.error('Customer signup error:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
      code: 'INTERNAL_ERROR'
    });
  }
});

/**
 * POST /api/auth/customers/login
 * Login customer with phone number
 */
router.post('/customers/login', async (req, res) => {
  try {
    const { phoneNumber } = req.body;

    if (!phoneNumber) {
      return res.status(400).json({
        success: false,
        error: 'Phone number is required',
        code: 'VALIDATION_ERROR'
      });
    }

    // Get customer by phone
    const customer = await customerService.getCustomerByPhone(phoneNumber);

    if (!customer) {
      return res.status(404).json({
        success: false,
        error: 'Customer not found',
        code: 'CUSTOMER_NOT_FOUND'
      });
    }

    // Generate token
    const { token, expiresIn } = generateToken({
      sub: customer.id.toString(),
      type: 'customer',
      customerId: customer.id,
      businessId: customer.business_id
    });

    return res.status(200).json({
      success: true,
      customer: {
        id: customer.id,
        name: customer.name,
        phoneNumber: customer.phone_number,
        businessId: customer.business_id
      },
      token,
      expiresIn
    });
  } catch (error) {
    console.error('Customer login error:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
      code: 'INTERNAL_ERROR'
    });
  }
});

module.exports = router;