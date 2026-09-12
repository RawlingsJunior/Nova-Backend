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
const { cacheMiddleware } = require('../lib/cache.js');

// Public route with HTTP & in-memory caching (10 min TTL + ETag)
router.get('/', cacheMiddleware({ ttl: 600, prefix: 'services' }), getServices);

// Admin routes (Never cached)
router.get('/all', authMiddleware, adminMiddleware, getAllServices);
router.post('/', authMiddleware, adminMiddleware, createService);
router.put('/:id', authMiddleware, adminMiddleware, updateService);
router.delete('/:id', authMiddleware, adminMiddleware, deleteService);
router.post('/reorder', authMiddleware, adminMiddleware, reorderServices);

module.exports = router;
