const express = require('express');
const router = express.Router();
const { authenticate, requireTeamMember } = require('../middleware/auth');
const businessService = require('../services/businessService');

const VALID_EVENT_TYPES = new Set(['arrival', 'departure']);
const VALID_METHODS = new Set(['auto', 'manual']);

// All team member routes require a valid JWT
router.use(authenticate);

/**
 * GET /api/team-members/:teamMemberId/jobs
 * List all upcoming assigned jobs for this team member
 */
router.get('/:teamMemberId/jobs', requireTeamMember, async (req, res) => {
  try {
    const teamMemberId = parseInt(req.params.teamMemberId);
    const jobs = await businessService.getJobsForTeamMember(teamMemberId);

    return res.status(200).json({
      success: true,
      jobs: jobs.map(j => ({
        selectionCycleId: j.selectionCycleId,
        serviceDate: j.serviceDate,
        submissionDeadline: j.submissionDeadline,
        status: j.status,
        customerId: j.customerId,
        customerName: j.customerName,
        customerAddress: j.customerAddress || null,
        serviceCycleName: j.serviceCycleName,
        selectedTasks: j.selectedTasks || [],
        selectionStatus: j.selectionStatus || null,
        isTeamAssigned: !!j.isTeamAssigned,
        teamName: j.teamName || null,
        autoTrackable: !!j.autoTrackable,
      })),
    });
  } catch (error) {
    console.error('Get team member jobs error:', error);
    return res.status(500).json({ success: false, error: 'Internal server error', code: 'INTERNAL_ERROR' });
  }
});

/**
 * GET /api/team-members/:teamMemberId/active-clock
 * The member's currently-open clock-in (if any), derived read-only from
 * geofence_events: the latest event for a (member, cycle) being an `arrival`
 * with no later `departure`. Returns { activeClock: {...} | null }. Powers the
 * cross-screen "you're clocked in" banner (Tier C).
 */
router.get('/:teamMemberId/active-clock', requireTeamMember, async (req, res) => {
  try {
    const teamMemberId = parseInt(req.params.teamMemberId);
    const active = await businessService.getActiveClockForTeamMember(teamMemberId);
    return res.status(200).json({
      success: true,
      activeClock: active
        ? {
            selectionCycleId: active.selectionCycleId,
            customerId: active.customerId,
            customerName: active.customerName,
            arrivalAt: active.arrivalAt,
          }
        : null,
    });
  } catch (error) {
    console.error('Get active clock error:', error);
    return res.status(500).json({ success: false, error: 'Internal server error', code: 'INTERNAL_ERROR' });
  }
});

/**
 * GET /api/team-members/:teamMemberId/jobs/:selectionCycleId
 * Get full detail for a single assigned job
 */
router.get('/:teamMemberId/jobs/:selectionCycleId', requireTeamMember, async (req, res) => {
  try {
    const teamMemberId = parseInt(req.params.teamMemberId);
    const selectionCycleId = parseInt(req.params.selectionCycleId);
    const job = await businessService.getJobDetail(teamMemberId, selectionCycleId);

    if (!job) {
      return res.status(404).json({ success: false, error: 'Job not found', code: 'NOT_FOUND' });
    }

    return res.status(200).json({
      success: true,
      job: {
        selectionCycleId: job.selectionCycleId,
        serviceDate: job.serviceDate,
        submissionDeadline: job.submissionDeadline,
        status: job.status,
        customerId: job.customerId,
        customerName: job.customerName,
        customerPhone: job.customerPhone,
        customerAddress: job.customerAddress || null,
        customerNotes: job.customerNotes || null,
        customerNote: job.customerNote || null,
        customerLat: job.customerLat != null ? parseFloat(job.customerLat) : null,
        customerLng: job.customerLng != null ? parseFloat(job.customerLng) : null,
        serviceCycleName: job.serviceCycleName,
        selectedTasks: job.selectedTasks || [],
        selectionStatus: job.selectionStatus || null,
        completedAt: job.completedAt || null,
        completionNotes: job.completionNotes || null,
      },
    });
  } catch (error) {
    if (error.code === 'NOT_FOUND') {
      return res.status(404).json({ success: false, error: error.message, code: 'NOT_FOUND' });
    }
    console.error('Get job detail error:', error);
    return res.status(500).json({ success: false, error: 'Internal server error', code: 'INTERNAL_ERROR' });
  }
});

