const express = require('express');
const router = express.Router();
const { getAllCMS, getCMSSection, updateCMSSection } = require('../controllers/cmsController');
const { authMiddleware, adminMiddleware } = require('../middleware/auth');
const { cacheMiddleware } = require('../lib/cache');

// GET all CMS content (Cached 15 mins)
router.get('/', cacheMiddleware({ ttl: 900, prefix: 'cms' }), getAllCMS);

// GET a specific section (Cached 15 mins)
router.get('/:section', cacheMiddleware({ ttl: 900, prefix: 'cms' }), getCMSSection);

// PUT update a specific section (admin only)
router.put('/:section', authMiddleware, adminMiddleware, updateCMSSection);

module.exports = router;
