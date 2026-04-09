const { body, param, validationResult } = require('express-validator');

// ─── Run validation and return errors if any ──────────────────────────────────
// This is always the LAST item in every validator array
const validate = (req, res, next) => {
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    // Only return the first error message (cleaner UX)
    return res.status(422).json({
      success: false,
      message: errors.array()[0].msg,
      errors:  errors.array(),
    });
  }

  next();
};

// ─── Auth validators ──────────────────────────────────────────────────────────

const registerValidator = [
  body('name')
    .trim()
    .notEmpty()
    .withMessage('Name is required')
    .isLength({ min: 2, max: 50 })
    .withMessage('Name must be between 2 and 50 characters'),

  body('email')
    .trim()
    .notEmpty()
    .withMessage('Email is required')
    .isEmail()
    .withMessage('Please enter a valid email address')
    .normalizeEmail(),

  body('password')
    .notEmpty()
    .withMessage('Password is required')
    .isLength({ min: 8 })
    .withMessage('Password must be at least 8 characters')
    .matches(/[A-Z]/)
    .withMessage('Password must contain at least one uppercase letter')
    .matches(/[a-z]/)
    .withMessage('Password must contain at least one lowercase letter')
    .matches(/[0-9]/)
    .withMessage('Password must contain at least one number'),

  validate,
];

const loginValidator = [
  body('email')
    .trim()
    .notEmpty()
    .withMessage('Email is required')
    .isEmail()
    .withMessage('Please enter a valid email address')
    .normalizeEmail(),

  body('password')
    .notEmpty()
    .withMessage('Password is required'),

  validate,
];

const forgotPasswordValidator = [
  body('email')
    .trim()
    .notEmpty()
    .withMessage('Email is required')
    .isEmail()
    .withMessage('Please enter a valid email address')
    .normalizeEmail(),

  validate,
];

const resetPasswordValidator = [
  body('token')
    .notEmpty()
    .withMessage('Reset token is required'),

  body('password')
    .notEmpty()
    .withMessage('Password is required')
    .isLength({ min: 8 })
    .withMessage('Password must be at least 8 characters')
    .matches(/[A-Z]/)
    .withMessage('Password must contain at least one uppercase letter')
    .matches(/[a-z]/)
    .withMessage('Password must contain at least one lowercase letter')
    .matches(/[0-9]/)
    .withMessage('Password must contain at least one number'),

  validate,
];

// ─── Room validators ──────────────────────────────────────────────────────────

const createRoomValidator = [
  body('name')
    .trim()
    .notEmpty()
    .withMessage('Room name is required')
    .isLength({ max: 60 })
    .withMessage('Room name cannot exceed 60 characters'),

  body('hostelName')
    .trim()
    .notEmpty()
    .withMessage('Hostel name is required')
    .isLength({ max: 80 })
    .withMessage('Hostel name cannot exceed 80 characters'),

  body('roomNumber')
    .trim()
    .notEmpty()
    .withMessage('Room number is required')
    .isLength({ max: 20 })
    .withMessage('Room number cannot exceed 20 characters'),

  body('dutyFrequencyHours')
    .optional()
    .isInt({ min: 1, max: 168 })
    .withMessage('Duty frequency must be between 1 and 168 hours'),

  validate,
];

const joinByCodeValidator = [
  body('code')
    .trim()
    .notEmpty()
    .withMessage('Invite code is required')
    .isLength({ min: 6, max: 6 })
    .withMessage('Invite code must be exactly 6 characters')
    .toUpperCase(),

  validate,
];

const inviteValidator = [
  body('email')
    .optional()
    .isEmail()
    .withMessage('Please enter a valid email address')
    .normalizeEmail(),

  validate,
];

// ─── Duty validators ──────────────────────────────────────────────────────────

const completeDutyValidator = [
  param('id')
    .isMongoId()
    .withMessage('Invalid duty ID'),

  body('notes')
    .optional()
    .trim()
    .isLength({ max: 300 })
    .withMessage('Notes cannot exceed 300 characters'),

  validate,
];

module.exports = {
  registerValidator,
  loginValidator,
  forgotPasswordValidator,
  resetPasswordValidator,
  createRoomValidator,
  joinByCodeValidator,
  inviteValidator,
  completeDutyValidator,
};