const express = require('express');
const router = express.Router();
const twilio = require('twilio');
const { generateToken } = require('../utils/jwt');
const { validateBusinessSignup, validateCustomerSignup } = require('../utils/validators');
const businessService = require('../services/businessService');
const customerService = require('../services/customerService');
const { provisionBusiness } = require('../services/twilioProvisioningService');

// Normalize a US phone number to E.164 format
function normalizePhone(phone) {
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`;
  return phone;
}

function verifyClient() {
  return twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN)
    .verify.v2.services(process.env.TWILIO_VERIFY_SERVICE_SID);
}

/**
 * POST /api/auth/verify/send
 * Send a 6-digit OTP to the given phone number via Twilio Verify.
 * Used by the web signup flow before account creation.
 */
router.post('/verify/send', async (req, res) => {
  const { phoneNumber } = req.body;

  if (!phoneNumber) {
    return res.status(400).json({ success: false, error: 'Phone number is required', code: 'VALIDATION_ERROR' });
  }

  try {
    await verifyClient().verifications.create({ to: normalizePhone(phoneNumber), channel: 'sms' });
    return res.json({ success: true });
  } catch (error) {
    // Twilio rate-limit error code 20429
    if (error.status === 429 || error.code === 20429) {
      return res.status(429).json({ success: false, error: 'Too many attempts. Please wait before requesting another code.', code: 'RATE_LIMITED' });
    }
    console.error('Verify send error:', error.message);
    return res.status(500).json({ success: false, error: 'Failed to send verification code', code: 'INTERNAL_ERROR' });
  }
});

/**
 * POST /api/auth/businesses/signup
 * Create a new business account.
 * Web flow: include otpCode to verify phone before account creation.
 * Mobile flow: omit otpCode — verification is skipped (existing behaviour unchanged).
 */
router.post('/businesses/signup', async (req, res) => {
  try {
    const { name, phoneNumber: rawPhone, schedulingFormat, otpCode, entityType } = req.body;
    const phoneNumber = normalizePhone(rawPhone || '');

    // Validate input
    const validation = validateBusinessSignup({ name, phoneNumber, schedulingFormat });
    if (!validation.isValid) {
      return res.status(400).json({
        success: false,
        error: validation.errors.join('; '),
        code: 'VALIDATION_ERROR'
      });
    }

    const resolvedEntityType = entityType || 'sole_prop';
    if (!['sole_prop', 'llc_corp'].includes(resolvedEntityType)) {
      return res.status(400).json({
        success: false,
        error: 'entityType must be sole_prop or llc_corp',
        code: 'VALIDATION_ERROR'
      });
    }

    // Web signup: verify OTP before creating the account
    if (otpCode) {
      try {
        const check = await verifyClient().verificationChecks.create({
          to: normalizePhone(phoneNumber),
          code: otpCode,
        });
        if (check.status !== 'approved') {
          return res.status(400).json({ success: false, error: 'Invalid or expired verification code', code: 'INVALID_OTP' });
        }
      } catch (error) {
        // Twilio throws when code is wrong/expired rather than returning status
        return res.status(400).json({ success: false, error: 'Invalid or expired verification code', code: 'INVALID_OTP' });
      }
    }

    // Create business
    const business = await businessService.createBusiness(name, phoneNumber, schedulingFormat || 'date_based', resolvedEntityType);

    // Fire-and-forget Twilio provisioning — signup response is instant,
    // provisioning completes in the background (status tracked in DB)
    provisionBusiness(business.id).catch(err =>
      console.error('provisionBusiness unhandled error:', err.message)
    );

    // Generate token
    const { token, expiresIn } = generateToken({
      sub: business.id.toString(),
      type: 'business',
      businessId: business.id
    });

    return res.status(201).json({
      success: true,
      business: {
        id: business.id,
        name: business.name,
        phoneNumber: business.phone_number,
        schedulingFormat: business.scheduling_format,
        joinCode: business.join_code,
        createdAt: business.created_at
      },
      token,
      expiresIn
    });
  } catch (error) {
    if (error.code === 'DUPLICATE_PHONE') {
      return res.status(409).json({
        success: false,
        error: 'Phone number already registered',
        code: 'DUPLICATE_PHONE'
      });
    }
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

    if (!phoneNumber) {
      return res.status(400).json({
        success: false,
        error: 'Phone number is required',
        code: 'VALIDATION_ERROR'
      });
    }

    const business = await businessService.getBusinessByPhone(phoneNumber);

    if (!business) {
      return res.status(404).json({
        success: false,
        error: 'Business not found',
        code: 'BUSINESS_NOT_FOUND'
      });
    }

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
 * GET /api/auth/businesses/join/:joinCode
 * Resolve a business join code to businessId + businessName.
 * Used by the web customer signup page to show "You're joining [Business]" before OTP.
 */
router.get('/businesses/join/:joinCode', async (req, res) => {
  try {
    const business = await businessService.getBusinessByJoinCode(req.params.joinCode);
    if (!business) {
      return res.status(404).json({ success: false, error: 'Invalid join code', code: 'INVALID_JOIN_CODE' });
    }
    return res.json({ success: true, businessId: business.id, businessName: business.name });
  } catch (error) {
    console.error('Join code lookup error:', error);
    return res.status(500).json({ success: false, error: 'Internal server error', code: 'INTERNAL_ERROR' });
  }
});

/**
 * POST /api/auth/customers/signup
 * Create a new customer account.
 * Web flow: include name + otpCode. Mobile flow: omit both (existing behaviour unchanged).
 */
router.post('/customers/signup', async (req, res) => {
  try {
    const { phoneNumber, businessId, name, otpCode } = req.body;

    const validation = validateCustomerSignup({ phoneNumber, businessId });
    if (!validation.isValid) {
      return res.status(400).json({
        success: false,
        error: validation.errors.join('; '),
        code: 'VALIDATION_ERROR'
      });
    }

    const business = await businessService.getBusinessById(businessId);
    if (!business) {
      return res.status(404).json({
        success: false,
        error: 'Business not found',
        code: 'BUSINESS_NOT_FOUND'
      });
    }

    // Web signup: verify OTP before creating the account
    if (otpCode) {
      try {
        const check = await verifyClient().verificationChecks.create({
          to: normalizePhone(phoneNumber),
          code: otpCode,
        });
        if (check.status !== 'approved') {
          return res.status(400).json({ success: false, error: 'Invalid or expired verification code', code: 'INVALID_OTP' });
        }
      } catch {
        return res.status(400).json({ success: false, error: 'Invalid or expired verification code', code: 'INVALID_OTP' });
      }
    }

    const customer = await customerService.createCustomer(businessId, phoneNumber, name || null);

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

    const customer = await customerService.getCustomerByPhone(phoneNumber);

    if (!customer) {
      return res.status(404).json({
        success: false,
        error: 'Customer not found',
        code: 'CUSTOMER_NOT_FOUND'
      });
    }

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

/**
 * POST /api/auth/team-members/accept-invite
 * First-time activation: phone number + invite code → returns JWT
 */
router.post('/team-members/accept-invite', async (req, res) => {
  try {
    const { phoneNumber, inviteCode } = req.body;

    if (!phoneNumber) {
      return res.status(400).json({ success: false, error: 'Phone number is required', code: 'VALIDATION_ERROR' });
    }
    if (!inviteCode) {
      return res.status(400).json({ success: false, error: 'Invite code is required', code: 'VALIDATION_ERROR' });
    }

    const member = await businessService.acceptTeamMemberInvite(phoneNumber, inviteCode);

    const { token, expiresIn } = generateToken({
      sub: member.id.toString(),
      type: 'team_member',
      teamMemberId: member.id,
      businessId: member.business_id,
    });

    return res.status(200).json({
      success: true,
      teamMember: {
        id: member.id,
        name: member.name,
        phoneNumber: member.phone_number,
        businessId: member.business_id,
      },
      token,
      expiresIn,
    });
  } catch (error) {
    if (error.code === 'TEAM_MEMBER_NOT_FOUND') {
      return res.status(404).json({ success: false, error: error.message, code: 'TEAM_MEMBER_NOT_FOUND' });
    }
    if (error.code === 'INVALID_INVITE_CODE') {
      return res.status(401).json({ success: false, error: 'Invalid invite code', code: 'INVALID_INVITE_CODE' });
    }
    if (error.code === 'INVITE_ALREADY_ACCEPTED') {
      return res.status(409).json({ success: false, error: error.message, code: 'INVITE_ALREADY_ACCEPTED' });
    }
    console.error('Team member accept-invite error:', error);
    return res.status(500).json({ success: false, error: 'Internal server error', code: 'INTERNAL_ERROR' });
  }
});

/**
 * POST /api/auth/team-members/login
 * Subsequent logins after invite is accepted — phone number only
 */
router.post('/team-members/login', async (req, res) => {
  try {
    const { phoneNumber } = req.body;

    if (!phoneNumber) {
      return res.status(400).json({ success: false, error: 'Phone number is required', code: 'VALIDATION_ERROR' });
    }

    const member = await businessService.getTeamMemberByPhone(phoneNumber);

    if (!member) {
      return res.status(404).json({ success: false, error: 'Team member not found', code: 'TEAM_MEMBER_NOT_FOUND' });
    }
    if (!member.invite_accepted) {
      return res.status(403).json({ success: false, error: 'Invite not yet accepted', code: 'INVITE_PENDING' });
    }

    const { token, expiresIn } = generateToken({
      sub: member.id.toString(),
      type: 'team_member',
      teamMemberId: member.id,
      businessId: member.business_id,
    });

    return res.status(200).json({
      success: true,
      teamMember: {
        id: member.id,
        name: member.name,
        phoneNumber: member.phone_number,
        businessId: member.business_id,
      },
      token,
      expiresIn,
    });
  } catch (error) {
    console.error('Team member login error:', error);
    return res.status(500).json({ success: false, error: 'Internal server error', code: 'INTERNAL_ERROR' });
  }
});

/**
 * GET /api/auth/selection/:token
 * Return task selection data for a tokenized SMS link (no auth required).
 */
router.get('/selection/:token', async (req, res) => {
  try {
    const data = await businessService.getSelectionByToken(req.params.token);
    if (!data) {
      return res.status(404).json({ success: false, error: 'This link has expired or is invalid.', code: 'INVALID_TOKEN' });
    }
    return res.json({ success: true, ...data });
  } catch (error) {
    console.error('Selection token lookup error:', error);
    return res.status(500).json({ success: false, error: 'Internal server error', code: 'INTERNAL_ERROR' });
  }
});

/**
 * POST /api/auth/selection/:token/submit
 * Submit a task selection via tokenized SMS link (no auth required).
 */
router.post('/selection/:token/submit', async (req, res) => {
  try {
    const { selectedTaskIds } = req.body;
    if (!Array.isArray(selectedTaskIds)) {
      return res.status(400).json({ success: false, error: 'selectedTaskIds must be an array', code: 'VALIDATION_ERROR' });
    }
    const result = await businessService.submitSelectionByToken(req.params.token, selectedTaskIds);
    return res.json({ success: true, serviceDate: result.serviceDate });
  } catch (error) {
    if (error.code === 'INVALID_TOKEN') return res.status(404).json({ success: false, error: error.message, code: 'INVALID_TOKEN' });
    if (error.code === 'INVALID_TASKS') return res.status(400).json({ success: false, error: error.message, code: 'INVALID_TASKS' });
    console.error('Selection token submit error:', error);
    return res.status(500).json({ success: false, error: 'Internal server error', code: 'INTERNAL_ERROR' });
  }
});

module.exports = router;
