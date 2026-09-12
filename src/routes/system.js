const express = require('express');
const router = express.Router();
const { authMiddleware, optionalAuthMiddleware, superAdminMiddleware } = require('../middleware/auth');
const {
  getMetrics,
  getAuditLogs,
  logClientActivity,
  getLockedUsers,
  unlockUser
} = require('../controllers/systemController');

// All system monitoring & telemetry endpoints strictly require Super Admin authentication
router.get('/metrics', authMiddleware, superAdminMiddleware, getMetrics);
router.get('/audit-logs', authMiddleware, superAdminMiddleware, getAuditLogs);
router.get('/locked-users', authMiddleware, superAdminMiddleware, getLockedUsers);
router.post('/unlock-user', authMiddleware, superAdminMiddleware, unlockUser);

// User client activity tracker (accessible to authenticated users & visitors)
router.post('/activity', optionalAuthMiddleware, logClientActivity);

module.exports = router;
