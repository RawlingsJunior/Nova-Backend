const express = require('express');
const router = express.Router();
const { getAllCMS, getCMSSection, updateCMSSection } = require('../controllers/cmsController');
const { authMiddleware, adminMiddleware } = require('../middleware/auth');

// GET all CMS content
router.get('/', getAllCMS);

// GET a specific section
router.get('/:section', getCMSSection);

// PUT update a specific section (admin only)
router.put('/:section', authMiddleware, adminMiddleware, updateCMSSection);

module.exports = router;
