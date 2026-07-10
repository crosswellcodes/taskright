const express = require('express');
const router = express.Router();
const twilio = require('twilio');
const knex = require('../db');
const { authenticate, requireBusiness } = require('../middleware/auth');
const businessService = require('../services/businessService');
const notificationService = require('../services/notificationService');

// All business routes require authentication + ownership check
router.use(authenticate);

// ─── SERVICE TEMPLATES (reusable library) ────────────────────────────────────
// Tasks are owned per-template (template_tasks) — no global /tasks routes anymore.
// Task shape at the boundary: { id?, name, timeAllotmentMinutes }.

/**
 * POST /api/businesses/:businessId/service-templates
 * Create a service template
 */
router.post('/:businessId/service-templates', requireBusiness, async (req, res) => {
  try {
    const businessId = parseInt(req.params.businessId);
    const { name, frequency, daysBeforeServiceDeadline, daysBeforeAutoRepeat, tasks } = req.body;

    const validFrequencies = ['one_time', 'weekly', 'biweekly', 'monthly', 'yearly'];

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return res.status(400).json({ success: false, error: 'Service template name is required', code: 'VALIDATION_ERROR' });
    }
    if (!frequency || !validFrequencies.includes(frequency)) {
      return res.status(400).json({
        success: false,
        error: `frequency must be one of: ${validFrequencies.join(', ')}`,
        code: 'VALIDATION_ERROR'
      });
    }
    if (typeof daysBeforeServiceDeadline !== 'number' || daysBeforeServiceDeadline < 0) {
      return res.status(400).json({
        success: false,
        error: 'daysBeforeServiceDeadline is required and must be a non-negative number',
        code: 'VALIDATION_ERROR'
      });
    }
    if (typeof daysBeforeAutoRepeat !== 'number' || daysBeforeAutoRepeat < 0) {
      return res.status(400).json({
        success: false,
        error: 'daysBeforeAutoRepeat is required and must be a non-negative number',
        code: 'VALIDATION_ERROR'
      });
    }

    const { cycle, assignedTasks } = await businessService.createServiceTemplate(
      businessId, name, frequency, daysBeforeServiceDeadline, daysBeforeAutoRepeat, tasks || []
    );

    return res.status(201).json({
      success: true,
      serviceTemplate: {
        id: cycle.id,
        businessId: cycle.business_id,
        name: cycle.name,
        frequency: cycle.frequency,
        daysBeforeServiceDeadline: cycle.days_before_service_deadline,
        daysBeforeAutoRepeat: cycle.days_before_auto_repeat,
        tasks: assignedTasks, // [{ id, name, timeAllotmentMinutes }]
        createdAt: cycle.created_at
      }
    });
  } catch (error) {
    if (error.code === 'VALIDATION_ERROR') {
      return res.status(400).json({ success: false, error: error.message, code: 'VALIDATION_ERROR' });
    }
    console.error('Create service template error:', error);
    return res.status(500).json({ success: false, error: 'Internal server error', code: 'INTERNAL_ERROR' });
  }
});

/**
 * GET /api/businesses/:businessId/service-templates
 * Get all service templates for a business
 */
router.get('/:businessId/service-templates', requireBusiness, async (req, res) => {
  try {
    const businessId = parseInt(req.params.businessId);

    const business = await businessService.getBusinessById(businessId);
    if (!business) {
      return res.status(404).json({ success: false, error: 'Business not found', code: 'BUSINESS_NOT_FOUND' });
    }

    const cycles = await businessService.getServiceTemplatesByBusiness(businessId);

    return res.status(200).json({
      success: true,
      serviceTemplates: cycles.map(c => ({
        id: c.id,
        name: c.name,
        frequency: c.frequency,
        tasks: c.assignedTasks, // [{ id, name, timeAllotmentMinutes }]
        daysBeforeServiceDeadline: c.days_before_service_deadline,
        daysBeforeAutoRepeat: c.days_before_auto_repeat,
        createdAt: c.created_at
      })),
      total: cycles.length
    });
  } catch (error) {
    console.error('Get service templates error:', error);
    return res.status(500).json({ success: false, error: 'Internal server error', code: 'INTERNAL_ERROR' });
  }
});

/**
 * PUT /api/businesses/:businessId/service-templates/:cycleId
 * Update a service template
 */
router.put('/:businessId/service-templates/:cycleId', requireBusiness, async (req, res) => {
  try {
    const businessId = parseInt(req.params.businessId);
    const cycleId = parseInt(req.params.cycleId);
    const { name, frequency, daysBeforeServiceDeadline, daysBeforeAutoRepeat, tasks } = req.body;

    const cycle = await businessService.getServiceTemplateById(cycleId);
    if (!cycle || cycle.business_id !== businessId) {
      return res.status(404).json({ success: false, error: 'Service template not found', code: 'TEMPLATE_NOT_FOUND' });
    }

    const validFrequencies = ['one_time', 'weekly', 'biweekly', 'monthly', 'yearly'];
    if (frequency !== undefined && !validFrequencies.includes(frequency)) {
      return res.status(400).json({
        success: false,
        error: `frequency must be one of: ${validFrequencies.join(', ')}`,
        code: 'VALIDATION_ERROR'
      });
    }

    const updated = await businessService.updateServiceTemplate(cycleId, {
      name, frequency, daysBeforeServiceDeadline, daysBeforeAutoRepeat, tasks
    });

    return res.status(200).json({
      success: true,
      serviceTemplate: {
        id: updated.id,
        name: updated.name,
        tasks: updated.assignedTasks, // present only when tasks were updated
        updatedAt: updated.updated_at
      }
    });
  } catch (error) {
    if (error.code === 'VALIDATION_ERROR') {
      return res.status(400).json({ success: false, error: error.message, code: 'VALIDATION_ERROR' });
    }
    console.error('Update service template error:', error);
    return res.status(500).json({ success: false, error: 'Internal server error', code: 'INTERNAL_ERROR' });
  }
});

/**
 * DELETE /api/businesses/:businessId/service-templates/:cycleId
 * Delete a service template
 */
router.delete('/:businessId/service-templates/:cycleId', requireBusiness, async (req, res) => {
  try {
    const businessId = parseInt(req.params.businessId);
    const cycleId = parseInt(req.params.cycleId);

    const cycle = await businessService.getServiceTemplateById(cycleId);
    if (!cycle || cycle.business_id !== businessId) {
      return res.status(404).json({ success: false, error: 'Service template not found', code: 'TEMPLATE_NOT_FOUND' });
    }

    await businessService.deleteServiceTemplate(cycleId);
    return res.status(200).json({ success: true, message: 'Service template deleted' });
  } catch (error) {
    console.error('Delete service template error:', error);
    return res.status(500).json({ success: false, error: 'Internal server error', code: 'INTERNAL_ERROR' });
  }
});

