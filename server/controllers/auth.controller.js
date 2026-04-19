const crypto = require('crypto');
const User   = require('../models/User');
const {
  generateAccessToken,
  generateRefreshToken,
  verifyRefreshToken,
  setRefreshCookie,
  clearRefreshCookie,
  getRefreshTokenExpiry,
} = require('../utils/jwt');
const {
  sendVerificationEmail,
  sendPasswordResetEmail,
} = require('../services/email.service');

// ─── REGISTER ─────────────────────────────────────────────────────────────────
// POST /api/auth/register
exports.register = async (req, res, next) => {
  try {
    const { name, email, password } = req.body;

    // 1. Check if email already taken
    const existing = await User.findOne({ email });
    if (existing) {
      return res.status(409).json({
        success: false,
        message: 'An account with this email already exists.',
      });
    }

    // 2. Create user (password gets hashed in the pre-save hook)
    const user = new User({ name, email, password });

    // 3. Generate email verification token
    const rawToken = user.createEmailVerificationToken();

    // 4. Save user to DB
    await user.save();

    // 5. Send verification email
    // We don't await this — if email fails, registration still succeeds
    sendVerificationEmail({ email, name, token: rawToken }).catch((err) =>
      console.error('Verification email failed:', err.message)
    );

    res.status(201).json({
      success: true,
      message: 'Account created! Please check your email to verify your account.',
      data: { userId: user._id },
    });

  } catch (err) {
    next(err);
  }
};

// ─── VERIFY EMAIL ─────────────────────────────────────────────────────────────
// GET /api/auth/verify-email?token=xxxxx
exports.verifyEmail = async (req, res, next) => {
  try {
    const { token } = req.query;

    if (!token) {
      return res.status(400).json({
        success: false,
        message: 'Verification token is missing.',
      });
    }

    // Hash the raw token to compare with what is stored in DB
    const hashed = crypto.createHash('sha256').update(token).digest('hex');

    // Find user with matching token that has not expired
    const user = await User.findOne({
      emailVerificationToken:   hashed,
      emailVerificationExpires: { $gt: Date.now() },
    }).select('+emailVerificationToken +emailVerificationExpires');

    if (!user) {
      return res.status(400).json({
        success: false,
        message: 'Verification link is invalid or has expired.',
      });
    }

    // Mark email as verified and clear the token
    user.isEmailVerified          = true;
    user.emailVerificationToken   = undefined;
    user.emailVerificationExpires = undefined;
    await user.save();

    res.json({
      success: true,
      message: 'Email verified successfully! You can now log in.',
    });

  } catch (err) {
    next(err);
  }
};

// ─── RESEND VERIFICATION EMAIL ────────────────────────────────────────────────
// POST /api/auth/resend-verification
exports.resendVerification = async (req, res, next) => {
  try {
    const { email } = req.body;

    const user = await User.findOne({ email })
      .select('+emailVerificationToken +emailVerificationExpires');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'No account found with this email.',
      });
    }

    if (user.isEmailVerified) {
      return res.status(400).json({
        success: false,
        message: 'This email is already verified.',
      });
    }

    const rawToken = user.createEmailVerificationToken();
    await user.save();

    sendVerificationEmail({
      email: user.email,
      name:  user.name,
      token: rawToken,
    }).catch(console.error);

    res.json({
      success: true,
      message: 'Verification email resent. Please check your inbox.',
    });

  } catch (err) {
    next(err);
  }
};

// ─── LOGIN ────────────────────────────────────────────────────────────────────
// POST /api/auth/login
exports.login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    // 1. Find user — explicitly select password since it has select: false
    const user = await User.findOne({ email })
      .select('+password +refreshTokens');

    // 2. Check user exists AND password matches
    // We do both checks together to prevent email enumeration attacks
    if (!user || !(await user.comparePassword(password))) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password.',
      });
    }

    // 3. Generate tokens
    const accessToken  = generateAccessToken(user._id);
    const refreshToken = generateRefreshToken(user._id);

    // 4. Store refresh token in DB + clean up old expired ones
    user.cleanExpiredTokens();
    user.refreshTokens.push({
      token:     refreshToken,
      expiresAt: getRefreshTokenExpiry(),
    });
    user.lastLogin = new Date();
    await user.save();

    // 5. Set refresh token as httpOnly cookie
    setRefreshCookie(res, refreshToken);

    // 6. Send access token + user data in response
    res.json({
      success: true,
      message: 'Login successful.',
      data: {
        accessToken,
        user: user.toSafeObject(),
      },
    });

  } catch (err) {
    next(err);
  }
};

