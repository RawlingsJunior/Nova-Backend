const express = require('express');
const router = express.Router();
const { getMyProfile, getAllProfiles, getProfileById, updateMyProfile, updateProfileByAdmin, deleteProfileAndUser } = require('../controllers/profileController.js');
const { authMiddleware, adminMiddleware } = require('../middleware/auth');

// Authenticated user: get own profile
router.get('/me', authMiddleware, getMyProfile);

// Authenticated user: update own profile
router.put('/me', authMiddleware, updateMyProfile);

// Admin: get all profiles
router.get('/', authMiddleware, adminMiddleware, getAllProfiles);

// Admin: get specific profile
router.get('/:id', authMiddleware, adminMiddleware, getProfileById);

// Admin: update specific profile
router.put('/:id', authMiddleware, adminMiddleware, updateProfileByAdmin);

// Admin: delete specific profile & user
router.delete('/:id', authMiddleware, adminMiddleware, deleteProfileAndUser);

module.exports = router;