// ─── CUSTOMERS ───────────────────────────────────────────────────────────────

/**
 * POST /api/businesses/:businessId/customers
 * Add a new customer
 */
router.post('/:businessId/customers', requireBusiness, async (req, res) => {
  try {
    const businessId = parseInt(req.params.businessId);
    const { name, phoneNumber } = req.body;

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return res.status(400).json({ success: false, error: 'Customer name is required', code: 'VALIDATION_ERROR' });
    }

    const phoneRegex = /^\+[1-9]\d{1,14}$/;
    if (!phoneNumber || !phoneRegex.test(phoneNumber)) {
      return res.status(400).json({
        success: false,
        error: 'Phone number must be in E.164 format (e.g., +1234567890)',
        code: 'VALIDATION_ERROR'
      });
    }

    const customer = await businessService.addCustomer(businessId, name, phoneNumber);

    return res.status(201).json({
      success: true,
      customer: {
        id: customer.id,
        businessId: customer.business_id,
        name: customer.name,
        phoneNumber: customer.phone_number,
        createdAt: customer.created_at
      }
    });
  } catch (error) {
    if (error.code === 'DUPLICATE_CUSTOMER') {
      return res.status(409).json({
        success: false,
        error: 'Customer with this phone already exists for this business',
        code: 'DUPLICATE_CUSTOMER'
      });
    }
    console.error('Add customer error:', error);
    return res.status(500).json({ success: false, error: 'Internal server error', code: 'INTERNAL_ERROR' });
  }
});

/**
 * GET /api/businesses/:businessId/customers
 * Get all customers for a business
 */
router.get('/:businessId/customers', requireBusiness, async (req, res) => {
  try {
    const businessId = parseInt(req.params.businessId);

    const business = await businessService.getBusinessById(businessId);
    if (!business) {
      return res.status(404).json({ success: false, error: 'Business not found', code: 'BUSINESS_NOT_FOUND' });
    }

    const customers = await businessService.getCustomersByBusiness(businessId);

    return res.status(200).json({
      success: true,
      customers: customers.map(c => ({
        id: c.id,
        name: c.name,
        phoneNumber: c.phone_number,
        assignedCycles: c.assignedCycles
      })),
      total: customers.length
    });
  } catch (error) {
    console.error('Get customers error:', error);
    return res.status(500).json({ success: false, error: 'Internal server error', code: 'INTERNAL_ERROR' });
  }
});

/**
 * GET /api/businesses/:businessId/customers/:customerId
 * Get details for one customer
 */
router.get('/:businessId/customers/:customerId', requireBusiness, async (req, res) => {
  try {
    const businessId = parseInt(req.params.businessId);
    const customerId = parseInt(req.params.customerId);

    const customer = await businessService.getCustomerDetails(customerId);
    if (!customer || customer.business_id !== businessId) {
      return res.status(404).json({ success: false, error: 'Customer not found', code: 'CUSTOMER_NOT_FOUND' });
    }

    return res.status(200).json({
      success: true,
      customer: {
        id: customer.id,
        name: customer.name,
        phoneNumber: customer.phone_number,
        email: customer.email,
        address: customer.address,
        notes: customer.notes,
        assignedCycles: customer.assignedCycles,
        upcomingServices: customer.upcomingServices,
        lastSelection: customer.lastSelection,
        // Review Requests (Component 3): surface the opt-out flag so the detail
        // screen can render + toggle it (PATCH .../customers/:id below).
        reviewRequestsOptedOut: customer.review_requests_opted_out
      }
    });
  } catch (error) {
    console.error('Get customer details error:', error);
    return res.status(500).json({ success: false, error: 'Internal server error', code: 'INTERNAL_ERROR' });
  }
});

/**
 * PATCH /api/businesses/:businessId/customers/:customerId
 * Update customer details (email, address, notes)
 */
router.patch('/:businessId/customers/:customerId', requireBusiness, async (req, res) => {
  try {
    const businessId = parseInt(req.params.businessId);
    const customerId = parseInt(req.params.customerId);
    const { email, address, notes, reviewRequestsOptedOut } = req.body;

    const customer = await businessService.getCustomerDetails(customerId);
    if (!customer || customer.business_id !== businessId) {
      return res.status(404).json({ success: false, error: 'Customer not found', code: 'CUSTOMER_NOT_FOUND' });
    }

    const updated = await businessService.updateCustomerDetails(customerId, { email, address, notes, reviewRequestsOptedOut });

    return res.status(200).json({
      success: true,
      customer: {
        id: updated.id,
        name: updated.name,
        phoneNumber: updated.phone_number,
        email: updated.email,
        address: updated.address,
        notes: updated.notes,
        reviewRequestsOptedOut: updated.review_requests_opted_out
      }
    });
  } catch (error) {
    console.error('Update customer details error:', error);
    return res.status(500).json({ success: false, error: 'Internal server error', code: 'INTERNAL_ERROR' });
  }
});

/**
 * DELETE /api/businesses/:businessId/customers/:customerId
 * Delete a customer
 */
router.delete('/:businessId/customers/:customerId', requireBusiness, async (req, res) => {
  try {
    const businessId = parseInt(req.params.businessId);
    const customerId = parseInt(req.params.customerId);

    const customer = await businessService.getCustomerDetails(customerId);
    if (!customer || customer.business_id !== businessId) {
      return res.status(404).json({ success: false, error: 'Customer not found', code: 'CUSTOMER_NOT_FOUND' });
    }

    await businessService.deleteCustomer(customerId);
    return res.status(200).json({ success: true, message: 'Customer deleted' });
  } catch (error) {
    console.error('Delete customer error:', error);
    return res.status(500).json({ success: false, error: 'Internal server error', code: 'INTERNAL_ERROR' });
  }
});

// ─── PER-CUSTOMER SERVICES (Service Model C1) ────────────────────────────────
// Build/edit/delete a customer's own Service directly on their profile. The
// definition lives on the Service; a template (if any) only seeds initial values.

function serviceModelError(res, err, label) {
  if (err && err.statusCode) {
    return res.status(err.statusCode).json({ success: false, error: err.message, code: err.code });
  }
  console.error(`${label} error:`, err);
  return res.status(500).json({ success: false, error: 'Internal server error', code: 'INTERNAL_ERROR' });
}

async function assertCustomerOwned(businessId, customerId) {
  const customer = await knex('customers').where('id', customerId).where('business_id', businessId).first();
  if (!customer) {
    throw Object.assign(new Error('Customer not found'), { code: 'CUSTOMER_NOT_FOUND', statusCode: 404 });
  }
  return customer;
}

