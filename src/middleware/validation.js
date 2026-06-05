const { body, validationResult } = require('express-validator');

const path = require('path');
const fs = require('fs');

const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (errors.isEmpty()) {
    return next();
  }
  
  const errorMsg = `[${new Date().toISOString()}] Validation error for ${req.method} ${req.originalUrl}: ${JSON.stringify(errors.array())}\n`;
  const errorFile = path.join(__dirname, '../logs/error.log');
  
  // Ensure logs directory exists
  const logsDir = path.join(__dirname, '../logs');
  if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
  }
  
  try {
    fs.appendFileSync(errorFile, errorMsg);
  } catch (err) {
    console.error('Failed to write to validation log:', err.message);
  }
  
  console.log('VALIDATION FAILED:', JSON.stringify(errors.array(), null, 2));
  
  return res.status(400).json({ 
    message: 'Validation failed',
    errors: errors.array() 
  });
};

// Auth Validation
const registerValidation = [
  body('fullName').notEmpty().withMessage('Full name is required').trim().escape(),
  body('email').isEmail().withMessage('Please include a valid email').normalizeEmail(),
  body('password')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?`~]).{8,}$/)
    .withMessage('Password must be at least 8 characters and include uppercase, lowercase, a number, and a special character'),
  body('phone').notEmpty().withMessage('Phone number is required').trim()
];

const loginValidation = [
  body('email').isEmail().withMessage('Please include a valid email').normalizeEmail(),
  body('password').exists().withMessage('Password is required')
];

// Appointment Validation
const appointmentValidation = [
  body('appointmentDate').notEmpty().withMessage('Appointment date is required'),
  body('appointmentTime').notEmpty().withMessage('Appointment time is required'),
  body('service').notEmpty().withMessage('Service is required').trim().escape(),
  body('fullName').notEmpty().withMessage('Full name is required').trim().escape(),
  body('email').isEmail().withMessage('Valid email is required').normalizeEmail(),
  body('phone').notEmpty().withMessage('Phone number is required').trim()
];

// Medical Validation
const screeningValidation = [
  body('patientId').isUUID().withMessage('Invalid Patient ID'),
  body('vaRight').notEmpty().withMessage('VA Right is required'),
  body('vaLeft').notEmpty().withMessage('VA Left is required'),
  body('diagnosis').notEmpty().withMessage('Diagnosis is required').trim().escape()
];

const medicalHistoryValidation = [
  body('ocularHistory').optional().trim().escape(),
  body('systemicConditions').optional().trim().escape(),
  body('currentMedications').optional().trim().escape(),
  body('familyEyeHistory').optional().trim().escape(),
  body('allergies').optional().trim().escape()
];

// CMS Validation
const cmsValidation = [
  body('title').notEmpty().withMessage('Title is required').trim().escape(),
  body('content').notEmpty().withMessage('Content is required').trim()
];

module.exports = {
  validate,
  registerValidation,
  loginValidation,
  appointmentValidation,
  screeningValidation,
  medicalHistoryValidation,
  cmsValidation
};
