const crypto  = require('crypto');
const Room    = require('../models/Room');
const DutyLog = require('../models/DutyLog');
const User    = require('../models/User');

// ─── Helper: shuffle array (Fisher-Yates algorithm) ───────────────────────────
// Server-side only — client can never manipulate the order
const shuffleArray = (array) => {
  const arr = [...array]; // clone so original is not mutated
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
};

// ─── Helper: create a duty log for the current person ────────────────────────
// Called every time rotation advances to next person
const createDutyLog = async (room, userId) => {
  const now     = new Date();
  const dueDate = new Date(
    now.getTime() + (room.dutyFrequencyHours || 24) * 60 * 60 * 1000
  );

  return DutyLog.create({
    roomId:        room._id,
    userId,
    scheduledDate: now,
    dueDate,
    status:        'pending',
    cycleNumber:   room.cycleCount,
    rotationIndex: room.currentIndex,
  });
};

// ─── CREATE ROOM ──────────────────────────────────────────────────────────────
// POST /api/rooms
exports.createRoom = async (req, res, next) => {
  try {
    const { name, hostelName, roomNumber, dutyFrequencyHours } = req.body;
    const userId = req.user._id;

    // 1. Create the room with creator as admin
    const room = new Room({
      name,
      hostelName,
      roomNumber,
      dutyFrequencyHours: dutyFrequencyHours || 24,
      adminId:            userId,
      members:            [{ userId, role: 'admin' }],
      rotationOrder:      [userId],
      currentIndex:       0,
      cycleCount:         0,
    });

    await room.save();

    // 2. Create the first duty log for the creator
    await createDutyLog(room, userId);

    // 3. Return populated room data
    const populated = await Room.findById(room._id)
      .populate('members.userId',  'name email avatar')
      .populate('rotationOrder',   'name email avatar')
      .populate('adminId',         'name email');

    res.status(201).json({
      success: true,
      message: `Room "${name}" created successfully!`,
      data:    { room: populated },
    });

  } catch (err) {
    next(err);
  }
};

// ─── GET ALL MY ROOMS ─────────────────────────────────────────────────────────
// GET /api/rooms
exports.getMyRooms = async (req, res, next) => {
  try {
    // Find all active rooms where this user is a member
    const rooms = await Room.find({
      'members.userId': req.user._id,
      isActive:         true,
    })
      .populate('members.userId', 'name email avatar')
      .populate('adminId',        'name email')
      .sort({ updatedAt: -1 });

    // Attach the current pending duty for each room
    const roomsWithDuty = await Promise.all(
      rooms.map(async (room) => {
        const currentDuty = await DutyLog.findOne({
          roomId: room._id,
          status: 'pending',
        }).populate('userId', 'name email avatar');

        return { ...room.toObject(), currentDuty };
      })
    );

    res.json({
      success: true,
      data:    { rooms: roomsWithDuty },
    });

  } catch (err) {
    next(err);
  }
};

// ─── GET SINGLE ROOM ──────────────────────────────────────────────────────────
// GET /api/rooms/:id
exports.getRoom = async (req, res, next) => {
  try {
    const room = await Room.findById(req.params.id)
      .populate('members.userId',  'name email avatar')
      .populate('rotationOrder',   'name email avatar')
      .populate('adminId',         'name email avatar');

    if (!room) {
      return res.status(404).json({
        success: false,
        message: 'Room not found.',
      });
    }

    // Make sure the requesting user is actually in this room
    if (!room.isMember(req.user._id)) {
      return res.status(403).json({
        success: false,
        message: 'You are not a member of this room.',
      });
    }

    // Get the current pending duty
    const currentDuty = await DutyLog.findOne({
      roomId: room._id,
      status: 'pending',
    })
      .populate('userId', 'name email avatar')
      .sort({ scheduledDate: 1 });

    // Get last 10 completed/skipped duties for the history tab
    const recentHistory = await DutyLog.find({
      roomId: room._id,
      status: { $in: ['done', 'skipped'] },
    })
      .populate('userId', 'name email avatar')
      .sort({ completedAt: -1 })
      .limit(10);

    res.json({
      success: true,
      data:    { room, currentDuty, recentHistory },
    });

  } catch (err) {
    next(err);
  }
};

// ─── GENERATE INVITE LINK ─────────────────────────────────────────────────────
// POST /api/rooms/:id/invite
exports.generateInvite = async (req, res, next) => {
  try {
    const room = await Room.findById(req.params.id);

    if (!room) {
      return res.status(404).json({ success: false, message: 'Room not found.' });
    }

    // Only admin can generate invite links
    if (!room.isAdmin(req.user._id)) {
      return res.status(403).json({
        success: false,
        message: 'Only the room admin can generate invite links.',
      });
    }

    if (room.members.length >= 20) {
      return res.status(400).json({
        success: false,
        message: 'Room is full. Maximum 20 members allowed.',
      });
    }

    // Generate a secure random token for the invite link
    const inviteToken = crypto.randomBytes(32).toString('hex');

    // Store it temporarily on the room (expires in 7 days)
    // Full Invite model comes in Phase 2 — for now we use the room's inviteCode
    const inviteLink = `${process.env.CLIENT_URL}/join/${inviteToken}`;

    res.json({
      success: true,
      message: 'Invite link generated.',
      data: {
        inviteLink,
        inviteCode: room.inviteCode, // 6-char code for manual entry
      },
    });

  } catch (err) {
    next(err);
  }
};