/**
 * POST /api/businesses/:businessId/customers/:customerId/services
 * Create a Service on the customer. Body: { name, frequency, daysBeforeServiceDeadline?,
 * daysBeforeAutoRepeat?, tasks?: [{ id?, name, timeAllotmentMinutes }], totalHours,
 * startDate?, dayOfWeek?, pricePerVisit?, templateId? }
 */
router.post('/:businessId/customers/:customerId/services', requireBusiness, async (req, res) => {
  try {
    const businessId = parseInt(req.params.businessId);
    const customerId = parseInt(req.params.customerId);
    await assertCustomerOwned(businessId, customerId);

    // Scheduling validation depends on the business format (day-of-week vs date-based).
    const business = await knex('businesses').where('id', businessId).first();
    const { startDate, dayOfWeek } = req.body;
    if (business && business.scheduling_format === 'day_of_week') {
      if (!Number.isInteger(dayOfWeek) || dayOfWeek < 0 || dayOfWeek > 6) {
        return res.status(400).json({ success: false, error: 'dayOfWeek (0–6) is required for day-of-week scheduling', code: 'VALIDATION_ERROR' });
      }
    } else if (!startDate || !/^\d{4}-\d{2}-\d{2}$/.test(startDate)) {
      return res.status(400).json({ success: false, error: 'startDate is required and must be in YYYY-MM-DD format', code: 'VALIDATION_ERROR' });
    }

    const service = await businessService.createCustomerServiceForBusiness(businessId, customerId, req.body);
    return res.status(201).json({ success: true, service });
  } catch (err) {
    return serviceModelError(res, err, 'Create customer service');
  }
});

/**
 * GET /api/businesses/:businessId/customers/:customerId/services/:serviceId
 * Full Service definition (for the builder / edit view).
 */
router.get('/:businessId/customers/:customerId/services/:serviceId', requireBusiness, async (req, res) => {
  try {
    const businessId = parseInt(req.params.businessId);
    const service = await businessService.getCustomerServiceDetail(businessId, parseInt(req.params.serviceId));
    return res.status(200).json({ success: true, service });
  } catch (err) {
    return serviceModelError(res, err, 'Get customer service');
  }
});

/**
 * PATCH /api/businesses/:businessId/customers/:customerId/services/:serviceId
 * Definition-only edit. Does not regenerate Service Calls (deadline change
 * recomputes open calls' submission_deadline).
 */
router.patch('/:businessId/customers/:customerId/services/:serviceId', requireBusiness, async (req, res) => {
  try {
    const businessId = parseInt(req.params.businessId);
    const service = await businessService.updateCustomerService(businessId, parseInt(req.params.serviceId), req.body);
    return res.status(200).json({ success: true, service });
  } catch (err) {
    return serviceModelError(res, err, 'Update customer service');
  }
});

/**
 * DELETE /api/businesses/:businessId/customers/:customerId/services/:serviceId
 * Refuses (409 HAS_HISTORY) if any Service Call is completed.
 */
router.delete('/:businessId/customers/:customerId/services/:serviceId', requireBusiness, async (req, res) => {
  try {
    const businessId = parseInt(req.params.businessId);
    await businessService.deleteCustomerService(businessId, parseInt(req.params.serviceId));
    return res.status(200).json({ success: true });
  } catch (err) {
    return serviceModelError(res, err, 'Delete customer service');
  }
});

/**
 * GET /api/businesses/:businessId/customers/:customerId/selections/upcoming
 * Get customer's upcoming selection
 */
router.get('/:businessId/customers/:customerId/selections/upcoming', requireBusiness, async (req, res) => {
  try {
    const businessId = parseInt(req.params.businessId);
    const customerId = parseInt(req.params.customerId);

    const customer = await knex('customers').where('id', customerId).where('business_id', businessId).first();
    if (!customer) {
      return res.status(404).json({ success: false, error: 'Customer not found', code: 'CUSTOMER_NOT_FOUND' });
    }

    const selection = await businessService.getUpcomingCustomerSelections(customerId);
    if (!selection) {
      return res.status(404).json({ success: false, error: 'No upcoming service found', code: 'NO_UPCOMING_SERVICE' });
    }

    return res.status(200).json({ success: true, selection });
  } catch (error) {
    console.error('Get upcoming selections error:', error);
    return res.status(500).json({ success: false, error: 'Internal server error', code: 'INTERNAL_ERROR' });
  }
});

/**
 * GET /api/businesses/:businessId/selections
 * Get forecast of all customer selections
 */
router.get('/:businessId/selections', requireBusiness, async (req, res) => {
  try {
    const businessId = parseInt(req.params.businessId);

    const business = await businessService.getBusinessById(businessId);
    if (!business) {
      return res.status(404).json({ success: false, error: 'Business not found', code: 'BUSINESS_NOT_FOUND' });
    }

    const summary = await businessService.getBusinessForecast(businessId);

    return res.status(200).json({ success: true, summary });
  } catch (error) {
    console.error('Get selections forecast error:', error);
    return res.status(500).json({ success: false, error: 'Internal server error', code: 'INTERNAL_ERROR' });
  }
});

/**
 * POST /api/businesses/:businessId/customers/:customerId/mark-service-complete
 * Mark a service as complete
 */
router.post('/:businessId/customers/:customerId/mark-service-complete', requireBusiness, async (req, res) => {
  try {
    const businessId = parseInt(req.params.businessId);
    const customerId = parseInt(req.params.customerId);
    const { selectionCycleId, notes } = req.body;

    if (!selectionCycleId || typeof selectionCycleId !== 'number') {
      return res.status(400).json({
        success: false,
        error: 'selectionCycleId is required and must be a number',
        code: 'VALIDATION_ERROR'
      });
    }

    // Verify customer belongs to this business
    const customer = await knex('customers').where('id', customerId).where('business_id', businessId).first();
    if (!customer) {
      return res.status(404).json({ success: false, error: 'Customer not found', code: 'CUSTOMER_NOT_FOUND' });
    }

    // Verify selection cycle belongs to this customer
    const selectionCycle = await knex('selection_cycles')
      .where('id', selectionCycleId)
      .where('customer_id', customerId)
      .first();
    if (!selectionCycle) {
      return res.status(404).json({ success: false, error: 'Service not found', code: 'SERVICE_NOT_FOUND' });
    }

    const serviceCompletion = await businessService.markServiceComplete(selectionCycleId, customerId, notes);

    return res.status(201).json({
      success: true,
      message: 'Service marked complete.',
      serviceCompletion: {
        id: serviceCompletion.id,
        customerId: serviceCompletion.customer_id,
        selectionCycleId: serviceCompletion.selection_cycle_id,
        completedAt: serviceCompletion.completed_at,
        notes: serviceCompletion.notes
      }
    });
  } catch (error) {
    if (error.code === 'ALREADY_COMPLETED') {
      return res.status(409).json({
        success: false,
        error: 'Service already marked as complete',
        code: 'ALREADY_COMPLETED'
      });
    }
    console.error('Mark service complete error:', error);
    return res.status(500).json({ success: false, error: 'Internal server error', code: 'INTERNAL_ERROR' });
  }
});

