const express = require('express');
const router = express.Router();
const { 
  getServices, 
  getAllServices,
  createService, 
  updateService, 
  deleteService, 
  reorderServices 
} = require('../controllers/serviceController.js');
const { authMiddleware, adminMiddleware } = require('../middleware/auth.js');

// Public routes
router.get('/', getServices);

// Admin routes
router.get('/all', authMiddleware, adminMiddleware, getAllServices);
router.post('/', authMiddleware, adminMiddleware, createService);
router.put('/:id', authMiddleware, adminMiddleware, updateService);
router.delete('/:id', authMiddleware, adminMiddleware, deleteService);
router.post('/reorder', authMiddleware, adminMiddleware, reorderServices);

module.exports = router;
