// const mongoose = require('mongoose');
// const bcrypt   = require('bcryptjs');
// const crypto   = require('crypto');

// const userSchema = new mongoose.Schema(
//   {
//     // ── Basic info ──────────────────────────────────────
//     name: {
//       type:      String,
//       required:  [true, 'Name is required'],
//       trim:      true,
//       minlength: [2,  'Name must be at least 2 characters'],
//       maxlength: [50, 'Name cannot exceed 50 characters'],
//     },

//     email: {
//       type:      String,
//       required:  [true, 'Email is required'],
//       unique:    true,
//       lowercase: true,
//       trim:      true,
//       match:     [/^\S+@\S+\.\S+$/, 'Please provide a valid email'],
//     },

//     // select: false → password is NEVER returned in queries unless you explicitly ask
//     password: {
//       type:      String,
//       required:  [true, 'Password is required'],
//       minlength: [8, 'Password must be at least 8 characters'],
//       select:    false,
//     },

//     avatar: {
//       type:    String,
//       default: null,
//     },

//     // ── Email verification ──────────────────────────────
//     isEmailVerified: {
//       type:    Boolean,
//       default: false,
//     },

//     emailVerificationToken: {
//       type:   String,
//       select: false,   // hidden from normal queries
//     },

//     emailVerificationExpires: {
//       type:   Date,
//       select: false,
//     },

//     // ── Password reset ──────────────────────────────────
//     passwordResetToken: {
//       type:   String,
//       select: false,
//     },

//     passwordResetExpires: {
//       type:   Date,
//       select: false,
//     },

//     // ── Refresh tokens (array so user can be logged in on multiple devices) ──
//     refreshTokens: {
//       type: [
//         {
//           token:     { type: String, required: true },
//           createdAt: { type: Date,   default: Date.now },
//           expiresAt: { type: Date,   required: true },
//         },
//       ],
//       select: false,   // hidden from normal queries
//       default: [],
//     },

//     lastLogin: {
//       type:    Date,
//       default: null,
//     },
//   },
//   {
//     timestamps: true, // adds createdAt and updatedAt automatically
//   }
// );

// // ─── Indexes ──────────────────────────────────────────────────────────────────
// // Speeds up lookup by email (used every login)
// userSchema.index({ email: 1 });

// // ─── Pre-save hook: hash password before saving ───────────────────────────────
// userSchema.pre('save', async function (next) {
//   // Only hash if password was actually changed
//   if (!this.isModified('password')) return next();

//   const salt   = await bcrypt.genSalt(12); // 12 rounds = strong but not too slow
//   this.password = await bcrypt.hash(this.password, salt);
//   next();
// });

// // ─── Instance method: compare password at login ───────────────────────────────
// userSchema.methods.comparePassword = async function (candidatePassword) {
//   return bcrypt.compare(candidatePassword, this.password);
// };

// // ─── Instance method: generate email verification token ───────────────────────
// // Returns the raw token (sent in email link)
// // Saves the hashed version in DB (so if DB is leaked, token is useless)
// userSchema.methods.createEmailVerificationToken = function () {
//   const rawToken    = crypto.randomBytes(32).toString('hex');
//   this.emailVerificationToken   = crypto.createHash('sha256').update(rawToken).digest('hex');
//   this.emailVerificationExpires = Date.now() + 24 * 60 * 60 * 1000; // 24 hours
//   return rawToken;
// };

// // ─── Instance method: generate password reset token ───────────────────────────
// userSchema.methods.createPasswordResetToken = function () {
//   const rawToken           = crypto.randomBytes(32).toString('hex');
//   this.passwordResetToken   = crypto.createHash('sha256').update(rawToken).digest('hex');
//   this.passwordResetExpires = Date.now() + 10 * 60 * 1000; // 10 minutes only
//   return rawToken;
// };

// // ─── Instance method: remove expired refresh tokens ───────────────────────────
// userSchema.methods.cleanExpiredTokens = function () {
//   const now            = new Date();
//   this.refreshTokens   = (this.refreshTokens || []).filter(
//     (t) => new Date(t.expiresAt) > now
//   );
// };