// ─── SERVICE CALL DETAIL ─────────────────────────────────────────────────────

/**
 * GET /api/businesses/:businessId/selection-cycles/:selectionCycleId
 * Full detail for a single service call — tasks, team member assignment, completion
 */
router.get('/:businessId/selection-cycles/:selectionCycleId', requireBusiness, async (req, res) => {
  try {
    const businessId = parseInt(req.params.businessId);
    const selectionCycleId = parseInt(req.params.selectionCycleId);

    const detail = await businessService.getServiceCallDetail(businessId, selectionCycleId);
    if (!detail) {
      return res.status(404).json({ success: false, error: 'Service call not found', code: 'NOT_FOUND' });
    }

    return res.status(200).json({
      success: true,
      serviceCall: {
        selectionCycleId: detail.selectionCycleId,
        serviceDate: detail.serviceDate,
        submissionDeadline: detail.submissionDeadline,
        status: detail.status,
        customerId: detail.customerId,
        customerName: detail.customerName,
        serviceCycleName: detail.serviceCycleName,
        selectedTasks: detail.selectedTasks || [],
        selectionStatus: detail.selectionStatus || null,
        completedAt: detail.completedAt || null,
        completionNotes: detail.completionNotes || null,
        teamMember: detail.teamMemberId ? {
          id: detail.teamMemberId,
          name: detail.teamMemberName,
          phone: detail.teamMemberPhone,
        } : null,
        team: detail.teamId ? {
          id: detail.teamId,
          name: detail.teamName,
        } : null,
      },
    });
  } catch (err) {
    console.error('Get service call detail error:', err);
    return res.status(500).json({ success: false, error: 'Internal server error', code: 'INTERNAL_ERROR' });
  }
});

// ─── RESCHEDULE SELECTION CYCLE ──────────────────────────────────────────────

/**
 * PATCH /api/businesses/:businessId/selection-cycles/:selectionCycleId/reschedule
 * Move a single service call to a new date — does not affect any other scheduled dates
 */
router.patch('/:businessId/selection-cycles/:selectionCycleId/reschedule', requireBusiness, async (req, res) => {
  try {
    const businessId = parseInt(req.params.businessId);
    const selectionCycleId = parseInt(req.params.selectionCycleId);
    const { newServiceDate } = req.body;

    if (!newServiceDate || !/^\d{4}-\d{2}-\d{2}$/.test(newServiceDate)) {
      return res.status(400).json({ success: false, error: 'newServiceDate is required in YYYY-MM-DD format', code: 'VALIDATION_ERROR' });
    }

    const updated = await businessService.rescheduleSelectionCycle(selectionCycleId, businessId, newServiceDate);

    // Fire-and-forget: notify customer of new date
    (async () => {
      try {
        const [customer, business] = await Promise.all([
          knex('customers').where('id', updated.customer_id).first(),
          knex('businesses').where('id', businessId).first()
        ]);
        await notificationService.sendRescheduleNotification(business, customer.phone_number, newServiceDate);
      } catch (e) {
        console.error('Reschedule SMS failed:', e.message);
      }
    })();

    return res.status(200).json({ success: true, selectionCycle: updated });
  } catch (err) {
    if (err.code === 'NOT_FOUND') {
      return res.status(404).json({ success: false, error: err.message, code: 'NOT_FOUND' });
    }
    if (err.code === 'ALREADY_COMPLETED') {
      return res.status(409).json({ success: false, error: err.message, code: 'ALREADY_COMPLETED' });
    }
    console.error('Reschedule selection cycle error:', err);
    return res.status(500).json({ success: false, error: 'Internal server error', code: 'INTERNAL_ERROR' });
  }
});

// ─── GET LATEST CUSTOMER FEEDBACK ────────────────────────────────────────────

router.get('/:businessId/customers/:customerId/feedback/latest',
  requireBusiness,
  async (req, res) => {
    try {
      const { businessId, customerId } = req.params;
      const feedback = await businessService.getLatestFeedbackForCustomer(businessId, customerId);
      if (!feedback) {
        return res.status(404).json({ success: false, error: 'No feedback found', code: 'NO_FEEDBACK' });
      }
      return res.status(200).json({ success: true, feedback });
    } catch (err) {
      console.error('Get latest customer feedback error:', err);
      return res.status(err.statusCode || 500).json({ success: false, error: err.message, code: 'INTERNAL_ERROR' });
    }
  }
);

// ─── UPDATE BUSINESS NOTES ON FEEDBACK ───────────────────────────────────────

/**
 * PATCH /api/businesses/:businessId/feedback/:feedbackId/business-notes
 * Save or clear the business's private notes on a piece of customer feedback
 */
router.patch('/:businessId/feedback/:feedbackId/business-notes', requireBusiness, async (req, res) => {
  try {
    const businessId = parseInt(req.params.businessId);
    const feedbackId = parseInt(req.params.feedbackId);
    const { notes } = req.body;

    const result = await businessService.updateFeedbackBusinessNotes(feedbackId, businessId, notes);
    return res.status(200).json({ success: true, businessNotes: result.businessNotes });
  } catch (err) {
    if (err.code === 'NOT_FOUND') {
      return res.status(404).json({ success: false, error: err.message, code: 'NOT_FOUND' });
    }
    console.error('Update feedback business notes error:', err);
    return res.status(500).json({ success: false, error: 'Internal server error', code: 'INTERNAL_ERROR' });
  }
});

// ─── TEAM MEMBERS ─────────────────────────────────────────────────────────────

/**
 * POST /api/businesses/:businessId/team-members
 * Add a new team member
 */