/**
 * PATCH /api/team-members/:teamMemberId/jobs/:selectionCycleId/complete
 * Team member marks a job as complete
 */
router.patch('/:teamMemberId/jobs/:selectionCycleId/complete', requireTeamMember, async (req, res) => {
  try {
    const teamMemberId = parseInt(req.params.teamMemberId);
    const selectionCycleId = parseInt(req.params.selectionCycleId);
    const { notes } = req.body;

    const completion = await businessService.completeJobForTeamMember(teamMemberId, selectionCycleId, notes);

    return res.status(200).json({
      success: true,
      completion: {
        selectionCycleId,
        completedAt: completion.completed_at,
        notes: completion.notes || null,
      },
    });
  } catch (error) {
    if (error.code === 'NOT_FOUND') {
      return res.status(404).json({ success: false, error: error.message, code: 'NOT_FOUND' });
    }
    if (error.code === 'ALREADY_COMPLETED') {
      return res.status(409).json({ success: false, error: error.message, code: 'ALREADY_COMPLETED' });
    }
    console.error('Complete job error:', error);
    return res.status(500).json({ success: false, error: 'Internal server error', code: 'INTERNAL_ERROR' });
  }
});

/**
 * POST /api/team-members/:teamMemberId/jobs/:selectionCycleId/geofence
 * Record an arrival or departure geo-fence event. Departure auto-creates a labor cost line.
 */
router.post('/:teamMemberId/jobs/:selectionCycleId/geofence', requireTeamMember, async (req, res) => {
  try {
    const teamMemberId = parseInt(req.params.teamMemberId);
    const selectionCycleId = parseInt(req.params.selectionCycleId);
    const { eventType, occurredAt, lat, lng, method } = req.body;

    if (!VALID_EVENT_TYPES.has(eventType)) {
      return res.status(400).json({ success: false, error: 'eventType must be arrival or departure', code: 'VALIDATION_ERROR' });
    }
    if (!VALID_METHODS.has(method)) {
      return res.status(400).json({ success: false, error: 'method must be auto or manual', code: 'VALIDATION_ERROR' });
    }
    if (!occurredAt) {
      return res.status(400).json({ success: false, error: 'occurredAt is required', code: 'VALIDATION_ERROR' });
    }

    // Coordinates: auto events must carry a valid numeric fix. Manual events
    // (clock-in/out) may omit them when no GPS fix is available — stored as null
    // rather than a fake 0,0. When present, they must parse to real numbers so a
    // bad string can't reach PostgreSQL and 500 (NaN is rejected by decimal cols).
    let parsedLat = null;
    let parsedLng = null;
    const hasCoords = lat != null && lng != null;
    if (hasCoords) {
      parsedLat = parseFloat(lat);
      parsedLng = parseFloat(lng);
      if (Number.isNaN(parsedLat) || Number.isNaN(parsedLng)) {
        return res.status(400).json({ success: false, error: 'lat and lng must be valid numbers', code: 'VALIDATION_ERROR' });
      }
    } else if (method === 'auto') {
      return res.status(400).json({ success: false, error: 'lat and lng are required for auto events', code: 'VALIDATION_ERROR' });
    }

    const result = await businessService.recordGeofenceEvent(teamMemberId, selectionCycleId, {
      eventType, occurredAt, lat: parsedLat, lng: parsedLng, method,
    });

    return res.status(200).json({ success: true, data: result });
  } catch (error) {
    if (error.code === 'NOT_FOUND') {
      return res.status(404).json({ success: false, error: error.message, code: 'NOT_FOUND' });
    }
    console.error('Geofence event error:', error);
    return res.status(500).json({ success: false, error: 'Internal server error', code: 'INTERNAL_ERROR' });
  }
});

module.exports = router;
