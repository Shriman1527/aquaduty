const jwt = require('jsonwebtoken');

// ─── Generate tokens ──────────────────────────────────────────────────────────

// Short-lived — sent in every API response header
// Stored in memory on the frontend (never localStorage)
const generateAccessToken = (userId) => {
  return jwt.sign(
    { id: userId, type: 'access' },
    process.env.JWT_ACCESS_SECRET,
    { expiresIn: process.env.JWT_ACCESS_EXPIRES || '15m' }
  );
};

// Long-lived — stored in httpOnly cookie
// Used only to get a new access token when it expires
const generateRefreshToken = (userId) => {
  return jwt.sign(
    { id: userId, type: 'refresh' },
    process.env.JWT_REFRESH_SECRET,
    { expiresIn: process.env.JWT_REFRESH_EXPIRES || '7d' }
  );
};

// ─── Verify tokens ────────────────────────────────────────────────────────────

const verifyAccessToken = (token) => {
  return jwt.verify(token, process.env.JWT_ACCESS_SECRET);
};

const verifyRefreshToken = (token) => {
  return jwt.verify(token, process.env.JWT_REFRESH_SECRET);
};

// ─── Cookie helpers ───────────────────────────────────────────────────────────

// Attach refresh token as a secure httpOnly cookie
// httpOnly = JavaScript on the page cannot read it (blocks XSS attacks)
// secure   = only sent over HTTPS in production
// sameSite = blocks CSRF attacks
const setRefreshCookie = (res, token) => {
  res.cookie('refreshToken', token, {
    httpOnly: true,
    secure:   process.env.NODE_ENV === 'production',
    sameSite: process.env.NODE_ENV === 'production' ? 'strict' : 'lax',
    maxAge:   7 * 24 * 60 * 60 * 1000, // 7 days in milliseconds
    path:     '/api/auth',              // cookie only sent to auth routes
  });
};

// Remove the refresh token cookie on logout
const clearRefreshCookie = (res) => {
  res.clearCookie('refreshToken', {
    httpOnly: true,
    secure:   process.env.NODE_ENV === 'production',
    sameSite: process.env.NODE_ENV === 'production' ? 'strict' : 'lax',
    path:     '/api/auth',
  });
};

// Calculate expiry date for storing in DB
const getRefreshTokenExpiry = () => {
  return new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days from now
};

module.exports = {
  generateAccessToken,
  generateRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
  setRefreshCookie,
  clearRefreshCookie,
  getRefreshTokenExpiry,
};