router.post('/:businessId/team-members', requireBusiness, async (req, res) => {
  try {
    const businessId = parseInt(req.params.businessId);
    const { name, phoneNumber, weeklyHours } = req.body;

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return res.status(400).json({ success: false, error: 'Name is required', code: 'VALIDATION_ERROR' });
    }

    const phoneRegex = /^\+[1-9]\d{1,14}$/;
    if (!phoneNumber || !phoneRegex.test(phoneNumber)) {
      return res.status(400).json({
        success: false,
        error: 'Phone number must be in E.164 format (e.g., +1234567890)',
        code: 'VALIDATION_ERROR'
      });
    }

    const hours = parseInt(weeklyHours);
    if (!hours || hours < 1 || hours > 168) {
      return res.status(400).json({
        success: false,
        error: 'Weekly hours must be a number between 1 and 168',
        code: 'VALIDATION_ERROR'
      });
    }

    const member = await businessService.addTeamMember(businessId, name, phoneNumber, hours);

    return res.status(201).json({
      success: true,
      teamMember: {
        id: member.id,
        name: member.name,
        phoneNumber: member.phone_number,
        weeklyHours: member.weekly_hours,
        inviteCode: member.invite_code,
        inviteAccepted: member.invite_accepted,
        createdAt: member.created_at,
      }
    });
  } catch (error) {
    if (error.code === 'DUPLICATE_TEAM_MEMBER') {
      return res.status(409).json({
        success: false,
        error: 'A team member with this phone number already exists',
        code: 'DUPLICATE_TEAM_MEMBER'
      });
    }
    console.error('Add team member error:', error);
    return res.status(500).json({ success: false, error: 'Internal server error', code: 'INTERNAL_ERROR' });
  }
});

/**
 * GET /api/businesses/:businessId/team-members
 * List all team members for a business
 */
router.get('/:businessId/team-members', requireBusiness, async (req, res) => {
  try {
    const businessId = parseInt(req.params.businessId);
    const members = await businessService.getTeamMembersByBusiness(businessId);
    return res.status(200).json({
      success: true,
      teamMembers: members.map(m => ({
        id: m.id,
        name: m.name,
        phoneNumber: m.phone_number,
        weeklyHours: m.weekly_hours,
        createdAt: m.created_at,
        groups: Array.isArray(m.groups) ? m.groups : [],
      })),
      total: members.length
    });
  } catch (error) {
    console.error('Get team members error:', error);
    return res.status(500).json({ success: false, error: 'Internal server error', code: 'INTERNAL_ERROR' });
  }
});

/**
 * PUT /api/businesses/:businessId/team-members/:memberId
 * Update a team member's name, phone number, and/or weekly hours
 */
router.put('/:businessId/team-members/:memberId', requireBusiness, async (req, res) => {
  try {
    const businessId = parseInt(req.params.businessId);
    const memberId = parseInt(req.params.memberId);
    const { name, phoneNumber, weeklyHours, hourlyRate } = req.body;
    const updates = {};
    if (name !== undefined) updates.name = name;
    if (phoneNumber !== undefined) updates.phoneNumber = phoneNumber;
    if (weeklyHours !== undefined) updates.weeklyHours = parseInt(weeklyHours, 10);
    if (hourlyRate !== undefined) updates.hourlyRate = hourlyRate === null ? null : parseFloat(hourlyRate);
    const updated = await businessService.updateTeamMember(memberId, businessId, updates);
    return res.status(200).json({
      success: true,
      teamMember: {
        id: updated.id,
        name: updated.name,
        phoneNumber: updated.phone_number,
        weeklyHours: updated.weekly_hours,
        hourlyRate: updated.hourly_rate,
      },
    });
  } catch (error) {
    if (error.code === 'NOT_FOUND') {
      return res.status(404).json({ success: false, error: error.message, code: 'NOT_FOUND' });
    }
    console.error('Update team member error:', error);
    return res.status(500).json({ success: false, error: 'Internal server error', code: 'INTERNAL_ERROR' });
  }
});

/**
 * DELETE /api/businesses/:businessId/team-members/:memberId
 * Delete a team member
 */
router.delete('/:businessId/team-members/:memberId', requireBusiness, async (req, res) => {
  try {
    const businessId = parseInt(req.params.businessId);
    const memberId = parseInt(req.params.memberId);
    await businessService.deleteTeamMember(memberId, businessId);
    return res.status(200).json({ success: true, message: 'Team member deleted' });
  } catch (error) {
    console.error('Delete team member error:', error);
    return res.status(500).json({ success: false, error: 'Internal server error', code: 'INTERNAL_ERROR' });
  }
});

// ─── SERVICE ASSIGNMENTS ─────────────────────────────────────────────────────

/**
 * GET /api/businesses/:businessId/assignments?serviceDate=YYYY-MM-DD
 * Get all team member assignments for a given service date
 */
router.get('/:businessId/assignments', requireBusiness, async (req, res) => {
  try {
    const businessId = parseInt(req.params.businessId);
    const { serviceDate } = req.query;
    if (!serviceDate) {
      return res.status(400).json({ success: false, error: 'serviceDate query param required', code: 'VALIDATION_ERROR' });
    }
    const rows = await businessService.getAssignmentsForDate(businessId, serviceDate);
    return res.status(200).json({
      success: true,
      assignments: rows.map(r => ({
        selectionCycleId: r.selection_cycle_id,
        customerId: r.customer_id,
        teamMemberId: r.team_member_id || null,
        teamMemberName: r.team_member_name || null,
        teamId: r.team_id || null,
        teamName: r.team_name || null,
      })),
    });
  } catch (error) {
    console.error('Get assignments error:', error);
    return res.status(500).json({ success: false, error: 'Internal server error', code: 'INTERNAL_ERROR' });
  }
});

/**
 * PUT /api/businesses/:businessId/assignments/:selectionCycleId
 * Upsert (create or update) a team member assignment for a selection cycle
 */
router.put('/:businessId/assignments/:selectionCycleId', requireBusiness, async (req, res) => {
  try {
    const businessId = parseInt(req.params.businessId);
    const selectionCycleId = parseInt(req.params.selectionCycleId);
    const { teamMemberId, teamId } = req.body;
    if (!teamMemberId && !teamId) {
      return res.status(400).json({ success: false, error: 'teamMemberId or teamId is required', code: 'VALIDATION_ERROR' });
    }
    const assignee = teamMemberId
      ? { teamMemberId: parseInt(teamMemberId) }
      : { teamId: parseInt(teamId) };
    await businessService.upsertServiceAssignment(businessId, selectionCycleId, assignee);
    return res.status(200).json({ success: true, message: 'Assignment saved' });
  } catch (error) {
    console.error('Upsert assignment error:', error);
    return res.status(500).json({ success: false, error: 'Internal server error', code: 'INTERNAL_ERROR' });
  }
});

/**
 * DELETE /api/businesses/:businessId/assignments/:selectionCycleId
 * Remove a team member assignment for a selection cycle
 */