// ─── JOIN ROOM BY CODE ────────────────────────────────────────────────────────
// POST /api/rooms/join/code
exports.joinByCode = async (req, res, next) => {
  try {
    const { code }  = req.body;
    const userId    = req.user._id;

    // Find the room with this invite code
    const room = await Room.findOne({
      inviteCode: code.toUpperCase(),
      isActive:   true,
    });

    if (!room) {
      return res.status(404).json({
        success: false,
        message: 'No room found with this invite code.',
      });
    }

    // Check not already a member
    if (room.isMember(userId)) {
      return res.status(400).json({
        success: false,
        message: 'You are already a member of this room.',
      });
    }

    // Check room is not full
    if (room.members.length >= 20) {
      return res.status(400).json({
        success: false,
        message: 'This room is full.',
      });
    }

    // Add user to members and rotation order
    room.members.push({ userId, role: 'member' });
    room.rotationOrder.push(userId);
    await room.save();

    // Emit socket event to all room members
    const io   = req.app.get('io');
    const user = await User.findById(userId).select('name email avatar');
    io.to(`room:${room._id}`).emit('member:joined', {
      user:   { _id: user._id, name: user.name, avatar: user.avatar },
      roomId: room._id,
    });

    // Return the updated populated room
    const populated = await Room.findById(room._id)
      .populate('members.userId',  'name email avatar')
      .populate('rotationOrder',   'name email avatar')
      .populate('adminId',         'name email');

    res.json({
      success: true,
      message: `You joined "${room.name}" successfully!`,
      data:    { room: populated },
    });

  } catch (err) {
    next(err);
  }
};

// ─── SHUFFLE ROTATION ─────────────────────────────────────────────────────────
// PATCH /api/rooms/:id/shuffle
exports.shuffleRotation = async (req, res, next) => {
  try {
    const room = await Room.findById(req.params.id);

    if (!room) {
      return res.status(404).json({ success: false, message: 'Room not found.' });
    }

    if (!room.isAdmin(req.user._id)) {
      return res.status(403).json({
        success: false,
        message: 'Only the room admin can shuffle the rotation.',
      });
    }

    // Shuffle all active (non-vacation) members
    const activeMembers = room.members
      .filter((m) => !m.vacationMode)
      .map((m) => m.userId);

    room.rotationOrder = shuffleArray(activeMembers);
    room.currentIndex  = 0;
    room.cycleCount    = 0;
    await room.save();

    // Cancel any existing pending duty and create a fresh one
    await DutyLog.updateMany(
      { roomId: room._id, status: 'pending' },
      { status: 'skipped', notes: 'Rotation reshuffled by admin' }
    );

    await createDutyLog(room, room.rotationOrder[0]);

    // Notify all room members via socket
    const io        = req.app.get('io');
    const populated = await Room.findById(room._id)
      .populate('rotationOrder', 'name email avatar');

    io.to(`room:${room._id}`).emit('rotation:updated', {
      rotationOrder: populated.rotationOrder,
      currentIndex:  0,
    });

    res.json({
      success: true,
      message: 'Rotation reshuffled successfully!',
      data:    { room: populated },
    });

  } catch (err) {
    next(err);
  }
};

// ─── REMOVE MEMBER ────────────────────────────────────────────────────────────
// DELETE /api/rooms/:id/members/:memberId
exports.removeMember = async (req, res, next) => {
  try {
    const { id, memberId } = req.params;
    const room = await Room.findById(id);

    if (!room) {
      return res.status(404).json({ success: false, message: 'Room not found.' });
    }

    if (!room.isAdmin(req.user._id)) {
      return res.status(403).json({
        success: false,
        message: 'Only the room admin can remove members.',
      });
    }

    // Admin cannot remove themselves
    if (memberId === req.user._id.toString()) {
      return res.status(400).json({
        success: false,
        message: 'Admin cannot remove themselves from the room.',
      });
    }

    if (!room.isMember(memberId)) {
      return res.status(404).json({
        success: false,
        message: 'This user is not a member of the room.',
      });
    }

    // Remove from members array and rotation order
    room.members       = room.members.filter(
      (m) => m.userId.toString() !== memberId
    );
    room.rotationOrder = room.rotationOrder.filter(
      (id) => id.toString() !== memberId
    );

    // Fix currentIndex if it now points beyond the array
    if (room.currentIndex >= room.rotationOrder.length) {
      room.currentIndex = 0;
    }

    await room.save();

    // Notify room via socket
    const io = req.app.get('io');
    io.to(`room:${room._id}`).emit('member:removed', { userId: memberId });

    res.json({
      success: true,
      message: 'Member removed from room.',
    });

  } catch (err) {
    next(err);
  }
};


// ─── DELETE ROOM (CASCADE) ────────────────────────────────────────────────────
// DELETE /api/rooms/:id
exports.deleteRoom = async (req, res, next) => {
  try {
    const room = await Room.findById(req.params.id);

    if (!room) {
      return res.status(404).json({ success: false, message: 'Room not found.' });
    }

    // Security Check: Only the admin can delete the entire room
    if (!room.isAdmin(req.user._id)) {
      return res.status(403).json({
        success: false,
        message: 'Only the room admin can permanently delete this room.',
      });
    }

    // 1. Cascade Delete: Destroy all duty logs associated with this room
    await DutyLog.deleteMany({ roomId: room._id });

    // 2. Destroy the room itself
    await room.deleteOne();

    // 3. Notify everyone currently viewing the room so their UI can redirect
    const io = req.app.get('io');
    io.to(`room:${room._id}`).emit('room:deleted');

    res.json({
      success: true,
      message: 'Room and all history permanently deleted.',
    });

  } catch (err) {
    next(err);
  }
};

// Export createDutyLog so duty controller can use it too
exports.createDutyLog = createDutyLog;