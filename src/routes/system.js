const express = require('express');
const router = express.Router();
const { authMiddleware, adminMiddleware, superAdminMiddleware } = require('../middleware/auth');
const {
  getMetrics,
  getAuditLogs,
  getLockedUsers,
  unlockUser
} = require('../controllers/systemController');

// All system monitoring & telemetry endpoints strictly require Super Admin authentication
router.get('/metrics', authMiddleware, superAdminMiddleware, getMetrics);
router.get('/audit-logs', authMiddleware, superAdminMiddleware, getAuditLogs);
router.get('/locked-users', authMiddleware, superAdminMiddleware, getLockedUsers);
router.post('/unlock-user', authMiddleware, superAdminMiddleware, unlockUser);

module.exports = router;
