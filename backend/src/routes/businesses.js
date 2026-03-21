const express = require('express');
const router = express.Router();
const knex = require('../db');
const { authenticate, requireBusiness } = require('../middleware/auth');
const businessService = require('../services/businessService');

// All business routes require authentication + ownership check
router.use(authenticate);

// ─── TASKS ───────────────────────────────────────────────────────────────────

/**
 * POST /api/businesses/:businessId/tasks
 * Create a new task
 */
router.post('/:businessId/tasks', requireBusiness, async (req, res) => {
  try {
    const businessId = parseInt(req.params.businessId);
    const { name, timeAllotmentMinutes } = req.body;

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Task name is required',
        code: 'VALIDATION_ERROR'
      });
    }
    if (!timeAllotmentMinutes || typeof timeAllotmentMinutes !== 'number' || timeAllotmentMinutes <= 0) {
      return res.status(400).json({
        success: false,
        error: 'timeAllotmentMinutes is required and must be a positive number',
        code: 'VALIDATION_ERROR'
      });
    }

    const task = await businessService.createTask(businessId, name, timeAllotmentMinutes);

    return res.status(201).json({
      success: true,
      task: {
        id: task.id,
        businessId: task.business_id,
        name: task.name,
        timeAllotmentMinutes: task.time_allotment_minutes,
        isOptional: task.is_optional,
        createdAt: task.created_at
      }
    });
  } catch (error) {
    console.error('Create task error:', error);
    return res.status(500).json({ success: false, error: 'Internal server error', code: 'INTERNAL_ERROR' });
  }
});

/**
 * GET /api/businesses/:businessId/tasks
 * Get all tasks for a business
 */
router.get('/:businessId/tasks', requireBusiness, async (req, res) => {
  try {
    const businessId = parseInt(req.params.businessId);

    const business = await businessService.getBusinessById(businessId);
    if (!business) {
      return res.status(404).json({ success: false, error: 'Business not found', code: 'BUSINESS_NOT_FOUND' });
    }

    const tasks = await businessService.getTasksByBusiness(businessId);

    return res.status(200).json({
      success: true,
      tasks: tasks.map(t => ({
        id: t.id,
        name: t.name,
        timeAllotmentMinutes: t.time_allotment_minutes,
        isOptional: t.is_optional
      })),
      total: tasks.length
    });
  } catch (error) {
    console.error('Get tasks error:', error);
    return res.status(500).json({ success: false, error: 'Internal server error', code: 'INTERNAL_ERROR' });
  }
});

/**
 * PUT /api/businesses/:businessId/tasks/:taskId
 * Update a task
 */
router.put('/:businessId/tasks/:taskId', requireBusiness, async (req, res) => {
  try {
    const businessId = parseInt(req.params.businessId);
    const taskId = parseInt(req.params.taskId);
    const { name, timeAllotmentMinutes } = req.body;

    const task = await businessService.getTaskById(taskId);
    if (!task || task.business_id !== businessId) {
      return res.status(404).json({ success: false, error: 'Task not found', code: 'TASK_NOT_FOUND' });
    }

    if (name !== undefined && (typeof name !== 'string' || name.trim().length === 0)) {
      return res.status(400).json({ success: false, error: 'Invalid task name', code: 'VALIDATION_ERROR' });
    }
    if (timeAllotmentMinutes !== undefined && (typeof timeAllotmentMinutes !== 'number' || timeAllotmentMinutes <= 0)) {
      return res.status(400).json({
        success: false,
        error: 'timeAllotmentMinutes must be a positive number',
        code: 'VALIDATION_ERROR'
      });
    }

    const updated = await businessService.updateTask(taskId, { name, timeAllotmentMinutes });

    return res.status(200).json({
      success: true,
      task: {
        id: updated.id,
        name: updated.name,
        timeAllotmentMinutes: updated.time_allotment_minutes,
        updatedAt: updated.updated_at
      }
    });
  } catch (error) {
    console.error('Update task error:', error);
    return res.status(500).json({ success: false, error: 'Internal server error', code: 'INTERNAL_ERROR' });
  }
});

/**
 * DELETE /api/businesses/:businessId/tasks/:taskId
 * Delete a task
 */
router.delete('/:businessId/tasks/:taskId', requireBusiness, async (req, res) => {
  try {
    const businessId = parseInt(req.params.businessId);
    const taskId = parseInt(req.params.taskId);

    const task = await businessService.getTaskById(taskId);
    if (!task || task.business_id !== businessId) {
      return res.status(404).json({ success: false, error: 'Task not found', code: 'TASK_NOT_FOUND' });
    }

    await businessService.deleteTask(taskId);

    return res.status(200).json({ success: true, message: 'Task deleted successfully' });
  } catch (error) {
    console.error('Delete task error:', error);
    return res.status(500).json({ success: false, error: 'Internal server error', code: 'INTERNAL_ERROR' });
  }
});

