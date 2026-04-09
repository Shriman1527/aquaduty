const mongoose = require('mongoose');

const dutyLogSchema = new mongoose.Schema(
  {
    // ── Which room this duty belongs to ───────────────
    roomId: {
      type:     mongoose.Schema.Types.ObjectId,
      ref:      'Room',
      required: true,
    },

    // ── Who is responsible for this duty ──────────────
    userId: {
      type:     mongoose.Schema.Types.ObjectId,
      ref:      'User',
      required: true,
    },

    // ── Timing ────────────────────────────────────────

    // When this duty was assigned (rotation advanced to this person)
    scheduledDate: {
      type:     Date,
      required: true,
    },

    // Deadline — if not done by this time it becomes overdue
    dueDate: {
      type:     Date,
      required: true,
    },

    // When the person actually marked it as done
    completedAt: {
      type:    Date,
      default: null,
    },

    // ── Status ────────────────────────────────────────
    // pending  → assigned, not yet done
    // done     → marked complete by the person (or admin)
    // skipped  → admin manually skipped this person's turn
    // overdue  → dueDate passed and still not done
    status: {
      type:    String,
      enum:    ['pending', 'done', 'skipped', 'overdue'],
      default: 'pending',
    },

    // ── Optional proof ────────────────────────────────
    // Person can upload a photo of the water they fetched
    photoUrl: {
      type:    String,
      default: null,
    },

    // Short note the person can add when marking done
    notes: {
      type:      String,
      maxlength: [300, 'Note cannot exceed 300 characters'],
      default:   '',
      trim:      true,
    },

    // ── Was it completed late? ────────────────────────
    // Calculated at the time of completion
    isLate: {
      type:    Boolean,
      default: false,
    },

    // ── Rotation tracking ─────────────────────────────

    // Which cycle number this duty belongs to
    // Cycle 0 = first round, Cycle 1 = second round, etc.
    cycleNumber: {
      type:    Number,
      default: 0,
    },

    // The index in rotationOrder when this duty was created
    rotationIndex: {
      type:     Number,
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

// ─── Indexes ──────────────────────────────────────────────────────────────────
// Most common queries we'll run:
dutyLogSchema.index({ roomId: 1, status: 1 });       // get pending duty for a room
dutyLogSchema.index({ roomId: 1, scheduledDate: -1 }); // get history for a room
dutyLogSchema.index({ userId: 1, status: 1 });       // get a user's duty history
dutyLogSchema.index({ dueDate: 1 });                 // find overdue duties (cron job later)

module.exports = mongoose.model('DutyLog', dutyLogSchema);