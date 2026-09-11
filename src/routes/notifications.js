const express = require('express');
const router = express.Router();
const { 
  getNotifications, 
  getAllNotifications, 
  markAsRead,
  markAllAsRead,
  deleteNotification,
  clearNotifications
} = require('../controllers/notificationController.js');
const { authMiddleware, adminMiddleware } = require('../middleware/auth.js');

// User routes
router.get('/', authMiddleware, getNotifications);
router.patch('/read-all', authMiddleware, markAllAsRead);
router.patch('/:id/read', authMiddleware, markAsRead);
router.delete('/:id', authMiddleware, deleteNotification);

// Admin routes
router.get('/admin', authMiddleware, adminMiddleware, getAllNotifications);
router.delete('/admin/clear-all', authMiddleware, adminMiddleware, clearNotifications);

module.exports = router;
