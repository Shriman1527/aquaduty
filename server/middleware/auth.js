const { verifyAccessToken } = require('../utils/jwt');
const User = require('../models/User');

// ─── protect ──────────────────────────────────────────────────────────────────
// Add this to any route that requires login
// It reads the Bearer token from the Authorization header,
// verifies it, fetches the user, and attaches them to req.user

const protect = async (req, res, next) => {
  try {
    // 1. Check Authorization header exists
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'Not logged in. Please log in to continue.',
      });
    }

    // 2. Extract token
    const token = authHeader.split(' ')[1];

    // 3. Verify token signature and expiry
    let decoded;
    try {
      decoded = verifyAccessToken(token);
    } catch (err) {
      // Tell the frontend exactly WHY it failed
      // so it knows to use the refresh token
      if (err.name === 'TokenExpiredError') {
        return res.status(401).json({
          success: false,
          message: 'Session expired. Please refresh.',
          code:    'TOKEN_EXPIRED',
        });
      }
      return res.status(401).json({
        success: false,
        message: 'Invalid token. Please log in again.',
      });
    }

    // 4. Make sure it is an access token, not a refresh token
    if (decoded.type !== 'access') {
      return res.status(401).json({
        success: false,
        message: 'Invalid token type.',
      });
    }

    // 5. Fetch user from DB (confirms user still exists)
    const user = await User.findById(decoded.id);
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'User no longer exists.',
      });
    }

    // 6. Attach user to request — available in all route handlers after this
    req.user = user;
    next();

  } catch (err) {
    next(err);
  }
};

// ─── requireVerified ──────────────────────────────────────────────────────────
// Add this AFTER protect on routes that need verified email
// e.g. creating rooms, joining rooms

const requireVerified = (req, res, next) => {
  if (!req.user.isEmailVerified) {
    return res.status(403).json({
      success: false,
      message: 'Please verify your email address first.',
      code:    'EMAIL_NOT_VERIFIED',
    });
  }
  next();
};

module.exports = { protect, requireVerified };