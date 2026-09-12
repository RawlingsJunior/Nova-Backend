const express = require('express');
const router = express.Router();
const { getSMSLogs, sendBulkSMS, getSMSStats, deleteSMSLog, clearSMSLogs } = require('../controllers/smsController');
const { authMiddleware, adminMiddleware, requirePermission } = require('../middleware/auth');
const { smsLimiter } = require('../middleware/rateLimiter');

// All SMS routes require authentication and admin privileges
router.use(authMiddleware);
router.use(adminMiddleware);

router.get('/logs', requirePermission('sms:read'), getSMSLogs);
router.get('/stats', requirePermission('sms:read'), getSMSStats);
router.post('/send-bulk', smsLimiter, requirePermission('sms:send'), sendBulkSMS);
router.delete('/logs/:id', requirePermission('sms:manage'), deleteSMSLog);
router.delete('/logs', requirePermission('sms:manage'), clearSMSLogs);

module.exports = router;