// ─── REFRESH TOKEN ────────────────────────────────────────────────────────────
// POST /api/auth/refresh-token
// Called silently by the frontend when the access token expires
exports.refreshToken = async (req, res, next) => {
  try {
    // 1. Read refresh token from httpOnly cookie
    const token = req.cookies?.refreshToken;

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'No refresh token found. Please log in.',
      });
    }

    // 2. Verify the token
    let decoded;
    try {
      decoded = verifyRefreshToken(token);
    } catch {
      return res.status(401).json({
        success: false,
        message: 'Refresh token invalid or expired. Please log in again.',
      });
    }

    // 3. Find user and check token exists in DB
    const user = await User.findById(decoded.id).select('+refreshTokens');

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'User not found.',
      });
    }

    const storedToken = user.refreshTokens.find((t) => t.token === token);

    // Token reuse detected — someone is trying to use an old token
    // This is a security breach — revoke ALL sessions
    if (!storedToken) {
      user.refreshTokens = [];
      await user.save();
      clearRefreshCookie(res);
      return res.status(401).json({
        success: false,
        message: 'Security alert: Please log in again.',
      });
    }

    // 4. Rotate tokens — old one out, new one in
    const newAccessToken  = generateAccessToken(user._id);
    const newRefreshToken = generateRefreshToken(user._id);

    user.refreshTokens = user.refreshTokens.filter((t) => t.token !== token);
    user.cleanExpiredTokens();
    user.refreshTokens.push({
      token:     newRefreshToken,
      expiresAt: getRefreshTokenExpiry(),
    });
    await user.save();

    setRefreshCookie(res, newRefreshToken);

    res.json({
      success: true,
      data: {
        accessToken: newAccessToken,
        user:        user.toSafeObject(),
      },
    });

  } catch (err) {
    next(err);
  }
};

// ─── LOGOUT ───────────────────────────────────────────────────────────────────
// POST /api/auth/logout
exports.logout = async (req, res, next) => {
  try {
    const token = req.cookies?.refreshToken;

    if (token) {
      // Remove this specific refresh token from DB
      const user = await User.findById(req.user._id).select('+refreshTokens');
      if (user) {
        user.refreshTokens = user.refreshTokens.filter((t) => t.token !== token);
        await user.save();
      }
    }

    clearRefreshCookie(res);

    res.json({
      success: true,
      message: 'Logged out successfully.',
    });

  } catch (err) {
    next(err);
  }
};

// ─── FORGOT PASSWORD ──────────────────────────────────────────────────────────
// POST /api/auth/forgot-password
exports.forgotPassword = async (req, res, next) => {
  try {
    const { email } = req.body;

    const user = await User.findOne({ email })
      .select('+passwordResetToken +passwordResetExpires');

    // Always return the same message whether user exists or not
    // This prevents attackers from knowing which emails are registered
    if (!user) {
      return res.json({
        success: true,
        message: 'If that email is registered, a reset link has been sent.',
      });
    }

    const rawToken = user.createPasswordResetToken();
    await user.save();

    sendPasswordResetEmail({
      email: user.email,
      name:  user.name,
      token: rawToken,
    }).catch(console.error);

    res.json({
      success: true,
      message: 'If that email is registered, a reset link has been sent.',
    });

  } catch (err) {
    next(err);
  }
};

// ─── RESET PASSWORD ───────────────────────────────────────────────────────────
// POST /api/auth/reset-password
exports.resetPassword = async (req, res, next) => {
  try {
    const { token, password } = req.body;

    const hashed = crypto.createHash('sha256').update(token).digest('hex');

    const user = await User.findOne({
      passwordResetToken:   hashed,
      passwordResetExpires: { $gt: Date.now() },
    }).select('+passwordResetToken +passwordResetExpires +refreshTokens');

    if (!user) {
      return res.status(400).json({
        success: false,
        message: 'Reset link is invalid or has expired.',
      });
    }

    // Set new password — pre-save hook will hash it
    user.password             = password;
    user.passwordResetToken   = undefined;
    user.passwordResetExpires = undefined;

    // Revoke all existing sessions for security
    user.refreshTokens = [];

    await user.save();

    clearRefreshCookie(res);

    res.json({
      success: true,
      message: 'Password reset successful. Please log in with your new password.',
    });

  } catch (err) {
    next(err);
  }
};


// ─── TOGGLE VACATION MODE ─────────────────────────────────────────────────────
// PATCH /api/auth/vacation
// Toggles the isOnVacation status for the currently logged-in user
exports.toggleVacationMode = async (req, res, next) => {
  try {
    // req.user is provided by your protect middleware
    const user = await User.findById(req.user._id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found.',
      });
    }

    // Toggle the boolean
    user.isOnVacation = !user.isOnVacation;
    await user.save();

    res.json({
      success: true,
      message: user.isOnVacation 
        ? 'Vacation mode activated 🌴. You are removed from rotation.' 
        : 'Vacation mode deactivated. Welcome back to the rotation!',
      data: { user: user.toSafeObject() },
    });

  } catch (err) {
    next(err);
  }
};

// ─── GET ME ───────────────────────────────────────────────────────────────────
// GET /api/auth/me
// Returns the currently logged in user's data
exports.getMe = async (req, res) => {
  res.json({
    success: true,
    data: { user: req.user.toSafeObject() },
  });
};