// ─── SERVICE CYCLES ──────────────────────────────────────────────────────────

/**
 * POST /api/businesses/:businessId/service-cycles
 * Create a service cycle
 */
router.post('/:businessId/service-cycles', requireBusiness, async (req, res) => {
  try {
    const businessId = parseInt(req.params.businessId);
    const { name, frequency, daysBeforeServiceDeadline, daysBeforeAutoRepeat, taskIds } = req.body;

    const validFrequencies = ['weekly', 'biweekly', 'monthly', 'yearly'];

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return res.status(400).json({ success: false, error: 'Service cycle name is required', code: 'VALIDATION_ERROR' });
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

    const { cycle, assignedTasks } = await businessService.createServiceCycle(
      businessId, name, frequency, daysBeforeServiceDeadline, daysBeforeAutoRepeat, taskIds || []
    );

    return res.status(201).json({
      success: true,
      serviceCycle: {
        id: cycle.id,
        businessId: cycle.business_id,
        name: cycle.name,
        frequency: cycle.frequency,
        daysBeforeServiceDeadline: cycle.days_before_service_deadline,
        daysBeforeAutoRepeat: cycle.days_before_auto_repeat,
        assignedTasks: assignedTasks.map(t => ({
          id: t.id,
          name: t.name,
          timeAllotmentMinutes: t.time_allotment_minutes
        })),
        createdAt: cycle.created_at
      }
    });
  } catch (error) {
    if (error.code === 'TASK_NOT_FOUND') {
      return res.status(404).json({ success: false, error: error.message, code: 'TASK_NOT_FOUND' });
    }
    console.error('Create service cycle error:', error);
    return res.status(500).json({ success: false, error: 'Internal server error', code: 'INTERNAL_ERROR' });
  }
});

/**
 * GET /api/businesses/:businessId/service-cycles
 * Get all service cycles for a business
 */
router.get('/:businessId/service-cycles', requireBusiness, async (req, res) => {
  try {
    const businessId = parseInt(req.params.businessId);

    const business = await businessService.getBusinessById(businessId);
    if (!business) {
      return res.status(404).json({ success: false, error: 'Business not found', code: 'BUSINESS_NOT_FOUND' });
    }

    const cycles = await businessService.getServiceCyclesByBusiness(businessId);

    return res.status(200).json({
      success: true,
      serviceCycles: cycles.map(c => ({
        id: c.id,
        name: c.name,
        frequency: c.frequency,
        assignedTasks: c.assignedTasks,
        daysBeforeServiceDeadline: c.days_before_service_deadline,
        daysBeforeAutoRepeat: c.days_before_auto_repeat,
        createdAt: c.created_at
      })),
      total: cycles.length
    });
  } catch (error) {
    console.error('Get service cycles error:', error);
    return res.status(500).json({ success: false, error: 'Internal server error', code: 'INTERNAL_ERROR' });
  }
});

/**
 * PUT /api/businesses/:businessId/service-cycles/:cycleId
 * Update a service cycle
 */
router.put('/:businessId/service-cycles/:cycleId', requireBusiness, async (req, res) => {
  try {
    const businessId = parseInt(req.params.businessId);
    const cycleId = parseInt(req.params.cycleId);
    const { name, frequency, daysBeforeServiceDeadline, daysBeforeAutoRepeat, taskIds } = req.body;

    const cycle = await businessService.getServiceCycleById(cycleId);
    if (!cycle || cycle.business_id !== businessId) {
      return res.status(404).json({ success: false, error: 'Service cycle not found', code: 'CYCLE_NOT_FOUND' });
    }

    const validFrequencies = ['weekly', 'biweekly', 'monthly', 'yearly'];
    if (frequency !== undefined && !validFrequencies.includes(frequency)) {
      return res.status(400).json({
        success: false,
        error: `frequency must be one of: ${validFrequencies.join(', ')}`,
        code: 'VALIDATION_ERROR'
      });
    }

    const updated = await businessService.updateServiceCycle(cycleId, {
      name, frequency, daysBeforeServiceDeadline, daysBeforeAutoRepeat, taskIds
    });

    return res.status(200).json({
      success: true,
      serviceCycle: {
        id: updated.id,
        name: updated.name,
        assignedTasks: updated.assignedTasks,
        updatedAt: updated.updated_at
      }
    });
  } catch (error) {
    console.error('Update service cycle error:', error);
    return res.status(500).json({ success: false, error: 'Internal server error', code: 'INTERNAL_ERROR' });
  }
});

/**
 * DELETE /api/businesses/:businessId/service-cycles/:cycleId
 * Delete a service cycle
 */
