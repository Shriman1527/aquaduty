// const mongoose = require('mongoose');

// // ─── Sub-schema: one member inside a room ─────────────────────────────────────
// const memberSchema = new mongoose.Schema({
//   userId: {
//     type:     mongoose.Schema.Types.ObjectId,
//     ref:      'User',
//     required: true,
//   },
//   role: {
//     type:    String,
//     enum:    ['admin', 'member'],
//     default: 'member',
//   },
//   joinedAt: {
//     type:    Date,
//     default: Date.now,
//   },
//   vacationMode: {
//     type:    Boolean,
//     default: false,       // when true, this person is skipped in rotation
//   },
// });

// // ─── Main Room schema ─────────────────────────────────────────────────────────
// const roomSchema = new mongoose.Schema(
//   {
//     // ── Basic info ────────────────────────────────────
//     name: {
//       type:      String,
//       required:  [true, 'Room name is required'],
//       trim:      true,
//       maxlength: [60, 'Room name too long'],
//     },

//     hostelName: {
//       type:      String,
//       required:  [true, 'Hostel name is required'],
//       trim:      true,
//       maxlength: [80, 'Hostel name too long'],
//     },

//     roomNumber: {
//       type:      String,
//       required:  [true, 'Room number is required'],
//       trim:      true,
//       maxlength: [20, 'Room number too long'],
//     },

//     // ── Who created the room ──────────────────────────
//     adminId: {
//       type:     mongoose.Schema.Types.ObjectId,
//       ref:      'User',
//       required: true,
//     },

//     // ── All members (including admin) ─────────────────
//     members: {
//       type:     [memberSchema],
//       default:  [],
//       validate: {
//         validator: (v) => v.length <= 20,
//         message:   'A room cannot have more than 20 members',
//       },
//     },

//     // ── Invite code: short code like "AB12CD" ─────────
//     // Users can join by typing this code manually
//     inviteCode: {
//       type:   String,
//       unique: true,
//     },

//     // ── Rotation order: ordered array of user IDs ─────
//     // e.g. [userA, userB, userC] means A → B → C → A → ...
//     rotationOrder: [
//       {
//         type: mongoose.Schema.Types.ObjectId,
//         ref:  'User',
//       },
//     ],

//     // ── Which index in rotationOrder is currently active ──
//     currentIndex: {
//       type:    Number,
//       default: 0,
//     },

//     // ── How many full cycles have completed ───────────
//     cycleCount: {
//       type:    Number,
//       default: 0,
//     },

//     // ── How long each person has before duty is overdue ──
//     dutyFrequencyHours: {
//       type:    Number,
//       default: 24,   // 24 hours by default
//       min:     1,
//       max:     168,  // max 1 week
//     },

//     isActive: {
//       type:    Boolean,
//       default: true,
//     },
//   },
//   {
//     timestamps: true,
//   }
// );

// // ─── Indexes ──────────────────────────────────────────────────────────────────
// roomSchema.index({ inviteCode: 1 });
// roomSchema.index({ 'members.userId': 1 }); // fast lookup of "which rooms is this user in"
// roomSchema.index({ adminId: 1 });

// // ─── Pre-save: auto-generate invite code if not set ───────────────────────────
// roomSchema.pre('save', function (next) {
//   if (!this.inviteCode) {
//     this.inviteCode = generateCode();
//   }
//   next();
// });

// // ─── Helper: generate a 6-char random code ────────────────────────────────────
// // Avoids ambiguous characters like 0/O and 1/I
// function generateCode() {
//   const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
//   let code = '';
//   for (let i = 0; i < 6; i++) {
//     code += chars[Math.floor(Math.random() * chars.length)];
//   }
//   return code;
// }

// // ─── Instance methods ─────────────────────────────────────────────────────────

// // Check if a userId is a member of this room
// roomSchema.methods.isMember = function (userId) {
//   return this.members.some(
//     (m) => m.userId.toString() === userId.toString()
//   );
// };

// // Check if a userId is the admin of this room
// roomSchema.methods.isAdmin = function (userId) {
//   return this.adminId.toString() === userId.toString();
// };

// // Get the userId of whoever is currently on duty
// roomSchema.methods.getCurrentDutyUserId = function () {
//   if (this.rotationOrder.length === 0) return null;
//   return this.rotationOrder[this.currentIndex];
// };

// // Move to the next person in rotation
// roomSchema.methods.advanceRotation = function () {
//   if (this.rotationOrder.length === 0) return;

//   this.currentIndex = (this.currentIndex + 1) % this.rotationOrder.length;

