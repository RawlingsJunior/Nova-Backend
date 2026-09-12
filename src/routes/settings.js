const express = require('express');
const router = express.Router();
const { getSettings, updateSettings } = require('../controllers/settingsController');
const { authMiddleware, adminMiddleware } = require('../middleware/auth');
const { cacheMiddleware } = require('../lib/cache');

// Public settings route (Cached 5 mins)
router.get('/', cacheMiddleware({ ttl: 300, prefix: 'settings' }), getSettings);

// Admin update settings
router.put('/', authMiddleware, adminMiddleware, updateSettings);

module.exports = router;