router.delete('/:businessId/service-cycles/:cycleId', requireBusiness, async (req, res) => {
  try {
    const businessId = parseInt(req.params.businessId);
    const cycleId = parseInt(req.params.cycleId);

    const cycle = await businessService.getServiceCycleById(cycleId);
    if (!cycle || cycle.business_id !== businessId) {
      return res.status(404).json({ success: false, error: 'Service cycle not found', code: 'CYCLE_NOT_FOUND' });
    }

    await businessService.deleteServiceCycle(cycleId);
    return res.status(200).json({ success: true, message: 'Service cycle deleted' });
  } catch (error) {
    console.error('Delete service cycle error:', error);
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
        lastSelection: customer.lastSelection
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
    const { email, address, notes } = req.body;

    const customer = await businessService.getCustomerDetails(customerId);
    if (!customer || customer.business_id !== businessId) {
      return res.status(404).json({ success: false, error: 'Customer not found', code: 'CUSTOMER_NOT_FOUND' });
    }

    const updated = await businessService.updateCustomerDetails(customerId, { email, address, notes });

    return res.status(200).json({
      success: true,
      customer: {
        id: updated.id,
        name: updated.name,
        phoneNumber: updated.phone_number,
        email: updated.email,
        address: updated.address,
        notes: updated.notes
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

/**
 * POST /api/businesses/:businessId/customers/:customerId/assign-cycle
 * Assign a customer to a service cycle with fixed hours
 */
router.post('/:businessId/customers/:customerId/assign-cycle', requireBusiness, async (req, res) => {
  try {
    const businessId = parseInt(req.params.businessId);
    const customerId = parseInt(req.params.customerId);
    const { serviceCycleId, totalHours, startDate, dayOfWeek } = req.body;

    if (!serviceCycleId || typeof serviceCycleId !== 'number') {
      return res.status(400).json({
        success: false,
        error: 'serviceCycleId is required and must be a number',
        code: 'VALIDATION_ERROR'
      });
    }
    if (!totalHours || typeof totalHours !== 'number' || totalHours <= 0) {
      return res.status(400).json({
        success: false,
        error: 'totalHours is required and must be a positive number',
        code: 'VALIDATION_ERROR'
      });
    }

    // Validate scheduling fields based on business format
    const business = await knex('businesses').where('id', businessId).first();
    if (business && business.scheduling_format === 'day_of_week') {
      if (dayOfWeek === undefined || dayOfWeek === null || !Number.isInteger(dayOfWeek) || dayOfWeek < 0 || dayOfWeek > 6) {
        return res.status(400).json({
          success: false,
          error: 'dayOfWeek (0–6) is required for day-of-week scheduling',
          code: 'VALIDATION_ERROR'
        });
      }
    } else {
      if (!startDate || !/^\d{4}-\d{2}-\d{2}$/.test(startDate)) {
        return res.status(400).json({
          success: false,
          error: 'startDate is required and must be in YYYY-MM-DD format',
          code: 'VALIDATION_ERROR'
        });
      }
    }

    // Verify customer belongs to this business
    const customer = await knex('customers').where('id', customerId).where('business_id', businessId).first();
    if (!customer) {
      return res.status(404).json({ success: false, error: 'Customer not found', code: 'CUSTOMER_NOT_FOUND' });
    }

    // Verify service cycle belongs to this business
    const cycle = await businessService.getServiceCycleById(serviceCycleId);
    if (!cycle || cycle.business_id !== businessId) {
      return res.status(404).json({ success: false, error: 'Service cycle not found', code: 'CYCLE_NOT_FOUND' });
    }

    const assignment = await businessService.assignCycle(
      customerId, serviceCycleId, totalHours,
      startDate || null,
      dayOfWeek !== undefined ? dayOfWeek : null
    );

    return res.status(201).json({
      success: true,
      assignment: {
        id: assignment.id,
        customerId: assignment.customer_id,
        serviceCycleId: assignment.service_cycle_id,
        totalHours: assignment.total_hours,
        createdAt: assignment.created_at
      },
      message: 'Customer assigned to service cycle.'
    });
  } catch (error) {
    if (error.code === 'ALREADY_ASSIGNED') {
      return res.status(409).json({
        success: false,
        error: 'Customer already assigned to this cycle',
        code: 'ALREADY_ASSIGNED'
      });
    }
    console.error('Assign cycle error:', error);
    return res.status(500).json({ success: false, error: 'Internal server error', code: 'INTERNAL_ERROR' });
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
        createdAt: member.created_at
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
    const { name, phoneNumber, weeklyHours } = req.body;
    const updates = {};
    if (name !== undefined) updates.name = name;
    if (phoneNumber !== undefined) updates.phoneNumber = phoneNumber;
    if (weeklyHours !== undefined) updates.weeklyHours = parseInt(weeklyHours, 10);
    const updated = await businessService.updateTeamMember(memberId, businessId, updates);
    return res.status(200).json({
      success: true,
      teamMember: {
        id: updated.id,
        name: updated.name,
        phoneNumber: updated.phone_number,
        weeklyHours: updated.weekly_hours,
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

module.exports = router;
