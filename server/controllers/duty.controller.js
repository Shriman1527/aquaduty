const DutyLog = require('../models/DutyLog');
const Room    = require('../models/Room');
const User    = require('../models/User');
const { createDutyLog } = require('./room.controller');

// ─── GET CURRENT DUTY ─────────────────────────────────────────────────────────
// GET /api/duty/room/:roomId/current
exports.getCurrentDuty = async (req, res, next) => {
  try {
    const { roomId } = req.params;

    // Confirm room exists and user is a member
    const room = await Room.findById(roomId);
    if (!room) {
      return res.status(404).json({ success: false, message: 'Room not found.' });
    }
    if (!room.isMember(req.user._id)) {
      return res.status(403).json({ success: false, message: 'Access denied.' });
    }

    // Get the active pending duty
    const currentDuty = await DutyLog.findOne({
      roomId,
      status: 'pending',
    })
      .populate('userId', 'name email avatar')
      .sort({ scheduledDate: 1 });

    // Also find who is NEXT in the queue (useful for the UI)
    let nextPerson = null;
    if (room.rotationOrder.length > 1) {
      const nextIndex = (room.currentIndex + 1) % room.rotationOrder.length;
      nextPerson = await User.findById(room.rotationOrder[nextIndex])
        .select('name email avatar');
    }

    res.json({
      success: true,
      data:    { currentDuty, nextPerson },
    });

  } catch (err) {
    next(err);
  }
};

// ─── MARK DUTY AS COMPLETE ────────────────────────────────────────────────────
// PATCH /api/duty/:id/complete
exports.completeDuty = async (req, res, next) => {
  try {
    const { id }    = req.params;
    const { notes } = req.body;

    // 1. Find the duty log
    const duty = await DutyLog.findById(id)
      .populate('userId', 'name email avatar');

    if (!duty) {
      return res.status(404).json({ success: false, message: 'Duty not found.' });
    }

    // 2. Find the room
    const room = await Room.findById(duty.roomId);
    if (!room) {
      return res.status(404).json({ success: false, message: 'Room not found.' });
    }

    // 3. Check requesting user is in this room
    if (!room.isMember(req.user._id)) {
      return res.status(403).json({ success: false, message: 'Access denied.' });
    }

    // 4. Only the person on duty OR the admin can mark it done
    const isPersonOnDuty = duty.userId._id.toString() === req.user._id.toString();
    const isAdmin        = room.isAdmin(req.user._id);

    if (!isPersonOnDuty && !isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Only the person on duty or the room admin can mark this as done.',
      });
    }

    // 5. Make sure it is still pending
    if (duty.status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: `This duty is already marked as "${duty.status}".`,
      });
    }

    // 6. Mark as done
    const now       = new Date();
    duty.status      = 'done';
    duty.completedAt = now;
    duty.notes       = notes || '';
    duty.isLate      = now > duty.dueDate; // was it completed after the deadline?
    await duty.save();

    // 7. Advance rotation to next person
    room.advanceRotation();
    await room.save();

    // 8. Create a new duty log for the next person
    const nextUserId = room.rotationOrder[room.currentIndex];
    const nextDuty   = await createDutyLog(room, nextUserId);
    const nextUser   = await User.findById(nextUserId).select('name email avatar');

    // 9. Notify all room members via socket
    const io = req.app.get('io');

    io.to(`room:${room._id}`).emit('duty:completed', {
      completedDuty: duty,
      completedBy:   { _id: req.user._id, name: req.user.name },
    });

    io.to(`room:${room._id}`).emit('duty:advanced', {
      nextDuty,
      nextUser,
      currentIndex: room.currentIndex,
      cycleCount:   room.cycleCount,
    });

    res.json({
      success: true,
      message: `Duty marked as done! ${nextUser?.name || 'Next person'} is up next.`,
      data:    { duty, nextUser, nextDuty },
    });

  } catch (err) {
    next(err);
  }
};

// ─── SKIP DUTY ────────────────────────────────────────────────────────────────
// PATCH /api/duty/:id/skip
// Admin only — skips the current person and moves to next
exports.skipDuty = async (req, res, next) => {
  try {
    const { id }     = req.params;
    const { reason } = req.body;

    const duty = await DutyLog.findById(id);
    if (!duty) {
      return res.status(404).json({ success: false, message: 'Duty not found.' });
    }

    const room = await Room.findById(duty.roomId);
    if (!room) {
      return res.status(404).json({ success: false, message: 'Room not found.' });
    }

    // Only admin can skip
    if (!room.isAdmin(req.user._id)) {
      return res.status(403).json({
        success: false,
        message: 'Only the room admin can skip a duty.',
      });
    }

    if (duty.status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: `This duty is already "${duty.status}". Cannot skip.`,
      });
    }

    // Mark current duty as skipped
    duty.status      = 'skipped';
    duty.completedAt = new Date();
    duty.notes       = reason || 'Skipped by admin';
    await duty.save();

    // Advance to next person
    room.advanceRotation();
    await room.save();

    // Create duty log for next person
    const nextUserId = room.rotationOrder[room.currentIndex];
    const nextDuty   = await createDutyLog(room, nextUserId);
    const nextUser   = await User.findById(nextUserId).select('name email avatar');

    // Notify via socket
    const io = req.app.get('io');
    io.to(`room:${room._id}`).emit('duty:advanced', {
      nextDuty,
      nextUser,
      currentIndex: room.currentIndex,
    });

    res.json({
      success: true,
      message: `Duty skipped. ${nextUser?.name} is now on duty.`,
      data:    { nextUser, nextDuty },
    });

  } catch (err) {
    next(err);
  }
};

// ─── GET DUTY HISTORY ─────────────────────────────────────────────────────────
// GET /api/duty/room/:roomId/history
exports.getDutyHistory = async (req, res, next) => {
  try {
    const { roomId } = req.params;
    const page       = parseInt(req.query.page)  || 1;
    const limit      = parseInt(req.query.limit) || 15;
    const skip       = (page - 1) * limit;

    // Confirm membership
    const room = await Room.findById(roomId);
    if (!room || !room.isMember(req.user._id)) {
      return res.status(403).json({ success: false, message: 'Access denied.' });
    }

    // Get paginated duty history
    const [logs, total] = await Promise.all([
      DutyLog.find({ roomId })
        .populate('userId', 'name email avatar')
        .sort({ scheduledDate: -1 })
        .skip(skip)
        .limit(limit),

      DutyLog.countDocuments({ roomId }),
    ]);

    // Per-member stats using MongoDB aggregation
    const memberStats = await DutyLog.aggregate([
      { $match: { roomId: room._id } },
      {
        $group: {
          _id:     '$userId',
          total:   { $sum: 1 },
          done:    { $sum: { $cond: [{ $eq: ['$status', 'done']    }, 1, 0] } },
          skipped: { $sum: { $cond: [{ $eq: ['$status', 'skipped'] }, 1, 0] } },
          late:    { $sum: { $cond: ['$isLate', 1, 0] } },
        },
      },
    ]);

    res.json({
      success: true,
      data: {
        logs,
        memberStats,
        pagination: {
          total,
          page,
          limit,
          pages: Math.ceil(total / limit),
          hasMore: page < Math.ceil(total / limit),
        },
      },
    });

  } catch (err) {
    next(err);
  }
};