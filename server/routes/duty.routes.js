const express = require('express');
const router  = express.Router();

const dutyController = require('../controllers/duty.controller');
const { protect, requireVerified } = require('../middleware/auth');
const { completeDutyValidator }    = require('../middleware/validation');

// ─────────────────────────────────────────────────────────────────────────────
// All duty routes require login + verified email
// ─────────────────────────────────────────────────────────────────────────────
router.use(protect, requireVerified);

// Get the current pending duty for a room + who is next
router.get(
  '/room/:roomId/current',
  dutyController.getCurrentDuty
);

// Get paginated duty history + member stats for a room
// Supports: ?page=1&limit=15
router.get(
  '/room/:roomId/history',
  dutyController.getDutyHistory
);

// Mark a duty as complete
router.patch(
  '/:id/complete',
  completeDutyValidator,
  dutyController.completeDuty
);

// Skip a duty (admin only)
router.patch(
  '/:id/skip',
  dutyController.skipDuty
);

module.exports = router;