router.delete('/:businessId/assignments/:selectionCycleId', requireBusiness, async (req, res) => {
  try {
    const businessId = parseInt(req.params.businessId);
    const selectionCycleId = parseInt(req.params.selectionCycleId);
    await businessService.removeServiceAssignment(businessId, selectionCycleId);
    return res.status(200).json({ success: true, message: 'Assignment removed' });
  } catch (error) {
    console.error('Remove assignment error:', error);
    return res.status(500).json({ success: false, error: 'Internal server error', code: 'INTERNAL_ERROR' });
  }
});

// ─── TEAM GROUPS ─────────────────────────────────────────────────────────────

/**
 * POST /api/businesses/:businessId/groups
 * Create a new team group
 */
router.post('/:businessId/groups', requireBusiness, async (req, res) => {
  try {
    const businessId = parseInt(req.params.businessId);
    const { name } = req.body;
    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return res.status(400).json({ success: false, error: 'Group name is required', code: 'VALIDATION_ERROR' });
    }
    const group = await businessService.createTeamGroup(businessId, name.trim());
    return res.status(201).json({ success: true, group: { id: group.id, name: group.name, memberCount: 0 } });
  } catch (error) {
    console.error('Create team group error:', error);
    return res.status(500).json({ success: false, error: 'Internal server error', code: 'INTERNAL_ERROR' });
  }
});

/**
 * GET /api/businesses/:businessId/groups
 * List all team groups for a business (with member counts)
 */
router.get('/:businessId/groups', requireBusiness, async (req, res) => {
  try {
    const businessId = parseInt(req.params.businessId);
    const groups = await businessService.getTeamGroups(businessId);
    return res.status(200).json({
      success: true,
      groups: groups.map(g => ({
        id: g.id,
        name: g.name,
        memberCount: parseInt(g.member_count) || 0,
        members: Array.isArray(g.members) ? g.members : [],
      })),
    });
  } catch (error) {
    console.error('Get team groups error:', error);
    return res.status(500).json({ success: false, error: 'Internal server error', code: 'INTERNAL_ERROR' });
  }
});

/**
 * GET /api/businesses/:businessId/groups/:groupId
 * Get a team group with its members
 */
router.get('/:businessId/groups/:groupId', requireBusiness, async (req, res) => {
  try {
    const businessId = parseInt(req.params.businessId);
    const groupId = parseInt(req.params.groupId);
    const group = await businessService.getTeamGroupWithMembers(groupId, businessId);
    if (!group) {
      return res.status(404).json({ success: false, error: 'Group not found', code: 'NOT_FOUND' });
    }
    return res.status(200).json({ success: true, group });
  } catch (error) {
    console.error('Get team group error:', error);
    return res.status(500).json({ success: false, error: 'Internal server error', code: 'INTERNAL_ERROR' });
  }
});

/**
 * PUT /api/businesses/:businessId/groups/:groupId
 * Update a team group's name
 */
router.put('/:businessId/groups/:groupId', requireBusiness, async (req, res) => {
  try {
    const businessId = parseInt(req.params.businessId);
    const groupId = parseInt(req.params.groupId);
    const { name } = req.body;
    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return res.status(400).json({ success: false, error: 'Group name is required', code: 'VALIDATION_ERROR' });
    }
    const updated = await businessService.updateTeamGroup(groupId, businessId, name.trim());
    if (!updated) {
      return res.status(404).json({ success: false, error: 'Group not found', code: 'NOT_FOUND' });
    }
    return res.status(200).json({ success: true, group: { id: updated.id, name: updated.name } });
  } catch (error) {
    console.error('Update team group error:', error);
    return res.status(500).json({ success: false, error: 'Internal server error', code: 'INTERNAL_ERROR' });
  }
});

/**
 * PUT /api/businesses/:businessId/groups/:groupId/members
 * Replace all members of a team group
 */
router.put('/:businessId/groups/:groupId/members', requireBusiness, async (req, res) => {
  try {
    const businessId = parseInt(req.params.businessId);
    const groupId = parseInt(req.params.groupId);
    const { memberIds } = req.body;
    if (!Array.isArray(memberIds)) {
      return res.status(400).json({ success: false, error: 'memberIds must be an array', code: 'VALIDATION_ERROR' });
    }
    await businessService.setTeamGroupMembers(groupId, businessId, memberIds);
    return res.status(200).json({ success: true, message: 'Group members updated' });
  } catch (error) {
    if (error.code === 'NOT_FOUND') {
      return res.status(404).json({ success: false, error: error.message, code: 'NOT_FOUND' });
    }
    console.error('Set team group members error:', error);
    return res.status(500).json({ success: false, error: 'Internal server error', code: 'INTERNAL_ERROR' });
  }
});

/**
 * DELETE /api/businesses/:businessId/groups/:groupId
 * Delete a team group
 */
router.delete('/:businessId/groups/:groupId', requireBusiness, async (req, res) => {
  try {
    const businessId = parseInt(req.params.businessId);
    const groupId = parseInt(req.params.groupId);
    await businessService.deleteTeamGroup(groupId, businessId);
    return res.status(200).json({ success: true, message: 'Group deleted' });
  } catch (error) {
    console.error('Delete team group error:', error);
    return res.status(500).json({ success: false, error: 'Internal server error', code: 'INTERNAL_ERROR' });
  }
});

// ─── MESSAGES (communication history) ────────────────────────────────────────

/**
 * GET /api/businesses/:businessId/customers/:customerId/messages
 * Paginated SMS thread between business and customer.
 * Query params: limit (default 50), before (message id, for cursor pagination)
 */
router.get('/:businessId/customers/:customerId/messages', requireBusiness, async (req, res) => {
  try {
    const businessId = parseInt(req.params.businessId);
    const customerId = parseInt(req.params.customerId);
    const limit = Math.min(parseInt(req.query.limit) || 50, 100);
    const before = req.query.before ? parseInt(req.query.before) : null;

    // Verify this customer belongs to this business
    const customer = await knex('customers')
      .where('id', customerId)
      .where('business_id', businessId)
      .first();

    if (!customer) {
      return res.status(404).json({ success: false, error: 'Customer not found', code: 'NOT_FOUND' });
    }

    let query = knex('messages')
      .where('business_id', businessId)
      .where('customer_id', customerId)
      .orderBy('id', 'desc')
      .limit(limit);

    if (before) {
      query = query.where('id', '<', before);
    }

    const rows = await query;

    // Return oldest-first for display in a chat thread
    const messages = rows.reverse().map(m => ({
      id: m.id,
      direction: m.direction,
      body: m.body,
      fromPhone: m.from_phone,
      toPhone: m.to_phone,
      twilioMessageSid: m.twilio_message_sid,
      createdAt: m.created_at,
      mediaUrls: m.media_urls || null,
    }));

    const hasMore = rows.length === limit;
    const nextCursor = hasMore ? rows[0].id : null;

    return res.status(200).json({
      success: true,
      messages,
      pagination: {
        hasMore,
        nextCursor,
      },
    });
  } catch (error) {
    console.error('Get messages error:', error);
    return res.status(500).json({ success: false, error: 'Internal server error', code: 'INTERNAL_ERROR' });
  }
});

