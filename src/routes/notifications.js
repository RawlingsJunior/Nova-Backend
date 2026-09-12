const express = require('express');
const router = express.Router();
const { 
  getNotifications, 
  getAllNotifications, 
  markAsRead,
  markAllAsRead,
  deleteNotification,
  clearNotifications,
  registerDeviceToken,
  unregisterDeviceToken,
  sendTestPush
} = require('../controllers/notificationController.js');
const { authMiddleware, adminMiddleware } = require('../middleware/auth.js');

// User routes
router.get('/', authMiddleware, getNotifications);
router.patch('/read-all', authMiddleware, markAllAsRead);
router.patch('/:id/read', authMiddleware, markAsRead);
router.delete('/:id', authMiddleware, deleteNotification);

// FCM Device Push Token routes
router.post('/device-token', authMiddleware, registerDeviceToken);
router.delete('/device-token', authMiddleware, unregisterDeviceToken);
router.post('/test-push', authMiddleware, sendTestPush);

// Admin routes
router.get('/admin', authMiddleware, adminMiddleware, getAllNotifications);
router.delete('/admin/clear-all', authMiddleware, adminMiddleware, clearNotifications);

module.exports = router;
