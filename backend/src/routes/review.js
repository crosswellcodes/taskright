const express = require('express');
const router = express.Router();
const businessService = require('../services/businessService');

// No-auth review endpoints (no JWT) — same public pattern as /auth/selection/:token.
// See shared/specs/REVIEW_REQUESTS.md "API Surface".

/**
 * GET /api/review/:token
 * Return non-sensitive review context for the no-auth page.
 * Sets opened_at on first load. Returns { valid: false } for expired/missing tokens.
 */
router.get('/:token', async (req, res) => {
  try {
    const data = await businessService.getReviewByToken(req.params.token);
    return res.json({ success: true, ...data });
  } catch (error) {
    console.error('Review token lookup error:', error);
    return res.status(500).json({ success: false, error: 'Internal server error', code: 'INTERNAL_ERROR' });
  }
});

/**
 * POST /api/review/:token
 * Body: { rating: 1–5, comment?: string }
 * Writes a feedbacks row (source='sms_request'), sets submitted_at.
 * Idempotent (Rule 5); rejects expired (Rule 4).
 */
router.post('/:token', async (req, res) => {
  try {
    const { rating, comment } = req.body;
    const result = await businessService.submitReviewByToken(req.params.token, { rating, comment });
    return res.json({ success: true, ...result });
  } catch (error) {
    if (error.code === 'INVALID_TOKEN') return res.status(404).json({ success: false, error: error.message, code: 'INVALID_TOKEN' });
    if (error.code === 'EXPIRED_TOKEN') return res.status(410).json({ success: false, error: error.message, code: 'EXPIRED_TOKEN' });
    if (error.code === 'VALIDATION_ERROR') return res.status(400).json({ success: false, error: error.message, code: 'VALIDATION_ERROR' });
    console.error('Review submit error:', error);
    return res.status(500).json({ success: false, error: 'Internal server error', code: 'INTERNAL_ERROR' });
  }
});

module.exports = router;
