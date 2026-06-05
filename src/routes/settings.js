const express = require('express');
const router = express.Router();
const { getSettings, updateSettings } = require('../controllers/settingsController.js');
const { authMiddleware, adminMiddleware } = require('../middleware/auth');

// Public: get clinic settings
router.get('/', getSettings);

// Admin: update settings
router.put('/', authMiddleware, adminMiddleware, updateSettings);

module.exports = router;