//   // If we've looped back to the start, increment the cycle count
//   if (this.currentIndex === 0) {
//     this.cycleCount += 1;
//   }
// };

// module.exports = mongoose.model('Room', roomSchema);


const mongoose = require('mongoose');

// ─── Sub-schema: one member inside a room ─────────────────────────────────────
const memberSchema = new mongoose.Schema({
  userId: {
    type:     mongoose.Schema.Types.ObjectId,
    ref:      'User',
    required: true,
  },
  role: {
    type:    String,
    enum:    ['admin', 'member'],
    default: 'member',
  },
  joinedAt: {
    type:    Date,
    default: Date.now,
  },
  vacationMode: {
    type:    Boolean,
    default: false,       // when true, this person is skipped in rotation
  },
});

// ─── Main Room schema ─────────────────────────────────────────────────────────
const roomSchema = new mongoose.Schema(
  {
    // ── Basic info ────────────────────────────────────
    name: {
      type:      String,
      required:  [true, 'Room name is required'],
      trim:      true,
      maxlength: [60, 'Room name too long'],
    },

    hostelName: {
      type:      String,
      required:  [true, 'Hostel name is required'],
      trim:      true,
      maxlength: [80, 'Hostel name too long'],
    },

    roomNumber: {
      type:      String,
      required:  [true, 'Room number is required'],
      trim:      true,
      maxlength: [20, 'Room number too long'],
    },

    // ── Who created the room ──────────────────────────
    adminId: {
      type:     mongoose.Schema.Types.ObjectId,
      ref:      'User',
      required: true,
    },

    // ── All members (including admin) ─────────────────
    members: {
      type:     [memberSchema],
      default:  [],
      validate: {
        validator: (v) => v.length <= 20,
        message:   'A room cannot have more than 20 members',
      },
    },

    // ── Invite code: short code like "AB12CD" ─────────
    // Users can join by typing this code manually
    inviteCode: {
      type:   String,
      unique: true,
    },

    // ── Rotation order: ordered array of user IDs ─────
    // e.g. [userA, userB, userC] means A → B → C → A → ...
    rotationOrder: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref:  'User',
      },
    ],

    // ── Which index in rotationOrder is currently active ──
    currentIndex: {
      type:    Number,
      default: 0,
    },

    // ── How many full cycles have completed ───────────
    cycleCount: {
      type:    Number,
      default: 0,
    },

    // ── How long each person has before duty is overdue ──
    dutyFrequencyHours: {
      type:    Number,
      default: 24,   // 24 hours by default
      min:     1,
      max:     168,  // max 1 week
    },

    isActive: {
      type:    Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

// ─── Indexes ──────────────────────────────────────────────────────────────────
roomSchema.index({ 'members.userId': 1 }); // fast lookup of "which rooms is this user in"
roomSchema.index({ adminId: 1 });

// ─── Pre-save: auto-generate invite code if not set ───────────────────────────
roomSchema.pre('save', function (next) {
  if (!this.inviteCode) {
    this.inviteCode = generateCode();
  }
  next();
});

// ─── Helper: generate a 6-char random code ────────────────────────────────────
// Avoids ambiguous characters like 0/O and 1/I
function generateCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

// ─── Instance methods ─────────────────────────────────────────────────────────

// Check if a userId is a member of this room
// roomSchema.methods.isMember = function (userId) {
//     //below line is added by me 
//      if (!this.members || !userId) return false;
//   return this.members.some(
//     (m) => m.userId.toString() === userId.toString()
//   );
// };

roomSchema.methods.isMember = function (userId) {
  if (!this.members || !userId) return false;

  return this.members.some((m) =>
    m.userId._id
      ? m.userId._id.equals(userId)
      : m.userId.equals(userId)
  );
};

// Check if a userId is the admin of this room
roomSchema.methods.isAdmin = function (userId) {
  return this.adminId.toString() === userId.toString();
};

// Get the userId of whoever is currently on duty
roomSchema.methods.getCurrentDutyUserId = function () {
  if (this.rotationOrder.length === 0) return null;
  return this.rotationOrder[this.currentIndex];
};

// Move to the next person in rotation
roomSchema.methods.advanceRotation = function () {
  if (this.rotationOrder.length === 0) return;

  this.currentIndex = (this.currentIndex + 1) % this.rotationOrder.length;

  // If we've looped back to the start, increment the cycle count
  if (this.currentIndex === 0) {
    this.cycleCount += 1;
  }
};

module.exports = mongoose.model('Room', roomSchema);