/**
 * POST /api/businesses/:businessId/customers/:customerId/messages
 * Send a manual free-text SMS to a customer and log it.
 */
router.post('/:businessId/customers/:customerId/messages', requireBusiness, async (req, res) => {
  try {
    const customerId = parseInt(req.params.customerId);
    const { body } = req.body;

    if (!body || !body.trim()) {
      return res.status(400).json({ success: false, error: 'Message body is required', code: 'VALIDATION_ERROR' });
    }

    const customer = await knex('customers')
      .where({ id: customerId, business_id: req.business.id })
      .first();
    if (!customer) {
      return res.status(404).json({ success: false, error: 'Customer not found', code: 'CUSTOMER_NOT_FOUND' });
    }

    const messageBody = body.trim();
    let twilioSid = null;

    if (req.business.twilio_messaging_service_sid) {
      const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
      const response = await client.messages.create({
        messagingServiceSid: req.business.twilio_messaging_service_sid,
        to: customer.phone_number,
        body: messageBody,
      });
      twilioSid = response.sid;
    } else {
      console.log(`📱 [DEV SMS] To ${customer.phone_number}: ${messageBody}`);
    }

    const [inserted] = await knex('messages').insert({
      business_id: req.business.id,
      customer_id: customer.id,
      direction: 'outbound',
      body: messageBody,
      twilio_message_sid: twilioSid,
      to_phone: customer.phone_number,
      from_phone: req.business.twilio_phone_number || null,
    }).returning('*');

    return res.status(201).json({
      success: true,
      message: {
        id: inserted.id,
        direction: inserted.direction,
        body: inserted.body,
        fromPhone: inserted.from_phone,
        toPhone: inserted.to_phone,
        twilioMessageSid: inserted.twilio_message_sid,
        createdAt: inserted.created_at,
      },
    });
  } catch (err) {
    console.error('Send message error:', err);
    return res.status(500).json({ success: false, error: 'Internal server error', code: 'INTERNAL_ERROR' });
  }
});

// ─── A2P KYC ─────────────────────────────────────────────────────────────────

const { registerA2P } = require('../services/twilioProvisioningService');

/**
 * PATCH /api/businesses/:businessId/kyc
 * Save KYC fields and fire A2P 10DLC Trust Hub registration.
 * EIN (LLC/Corp only) is passed through to Twilio — never stored.
 */
router.patch('/:businessId/kyc', requireBusiness, async (req, res) => {
  try {
    const {
      contactFirstName,
      contactLastName,
      contactEmail,
      businessStreet,
      businessCity,
      businessState,
      businessZip,
      ein,
    } = req.body;

    // Validate required fields
    const missing = [];
    if (!contactFirstName?.trim()) missing.push('contactFirstName');
    if (!contactLastName?.trim()) missing.push('contactLastName');
    if (!contactEmail?.trim()) missing.push('contactEmail');
    if (!businessStreet?.trim()) missing.push('businessStreet');
    if (!businessCity?.trim()) missing.push('businessCity');
    if (!businessState?.trim()) missing.push('businessState');
    if (!businessZip?.trim()) missing.push('businessZip');

    if (missing.length > 0) {
      return res.status(400).json({
        success: false,
        error: `Missing required fields: ${missing.join(', ')}`,
        code: 'VALIDATION_ERROR',
      });
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail.trim())) {
      return res.status(400).json({ success: false, error: 'Invalid email address', code: 'VALIDATION_ERROR' });
    }
    if (!/^[A-Z]{2}$/.test(businessState.trim().toUpperCase())) {
      return res.status(400).json({ success: false, error: 'State must be a 2-letter code', code: 'VALIDATION_ERROR' });
    }
    if (!/^\d{5}(-\d{4})?$/.test(businessZip.trim())) {
      return res.status(400).json({ success: false, error: 'ZIP code must be 5 digits', code: 'VALIDATION_ERROR' });
    }

    const business = req.business;
    if (business.entity_type === 'llc_corp' && !ein?.trim()) {
      return res.status(400).json({ success: false, error: 'EIN is required for LLC/Corp registration', code: 'VALIDATION_ERROR' });
    }

    // Save KYC fields — EIN is explicitly excluded
    await knex('businesses').where('id', business.id).update({
      contact_first_name: contactFirstName.trim(),
      contact_last_name: contactLastName.trim(),
      contact_email: contactEmail.trim().toLowerCase(),
      business_street: businessStreet.trim(),
      business_city: businessCity.trim(),
      business_state: businessState.trim().toUpperCase(),
      business_zip: businessZip.trim(),
      a2p_registration_status: 'pending',
      updated_at: knex.raw('CURRENT_TIMESTAMP'),
    });

    // Fire-and-forget Trust Hub chain. EIN lives in this closure only.
    registerA2P(business.id, ein?.trim() || null).catch(err =>
      console.error('registerA2P unhandled error:', err.message)
    );

    return res.json({ success: true });
  } catch (err) {
    console.error('KYC route error:', err);
    return res.status(500).json({ success: false, error: 'Internal server error', code: 'INTERNAL_ERROR' });
  }
});

// ─── JOB COSTING ─────────────────────────────────────────────────────────────

// Shared error mapper for job-costing routes.
function handleCostError(res, err, context) {
  if (err.code === 'NOT_FOUND') {
    return res.status(404).json({ success: false, error: err.message, code: 'NOT_FOUND' });
  }
  if (err.code === 'VALIDATION_ERROR') {
    return res.status(400).json({ success: false, error: err.message, code: 'VALIDATION_ERROR' });
  }
  if (err.code === 'ALREADY_EXISTS') {
    return res.status(409).json({ success: false, error: err.message, code: 'ALREADY_EXISTS' });
  }
  console.error(`${context} error:`, err);
  return res.status(500).json({ success: false, error: 'Internal server error', code: 'INTERNAL_ERROR' });
}

// Validate a dollar/number field: finite and >= 0. Returns { ok, value }.
function parseMoney(raw) {
  if (raw === null) return { ok: true, value: null };
  const n = typeof raw === 'number' ? raw : parseFloat(raw);
  if (!Number.isFinite(n) || n < 0) return { ok: false };
  return { ok: true, value: n };
}

/**
 * GET /api/businesses/:businessId/cost-categories
 * System defaults + this business's custom categories.
 */
