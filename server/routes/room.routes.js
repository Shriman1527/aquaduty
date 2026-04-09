const express = require('express');
const router  = express.Router();

const roomController = require('../controllers/room.controller');
const { protect, requireVerified } = require('../middleware/auth');
const {
  createRoomValidator,
  joinByCodeValidator,
  inviteValidator,
} = require('../middleware/validation');

// ─────────────────────────────────────────────────────────────────────────────
// All room routes require:
//   1. protect        → user must be logged in
//   2. requireVerified → user must have verified their email
// ─────────────────────────────────────────────────────────────────────────────
router.use(protect, requireVerified);

// ─── Room CRUD ────────────────────────────────────────────────────────────────

// Get all rooms the current user belongs to
router.get(
  '/',
  roomController.getMyRooms
);

// Create a new room
router.post(
  '/',
  createRoomValidator,
  roomController.createRoom
);

// Get a single room by ID (with current duty + recent history)
router.get(
  '/:id',
  roomController.getRoom
);

// ─── Invite ───────────────────────────────────────────────────────────────────

// Generate an invite link / get the room invite code
router.post(
  '/:id/invite',
  inviteValidator,
  roomController.generateInvite
);

// ─── Join ─────────────────────────────────────────────────────────────────────

// Join a room by typing the 6-char invite code
// NOTE: this route must come BEFORE /:id routes
// otherwise Express would treat "join" as a room ID
router.post(
  '/join/code',
  joinByCodeValidator,
  roomController.joinByCode
);

// ─── Admin actions ────────────────────────────────────────────────────────────



// Delete the entire room and all its data (admin only)
router.delete(
  '/:id',
  roomController.deleteRoom
);
// Reshuffle the rotation order (admin only)
router.patch(
  '/:id/shuffle',
  roomController.shuffleRotation
);

// Remove a member from the room (admin only)
router.delete(
  '/:id/members/:memberId',
  roomController.removeMember
);

module.exports = router;