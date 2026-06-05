const express = require('express');
const router = express.Router();
const { getAdminStats, getUserStats } = require('../controllers/dashboardController');
const { authMiddleware, adminMiddleware } = require('../middleware/auth');

// @route   GET api/dashboard/admin
// @desc    Get admin stats
// @access  Private/Admin
router.get('/admin', authMiddleware, adminMiddleware, getAdminStats);

// @route   GET api/dashboard/user
// @desc    Get user stats
// @access  Private
router.get('/user', authMiddleware, getUserStats);

module.exports = router;
