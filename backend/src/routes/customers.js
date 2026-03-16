const express = require('express');
const router = express.Router();
const path = require('path');
const multer = require('multer');
const { authenticate, requireCustomer } = require('../middleware/auth');
const customerService = require('../services/customerService');

const feedbackStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, '..', '..', 'uploads', 'feedback'));
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`);
  }
});
const uploadFeedbackPhotos = multer({
  storage: feedbackStorage,
  limits: { files: 5, fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    cb(null, file.mimetype.startsWith('image/'));
  }
}).array('photos', 5);

// All customer routes require authentication
router.use(authenticate);

/**
 * GET /api/customers/:customerId/selection-cycle/current
 * Get current selection cycle (task list + total hours)
 */
router.get('/:customerId/selection-cycle/current', requireCustomer, async (req, res) => {
  try {
    const customerId = parseInt(req.params.customerId);

    const customer = await customerService.getCustomerById(customerId);
    if (!customer) {
      return res.status(404).json({ success: false, error: 'Customer not found', code: 'CUSTOMER_NOT_FOUND' });
    }

    const result = await customerService.getCurrentSelectionCycle(customerId);
    if (!result) {
      return res.status(404).json({
        success: false,
        error: 'No upcoming selection found',
        code: 'NO_UPCOMING_SELECTION'
      });
    }

    return res.status(200).json({
      success: true,
      selectionCycle: result.selectionCycle,
      recentCompletion: result.recentCompletion
    });
  } catch (error) {
    console.error('Get current selection cycle error:', error);
    return res.status(500).json({ success: false, error: 'Internal server error', code: 'INTERNAL_ERROR' });
  }
});

/**
 * POST /api/customers/:customerId/selection-cycle/:selectionCycleId/submit
 * Submit task selections for a service cycle
 */
router.post('/:customerId/selection-cycle/:selectionCycleId/submit', requireCustomer, async (req, res) => {
  try {
    const customerId = parseInt(req.params.customerId);
    const selectionCycleId = parseInt(req.params.selectionCycleId);
    const { selectedTasks, selectedTotalHours } = req.body;

    if (!Array.isArray(selectedTasks) || selectedTasks.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'selectedTasks must be a non-empty array of task IDs',
        code: 'VALIDATION_ERROR'
      });
    }
    if (typeof selectedTotalHours !== 'number' || selectedTotalHours <= 0) {
      return res.status(400).json({
        success: false,
        error: 'selectedTotalHours is required and must be a positive number',
        code: 'VALIDATION_ERROR'
      });
    }

    const { selection, serviceDate } = await customerService.submitSelections(
      selectionCycleId, customerId, selectedTasks, selectedTotalHours
    );

    return res.status(201).json({
      success: true,
      selection: {
        id: selection.id,
        selectionCycleId: selection.selection_cycle_id,
        customerId: selection.customer_id,
        selectedTasks: selection.selected_tasks,
        selectedTotalHours: selection.selected_total_hours,
        status: selection.status,
        submittedAt: selection.submitted_at,
        message: `Selection locked. Your service is scheduled for ${serviceDate}.`
      }
    });
  } catch (error) {
    if (error.code === 'SELECTION_CYCLE_NOT_FOUND') {
      return res.status(404).json({ success: false, error: error.message, code: 'SELECTION_CYCLE_NOT_FOUND' });
    }
    if (error.code === 'ALREADY_SUBMITTED') {
      return res.status(409).json({
        success: false,
        error: error.message,
        code: 'ALREADY_SUBMITTED',
        ...(error.details || {})
      });
    }
    if (error.code === 'TIME_EXCEEDED') {
      return res.status(400).json({
        success: false,
        error: error.message,
        code: 'TIME_EXCEEDED',
        ...(error.details || {})
      });
    }
    if (error.code === 'INVALID_TASK') {
      return res.status(400).json({ success: false, error: error.message, code: 'INVALID_TASK' });
    }
    console.error('Submit selections error:', error);
    return res.status(500).json({ success: false, error: 'Internal server error', code: 'INTERNAL_ERROR' });
  }
});

/**
 * GET /api/customers/:customerId/upcoming-services
 * All open future service dates for the customer (for the "Upcoming Services" modal)
 */
router.get('/:customerId/upcoming-services', requireCustomer, async (req, res) => {
  try {
    const customerId = parseInt(req.params.customerId);

    const customer = await customerService.getCustomerById(customerId);
    if (!customer) {
      return res.status(404).json({ success: false, error: 'Customer not found', code: 'CUSTOMER_NOT_FOUND' });
    }

    const services = await customerService.getUpcomingServiceDates(customerId);
    return res.status(200).json({ success: true, services });
  } catch (error) {
    console.error('Get upcoming services error:', error);
    return res.status(500).json({ success: false, error: 'Internal server error', code: 'INTERNAL_ERROR' });
  }
});

/**
 * GET /api/customers/:customerId/selection-history
 * Get past selections
 */
router.get('/:customerId/selection-history', requireCustomer, async (req, res) => {
  try {
    const customerId = parseInt(req.params.customerId);

    const customer = await customerService.getCustomerById(customerId);
    if (!customer) {
      return res.status(404).json({ success: false, error: 'Customer not found', code: 'CUSTOMER_NOT_FOUND' });
    }

    const history = await customerService.getSelectionHistory(customerId);

    return res.status(200).json({
      success: true,
      history,
      total: history.length
    });
  } catch (error) {
    console.error('Get selection history error:', error);
    return res.status(500).json({ success: false, error: 'Internal server error', code: 'INTERNAL_ERROR' });
  }
});

/**
 * POST /api/customers/:customerId/feedback
 * Submit or update feedback (with up to 5 photos) for a completed service
 */
router.post('/:customerId/feedback', requireCustomer, (req, res) => {
  uploadFeedbackPhotos(req, res, async (err) => {
    if (err) {
      return res.status(400).json({ success: false, error: err.message, code: 'UPLOAD_ERROR' });
    }
    try {
      const customerId = parseInt(req.params.customerId);
      const { selectionCycleId, feedbackText } = req.body;
      const parsedCycleId = selectionCycleId ? parseInt(selectionCycleId) : null;
      const photoFilenames = (req.files || []).map(f => f.filename);

      const feedback = await customerService.submitFeedback(
        customerId, parsedCycleId, feedbackText || null, photoFilenames
      );

      return res.status(200).json({
        success: true,
        feedback: {
          id: feedback.id,
          feedbackText: feedback.feedback_text,
          photoFilenames: feedback.photo_filenames,
          createdAt: feedback.created_at
        }
      });
    } catch (error) {
      console.error('Submit feedback error:', error);
      return res.status(500).json({ success: false, error: 'Internal server error', code: 'INTERNAL_ERROR' });
    }
  });
});

/**
 * GET /api/customers/:customerId/feedback/:selectionCycleId
 * Get existing feedback for a selection cycle
 */
router.get('/:customerId/feedback/:selectionCycleId', requireCustomer, async (req, res) => {
  try {
    const customerId = parseInt(req.params.customerId);
    const selectionCycleId = parseInt(req.params.selectionCycleId);

    const feedback = await customerService.getFeedbackForCycle(customerId, selectionCycleId);

    return res.status(200).json({
      success: true,
      feedback: feedback ? {
        id: feedback.id,
        feedbackText: feedback.feedback_text,
        photoFilenames: feedback.photo_filenames,
        createdAt: feedback.created_at
      } : null
    });
  } catch (error) {
    console.error('Get feedback error:', error);
    return res.status(500).json({ success: false, error: 'Internal server error', code: 'INTERNAL_ERROR' });
  }
});

module.exports = router;