// // ─── Instance method: safe user object (no secrets) ───────────────────────────
// // Use this whenever sending user data in API responses
// userSchema.methods.toSafeObject = function () {
//   return {
//     _id:             this._id,
//     name:            this.name,
//     email:           this.email,
//     avatar:          this.avatar,
//     isEmailVerified: this.isEmailVerified,
//     lastLogin:       this.lastLogin,
//     createdAt:       this.createdAt,
//   };
// };

// module.exports = mongoose.model('User', userSchema);

const mongoose = require('mongoose');
const bcrypt   = require('bcryptjs');
const crypto   = require('crypto');

const userSchema = new mongoose.Schema(
  {
    // ── Basic info ──────────────────────────────────────
    name: {
      type:      String,
      required:  [true, 'Name is required'],
      trim:      true,
      minlength: [2,  'Name must be at least 2 characters'],
      maxlength: [50, 'Name cannot exceed 50 characters'],
    },

    email: {
      type:      String,
      required:  [true, 'Email is required'],
      unique:    true,
      lowercase: true,
      trim:      true,
      match:     [/^\S+@\S+\.\S+$/, 'Please provide a valid email'],
    },

    // select: false → password is NEVER returned in queries unless you explicitly ask
    password: {
      type:      String,
      required:  [true, 'Password is required'],
      minlength: [8, 'Password must be at least 8 characters'],
      select:    false,
    },

    avatar: {
      type:    String,
      default: null,
    },

    // ── Email verification ──────────────────────────────
    isEmailVerified: {
      type:    Boolean,
      default: false,
    },

    emailVerificationToken: {
      type:   String,
      select: false,   // hidden from normal queries
    },

    emailVerificationExpires: {
      type:   Date,
      select: false,
    },

    // ── Password reset ──────────────────────────────────
    passwordResetToken: {
      type:   String,
      select: false,
    },

    passwordResetExpires: {
      type:   Date,
      select: false,
    },

    // ── Refresh tokens (array so user can be logged in on multiple devices) ──
    refreshTokens: {
      type: [
        {
          token:     { type: String, required: true },
          createdAt: { type: Date,   default: Date.now },
          expiresAt: { type: Date,   required: true },
        },
      ],
      select: false,   // hidden from normal queries
      default: [],
    },

    lastLogin: {
      type:    Date,
      default: null,
    },
  },
  {
    timestamps: true, // adds createdAt and updatedAt automatically
  }
);

// ─── Indexes ──────────────────────────────────────────────────────────────────

// ─── Pre-save hook: hash password before saving ───────────────────────────────
userSchema.pre('save', async function (next) {
  // Only hash if password was actually changed
  if (!this.isModified('password')) return next();

  const salt   = await bcrypt.genSalt(12); // 12 rounds = strong but not too slow
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

// ─── Instance method: compare password at login ───────────────────────────────
userSchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

// ─── Instance method: generate email verification token ───────────────────────
// Returns the raw token (sent in email link)
// Saves the hashed version in DB (so if DB is leaked, token is useless)
userSchema.methods.createEmailVerificationToken = function () {
  const rawToken    = crypto.randomBytes(32).toString('hex');
  this.emailVerificationToken   = crypto.createHash('sha256').update(rawToken).digest('hex');
  this.emailVerificationExpires = Date.now() + 24 * 60 * 60 * 1000; // 24 hours
  return rawToken;
};

// ─── Instance method: generate password reset token ───────────────────────────
userSchema.methods.createPasswordResetToken = function () {
  const rawToken           = crypto.randomBytes(32).toString('hex');
  this.passwordResetToken   = crypto.createHash('sha256').update(rawToken).digest('hex');
  this.passwordResetExpires = Date.now() + 10 * 60 * 1000; // 10 minutes only
  return rawToken;
};

// ─── Instance method: remove expired refresh tokens ───────────────────────────
userSchema.methods.cleanExpiredTokens = function () {
  const now            = new Date();
  this.refreshTokens   = (this.refreshTokens || []).filter(
    (t) => new Date(t.expiresAt) > now
  );
};

// ─── Instance method: safe user object (no secrets) ───────────────────────────
// Use this whenever sending user data in API responses
userSchema.methods.toSafeObject = function () {
  return {
    _id:             this._id,
    name:            this.name,
    email:           this.email,
    avatar:          this.avatar,
    isEmailVerified: this.isEmailVerified,
    lastLogin:       this.lastLogin,
    createdAt:       this.createdAt,
  };
};

module.exports = mongoose.model('User', userSchema);