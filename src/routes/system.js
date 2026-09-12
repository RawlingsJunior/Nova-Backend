const express = require('express');
const router = express.Router();
const { authMiddleware, adminMiddleware, superAdminMiddleware } = require('../middleware/auth');
const {
  getMetrics,
  getAuditLogs,
  getLockedUsers,
  unlockUser
} = require('../controllers/systemController');

// All system monitoring endpoints require admin authentication
router.get('/metrics', authMiddleware, adminMiddleware, getMetrics);
router.get('/audit-logs', authMiddleware, adminMiddleware, getAuditLogs);
router.get('/locked-users', authMiddleware, adminMiddleware, getLockedUsers);
router.post('/unlock-user', authMiddleware, adminMiddleware, unlockUser);

module.exports = router;