router.get('/:businessId/cost-categories', requireBusiness, async (req, res) => {
  try {
    const businessId = parseInt(req.params.businessId);
    const categories = await businessService.getCostCategories(businessId);
    return res.status(200).json({ success: true, categories });
  } catch (err) {
    return handleCostError(res, err, 'Get cost categories');
  }
});

/**
 * PATCH /api/businesses/:businessId/jobs/:selectionCycleId/price
 * Set or override a job's price (also the ad hoc path — Rule 5).
 */
router.patch('/:businessId/jobs/:selectionCycleId/price', requireBusiness, async (req, res) => {
  try {
    const businessId = parseInt(req.params.businessId);
    const selectionCycleId = parseInt(req.params.selectionCycleId);
    const { price } = req.body;
    const parsed = parseMoney(price);
    if (!parsed.ok) {
      return res.status(400).json({ success: false, error: 'price must be a non-negative number or null', code: 'VALIDATION_ERROR' });
    }
    const updated = await businessService.setJobPrice(businessId, selectionCycleId, parsed.value);
    return res.status(200).json({ success: true, selectionCycle: updated });
  } catch (err) {
    return handleCostError(res, err, 'Set job price');
  }
});

/**
 * PATCH /api/businesses/:businessId/customers/:customerId/assignments/:assignmentId
 * Set the recurring price-per-visit on a cycle assignment (feeds D2 going forward).
 */
router.patch('/:businessId/customers/:customerId/assignments/:assignmentId', requireBusiness, async (req, res) => {
  try {
    const businessId = parseInt(req.params.businessId);
    const customerId = parseInt(req.params.customerId);
    const assignmentId = parseInt(req.params.assignmentId);
    const { pricePerVisit } = req.body;
    const parsed = parseMoney(pricePerVisit);
    if (!parsed.ok) {
      return res.status(400).json({ success: false, error: 'pricePerVisit must be a non-negative number or null', code: 'VALIDATION_ERROR' });
    }
    const updated = await businessService.setAssignmentPrice(businessId, customerId, assignmentId, parsed.value);
    return res.status(200).json({ success: true, assignment: updated });
  } catch (err) {
    return handleCostError(res, err, 'Set assignment price');
  }
});

/**
 * GET /api/businesses/:businessId/jobs/:selectionCycleId/costs
 * Full per-job costing payload: price, labor lines, materials, overhead, totals, margin.
 */
router.get('/:businessId/jobs/:selectionCycleId/costs', requireBusiness, async (req, res) => {
  try {
    const businessId = parseInt(req.params.businessId);
    const selectionCycleId = parseInt(req.params.selectionCycleId);
    const costs = await businessService.getJobCosts(businessId, selectionCycleId);
    return res.status(200).json({ success: true, costs });
  } catch (err) {
    return handleCostError(res, err, 'Get job costs');
  }
});

/**
 * POST /api/businesses/:businessId/jobs/:selectionCycleId/costs
 * Manual entry/correction of a cost line (materials, overhead, or manual labor).
 */
router.post('/:businessId/jobs/:selectionCycleId/costs', requireBusiness, async (req, res) => {
  try {
    const businessId = parseInt(req.params.businessId);
    const selectionCycleId = parseInt(req.params.selectionCycleId);
    const { costCategoryId, amount, teamMemberId, hoursActual } = req.body;
    if (costCategoryId == null) {
      return res.status(400).json({ success: false, error: 'costCategoryId is required', code: 'VALIDATION_ERROR' });
    }
    const parsedAmount = parseMoney(amount);
    if (!parsedAmount.ok || parsedAmount.value === null) {
      return res.status(400).json({ success: false, error: 'amount must be a non-negative number', code: 'VALIDATION_ERROR' });
    }
    const line = await businessService.addJobCost(businessId, selectionCycleId, {
      costCategoryId: parseInt(costCategoryId),
      amount: parsedAmount.value,
      teamMemberId: teamMemberId != null ? parseInt(teamMemberId) : null,
      hoursActual: hoursActual != null ? parseFloat(hoursActual) : null,
    });
    return res.status(201).json({ success: true, data: line });
  } catch (err) {
    return handleCostError(res, err, 'Add job cost');
  }
});

/**
 * PATCH /api/businesses/:businessId/jobs/:selectionCycleId/costs/:costId
 * Correct a cost line's amount (and hours for labor). Marks the row manual (D1).
 */
router.patch('/:businessId/jobs/:selectionCycleId/costs/:costId', requireBusiness, async (req, res) => {
  try {
    const businessId = parseInt(req.params.businessId);
    const selectionCycleId = parseInt(req.params.selectionCycleId);
    const costId = parseInt(req.params.costId);
    const { amount, hoursActual } = req.body;
    const updates = {};
    if (amount !== undefined) {
      const parsed = parseMoney(amount);
      if (!parsed.ok || parsed.value === null) {
        return res.status(400).json({ success: false, error: 'amount must be a non-negative number', code: 'VALIDATION_ERROR' });
      }
      updates.amount = parsed.value;
    }
    if (hoursActual !== undefined) {
      updates.hoursActual = hoursActual === null ? null : parseFloat(hoursActual);
    }
    if (updates.amount === undefined && updates.hoursActual === undefined) {
      return res.status(400).json({ success: false, error: 'Provide amount and/or hoursActual', code: 'VALIDATION_ERROR' });
    }
    const line = await businessService.updateJobCost(businessId, selectionCycleId, costId, updates);
    return res.status(200).json({ success: true, data: line });
  } catch (err) {
    return handleCostError(res, err, 'Update job cost');
  }
});

/**
 * DELETE /api/businesses/:businessId/jobs/:selectionCycleId/costs/:costId
 */
router.delete('/:businessId/jobs/:selectionCycleId/costs/:costId', requireBusiness, async (req, res) => {
  try {
    const businessId = parseInt(req.params.businessId);
    const selectionCycleId = parseInt(req.params.selectionCycleId);
    const costId = parseInt(req.params.costId);
    await businessService.deleteJobCost(businessId, selectionCycleId, costId);
    return res.status(200).json({ success: true });
  } catch (err) {
    return handleCostError(res, err, 'Delete job cost');
  }
});

/**
 * GET /api/businesses/:businessId/customers/:customerId/profitability
 * Aggregate over COMPLETED cycles only.
 */
router.get('/:businessId/customers/:customerId/profitability', requireBusiness, async (req, res) => {
  try {
    const businessId = parseInt(req.params.businessId);
    const customerId = parseInt(req.params.customerId);
    const data = await businessService.getCustomerProfitability(businessId, customerId);
    return res.status(200).json({ success: true, profitability: data });
  } catch (err) {
    return handleCostError(res, err, 'Get customer profitability');
  }
});

module.exports = router;
