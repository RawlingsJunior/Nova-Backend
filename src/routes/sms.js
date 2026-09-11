const express = require('express');
const router = express.Router();
const { getSMSLogs, sendBulkSMS, getSMSStats, deleteSMSLog, clearSMSLogs } = require('../controllers/smsController');
const { authMiddleware, adminMiddleware } = require('../middleware/auth');

// All SMS routes are admin only
router.use(authMiddleware);
router.use(adminMiddleware);

router.get('/logs', getSMSLogs);
router.get('/stats', getSMSStats);
router.post('/send-bulk', sendBulkSMS);
router.delete('/logs/:id', deleteSMSLog);
router.delete('/logs', clearSMSLogs);

module.exports = router;
