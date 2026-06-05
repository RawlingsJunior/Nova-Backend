const express = require('express');
const router = express.Router();
const { 
  register, 
  login, 
  getMe, 
  adminCreateUser, 
  adminResetPassword, 
  updatePassword,
  getCaptcha,
  sendOtp,
  sendResetOtp,
  verifyResetOtp,
  resetPassword
} = require('../controllers/authController');
const { getPendingAdmins, addPendingAdmin, removePendingAdmin } = require('../controllers/adminAuthController');
const { authMiddleware, adminMiddleware } = require('../middleware/auth');
const { validate, registerValidation, loginValidation } = require('../middleware/validation');

// Public Auth Routes
router.get('/captcha', getCaptcha);
router.post('/send-otp', sendOtp);
router.post('/send-reset-otp', sendResetOtp);
router.post('/verify-reset-otp', verifyResetOtp);
router.post('/reset-password', resetPassword);
router.post('/register', registerValidation, validate, register);
router.post('/login', loginValidation, validate, login);

// Protected Auth Routes
router.get('/me', authMiddleware, getMe);
router.post('/update-password', authMiddleware, updatePassword);

// Admin-only management
router.post('/admin-create-user', authMiddleware, adminMiddleware, adminCreateUser);
router.post('/admin-reset-password', authMiddleware, adminMiddleware, adminResetPassword);
router.get('/pending-admins', authMiddleware, adminMiddleware, getPendingAdmins);
router.post('/pending-admins', authMiddleware, adminMiddleware, addPendingAdmin);
router.delete('/pending-admins/:email', authMiddleware, adminMiddleware, removePendingAdmin);

module.exports = router;
